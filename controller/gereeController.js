const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const Medegdel = require("../models/medegdel");
const { daraagiinTulukhOgnooZasya } = require("./tulbur");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    console.log("gereeniiGuilgeeKhadgalya -----> Ийшээ орлоо");
    const { db } = require("zevbackv2");
    var guilgee = req.body.guilgee;

    if (!guilgee.gereeniiId) {
      throw new Error("Гэрээний ID заавал бөглөх шаардлагатай!");
    }

    let baiguullagiinId = req.body.baiguullagiinId;
    
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
        guilgee.turul == "aldangi") &&
      !guilgee.tailbar
    ) {
      throw new Error("Тайлбар заавал оруулна уу?");
    }
    
    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }

    var inc = {
      uldegdel: -(guilgee?.tulsunDun || 0),
    };
    
    if (guilgee.turul == "aldangi") {
      inc["aldangiinUldegdel"] = -guilgee.tulsunAldangi;
      inc["niitTulsunAldangi"] = +guilgee.tulsunAldangi;
    }

    const guilgeeForNekhemjlekh = { ...guilgee };
    const geree = await Geree(tukhainBaaziinKholbolt, true)
      .findById(guilgee.gereeniiId)
      .select("+avlaga orshinSuugchId gereeniiDugaar barilgiinId");
    const currentGuilgeenuudCount = geree?.avlaga?.guilgeenuud?.length || 0;
    guilgeeForNekhemjlekh.avlagaGuilgeeIndex = currentGuilgeenuudCount;

    const result = await Geree(tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: guilgee.gereeniiId },
        {
          $push: {
            [`avlaga.guilgeenuud`]: guilgee,
            guilgeenuudForNekhemjlekh: guilgeeForNekhemjlekh, // Add to tracking array for one-time inclusion in invoice
          },
          $inc: inc,
        }
      );

    try {
      const freshGereeForAvlaga = await Geree(tukhainBaaziinKholbolt, true)
        .findById(guilgee.gereeniiId)
        .select("gereeniiDugaar orshinSuugchId baiguullagiinId baiguullagiinNer barilgiinId")
        .lean();

      if (freshGereeForAvlaga) {
        const tulukhModel = GereeniiTulukhAvlaga(tukhainBaaziinKholbolt);

        const tulukhDoc = new tulukhModel({
          baiguullagiinId: freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
          baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
          barilgiinId: freshGereeForAvlaga.barilgiinId || "",
          gereeniiId: guilgee.gereeniiId,
          gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
          orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",

          ognoo: guilgee.guilgeeKhiisenOgnoo || new Date(),
          undsenDun: guilgee.tulsunDun || 0,
          tulukhDun: guilgee.tulsunDun || 0,
          tulukhAldangi: guilgee.tulsunAldangi || 0,
          uldegdel: (guilgee.tulsunDun || 0) + (guilgee.tulsunAldangi || 0),

          turul: guilgee.turul || "avlaga",
          aldangiinTurul: guilgee.aldangiinTurul || "",
          zardliinTurul: guilgee.zardliinTurul || "",
          zardliinId: guilgee.zardliinId || "",
          zardliinNer: guilgee.zardliinNer || "",

          nekhemjlekhDeerKharagdakh:
            typeof guilgee.nekhemjlekhDeerKharagdakh === "boolean"
              ? guilgee.nekhemjlekhDeerKharagdakh
              : true,
          nuatBodokhEsekh:
            typeof guilgee.nuatBodokhEsekh === "boolean"
              ? guilgee.nuatBodokhEsekh
              : true,
          ekhniiUldegdelEsekh: !!guilgee.ekhniiUldegdelEsekh,

          tailbar: guilgee.tailbar || "",
          nemeltTailbar: guilgee.nemeltTailbar || "",

          source: "geree",
          avlagaGuilgeeIndex: guilgeeForNekhemjlekh.avlagaGuilgeeIndex,
        });

        await tulukhDoc.save();
      }
    } catch (tulukhError) {
      console.error("❌ [GEREE AVLAGA] Error creating gereeniiTulukhAvlaga:", tulukhError.message);
    }

    await daraagiinTulukhOgnooZasya(
      guilgee.gereeniiId,
      tukhainBaaziinKholbolt
    );

    try {
      if (guilgee.turul === "avlaga" && geree && geree.orshinSuugchId) {
        const medegdel = new Medegdel(tukhainBaaziinKholbolt)();
        medegdel.orshinSuugchId = geree.orshinSuugchId;
        medegdel.baiguullagiinId = baiguullagiinId;
        medegdel.barilgiinId = geree.barilgiinId || "";
        medegdel.title = "Шинэ авлага нэмэгдлээ";
        medegdel.message = `Гэрээний дугаар: ${geree.gereeniiDugaar || "N/A"}, Төлбөр: ${guilgee.tulsunDun || 0}₮`;
        medegdel.kharsanEsekh = false;
        medegdel.turul = "мэдэгдэл";
        medegdel.ognoo = new Date();

        await medegdel.save();

        const io = req.app.get("socketio");
        if (io) {
          io.emit("orshinSuugch" + geree.orshinSuugchId, medegdel);
        }
      }
    } catch (notificationError) {
      console.error("Error sending notification for avlaga:", notificationError);
    }

    if (guilgee.turul === "avlaga") {
      try {
        const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
        const Baiguullaga = require("../models/baiguullaga");
        
        const freshGeree = await Geree(tukhainBaaziinKholbolt, true)
          .findById(guilgee.gereeniiId)
          .lean();
        
        if (freshGeree) {
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
            .findById(baiguullagiinId)
            .lean();
          
          if (baiguullaga) {
            const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
              freshGeree,
              baiguullaga,
              tukhainBaaziinKholbolt,
              "garan",
              true // skipDuplicateCheck = true to bypass month restrictions
            );
            
            if (invoiceResult && invoiceResult.success && invoiceResult.nekhemjlekh && freshGeree.orshinSuugchId) {
              try {
                console.log("starting socket emission process...");

                const io = req.app.get("socketio");
                
                if (!io) {
                  console.error("❌ [SOCKET] Socket.io instance not found in req.app");
                  return;
                }

                console.log("✅ [SOCKET] Socket.io instance found");

                let medegdelToEmit = invoiceResult.medegdel;
                
                if (!medegdelToEmit) {
                  console.log("⚠️ [SOCKET] No medegdel in invoice result, querying database...");
                  const kholbolt = db.kholboltuud.find(
                    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
                  );
                  
                  if (!kholbolt) {
                    console.error("❌ [SOCKET] Kholbolt not found for baiguullagiinId:", baiguullagiinId);
                    return;
                  }

                  console.log("querying for recent medegdel...");

                  const recentMedegdel = await Medegdel(kholbolt)
                    .findOne({ orshinSuugchId: freshGeree.orshinSuugchId })
                    .sort({ createdAt: -1 })
                    .lean();
                  
                  if (recentMedegdel) {
                    console.log("✅ [SOCKET] Found recent medegdel:", recentMedegdel._id);
                    const mongolianOffset = 8 * 60 * 60 * 1000;
                    if (recentMedegdel.createdAt) {
                      recentMedegdel.createdAt = new Date(recentMedegdel.createdAt.getTime() + mongolianOffset).toISOString();
                    }
                    if (recentMedegdel.updatedAt) {
                      recentMedegdel.updatedAt = new Date(recentMedegdel.updatedAt.getTime() + mongolianOffset).toISOString();
                    }
                    if (recentMedegdel.ognoo) {
                      recentMedegdel.ognoo = new Date(recentMedegdel.ognoo.getTime() + mongolianOffset).toISOString();
                    }
                    medegdelToEmit = recentMedegdel;
                  } else {
                    console.warn("no recent medegdel found for orshinSuugchId");
                  }
                } else {
                  console.log("using medegdel from invoice result");
                }
                
                if (medegdelToEmit) {
                  const eventName = "orshinSuugch" + freshGeree.orshinSuugchId;
                  
                  console.log("emitting invoice notification...");

                  io.emit(eventName, medegdelToEmit);
                  
                  console.log("invoice notification emitted successfully");
                } else {
                  console.error("no medegdel to emit");
                }
              } catch (socketError) {
                console.error("error emitting socket event for invoice notification", socketError.message);
              }
            } else {
              console.warn("avlaga invoice not created");
            }
          } else {
            console.warn("baiguullaga not found");
          }
        } else {
          console.warn("fresh geree not found");
        }
      } catch (invoiceError) {
        console.error("error creating invoice from avlaga", invoiceError.message);
      }
    }

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

