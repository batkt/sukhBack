const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const Medegdel = require("../models/medegdel");
const { daraagiinTulukhOgnooZasya } = require("./tulbur");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    console.log("gereeniiGuilgeeKhadgalya -----> Ийшээ орлоо");
    const { db } = require("zevbackv2");

    // Handle both formats: { guilgee: {...} } OR flat { gereeniiId: ..., turul: ..., etc }
    var guilgee = req.body.guilgee || req.body;

    // Normalize amount fields based on turul type
    // avlaga = debt/invoice (uses tulukhDun - amount TO pay)
    // tulult/ashiglalt = payment (uses tulsunDun - amount PAID)
    const dun = guilgee.dun || guilgee.tulukhDun || guilgee.tulsunDun || 0;

    if (guilgee.turul === "avlaga") {
      // For avlaga: set tulukhDun, NOT tulsunDun
      guilgee.tulukhDun = dun;
      guilgee.tulsunDun = 0; // avlaga doesn't pay, it creates debt
    } else if (guilgee.turul === "tulult" || guilgee.turul === "ashiglalt") {
      // For payment types: set tulsunDun
      guilgee.tulsunDun = dun;
      guilgee.tulukhDun = 0;
    } else {
      // Default (barter, etc.)
      guilgee.tulsunDun = dun;
    }

    if (!guilgee.gereeniiId) {
      throw new Error("Гэрээний ID заавал бөглөх шаардлагатай!");
    }

    let baiguullagiinId = req.body.baiguullagiinId || guilgee.baiguullagiinId;

    if (!baiguullagiinId) {
      const allConnections = db.kholboltuud || [];
      let foundGeree = null;

      for (const conn of allConnections) {
        try {
          const tempGeree = await Geree(conn, true).findById(guilgee.gereeniiId).select("baiguullagiinId");
          if (tempGeree) {
            foundGeree = tempGeree;
            baiguullagiinId = tempGeree.baiguullagiinId;
            break;
          }
        } catch (err) {
        }
      }

      if (!baiguullagiinId) {
        throw new Error("Байгууллагын ID олдсонгүй! Гэрээ олдсонгүй эсвэл байгууллагын ID-г body-д оруулна уу.");
      }
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => String(kholbolt.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      throw new Error("Холболтын мэдээлэл олдсонгүй!");
    }

    if (guilgee.guilgeeniiId) {
      var shalguur = await BankniiGuilgee(
        tukhainBaaziinKholbolt, true
      ).findOne({
        "guilgee.guilgeeniiId": guilgee.guilgeeniiId,
        kholbosonGereeniiId: guilgee.gereeniiId,
      });
      if (shalguur)
        throw new Error("Тухайн гүйлгээ тухайн гэрээнд холбогдсон байна!");
    }

    if (
      (guilgee.turul == "barter" ||
        guilgee.turul == "avlaga" ||
        guilgee.turul == "tulult" ||
        guilgee.turul == "ashiglalt") &&
      !guilgee.tailbar
    ) {
      throw new Error("Тайлбар заавал оруулна уу?");
    }

    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }

    // avlaga creates invoice only, tulult and ashiglalt pay (reduce balance)
    // NOTE: Using globalUldegdel field (not uldegdel) as that's what exists in Geree schema
    // AVLAGA (Charge) duplication prevention:
    // If it's an 'avlaga' type, we skip the globalUldegdel increment here
    // because it's handled by gereeNeesNekhemjlekhUusgekh (invoice creation service).
    var inc = {};

    if (guilgee.turul == "tulult" || guilgee.turul == "ashiglalt") {
      // These types pay - reduce the balance (use tulsunDun)
      inc.globalUldegdel = -(guilgee?.tulsunDun || 0);
    } else if (guilgee.turul == "avlaga") {
      // Normal avlaga creates invoice - SKIP manual increment here as it will be handled by nekhemjlekh service
      inc = {};
      console.log("ℹ️ [GEREE] Skipping manual globalUldegdel increment for avlaga - handled by invoice service");
    } else {
      // Default behavior for other types (barter, etc.)
      inc.globalUldegdel = -(guilgee?.tulsunDun || 0);
    }

    // Capture standalone record ID for syncing
    let newAvlagaId = null;

    // Use count from newly created collection logic later or just query it
    const GereeniiTulukhAvlagaModel = GereeniiTulukhAvlaga(tukhainBaaziinKholbolt);
    const count = await GereeniiTulukhAvlagaModel.countDocuments({ gereeniiId: guilgee.gereeniiId });

    // Store in appropriate model based on turul type
    // We do this BEFORE updating the Geree so we have the ID for the queue
    try {
      const freshGereeForAvlaga = await Geree(tukhainBaaziinKholbolt, true)
        .findById(guilgee.gereeniiId)
        .select("gereeniiDugaar orshinSuugchId baiguullagiinId baiguullagiinNer barilgiinId")
        .lean();

      if (freshGereeForAvlaga) {
        if (guilgee.turul === "avlaga") {
          // Create standalone GereeniiTulukhAvlaga record immediately for history visibility
          const TulukhAvlagaModel = GereeniiTulukhAvlaga(tukhainBaaziinKholbolt);
          const newAvlaga = new TulukhAvlagaModel({
            baiguullagiinId: freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
            baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
            barilgiinId: freshGereeForAvlaga.barilgiinId || "",
            gereeniiId: guilgee.gereeniiId,
            gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
            orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",
            ognoo: guilgee.ognoo || guilgee.guilgeeKhiisenOgnoo || new Date(),
            undsenDun: dun,
            tulukhDun: dun,
            uldegdel: dun,
            turul: "avlaga",
            zardliinNer: guilgee.ekhniiUldegdelEsekh ? "Эхний үлдэгдэл" : (guilgee.zardliinNer || "Авлага"),
            ekhniiUldegdelEsekh: guilgee.ekhniiUldegdelEsekh === true,
            source: "gar",
            tailbar: guilgee.tailbar || (guilgee.ekhniiUldegdelEsekh ? "Гараар нэмсэн эхний үлдэгдэл" : ""),
            guilgeeKhiisenAjiltniiNer: guilgee.guilgeeKhiisenAjiltniiNer || "",
            guilgeeKhiisenAjiltniiId: guilgee.guilgeeKhiisenAjiltniiId || "",
          });
          const savedAvlaga = await newAvlaga.save();
          newAvlagaId = savedAvlaga._id;
          console.log("✅ [GEREE AVLAGA] Created standalone debt record:", newAvlagaId);

          // If this is an initial balance (ekhniiUldegdelEsekh), also update any
          // existing unpaid invoices for this contract immediately — don't wait for next invoice
          if (guilgee.ekhniiUldegdelEsekh === true && dun > 0) {
            try {
              const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
              const NekhemjlekhModel = NekhemjlekhiinTuukh(tukhainBaaziinKholbolt);

              const unpaidInvoices = await NekhemjlekhModel.find({
                gereeniiId: guilgee.gereeniiId,
                tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
              }).lean();

              for (const invoice of unpaidInvoices) {
                const newNiitTulbur = (invoice.niitTulbur || 0) + dun;
                const newUldegdel = (invoice.uldegdel || 0) + dun;

                const zardluud = (invoice.medeelel?.zardluud || []).map((z) => {
                  if (z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл") {
                    return {
                      ...z,
                      tariff: (z.tariff || 0) + dun,
                      dun: (z.dun || 0) + dun,
                      tailbar: guilgee.tailbar || "Гараар нэмсэн эхний үлдэгдэл",
                    };
                  }
                  return z;
                });

                await NekhemjlekhModel.findByIdAndUpdate(invoice._id, {
                  $set: {
                    niitTulbur: newNiitTulbur,
                    uldegdel: newUldegdel,
                    ekhniiUldegdel: (invoice.ekhniiUldegdel || 0) + dun,
                    "medeelel.zardluud": zardluud,
                  },
                });
              }
              console.log(`✅ [GEREE AVLAGA] Updated ${unpaidInvoices.length} unpaid invoice(s) with initial balance ${dun}`);
            } catch (invoiceUpdateError) {
              console.error("❌ [GEREE AVLAGA] Error updating unpaid invoices with initial balance:", invoiceUpdateError.message);
            }
          }
        } else if (guilgee.turul === "tulult" || guilgee.turul === "ashiglalt") {
          // TULULT/ASHIGLALT: Store in GereeniiTulsunAvlaga (payment record)
          const tulsunModel = GereeniiTulsunAvlaga(tukhainBaaziinKholbolt);

          const tulsunDoc = new tulsunModel({
            baiguullagiinId: freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
            baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
            barilgiinId: freshGereeForAvlaga.barilgiinId || "",
            gereeniiId: guilgee.gereeniiId,
            gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
            orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",

            ognoo: guilgee.guilgeeKhiisenOgnoo || new Date(),
            tulsunDun: guilgee.tulsunDun || 0,
            tulsunAldangi: 0,

            turul: guilgee.turul, // "tulult" or "ashiglalt"
            zardliinTurul: guilgee.zardliinTurul || "",
            zardliinId: guilgee.zardliinId || "",
            zardliinNer: guilgee.zardliinNer || "",

            tailbar: guilgee.tailbar || "",
            nemeltTailbar: guilgee.nemeltTailbar || "",

            source: "geree",
            guilgeeKhiisenAjiltniiNer: guilgee.guilgeeKhiisenAjiltniiNer || "",
            guilgeeKhiisenAjiltniiId: guilgee.guilgeeKhiisenAjiltniiId || "",
          });

          const savedTulsun = await tulsunDoc.save();
          console.log(`✅ [GEREE ${guilgee.turul.toUpperCase()}] Created gereeniiTulsunAvlaga record for ${guilgee.turul}`);
        }
      }
    } catch (recordError) {
      console.error("❌ [GEREE] Error creating avlaga/tulsun record:", recordError.message);
    }

    // Now update the Geree object
    const updateData = { $inc: inc };

    // Prepare the queued transaction
    const guilgeeForNekhemjlekh = {
      ...guilgee,
      _id: newAvlagaId || `manual-${Date.now()}`, // Link to the standalone record
      avlagaGuilgeeIndex: count
    };

    // ALWAYS push to guilgeenuudForNekhemjlekh for manual adjustments
    // We want them to be merged into the next invoice automatically
    updateData.$push = { guilgeenuudForNekhemjlekh: guilgeeForNekhemjlekh };

    const result = await Geree(tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: guilgee.gereeniiId },
        updateData,
        { new: true } // Return updated document
      );

    await daraagiinTulukhOgnooZasya(
      guilgee.gereeniiId,
      tukhainBaaziinKholbolt
    );

    try {
      if (guilgee.turul === "avlaga" && result && result.orshinSuugchId) {
        const medegdel = new Medegdel(tukhainBaaziinKholbolt)();
        medegdel.orshinSuugchId = result.orshinSuugchId;
        medegdel.baiguullagiinId = baiguullagiinId;
        medegdel.barilgiinId = result.barilgiinId || "";
        medegdel.title = "Шинэ авлага нэмэгдлээ";
        medegdel.message = `Гэрээний дугаар: ${result.gereeniiDugaar || "N/A"}, Төлбөр: ${guilgee.tulukhDun || 0}₮`;
        medegdel.kharsanEsekh = false;
        medegdel.turul = "мэдэгдэл";
        medegdel.ognoo = new Date();

        await medegdel.save();

        const io = req.app.get("socketio");
        if (io) {
          io.emit("orshinSuugch" + result.orshinSuugchId, medegdel);
        }
      }
    } catch (notificationError) {
      console.error("Error sending notification for avlaga:", notificationError);
    }

    // NOTE: Removed automatic call to gereeNeesNekhemjlekhUusgekh here.
    // Manual adjustments are now correctly queued in 'guilgeenuudForNekhemjlekh'
    // and will be merged into the next invoice (manual or scheduled).
    // This prevents redundant invoice documents and the cascade-delete bug.

    if (guilgee.guilgeeniiId) {
      const result1 = await BankniiGuilgee(tukhainBaaziinKholbolt)
        .updateOne(
          { _id: guilgee.guilgeeniiId },
          {
            $set: {
              kholbosonGereeniiId: guilgee.gereeniiId,
              kholbosonTalbainId: result.talbainDugaar,
            },
          }
        );
      res.send(result1);
    } else {
      res.send(result);
    }
  } catch (aldaa) {
    next(aldaa);
  }
});

