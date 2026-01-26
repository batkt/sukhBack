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

/**
 * Normalize turul field: "тогтмол" -> "Тогтмол"
 */
function normalizeTurul(turul) {
  if (!turul || typeof turul !== 'string') {
    return turul;
  }
  // Normalize "тогтмол" (lowercase) to "Тогтмол" (uppercase first letter)
  if (turul.toLowerCase() === 'тогтмол') {
    return 'Тогтмол';
  }
  return turul;
}

/**
 * Normalize turul in zardluud array
 */
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

/**
 * Remove duplicate zardluud entries based on ner, turul, zardliinTurul, and barilgiinId
 * Keeps only the first occurrence of each unique combination
 */
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
    
    // Create a unique key based on ner, turul, zardliinTurul, and barilgiinId
    const normalizedTurul = normalizeTurul(zardal.turul);
    const key = `${zardal.ner || ''}|${normalizedTurul || ''}|${zardal.zardliinTurul || ''}|${zardal.barilgiinId || ''}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(zardal);
    }
  }
  
  return deduplicated;
}

// Гэрээнээс нэхэмжлэх үүсгэх функц
const gereeNeesNekhemjlekhUusgekh = async (
  tempData,
  org,
  tukhainBaaziinKholbolt,
  uusgegsenEsekh = "garan",
  skipDuplicateCheck = false
) => {
  try {
    console.log("Энэ рүү орлоо: gereeNeesNekhemjlekhUusgekh");

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11 (0 = January)

    // First, check if we should use ekhniiUldegdel (before duplicate check)
    // This determines if we should skip duplicate checking for first invoice
    // Only use ekhniiUldegdel if:
    // 1. Geree was created before cron date
    // 2. Geree has ekhniiUldegdel
    // 3. NO existing invoices with ekhniiUldegdel exist (first invoice only)
    let shouldUseEkhniiUldegdel = false;
    const NekhemjlekhCron = require("../models/cronSchedule");

    try {
      // First try to find building-level schedule, then fall back to organization-level
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }
      
      // If no building-level schedule found, try organization-level
      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: null, // Organization-level schedule
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

        // Check if there are any existing invoices with ekhniiUldegdel for this geree
        // Only use ekhniiUldegdel if NO invoices with ekhniiUldegdel exist yet
        const existingEkhniiUldegdelInvoices = await nekhemjlekhiinTuukh(
          tukhainBaaziinKholbolt
        ).countDocuments({
          gereeniiId: tempData._id.toString(),
          ekhniiUldegdel: { $exists: true, $gt: 0 }, // Has ekhniiUldegdel > 0
        });

        // Only use ekhniiUldegdel if:
        // 1. Geree was created before cron date
        // 2. Geree has ekhniiUldegdel > 0 (must be greater than 0)
        // 3. NO existing invoices with ekhniiUldegdel (first invoice only)
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

    // Only check for duplicate invoices if NOT using ekhniiUldegdel AND not skipping duplicate check
    // If using ekhniiUldegdel (first invoice) or skipDuplicateCheck is true, allow creating it even if one exists
    if (!shouldUseEkhniiUldegdel && !skipDuplicateCheck) {
      // Check if invoice already exists for this contract in the current month
      // This prevents duplicate invoices regardless of when in the month they're created
      // (handles cases where invoices are scheduled for 2nd, 15th, 31st, etc.)
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

      // Determine barilgiinId for the check (temporary variable)
      let checkBarilgiinId = tempData.barilgiinId;
      if (!checkBarilgiinId && org?.barilguud && org.barilguud.length > 0) {
        checkBarilgiinId = String(org.barilguud[0]._id);
      }

      // Check for existing invoice in current calendar month
      // Uses ognoo (invoice date) OR createdAt as fallback
      const existingInvoiceQuery = {
        gereeniiId: tempData._id.toString(),
        $or: [
          // Check by ognoo field (invoice date)
          {
            ognoo: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
          // Fallback: check by createdAt (when invoice was created in DB)
          {
            createdAt: {
              $gte: monthStart,
              $lte: monthEnd,
            },
          },
        ],
      };

      // Add barilgiinId to query if available (for multi-barilga isolation)
      if (checkBarilgiinId) {
        existingInvoiceQuery.barilgiinId = checkBarilgiinId;
      }

      // Find the most recent invoice for this contract in current month
      const existingInvoice = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
        .findOne(existingInvoiceQuery)
        .sort({ ognoo: -1, createdAt: -1 });

      if (existingInvoice) {
        console.log(
          `ℹ️  Invoice already exists for contract ${tempData.gereeniiDugaar} in current month:`,
          existingInvoice._id
        );

        // Return existing invoice without modifying the contract
        // This preserves the original created date of the geree
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

      // First, try to get dans from barilga-specific tokhirgoo
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

      // If no barilga-specific dans, try to get from QpayKhariltsagch (building-specific bank accounts)
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
            // Find the salbar that matches barilgiinId (salbariinId)
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
              // Use the first bank account from this salbar
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

      // If still no dans, try to get from Dans model (organization-level)
      if (!barilgaDans && !dansInfo.dugaar && tempData.baiguullagiinId) {
        const dansModel = Dans(tukhainBaaziinKholbolt);

        // Try to find dans with barilgiinId first (if Dans model supports it)
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
    tuukh.uldegdel = tempData.uldegdel || tempData.baritsaaniiUldegdel || 0;
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

    // Save ekhniiUldegdel to invoice (preserve 0 value if it exists)
    console.log(
      "💰 [INVOICE] ekhniiUldegdel from geree:",
      tempData.ekhniiUldegdel
    );
    console.log(
      "💰 [INVOICE] ekhniiUldegdel type:",
      typeof tempData.ekhniiUldegdel
    );
    console.log(
      "💰 [INVOICE] ekhniiUldegdel undefined?",
      tempData.ekhniiUldegdel === undefined
    );
    console.log(
      "💰 [INVOICE] ekhniiUldegdel null?",
      tempData.ekhniiUldegdel === null
    );

    tuukh.ekhniiUldegdel =
      tempData.ekhniiUldegdel !== undefined && tempData.ekhniiUldegdel !== null
        ? tempData.ekhniiUldegdel
        : 0;

    console.log(
      "💰 [INVOICE] ekhniiUldegdel saved to invoice:",
      tuukh.ekhniiUldegdel
    );

    // Also save ekhniiUldegdelUsgeer if it exists
    if (tempData.ekhniiUldegdelUsgeer !== undefined) {
      tuukh.ekhniiUldegdelUsgeer = tempData.ekhniiUldegdelUsgeer;
      console.log(
        "💰 [INVOICE] ekhniiUldegdelUsgeer saved:",
        tuukh.ekhniiUldegdelUsgeer
      );
    }

    let filteredZardluud = tempData.zardluud || [];
    // Normalize turul in zardluud: "тогтмол" -> "Тогтмол"
    filteredZardluud = normalizeZardluudTurul(filteredZardluud);
    // Remove duplicate zardluud entries
    filteredZardluud = deduplicateZardluud(filteredZardluud);
    
    if (tempData.davkhar) {
      // Get liftShalgaya from baiguullaga.barilguud[].tokhirgoo
      const { db } = require("zevbackv2");
      const Baiguullaga = require("../models/baiguullaga");
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        tempData.baiguullagiinId
      );

      const targetBarilga = baiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(tempData.barilgiinId || "")
      );

      const liftShalgayaData = targetBarilga?.tokhirgoo?.liftShalgaya;
      const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

      if (choloolugdokhDavkhar.includes(tempData.davkhar)) {
        filteredZardluud = tempData.zardluud.filter(
          (zardal) => !(zardal.zardliinTurul === "Лифт")
        );
      }
    }

    // Set payment due date based on nekhemjlekhCron schedule
    // Get the cron schedule: first try building-level, then fall back to organization-level
    let tulukhOgnoo = null;
    try {
      // First try to find building-level schedule, then fall back to organization-level
      let cronSchedule = null;
      if (tempData.barilgiinId) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: tempData.barilgiinId,
        });
      }
      
      // If no building-level schedule found, try organization-level
      if (!cronSchedule) {
        cronSchedule = await NekhemjlekhCron(
          tukhainBaaziinKholbolt
        ).findOne({
          baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
          barilgiinId: null, // Organization-level schedule
        });
      }

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        // Calculate next month's scheduled date
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo; // 1-31

        // Calculate next month
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear = currentYear + 1;
        }

        // Get the last day of next month to handle edge cases (e.g., Feb 31 -> Feb 28/29)
        const lastDayOfNextMonth = new Date(
          nextYear,
          nextMonth + 1,
          0
        ).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);

        // Create the date for next month's scheduled day
        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      console.error("Error fetching nekhemjlekhCron schedule:", error.message);
    }

    // Fallback to 30 days from now if cron schedule not found
    tuukh.tulukhOgnoo =
      tulukhOgnoo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Get guilgeenuudForNekhemjlekh (one-time guilgeenuud that should appear in invoice)
    // These are guilgeenuud that have been added to geree and should appear once in an invoice
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

    // Calculate guilgeenuud total (tulukhDun from avlaga guilgeenuud)
    const guilgeenuudTotal = guilgeenuudForNekhemjlekh.reduce(
      (sum, guilgee) => {
        return sum + (guilgee.tulukhDun || 0);
      },
      0
    );

    // If skipDuplicateCheck is true and there are guilgeenuudForNekhemjlekh, this is an avlaga-only invoice
    // Exclude monthly zardluud charges for avlaga-only invoices
    const isAvlagaOnlyInvoice =
      skipDuplicateCheck && guilgeenuudForNekhemjlekh.length > 0;

    // Use ekhniiUldegdel for first invoice if conditions are met, otherwise use normal charges
    // When using ekhniiUldegdel or avlaga-only invoice, do NOT include zardluud charges in medeelel
    // Only include zardluud when cron is activated (after first invoice) and not avlaga-only
    // Use let instead of const so we can modify it when adding electricity charges
    let finalZardluud =
      shouldUseEkhniiUldegdel || isAvlagaOnlyInvoice ? [] : [...filteredZardluud];

    // But exclude zardluud if this is an avlaga-only invoice
    // Use dun if tariff is 0 or missing (some charges store amount in dun)
    const zardluudTotal =
      shouldUseEkhniiUldegdel || isAvlagaOnlyInvoice
        ? 0
        : filteredZardluud.reduce((sum, zardal) => {
            const amount = zardal.tariff || zardal.dun || 0;
            return sum + amount;
          }, 0);

    // Final total includes zardluud + guilgeenuud (or ekhniiUldegdel for first invoice)
    // For avlaga-only invoices, only include guilgeenuud
    // If ekhniiUldegdel exists, always include it in the total (even if shouldUseEkhniiUldegdel is false)
    const hasEkhniiUldegdel =
      tempData.ekhniiUldegdel && tempData.ekhniiUldegdel > 0;
    const ekhniiUldegdelAmount = hasEkhniiUldegdel
      ? tempData.ekhniiUldegdel || 0
      : 0;

    // Recalculate zardluudTotal after adding electricity charge (if electricity was added)
    // This will be updated after electricity processing
    // Use dun if tariff is 0 or missing (some charges store amount in dun)
    let updatedZardluudTotal = shouldUseEkhniiUldegdel || isAvlagaOnlyInvoice
      ? 0
      : finalZardluud.reduce((sum, zardal) => {
          const amount = zardal.tariff || zardal.dun || 0;
          return sum + amount;
        }, 0);

    let finalNiitTulbur = shouldUseEkhniiUldegdel
      ? ekhniiUldegdelAmount + guilgeenuudTotal
      : updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;

    // Debug logging
    console.log("💰 [INVOICE] Total calculation:", {
      shouldUseEkhniiUldegdel,
      ekhniiUldegdelAmount,
      updatedZardluudTotal,
      guilgeenuudTotal,
      finalNiitTulbur,
      zardluudCount: finalZardluud.length,
      isAvlagaOnlyInvoice,
    });

    // Don't create invoice if total amount is 0 (for new users with no charges)
    // BUT create invoice if ekhniiUldegdel exists (even if other charges are 0)
    if (finalNiitTulbur === 0 && guilgeenuudTotal === 0 && !hasEkhniiUldegdel) {
      console.log(
        "⚠️ [INVOICE] Skipping invoice creation - total amount is 0 MNT",
        {
          shouldUseEkhniiUldegdel,
          updatedZardluudTotal,
          guilgeenuudTotal,
          hasEkhniiUldegdel,
          zardluudCount: finalZardluud.length,
        }
      );
      return {
        success: false,
        error: "Нийт төлбөр 0₮ байна. Нэхэмжлэх үүсгэх шаардлагагүй.",
        gereeniiId: tempData._id,
        gereeniiDugaar: tempData.gereeniiDugaar,
        skipReason: "zero_amount",
      };
    }

    // Check if electricity zardal exists and geree has electricity readings
    let zaaltMedeelel = null;
    let tsahilgaanNekhemjlekh = 0;
    let electricityZardalEntry = null;
    
    if (tempData.barilgiinId && tempData.baiguullagiinId && tempData.orshinSuugchId) {
      try {
        const { db } = require("zevbackv2");
        const Baiguullaga = require("../models/baiguullaga");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
          tempData.baiguullagiinId
        );
        const targetBarilga = baiguullaga?.barilguud?.find(
          (b) => String(b._id) === String(tempData.barilgiinId)
        );
        // Get all electricity zardals from geree.zardluud (not from ashiglaltiinZardluud)
        // This allows multiple electricity charges with same name but different purposes
        const gereeZaaltZardluud = (tempData.zardluud || []).filter((z) => z.zaalt === true);
        
        // Also get building level config for fallback defaultDun
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

        // Check if geree has electricity zardals OR building has electricity config
        // If geree doesn't have electricity zardals but building does, create from building config
        // ALWAYS recalculate if electricity exists (either in geree or building)
        if (gereeZaaltZardluud.length > 0 || (zaaltZardluud.length > 0 && (tempData.umnukhZaalt !== undefined || tempData.suuliinZaalt !== undefined))) {
          // If no electricity zardals in geree but building has config, use building config
          const zaaltZardluudToProcess = gereeZaaltZardluud.length > 0 
            ? gereeZaaltZardluud 
            : zaaltZardluud; // Fallback to building level if geree doesn't have them
          // Get tariff from orshinSuugch.tsahilgaaniiZaalt (ignore geree.zardluud)
          const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(
            tempData.orshinSuugchId
          ).select("tsahilgaaniiZaalt").lean();
          
          // Use tariff from orshinSuugch.tsahilgaaniiZaalt
          const zaaltTariff = orshinSuugch?.tsahilgaaniiZaalt || 0;
          
          // Get readings from tempData OR from electricity zardal if tempData doesn't have them
          // This handles cases where script passes geree.toObject() which might not have readings at top level
          const umnukhZaalt = tempData.umnukhZaalt ?? zaaltZardluudToProcess[0]?.umnukhZaalt ?? 0;
          const suuliinZaalt = tempData.suuliinZaalt ?? zaaltZardluudToProcess[0]?.suuliinZaalt ?? 0;
          
          // Calculate usage (difference between current and previous reading)
          const zoruu = suuliinZaalt - umnukhZaalt;
          
          // CRITICAL: Log readings to debug
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
          
          // Process ALL electricity zardals (from geree.zardluud or building level)
          // This allows multiple electricity charges with same name but different purposes
          const electricityEntries = [];
          let totalTsahilgaanNekhemjlekh = 0;
          
          for (const gereeZaaltZardal of zaaltZardluudToProcess) {
            // CRITICAL: defaultDun (суурь хураамж) comes from Excel reading (zaaltUnshlalt)
            // Excel is SEPARATE from ashiglaltiinZardluud - ashiglaltiinZardluud only has the zardal config
            // Priority: latest Excel reading > geree.zardluud (which might have it from previous Excel import)
            let zaaltDefaultDun = 0;
            
            // Get defaultDun from latest Excel reading (zaaltUnshlalt) - this is the source of truth
            try {
              const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
              const gereeniiId = tempData._id?.toString() || tempData.gereeniiId || tempData._id;
              const gereeniiDugaar = tempData.gereeniiDugaar;
              
              // Try both gereeniiId and gereeniiDugaar to find the reading
              let latestReading = null;
              if (gereeniiId) {
                latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                  .findOne({ gereeniiId: gereeniiId })
                  .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1, unshlaltiinOgnoo: -1 })
                  .lean();
              }
              
              // If not found by ID, try by contract number
              if (!latestReading && gereeniiDugaar) {
                latestReading = await ZaaltUnshlalt(tukhainBaaziinKholbolt)
                  .findOne({ gereeniiDugaar: gereeniiDugaar })
                  .sort({ importOgnoo: -1, "zaaltCalculation.calculatedAt": -1, unshlaltiinOgnoo: -1 })
                  .lean();
              }
              
              if (latestReading) {
                // Priority: zaaltCalculation.defaultDun > defaultDun (both from Excel)
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
            
            // Fallback to geree.zardluud if reading not found (might have been saved from previous Excel import)
            if (!zaaltDefaultDun) {
              zaaltDefaultDun = gereeZaaltZardal.zaaltDefaultDun || 0;
              if (zaaltDefaultDun) {
                console.log("💰 [INVOICE] Using defaultDun from geree.zardluud (fallback):", {
                  gereeniiDugaar: tempData.gereeniiDugaar,
                  defaultDun: zaaltDefaultDun
                });
              }
            }
            
            // CRITICAL WARNING: If defaultDun is 0, the base fee is missing!
            if (!zaaltDefaultDun || zaaltDefaultDun === 0) {
              console.error("❌ [INVOICE] CRITICAL: defaultDun is 0! Base fee will NOT be added!", {
                gereeniiDugaar: tempData.gereeniiDugaar,
                gereeniiId: tempData._id?.toString() || tempData.gereeniiId,
                zaaltDefaultDun: zaaltDefaultDun,
                gereeZaaltZardal_zaaltDefaultDun: gereeZaaltZardal.zaaltDefaultDun
              });
            }
            
            // ALWAYS calculate electricity amount from readings: (usage * tariff) + base fee
            // NEVER use geree.tariff or geree.dun - they might be the tariff rate (175), not the calculated amount
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
            
            // ALWAYS use the calculated amount - NEVER use geree.tariff or geree.dun
            // geree.tariff might be the tariff rate (175), not the calculated amount
            // FORCE use calculated amount - ignore any stored values
            const finalZaaltTariff = zaaltDun;
            
            // CRITICAL CHECK: If finalZaaltTariff is still 175, something is wrong
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
            
            // Create electricity zardal entry to add to medeelel.zardluud (like other charges)
            const electricityZardalEntry = {
              ner: gereeZaaltZardal.ner || "Цахилгаан",
              turul: normalizeTurul(gereeZaaltZardal.turul) || "Тогтмол",
              tariff: finalZaaltTariff, // Use preserved tariff if no readings, otherwise calculated amount
              tariffUsgeer: zoruu === 0 || zaaltDun === 0 
                ? (gereeZaaltZardal?.tariffUsgeer || buildingZaaltZardal?.tariffUsgeer || "₮")
                : "₮", // Total amount, not per кВт
              zardliinTurul: gereeZaaltZardal.zardliinTurul || "Энгийн",
              barilgiinId: tempData.barilgiinId,
              dun: finalZaaltTariff, // Total amount
              bodokhArga: gereeZaaltZardal.bodokhArga || "тогтмол",
              tseverUsDun: 0,
              bokhirUsDun: 0,
              usKhalaasniiDun: 0,
              tsakhilgaanUrjver: 1,
              tsakhilgaanChadal: 0,
              tsakhilgaanDemjikh: 0,
              suuriKhuraamj: zaaltDefaultDun.toString(), // Base fee from Excel or building level
              nuatNemekhEsekh: false,
              ognoonuud: [],
              // Store electricity-specific details
              zaalt: true,
              zaaltTariff: zaaltTariff, // кВт tariff rate used
              zaaltDefaultDun: zaaltDefaultDun, // Base fee
              umnukhZaalt: tempData.umnukhZaalt || 0,
              suuliinZaalt: tempData.suuliinZaalt || 0,
              zaaltTog: tempData.zaaltTog || 0,
              zaaltUs: tempData.zaaltUs || 0,
              zoruu: zoruu, // Usage amount
            };
            
            electricityEntries.push(electricityZardalEntry);
          }
          
          // Add the "Цахилгаан" charge from ashiglaltiinZardluud as a separate regular charge
          // This is a normal zardal (not a base fee), separate from the calculated electricity charge
          if (zaaltZardluud.length > 0) {
            const ashiglaltiinZaaltZardal = zaaltZardluud[0]; // Get the electricity zardal from ashiglaltiinZardluud
            
            // Only add if it has a dun or tariff (amount) value
            const ashiglaltiinZaaltDun = ashiglaltiinZaaltZardal.dun || ashiglaltiinZaaltZardal.tariff || 0;
            if (ashiglaltiinZaaltDun > 0) {
              const ashiglaltiinZaaltEntry = {
                ner: ashiglaltiinZaaltZardal.ner || "Цахилгаан",
                turul: normalizeTurul(ashiglaltiinZaaltZardal.turul) || "Тогтмол",
                tariff: ashiglaltiinZaaltDun, // Use dun or tariff as amount
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
                zaalt: false, // This is a regular charge from ashiglaltiinZardluud, not calculated electricity
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
          electricityZardalEntry = electricityEntries[0]; // Keep first one for backward compatibility
          
          // Add electricity charges to finalZardluud array (like other charges)
          // Remove existing electricity entries from finalZardluud first
          // Only remove entries that match by BOTH ner AND zardliinTurul AND have zaalt: true
          // This allows multiple electricity charges with same name but different purposes to coexist
          // IMPORTANT: Don't remove the regular ashiglaltiinZardluud charge (zaalt: false)
          const filteredZardluudWithoutZaalt = finalZardluud.filter(
            (z) => {
              // Only remove if it matches any electricity zardal by BOTH name AND zardliinTurul AND has zaalt: true
              // Keep entries that have zaalt: false (regular charges from ashiglaltiinZardluud)
              if (z.zaalt === false) {
                return true; // Keep regular charges from ashiglaltiinZardluud
              }
              return !zaaltZardluudToProcess.some(
                (gz) => z.ner === gz.ner && z.zardliinTurul === gz.zardliinTurul
              );
            }
          );
          
          // Add all calculated electricity charges (including the ashiglaltiinZardluud charge we added)
          filteredZardluudWithoutZaalt.push(...electricityEntries);
          
          console.log("⚡ [INVOICE] Electricity entries being added:", {
            count: electricityEntries.length,
            entries: electricityEntries.map(e => ({ ner: e.ner, dun: e.dun, zaalt: e.zaalt }))
          });
          
          // Update finalZardluud to include electricity charges
          finalZardluud.length = 0;
          finalZardluud.push(...filteredZardluudWithoutZaalt);
          
          // Normalize turul in finalZardluud after adding electricity
          finalZardluud = normalizeZardluudTurul(finalZardluud);
          
          // CRITICAL: Deduplicate again after adding electricity charges
          // This prevents duplicates that might exist in geree.zardluud
          finalZardluud = deduplicateZardluud(finalZardluud);
          
          // Recalculate totals after adding electricity charge
          // Use dun if tariff is 0 or missing (some charges store amount in dun)
          updatedZardluudTotal = shouldUseEkhniiUldegdel || isAvlagaOnlyInvoice
            ? 0
            : finalZardluud.reduce((sum, zardal) => {
                const amount = zardal.tariff || zardal.dun || 0;
                return sum + amount;
              }, 0);
          
          finalNiitTulbur = shouldUseEkhniiUldegdel
            ? ekhniiUldegdelAmount + guilgeenuudTotal
            : updatedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;
          
          // Also store detailed electricity info in zaaltMedeelel for backward compatibility
          // Use first electricity entry for zaaltMedeelel
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

    // Normalize turul in finalZardluud before saving to invoice
    const normalizedZardluud = normalizeZardluudTurul(finalZardluud);
    
    // CRITICAL: Final deduplication before saving to invoice
    // This ensures no duplicates are saved even if they were added during electricity processing
    const deduplicatedZardluud = deduplicateZardluud(normalizedZardluud);
    
    // CRITICAL: Ensure dun is set to tariff for regular charges (non-electricity)
    // For regular charges, dun should equal tariff if dun is 0 or missing
    // Electricity charges already have dun calculated separately
    const zardluudWithDun = deduplicatedZardluud.map((zardal) => {
      // For electricity charges (zaalt: true), keep dun as is (already calculated)
      if (zardal.zaalt === true) {
        return zardal;
      }
      // For regular charges, set dun = tariff if dun is 0 or missing
      if (!zardal.dun || zardal.dun === 0) {
        return {
          ...zardal,
          dun: zardal.tariff || 0
        };
      }
      return zardal;
    });
    
    // Recalculate total using corrected dun values for consistency
    // Use dun if tariff is 0 or missing (some charges store amount in dun)
    const correctedZardluudTotal = shouldUseEkhniiUldegdel || isAvlagaOnlyInvoice
      ? 0
      : zardluudWithDun.reduce((sum, zardal) => {
          const amount = zardal.dun || zardal.tariff || 0;
          return sum + amount;
        }, 0);
    
    // Update final total with corrected zardluud total
    let correctedFinalNiitTulbur = shouldUseEkhniiUldegdel
      ? ekhniiUldegdelAmount + guilgeenuudTotal
      : correctedZardluudTotal + guilgeenuudTotal + ekhniiUldegdelAmount;
    
    // Deduct positiveBalance from geree if it exists
    let positiveBalanceUsed = 0;
    let remainingPositiveBalance = 0;
    if (gereePositiveBalance > 0) {
      positiveBalanceUsed = Math.min(gereePositiveBalance, correctedFinalNiitTulbur);
      correctedFinalNiitTulbur = Math.max(0, correctedFinalNiitTulbur - positiveBalanceUsed);
      remainingPositiveBalance = gereePositiveBalance - positiveBalanceUsed;
      
      console.log("💰 [INVOICE] Deducting positiveBalance:", {
        originalTotal: correctedFinalNiitTulbur + positiveBalanceUsed,
        positiveBalance: gereePositiveBalance,
        positiveBalanceUsed,
        remainingPositiveBalance,
        finalTotal: correctedFinalNiitTulbur,
      });
    }
    
    console.log("💰 [INVOICE] Corrected total calculation:", {
      shouldUseEkhniiUldegdel,
      ekhniiUldegdelAmount,
      correctedZardluudTotal,
      guilgeenuudTotal,
      correctedFinalNiitTulbur,
      positiveBalanceUsed,
      remainingPositiveBalance,
      zardluudCount: zardluudWithDun.length,
      isAvlagaOnlyInvoice,
    });
    
    tuukh.medeelel = {
      zardluud: zardluudWithDun,
      guilgeenuud: guilgeenuudForNekhemjlekh, // Include one-time guilgeenuud
      segmentuud: tempData.segmentuud || [],
      khungulultuud: tempData.khungulultuud || [],
      toot: tempData.toot,
      temdeglel: tempData.temdeglel,
      tailbar: tempData.temdeglel || "", // Save tailbar from geree temdeglel
      uusgegsenEsekh: uusgegsenEsekh,
      uusgegsenOgnoo: new Date(),
      ...(zaaltMedeelel ? { zaalt: zaaltMedeelel } : {}), // Add electricity readings if available
    };
    tuukh.nekhemjlekh =
      tempData.nekhemjlekh ||
      (uusgegsenEsekh === "automataar"
        ? "Автоматаар үүссэн нэхэмжлэх"
        : "Гаран үүссэн нэхэмжлэх");
    tuukh.zagvariinNer = tempData.zagvariinNer || org.ner;

    // Include tailbar in content if available
    const tailbarText =
      tempData.temdeglel &&
      tempData.temdeglel !== "Excel файлаас автоматаар үүссэн гэрээ"
        ? `\nТайлбар: ${tempData.temdeglel}`
        : "";
    
    // Include electricity readings in content if available
    const zaaltText = zaaltMedeelel
      ? `\nЦахилгаан: Өмнө: ${zaaltMedeelel.umnukhZaalt}, Өдөр: ${zaaltMedeelel.zaaltTog}, Шөнө: ${zaaltMedeelel.zaaltUs}, Нийт: ${zaaltMedeelel.suuliinZaalt}`
      : "";
    
    // Include positiveBalance info in content if it was used
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
    
    // Save electricity invoice amount if calculated
    if (tsahilgaanNekhemjlekh > 0) {
      tuukh.tsahilgaanNekhemjlekh = tsahilgaanNekhemjlekh;
      console.log("⚡ [INVOICE] Saved tsahilgaanNekhemjlekh:", tuukh.tsahilgaanNekhemjlekh);
    }

    // Initialize payment status
    tuukh.tuluv = "Төлөөгүй";

    // Нэхэмжлэхийн дугаар үүсгэх
    const suuliinNekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });

    const suuliinDugaar = suuliinNekhemjlekh?.dugaalaltDugaar;
    tuukh.dugaalaltDugaar =
      suuliinDugaar && !isNaN(suuliinDugaar) ? suuliinDugaar + 1 : 1;

    // Generate unique nekhemjlekhiinDugaar (invoice number)
    // This function generates a candidate number - retry logic handles race conditions
    const generateUniqueNekhemjlekhiinDugaar = async () => {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;
      
      // Find the highest sequence number for today
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
      
      // Generate candidate number
      // Note: In concurrent scenarios, multiple processes might generate the same number
      // The retry logic below will handle this by catching duplicate key errors
      return `НЭХ-${datePrefix}-${String(sequence).padStart(4, '0')}`;
    };
    
    // Retry logic to handle race conditions when saving
    // When multiple invoices are created concurrently, they might generate the same number
    // This retry mechanism catches duplicate key errors and regenerates the number
    const saveInvoiceWithRetry = async (maxRetries = 10) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Generate invoice number
          tuukh.nekhemjlekhiinDugaar = await generateUniqueNekhemjlekhiinDugaar();
          
          // Try to save
          await tuukh.save();
          
          // Success - return
          return;
        } catch (error) {
          // Check if it's a duplicate key error for nekhemjlekhiinDugaar
          if (error.code === 11000 && error.keyPattern && error.keyPattern.nekhemjlekhiinDugaar) {
            // Duplicate key error - regenerate and retry
            console.log(`⚠️ [INVOICE] Duplicate invoice number detected for ${tempData.gereeniiDugaar} (attempt ${attempt}/${maxRetries}), regenerating...`);
            
            if (attempt === maxRetries) {
              // Last attempt failed - throw error
              throw new Error(`Failed to generate unique invoice number after ${maxRetries} attempts for contract ${tempData.gereeniiDugaar}: ${error.message}`);
            }
            
            // Wait a bit before retrying (exponential backoff with jitter)
            // This helps spread out concurrent retries
            const delay = 50 * attempt + Math.random() * 50;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Different error - throw it
            throw error;
          }
        }
      }
    };
    
    await saveInvoiceWithRetry();

    // Remove guilgeenuudForNekhemjlekh from geree after including them in invoice (one-time)
    // This ensures they only appear once in an invoice
    if (guilgeenuudForNekhemjlekh.length > 0) {
      try {
        await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
          tempData._id,
          {
            $set: {
              guilgeenuudForNekhemjlekh: [], // Clear the array after including in invoice
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

    // Гэрээг нэхэмжлэхийн огноогоор шинэчлэх
    // Use $set to only update nekhemjlekhiinOgnoo without affecting timestamps
    await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
      tempData._id,
      {
        $set: {
          nekhemjlekhiinOgnoo: new Date(),
        },
      },
      {
        runValidators: false,
        // Don't update timestamps - only update the specific field
      }
    );

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

    // Send notification (medegdel) to orshinSuugch when invoice is created
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

          // Convert dates to Mongolian time (UTC+8) for response
          const medegdelObj = medegdel.toObject();
          const mongolianOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          
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
          
          console.log("✅ [NOTIFICATION] Medegdel prepared for socket emission:", {
            medegdelId: medegdelObj._id,
            orshinSuugchId: medegdelObj.orshinSuugchId,
            eventName: `orshinSuugch${medegdelObj.orshinSuugchId}`,
            timestamp: new Date().toISOString(),
          });

          // Try to emit socket event if available (for cases where invoice is created outside of avlaga flow)
          // Note: This requires req to be passed or socket.io to be available globally
          // For now, we'll rely on the caller (gereeController.js) to emit the socket event
          // But we'll log that the medegdel is ready for emission
          console.log("📡 [NOTIFICATION] Medegdel ready for socket emission - caller should emit:", {
            eventName: `orshinSuugch${medegdelObj.orshinSuugchId}`,
            note: "Socket emission will be handled by caller (gereeController.js) if invoice created from avlaga",
          });
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
      // Don't fail the invoice creation if notification fails
    }

    return {
      success: true,
      nekhemjlekh: tuukh,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar,
      tulbur: correctedFinalNiitTulbur,
      medegdel: savedMedegdel, // Include notification for socket emission
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
        // Update the zardal in geree
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
          tuluv: { $ne: "Төлсөн" }, // Only update unpaid invoices
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

// Helper function to send SMS to orshinSuugch when invoice is created
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

    // Get orshinSuugch from geree
    if (!geree.orshinSuugchId) {
      console.log("❌ [SMS] No orshinSuugchId found in geree");
      return; // No orshinSuugch linked to this geree
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
      return; // No orshinSuugch found
    }

    console.log("✅ [SMS] Found orshinSuugch:", orshinSuugch.ner);
    console.log("📱 [SMS] Phone number (utas):", orshinSuugch.utas);

    if (!orshinSuugch.utas) {
      console.log("❌ [SMS] No phone number (utas) found for orshinSuugch");
      return; // No phone number available
    }

    // Hardcode SMS settings (same as dugaarBatalgaajuulya)
    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    console.log(
      "✅ [SMS] Using hardcoded SMS settings - Key:",
      msgIlgeekhKey.substring(0, 10) + "...",
      "Dugaar:",
      msgIlgeekhDugaar
    );

    // Create SMS message
    const smsText = `Tany ${nekhemjlekh.gereeniiDugaar} gereend, ${
      nekhemjlekh.niitTulbur
    }₮ nekhemjlekh uuslee, tulukh ognoo ${new Date(
      nekhemjlekh.tulukhOgnoo
    ).toLocaleDateString("mn-MN")}`;
    console.log("📱 [SMS] SMS text:", smsText);

    // Send SMS
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

        // Save message to MsgTuukh
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

// Create invoices for a specific previous month
// monthsAgo: 1 for previous month, 2 for 2 months ago, etc.
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
    
    // Calculate target month
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setMonth(targetDate.getMonth() - monthsAgo);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth(); // 0-11
    
    console.log(`📅 [PREVIOUS MONTH INVOICE] Target month: ${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`);
    
    // Get cron schedule to determine the scheduled day
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
    
    // Calculate invoice date (ognoo) - scheduled day of target month
    const invoiceDate = new Date(targetYear, targetMonth, scheduledDay, 0, 0, 0, 0);
    
    // Calculate due date (tulukhOgnoo) - scheduled day of next month after target
    const dueDate = new Date(targetYear, targetMonth + 1, scheduledDay, 0, 0, 0, 0);
    // Handle edge case for months with fewer days
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    if (scheduledDay > lastDayOfMonth) {
      dueDate.setDate(lastDayOfMonth);
    }
    
    // Override tempData dates for target month
    const modifiedTempData = {
      ...tempData,
      ognoo: invoiceDate,
      nekhemjlekhiinOgnoo: invoiceDate,
    };
    
    // Temporarily override the function's date logic by creating a wrapper
    // We'll modify the duplicate check to use target month
    const originalFunction = gereeNeesNekhemjlekhUusgekh;
    
    // Create a modified version that uses target month for duplicate checking
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
    
    // Call the original function but we need to modify it to use target dates
    // Since we can't easily modify the internal logic, we'll create invoices with target dates
    // by calling the function and then updating the dates after creation
    
    // For now, let's create a simplified version that sets the dates correctly
    const result = await originalFunction(
      modifiedTempData,
      org,
      tukhainBaaziinKholbolt,
      uusgegsenEsekh,
      true // skipDuplicateCheck = true since we already checked
    );
    
    if (result.success && result.nekhemjlekh) {
      // Update the invoice with correct dates for target month
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

/**
 * Mark invoices as paid with credit/overpayment system
 * Payment reduces from latest month first, then previous months
 * If payment exceeds all invoices, remaining is saved as positiveBalance
 * markEkhniiUldegdel: true to include ekhniiUldegdel invoices, false to only mark regular ashiglaltiinZardluud invoices
 */
const markInvoicesAsPaid = asyncHandler(async (req, res, next) => {
  try {
    const {
      baiguullagiinId,
      dun, // Payment amount (required)
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

module.exports = {
  gereeNeesNekhemjlekhUusgekh,
  gereeNeesNekhemjlekhUusgekhPreviousMonth,
  updateGereeAndNekhemjlekhFromZardluud,
  markInvoicesAsPaid,
};
