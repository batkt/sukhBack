const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const NekhemjlekhCron = require("../models/cronSchedule");
const OrshinSuugch = require("../models/orshinSuugch");
const MsgTuukh = require("../models/msgTuukh");
const Medegdel = require("../models/medegdel");
const request = require("request");
const { db } = require("zevbackv2");
const asyncHandler = require("express-async-handler");

function normalizeTurul(turul) {
  if (!turul || typeof turul !== 'string') {
    return turul;
  }
  if (turul.toLowerCase() === 'тогтмол') {
    return 'Тогтмол';
  }
  return turul;
}


function normalizeZardluudTurul(zardluud) {
  if (!Array.isArray(zardluud)) {
    return zardluud;
  }
  return zardluud.map(zardal => {
    if (zardal && typeof zardal === 'object') {
      return {
        ...zardal,
        turul: normalizeTurul(zardal.turul)
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
    if (!zardal || typeof zardal !== 'object') {
      continue;
    }

    const normalizedTurul = normalizeTurul(zardal.turul);
    const key = `${zardal.ner || ''}|${normalizedTurul || ''}|${zardal.zardliinTurul || ''}|${zardal.barilgiinId || ''}`;

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
  includeEkhniiUldegdel = true // New flag to control ekhniiUldegdel inclusion
) => {
  try {
    console.log("Энэ рүү орлоо: gereeNeesNekhemjlekhUusgekh");

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11 (0 = January)

    let shouldUseEkhniiUldegdel = false;
    const NekhemjlekhCron = require("../models/cronSchedule");

    try {
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
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
          0
        );

        const existingEkhniiUldegdelInvoices = await nekhemjlekhiinTuukh(
          tukhainBaaziinKholbolt
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
      console.error("Error checking ekhniiUldegdel:", error.message);
    }

    if (!shouldUseEkhniiUldegdel && !skipDuplicateCheck) {
      const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      const monthEnd = new Date(
        currentYear,
        currentMonth + 1,
        0,
        23,
        59,
        59,
        999
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
        console.log(
          `ℹ️  Invoice already exists for contract ${tempData.gereeniiDugaar} in current month:`,
          existingInvoice._id
        );

        return {
          success: true,
          nekhemjlekh: existingInvoice,
          gereeniiId: tempData._id,
          gereeniiDugaar: tempData.gereeniiDugaar,
          tulbur: existingInvoice.niitTulbur,
          alreadyExists: true,
        };
      }
    } else {
      console.log(
        `ℹ️  Skipping duplicate check - using ekhniiUldegdel for first invoice (contract ${tempData.gereeniiDugaar})`
      );
    }

    const tuukh = new nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)();

    let dansInfo = { dugaar: "", dansniiNer: "", bank: "", ibanDugaar: "" };
    try {
      const { db } = require("zevbackv2");
      const { Dans } = require("zevbackv2");

      let barilgaDans = null;
      if (tempData.barilgiinId && org?.barilguud) {
        const targetBarilga = org.barilguud.find(
          (b) => String(b._id) === String(tempData.barilgiinId)
        );
        if (targetBarilga?.tokhirgoo?.dans) {
          barilgaDans = targetBarilga.tokhirgoo.dans;
          dansInfo = {
            dugaar: barilgaDans.dugaar || "",
            dansniiNer: barilgaDans.dansniiNer || "",
            bank: barilgaDans.bank || "",
            ibanDugaar: barilgaDans.ibanDugaar || "",
          };
          console.log(
            `✅ Using barilga-specific dans: ${dansInfo.dugaar} for barilga ${tempData.barilgiinId}`
          );
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
                String(salbar.salbariinId) === String(tempData.barilgiinId)
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
              console.log(
                `✅ Using QpayKhariltsagch bank account for barilga ${tempData.barilgiinId}: ${dansInfo.dugaar} (${dansInfo.dansniiNer})`
              );
            }
          }
        } catch (qpayError) {
          console.error("Error fetching QpayKhariltsagch:", qpayError);
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
          console.log(`✅ Using Dans model dans: ${dansInfo.dugaar}`);
        }
      }
    } catch (dansError) {
      console.error("Error fetching dans info:", dansError);
    }

    // Get fresh geree data to check for positiveBalance
    let gereePositiveBalance = 0;
    try {
      const freshGeree = await Geree(tukhainBaaziinKholbolt).findById(tempData._id).select("positiveBalance").lean();
      if (freshGeree && freshGeree.positiveBalance) {
        gereePositiveBalance = freshGeree.positiveBalance;
        console.log(`💰 [INVOICE] Found positiveBalance in geree: ${gereePositiveBalance}₮`);
      }
    } catch (error) {
      console.error("Error fetching geree positiveBalance:", error);
    }

    // Гэрээний мэдээллийг нэхэмжлэх рүү хуулах
    tuukh.baiguullagiinNer = tempData.baiguullagiinNer || org.ner;
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
          console.error(
            "Error fetching baiguullaga for barilgiinId:",
            err.message
          );
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
    tuukh.uldegdel = tempData.globalUldegdel || tempData.baritsaaniiUldegdel || 0;
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
    tuukh.maililgeesenAjiltniiNer =
      tempData.maililgeesenAjiltniiNer || tempData.ner;
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
        console.error(`❌ [INVOICE] Error fetching ekhniiUldegdel for invoice:`, error.message);
      }
    }

    tuukh.ekhniiUldegdel = ekhniiUldegdelForInvoice;
    console.log(`💰 [INVOICE] ekhniiUldegdel saved to invoice: ${tuukh.ekhniiUldegdel} (includeEkhniiUldegdel: ${includeEkhniiUldegdel})`);

    if (includeEkhniiUldegdel && tempData.ekhniiUldegdelUsgeer !== undefined) {
      tuukh.ekhniiUldegdelUsgeer = tempData.ekhniiUldegdelUsgeer;
      console.log(
        "💰 [INVOICE] ekhniiUldegdelUsgeer saved:",
        tuukh.ekhniiUldegdelUsgeer
      );
    }

    let filteredZardluud = [];

    try {
      const { db } = require("zevbackv2");
      const Baiguullaga = require("../models/baiguullaga");
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        tempData.baiguullagiinId
      );

      const targetBarilga = baiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(tempData.barilgiinId || "")
      );

      const ashiglaltiinZardluud = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];

      filteredZardluud = ashiglaltiinZardluud
        .filter(zardal => zardal.zaalt !== true)
        .map(zardal => {
          const dun = (zardal.dun > 0) ? zardal.dun : (zardal.tariff || 0);
          return {
            ...zardal,
            dun: dun,
          };
        });
    } catch (error) {
      console.error("Error fetching ashiglaltiinZardluud:", error.message);
      filteredZardluud = (tempData.zardluud || []).map(zardal => ({
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
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        tempData.baiguullagiinId
      ).lean();

      const targetBarilga = baiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(tempData.barilgiinId || "")
      );

      choloolugdokhDavkhar = targetBarilga?.tokhirgoo?.liftShalgaya?.choloolugdokhDavkhar || [];

      console.log(`🔍 [LIFT] Initial check - Floor: ${tempData.davkhar}, Exempted from baiguullaga:`, choloolugdokhDavkhar);
      console.log(`🔍 [LIFT] Full targetBarilga.tokhirgoo.liftShalgaya:`, JSON.stringify(targetBarilga?.tokhirgoo?.liftShalgaya, null, 2));

      liftZardalFromBuilding = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud?.find(z => z.zardliinTurul === "Лифт" || (z.ner && z.ner.includes("Лифт")));
      if (liftZardalFromBuilding) {
        liftTariff = liftZardalFromBuilding.tariff || liftZardalFromBuilding.dun;
        console.log(`🔍 [LIFT] Found lift zardal from building:`, { ner: liftZardalFromBuilding.ner, zardliinTurul: liftZardalFromBuilding.zardliinTurul, tariff: liftZardalFromBuilding.tariff, dun: liftZardalFromBuilding.dun, liftTariff: liftTariff });
      } else {
        console.warn(`⚠️ [LIFT] No lift zardal found in building's ashiglaltiinZardluud`);
      }

      if (choloolugdokhDavkhar.length === 0 && tempData.barilgiinId) {
        try {
          const LiftShalgaya = require("../models/liftShalgaya");
          const liftShalgayaRecord = await LiftShalgaya(tukhainBaaziinKholbolt).findOne({
            baiguullagiinId: String(tempData.baiguullagiinId),
            barilgiinId: String(tempData.barilgiinId)
          }).lean();

          console.log(`🔍 [LIFT] Checking liftShalgaya collection:`, liftShalgayaRecord);

          if (liftShalgayaRecord?.choloolugdokhDavkhar && liftShalgayaRecord.choloolugdokhDavkhar.length > 0) {
            choloolugdokhDavkhar = liftShalgayaRecord.choloolugdokhDavkhar;
            console.log(`✅ [LIFT] Found in collection, syncing to baiguullaga:`, choloolugdokhDavkhar);

            if (targetBarilga) {
              try {
                if (!targetBarilga.tokhirgoo) {
                  targetBarilga.tokhirgoo = {};
                }
                if (!targetBarilga.tokhirgoo.liftShalgaya) {
                  targetBarilga.tokhirgoo.liftShalgaya = {};
                }
                targetBarilga.tokhirgoo.liftShalgaya.choloolugdokhDavkhar = choloolugdokhDavkhar;
                await baiguullaga.save({ validateBeforeSave: false });
                console.log(`✅ [LIFT] Synced to baiguullaga`);
              } catch (saveError) {
                console.error("❌ [LIFT] Error syncing to baiguullaga (non-critical, continuing):", saveError.message);
              }
            }
          }
        } catch (error) {
          console.error("❌ [LIFT] Error fetching liftShalgaya:", error.message);
        }
      }

      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map(d => String(d));

      console.log(`🔍 [LIFT] Checking floor exemption - Floor: ${davkharStr}, Exempted floors: [${choloolugdokhDavkharStr.join(', ')}]`);

      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        console.log(`🚫 [LIFT] Floor ${davkharStr} is exempted - Removing Лифт charge`);
        filteredZardluud = filteredZardluud.filter(
          (zardal) =>
            zardal.zardliinTurul !== "Лифт" &&
            !(zardal.ner && zardal.ner.trim() === "Лифт") &&
            !(zardal.ner && zardal.ner.includes("Лифт"))
        );
        console.log(`✅ [LIFT] Лифт charge removed. Remaining charges: ${filteredZardluud.length}`);
      } else {
        console.log(`✅ [LIFT] Floor ${davkharStr} is NOT exempted - Keeping Лифт charge`);
      }
    }

    let tulukhOgnoo = null;
    try {
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }

      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
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
          0
        ).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);

        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      console.error("Error fetching nekhemjlekhCron schedule:", error.message);
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
      console.error("Error fetching guilgeenuudForNekhemjlekh:", error);
    }

    const guilgeenuudTotal = guilgeenuudForNekhemjlekh.reduce(
      (sum, guilgee) => {
        return sum + (guilgee.tulukhDun || 0);
      },
      0
    );

    const isAvlagaOnlyInvoice =
      skipDuplicateCheck && guilgeenuudForNekhemjlekh.length > 0;

    let finalZardluud = isAvlagaOnlyInvoice ? [] : [...filteredZardluud];

    const zardluudTotal = isAvlagaOnlyInvoice
      ? 0
      : filteredZardluud.reduce((sum, zardal) => {
        return sum + (zardal.dun || 0);
      }, 0);

    let ekhniiUldegdelFromOrshinSuugch = 0;
    // Only fetch and include ekhniiUldegdel if the flag is true (checkbox checked)
    if (includeEkhniiUldegdel && tempData.orshinSuugchId) {
      try {
        const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
          .findById(tempData.orshinSuugchId)
          .select("ekhniiUldegdel")
          .lean();
        if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
          ekhniiUldegdelFromOrshinSuugch = orshinSuugch.ekhniiUldegdel;
          console.log(`💰 [INVOICE] ekhniiUldegdel from orshinSuugch: ${ekhniiUldegdelFromOrshinSuugch}`);
        }
      } catch (error) {
        console.error(`❌ [INVOICE] Error fetching ekhniiUldegdel from orshinSuugch:`, error.message);
      }
    } else if (!includeEkhniiUldegdel) {
      console.log(`ℹ️ [INVOICE] Skipping ekhniiUldegdel - checkbox not checked`);
    }

    const hasEkhniiUldegdel = includeEkhniiUldegdel && ekhniiUldegdelFromOrshinSuugch > 0;
    const ekhniiUldegdelAmount = includeEkhniiUldegdel ? ekhniiUldegdelFromOrshinSuugch : 0;

    let updatedZardluudTotal = isAvlagaOnlyInvoice
      ? 0
      : finalZardluud.reduce((sum, zardal) => {
        return sum + (zardal.dun || 0);
      }, 0);

    let finalNiitTulbur = updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

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

    // TEMPORARILY DISABLED: Electricity processing
    if (false && tempData.barilgiinId && tempData.baiguullagiinId && tempData.orshinSuugchId) {
      try {
        const { db } = require("zevbackv2");
        const Baiguullaga = require("../models/baiguullaga");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
          tempData.baiguullagiinId
        );
        const targetBarilga = baiguullaga?.barilguud?.find(
          (b) => String(b._id) === String(tempData.barilgiinId)
        );
        const gereeZaaltZardluud = (tempData.zardluud || []).filter((z) => z.zaalt === true);

        const zardluud = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];
        const zaaltZardluud = zardluud.filter((z) => z.zaalt === true);

        console.log("⚡ [INVOICE] Electricity zardals check:", {
          gereeniiDugaar: tempData.gereeniiDugaar,
          totalZardluud: (tempData.zardluud || []).length,
          gereeZaaltZardluudCount: gereeZaaltZardluud.length,
          buildingZaaltZardluudCount: zaaltZardluud.length,
          gereeZaaltZardluud: gereeZaaltZardluud.map(z => ({ ner: z.ner, zardliinTurul: z.zardliinTurul, tariff: z.tariff, dun: z.dun })),
          hasReadings: !!(tempData.umnukhZaalt !== undefined || tempData.suuliinZaalt !== undefined)
        });

        if (gereeZaaltZardluud.length > 0 || (zaaltZardluud.length > 0 && (tempData.umnukhZaalt !== undefined || tempData.suuliinZaalt !== undefined))) {
          const zaaltZardluudToProcess = gereeZaaltZardluud.length > 0
            ? gereeZaaltZardluud
            : zaaltZardluud;
          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(
            tempData.orshinSuugchId
          ).select("tsahilgaaniiZaalt").lean();

          const zaaltTariff = orshinSuugch?.tsahilgaaniiZaalt || 0;

          const umnukhZaalt = tempData.umnukhZaalt ?? zaaltZardluudToProcess[0]?.umnukhZaalt ?? 0;
          const suuliinZaalt = tempData.suuliinZaalt ?? zaaltZardluudToProcess[0]?.suuliinZaalt ?? 0;

          const zoruu = suuliinZaalt - umnukhZaalt;

          console.log("⚡ [INVOICE] Electricity readings check:", {
            gereeniiDugaar: tempData.gereeniiDugaar,
            tempData_umnukhZaalt: tempData.umnukhZaalt,
            tempData_suuliinZaalt: tempData.suuliinZaalt,
            zardal_umnukhZaalt: zaaltZardluudToProcess[0]?.umnukhZaalt,
            zardal_suuliinZaalt: zaaltZardluudToProcess[0]?.suuliinZaalt,
            final_umnukhZaalt: umnukhZaalt,
            final_suuliinZaalt: suuliinZaalt,
            zoruu: zoruu,
            hasReadings: !!(umnukhZaalt || suuliinZaalt)
          });

          const electricityEntries = [];
          let totalTsahilgaanNekhemjlekh = 0;

          for (const gereeZaaltZardal of zaaltZardluudToProcess) {
            let zaaltDefaultDun = 0;

            try {
              const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
              const gereeniiId = tempData._id?.toString() || tempData.gereeniiId || tempData._id;
              const gereeniiDugaar = tempData.gereeniiDugaar;

              let latestReading = null;
              if (gereeniiId) {
                latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                  .findOne({ gereeniiId: gereeniiId })
                  .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1, unshlaltiinOgnoo: -1 })
                  .lean();
              }

              if (!latestReading && gereeniiDugaar) {
                latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                  .findOne({ gereeniiDugaar: gereeniiDugaar })
                  .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1, unshlaltiinOgnoo: -1 })
                  .lean();
              }

              if (latestReading) {
                zaaltDefaultDun = latestReading.zaaltCalculation?.defaultDun || latestReading.defaultDun || 0;
                console.log("💰 [INVOICE] Using defaultDun from Excel reading:", {
                  gereeniiDugaar: tempData.gereeniiDugaar,
                  defaultDun: zaaltDefaultDun,
                  zaaltCalculation_defaultDun: latestReading.zaaltCalculation?.defaultDun,
                  reading_defaultDun: latestReading.defaultDun,
                  source: latestReading.zaaltCalculation?.defaultDun ? "zaaltCalculation (Excel)" : "defaultDun (Excel)"
                });
              } else {
                console.warn("⚠️ [INVOICE] No reading found for defaultDun:", {
                  gereeniiDugaar: tempData.gereeniiDugaar,
                  gereeniiId: gereeniiId
                });
              }
            } catch (error) {
              console.error("❌ [INVOICE] Error fetching latest reading for defaultDun:", error.message);
            }

            if (!zaaltDefaultDun) {
              zaaltDefaultDun = gereeZaaltZardal.zaaltDefaultDun || 0;
              if (zaaltDefaultDun) {
                console.log("💰 [INVOICE] Using defaultDun from geree.zardluud (fallback):", {
                  gereeniiDugaar: tempData.gereeniiDugaar,
                  defaultDun: zaaltDefaultDun
                });
              }
            }

            if (!zaaltDefaultDun || zaaltDefaultDun === 0) {
              console.error("❌ [INVOICE] CRITICAL: defaultDun is 0! Base fee will NOT be added!", {
                gereeniiDugaar: tempData.gereeniiDugaar,
                gereeniiId: tempData._id?.toString() || tempData.gereeniiId,
                zaaltDefaultDun: zaaltDefaultDun,
                gereeZaaltZardal_zaaltDefaultDun: gereeZaaltZardal.zaaltDefaultDun
              });
            }

            const zaaltDun = (zoruu * zaaltTariff) + zaaltDefaultDun;
            totalTsahilgaanNekhemjlekh += zaaltDun;

            console.log("⚡ [INVOICE] Electricity calculation:", {
              gereeniiDugaar: tempData.gereeniiDugaar,
              ner: gereeZaaltZardal.ner,
              zardliinTurul: gereeZaaltZardal.zardliinTurul,
              orshinSuugchId: tempData.orshinSuugchId,
              tariffFromOrshinSuugch: zaaltTariff,
              zoruu: zoruu,
              defaultDun: zaaltDefaultDun,
              calculatedAmount: zaaltDun,
              formula: `(${zoruu} * ${zaaltTariff}) + ${zaaltDefaultDun} = ${zaaltDun}`,
              breakdown: {
                usageCost: zoruu * zaaltTariff,
                baseFee: zaaltDefaultDun,
                total: zaaltDun
              },
              gereeTariff: gereeZaaltZardal.tariff,
              gereeDun: gereeZaaltZardal.dun,
              WARNING: "NEVER using geree.tariff or geree.dun - they are ignored"
            });
            const finalZaaltTariff = zaaltDun;

            if (finalZaaltTariff === 175 || finalZaaltTariff === gereeZaaltZardal.tariff) {
              console.error("❌ [INVOICE] ERROR: finalZaaltTariff is using tariff rate instead of calculated amount!", {
                finalZaaltTariff,
                gereeTariff: gereeZaaltZardal.tariff,
                calculatedZaaltDun: zaaltDun,
                zoruu,
                zaaltTariff,
                zaaltDefaultDun
              });
            }

            const electricityZardalEntry = {
              ner: gereeZaaltZardal.ner || "Цахилгаан",
              turul: normalizeTurul(gereeZaaltZardal.turul) || "Тогтмол",
              tariff: finalZaaltTariff,
              tariffUsgeer: zoruu === 0 || zaaltDun === 0
                ? (gereeZaaltZardal?.tariffUsgeer || buildingZaaltZardal?.tariffUsgeer || "₮")
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

          if (zaaltZardluud.length > 0) {
            const ashiglaltiinZaaltZardal = zaaltZardluud[0];

            const ashiglaltiinZaaltDun = ashiglaltiinZaaltZardal.dun || ashiglaltiinZaaltZardal.tariff || 0;
            if (ashiglaltiinZaaltDun > 0) {
              const ashiglaltiinZaaltEntry = {
                ner: ashiglaltiinZaaltZardal.ner || "Цахилгаан",
                turul: normalizeTurul(ashiglaltiinZaaltZardal.turul) || "Тогтмол",
                tariff: ashiglaltiinZaaltDun,
                tariffUsgeer: ashiglaltiinZaaltZardal.tariffUsgeer || "₮",
                zardliinTurul: ashiglaltiinZaaltZardal.zardliinTurul || "Энгийн",
                barilgiinId: tempData.barilgiinId,
                dun: ashiglaltiinZaaltDun,
                bodokhArga: ashiglaltiinZaaltZardal.bodokhArga || "тогтмол",
                tseverUsDun: ashiglaltiinZaaltZardal.tseverUsDun || 0,
                bokhirUsDun: ashiglaltiinZaaltZardal.bokhirUsDun || 0,
                usKhalaasniiDun: ashiglaltiinZaaltZardal.usKhalaasniiDun || 0,
                tsakhilgaanUrjver: ashiglaltiinZaaltZardal.tsakhilgaanUrjver || 1,
                tsakhilgaanChadal: ashiglaltiinZaaltZardal.tsakhilgaanChadal || 0,
                tsakhilgaanDemjikh: ashiglaltiinZaaltZardal.tsakhilgaanDemjikh || 0,
                suuriKhuraamj: ashiglaltiinZaaltZardal.suuriKhuraamj || "0",
                nuatNemekhEsekh: ashiglaltiinZaaltZardal.nuatNemekhEsekh || false,
                ognoonuud: ashiglaltiinZaaltZardal.ognoonuud || [],
                zaalt: false,
              };

              electricityEntries.push(ashiglaltiinZaaltEntry);
              totalTsahilgaanNekhemjlekh += ashiglaltiinZaaltDun;

              console.log("💰 [INVOICE] Added Цахилгаан charge from ashiglaltiinZardluud:", {
                gereeniiDugaar: tempData.gereeniiDugaar,
                ner: ashiglaltiinZaaltZardal.ner,
                dun: ashiglaltiinZaaltDun,
                originalDun: ashiglaltiinZaaltZardal.dun,
                originalTariff: ashiglaltiinZaaltZardal.tariff,
                source: "ashiglaltiinZardluud"
              });
            }
          }

          tsahilgaanNekhemjlekh = totalTsahilgaanNekhemjlekh;
          electricityZardalEntry = electricityEntries[0];

          const filteredZardluudWithoutZaalt = finalZardluud.filter(
            (z) => {
              if (z.zaalt === true) {
                return !zaaltZardluudToProcess.some(
                  (gz) => z.ner === gz.ner && z.zardliinTurul === gz.zardliinTurul
                );
              }
              if (z.zardliinTurul === "Лифт" && tempData.davkhar) {
                const davkharStr = String(tempData.davkhar);
                const choloolugdokhDavkharStr = choloolugdokhDavkhar.map(d => String(d));
                if (choloolugdokhDavkharStr.includes(davkharStr)) {
                  console.log(`🚫 [LIFT] Removing Лифт charge again during electricity processing for floor ${davkharStr}`);
                  return false;
                }
              }
              return true;
            }
          );

          filteredZardluudWithoutZaalt.push(...electricityEntries);

          console.log("⚡ [INVOICE] Electricity entries being added:", {
            count: electricityEntries.length,
            entries: electricityEntries.map(e => ({ ner: e.ner, dun: e.dun, zaalt: e.zaalt }))
          });

          finalZardluud.length = 0;
          finalZardluud.push(...filteredZardluudWithoutZaalt);

          finalZardluud = normalizeZardluudTurul(finalZardluud);

          updatedZardluudTotal = (isAvlagaOnlyInvoice)
            ? 0
            : finalZardluud.reduce((sum, zardal) => {
              return sum + (zardal.dun || 0);
            }, 0);

          finalNiitTulbur = updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

          const firstElectricityEntry = electricityEntries[0];
          const firstBuildingZaaltZardal = zaaltZardluud.find(
            (z) => firstElectricityEntry && z.ner === firstElectricityEntry.ner && z.zardliinTurul === firstElectricityEntry.zardliinTurul
          );
          zaaltMedeelel = {
            umnukhZaalt: tempData.umnukhZaalt || 0,
            suuliinZaalt: tempData.suuliinZaalt || 0,
            zaaltTog: tempData.zaaltTog || 0,
            zaaltUs: tempData.zaaltUs || 0,
            zoruu: zoruu,
            tariff: zaaltTariff,
            tariffUsgeer: firstElectricityEntry?.tariffUsgeer || firstBuildingZaaltZardal?.tariffUsgeer || "кВт",
            tariffType: firstElectricityEntry?.zardliinTurul || firstBuildingZaaltZardal?.zardliinTurul || "Энгийн",
            tariffName: firstElectricityEntry?.ner || firstBuildingZaaltZardal?.ner || "Цахилгаан",
            defaultDun: firstElectricityEntry?.zaaltDefaultDun || 0,
            zaaltDun: tsahilgaanNekhemjlekh,
          };

          console.log("⚡ [INVOICE] Added electricity charge to zardluud array:", {
            ner: electricityZardalEntry.ner,
            tariff: electricityZardalEntry.tariff,
            dun: electricityZardalEntry.dun
          });
        }
      } catch (error) {
        console.error("Error processing electricity for invoice:", error.message);
      }
    }

    const normalizedZardluud = normalizeZardluudTurul(finalZardluud);

    let zardluudWithDun = normalizedZardluud.map((zardal) => {
      if (zardal.zaalt === true) {
        return zardal;
      }
      const dun = zardal.dun > 0 ? zardal.dun : (zardal.tariff || 0);
      const result = {
        ...zardal,
        dun: dun,
        zardliinTurul: zardal.zardliinTurul || "Энгийн"
      };
      if (result.dun === 0 && result.tariff > 0) {
        result.dun = result.tariff;
      }
      return result;
    });

    console.log(`🔍 [LIFT] After mapping zardluudWithDun:`, zardluudWithDun.map(z => ({ ner: z.ner, zardliinTurul: z.zardliinTurul, dun: z.dun })));

    if (tempData.davkhar && choloolugdokhDavkhar.length > 0) {
      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map(d => String(d));
      console.log(`🔍 [LIFT] Final check - Floor: ${davkharStr}, Exempted floors: [${choloolugdokhDavkharStr.join(', ')}], zardluudWithDun count: ${zardluudWithDun.length}`);
      console.log(`🔍 [LIFT] zardluudWithDun before removal:`, zardluudWithDun.map(z => ({ ner: z.ner, zardliinTurul: z.zardliinTurul, dun: z.dun })));
      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        const beforeCount = zardluudWithDun.length;
        const liftCharges = zardluudWithDun.filter(z =>
          z.zardliinTurul === "Лифт" ||
          (z.ner && z.ner.trim() === "Лифт") ||
          (z.ner && z.ner.includes("Лифт")) ||
          (z.dun === liftTariff && z.tariff === liftTariff)
        );
        console.log(`🚫 [LIFT] Final check - Found ${liftCharges.length} Лифт charges to remove for floor ${davkharStr} (liftTariff: ${liftTariff}):`, liftCharges.map(z => ({ ner: z.ner, zardliinTurul: z.zardliinTurul, dun: z.dun, tariff: z.tariff })));
        zardluudWithDun = zardluudWithDun.filter((zardal) => {
          if (zardal.zardliinTurul === "Лифт") return false;
          if (zardal.ner && zardal.ner.trim() === "Лифт") return false;
          if (zardal.ner && zardal.ner.includes("Лифт")) return false;
          if (liftTariff !== null && (zardal.dun === liftTariff || zardal.tariff === liftTariff)) return false;
          return true;
        });
        const afterCount = zardluudWithDun.length;
        console.log(`🚫 [LIFT] Final check - Removed Лифт charge for floor ${davkharStr}. Before: ${beforeCount}, After: ${afterCount}`);
        console.log(`🔍 [LIFT] zardluudWithDun after removal:`, zardluudWithDun.map(z => ({ ner: z.ner, zardliinTurul: z.zardliinTurul, dun: z.dun })));
      } else {
        console.log(`⚠️ [LIFT] Final check - Floor ${davkharStr} is NOT in exempted list [${choloolugdokhDavkharStr.join(', ')}]`);
      }
    } else {
      console.log(`⚠️ [LIFT] Final check - Skipping: davkhar=${tempData.davkhar}, choloolugdokhDavkhar.length=${choloolugdokhDavkhar.length}`);
    }

    const correctedZardluudTotal = (isAvlagaOnlyInvoice)
      ? 0
      : zardluudWithDun.reduce((sum, zardal) => {
        return sum + (zardal.dun || 0);
      }, 0);

    console.log(`💰 [LIFT] Final total calculation - correctedZardluudTotal: ${correctedZardluudTotal}, zardluudWithDun count: ${zardluudWithDun.length}`);

    let correctedFinalNiitTulbur = correctedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

    let positiveBalanceUsed = 0;
    let remainingPositiveBalance = 0;
    if (gereePositiveBalance > 0) {
      positiveBalanceUsed = Math.min(gereePositiveBalance, correctedFinalNiitTulbur);
      correctedFinalNiitTulbur = Math.max(0, correctedFinalNiitTulbur - positiveBalanceUsed);
      remainingPositiveBalance = gereePositiveBalance - positiveBalanceUsed;


    }



    if (tempData.davkhar && choloolugdokhDavkhar.length > 0) {
      const davkharStr = String(tempData.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map(d => String(d));
      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        const liftCountBefore = zardluudWithDun.filter(z => {
          if (z.zardliinTurul === "Лифт") return true;
          if (z.ner && z.ner.includes("Лифт")) return true;
          if (liftTariff !== null && (z.dun === liftTariff || z.tariff === liftTariff)) return true;
          return false;
        }).length;
        if (liftCountBefore > 0) {
          console.log(`🚫 [LIFT] LAST CHANCE - Removing ${liftCountBefore} Лифт charges (tariff: ${liftTariff}) before saving invoice for floor ${davkharStr}`);
          zardluudWithDun = zardluudWithDun.filter(z => {
            if (z.zardliinTurul === "Лифт") return false;
            if (z.ner && z.ner.trim() === "Лифт") return false;
            if (z.ner && z.ner.includes("Лифт")) return false;
            if (liftTariff !== null && (z.dun === liftTariff || z.tariff === liftTariff)) return false;
            return true;
          });
          const correctedZardluudTotalAfter = (isAvlagaOnlyInvoice)
            ? 0
            : zardluudWithDun.reduce((sum, zardal) => sum + (zardal.dun || 0), 0);
          correctedFinalNiitTulbur = correctedZardluudTotalAfter + guilgeenuudTotal + ekhniiUldegdelAmount;
          console.log(`🚫 [LIFT] LAST CHANCE - Updated total: ${correctedFinalNiitTulbur}, removed ${liftCountBefore} lift charges`);
        }
      }
    }

    if (hasEkhniiUldegdel && ekhniiUldegdelAmount > 0) {
      zardluudWithDun.push({
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
      });
      console.log(`💰 [INVOICE] Added ekhniiUldegdel to zardluud: ${ekhniiUldegdelAmount}₮`);
    }

    zardluudWithDun = zardluudWithDun.map(zardal => {
      if (zardal.zaalt === true) {
        return zardal;
      }
      if (zardal.dun === 0 && zardal.tariff > 0) {
        return {
          ...zardal,
          dun: zardal.tariff
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

    console.log(`💰 [LIFT] FINAL INVOICE - niitTulbur: ${tuukh.niitTulbur}, zardluud count: ${tuukh.medeelel.zardluud.length}, lift charges: ${tuukh.medeelel.zardluud.filter(z => z.zardliinTurul === "Лифт").length}`);

    const tailbarText =
      tempData.temdeglel &&
        tempData.temdeglel !== "Excel файлаас автоматаар үүссэн гэрээ"
        ? `\nТайлбар: ${tempData.temdeglel}`
        : "";

    const zaaltText = zaaltMedeelel
      ? `\nЦахилгаан: Өмнө: ${zaaltMedeelel.umnukhZaalt}, Өдөр: ${zaaltMedeelel.zaaltTog}, Шөнө: ${zaaltMedeelel.zaaltUs}, Нийт: ${zaaltMedeelel.suuliinZaalt}`
      : "";

    const positiveBalanceText = positiveBalanceUsed > 0
      ? `\nЭерэг үлдэгдэл ашигласан: ${positiveBalanceUsed}₮${remainingPositiveBalance > 0 ? `, Үлдсэн: ${remainingPositiveBalance}₮` : ''}`
      : '';

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
      console.log("⚡ [INVOICE] Saved tsahilgaanNekhemjlekh:", tuukh.tsahilgaanNekhemjlekh);
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
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;

      const todayInvoices = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
        .find({
          nekhemjlekhiinDugaar: { $regex: `^НЭХ-${datePrefix}-` }
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

      return `НЭХ-${datePrefix}-${String(sequence).padStart(4, '0')}`;
    };

    const saveInvoiceWithRetry = async (maxRetries = 10) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          tuukh.nekhemjlekhiinDugaar = await generateUniqueNekhemjlekhiinDugaar();

          await tuukh.save();

          return;
        } catch (error) {
          if (error.code === 11000 && error.keyPattern && error.keyPattern.nekhemjlekhiinDugaar) {
            console.log(`⚠️ [INVOICE] Duplicate invoice number detected for ${tempData.gereeniiDugaar} (attempt ${attempt}/${maxRetries}), regenerating...`);

            if (attempt === maxRetries) {
              throw new Error(`Failed to generate unique invoice number after ${maxRetries} attempts for contract ${tempData.gereeniiDugaar}: ${error.message}`);
            }

            const delay = 50 * attempt + Math.random() * 50;
            await new Promise(resolve => setTimeout(resolve, delay));
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
          }
        );
      } catch (error) {
        console.error("Error clearing guilgeenuudForNekhemjlekh:", error);
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
        }
      );
    } catch (gereeUpdateError) {
      console.error(
        "❌ [INVOICE] Error updating geree.globalUldegdel after invoice creation:",
        gereeUpdateError.message
      );
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
      console.log("🔔 [NOTIFICATION] Creating notification for invoice...", {
        orshinSuugchId: tempData.orshinSuugchId,
        gereeniiDugaar: tempData.gereeniiDugaar,
        finalNiitTulbur: correctedFinalNiitTulbur,
        timestamp: new Date().toISOString(),
      });

      if (tempData.orshinSuugchId) {
        const baiguullagiinId = org._id ? org._id.toString() : (org.id ? org.id.toString() : String(org));
        console.log("🔍 [NOTIFICATION] Looking for kholbolt...", { baiguullagiinId });

        const kholbolt = db.kholboltuud.find(
          (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
        );

        if (!kholbolt) {
          console.error("❌ [NOTIFICATION] Kholbolt not found for baiguullagiinId:", baiguullagiinId);
        } else {
          console.log("✅ [NOTIFICATION] Kholbolt found, creating medegdel...");

          const medegdel = new Medegdel(kholbolt)();
          medegdel.orshinSuugchId = tempData.orshinSuugchId;
          medegdel.baiguullagiinId = baiguullagiinId;
          medegdel.barilgiinId = tempData.barilgiinId || "";
          medegdel.title = "Шинэ нэхэмжлэх үүссэн";
          medegdel.message = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${correctedFinalNiitTulbur}₮`;
          medegdel.kharsanEsekh = false;
          medegdel.turul = "мэдэгдэл";
          medegdel.ognoo = new Date();

          console.log("💾 [NOTIFICATION] Saving medegdel to database...", {
            orshinSuugchId: medegdel.orshinSuugchId,
            title: medegdel.title,
            message: medegdel.message,
          });

          await medegdel.save();

          console.log("✅ [NOTIFICATION] Medegdel saved successfully:", {
            medegdelId: medegdel._id,
            orshinSuugchId: medegdel.orshinSuugchId,
            timestamp: new Date().toISOString(),
          });

          const medegdelObj = medegdel.toObject();
          const mongolianOffset = 8 * 60 * 60 * 1000;

          console.log("🕐 [NOTIFICATION] Converting dates to Mongolian time...");

          if (medegdelObj.createdAt) {
            const createdAtMongolian = new Date(medegdelObj.createdAt.getTime() + mongolianOffset);
            medegdelObj.createdAt = createdAtMongolian.toISOString();
          }
          if (medegdelObj.updatedAt) {
            const updatedAtMongolian = new Date(medegdelObj.updatedAt.getTime() + mongolianOffset);
            medegdelObj.updatedAt = updatedAtMongolian.toISOString();
          }
          if (medegdelObj.ognoo) {
            const ognooMongolian = new Date(medegdelObj.ognoo.getTime() + mongolianOffset);
            medegdelObj.ognoo = ognooMongolian.toISOString();
          }

          savedMedegdel = medegdelObj;


        }
      } else {
        console.warn("⚠️ [NOTIFICATION] No orshinSuugchId in tempData, skipping notification");
      }
    } catch (notificationError) {
      console.error("❌ [NOTIFICATION] Error sending notification for invoice:", {
        error: notificationError.message,
        stack: notificationError.stack,
        orshinSuugchId: tempData.orshinSuugchId,
        timestamp: new Date().toISOString(),
      });
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
  tukhainBaaziinKholbolt
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
          z.zardliinTurul === ashiglaltiinZardal.zardliinTurul
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
          tukhainBaaziinKholbolt
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
                z.zardliinTurul === ashiglaltiinZardal.zardliinTurul
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
              0
            );

            nekhemjlekh.content = `Гэрээний дугаар: ${geree.gereeniiDugaar}, Нийт төлбөр: ${nekhemjlekh.niitTulbur}₮`;

            await nekhemjlekh.save();
          }
        }
      }
    }

    return { success: true, updatedGereenuud: gereenuud.length };
  } catch (error) {
    console.error("Error updating geree and nekhemjlekh from zardluud:", error);
    return { success: false, error: error.message };
  }
};

async function sendInvoiceSmsToOrshinSuugch(
  nekhemjlekh,
  geree,
  baiguullaga,
  tukhainBaaziinKholbolt
) {
  try {
    console.log("📱 [SMS] Starting SMS sending process...");
    console.log("📱 [SMS] Invoice ID:", nekhemjlekh._id);
    console.log("📱 [SMS] Geree ID:", geree._id);
    console.log("📱 [SMS] Baiguullaga ID:", baiguullaga?._id);

    if (!geree.orshinSuugchId) {
      console.log("❌ [SMS] No orshinSuugchId found in geree");
      return;
    }

    console.log("✅ [SMS] Found orshinSuugchId:", geree.orshinSuugchId);

    const { db } = require("zevbackv2");
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(
      geree.orshinSuugchId
    );

    if (!orshinSuugch) {
      console.log(
        "❌ [SMS] OrshinSuugch not found with ID:",
        geree.orshinSuugchId
      );
      return;
    }

    console.log("✅ [SMS] Found orshinSuugch:", orshinSuugch.ner);
    console.log("📱 [SMS] Phone number (utas):", orshinSuugch.utas);

    if (!orshinSuugch.utas) {
      console.log("❌ [SMS] No phone number (utas) found for orshinSuugch");
      return;
    }

    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    console.log(
      "✅ [SMS] Using hardcoded SMS settings - Key:",
      msgIlgeekhKey.substring(0, 10) + "...",
      "Dugaar:",
      msgIlgeekhDugaar
    );

    const smsText = `Tany ${nekhemjlekh.gereeniiDugaar} gereend, ${nekhemjlekh.niitTulbur
      }₮ nekhemjlekh uuslee, tulukh ognoo ${new Date(
        nekhemjlekh.tulukhOgnoo
      ).toLocaleDateString("mn-MN")}`;
    console.log("📱 [SMS] SMS text:", smsText);

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
    console.log("📱 [SMS] Sending SMS to:", orshinSuugch.utas);
    console.log("📱 [SMS] SMS Server:", msgServer);
    console.log(
      "📱 [SMS] Full URL (without key):",
      url.replace(msgIlgeekhKey, "***HIDDEN***")
    );

    request(url, { json: true }, (err1, res1, body) => {
      if (err1) {
        console.error("❌ [SMS] SMS sending error:", err1);
        console.error("❌ [SMS] Error details:", err1.message);
      } else {
        console.log("✅ [SMS] SMS sent successfully!");
        console.log("📱 [SMS] Response status:", res1?.statusCode);
        console.log("📱 [SMS] Response body:", JSON.stringify(body));

        try {
          const msg = new MsgTuukh(tukhainBaaziinKholbolt)();
          msg.baiguullagiinId = baiguullaga._id.toString();
          msg.dugaar = orshinSuugch.utas;
          msg.gereeniiId = geree._id.toString();
          msg.msg = smsText;
          msg.msgIlgeekhKey = msgIlgeekhKey;
          msg.msgIlgeekhDugaar = msgIlgeekhDugaar;
          msg
            .save()
            .then(() => {
              console.log("✅ [SMS] Message saved to MsgTuukh");
            })
            .catch((saveErr) => {
              console.error("❌ [SMS] Error saving SMS to MsgTuukh:", saveErr);
            });
        } catch (saveError) {
          console.error("❌ [SMS] Error saving SMS to MsgTuukh:", saveError);
        }
      }
    });
  } catch (error) {
    console.error("❌ [SMS] Error in sendInvoiceSmsToOrshinSuugch:", error);
    console.error("❌ [SMS] Error stack:", error.stack);
    throw error;
  }
}

const gereeNeesNekhemjlekhUusgekhPreviousMonth = async (
  tempData,
  org,
  tukhainBaaziinKholbolt,
  monthsAgo = 1,
  uusgegsenEsekh = "garan",
  skipDuplicateCheck = false
) => {
  try {
    console.log(`📅 [PREVIOUS MONTH INVOICE] Creating invoice for ${monthsAgo} month(s) ago`);

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setMonth(targetDate.getMonth() - monthsAgo);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    console.log(`📅 [PREVIOUS MONTH INVOICE] Target month: ${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`);

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

    const invoiceDate = new Date(targetYear, targetMonth, scheduledDay, 0, 0, 0, 0);

    const dueDate = new Date(targetYear, targetMonth + 1, scheduledDay, 0, 0, 0, 0);
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
    const monthEnd = new Date(
      targetYear,
      targetMonth + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Check for existing invoice in target month
    if (!skipDuplicateCheck) {
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
        console.log(
          `ℹ️  Invoice already exists for contract ${tempData.gereeniiDugaar} in target month ${targetYear}-${targetMonth + 1}:`,
          existingInvoice._id
        );
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
      true
    );

    if (result.success && result.nekhemjlekh) {
      const invoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).findById(
        result.nekhemjlekh._id || result.nekhemjlekh
      );

      if (invoice) {
        invoice.ognoo = invoiceDate;
        invoice.nekhemjlekhiinOgnoo = invoiceDate;
        invoice.tulukhOgnoo = dueDate;
        await invoice.save();

        console.log(`✅ [PREVIOUS MONTH INVOICE] Updated dates for invoice ${invoice._id}`);
        console.log(`   Invoice date: ${invoiceDate.toISOString()}`);
        console.log(`   Due date: ${dueDate.toISOString()}`);
      }
    }

    return result;
  } catch (error) {
    console.error(`❌ [PREVIOUS MONTH INVOICE] Error:`, error.message);
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

    const { markInvoicesAsPaid: markInvoices } = require("../services/invoicePaymentService");

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
    console.error("Error marking invoices as paid:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const previewInvoice = async (gereeId, baiguullagiinId, barilgiinId, targetMonth = null, targetYear = null) => {
  try {
    const { db } = require("zevbackv2");
    const mongoose = require("mongoose");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");
    const OrshinSuugch = require("../models/orshinSuugch");
    const NekhemjlekhCron = require("../models/cronSchedule");

    // Try to find the connection
    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    // If not found, try with ObjectId comparison
    if (!tukhainBaaziinKholbolt && mongoose.Types.ObjectId.isValid(baiguullagiinId)) {
      const baiguullagiinObjectId = new mongoose.Types.ObjectId(baiguullagiinId);
      tukhainBaaziinKholbolt = db.kholboltuud.find(
        (k) => {
          const kId = k.baiguullagiinId;
          if (mongoose.Types.ObjectId.isValid(kId)) {
            return kId.equals(baiguullagiinObjectId);
          }
          return String(kId) === String(baiguullagiinId);
        }
      );
    }

    if (!tukhainBaaziinKholbolt) {
      // Log diagnostic information
      console.error("❌ [PREVIEW] Connection not found for baiguullagiinId:", baiguullagiinId);
      console.error("Available connections:", db.kholboltuud.map(k => ({
        baiguullagiinId: k.baiguullagiinId,
        baaziinNer: k.baaziinNer || "N/A"
      })));
      return {
        success: false,
        error: `Холболтын мэдээлэл олдсонгүй! (baiguullagiinId: ${baiguullagiinId})`
      };
    }

    const geree = await Geree(tukhainBaaziinKholbolt).findById(gereeId).lean();
    if (!geree) {
      return { success: false, error: "Гэрээ олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const currentDate = targetMonth !== null && targetYear !== null
      ? new Date(targetYear, targetMonth - 1, 1)
      : new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const targetBarilga = baiguullaga?.barilguud?.find(
      (b) => String(b._id) === String(barilgiinId || geree.barilgiinId || "")
    );

    const ashiglaltiinZardluud = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud || [];

    let filteredZardluud = ashiglaltiinZardluud
      .filter(zardal => zardal.zaalt !== true)
      .map(zardal => {
        const dun = (zardal.dun > 0) ? zardal.dun : (zardal.tariff || 0);
        return { ...zardal, dun: dun };
      });

    filteredZardluud = normalizeZardluudTurul(filteredZardluud);

    let choloolugdokhDavkhar = [];
    let liftTariff = null;

    if (geree.davkhar && geree.barilgiinId && geree.baiguullagiinId) {
      choloolugdokhDavkhar = targetBarilga?.tokhirgoo?.liftShalgaya?.choloolugdokhDavkhar || [];

      const liftZardalFromBuilding = targetBarilga?.tokhirgoo?.ashiglaltiinZardluud?.find(
        z => z.zardliinTurul === "Лифт" || (z.ner && z.ner.includes("Лифт"))
      );
      if (liftZardalFromBuilding) {
        liftTariff = liftZardalFromBuilding.tariff || liftZardalFromBuilding.dun;
      }

      if (choloolugdokhDavkhar.length === 0 && geree.barilgiinId) {
        try {
          const LiftShalgaya = require("../models/liftShalgaya");
          const liftShalgayaRecord = await LiftShalgaya(tukhainBaaziinKholbolt).findOne({
            baiguullagiinId: String(geree.baiguullagiinId),
            barilgiinId: String(geree.barilgiinId)
          }).lean();

          if (liftShalgayaRecord?.choloolugdokhDavkhar && liftShalgayaRecord.choloolugdokhDavkhar.length > 0) {
            choloolugdokhDavkhar = liftShalgayaRecord.choloolugdokhDavkhar;
          }
        } catch (error) {
          console.error("Error fetching liftShalgaya:", error.message);
        }
      }

      const davkharStr = String(geree.davkhar);
      const choloolugdokhDavkharStr = choloolugdokhDavkhar.map(d => String(d));

      if (choloolugdokhDavkharStr.includes(davkharStr)) {
        filteredZardluud = filteredZardluud.filter(
          (zardal) =>
            zardal.zardliinTurul !== "Лифт" &&
            !(zardal.ner && zardal.ner.trim() === "Лифт") &&
            !(zardal.ner && zardal.ner.includes("Лифт")) &&
            !(liftTariff !== null && (zardal.dun === liftTariff || zardal.tariff === liftTariff))
        );
      }
    }

    let ekhniiUldegdelAmount = 0;
    if (geree.orshinSuugchId) {
      try {
        const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
          .findById(geree.orshinSuugchId)
          .select("ekhniiUldegdel")
          .lean();
        if (orshinSuugch && orshinSuugch.ekhniiUldegdel) {
          ekhniiUldegdelAmount = orshinSuugch.ekhniiUldegdel;
        }
      } catch (error) {
        console.error("Error fetching ekhniiUldegdel:", error.message);
      }
    }

    let zardluudWithDun = filteredZardluud.map((zardal) => {
      if (zardal.zaalt === true) return zardal;
      const dun = zardal.dun > 0 ? zardal.dun : (zardal.tariff || 0);
      const result = { ...zardal, dun: dun, zardliinTurul: zardal.zardliinTurul || "Энгийн" };
      if (result.dun === 0 && result.tariff > 0) {
        result.dun = result.tariff;
      }
      return result;
    });

    // Calculate zardluudTotal BEFORE adding ekhniiUldegdel to match gereeNeesNekhemjlekhUusgekh logic
    const zardluudTotal = zardluudWithDun.reduce((sum, zardal) => sum + (zardal.dun || 0), 0);

    if (ekhniiUldegdelAmount > 0) {
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
      });
    }

    const finalNiitTulbur = zardluudTotal + ekhniiUldegdelAmount;

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
        const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);
        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      console.error("Error fetching cron schedule:", error.message);
    }

    if (!tulukhOgnoo) {
      tulukhOgnoo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).findOne({
      gereeniiId: String(gereeId),
      $or: [
        { ognoo: { $gte: monthStart, $lte: monthEnd } },
        { createdAt: { $gte: monthStart, $lte: monthEnd } }
      ]
    }).lean();

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
        zardluud: zardluudWithDun,
        zardluudTotal: zardluudTotal,
        ekhniiUldegdel: ekhniiUldegdelAmount,
        niitTulbur: finalNiitTulbur,
        tulukhOgnoo: tulukhOgnoo,
        ognoo: new Date(),
        existingInvoice: existingInvoice ? {
          _id: existingInvoice._id,
          nekhemjlekhiinDugaar: existingInvoice.nekhemjlekhiinDugaar,
          niitTulbur: existingInvoice.niitTulbur,
          tuluv: existingInvoice.tuluv,
          ognoo: existingInvoice.ognoo,
        } : null,
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const manualSendInvoice = async (gereeId, baiguullagiinId, override = false, targetMonth = null, targetYear = null) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");
    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const geree = await Geree(tukhainBaaziinKholbolt).findById(gereeId).lean();
    if (!geree) {
      return { success: false, error: "Гэрээ олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    const currentDate = targetMonth !== null && targetYear !== null
      ? new Date(targetYear, targetMonth - 1, 1)
      : new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Check for existing unsent (preview/unpaid) invoices for this month
    const existingUnsentInvoices = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).find({
      gereeniiId: String(gereeId),
      tuluv: { $in: ["Төлөөгүй", "Хугацаа хэтэрсэн"] }, // Only unsent/unpaid invoices
      $or: [
        { ognoo: { $gte: monthStart, $lte: monthEnd } },
        { createdAt: { $gte: monthStart, $lte: monthEnd } }
      ]
    }).sort({ createdAt: 1 }); // Sort by oldest first

    if (override) {
      // If override=true, delete ALL existing invoices for this month (old behavior)
      const allExistingInvoices = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).find({
        gereeniiId: String(gereeId),
        $or: [
          { ognoo: { $gte: monthStart, $lte: monthEnd } },
          { createdAt: { $gte: monthStart, $lte: monthEnd } }
        ]
      });

      for (const invoice of allExistingInvoices) {
        await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({ _id: invoice._id });
        console.log(`🗑️ [MANUAL SEND] Deleted existing invoice: ${invoice.nekhemjlekhiinDugaar || invoice._id}`);
      }
    } else if (existingUnsentInvoices.length > 0) {
      // If override=false but there are unsent invoices, update the oldest one instead of creating new
      const oldestUnsentInvoice = existingUnsentInvoices[0];

      console.log(`🔄 [MANUAL SEND] Found existing unsent invoice: ${oldestUnsentInvoice.nekhemjlekhiinDugaar || oldestUnsentInvoice._id}`);
      console.log(`🔄 [MANUAL SEND] Updating invoice instead of creating new one`);

      await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({ _id: oldestUnsentInvoice._id });

      // Delete any additional unsent invoices for this month (keep only one)
      if (existingUnsentInvoices.length > 1) {
        for (let i = 1; i < existingUnsentInvoices.length; i++) {
          const extraInvoice = existingUnsentInvoices[i];
          await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).deleteOne({ _id: extraInvoice._id });
          console.log(`🗑️ [MANUAL SEND] Deleted duplicate unsent invoice: ${extraInvoice.nekhemjlekhiinDugaar || extraInvoice._id}`);
        }
      }
    }

    const gereeObj = geree.toObject ? geree.toObject() : geree;
    const result = await gereeNeesNekhemjlekhUusgekh(
      gereeObj,
      baiguullaga,
      tukhainBaaziinKholbolt,
      "manual",
      true
    );

    if (result.success && existingUnsentInvoices.length > 0 && !override) {
      console.log(`✅ [MANUAL SEND] Updated existing unsent invoice for geree ${geree.gereeniiDugaar || gereeId}`);
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const manualSendMassInvoices = async (baiguullagiinId, barilgiinId = null, override = false, targetMonth = null, targetYear = null) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
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
          targetYear
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId: invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
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
const manualSendSelectedInvoices = async (gereeIds, baiguullagiinId, override = false, targetMonth = null, targetYear = null) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const Baiguullaga = require("../models/baiguullaga");

    // Validate input
    if (!Array.isArray(gereeIds) || gereeIds.length === 0) {
      return { success: false, error: "gereeIds нь хоосон биш массив байх ёстой!" };
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return { success: false, error: "Холболтын мэдээлэл олдсонгүй!" };
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
    if (!baiguullaga) {
      return { success: false, error: "Байгууллага олдсонгүй!" };
    }

    // Fetch all selected contracts
    const gerees = await Geree(tukhainBaaziinKholbolt).find({
      _id: { $in: gereeIds },
      baiguullagiinId: String(baiguullagiinId),
    }).lean();

    if (gerees.length === 0) {
      return { success: false, error: "Сонгосон гэрээ олдсонгүй!" };
    }

    if (gerees.length !== gereeIds.length) {
      console.warn(`⚠️ [MANUAL SEND SELECTED] Warning: Requested ${gereeIds.length} contracts, but found ${gerees.length} contracts`);
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
        console.log(`📝 [${i + 1}/${gerees.length}] Processing contract ${geree.gereeniiDugaar || geree._id}...`);

        const invoiceResult = await manualSendInvoice(
          geree._id,
          baiguullagiinId,
          override,
          targetMonth,
          targetYear
        );

        if (invoiceResult.success) {
          results.created++;
          results.invoices.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId: invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
          });
          console.log(`✅ [${i + 1}/${gerees.length}] Invoice created for ${geree.gereeniiDugaar || geree._id}`);
        } else {
          results.errors++;
          results.errorsList.push({
            gereeniiId: geree._id,
            gereeniiDugaar: geree.gereeniiDugaar,
            error: invoiceResult.error || "Unknown error",
          });
          console.log(`❌ [${i + 1}/${gerees.length}] Error for ${geree.gereeniiDugaar || geree._id}: ${invoiceResult.error}`);
        }
      } catch (error) {
        results.errors++;
        results.errorsList.push({
          gereeniiId: geree._id,
          gereeniiDugaar: geree.gereeniiDugaar,
          error: error.message || "Unknown error",
        });
        console.error(`❌ [${i + 1}/${gerees.length}] Гэрээ ${geree.gereeniiDugaar || geree._id} боловсруулах алдаа:`, error.message);
      }
    }

    console.log(`📊 [MANUAL SEND SELECTED] Results: Created: ${results.created}, Errors: ${results.errors}, Total: ${results.total}`);

    return results;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const deleteInvoiceZardal = asyncHandler(async (req, res, next) => {
  const { invoiceId, zardalId, baiguullagiinId } = req.body;

  if (!invoiceId || !zardalId || !baiguullagiinId) {
    return res.status(400).json({ success: false, error: "invoiceId, zardalId, and baiguullagiinId are required" });
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  if (!kholbolt) {
    return res.status(404).json({ success: false, error: "Холболтын мэдээлэл олдсонгүй!" });
  }

  const NekhemjlekhModel = nekhemjlekhiinTuukh(kholbolt);
  const GereeModel = Geree(kholbolt);

  const invoice = await NekhemjlekhModel.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({ success: false, error: "Нэхэмжлэх олдсонгүй!" });
  }


  if (!invoice.medeelel || !Array.isArray(invoice.medeelel.zardluud)) {
    return res.status(400).json({ success: false, error: "Энэ нэхэмжлэхэд зардал олдсонгүй!" });
  }

  const zardluud = Array.isArray(invoice.medeelel?.zardluud) ? invoice.medeelel.zardluud : [];
  const guilgeenuud = Array.isArray(invoice.medeelel?.guilgeenuud) ? invoice.medeelel.guilgeenuud : [];

  let deletedAmount = 0;
  let pullPath = "";

  const zardalIndex = zardluud.findIndex(z => String(z._id) === String(zardalId));
  const guilgeeIndex = guilgeenuud.findIndex(g => String(g._id) === String(zardalId));

  if (zardalIndex !== -1) {
    const deletedZardal = zardluud[zardalIndex];
    deletedAmount = Number(deletedZardal.dun || deletedZardal.tariff || deletedZardal.tulukhDun || 0);
    pullPath = "medeelel.zardluud";
  } else if (guilgeeIndex !== -1) {
    const deletedGuilgee = guilgeenuud[guilgeeIndex];
    // If it was a charge, decrement total. If it was a payment, increment total.
    const charge = Number(deletedGuilgee.tulukhDun || 0);
    const payment = Number(deletedGuilgee.tulsunDun || 0);
    deletedAmount = charge - payment;
    pullPath = "medeelel.guilgeenuud";
  } else {
    return res.status(404).json({ success: false, error: "Зардал эсвэл гүйлгээ олдсонгүй (ID mismatch)!" });
  }

  const mongoose = require("mongoose");
  const updateQuery = {
    $pull: { [pullPath]: { _id: mongoose.Types.ObjectId.isValid(zardalId) ? new mongoose.Types.ObjectId(zardalId) : zardalId } },
    $inc: { niitTulbur: -deletedAmount }
  };

  await NekhemjlekhModel.findByIdAndUpdate(invoiceId, updateQuery);


  if (invoice.gereeniiId && deletedAmount !== 0) {
    await GereeModel.findByIdAndUpdate(invoice.gereeniiId, {
      $inc: { globalUldegdel: -deletedAmount }
    });

  }


  const updatedInvoice = await NekhemjlekhModel.findById(invoiceId);
  if (updatedInvoice && updatedInvoice.niitTulbur <= 0) {
    updatedInvoice.tuluv = "Төлсөн";
    await updatedInvoice.save();
  }

  res.json({
    success: true,
    message: "Зардал амжилттай устгагдлаа",
    newTotal: updatedInvoice?.niitTulbur || 0
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
};
