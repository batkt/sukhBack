const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const Medegdel = require("../models/medegdel");
const { daraagiinTulukhOgnooZasya } = require("./tulbur");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const { parseOgnooKeepClock } = require("../utils/parseOgnooKeepClock");

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    console.log("📊 [GEREE SAVE] Starting gereeniiGuilgeeKhadgalya");
    const { db } = require("zevbackv2");

    // Handle both formats: { guilgee: {...} } OR flat { gereeniiId: ..., turul: ..., etc }
    var guilgee = req.body.guilgee || req.body;

    // Normalize amount fields based on turul type
    // avlaga = debt/invoice (uses tulukhDun - amount TO pay)
    // tulult/ashiglalt = payment (uses tulsunDun - amount PAID)
    const dun = Number(
      guilgee.dun || guilgee.tulukhDun || guilgee.tulsunDun || 0,
    );

    if (guilgee.turul === "avlaga") {
      // For avlaga: set tulukhDun, NOT tulsunDun
      guilgee.tulukhDun = dun;
      guilgee.tulsunDun = 0; // avlaga doesn't pay, it creates debt
    } else if (guilgee.turul === "tulult" || guilgee.turul === "ashiglalt") {
      // For payment types: set tulsunDun
      guilgee.tulsunDun = dun;
      guilgee.tulukhDun = 0;
    } else {
      // Default: treat as payment (tulult) when dun > 0 and no turul specified
      guilgee.tulsunDun = dun;
      if (!guilgee.turul && dun > 0) {
        guilgee.turul = "tulult";
      }
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
          const tempGeree = await Geree(conn, true)
            .findById(guilgee.gereeniiId)
            .select("baiguullagiinId");
          if (tempGeree) {
            foundGeree = tempGeree;
            baiguullagiinId = tempGeree.baiguullagiinId;
            break;
          }
        } catch (err) {}
      }

      if (!baiguullagiinId) {
        throw new Error(
          "Байгууллагын ID олдсонгүй! Гэрээ олдсонгүй эсвэл байгууллагын ID-г body-д оруулна уу.",
        );
      }
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) =>
        String(kholbolt.baiguullagiinId) === String(baiguullagiinId),
    );

    if (!tukhainBaaziinKholbolt) {
      throw new Error("Холболтын мэдээлэл олдсонгүй!");
    }

    if (guilgee.guilgeeniiId) {
      var shalguur = await BankniiGuilgee(tukhainBaaziinKholbolt, true).findOne(
        {
          "guilgee.guilgeeniiId": guilgee.guilgeeniiId,
          kholbosonGereeniiId: guilgee.gereeniiId,
        },
      );
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
    const staffToken =
      req.body.nevtersenAjiltniiToken || req.nevtersenAjiltniiToken;
    if (staffToken?.ner || staffToken?.id) {
      if (staffToken.ner != null && String(staffToken.ner).trim() !== "") {
        guilgee.guilgeeKhiisenAjiltniiNer = staffToken.ner;
      }
      if (staffToken.id != null && String(staffToken.id).trim() !== "") {
        guilgee.guilgeeKhiisenAjiltniiId = String(staffToken.id);
      }
    }
    const missingAjiltanId =
      guilgee.guilgeeKhiisenAjiltniiId == null ||
      String(guilgee.guilgeeKhiisenAjiltniiId).trim() === "";
    const missingAjiltanNer =
      guilgee.guilgeeKhiisenAjiltniiNer == null ||
      String(guilgee.guilgeeKhiisenAjiltniiNer).trim() === "";
    if (missingAjiltanId) {
      if (req.body.createdBy != null && String(req.body.createdBy).trim() !== "") {
        guilgee.guilgeeKhiisenAjiltniiId = String(req.body.createdBy);
      } else if (
        req.body.burtgesenAjiltaniiId != null &&
        String(req.body.burtgesenAjiltaniiId).trim() !== ""
      ) {
        guilgee.guilgeeKhiisenAjiltniiId = String(req.body.burtgesenAjiltaniiId);
      } else if (
        req.body.burtgesenAjiltan != null &&
        String(req.body.burtgesenAjiltan).trim() !== ""
      ) {
        guilgee.guilgeeKhiisenAjiltniiId = String(req.body.burtgesenAjiltan);
      }
    }
    if (missingAjiltanNer) {
      const ner =
        req.body.burtgesenAjiltaniiNer ||
        req.body.createdByNer ||
        req.body.ajiltanNer ||
        (typeof req.body.guilgeeKhiisenAjiltniiNer === "string"
          ? req.body.guilgeeKhiisenAjiltniiNer
          : null);
      if (ner != null && String(ner).trim() !== "") {
        guilgee.guilgeeKhiisenAjiltniiNer = ner;
      }
    }

    // Capture standalone record ID for syncing
    let newAvlagaId = null;

    const GereeniiTulukhAvlagaModel = GereeniiTulukhAvlaga(
      tukhainBaaziinKholbolt,
    );
    const count = await GereeniiTulukhAvlagaModel.countDocuments({
      gereeniiId: guilgee.gereeniiId,
    });

    try {
      const freshGereeForAvlaga = await Geree(tukhainBaaziinKholbolt, true)
        .findById(guilgee.gereeniiId)
        .select(
          "gereeniiDugaar orshinSuugchId baiguullagiinId baiguullagiinNer barilgiinId khayag gereeniiOgnoo mailKhayagTo gereeniiZagvariinId dansniiDugaar tulukhUdur ovog ner register utas davkhar positiveBalance",
        )
        .lean();

      if (freshGereeForAvlaga) {
        if (guilgee.turul === "avlaga") {
          const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
          const charge = round2(dun);
          const currentPositive = round2(freshGereeForAvlaga.positiveBalance);
          const usedFromPositive = round2(Math.min(currentPositive, charge));
          const netCharge = round2(charge - usedFromPositive);

          if (usedFromPositive > 0.01) {
            await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
              guilgee.gereeniiId,
              {
                $set: {
                  positiveBalance: round2(currentPositive - usedFromPositive),
                },
              },
            );
          }

          // Create standalone GereeniiTulukhAvlaga record immediately for history visibility
          const TulukhAvlagaModel = GereeniiTulukhAvlaga(
            tukhainBaaziinKholbolt,
          );
          const newAvlaga = new TulukhAvlagaModel({
            baiguullagiinId:
              freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
            baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
            barilgiinId: freshGereeForAvlaga.barilgiinId || "",
            gereeniiId: guilgee.gereeniiId,
            gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
            orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",
            ognoo:
              parseOgnooKeepClock(guilgee.ognoo) ||
              guilgee.guilgeeKhiisenOgnoo ||
              new Date(),
            // If there is existing overpayment credit, consume it first so new avlaga does not
            // appear as an artificial "break" in ledger right after large payments.
            undsenDun: netCharge,
            tulukhDun: netCharge,
            uldegdel: netCharge,
            turul: "avlaga",
            zardliinNer: guilgee.ekhniiUldegdelEsekh
              ? "Эхний үлдэгдэл"
              : guilgee.zardliinNer || "Авлага",
            ekhniiUldegdelEsekh: guilgee.ekhniiUldegdelEsekh === true,
            source: "gar",
            tailbar:
              guilgee.tailbar ||
              (guilgee.ekhniiUldegdelEsekh
                ? "Гараар нэмсэн эхний үлдэгдэл"
                : ""),
            guilgeeKhiisenAjiltniiNer: guilgee.guilgeeKhiisenAjiltniiNer || "",
            guilgeeKhiisenAjiltniiId: guilgee.guilgeeKhiisenAjiltniiId || "",
          });
          const savedAvlaga = await newAvlaga.save();
          newAvlagaId = savedAvlaga._id;
          console.log(
            "✅ [GEREE AVLAGA] Created standalone debt record:",
            newAvlagaId,
          );

          // Ensure the avlaga month has an invoice container only when there is unpaid amount left.
          // If fully covered by positiveBalance credit, skip creating AVL invoice noise.
          if (netCharge > 0.01) {
            try {
            const avlagaDate =
              parseOgnooKeepClock(guilgee.ognoo) ||
              (guilgee.guilgeeKhiisenOgnoo
                ? new Date(guilgee.guilgeeKhiisenOgnoo)
                : new Date());

            if (!Number.isNaN(avlagaDate.getTime())) {
              const monthStart = new Date(
                avlagaDate.getFullYear(),
                avlagaDate.getMonth(),
                1,
                0,
                0,
                0,
                0,
              );
              const monthEnd = new Date(
                avlagaDate.getFullYear(),
                avlagaDate.getMonth() + 1,
                0,
                23,
                59,
                59,
                999,
              );

              const NekhemjlekhiinTuukhModel = require("../models/nekhemjlekhiinTuukh");
              const NekhemjlekhModel = NekhemjlekhiinTuukhModel(
                tukhainBaaziinKholbolt,
              );

              const monthlyInvoices = await NekhemjlekhModel.find({
                gereeniiId: guilgee.gereeniiId,
                tuluv: { $ne: "Хүчингүй" },
                $or: [
                  { ognoo: { $gte: monthStart, $lte: monthEnd } },
                  {
                    $and: [
                      { $or: [{ ognoo: null }, { ognoo: { $exists: false } }] },
                      { createdAt: { $gte: monthStart, $lte: monthEnd } },
                    ],
                  },
                ],
              })
                .select("_id tuluv")
                .lean();

              const unpaidMonthlyInvoice = (monthlyInvoices || []).find(
                (inv) => !["Төлсөн", "Хүчингүй"].includes(inv?.tuluv),
              );
              const hasAnyMonthlyInvoice = (monthlyInvoices || []).length > 0;

              // Rule:
              // - If unpaid invoice exists for that month: reuse it (do nothing here)
              // - If none exists or all are paid: create AVlaga-only invoice container (no ashiglaltiin zardluud)
              if (!unpaidMonthlyInvoice) {
                const suuliinNekhemjlekh = await NekhemjlekhModel.findOne()
                  .sort({ dugaalaltDugaar: -1 })
                  .select("dugaalaltDugaar")
                  .lean();
                const suuliinDugaar = suuliinNekhemjlekh?.dugaalaltDugaar;
                const nextDugaar =
                  suuliinDugaar && !isNaN(suuliinDugaar)
                    ? suuliinDugaar + 1
                    : 1;

                const invoiceDate = new Date(
                  avlagaDate.getFullYear(),
                  avlagaDate.getMonth(),
                  1,
                  12,
                  0,
                  0,
                  0,
                );

                const autoInvoice = new NekhemjlekhModel({
                  baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
                  baiguullagiinId:
                    freshGereeForAvlaga.baiguullagiinId ||
                    String(baiguullagiinId),
                  barilgiinId: freshGereeForAvlaga.barilgiinId || "",
                  ovog: freshGereeForAvlaga.ovog || "",
                  ner: freshGereeForAvlaga.ner || "",
                  register: freshGereeForAvlaga.register || "",
                  utas: Array.isArray(freshGereeForAvlaga.utas)
                    ? freshGereeForAvlaga.utas
                    : [],
                  khayag: freshGereeForAvlaga.khayag || "",
                  gereeniiOgnoo: freshGereeForAvlaga.gereeniiOgnoo || null,
                  gereeniiId: guilgee.gereeniiId,
                  gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
                  davkhar: freshGereeForAvlaga.davkhar || "",
                  dansniiDugaar: freshGereeForAvlaga.dansniiDugaar || "",
                  gereeniiZagvariinId:
                    freshGereeForAvlaga.gereeniiZagvariinId || "",
                  tulukhUdur: Array.isArray(freshGereeForAvlaga.tulukhUdur)
                    ? freshGereeForAvlaga.tulukhUdur
                    : [],
                  ognoo: invoiceDate,
                  mailKhayagTo: freshGereeForAvlaga.mailKhayagTo || "",
                  medeelel: {
                    zardluud: [],
                    guilgeenuud: [],
                    segmentuud: [],
                    khungulultuud: [],
                    tailbar: "Авлага",
                    uusgegsenEsekh: "garan",
                    uusgegsenOgnoo: new Date(),
                  },
                  nekhemjlekh: "Авлагаар автоматаар үүсгэсэн нэхэмжлэх",
                  zagvariinNer: freshGereeForAvlaga.baiguullagiinNer || "",
                  content: "Авлага тусгах суурь нэхэмжлэх",
                  nekhemjlekhiinOgnoo: new Date(),
                  nekhemjlekhiinDugaar: `AVL-${Date.now()}-${Math.floor(
                    Math.random() * 1000,
                  )}`,
                  dugaalaltDugaar: nextDugaar,
                  niitTulbur: 0,
                  niitTulburOriginal: 0,
                  uldegdel: 0,
                  tuluv: "Төлөөгүй",
                  tailbar: "Авлага",
                });

                await autoInvoice.save();
                if (hasAnyMonthlyInvoice) {
                  console.log(
                    "✅ [GEREE AVLAGA] Month had only paid invoices; created new avlaga-only invoice",
                    {
                      gereeniiId: guilgee.gereeniiId,
                      month: avlagaDate.getMonth() + 1,
                      year: avlagaDate.getFullYear(),
                    },
                  );
                } else {
                  console.log(
                    "✅ [GEREE AVLAGA] Created missing avlaga-only month invoice",
                    {
                      gereeniiId: guilgee.gereeniiId,
                      month: avlagaDate.getMonth() + 1,
                      year: avlagaDate.getFullYear(),
                    },
                  );
                }
              }
            }
            } catch (ensureInvoiceError) {
              console.error(
                "❌ [GEREE AVLAGA] Error ensuring month invoice:",
                ensureInvoiceError.message,
              );
            }
          }

          // If this is an initial balance (ekhniiUldegdelEsekh), also update any
          // existing unpaid invoices for this contract immediately
          if (guilgee.ekhniiUldegdelEsekh === true && dun > 0) {
            try {
              const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
              const NekhemjlekhModel = NekhemjlekhiinTuukh(
                tukhainBaaziinKholbolt,
              );

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
                      tailbar:
                        guilgee.tailbar || "Гараар нэмсэн эхний үлдэгдэл",
                    };
                  }
                  return z;
                });

                await NekhemjlekhModel.findByIdAndUpdate(invoice._id, {
                  $set: {
                    niitTulbur: newNiitTulbur,
                    niitTulburOriginal:
                      (invoice.niitTulburOriginal || invoice.niitTulbur || 0) +
                      dun,
                    uldegdel: newUldegdel,
                    ekhniiUldegdel: (invoice.ekhniiUldegdel || 0) + dun,
                    "medeelel.zardluud": zardluud,
                  },
                });
              }
              console.log(
                `✅ [GEREE AVLAGA] Updated ${unpaidInvoices.length} unpaid invoice(s) with initial balance ${dun}`,
              );
            } catch (invoiceUpdateError) {
              console.error(
                "❌ [GEREE AVLAGA] Error updating unpaid invoices:",
                invoiceUpdateError.message,
              );
            }
          }
        } else if (guilgee.turul === "tulult") {
          // TULULT: Store in GereeniiTulsunAvlaga (payment record)
          const tulsunModel = GereeniiTulsunAvlaga(tukhainBaaziinKholbolt);

          const tulsunDoc = new tulsunModel({
            baiguullagiinId:
              freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
            baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
            barilgiinId: freshGereeForAvlaga.barilgiinId || "",
            gereeniiId: guilgee.gereeniiId,
            gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
            orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",

            // Use provided ognoo if available, otherwise current time
            ognoo:
              parseOgnooKeepClock(guilgee.ognoo) ||
              guilgee.guilgeeKhiisenOgnoo ||
              new Date(),
            tulsunDun: guilgee.tulsunDun || 0,
            tulsunAldangi: 0,

            turul: guilgee.turul, // "tulult"
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
          newAvlagaId = savedTulsun._id;
          console.log(
            `✅ [GEREE ${guilgee.turul.toUpperCase()}] Created gereeniiTulsunAvlaga record`,
          );

          // ALSO apply payment to unpaid invoices for this contract
          try {
            const NekhemjlekhiinTuukhModel = require("../models/nekhemjlekhiinTuukh");
            const NekhemjlekhModel = NekhemjlekhiinTuukhModel(
              tukhainBaaziinKholbolt,
            );
            const paymentAmount = guilgee.tulsunDun || 0;

            if (paymentAmount > 0) {
              const unpaidInvoices = await NekhemjlekhModel.find({
                gereeniiId: guilgee.gereeniiId,
                tuluv: { $nin: ["Төлсөн"] },
              }).sort({ ognoo: -1, createdAt: -1 });

              let remainingPayment = paymentAmount;

              for (const invoice of unpaidInvoices) {
                if (remainingPayment <= 0) break;

                const currentUldegdel =
                  typeof invoice.uldegdel === "number" && invoice.uldegdel > 0
                    ? invoice.uldegdel
                    : invoice.niitTulbur || 0;

                if (currentUldegdel <= 0) continue;

                const amountToApply = Math.min(
                  remainingPayment,
                  currentUldegdel,
                );
                const newUldegdel = currentUldegdel - amountToApply;
                const isFullyPaid = newUldegdel <= 0.01;

                // Push to paymentHistory and update uldegdel
                invoice.paymentHistory = invoice.paymentHistory || [];
                invoice.paymentHistory.push({
                  ognoo: guilgee.guilgeeKhiisenOgnoo || new Date(),
                  dun: amountToApply,
                  turul: "manual",
                  guilgeeniiId: savedTulsun._id.toString(),
                  tailbar:
                    guilgee.tailbar ||
                    (isFullyPaid
                      ? "Төлбөр хийгдлээ"
                      : `Хэсэгчилсэн төлбөр: ${amountToApply}₮`),
                });

                // Ensure original total is preserved before we change niitTulbur
                if (typeof invoice.niitTulburOriginal !== "number") {
                  invoice.niitTulburOriginal = invoice.niitTulbur;
                }

                invoice.uldegdel = isFullyPaid ? 0 : newUldegdel;
                // Update niitTulbur to match remaining so the app shows correct amount
                invoice.niitTulbur = invoice.uldegdel;

                // IMPORTANT: Do NOT update tuluv until uldegdel reaches 0
                if (isFullyPaid) {
                  invoice.tuluv = "Төлсөн";
                  invoice.tulsunOgnoo =
                    guilgee.guilgeeKhiisenOgnoo || new Date();
                } else {
                  invoice.tuluv = "Төлөөгүй";
                }

                // Skip pre-save hook tuluv recalculation
                invoice._skipTuluvRecalc = true;
                await invoice.save();

                remainingPayment -= amountToApply;
                console.log(
                  `✅ [GEREE PAYMENT] Applied ${amountToApply}₮ to invoice ${invoice.nekhemjlekhiinDugaar || invoice._id}`,
                );
              }
            }
          } catch (invoicePayError) {
            console.error(
              "❌ [GEREE PAYMENT] Error applying payment to invoices:",
              invoicePayError.message,
            );
          }
        } else if (guilgee.turul === "ashiglalt") {
          // ASHIGLALT behaves like AVLAGA (charge/receivable side), but keeps its own type/name.
          const tulukhModel = GereeniiTulukhAvlaga(tukhainBaaziinKholbolt);
          const toNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          };
          // Important: do NOT use nullish-coalescing here because 0 can be present
          // on tulukhDun while frontend sends the real amount in tulsunDun.
          // Pick first positive amount, same practical behavior as avlaga inputs.
          const candidates = [
            toNum(guilgee.undsenDun),
            toNum(guilgee.tulukhDun),
            toNum(guilgee.dun),
            toNum(guilgee.tulsunDun),
          ];
          const charge = candidates.find((x) => x > 0.01) || 0;

          const tulukhDoc = new tulukhModel({
            baiguullagiinId:
              freshGereeForAvlaga.baiguullagiinId || String(baiguullagiinId),
            baiguullagiinNer: freshGereeForAvlaga.baiguullagiinNer || "",
            barilgiinId: freshGereeForAvlaga.barilgiinId || "",
            gereeniiId: guilgee.gereeniiId,
            gereeniiDugaar: freshGereeForAvlaga.gereeniiDugaar || "",
            orshinSuugchId: freshGereeForAvlaga.orshinSuugchId || "",
            nekhemjlekhId: null,
            ognoo:
              parseOgnooKeepClock(guilgee.ognoo) ||
              guilgee.guilgeeKhiisenOgnoo ||
              new Date(),
            undsenDun: charge,
            tulukhDun: charge,
            tulukhAldangi: 0,
            uldegdel: charge,
            turul: "ashiglalt",
            aldangiinTurul: guilgee.aldangiinTurul || "",
            zardliinTurul: guilgee.zardliinTurul || "",
            zardliinId: guilgee.zardliinId || "",
            zardliinNer: guilgee.zardliinNer || "Ашиглалт",
            nekhemjlekhDeerKharagdakh: true,
            nuatBodokhEsekh:
              typeof guilgee.nuatBodokhEsekh === "boolean"
                ? guilgee.nuatBodokhEsekh
                : true,
            ekhniiUldegdelEsekh: false,
            tailbar: guilgee.tailbar || "Ашиглалтын авлага",
            nemeltTailbar: guilgee.nemeltTailbar || "",
            source: "geree",
            guilgeeKhiisenAjiltniiNer: guilgee.guilgeeKhiisenAjiltniiNer || "",
            guilgeeKhiisenAjiltniiId: guilgee.guilgeeKhiisenAjiltniiId || "",
          });

          const savedTulukh = await tulukhDoc.save();
          newAvlagaId = savedTulukh._id;
          console.log(
            "✅ [GEREE ASHIGLALT] Created gereeniiTulukhAvlaga record",
          );
        }
      }
    } catch (recordError) {
      console.error(
        "❌ [GEREE] Error creating avlaga/tulsun record:",
        recordError.message,
      );
    }

    // Prepare the queued transaction
    const guilgeeForNekhemjlekh = {
      ...guilgee,
      _id: newAvlagaId || undefined, // Use existing record ID or let Mongoose generate one (avoiding manual-xxx string which causes CastError)
      avlagaGuilgeeIndex: count,
    };
    // "ashiglalt" is receivable-side like avlaga; keep amount in tulukhDun for invoice generation.
    if (guilgee?.turul === "ashiglalt") {
      const amt =
        Number(guilgee?.tulukhDun) ||
        Number(guilgee?.undsenDun) ||
        Number(guilgee?.dun) ||
        Number(guilgee?.tulsunDun) ||
        0;
      guilgeeForNekhemjlekh.tulukhDun = amt;
      guilgeeForNekhemjlekh.tulsunDun = 0;
    }

    // Push to guilgeenuudForNekhemjlekh for manual adjustments
    const updateData = {
      $push: { guilgeenuudForNekhemjlekh: guilgeeForNekhemjlekh },
    };

    await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
      guilgee.gereeniiId,
      updateData,
      { new: false },
    );

    // Full recalculation from raw amounts using shared utility
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { recalcGlobalUldegdel } = require("../utils/recalcGlobalUldegdel");
    const NekhemjlekhiinTuukhRecalc = require("../models/nekhemjlekhiinTuukh");
    const GereeniiTulsunAvlagaRecalc = require("../models/gereeniiTulsunAvlaga");
    try {
      await recalcGlobalUldegdel({
        gereeId: guilgee.gereeniiId,
        baiguullagiinId,
        GereeModel: Geree(tukhainBaaziinKholbolt),
        NekhemjlekhiinTuukhModel: NekhemjlekhiinTuukhRecalc(
          tukhainBaaziinKholbolt,
        ),
        GereeniiTulukhAvlagaModel: GereeniiTulukhAvlagaModel,
        GereeniiTulsunAvlagaModel: GereeniiTulsunAvlagaRecalc(
          tukhainBaaziinKholbolt,
        ),
      });
    } catch (recalcErr) {
      console.error(
        "❌ [GEREE] Error in full recalculation:",
        recalcErr.message,
      );
    }

    const result = await Geree(tukhainBaaziinKholbolt).findById(
      guilgee.gereeniiId,
    );

    try {
      await daraagiinTulukhOgnooZasya(
        guilgee.gereeniiId,
        tukhainBaaziinKholbolt,
      );
    } catch (dateUpdateError) {
      console.error(
        "⚠️ [GEREE] Error updating next payment date:",
        dateUpdateError.message,
      );
    }

    try {
      if (guilgee.turul === "avlaga" && result && result.orshinSuugchId) {
        const MedegdelModel = Medegdel(tukhainBaaziinKholbolt);
        const medegdel = new MedegdelModel({
          orshinSuugchId: result.orshinSuugchId,
          baiguullagiinId: baiguullagiinId,
          barilgiinId: result.barilgiinId || "",
          title: "Шинэ авлага нэмэгдлээ",
          message: `Гэрээний дугаар: ${result.gereeniiDugaar || "N/A"}, Төлбөр: ${guilgee.tulukhDun || 0}₮`,
          kharsanEsekh: false,
          turul: "мэдэгдэл",
          ognoo: new Date(),
        });

        await medegdel.save();

        const io = req.app.get("socketio");
        if (io) {
          io.emit("orshinSuugch" + result.orshinSuugchId, medegdel);
        }
      }
    } catch (notificationError) {
      console.error(
        "Error sending notification for avlaga:",
        notificationError,
      );
    }

    if (guilgee.guilgeeniiId) {
      const result1 = await BankniiGuilgee(tukhainBaaziinKholbolt).updateOne(
        { _id: guilgee.guilgeeniiId },
        {
          $set: {
            kholbosonGereeniiId: guilgee.gereeniiId,
            kholbosonTalbainId: result.talbainDugaar,
          },
        },
      );
      res.send(result1);
    } else {
      res.send(result);
    }
  } catch (aldaa) {
    console.error("❌ [GEREE SAVE ERROR]", aldaa);
    next(aldaa);
  }
});
