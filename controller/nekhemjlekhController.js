const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const NekhemjlekhCron = require("../models/cronSchedule");

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
      const cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
      });

      if (cronSchedule && cronSchedule.nekhemjlekhUusgekhOgnoo) {
        const scheduledDay = cronSchedule.nekhemjlekhUusgekhOgnoo;
        
        const gereeCreatedDate = tempData.createdAt || tempData.gereeniiOgnoo || new Date();
        const currentMonthCronDate = new Date(currentYear, currentMonth, scheduledDay, 0, 0, 0, 0);
        
        // Check if there are any existing invoices with ekhniiUldegdel for this geree
        // Only use ekhniiUldegdel if NO invoices with ekhniiUldegdel exist yet
        const existingEkhniiUldegdelInvoices = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt).countDocuments({
          gereeniiId: tempData._id.toString(),
          ekhniiUldegdel: { $exists: true, $gt: 0 }, // Has ekhniiUldegdel > 0
        });
        
        // Only use ekhniiUldegdel if:
        // 1. Geree was created before cron date
        // 2. Geree has ekhniiUldegdel
        // 3. NO existing invoices with ekhniiUldegdel (first invoice only)
        if (gereeCreatedDate < currentMonthCronDate && 
            (tempData.ekhniiUldegdel || tempData.ekhniiUldegdel === 0) &&
            existingEkhniiUldegdelInvoices === 0) {
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
          const { QpayKhariltsagch } = require("quickqpaypackv2");
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
    
    // Save ekhniiUldegdel to invoice
    tuukh.ekhniiUldegdel = tempData.ekhniiUldegdel || 0;

    let filteredZardluud = tempData.zardluud || [];
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
    // Get the cron schedule for this baiguullaga
    let tulukhOgnoo = null;
    try {
      const cronSchedule = await NekhemjlekhCron(tukhainBaaziinKholbolt).findOne({
        baiguullagiinId: tempData.baiguullagiinId || org?._id?.toString(),
      });

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
        const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const dayToUse = Math.min(scheduledDay, lastDayOfNextMonth);

        // Create the date for next month's scheduled day
        tulukhOgnoo = new Date(nextYear, nextMonth, dayToUse, 0, 0, 0, 0);
      }
    } catch (error) {
      console.error("Error fetching nekhemjlekhCron schedule:", error.message);
    }

    // Fallback to 30 days from now if cron schedule not found
    tuukh.tulukhOgnoo = tulukhOgnoo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Use ekhniiUldegdel for first invoice if conditions are met, otherwise use normal charges
    const finalNiitTulbur = shouldUseEkhniiUldegdel 
      ? (tempData.ekhniiUldegdel || 0)
      : filteredZardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);
    
    // When using ekhniiUldegdel, do NOT include zardluud charges in medeelel
    // Only include zardluud when cron is activated (after first invoice)
    const finalZardluud = shouldUseEkhniiUldegdel ? [] : filteredZardluud;

    tuukh.medeelel = {
      zardluud: finalZardluud,
      segmentuud: tempData.segmentuud || [],
      khungulultuud: tempData.khungulultuud || [],
      toot: tempData.toot,
      temdeglel: tempData.temdeglel,
      tailbar: tempData.temdeglel || "", // Save tailbar from geree temdeglel
      uusgegsenEsekh: uusgegsenEsekh,
      uusgegsenOgnoo: new Date(),
    };
    tuukh.nekhemjlekh =
      tempData.nekhemjlekh ||
      (uusgegsenEsekh === "automataar"
        ? "Автоматаар үүссэн нэхэмжлэх"
        : "Гаран үүссэн нэхэмжлэх");
    tuukh.zagvariinNer = tempData.zagvariinNer || org.ner;
    
    // Include tailbar in content if available
    const tailbarText = tempData.temdeglel && tempData.temdeglel !== "Excel файлаас автоматаар үүссэн гэрээ" 
      ? `\nТайлбар: ${tempData.temdeglel}` 
      : "";
    tuukh.content = `Гэрээний дугаар: ${tempData.gereeniiDugaar}, Нийт төлбөр: ${finalNiitTulbur}₮${tailbarText}`;
    tuukh.nekhemjlekhiinDans =
      tempData.nekhemjlekhiinDans || dansInfo.dugaar || "";
    tuukh.nekhemjlekhiinDansniiNer =
      tempData.nekhemjlekhiinDansniiNer || dansInfo.dansniiNer || "";
    tuukh.nekhemjlekhiinBank =
      tempData.nekhemjlekhiinBank || dansInfo.bank || "";

    tuukh.nekhemjlekhiinIbanDugaar =
      tempData.nekhemjlekhiinIbanDugaar || dansInfo.ibanDugaar || "";
    tuukh.nekhemjlekhiinOgnoo = new Date();
    tuukh.niitTulbur = finalNiitTulbur;

    // Initialize payment status
    tuukh.tuluv = "Төлөөгүй";

    // Нэхэмжлэхийн дугаар үүсгэх
    const suuliinNekhemjlekh = await nekhemjlekhiinTuukh(tukhainBaaziinKholbolt)
      .findOne()
      .sort({ dugaalaltDugaar: -1 });

    const suuliinDugaar = suuliinNekhemjlekh?.dugaalaltDugaar;
    tuukh.dugaalaltDugaar =
      suuliinDugaar && !isNaN(suuliinDugaar) ? suuliinDugaar + 1 : 1;

    await tuukh.save();

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

    return {
      success: true,
      nekhemjlekh: tuukh,
      gereeniiId: tempData._id,
      gereeniiDugaar: tempData.gereeniiDugaar,
      tulbur: tempData.niitTulbur,
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
          turul: ashiglaltiinZardal.turul,
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
              turul: ashiglaltiinZardal.turul,
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

module.exports = {
  gereeNeesNekhemjlekhUusgekh,
  updateGereeAndNekhemjlekhFromZardluud,
};
