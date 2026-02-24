const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const NekhemjlekhCron = require("../models/cronSchedule");
const OrshinSuugch = require("../models/orshinSuugch");
const MsgTuukh = require("../models/msgTuukh");
const Medegdel = require("../models/medegdel");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
const request = require("request");
const { db } = require("zevbackv2");
const asyncHandler = require("express-async-handler");

function normalizeTurul(turul) {
  if (!turul || typeof turul !== "string") {
    return turul;
  }
  if (turul.toLowerCase() === "тогтмол") {
    return "Тогтмол";
  }
  return turul;
}

function normalizeZardluudTurul(zardluud) {
  if (!Array.isArray(zardluud)) {
    return zardluud;
  }
  return zardluud.map((zardal) => {
    if (zardal && typeof zardal === "object") {
      return {
        ...zardal,
        turul: normalizeTurul(zardal.turul),
      };
    }
    return zardal;
  });
}

function deduplicateZardluud(zardluud) {
  if (!Array.isArray(zardluud)) {
    return zardluud;
  }

  const seen = new Set();
  const deduplicated = [];

  for (const zardal of zardluud) {
    if (!zardal || typeof zardal !== "object") {
      continue;
    }

    const normalizedTurul = normalizeTurul(zardal.turul);
    const key = `${zardal.ner || ""}|${normalizedTurul || ""}|${zardal.zardliinTurul || ""}|${zardal.barilgiinId || ""}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(zardal);
    }
  }

  return deduplicated;
}

const gereeNeesNekhemjlekhUusgekh = async (
  tempData,
  org,
  tukhainBaaziinKholbolt,
  uusgegsenEsekh = "garan",
  skipDuplicateCheck = false,
  includeEkhniiUldegdel = true, // New flag to control ekhniiUldegdel inclusion
  ekhniiUldegdelId = null, // ID of the standalone GereeniiTulukhAvlaga record if it exists
) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11 (0 = January)

    let shouldUseEkhniiUldegdel = false;
    const NekhemjlekhCron = require("../models/cronSchedule");

    try {
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: null,
        });
      }

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo;

        const gereeCreatedDate =
          tempData.createdAt || tempData.gereeniiOgnoo || new Date();
        const currentMonthCronDate = new Date(
          currentYear,
          currentMonth,
          scheduledDay,
          0,
          0,
          0,
          0,
        );

        const existingEkhniiUldegdelInvoices = await nekhemjlekhiinTuukh(
          tukhainBaaziinKholbolt,
        ).countDocuments({
          gereeniiId: tempData._id.toString(),
          ekhniiUldegdel: { $exists: true, $gt: 0 },
        });

        if (
          gereeCreatedDate < currentMonthCronDate &&
          tempData.ekhniiUldegdel &&
          tempData.ekhniiUldegdel > 0 &&
          existingEkhniiUldegdelInvoices === 0
        ) {
          shouldUseEkhniiUldegdel = true;
        }
      }
    } catch (error) {
      // Error checking ekhniiUldegdel - silently continue
    }

    // IMPORTANT:
    // ALWAYS reuse existing monthly invoice when it exists (even if paid),
    // regardless of skipDuplicateCheck. skipDuplicateCheck may still be used
    // by callers, but it will only affect whether we *look* for duplicates;
    // it must NEVER allow creating a second invoice for the same month.
    if (!shouldUseEkhniiUldegdel) {
      const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      const monthEnd = new Date(
        currentYear,
        currentMonth + 1,
        0,
        23,
        59,
        59,
        999,
      );

      let checkBarilgiinId = tempData.barilgiinId;
      if (!checkBarilgiinId && org?.barilguud && org.barilguud.length > 0) {
        checkBarilgiinId = String(org.barilguud[0]._id);
      }

      const existingInvoiceQuery = {
        gereeniiId: tempData._id.toString(),
        $or: [
          {
            ognoo: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
          {
            createdAt: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
        ],
      };

      if (checkBarilgiinId) {
        existingInvoiceQuery.barilgiinId = checkBarilgiinId;
      }

      const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
        .findOne(existingInvoiceQuery)
        .sort({ ognoo: -1, createdAt: -1 });

      if (existingInvoice) {
        // Check if we need to update electricity data from latest ZaaltUnshlalt
        try {
          const ZaaltUnshlalt = require("../models/zaaltUnshlalt");

          const latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
            .findOne({
              $or: [
                { gereeniiId: String(tempData._id) },
                { gereeniiDugaar: tempData.gereeniiDugaar },
              ],
            })
            .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1 })
            .lean();

          if (latestReading && latestReading.zaaltDun > 0) {
            // Find existing electricity entry in the invoice
            const existingElectricityIdx =
              existingInvoice.medeelel?.zardluud?.findIndex(
                (z) =>
                  z.zaalt === true &&
                  z.ner &&
                  z.ner.toLowerCase().includes("цахилгаан") &&
                  !z.ner.toLowerCase().includes("дундын") &&
                  !z.ner.toLowerCase().includes("өмчлөл"),
              );

            const existingElectricity =
              existingElectricityIdx >= 0
                ? existingInvoice.medeelel.zardluud[existingElectricityIdx]
                : null;

            // Check if the electricity amount needs updating
            const currentZaaltDun =
              existingElectricity?.dun || existingElectricity?.tariff || 0;
            const newZaaltDun = latestReading.zaaltDun;

            if (currentZaaltDun !== newZaaltDun) {
              const zoruu =
                latestReading.zoruu ||
                latestReading.zaaltCalculation?.zoruu ||
                0;
              const defaultDun =
                latestReading.defaultDun ||
                latestReading.zaaltCalculation?.defaultDun ||
                0;
              const tariff =
                latestReading.tariff ||
                latestReading.zaaltCalculation?.tariff ||
                0;

              if (existingElectricityIdx >= 0) {
                // Update existing electricity entry
                existingInvoice.medeelel.zardluud[existingElectricityIdx] = {
                  ...existingInvoice.medeelel.zardluud[existingElectricityIdx],
                  tariff: newZaaltDun,
                  dun: newZaaltDun,
                  tariffUsgeer: "₮",
                  zoruu: zoruu,
                  zaaltDefaultDun: defaultDun,
                  zaaltTariff: tariff,
                  umnukhZaalt: latestReading.umnukhZaalt || 0,
                  suuliinZaalt: latestReading.suuliinZaalt || 0,
                  zaaltTog: latestReading.zaaltTog || 0,
                  zaaltUs: latestReading.zaaltUs || 0,
                };
              } else if (Array.isArray(existingInvoice.medeelel?.zardluud)) {
                // No electricity entry existed in this month's invoice – create one instead of creating a new invoice
                const zaaltMeta = existingInvoice.medeelel.zaalt || {};
                const newElectricityEntry = {
                  ner: zaaltMeta.tariffName || "Цахилгаан",
                  zardliinTurul: zaaltMeta.tariffType || "Энгийн",
                  zaalt: true,
                  tariff: newZaaltDun,
                  dun: newZaaltDun,
                  tariffUsgeer: "₮",
                  zoruu: zoruu,
                  zaaltDefaultDun: defaultDun,
                  zaaltTariff: tariff,
                  umnukhZaalt: latestReading.umnukhZaalt || 0,
                  suuliinZaalt: latestReading.suuliinZaalt || 0,
                  zaaltTog: latestReading.zaaltTog || 0,
                  zaaltUs: latestReading.zaaltUs || 0,
                };

                existingInvoice.medeelel.zardluud.push(newElectricityEntry);
              }

              // Update zaalt metadata
              if (existingInvoice.medeelel) {
                existingInvoice.medeelel.zaalt = {
                  ...(existingInvoice.medeelel.zaalt || {}),
                  umnukhZaalt: latestReading.umnukhZaalt || 0,
                  suuliinZaalt: latestReading.suuliinZaalt || 0,
                  zoruu: zoruu,
                  tariff: tariff,
                  defaultDun: defaultDun,
                  zaaltDun: newZaaltDun,
                };
              }

              // Recalculate total
              const newTotal = existingInvoice.medeelel.zardluud.reduce(
                (sum, z) => {
                  return sum + (z.dun || z.tariff || 0);
                },
                0,
              );

              existingInvoice.niitTulbur = newTotal;
              existingInvoice.tsahilgaanNekhemjlekh = newZaaltDun;
              existingInvoice.uldegdel = newTotal;

              await existingInvoice.save();

              return {
                success: true,
                nekhemjlekh: existingInvoice,
                gereeniiId: tempData._id,
                gereeniiDugaar: tempData.gereeniiDugaar,
                tulbur: newTotal,
                alreadyExists: true,
                updated: true,
              };
            }
          }
        } catch (updateError) {
          // Error checking for electricity update - silently continue
        }

        return {
          success: true,
          nekhemjlekh: existingInvoice,
          gereeniiId: tempData._id,
          gereeniiDugaar: tempData.gereeniiDugaar,
          tulbur: existingInvoice.niitTulbur,
          alreadyExists: true,
        };
      }
    }

    const tuukh = new nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)();

    let dansInfo = { dugaar: "", dansniiNer: "", bank: "", ibanDugaar: "" };
    try {
      const { db } = require("zevbackv2");
      const { Dans } = require("zevbackv2");

      let barilgaDans = null;
      if (tempData.barilgiinId && org?.barilguud) {
        const targetBarilga = org.barilguud.find(
          (b) => String(b._id) === String(tempData.barilgiinId),
        );
        if (targetBarilga?.tokhirgoo?.dans) {
          barilgaDans = targetBarilga.tokhirgoo.dans;
          dansInfo = {
            dugaar: barilgaDans.dugaar || "",
            dansniiNer: barilgaDans.dansniiNer || "",
            bank: barilgaDans.bank || "",
            ibanDugaar: barilgaDans.ibanDugaar || "",
          };
        }
      }

      if (!barilgaDans && tempData.baiguullagiinId && tempData.barilgiinId) {
        try {
          const { QpayKhariltsagch } = require("quickqpaypackvSukh");
          const qpayKhariltsagch = new QpayKhariltsagch(tukhainBaaziinKholbolt);
          const qpayConfig = await qpayKhariltsagch
            .findOne({
              baiguullagiinId: tempData.baiguullagiinId.toString(),
            })
            .lean();

          if (
            qpayConfig &&
            qpayConfig.salbaruud &&
            Array.isArray(qpayConfig.salbaruud)
          ) {
            const targetSalbar = qpayConfig.salbaruud.find(
              (salbar) =>
                String(salbar.salbariinId) === String(tempData.barilgiinId),
            );

            if (
              targetSalbar &&
              targetSalbar.bank_accounts &&
              Array.isArray(targetSalbar.bank_accounts) &&
              targetSalbar.bank_accounts.length > 0
            ) {
              const bankAccount = targetSalbar.bank_accounts[0];
              dansInfo = {
                dugaar: bankAccount.account_number || "",
                dansniiNer: bankAccount.account_name || "",
                bank: bankAccount.account_bank_code || "",
                ibanDugaar: "",
              };
            }
          }
        } catch (qpayError) {
          // Error fetching QpayKhariltsagch - silently continue
        }
      }

      if (!barilgaDans && !dansInfo.dugaar && tempData.baiguullagiinId) {
        const dansModel = Dans(tukhainBaaziinKholbolt);

        let dans = null;
        if (tempData.barilgiinId) {
          dans = await dansModel.findOne({
            baiguullagiinId: tempData.baiguullagiinId.toString(),
            barilgiinId: tempData.barilgiinId.toString(),
          });
        }

        // If not found with barilgiinId, try without it (organization-level)
        if (!dans) {
          dans = await dansModel.findOne({
            baiguullagiinId: tempData.baiguullagiinId.toString(),
          });
        }

        if (dans) {
          dansInfo = {
            dugaar: dans.dugaar || "",
            dansniiNer: dans.dansniiNer || "",
            bank: dans.bank || "",
            ibanDugaar: dans.ibanDugaar || "",
          };
        }
      }
    } catch (dansError) {
      // Error fetching dans info - silently continue
    }

    // Get fresh geree data to check for positiveBalance
    let gereePositiveBalance = 0;
    try {
      const freshGeree = await Geree(tukhainBaaziinKholbolt)
        .findById(tempData._id)
        .select("positiveBalance")
        .lean();
      if (freshGeree && freshGeree.positiveBalance) {
        gereePositiveBalance = freshGeree.positiveBalance;
      }
    } catch (error) {
      // Error fetching geree positiveBalance - silently continue
    }

    // Гэрээний мэдээллийг нэхэмжлэх рүү хуулах
    tuukh.baiguullagiinNer = tempData.baiguullagiinNer || org.ner;
    const orgUtas = Array.isArray(org?.utas) ? org.utas[0] : org?.utas || "";
    tuukh.baiguullagiinUtas =
      (typeof orgUtas === "string" ? orgUtas : String(orgUtas || "")) || "";
    tuukh.baiguullagiinKhayag = org?.khayag || "";
    tuukh.baiguullagiinId = tempData.baiguullagiinId;

    let barilgiinId = tempData.barilgiinId;
    if (!barilgiinId) {
      if (org?.barilguud && org.barilguud.length > 0) {
        barilgiinId = String(org.barilguud[0]._id);
      } else if (tempData.baiguullagiinId) {
        try {
          const { db } = require("zevbackv2");
          const freshOrg = await Baiguullaga(db.erunkhiiKholbolt)
            .findById(tempData.baiguullagiinId)
            .lean();
          if (freshOrg?.barilguud && freshOrg.barilguud.length > 0) {
            barilgiinId = String(freshOrg.barilguud[0]._id);
          }
        } catch (err) {
          // Error fetching baiguullaga for barilgiinId - silently continue
        }
      }
    }
    tuukh.barilgiinId = barilgiinId || "";
    tuukh.ovog = tempData.ovog;
    tuukh.ner = tempData.ner;
    tuukh.register = tempData.register || "";
    tuukh.utas = tempData.utas || [];
    tuukh.khayag = tempData.khayag || tempData.bairNer;
    tuukh.gereeniiOgnoo = tempData.gereeniiOgnoo;
    tuukh.turul = tempData.turul;
    tuukh.gereeniiId = tempData._id;
    tuukh.gereeniiDugaar = tempData.gereeniiDugaar;
    tuukh.davkhar = tempData.davkhar;
    tuukh.orts = tempData.orts || "";
    tuukh.uldegdel =
      tempData.globalUldegdel || tempData.baritsaaniiUldegdel || 0;
    tuukh.daraagiinTulukhOgnoo =
      tempData.daraagiinTulukhOgnoo || tempData.tulukhOgnoo;
    tuukh.dansniiDugaar =
      tempData.dans || tempData.dansniiDugaar || dansInfo.dugaar || "";
    tuukh.gereeniiZagvariinId = tempData.gereeniiZagvariinId || "";
    tuukh.tulukhUdur = tempData.tulukhUdur || [];
    tuukh.tuluv = tempData.tuluv || 1;
    tuukh.ognoo = tempData.ognoo || new Date();
    tuukh.mailKhayagTo = tempData.mail;
    tuukh.maililgeesenAjiltniiId =
      tempData.maililgeesenAjiltniiId || tempData.burtgesenAjiltan;
    // When auto-sent by system (creating resident, cron), show "Систем" not resident name
    tuukh.maililgeesenAjiltniiNer =
      uusgegsenEsekh === "automataar" || uusgegsenEsekh === "cron"
        ? "Систем"
        : tempData.maililgeesenAjiltniiNer || tempData.ner;
    tuukh.nekhemjlekhiinZagvarId = tempData.nekhemjlekhiinZagvarId || "";

    let ekhniiUldegdelForInvoice = 0;
    // Only fetch and set ekhniiUldegdel if the flag is true
    if (includeEkhniiUldegdel && tempData.orshinSuugchId) {
      try {
        const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
          .findById(tempData.orshinSuugchId)
          .select("ekhniiUldegdel")
          .lean();
        if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
          ekhniiUldegdelForInvoice = orshinSuugch.ekhniiUldegdel;
        }
      } catch (error) {
        // Error fetching ekhniiUldegdel for invoice - silently continue
      }
    }

    tuukh.ekhniiUldegdel = ekhniiUldegdelForInvoice;

    if (includeEkhniiUldegdel && tempData.ekhniiUldegdelUsgeer !== undefined) {
      tuukh.ekhniiUldegdelUsgeer = tempData.ekhniiUldegdelUsgeer;
    }

    let filteredZardluud = [];

    try {
      const { db } = require("zevbackv2");
      const Baiguullaga = require("../models/baiguullaga");
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        tempData.baiguullagiinId,
      );

      const targetBarilga = baiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(tempData.barilgiinId || ""),
      );

      const ashiglaltiinZardluud =
        targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];

      filteredZardluud = ashiglaltiinZardluud
        .filter((zardal) => zardal.zaalt !== true)
        .map((zardal) => {
          const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
          return {
            ...zardal,
            dun: dun,
          };
        });
    } catch (error) {
      filteredZardluud = (tempData.zardluud || []).map((zardal) => ({
        ...zardal,
        dun: zardal.dun || zardal.tariff || 0,
      }));
    }

    filteredZardluud = normalizeZardluudTurul(filteredZardluud);

    let choloolugdokhDavkhar = [];
    let liftZardalFromBuilding = null;
    let liftTariff = null;

    if (tempData.davkhar && tempData.barilgiinId && tempData.baiguullagiinId) {
      const { db } = require("zevbackv2");
      const Baiguullaga = require("../models/baiguullaga");
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
        .findById(tempData.baiguullagiinId)
        .lean();

      const targetBarilga = baiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(tempData.barilgiinId || ""),
      );

      choloolugdokhDavkhar =
        targetBarilga?.tokhirgoo?.liftShalgaya?.choloolugdokhDavkhar || [];

      liftZardalFromBuilding =
        targetBarilga?.tokhirgoo?.ashiglaltiinZardluud?.find(
          (z) =>
            z.zardliinTurul === "Лифт" || (z.ner && z.ner.includes("Лифт")),
        );
      if (liftZardalFromBuilding) {
        liftTariff =
          liftZardalFromBuilding.tariff || liftZardalFromBuilding.dun;
      }

      if (choloolugdokhDavkhar.length === 0 && tempData.barilgiinId) {
        try {
          const LiftShalgaya = require("../models/liftShalgaya");
          const liftShalgayaRecord = await LiftShalgaya(tukhainBaaziinKholbolt)
            .findOne({
              baiguullagiinId: String(tempData.baiguullagiinId),
              barilgiinId: String(tempData.barilgiinId),
            })
            .lean();

          if (
            liftShalgayaRecord?.choloolugdokhDavkhar &&
            liftShalgayaRecord.choloolugdokhDavkhar.length > 0
          ) {
            choloolugdokhDavkhar = liftShalgayaRecord.choloolugdokhDavkhar;

            if (targetBarilga) {
              try {
                if (!targetBarilga.tokhirgoo) {
                  targetBarilga.tokhirgoo = {};
                }
                if (!targetBarilga.tokhirgoo.liftShalgaya) {
                  targetBarilga.tokhirgoo.liftShalgaya = {};
                }
                targetBarilga.tokhirgoo.liftShalgaya.choloolugdokhDavkhar =
                  choloolugdokhDavkhar;
                await baiguullaga.save({ validateBeforeSave: false });
              } catch (saveError) {
                // Error syncing to baiguullaga - silently continue
              }
            }
          }
        } catch (error) {
          // Error fetching liftShalgaya - silently continue
        }
      }

      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
        String(d),
      );

      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        filteredZardluud = filteredZardluud.filter(
          (zardal) =>
            zardal.zardliinTurul !== "Лифт" &&
            !(zardal.ner && zardal.ner.trim() === "Лифт") &&
            !(zardal.ner && zardal.ner.includes("Лифт")),
        );
      }
    }

    let tulukhOgnoo = null;
    try {
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: null,
        });
      }

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo; // 1-31

        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear = currentYear + 1;
        }

        const lastDayOfNextMonth = new Date(
          nextYear,
          nextMonth + 1,
          0,
        ).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);

        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      // Error fetching nekhemjlekhCron schedule - silently continue
    }

    tuukh.tulukhOgnoo =
      tulukhOgnoo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let guilgeenuudForNekhemjlekh = [];
    try {
      const gereeWithGuilgee = await Geree(tukhainBaaziinKholbolt, true)
        .findById(tempData._id)
        .select("+guilgeenuudForNekhemjlekh");
      guilgeenuudForNekhemjlekh =
        gereeWithGuilgee?.guilgeenuudForNekhemjlekh || [];
    } catch (error) {
      // Error fetching guilgeenuudForNekhemjlekh - silently continue
    }

    const guilgeenuudTotal = guilgeenuudForNekhemjlekh.reduce(
      (sum, guilgee) => {
        return sum + (guilgee.tulukhDun || 0);
      },
      0,
    );

    // MERGE MODE: We no longer treat queued transactions as a separate 'avlaga-only' type.
    // Instead, we always include regular charges and merge the queued items into them.
    const isAvlagaOnlyInvoice = false;

    let finalZardluud = [...filteredZardluud];

    const zardluudTotal = filteredZardluud.reduce((sum, zardal) => {
      return sum + (zardal.dun || 0);
    }, 0);

    let ekhniiUldegdelFromOrshinSuugch = 0;
    let ekhniiUldegdelTailbar = ""; // Store the description from gereeniiTulukhAvlaga
    let ekhniiUldegdelRecordId = null; // Store the ID for reference

    // Only fetch and include ekhniiUldegdel if the flag is true (checkbox checked)
    if (includeEkhniiUldegdel) {
      // First check gereeniiTulukhAvlaga for ekhniiUldegdel records (primary source)
      try {
        const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
        const tulukhAvlagaRecords = await GereeniiTulukhAvlaga(
          tukhainBaaziinKholbolt,
        )
          .find({
            gereeniiId: String(tempData.gereeniiId || tempData._id),
            baiguullagiinId: String(tempData.baiguullagiinId),
            ekhniiUldegdelEsekh: true,
          })
          .lean();

        if (tulukhAvlagaRecords && tulukhAvlagaRecords.length > 0) {
          // Sum up all ekhniiUldegdel records and use uldegdel (remaining balance after payments)
          // This ensures the invoice shows the correct remaining amount, not the original amount
          ekhniiUldegdelFromOrshinSuugch = tulukhAvlagaRecords.reduce(
            (sum, record) => {
              // Use uldegdel (remaining) if available, otherwise fall back to undsenDun/tulukhDun
              const amount = Number(
                record.uldegdel ?? record.undsenDun ?? record.tulukhDun ?? 0,
              );
              return sum + amount;
            },
            0,
          );

          // Get the tailbar (description) from the first record
          const firstRecord = tulukhAvlagaRecords[0];
          ekhniiUldegdelTailbar =
            firstRecord.tailbar || firstRecord.temdeglel || "";
          ekhniiUldegdelRecordId = firstRecord._id?.toString();
        }
      } catch (error) {
        // Error fetching ekhniiUldegdel from gereeniiTulukhAvlaga - silently continue
      }

      // Fallback to orshinSuugch.ekhniiUldegdel if no gereeniiTulukhAvlaga records found
      if (ekhniiUldegdelFromOrshinSuugch === 0 && tempData.orshinSuugchId) {
        try {
          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
            .findById(tempData.orshinSuugchId)
            .select("ekhniiUldegdel")
            .lean();
          if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
            ekhniiUldegdelFromOrshinSuugch = orshinSuugch.ekhniiUldegdel;
          }
        } catch (error) {
          // Error fetching ekhniiUldegdel from orshinSuugch - silently continue
        }
      }
    }

    const hasEkhniiUldegdel =
      includeEkhniiUldegdel && ekhniiUldegdelFromOrshinSuugch > 0;
    const ekhniiUldegdelAmount = includeEkhniiUldegdel
      ? ekhniiUldegdelFromOrshinSuugch
      : 0;

    let updatedZardluudTotal = finalZardluud.reduce((sum, zardal) => {
      return sum + (zardal.dun || 0);
    }, 0);

    let finalNiitTulbur =
      updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

    if (finalNiitTulbur === 0 && guilgeenuudTotal === 0 && !hasEkhniiUldegdel) {
      return {
        success: false,
        error: "Нийт төлбөр 0₮ байна. Нэхэмжлэх үүсгэх шаардлагагүй.",
        gereeniiId: tempData._id,
        gereeniiDugaar: tempData.gereeniiDugaar,
        skipReason: "zero_amount",
      };
    }

    let zaaltMedeelel = null;
    let tsahilgaanNekhemjlekh = 0;
    let electricityZardalEntry = null;

    // Electricity processing (zaalt-based charges)
    if (
      tempData.barilgiinId &&
      tempData.baiguullagiinId &&
      tempData.orshinSuugchId
    ) {
      try {
        const { db } = require("zevbackv2");
        const Baiguullaga = require("../models/baiguullaga");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
          tempData.baiguullagiinId,
        );
        const targetBarilga = baiguullaga?.barilguud?.find(
          (b) => String(b._id) === String(tempData.barilgiinId),
        );
        // Helper to check if an expense is a VARIABLE electricity charge (meter-based)
        // "Дундын өмчлөл Цахилгаан" is FIXED - should NOT be processed as zaalt
        // Only "Цахилгаан" (without "дундын" or "өмчлөл") should be processed as zaalt
        const isVariableElectricity = (z) => {
          if (!z.zaalt) return false;
          const nameLower = (z.ner || "").toLowerCase();
          // Exclude fixed electricity charges from zaalt processing
          if (nameLower.includes("дундын") || nameLower.includes("өмчлөл")) {
            return false;
          }
          return true;
        };

        const gereeZaaltZardluud = (tempData.zardluud || []).filter(
          isVariableElectricity,
        );

        const zardluud = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];
        const zaaltZardluud = zardluud.filter(isVariableElectricity);

        if (gereeZaaltZardluud.length > 0 || zaaltZardluud.length > 0) {
          // Process ALL zaalt entries from BOTH contract and building level
          // Combine both sources, with contract entries taking priority for same name
          const combinedZaaltZardluud = [
            ...gereeZaaltZardluud,
            ...zaaltZardluud,
          ];

          // Keep only unique zaalt entries by name (first occurrence wins = contract priority)
          const seenNames = new Set();
          const zaaltZardluudToProcess = combinedZaaltZardluud.filter((z) => {
            const key = z.ner || z.zardliinTurul || "Цахилгаан";
            if (seenNames.has(key)) {
              return false;
            }
            seenNames.add(key);
            return true;
          });

          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
            .findById(tempData.orshinSuugchId)
            .select("tsahilgaaniiZaalt")
            .lean();

          const zaaltTariff = orshinSuugch?.tsahilgaaniiZaalt || 0;

          const umnukhZaalt =
            tempData.umnukhZaalt ?? zaaltZardluudToProcess[0]?.umnukhZaalt ?? 0;
          const suuliinZaalt =
            tempData.suuliinZaalt ??
            zaaltZardluudToProcess[0]?.suuliinZaalt ??
            0;

          const zoruu = suuliinZaalt - umnukhZaalt;

          const electricityEntries = [];
          let totalTsahilgaanNekhemjlekh = 0;

          for (const gereeZaaltZardal of zaaltZardluudToProcess) {
            let zaaltDefaultDun = 0;
            let zaaltDun = 0;
            let isFixedCharge = false;
            let kwhTariff = zaaltTariff; // from orshinSuugch.tsahilgaaniiZaalt

            // Variable electricity = zaalt + цахилгаан (not дундын өмчлөл) - needs Excel, don't show suuriKhuraamj alone
            const nameLower = (gereeZaaltZardal.ner || "").toLowerCase();
            const isVariableElectricityZardal =
              gereeZaaltZardal.zaalt &&
              nameLower.includes("цахилгаан") &&
              !nameLower.includes("дундын") &&
              !nameLower.includes("өмчлөл");

            // For variable цахилгаан: when no Excel (zoruu=0), skip - match Excel behavior (don't show suuriKhuraamj/tariff)
            if (isVariableElectricityZardal && zoruu === 0) {
              continue;
            }

            // Determine if this is a FIXED or CALCULATED electricity charge:
            // FIXED: tariffUsgeer = "₮" -> use tariff directly as the total amount
            // CALCULATED: tariffUsgeer = "кВт" -> tariff is kWh rate, suuriKhuraamj is base fee from Excel
            //
            // Key distinction:
            // - "Дундын өмчлөл Цахилгаан": tariffUsgeer="₮", tariff=6883.44 -> FIXED (use tariff directly)
            // - "Цахилгаан": tariffUsgeer="кВт", tariff=2000 (кВт rate), suuriKhuraamj=Excel imported amount -> CALCULATED

            // If tariffUsgeer is "кВт", it's ALWAYS a calculated type (per-kWh billing)
            const isCalculatedType = gereeZaaltZardal.tariffUsgeer === "кВт";

            if (!isCalculatedType) {
              // This is a FIXED electricity charge - use tariff directly
              isFixedCharge = true;
              zaaltDun = gereeZaaltZardal.tariff || gereeZaaltZardal.dun || 0;
            } else {
              // This is a CALCULATED electricity charge - needs Excel reading
              // For calculated: tariff = кВт rate, suuriKhuraamj = base fee
              // If no kWh rate from orshinSuugch, use tariff from zardal as kWh rate
              if (!kwhTariff || kwhTariff === 0) {
                kwhTariff = gereeZaaltZardal.tariff || 0;
              }

              try {
                const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
                const gereeniiId =
                  tempData._id?.toString() ||
                  tempData.gereeniiId ||
                  tempData._id;
                const gereeniiDugaar = tempData.gereeniiDugaar;

                let latestReading = null;
                if (gereeniiId) {
                  latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                    .findOne({ gereeniiId: gereeniiId })
                    .sort({
                      importOgnoo: -1,
                      "zaaltCalculation.calculatedAt": -1,
                      unshlaltiinOgnoo: -1,
                    })
                    .lean();
                }

                if (!latestReading && gereeniiDugaar) {
                  latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                    .findOne({ gereeniiDugaar: gereeniiDugaar })
                    .sort({
                      importOgnoo: -1,
                      "zaaltCalculation.calculatedAt": -1,
                      unshlaltiinOgnoo: -1,
                    })
                    .lean();
                }

                if (latestReading) {
                  // Get all calculation data from Excel reading
                  zaaltDefaultDun =
                    latestReading.zaaltCalculation?.defaultDun ||
                    latestReading.defaultDun ||
                    0;

                  // Get zoruu from Excel reading (this is the actual usage from import)
                  const readingZoruu =
                    latestReading.zaaltCalculation?.zoruu ||
                    latestReading.zoruu ||
                    0;

                  // Get tariff from Excel reading (kWh rate used during import)
                  const readingTariff =
                    latestReading.zaaltCalculation?.tariff ||
                    latestReading.tariff ||
                    0;

                  // Use the pre-calculated zaaltDun from Excel if available
                  if (latestReading.zaaltDun > 0) {
                    zaaltDun = latestReading.zaaltDun;
                  } else {
                    // Recalculate if no zaaltDun stored
                    // Use tariff from reading if available, otherwise from orshinSuugch
                    if (readingTariff > 0) {
                      kwhTariff = readingTariff;
                    }
                    zaaltDun = readingZoruu * kwhTariff + zaaltDefaultDun;
                  }
                } else {
                  // For цахилгаан (кВт): do NOT show suuriKhuraamj when no Excel - match Excel behavior
                  if (zoruu === 0) {
                    continue;
                  }

                  // Fallback to zardal's suuriKhuraamj, zaaltDefaultDun, or tariff (for old data format)
                  zaaltDefaultDun =
                    Number(gereeZaaltZardal.suuriKhuraamj) ||
                    gereeZaaltZardal.zaaltDefaultDun ||
                    gereeZaaltZardal.tariff ||
                    0;

                  // Calculate with zoruu from tempData (if available)
                  zaaltDun = zoruu * kwhTariff + zaaltDefaultDun;
                }
              } catch (error) {
                // Fallback calculation
                zaaltDefaultDun =
                  Number(gereeZaaltZardal.suuriKhuraamj) ||
                  gereeZaaltZardal.zaaltDefaultDun ||
                  gereeZaaltZardal.tariff ||
                  0;
                zaaltDun = zoruu * kwhTariff + zaaltDefaultDun;
              }

              // For calculated цахилгаан (tariffUsgeer="кВт"): do NOT show suuriKhuraamj alone when no Excel
              // Excel does not add a цахилгаан row when there's no import - match that behavior
              if (zaaltDun === 0 && zoruu === 0) {
                const wouldUseSuuriKhuraamj =
                  Number(gereeZaaltZardal.suuriKhuraamj) ||
                  gereeZaaltZardal.zaaltDefaultDun ||
                  gereeZaaltZardal.tariff ||
                  0;
                if (wouldUseSuuriKhuraamj > 0) {
                  continue;
                }
              }
              // Final fallback: if zaaltDun is still 0 but zardal has suuriKhuraamj, use that
              // (Only for non-calculated or when zoruu > 0 - already handled above)
              if (zaaltDun === 0) {
                const fallbackDun =
                  Number(gereeZaaltZardal.suuriKhuraamj) ||
                  gereeZaaltZardal.zaaltDefaultDun ||
                  gereeZaaltZardal.tariff ||
                  0;
                if (fallbackDun > 0) {
                  zaaltDun = fallbackDun;
                  zaaltDefaultDun = fallbackDun;
                }
              }
            }

            // Skip if no amount
            if (zaaltDun === 0) {
              continue;
            }

            totalTsahilgaanNekhemjlekh += zaaltDun;
            const finalZaaltTariff = zaaltDun;

            const electricityZardalEntry = {
              ner: gereeZaaltZardal.ner || "Цахилгаан",
              turul: normalizeTurul(gereeZaaltZardal.turul) || "Тогтмол",
              tariff: finalZaaltTariff,
              tariffUsgeer:
                zoruu === 0 || zaaltDun === 0
                  ? gereeZaaltZardal?.tariffUsgeer ||
                    buildingZaaltZardal?.tariffUsgeer ||
                    "₮"
                  : "₮",
              zardliinTurul: gereeZaaltZardal.zardliinTurul || "Энгийн",
              barilgiinId: tempData.barilgiinId,
              dun: finalZaaltTariff,
              bodokhArga: gereeZaaltZardal.bodokhArga || "тогтмол",
              tseverUsDun: 0,
              bokhirUsDun: 0,
              usKhalaasniiDun: 0,
              tsakhilgaanUrjver: 1,
              tsakhilgaanChadal: 0,
              tsakhilgaanDemjikh: 0,
              suuriKhuraamj: zaaltDefaultDun.toString(),
              nuatNemekhEsekh: false,
              ognoonuud: [],
              zaalt: true,
              zaaltTariff: zaaltTariff,
              zaaltDefaultDun: zaaltDefaultDun,
              umnukhZaalt: tempData.umnukhZaalt || 0,
              suuliinZaalt: tempData.suuliinZaalt || 0,
              zaaltTog: tempData.zaaltTog || 0,
              zaaltUs: tempData.zaaltUs || 0,
              zoruu: zoruu,
            };

            electricityEntries.push(electricityZardalEntry);
          }

          // NOTE: Removed duplicate ashiglaltiinZardluud entry - electricity is already calculated above
          // from zaaltZardluudToProcess with proper zaalt calculation (zoruu * tariff + defaultDun)

          tsahilgaanNekhemjlekh = totalTsahilgaanNekhemjlekh;
          electricityZardalEntry = electricityEntries[0];

          const filteredZardluudWithoutZaalt = finalZardluud.filter((z) => {
            if (z.zaalt === true) {
              return !zaaltZardluudToProcess.some(
                (gz) =>
                  z.ner === gz.ner && z.zardliinTurul === gz.zardliinTurul,
              );
            }
            if (z.zardliinTurul === "Лифт" && tempData.davkhar) {
              const davkharStr = String(tempData.davkhar);
              const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
                String(d),
              );
              if (choloolugdokhDavkharStr.includes(davkharStr)) {
                return false;
              }
            }
            return true;
          });

          filteredZardluudWithoutZaalt.push(...electricityEntries);

          finalZardluud.length = 0;
          finalZardluud.push(...filteredZardluudWithoutZaalt);

          finalZardluud = normalizeZardluudTurul(finalZardluud);

          updatedZardluudTotal = isAvlagaOnlyInvoice
            ? 0
            : finalZardluud.reduce((sum, zardal) => {
                return sum + (zardal.dun || 0);
              }, 0);

          finalNiitTulbur =
            updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

          const firstElectricityEntry = electricityEntries[0];
          const firstBuildingZaaltZardal = zaaltZardluud.find(
            (z) =>
              firstElectricityEntry &&
              z.ner === firstElectricityEntry.ner &&
              z.zardliinTurul === firstElectricityEntry.zardliinTurul,
          );
          zaaltMedeelel = {
            umnukhZaalt: tempData.umnukhZaalt || 0,
            suuliinZaalt: tempData.suuliinZaalt || 0,
            zaaltTog: tempData.zaaltTog || 0,
            zaaltUs: tempData.zaaltUs || 0,
            zoruu: zoruu,
            tariff: zaaltTariff,
            tariffUsgeer:
              firstElectricityEntry?.tariffUsgeer ||
              firstBuildingZaaltZardal?.tariffUsgeer ||
              "кВт",
            tariffType:
              firstElectricityEntry?.zardliinTurul ||
              firstBuildingZaaltZardal?.zardliinTurul ||
              "Энгийн",
            tariffName:
              firstElectricityEntry?.ner ||
              firstBuildingZaaltZardal?.ner ||
              "Цахилгаан",
            defaultDun: firstElectricityEntry?.zaaltDefaultDun || 0,
            zaaltDun: tsahilgaanNekhemjlekh,
          };
        }
      } catch (error) {
        // Error processing electricity for invoice - silently continue
      }
    }

    const normalizedZardluud = normalizeZardluudTurul(finalZardluud);

    let zardluudWithDun = normalizedZardluud.map((zardal) => {
      if (zardal.zaalt === true) {
        return zardal;
      }
      const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
      const result = {
        ...zardal,
        dun: dun,
        zardliinTurul: zardal.zardliinTurul || "Энгийн",
      };
      if (result.dun === 0 && result.tariff > 0) {
        result.dun = result.tariff;
      }
      return result;
    });

    if (tempData.davkhar && choloolugdokhDavkhar.length > 0) {
      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
        String(d),
      );
      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        zardluudWithDun = zardluudWithDun.filter((zardal) => {
          if (zardal.zardliinTurul === "Лифт") return false;
          if (zardal.ner && zardal.ner.trim() === "Лифт") return false;
          if (zardal.ner && zardal.ner.includes("Лифт")) return false;
          if (
            liftTariff !== null &&
            (zardal.dun === liftTariff || zardal.tariff === liftTariff)
          )
            return false;
          return true;
        });
      }
    }

    const correctedZardluudTotal = isAvlagaOnlyInvoice
      ? 0
      : zardluudWithDun.reduce((sum, zardal) => {
          return sum + (zardal.dun || 0);
        }, 0);

    let correctedFinalNiitTulbur =
      correctedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

    let positiveBalanceUsed = 0;
    let remainingPositiveBalance = 0;
    if (gereePositiveBalance > 0) {
      positiveBalanceUsed = Math.min(
        gereePositiveBalance,
        correctedFinalNiitTulbur,
      );
      correctedFinalNiitTulbur = Math.max(
        0,
        correctedFinalNiitTulbur - positiveBalanceUsed,
      );
      remainingPositiveBalance = gereePositiveBalance - positiveBalanceUsed;
    }

    if (tempData.davkhar && choloolugdokhDavkhar.length > 0) {
      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
        String(d),
      );
      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        const liftCountBefore = zardluudWithDun.filter((z) => {
          if (z.zardliinTurul === "Лифт") return true;
          if (z.ner && z.ner.includes("Лифт")) return true;
          if (
            liftTariff !== null &&
            (z.dun === liftTariff || z.tariff === liftTariff)
          )
            return true;
          return false;
        }).length;
        if (liftCountBefore > 0) {
          zardluudWithDun = zardluudWithDun.filter((z) => {
            if (z.zardliinTurul === "Лифт") return false;
            if (z.ner && z.ner.trim() === "Лифт") return false;
            if (z.ner && z.ner.includes("Лифт")) return false;
            if (
              liftTariff !== null &&
              (z.dun === liftTariff || z.tariff === liftTariff)
            )
              return false;
            return true;
          });
          const correctedZardluudTotalAfter = zardluudWithDun.reduce(
            (sum, zardal) => sum + (zardal.dun || 0),
            0,
          );
          correctedFinalNiitTulbur =
            correctedZardluudTotalAfter +
            guilgeenuudTotal +
            ekhniiUldegdelAmount;
        }
      }
    }

    // Special discount for 2nd floor in specific organization: subtract 4,495.42
    // This applies only to 2nd floor (davkhar === "2" or 2) for org ID: 697c70e81e782d8110d3b064
    // Apply discount AFTER all other calculations (lift exclusion, positive balance, etc.)
    const davkharStr = tempData.davkhar ? String(tempData.davkhar).trim() : "";
    const isSecondFloor = davkharStr === "2" || davkharStr === 2 || Number(davkharStr) === 2;
    const orgIdForSecondFloorDiscount = "697c70e81e782d8110d3b064";
    const orgIdMatches = tempData.baiguullagiinId && String(tempData.baiguullagiinId).trim() === orgIdForSecondFloorDiscount;
    
    if (isSecondFloor && orgIdMatches) {
      const secondFloorDiscount = 4495.42;
      const beforeDiscount = correctedFinalNiitTulbur;
      correctedFinalNiitTulbur = Math.max(0, correctedFinalNiitTulbur - secondFloorDiscount);
      console.log(`[2ND FLOOR DISCOUNT] Applied discount of ${secondFloorDiscount} to invoice. Before: ${beforeDiscount}, After: ${correctedFinalNiitTulbur}, davkhar: ${tempData.davkhar}, orgId: ${tempData.baiguullagiinId}`);
    } else {
      // Debug logging to see why discount wasn't applied
      if (tempData.baiguullagiinId && String(tempData.baiguullagiinId).trim() === orgIdForSecondFloorDiscount) {
        console.log(`[2ND FLOOR DISCOUNT] Discount NOT applied. davkhar: "${tempData.davkhar}" (type: ${typeof tempData.davkhar}), isSecondFloor: ${isSecondFloor}, orgId: ${tempData.baiguullagiinId}`);
      }
    }

    // Always add ekhniiUldegdel row (even when 0) for display purposes
    zardluudWithDun.push({
      _id:
        ekhniiUldegdelRecordId || ekhniiUldegdelId || `init-${Math.random()}`,
      ner: "Эхний үлдэгдэл",
      turul: "Тогтмол",
      bodokhArga: "тогтмол",
      zardliinTurul: "Энгийн",
      tariff: ekhniiUldegdelAmount,
      tariffUsgeer: tempData.ekhniiUldegdelUsgeer || "₮",
      dun: ekhniiUldegdelAmount,
      zaalt: false,
      ognoonuud: [],
      nuatNemekhEsekh: false,
      nuatBodokhEsekh: false,
      isEkhniiUldegdel: true, // Flag to identify this row
      tailbar: ekhniiUldegdelTailbar || "", // Include the description from gereeniiTulukhAvlaga
    });

    zardluudWithDun = zardluudWithDun.map((zardal) => {
      if (zardal.zaalt === true) {
        return zardal;
      }
      if (zardal.dun === 0 && zardal.tariff > 0) {
        return {
          ...zardal,
          dun: zardal.tariff,
        };
      }
      return zardal;
    });

    tuukh.medeelel = {
      zardluud: zardluudWithDun,
      guilgeenuud: guilgeenuudForNekhemjlekh,
      segmentuud: tempData.segmentuud || [],
      khungulultuud: tempData.khungulultuud || [],
      toot: tempData.toot,
      temdeglel: tempData.temdeglel,
      tailbar: tempData.temdeglel || "",
      uusgegsenEsekh: uusgegsenEsekh,
      uusgegsenOgnoo: new Date(),
      ...(zaaltMedeelel ? { zaalt: zaaltMedeelel } : {}),
    };
    tuukh.nekhemjlekh =
      tempData.nekhemjlekh ||
      (uusgegsenEsekh === "automataar"
        ? "Автоматаар үүссэн нэхэмжлэх"
        : "Гаран үүссэн нэхэмжлэх");
    tuukh.zagvariinNer = tempData.zagvariinNer || org.ner;

    const tailbarText =
      tempData.temdeglel &&
      tempData.temdeglel !== "Excel файлаас автоматаар үүссэн гэрээ"
        ? `\nТайлбар: ${tempData.temdeglel}`
        : "";

    const zaaltText = zaaltMedeelel
      ? `\nЦахилгаан: Өмнө: ${zaaltMedeelel.umnukhZaalt}, Өдөр: ${zaaltMedeelel.zaaltTog}, Шөнө: ${zaaltMedeelel.zaaltUs}, Нийт: ${zaaltMedeelel.suuliinZaalt}`
      : "";

    const positiveBalanceText =
      positiveBalanceUsed > 0
        ? `\nЭерэг үлдэгдэл ашигласан: ${positiveBalanceUsed}₮${remainingPositiveBalance > 0 ? `, Үлдсэн: ${remainingPositiveBalance}₮` : ""}`
        : "";

    tuukh.content = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${correctedFinalNiitTulbur}₮${tailbarText}${zaaltText}${positiveBalanceText}`;
    tuukh.nekhemjlekhiinDans =
      tempData.nekhemjlekhiinDans || dansInfo.dugaar || "";
    tuukh.nekhemjlekhiinDansniiNer =
      tempData.nekhemjlekhiinDansniiNer || dansInfo.dansniiNer || "";
    tuukh.nekhemjlekhiinBank =
      tempData.nekhemjlekhiinBank || dansInfo.bank || "";

    tuukh.nekhemjlekhiinIbanDugaar =
      tempData.nekhemjlekhiinIbanDugaar || dansInfo.ibanDugaar || "";
    tuukh.nekhemjlekhiinOgnoo = new Date();
    tuukh.niitTulbur = correctedFinalNiitTulbur;

    if (tsahilgaanNekhemjlekh > 0) {
      tuukh.tsahilgaanNekhemjlekh = tsahilgaanNekhemjlekh;
    }

    tuukh.tuluv = "Төлөөгүй";

    const suuliinNekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });

    const suuliinDugaar = suuliinNekhemjlekh?.dugaalaltDugaar;
    tuukh.dugaalaltDugaar =
      suuliinDugaar && !isNaN(suuliinDugaar) ? suuliinDugaar + 1 : 1;

    const generateUniqueNekhemjlekhiinDugaar = async () => {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const datePrefix = `${year}${month}${day}`;

      const todayInvoices = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
        .find({
          nekhemjlekhiinDugaar: { $regex: `^НЭХ-${datePrefix}-` },
        })
        .sort({ nekhemjlekhiinDugaar: -1 })
        .limit(1)
        .lean();

      let sequence = 1;
      if (todayInvoices.length > 0 && todayInvoices[0].nekhemjlekhiinDugaar) {
        const lastDugaar = todayInvoices[0].nekhemjlekhiinDugaar;
        const match = lastDugaar.match(/^НЭХ-\d{8}-(\d+)$/);
        if (match) {
          sequence = parseInt(match[1], 10) + 1;
        }
      }

      return `НЭХ-${datePrefix}-${String(sequence).padStart(4, "0")}`;
    };

    const saveInvoiceWithRetry = async (maxRetries = 10) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          tuukh.nekhemjlekhiinDugaar =
            await generateUniqueNekhemjlekhiinDugaar();

          await tuukh.save();

          return;
        } catch (error) {
          if (
            error.code === 11000 &&
            error.keyPattern &&
            error.keyPattern.nekhemjlekhiinDugaar
          ) {
            if (attempt === maxRetries) {
              throw new Error(
                `Failed to generate unique invoice number after ${maxRetries} attempts for contract ${tempData.gereeniiDugaar}: ${error.message}`,
              );
            }

            const delay = 50 * attempt + Math.random() * 50;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            throw error;
          }
        }
      }
    };

    await saveInvoiceWithRetry();

    if (guilgeenuudForNekhemjlekh.length > 0) {
      try {
        await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
          tempData._id,
          {
            $set: {
              guilgeenuudForNekhemjlekh: [],
            },
          },
          {
            runValidators: false,
          },
        );
      } catch (error) {
        // Error clearing guilgeenuudForNekhemjlekh - silently continue
      }
    }

    // Update geree with latest invoice date and increment globalUldegdel
    try {
      await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
        tempData._id,
        {
          $set: {
            nekhemjlekhiinOgnoo: new Date(),
          },
          $inc: {
            globalUldegdel: tuukh.niitTulbur || 0,
          },
        },
        {
          runValidators: false,
        },
      );
    } catch (gereeUpdateError) {
      // Error updating geree.globalUldegdel after invoice creation - silently continue
    }

    // TEMPORARILY DISABLED: Send SMS to orshinSuugch when invoice is created
    // try {
    //   await sendInvoiceSmsToOrshinSuugch(
    //     tuukh,
    //     tempData,
    //     org,
    //     tukhainBaaziinKholbolt
    //   );
    // } catch (smsError) {
    //   console.error("Error sending SMS to orshinSuugch:", smsError);
    //   // Don't fail the invoice creation if SMS fails
    // }

    let savedMedegdel = null;
    try {
      if (tempData.orshinSuugchId) {
        const baiguullagiinId = org._id
          ? org._id.toString()
          : org.id
            ? org.id.toString()
            : String(org);

        const kholbolt = db.kholboltuud.find(
          (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
        );

        if (kholbolt) {
          const medegdel = new Medegdel(kholbolt)();
          medegdel.orshinSuugchId = tempData.orshinSuugchId;
          medegdel.baiguullagiinId = baiguullagiinId;
          medegdel.barilgiinId = tempData.barilgiinId || "";
          medegdel.title = "Шинэ нэхэмжлэх үүссэн";
          medegdel.message = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${correctedFinalNiitTulbur}₮`;
          medegdel.kharsanEsekh = false;
          medegdel.turul = "мэдэгдэл";
          medegdel.ognoo = new Date();

          await medegdel.save();

          const medegdelObj = medegdel.toObject();
          const mongolianOffset = 8 * 60 * 60 * 1000;

          if (medegdelObj.createdAt) {
            const createdAtMongolian = new Date(
              medegdelObj.createdAt.getTime() + mongolianOffset,
            );
            medegdelObj.createdAt = createdAtMongolian.toISOString();
          }
          if (medegdelObj.updatedAt) {
            const updatedAtMongolian = new Date(
              medegdelObj.updatedAt.getTime() + mongolianOffset,
            );
            medegdelObj.updatedAt = updatedAtMongolian.toISOString();
          }
          if (medegdelObj.ognoo) {
            const ognooMongolian = new Date(
              medegdelObj.ognoo.getTime() + mongolianOffset,
            );
            medegdelObj.ognoo = ognooMongolian.toISOString();
          }

          savedMedegdel = medegdelObj;
        }
      }
    } catch (notificationError) {
      // Error sending notification for invoice - silently continue
    }

    return {
      success: true,
      nekhemjlekh: tuukh,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar,
      tulbur: correctedFinalNiitTulbur,
      medegdel: savedMedegdel,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar,
    };
  }
};

const updateGereeAndNekhemjlekhFromZardluud = async (
  ashiglaltiinZardal,
  tukhainBaaziinKholbolt,
) => {
  try {
    const Geree = require("../models/geree");
    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    const gereenuud = await Geree(tukhainBaaziinKholbolt, true).find({
      "zardluud.ner": ashiglaltiinZardal.ner,
      "zardluud.turul": ashiglaltiinZardal.turul,
      "zardluud.zardliinTurul": ashiglaltiinZardal.zardliinTurul,
    });

    for (const geree of gereenuud) {
      const zardalIndex = geree.zardluud.findIndex(
        (z) =>
          z.ner === ashiglaltiinZardal.ner &&
          z.turul === ashiglaltiinZardal.turul &&
          z.zardliinTurul === ashiglaltiinZardal.zardliinTurul,
      );

      if (zardalIndex !== -1) {
        geree.zardluud[zardalIndex] = {
          ...geree.zardluud[zardalIndex].toObject(),
          ner: ashiglaltiinZardal.ner,
          turul: normalizeTurul(ashiglaltiinZardal.turul),
          tariff: ashiglaltiinZardal.tariff,
          tariffUsgeer: ashiglaltiinZardal.tariffUsgeer,
          zardliinTurul: ashiglaltiinZardal.zardliinTurul,
          tseverUsDun: ashiglaltiinZardal.tseverUsDun,
          bokhirUsDun: ashiglaltiinZardal.bokhirUsDun,
          usKhalaasniiDun: ashiglaltiinZardal.usKhalaasniiDun,
          tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver,
          tsakhilgaanChadal: ashiglaltiinZardal.tsakhilgaanChadal,
          tsakhilgaanDemjikh: ashiglaltiinZardal.tsakhilgaanDemjikh,
          suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj,
          nuatNemekhEsekh: ashiglaltiinZardal.nuatNemekhEsekh,
          dun: ashiglaltiinZardal.dun,
        };

        const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);

        geree.niitTulbur = niitTulbur;

        await geree.save();

        const nekhemjlekh = await nekhemjlekhiinTuukh(
          tukhainBaaziinKholbolt,
        ).findOne({
          gereeniiId: geree._id,
          tuluv: { $ne: "Төлсөн" },
        });

        if (nekhemjlekh) {
          const nekhemjlekhZardalIndex =
            nekhemjlekh.medeelel.zardluud.findIndex(
              (z) =>
                z.ner === ashiglaltiinZardal.ner &&
                z.turul === ashiglaltiinZardal.turul &&
                z.zardliinTurul === ashiglaltiinZardal.zardliinTurul,
            );

          if (nekhemjlekhZardalIndex !== -1) {
            nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex] = {
              ...nekhemjlekh.medeelel.zardluud[nekhemjlekhZardalIndex],
              ner: ashiglaltiinZardal.ner,
              turul: normalizeTurul(ashiglaltiinZardal.turul),
              tariff: ashiglaltiinZardal.tariff,
              tariffUsgeer: ashiglaltiinZardal.tariffUsgeer,
              zardliinTurul: ashiglaltiinZardal.zardliinTurul,
              tseverUsDun: ashiglaltiinZardal.tseverUsDun,
              bokhirUsDun: ashiglaltiinZardal.bokhirUsDun,
              usKhalaasniiDun: ashiglaltiinZardal.usKhalaasniiDun,
              tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver,
              tsakhilgaanChadal: ashiglaltiinZardal.tsakhilgaanChadal,
              tsakhilgaanDemjikh: ashiglaltiinZardal.tsakhilgaanDemjikh,
              suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj,
              nuatNemekhEsekh: ashiglaltiinZardal.nuatNemekhEsekh,
              dun: ashiglaltiinZardal.dun,
            };

            nekhemjlekh.niitTulbur = nekhemjlekh.medeelel.zardluud.reduce(
              (sum, zardal) => {
                return sum + (zardal.tariff || 0);
              },
              0,
            );

            nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;

            await nekhemjlekh.save();
          }
        }
      }
    }

    return { success: true, updatedGereenuud: gereenuud.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

async function sendInvoiceSmsToOrshinSuugch(
  nekhemjlekh,
  geree,
  baiguullaga,
  tukhainBaaziinKholbolt,
) {
  try {
    if (!geree.orshinSuugchId) {
      return;
    }

    const { db } = require("zevbackv2");
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(
      geree.orshinSuugchId,
    );

    if (!orshinSuugch || !orshinSuugch.utas) {
      return;
    }

    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    const smsText = `Tany ${nekhemjlekh.gereeniiDugaar} gereend, ${
      nekhemjlekh.niitTulbur
    }₮ nekhemjlekh uuslee, tulukh ognoo ${new Date(
      nekhemjlekh.tulukhOgnoo,
    ).toLocaleDateString("mn-MN")}`;

    const msgServer = process.env.MSG_SERVER || "https://api.messagepro.mn";
    let url =
      msgServer +
      "/send" +
      "?key=" +
      msgIlgeekhKey +
      "&from=" +
      msgIlgeekhDugaar +
      "&to=" +
      orshinSuugch.utas.toString() +
      "&text=" +
      smsText;

    url = encodeURI(url);

    request(url, { json: true }, (err1, res1, body) => {
      if (!err1) {
        try {
          const msg = new MsgTuukh(tukhainBaaziinKholbolt)();
          msg.baiguullagiinId = baiguullaga._id.toString();
          msg.dugaar = orshinSuugch.utas;
          msg.gereeniiId = geree._id.toString();
          msg.msg = smsText;
          msg.msgIlgeekhKey = msgIlgeekhKey;
          msg.msgIlgeekhDugaar = msgIlgeekhDugaar;
          msg.save().catch(() => {
            // Error saving SMS to MsgTuukh - silently continue
          });
        } catch (saveError) {
          // Error saving SMS to MsgTuukh - silently continue
        }
      }
    });
  } catch (error) {
    throw error;
  }
}

const gereeNeesNekhemjlekhUusgekhPreviousMonth = async (
  tempData,
  org,
  tukhainBaaziinKholbolt,
  monthsAgo = 1,
  uusgegsenEsekh = "garan",
  skipDuplicateCheck = false,
) => {
  try {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setMonth(targetDate.getMonth() - monthsAgo);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const NekhemjlekhCron = require("../models/cronSchedule");
    let cronSchedule = null;
    if (tempData.barilgiinId) {
      cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
        barilgiinId: tempData.barilgiinId,
      });
    }

    if (!cronSchedule) {
      cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
        barilgiinId: null,
      });
    }

    const scheduledDay = cronSchedule?.nekhemjlekhUusgekhOgnoo || 1;

    const invoiceDate = new Date(
      targetYear,
      targetMonth,
      scheduledDay,
      0,
      0,
      0,
      0,
    );

    const dueDate = new Date(
      targetYear,
      targetMonth + 1,
      scheduledDay,
      0,
      0,
      0,
      0,
    );
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    if (scheduledDay > lastDayOfMonth) {
      dueDate.setDate(lastDayOfMonth);
    }

    const modifiedTempData = {
      ...tempData,
      ognoo: invoiceDate,
      nekhemjlekhiinOgnoo: invoiceDate,
    };

    const originalFunction = gereeNeesNekhemjlekhUusgekh;

    const monthStart = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Check for existing invoice in target month
    // IMPORTANT: Always reuse existing monthly invoice when it exists
    // (even if paid), regardless of skipDuplicateCheck.
    if (true) {
      let checkBarilgiinId = tempData.barilgiinId;
      if (!checkBarilgiinId && org?.barilguud && org.barilguud.length > 0) {
        checkBarilgiinId = String(org.barilguud[0]._id);
      }

      const existingInvoiceQuery = {
        gereeniiId: tempData._id.toString(),
        $or: [
          {
            ognoo: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
          {
            createdAt: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
        ],
      };

      if (checkBarilgiinId) {
        existingInvoiceQuery.barilgiinId = checkBarilgiinId;
      }

      const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
        .findOne(existingInvoiceQuery)
        .sort({ ognoo: -1, createdAt: -1 });

      if (existingInvoice) {
        return {
          success: true,
          nekhemjlekh: existingInvoice,
          gereeniiId: tempData._id,
          gereeniiDugaar: tempData.gereeniiDugaar,
          tulbur: existingInvoice.niitTulbur,
          alreadyExists: true,
        };
      }
    }

    const result = await originalFunction(
      modifiedTempData,
      org,
      tukhainBaaziinKholbolt,
      uusgegsenEsekh,
      true,
    );

    if (result.success && result.nekhemjlekh) {
      const invoice = await nekhemjlekhiinTuukh(
        tukhainBaaziinKholbolt,
      ).findById(result.nekhemjlekh._id || result.nekhemjlekh);

      if (invoice) {
        invoice.ognoo = invoiceDate;
        invoice.nekhemjlekhiinOgnoo = invoiceDate;
        invoice.tulukhOgnoo = dueDate;
        await invoice.save();
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
};

const markInvoicesAsPaid = asyncHandler(async (req, res, next) => {
  try {
    const {
      baiguullagiinId,
      dun,
      orshinSuugchId,
      gereeniiId,
      nekhemjlekhiinIds,
      markEkhniiUldegdel = false,
      tailbar = null,
    } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        error: "baiguullagiinId is required",
      });
    }

    if (!dun || dun <= 0) {
      return res.status(400).json({
        success: false,
        error: "dun (payment amount) is required and must be greater than 0",
      });
    }

    const {
      markInvoicesAsPaid: markInvoices,
    } = require("../services/invoicePaymentService");

    const result = await markInvoices({
      baiguullagiinId,
      dun,
      orshinSuugchId,
      gereeniiId,
      nekhemjlekhiinIds,
      markEkhniiUldegdel,
      tailbar,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const previewInvoice = async (
  gereeId,
  baiguullagiinId,
  barilgiinId,
  targetMonth = null,
  targetYear = null,
) => {
  try {
    const { db } = require("zevbackv2");
    const mongoose = require("mongoose");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");
    const OrshinSuugch = require("../models/orshinSuugch");
    const NekhemjlekhCron = require("../models/cronSchedule");

    // Try to find the connection
    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
    );

    // If not found, try with ObjectId comparison
    if (
      !tukhainBaaziinKholbolt &&
      mongoose.Types.ObjectId.isValid(baiguullagiinId)
    ) {
      const baiguullagiinObjectId = new mongoose.Types.ObjectId(
        baiguullagiinId,
      );
      tukhainBaaziinKholbolt = db.kholboltuud.find((k) => {
        const kId = k.baiguullagiinId;
        if (mongoose.Types.ObjectId.isValid(kId)) {
          return kId.equals(baiguullagiinObjectId);
        }
        return String(kId) === String(baiguullagiinId);
      });
    }

    if (!tukhainBaaziinKholbolt) {
      return {
        success: false,
        error: `Холболтын мэдээлэл олдсонгүй! (baiguullagiinId: ${baiguullagiinId})`,
      };
    }

    const geree = await Geree(tukhainBaaziinKholbolt).findById(gereeId).lean();
    if (!geree) {
      return { success: false, error: "Гэрээ олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const currentDate =
      targetMonth !== null && targetYear !== null
        ? new Date(targetYear, targetMonth - 1, 1)
        : new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const targetBarilga = baiguullaga?.barilguud?.find(
      (b) => String(b._id) === String(barilgiinId || geree.barilgiinId || ""),
    );

    const ashiglaltiinZardluud =
      targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];

    let filteredZardluud = ashiglaltiinZardluud
      .filter((zardal) => zardal.zaalt !== true)
      .map((zardal) => {
        const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
        return { ...zardal, dun: dun };
      });

    filteredZardluud = normalizeZardluudTurul(filteredZardluud);

    let choloolugdokhDavkhar = [];
    let liftTariff = null;

    if (geree.davkhar && geree.barilgiinId && geree.baiguullagiinId) {
      choloolugdokhDavkhar =
        targetBarilga?.tokhirgoo?.liftShalgaya?.choloolugdokhDavkhar || [];

      const liftZardalFromBuilding =
        targetBarilga?.tokhirgoo?.ashiglaltiinZardluud?.find(
          (z) =>
            z.zardliinTurul === "Лифт" || (z.ner && z.ner.includes("Лифт")),
        );
      if (liftZardalFromBuilding) {
        liftTariff =
          liftZardalFromBuilding.tariff || liftZardalFromBuilding.dun;
      }

      if (choloolugdokhDavkhar.length === 0 && geree.barilgiinId) {
        try {
          const LiftShalgaya = require("../models/liftShalgaya");
          const liftShalgayaRecord = await LiftShalgaya(tukhainBaaziinKholbolt)
            .findOne({
              baiguullagiinId: String(geree.baiguullagiinId),
              barilgiinId: String(geree.barilgiinId),
            })
            .lean();

          if (
            liftShalgayaRecord?.choloolugdokhDavkhar &&
            liftShalgayaRecord.choloolugdokhDavkhar.length > 0
          ) {
            choloolugdokhDavkhar = liftShalgayaRecord.choloolugdokhDavkhar;
          }
        } catch (error) {
          // Error fetching liftShalgaya - silently continue
        }
      }

      const davkharStr = String(geree.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map((d) =>
        String(d),
      );

      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        filteredZardluud = filteredZardluud.filter(
          (zardal) =>
            zardal.zardliinTurul !== "Лифт" &&
            !(zardal.ner && zardal.ner.trim() === "Лифт") &&
            !(zardal.ner && zardal.ner.includes("Лифт")) &&
            !(
              liftTariff !== null &&
              (zardal.dun === liftTariff || zardal.tariff === liftTariff)
            ),
        );
      }
    }

    let ekhniiUldegdelAmount = 0;
    let ekhniiUldegdelTailbar = ""; // Store the description from gereeniiTulukhAvlaga

    // First check gereeniiTulukhAvlaga for ekhniiUldegdel records (primary source)
    try {
      const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
      const tulukhAvlagaRecords = await GereeniiTulukhAvlaga(
        tukhainBaaziinKholbolt,
      )
        .find({
          gereeniiId: String(gereeId),
          baiguullagiinId: String(baiguullagiinId),
          ekhniiUldegdelEsekh: true,
        })
        .lean();

      if (tulukhAvlagaRecords && tulukhAvlagaRecords.length > 0) {
        // Sum up all ekhniiUldegdel records using undsenDun (original amount before payments)
        // The preview should show the original charged amount, not the remaining balance
        ekhniiUldegdelAmount = tulukhAvlagaRecords.reduce((sum, record) => {
          // Use undsenDun (original amount) - this shows what was originally charged
          const amount = Number(
            record.undsenDun ?? record.tulukhDun ?? record.uldegdel ?? 0,
          );
          return sum + amount;
        }, 0);

        // Get the tailbar (description) from the first record
        const firstRecord = tulukhAvlagaRecords[0];
        ekhniiUldegdelTailbar =
          firstRecord.tailbar || firstRecord.temdeglel || "";
      }
    } catch (error) {
      // Error fetching ekhniiUldegdel from gereeniiTulukhAvlaga - silently continue
    }

    // Fallback to orshinSuugch.ekhniiUldegdel if no gereeniiTulukhAvlaga records found
    if (ekhniiUldegdelAmount === 0 && geree.orshinSuugchId) {
      try {
        const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
          .findById(geree.orshinSuugchId)
          .select("ekhniiUldegdel")
          .lean();
        if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
          ekhniiUldegdelAmount = orshinSuugch.ekhniiUldegdel;
        }
      } catch (error) {
        // Error fetching ekhniiUldegdel from orshinSuugch - silently continue
      }
    }

    let zardluudWithDun = filteredZardluud.map((zardal) => {
      if (zardal.zaalt === true) return zardal;
      const dun = zardal.dun > 0 ? zardal.dun : zardal.tariff || 0;
      const result = {
        ...zardal,
        dun: dun,
        zardliinTurul: zardal.zardliinTurul || "Энгийн",
      };
      if (result.dun === 0 && result.tariff > 0) {
        result.dun = result.tariff;
      }
      return result;
    });

    // Add electricity (zaalt) entries for preview - process ALL zaalt zardals
    // Combine both contract-level and building-level electricity expenses
    try {
      // Helper to check if an expense is a VARIABLE electricity charge (meter-based)
      // "Дундын өмчлөл Цахилгаан" is FIXED - should NOT be processed as zaalt
      // Only "Цахилгаан" (without "дундын" or "өмчлөл") should be processed as zaalt
      const isVariableElectricity = (z) => {
        if (!z.zaalt) return false;
        const nameLower = (z.ner || "").toLowerCase();
        // Exclude fixed electricity charges from zaalt processing
        if (nameLower.includes("дундын") || nameLower.includes("өмчлөл")) {
          return false;
        }
        return true;
      };

      const gereeZaaltZardluud = (geree.zardluud || []).filter(
        isVariableElectricity,
      );
      const buildingZaaltZardluud = ashiglaltiinZardluud.filter(
        isVariableElectricity,
      );

      // Combine both sources, then deduplicate by name (contract entries take priority)
      const combinedZaalt = [...gereeZaaltZardluud, ...buildingZaaltZardluud];
      const seenNames = new Set();
      const zaaltZardluud = combinedZaalt.filter((z) => {
        const key = z.ner || z.zardliinTurul || "Цахилгаан";
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      if (zaaltZardluud.length > 0) {
        const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
        let zaaltTariff = 0;

        // Try to get tariff from orshinSuugch first (for calculated electricity)
        if (geree.orshinSuugchId) {
          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
            .findById(geree.orshinSuugchId)
            .select("tsahilgaaniiZaalt")
            .lean();
          zaaltTariff = Number(orshinSuugch?.tsahilgaaniiZaalt) || 0;
        }

        // Get latest reading for this geree (for calculated electricity)
        let latestReading = null;
        try {
          latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
            .findOne({
              $or: [
                { gereeniiId: String(gereeId) },
                { gereeniiDugaar: geree.gereeniiDugaar },
              ],
            })
            .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1 })
            .lean();
        } catch (e) {
          // Error finding zaalt readings - silently continue
        }

        // Process each electricity zardal
        for (const zaaltZardal of zaaltZardluud) {
          let electricityDun = 0;
          let zoruu = 0;
          let defaultDun = 0;
          let kwhTariff = zaaltTariff; // from orshinSuugch

          // Variable electricity = zaalt + цахилгаан (not дундын өмчлөл) - needs Excel, don't show suuriKhuraamj alone
          const pvNameLower = (zaaltZardal.ner || "").toLowerCase();
          const pvIsVariableElectricity =
            zaaltZardal.zaalt &&
            pvNameLower.includes("цахилгаан") &&
            !pvNameLower.includes("дундын") &&
            !pvNameLower.includes("өмчлөл");

          // For variable цахилгаан: when no Excel reading, skip - match Excel behavior
          if (pvIsVariableElectricity && !latestReading) {
            continue;
          }

          // Determine if this is a FIXED or CALCULATED electricity charge:
          // FIXED: tariffUsgeer = "₮" -> use tariff directly as the total amount
          // CALCULATED: tariffUsgeer = "кВт" -> tariff is kWh rate, suuriKhuraamj is base fee from Excel
          //
          // Key distinction:
          // - "Дундын өмчлөл Цахилгаан": tariffUsgeer="₮", tariff=6883.44 -> FIXED
          // - "Цахилгаан": tariffUsgeer="кВт", tariff=kWh rate, suuriKhuraamj=Excel imported -> CALCULATED

          // If tariffUsgeer is "кВт", it's ALWAYS a calculated type (per-kWh billing)
          const isCalculatedType = zaaltZardal.tariffUsgeer === "кВт";

          if (!isCalculatedType) {
            // FIXED electricity charge - use tariff directly
            electricityDun = zaaltZardal.tariff || zaaltZardal.dun || 0;
          } else {
            // CALCULATED electricity charge
            // For calculated: tariff = кВт rate, suuriKhuraamj = base fee
            if (!kwhTariff || kwhTariff === 0) {
              kwhTariff = zaaltZardal.tariff || 0;
            }

            if (latestReading) {
              // Get all calculation data from Excel reading
              defaultDun =
                latestReading.zaaltCalculation?.defaultDun ||
                latestReading.defaultDun ||
                0;
              zoruu =
                latestReading.zoruu ||
                latestReading.zaaltCalculation?.zoruu ||
                0;

              // Get tariff from Excel reading (kWh rate used during import)
              const readingTariff =
                latestReading.zaaltCalculation?.tariff ||
                latestReading.tariff ||
                0;

              // Use the pre-calculated zaaltDun from Excel if available
              if (latestReading.zaaltDun > 0) {
                electricityDun = latestReading.zaaltDun;
              } else {
                // Recalculate if no zaaltDun stored
                if (readingTariff > 0) {
                  kwhTariff = readingTariff;
                }
                electricityDun = zoruu * kwhTariff + defaultDun;
              }
            } else {
              // For цахилгаан (кВт): do NOT show suuriKhuraamj when no Excel - match Excel behavior
              if (zoruu === 0) {
                continue;
              }
              // Fallback to zardal's suuriKhuraamj, zaaltDefaultDun, or tariff (for old data format)
              defaultDun =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              electricityDun = zoruu * kwhTariff + defaultDun;
            }

            // For calculated цахилгаан: do NOT show suuriKhuraamj alone when no Excel
            if (electricityDun === 0 && zoruu === 0) {
              const wouldUseSuuriKhuraamj =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              if (wouldUseSuuriKhuraamj > 0) {
                continue;
              }
            }
            // Final fallback: if electricityDun is still 0 but zardal has suuriKhuraamj, use that
            if (electricityDun === 0) {
              const fallbackDun =
                Number(zaaltZardal.suuriKhuraamj) ||
                zaaltZardal.zaaltDefaultDun ||
                zaaltZardal.tariff ||
                0;
              if (fallbackDun > 0) {
                electricityDun = fallbackDun;
                defaultDun = fallbackDun;
              }
            }
          }

          if (electricityDun > 0) {
            zardluudWithDun.push({
              ner: zaaltZardal.ner || "Цахилгаан",
              turul: zaaltZardal.turul || "Тогтмол",
              bodokhArga: "тогтмол",
              zardliinTurul: zaaltZardal.zardliinTurul || "Цахилгаан",
              tariff: electricityDun,
              tariffUsgeer: !isCalculatedType
                ? zaaltZardal.tariffUsgeer || "₮"
                : "₮",
              dun: electricityDun,
              zaalt: true,
              zaaltTariff: isCalculatedType ? kwhTariff : 0,
              zoruu: zoruu,
              suuriKhuraamj: defaultDun,
              ognoonuud: [],
            });
          }
        }
      }
    } catch (error) {
      // Error calculating electricity for preview - silently continue
    }

    // Calculate zardluudTotal BEFORE adding ekhniiUldegdel to match gereeNeesNekhemjlekhUusgekh logic
    const zardluudTotal = zardluudWithDun.reduce(
      (sum, zardal) => sum + (zardal.dun || 0),
      0,
    );

    // Always add ekhniiUldegdel row (even when 0) for display purposes
    zardluudWithDun.push({
      ner: "Эхний үлдэгдэл",
      turul: "Тогтмол",
      bodokhArga: "тогтмол",
      zardliinTurul: "Энгийн",
      tariff: ekhniiUldegdelAmount,
      tariffUsgeer: "₮",
      dun: ekhniiUldegdelAmount,
      zaalt: false,
      ognoonuud: [],
      nuatNemekhEsekh: false,
      nuatBodokhEsekh: false,
      tseverUsDun: 0,
      bokhirUsDun: 0,
      usKhalaasniiDun: 0,
      tsakhilgaanUrjver: 1,
      tsakhilgaanChadal: 0,
      tsakhilgaanDemjikh: 0,
      suuriKhuraamj: 0,
      togtmolUtga: 0,
      choloolugdsonDavkhar: false,
      isEkhniiUldegdel: true, // Flag to identify this row
      tailbar: ekhniiUldegdelTailbar || "", // Include the description from gereeniiTulukhAvlaga
    });

    let finalNiitTulbur = zardluudTotal + ekhniiUldegdelAmount;

    // Special discount for 2nd floor in specific organization: subtract 4,495.42
    // This applies only to 2nd floor (davkhar === "2" or 2) for org ID: 697c70e81e782d8110d3b064
    const davkharStr = geree.davkhar ? String(geree.davkhar).trim() : "";
    const isSecondFloor = davkharStr === "2" || davkharStr === 2 || Number(davkharStr) === 2;
    if (isSecondFloor && geree.baiguullagiinId) {
      const orgIdForSecondFloorDiscount = "697c70e81e782d8110d3b064";
      if (String(geree.baiguullagiinId).trim() === orgIdForSecondFloorDiscount) {
        const secondFloorDiscount = 4495.42;
        finalNiitTulbur = Math.max(0, finalNiitTulbur - secondFloorDiscount);
      }
    }

    let tulukhOgnoo = null;
    try {
      let cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: String(baiguullagiinId),
        barilgiinId: barilgiinId ? String(barilgiinId) : null,
      });

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: String(baiguullagiinId),
          barilgiinId: null,
        });
      }

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const today = new Date();
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo;
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear = currentYear + 1;
        }
        const lastDayOfNextMonth = new Date(
          nextYear,
          nextMonth + 1,
          0,
        ).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);
        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      // Error fetching cron schedule - silently continue
    }

    if (!tulukhOgnoo) {
      tulukhOgnoo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } },
        ],
      })
      .lean();

    const sohNer = targetBarilga?.tokhirgoo?.sohNer || "";
    const orgUtas = Array.isArray(baiguullaga?.utas)
      ? baiguullaga.utas[0]
      : baiguullaga?.utas || "";
    const dansInfo =
      [baiguullaga?.bankniiNer, baiguullaga?.dans].filter(Boolean).join(" ") ||
      "";

    return {
      success: true,
      preview: {
        gereeniiDugaar: geree.gereeniiDugaar,
        gereeniiId: geree._id,
        ner: geree.ner,
        ovog: geree.ovog,
        utas: geree.utas,
        davkhar: geree.davkhar,
        toot: geree.toot,
        orts: geree.orts,
        sohNer: sohNer || baiguullaga?.ner,
        baiguullagiinNer: baiguullaga?.ner,
        baiguullagiinUtas: orgUtas,
        baiguullagiinKhayag: baiguullaga?.khayag,
        dansniiMedeelel: dansInfo,
        zardluud: zardluudWithDun,
        zardluudTotal: zardluudTotal,
        ekhniiUldegdel: ekhniiUldegdelAmount,
        niitTulbur: finalNiitTulbur,
        tulukhOgnoo: tulukhOgnoo,
        ognoo: new Date(),
        existingInvoice: existingInvoice
          ? {
              _id: existingInvoice._id,
              nekhemjlekhiinDugaar: existingInvoice.nekhemjlekhiinDugaar,
              niitTulbur: existingInvoice.niitTulbur,
              tuluv: existingInvoice.tuluv,
              ognoo: existingInvoice.ognoo,
            }
          : null,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const manualSendInvoice = async (
  gereeId,
  baiguullagiinId,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");
    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const geree = await Geree(tukhainBaaziinKholbolt).findById(gereeId).lean();
    if (!geree) {
      return { success: false, error: "Гэрээ олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const currentDate =
      targetMonth !== null && targetYear !== null
        ? new Date(targetYear, targetMonth - 1, 1)
        : new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Check for ANY existing invoices (Paid or Unpaid) for this month to prevent duplicates
    const allExistingInvoices = await nekhemjlekhiinTuukh(
      tukhainBaaziinKholbolt,
    )
      .find({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } },
        ],
      })
      .sort({ createdAt: 1 });

    // Filter for PAID invoices (kept for potential logging/analytics)
    const paidInvoices = allExistingInvoices.filter(
      (inv) => inv.tuluv === "Төлсөн",
    );

    // Previously: if override=false and there was at least one PAID invoice for this month,
    // we blocked creating a new invoice with the message:
    // "Энэ сарын нэхэмжлэх төлөгдсөн байна. Дахин үүсгэх боломжгүй."
    // This prevented resending/creating invoices when a month was already fully paid.
    // Now we allow creating/sending again regardless of existing paid invoices.

    // Filter for UNSENT/UNPAID invoices for update logic
    const existingUnsentInvoices = allExistingInvoices.filter(
      (inv) => inv.tuluv === "Төлөөгүй" || inv.tuluv === "Хугацаа хэтэрсэн",
    );

    if (override) {
      // If override=true, delete ALL existing invoices for this month (old behavior)
      const allExistingInvoices = await nekhemjlekhiinTuukh(
        tukhainBaaziinKholbolt,
      ).find({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } },
        ],
      });

      for (const invoice of allExistingInvoices) {
        await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
          _id: invoice._id,
        });
      }
    } else if (existingUnsentInvoices.length > 0) {
      // If override=false but there are unsent invoices, check if we need to update
      const oldestUnsentInvoice = existingUnsentInvoices[0];

      // Check if this invoice has any payments (paymentHistory or partial payment)
      const hasPayments =
        (oldestUnsentInvoice.paymentHistory &&
          oldestUnsentInvoice.paymentHistory.length > 0) ||
        (oldestUnsentInvoice.uldegdel !== oldestUnsentInvoice.niitTulbur &&
          oldestUnsentInvoice.uldegdel < oldestUnsentInvoice.niitTulbur);

      // SMART UPDATE CHECK: Calculate what the new invoice WOULD look like
      // NOTE: previewInvoice includes ekhniiUldegdel, but we DON'T want to include it in manual send
      const previewResult = await previewInvoice(
        gereeId,
        baiguullagiinId,
        null,
        targetMonth,
        targetYear,
      );

      if (previewResult.success) {
        // Calculate the "zardluud only" total (excluding ekhniiUldegdel) for comparison
        const previewZardluud = previewResult.preview.zardluud || [];
        const zardluudOnlyTotal = previewZardluud
          .filter(
            (z) =>
              !z.isEkhniiUldegdel &&
              z.ner !== "Эхний үлдэгдэл" &&
              !(z.ner && z.ner.includes("Эхний үлдэгдэл")),
          )
          .reduce((sum, z) => sum + (z.dun || z.tariff || 0), 0);

        // Get the old invoice's zardluud total (excluding ekhniiUldegdel)
        const oldZardluud = oldestUnsentInvoice.medeelel?.zardluud || [];
        const oldZardluudOnlyTotal = oldZardluud
          .filter(
            (z) =>
              !z.isEkhniiUldegdel &&
              z.ner !== "Эхний үлдэгдэл" &&
              !(z.ner && z.ner.includes("Эхний үлдэгдэл")),
          )
          .reduce((sum, z) => sum + (z.dun || z.tariff || 0), 0);

        const newZardluudCount = previewZardluud.filter(
          (z) =>
            !z.isEkhniiUldegdel &&
            z.ner !== "Эхний үлдэгдэл" &&
            !(z.ner && z.ner.includes("Эхний үлдэгдэл")),
        ).length;
        const oldZardluudCount = oldZardluud.filter(
          (z) =>
            !z.isEkhniiUldegdel &&
            z.ner !== "Эхний үлдэгдэл" &&
            !(z.ner && z.ner.includes("Эхний үлдэгдэл")),
        ).length;

        // Check if 2nd floor discount should apply for org 697c70e81e782d8110d3b064
        const skipDavkharStr = geree.davkhar ? String(geree.davkhar).trim() : "";
        const skipIsSecondFloor = skipDavkharStr === "2" || Number(skipDavkharStr) === 2;
        const skipOrgId = "697c70e81e782d8110d3b064";
        const skipOrgMatches = geree.baiguullagiinId && String(geree.baiguullagiinId).trim() === skipOrgId;
        const shouldApply2ndFloorDiscount = skipIsSecondFloor && skipOrgMatches;
        const secondFloorDiscountAmount = 4495.42;

        // If zardluud amounts are effectively equal and item counts match, skip update entirely
        // This preserves the existing invoice with its uldegdel intact
        // BUT: if 2nd floor discount should apply and hasn't been applied yet, force the update
        const discountAlreadyApplied = shouldApply2ndFloorDiscount && 
          Math.abs(oldestUnsentInvoice.niitTulbur - (oldZardluudOnlyTotal - secondFloorDiscountAmount)) < 1;
        const discountNeedsApplying = shouldApply2ndFloorDiscount && !discountAlreadyApplied;

        if (
          Math.abs(zardluudOnlyTotal - oldZardluudOnlyTotal) < 0.5 &&
          newZardluudCount === oldZardluudCount &&
          !discountNeedsApplying
        ) {
          // Still delete any DUPLICATE unsent invoices for this month
          if (existingUnsentInvoices.length > 1) {
            for (let i = 1; i < existingUnsentInvoices.length; i++) {
              const duplicateInvoice = existingUnsentInvoices[i];
              const duplicateHasPayments =
                (duplicateInvoice.paymentHistory &&
                  duplicateInvoice.paymentHistory.length > 0) ||
                (duplicateInvoice.uldegdel !== duplicateInvoice.niitTulbur &&
                  duplicateInvoice.uldegdel < duplicateInvoice.niitTulbur);
              if (!duplicateHasPayments) {
                await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
                  _id: duplicateInvoice._id,
                });
              }
            }
          }

          return {
            success: true,
            message: "Нэхэмжлэх хэвийн байна. Өөрчлөлт ороогүй.",
            skipped: true,
            nekhemjlekh: oldestUnsentInvoice,
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            tulbur: oldestUnsentInvoice.niitTulbur,
          };
        }

        // ALWAYS update in place to preserve uldegdel and payment history
        // Filter out ekhniiUldegdel from the new zardluud since we don't want to add it via manual send
        const newZardluudWithoutEkhniiUldegdel = previewZardluud.filter(
          (z) =>
            !z.isEkhniiUldegdel &&
            z.ner !== "Эхний үлдэгдэл" &&
            !(z.ner && z.ner.includes("Эхний үлдэгдэл")),
        );

        // Preserve ekhniiUldegdel entries from the old invoice (if any)
        const oldEkhniiUldegdelEntries = oldZardluud.filter(
          (z) =>
            z.isEkhniiUldegdel ||
            z.ner === "Эхний үлдэгдэл" ||
            (z.ner && z.ner.includes("Эхний үлдэгдэл")),
        );

        // Combine: new zardluud (without ekhniiUldegdel) + preserved ekhniiUldegdel from old invoice
        const updatedZardluud = [
          ...newZardluudWithoutEkhniiUldegdel,
          ...oldEkhniiUldegdelEntries,
        ];

        // Calculate new total (zardluud only, ekhniiUldegdel stays separate)
        let newNiitTulbur = updatedZardluud.reduce(
          (sum, z) => sum + (z.dun || z.tariff || 0),
          0,
        );

        // Apply 2nd floor discount for org 697c70e81e782d8110d3b064
        if (shouldApply2ndFloorDiscount) {
          newNiitTulbur = Math.max(0, newNiitTulbur - secondFloorDiscountAmount);
          console.log(`[2ND FLOOR DISCOUNT] manualSend update path: Applied discount of ${secondFloorDiscountAmount}. New total: ${newNiitTulbur}`);
        }

        // Update the existing invoice
        // IMPORTANT: Create a new medeelel object to ensure Mongoose detects the change
        oldestUnsentInvoice.medeelel = {
          ...(oldestUnsentInvoice.medeelel.toObject
            ? oldestUnsentInvoice.medeelel.toObject()
            : oldestUnsentInvoice.medeelel),
          zardluud: updatedZardluud,
        };
        oldestUnsentInvoice.niitTulbur = newNiitTulbur;

        // Recalculate uldegdel: preserve existing uldegdel ratio or recalculate based on payments
        const totalPaid = (oldestUnsentInvoice.paymentHistory || []).reduce(
          (sum, p) => sum + (p.dun || 0),
          0,
        );
        if (totalPaid > 0) {
          // If there were payments, recalculate uldegdel
          oldestUnsentInvoice.uldegdel = Math.max(0, newNiitTulbur - totalPaid);
        } else {
          // No payments - keep uldegdel = niitTulbur (full amount due)
          oldestUnsentInvoice.uldegdel = newNiitTulbur;
        }

        // Update zaalt metadata if available
        const zaaltEntry = newZardluudWithoutEkhniiUldegdel.find(
          (z) =>
            z.zaalt === true &&
            z.ner?.toLowerCase().includes("цахилгаан") &&
            !z.ner?.toLowerCase().includes("дундын"),
        );
        if (zaaltEntry) {
          oldestUnsentInvoice.medeelel = {
            ...(oldestUnsentInvoice.medeelel.toObject
              ? oldestUnsentInvoice.medeelel.toObject()
              : oldestUnsentInvoice.medeelel),
            zaalt: {
              ...(oldestUnsentInvoice.medeelel.zaalt || {}),
              zoruu: zaaltEntry.zoruu || 0,
              zaaltDun: zaaltEntry.dun || zaaltEntry.tariff || 0,
            },
          };
          oldestUnsentInvoice.tsahilgaanNekhemjlekh =
            zaaltEntry.dun ||
            zaaltEntry.tariff ||
            oldestUnsentInvoice.tsahilgaanNekhemjlekh;
        }

        // Mark medeelel as modified to ensure Mongoose saves the changes
        oldestUnsentInvoice.markModified("medeelel");

        await oldestUnsentInvoice.save();

        // Update Geree.globalUldegdel by delta (new - old) so home/nekhemjlekh show correct total
        const oldNiitTulbur = (oldZardluud || []).reduce(
          (s, z) => s + (z.dun || z.tariff || 0),
          0,
        );
        const delta = newNiitTulbur - oldNiitTulbur;
        if (Math.abs(delta) > 0.01) {
          try {
            await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
              gereeId,
              { $inc: { globalUldegdel: delta } },
              { runValidators: false },
            );
          } catch (gereeErr) {
            // Error updating geree.globalUldegdel - silently continue
          }
        }

        // Delete any DUPLICATE unsent invoices for this month (keep only the one we just updated)
        if (existingUnsentInvoices.length > 1) {
          for (let i = 1; i < existingUnsentInvoices.length; i++) {
            const duplicateInvoice = existingUnsentInvoices[i];
            // Check if this duplicate has payments
            const duplicateHasPayments =
              (duplicateInvoice.paymentHistory &&
                duplicateInvoice.paymentHistory.length > 0) ||
              (duplicateInvoice.uldegdel !== duplicateInvoice.niitTulbur &&
                duplicateInvoice.uldegdel < duplicateInvoice.niitTulbur);
            if (!duplicateHasPayments) {
              await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({
                _id: duplicateInvoice._id,
              });
            }
          }
        }

        // Send socket notification so home header refreshes balance
        if (app && geree.orshinSuugchId) {
          try {
            const kholbolt = db.kholboltuud.find(
              (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
            );
            if (kholbolt) {
              const medegdel = new Medegdel(kholbolt)();
              medegdel.orshinSuugchId = geree.orshinSuugchId;
              medegdel.baiguullagiinId = baiguullagiinId;
              medegdel.barilgiinId = geree.barilgiinId || "";
              medegdel.title = "Шинэ авлага нэмэгдлээ";
              medegdel.message = `Гэрээний дугаар: ${geree.gereeniiDugaar || "N/A"}, Нийт төлбөр: ${newNiitTulbur}₮`;
              medegdel.kharsanEsekh = false;
              medegdel.turul = "мэдэгдэл";
              medegdel.ognoo = new Date();
              await medegdel.save();
              const io = app.get("socketio");
              if (io)
                io.emit(
                  "orshinSuugch" + geree.orshinSuugchId,
                  medegdel.toObject ? medegdel.toObject() : medegdel,
                );
            }
          } catch (notifErr) {
            // Error sending socket notification - silently continue
          }
        }

        return {
          success: true,
          nekhemjlekh: oldestUnsentInvoice,
          gereeniiId: geree._id,
          gereeniiDugaar: geree.gereeniiDugaar,
          tulbur: newNiitTulbur,
          alreadyExists: true,
          updated: true,
          preservedPayments: hasPayments,
        };
      }

      // If preview failed, just return the existing invoice without changes
      return {
        success: true,
        nekhemjlekh: oldestUnsentInvoice,
        gereeniiId: geree._id,
        gereeniiDugaar: geree.gereeniiDugaar,
        tulbur: oldestUnsentInvoice.niitTulbur,
        alreadyExists: true,
      };
    }

    const gereeObj = geree.toObject ? geree.toObject() : geree;
    // IMPORTANT: Pass includeEkhniiUldegdel = false to prevent manual send from adding ekhniiUldegdel
    // ekhniiUldegdel should ONLY come from Excel import or TransactionModal
    const result = await gereeNeesNekhemjlekhUusgekh(
      gereeObj,
      baiguullaga,
      tukhainBaaziinKholbolt,
      "manual",
      false, // skipDuplicateCheck = false → NEVER create a new invoice when a monthly invoice already exists (even if paid)
      false, // includeEkhniiUldegdel = false - DON'T include ekhniiUldegdel on manual send
    );

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const manualSendMassInvoices = async (
  baiguullagiinId,
  barilgiinId = null,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const gereeQuery = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: "Идэвхтэй",
    };

    if (barilgiinId) {
      gereeQuery.barilgiinId = String(barilgiinId);
    }

    const gerees = await Geree(tukhainBaaziinKholbolt).find(gereeQuery).lean();

    const results = {
      success: true,
      total: gerees.length,
      created: 0,
      errors: 0,
      invoices: [],
      errorsList: [],
    };

    for (let i = 0; i < gerees.length; i++) {
      const geree = gerees[i];
      try {
        const gereeObj = geree.toObject ? geree.toObject() : geree;
        const invoiceResult = await manualSendInvoice(
          geree._id,
          baiguullagiinId,
          override,
          targetMonth,
          targetYear,
          app,
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId:
              invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
          });
        } else {
          results.errors++;
          results.errorsList.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            error: invoiceResult.error || "Unknown error",
          });
        }
      } catch (error) {
        results.errors++;
        results.errorsList.push({
          gereeniiDugaar: geree.gereeniiDugaar,
          error: error.message || "Unknown error",
        });
      }
    }

    return results;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Manual send invoices for selected/checked contracts
// Accepts array of gereeIds (can be one or many)
const manualSendSelectedInvoices = async (
  gereeIds,
  baiguullagiinId,
  override = false,
  targetMonth = null,
  targetYear = null,
  app = null,
) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");

    // Validate input
    if (!Array.isArray(gereeIds) || gereeIds.length === 0) {
      return {
        success: false,
        error: "gereeIds нь хоосон биш массив байх ёстой!",
      };
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(baiguullagiinId)
      .lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    // Fetch all selected contracts
    const gerees = await Geree(tukhainBaaziinKholbolt)
      .find({
        _id: { $in: gereeIds },
        baiguullagiinId: String(baiguullagiinId),
      })
      .lean();

    if (gerees.length === 0) {
      return { success: false, error: "Сонгосон гэрээ олдсонгүй!" };
    }

    const results = {
      success: true,
      total: gereeIds.length,
      processed: gerees.length,
      created: 0,
      errors: 0,
      invoices: [],
      errorsList: [],
    };

    // Process each checked contract
    for (let i = 0; i < gerees.length; i++) {
      const geree = gerees[i];
      try {
        const invoiceResult = await manualSendInvoice(
          geree._id,
          baiguullagiinId,
          override,
          targetMonth,
          targetYear,
          app,
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId:
              invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
          });
        } else {
          results.errors++;
          results.errorsList.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            error: invoiceResult.error || "Unknown error",
          });
        }
      } catch (error) {
        results.errors++;
        results.errorsList.push({
          gereeniiId: geree._id,
          gereeniiDugaar: geree.gereeniiDugaar,
          error: error.message || "Unknown error",
        });
      }
    }

    return results;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const deleteInvoiceZardal = asyncHandler(async (req, res, next) => {
  const { invoiceId, zardalId, baiguullagiinId } = req.body;

  if (!invoiceId || !zardalId || !baiguullagiinId) {
    return res.status(400).json({
      success: false,
      error: "invoiceId, zardalId, and baiguullagiinId are required",
    });
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
  );

  if (!kholbolt) {
    return res
      .status(404)
      .json({ success: false, error: "Холболтын мэдээлэл олдсонгүй!" });
  }

  const NekhemjlekhModel = nekhemjlekhiinTuukh(kholbolt);
  const GereeModel = Geree(kholbolt);

  const invoice = await NekhemjlekhModel.findById(invoiceId);
  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, error: "Нэхэмжлэх олдсонгүй!" });
  }

  if (!invoice.medeelel || !Array.isArray(invoice.medeelel.zardluud)) {
    return res
      .status(400)
      .json({ success: false, error: "Энэ нэхэмжлэхэд зардал олдсонгүй!" });
  }

  const zardluud = Array.isArray(invoice.medeelel?.zardluud)
    ? invoice.medeelel.zardluud
    : [];
  const guilgeenuud = Array.isArray(invoice.medeelel?.guilgeenuud)
    ? invoice.medeelel.guilgeenuud
    : [];

  let deletedAmount = 0;
  let pullPath = "";

  const zardalIndex = zardluud.findIndex(
    (z) => String(z._id) === String(zardalId),
  );
  const guilgeeIndex = guilgeenuud.findIndex(
    (g) => String(g._id) === String(zardalId),
  );

  if (zardalIndex !== -1) {
    const deletedZardal = zardluud[zardalIndex];
    deletedAmount = Number(
      deletedZardal.dun || deletedZardal.tariff || deletedZardal.tulukhDun || 0,
    );
    pullPath = "medeelel.zardluud";
  } else if (guilgeeIndex !== -1) {
    const deletedGuilgee = guilgeenuud[guilgeeIndex];
    // If it was a charge, decrement total. If it was a payment, increment total.
    const charge = Number(deletedGuilgee.tulukhDun || 0);
    const payment = Number(deletedGuilgee.tulsunDun || 0);
    deletedAmount = charge - payment;
    pullPath = "medeelel.guilgeenuud";
  } else {
    return res.status(404).json({
      success: false,
      error: "Зардал эсвэл гүйлгээ олдсонгүй (ID mismatch)!",
    });
  }

  const mongoose = require("mongoose");
  const updateQuery = {
    $pull: {
      [pullPath]: {
        _id: mongoose.Types.ObjectId.isValid(zardalId)
          ? new mongoose.Types.ObjectId(zardalId)
          : zardalId,
      },
    },
    $inc: { niitTulbur: -deletedAmount },
  };

  await NekhemjlekhModel.findByIdAndUpdate(invoiceId, updateQuery);

  if (invoice.gereeniiId && deletedAmount !== 0) {
    await GereeModel.findByIdAndUpdate(invoice.gereeniiId, {
      $inc: { globalUldegdel: -deletedAmount },
    });
  }

  const updatedInvoice = await NekhemjlekhModel.findById(invoiceId);
  if (updatedInvoice && updatedInvoice.niitTulbur <= 0) {
    updatedInvoice.tuluv = "Төлсөн";
    await updatedInvoice.save();
  }

  const io = req.app?.get("socketio");
  if (io && baiguullagiinId) {
    io.emit(`tulburUpdated:${baiguullagiinId}`, {});
  }

  res.json({
    success: true,
    message: "Зардал амжилттай устгагдлаа",
    newTotal: updatedInvoice?.niitTulbur || 0,
  });
});

const recalculateGereeBalance = asyncHandler(async (req, res) => {
  const { gereeId, baiguullagiinId } = req.body;

  if (!gereeId || !baiguullagiinId) {
    return res.status(400).json({
      success: false,
      message: "gereeId and baiguullagiinId are required",
    });
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
  );

  if (!kholbolt) {
    return res
      .status(404)
      .json({ success: false, message: "Connection not found" });
  }

  const NekhemjlekhiinTuukhModel = nekhemjlekhiinTuukh(kholbolt);
  const GereeModel = Geree(kholbolt);
  const TulsunModel = GereeniiTulsunAvlaga(kholbolt);

  // 1. Sum up all unpaid invoice amounts (uldegdel)
  const unpaidInvoices = await NekhemjlekhiinTuukhModel.find({
    gereeniiId: String(gereeId),
    baiguullagiinId: String(baiguullagiinId),
    tuluv: { $ne: "Төлсөн" },
  })
    .select("uldegdel niitTulbur")
    .lean();

  let totalUnpaid = 0;
  unpaidInvoices.forEach((inv) => {
    totalUnpaid += inv.uldegdel ?? inv.niitTulbur ?? 0;
  });

  // 2. Sum up all unapplied payments (prepayments)
  // These are payments that are NOT linked to any specific invoice
  const unappliedPayments = await TulsunModel.find({
    gereeniiId: String(gereeId),
    baiguullagiinId: String(baiguullagiinId),
    $or: [
      { nekhemjlekhId: { $exists: false } },
      { nekhemjlekhId: "" },
      { nekhemjlekhId: null },
    ],
  })
    .select("tulsunDun")
    .lean();

  let totalPrepayments = 0;
  unappliedPayments.forEach((p) => {
    totalPrepayments += p.tulsunDun || 0;
  });

  // 3. Final Global Balance = Total Unpaid - Total Prepayments
  const finalGlobalUldegdel = totalUnpaid - totalPrepayments;

  // 4. Update the Geree document
  const updatedGeree = await GereeModel.findByIdAndUpdate(
    gereeId,
    {
      $set: {
        globalUldegdel: finalGlobalUldegdel,
        positiveBalance: totalPrepayments,
      },
    },
    { new: true },
  );

  res.json({
    success: true,
    message: "Balance recalculated successfully",
    data: {
      globalUldegdel: finalGlobalUldegdel,
      positiveBalance: totalPrepayments,
    },
  });
});

module.exports = {
  gereeNeesNekhemjlekhUusgekh,
  gereeNeesNekhemjlekhUusgekhPreviousMonth,
  updateGereeAndNekhemjlekhFromZardluud,
  markInvoicesAsPaid,
  previewInvoice,
  manualSendInvoice,
  manualSendMassInvoices,
  manualSendSelectedInvoices,
  deleteInvoiceZardal,
  recalculateGereeBalance,
};
