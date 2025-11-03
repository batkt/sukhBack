const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const aldaa = require("../components/aldaa");
const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");

/**
 * Generate Excel template for user import
 */
exports.generateExcelTemplate = asyncHandler(async (req, res, next) => {
  try {
    // Define headers only (no sample data) - exact format requested
    const headers = [
      "Овог",
      "Нэр",
      "Утас",
      "Имэйл",
      "Давхар",
      "Орц",
      "Барилгын нэр",
      "Тоот",
    ];

    // Create workbook and worksheet with headers only
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Овог
      { wch: 15 }, // Нэр
      { wch: 12 }, // Утас
      { wch: 25 }, // Имэйл
      { wch: 10 }, // Давхар
      { wch: 10 }, // Орц
      { wch: 20 }, // Барилгын нэр
      { wch: 10 }, // Тоот
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Хэрэглэгч бүртгэх");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orshinSuugch_import_template_${Date.now()}.xlsx"`
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel template:", error);
    next(error);
  }
});

/**
 * Import users from Excel file and create contracts/invoices
 */
exports.importUsersFromExcel = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, barilgiinId } = req.body;

    if (!baiguullagiinId) {
      throw new aldaa("Байгууллагын ID заавал бөглөх шаардлагатай!");
    }

    if (!req.file) {
      throw new aldaa("Excel файл оруулах шаардлагатай!");
    }

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!data || data.length === 0) {
      throw new aldaa("Excel файл хоосон байна!");
    }

    // Validate baiguullaga exists
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
    }

    // Determine default barilgiinId
    const defaultBarilgiinId =
      barilgiinId ||
      (baiguullaga.barilguud && baiguullaga.barilguud.length > 0
        ? String(baiguullaga.barilguud[0]._id)
        : null);

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
    );

    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Байгууллагын холболтын мэдээлэл олдсонгүй!");
    }

    // Get ashiglaltiinZardluud and liftShalgaya data
    const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
    const LiftShalgaya = require("../models/liftShalgaya");

    // Fetch all ashiglaltiinZardluud for the baiguullaga
    // We'll filter by barilgiinId when processing each user
    const ashiglaltiinZardluudData = await AshiglaltiinZardluud(
      tukhainBaaziinKholbolt
    ).find({
      baiguullagiinId: baiguullaga._id.toString(),
    });

    const liftShalgayaData = await LiftShalgaya(
      tukhainBaaziinKholbolt
    ).findOne({
      baiguullagiinId: baiguullaga._id.toString(),
    });

    const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

    // Process each row
    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because row 1 is header and arrays start at 0

      try {
        // Map Excel columns to user data - only the new format columns
        const userData = {
          ovog: row["Овог"]?.toString().trim() || "",
          ner: row["Нэр"]?.toString().trim() || "",
          utas: row["Утас"]?.toString().trim() || "",
          mail: row["Имэйл"]?.toString().trim() || "",
          davkhar: row["Давхар"]?.toString().trim() || "",
          orts: row["Орц"]?.toString().trim() || "",
          bairniiNer: row["Барилгын нэр"]?.toString().trim() || "",
          toot: row["Тоот"]?.toString().trim() || "",
        };

        // Validate required fields
        if (!userData.ner) {
          throw new Error("Нэр заавал бөглөх шаардлагатай!");
        }
        if (!userData.utas) {
          throw new Error("Утасны дугаар заавал бөглөх шаардлагатай!");
        }
        if (!userData.davkhar) {
          throw new Error("Давхар заавал бөглөх шаардлагатай!");
        }
        if (!userData.orts) {
          throw new Error("Орц заавал бөглөх шаардлагатай!");
        }
        if (!userData.bairniiNer) {
          throw new Error("Барилгын нэр заавал бөглөх шаардлагатай!");
        }
        if (!userData.toot) {
          throw new Error("Тоот заавал бөглөх шаардлагатай!");
        }

        // Check for existing user
        const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
          utas: userData.utas,
        });

        if (existingUser) {
          throw new Error("Утасны дугаар давхардаж байна!");
        }

        // Determine barilgiinId for this user (from request body or default)
        const finalBarilgiinId = barilgiinId || defaultBarilgiinId;

        // Get barilga details for location info (duureg, horoo, soh)
        const targetBarilga = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(finalBarilgiinId)
        );

        if (!targetBarilga) {
          throw new Error(
            `Барилга олдсонгүй. Барилгын ID: ${finalBarilgiinId}`
          );
        }

        // Get location info from barilga's tokhirgoo
        const duuregNer = targetBarilga.tokhirgoo?.duuregNer || "";
        const horooData = targetBarilga.tokhirgoo?.horoo || {};
        const horooNer = horooData.ner || "";
        const sohNer = targetBarilga.tokhirgoo?.sohNer || "";

        // Create user - password is hardcoded to "1234"
        const userObject = {
          ovog: userData.ovog || "",
          ner: userData.ner,
          utas: userData.utas,
          mail: userData.mail || "",
          nuutsUg: "1234", // Hardcoded password for Excel imports
          baiguullagiinId: baiguullaga._id,
          baiguullagiinNer: baiguullaga.ner,
          barilgiinId: finalBarilgiinId,
          erkh: "OrshinSuugch",
          nevtrekhNer: userData.utas,
          duureg: duuregNer,
          horoo: horooData,
          soh: sohNer,
          davkhar: userData.davkhar,
          orts: userData.orts,
          bairniiNer: userData.bairniiNer,
          toot: userData.toot ? Number(userData.toot) : 0,
        };

        const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userObject);
        await orshinSuugch.save();

        // Get ashiglaltiinZardluud for this barilga
        // Include global costs (no barilgiinId) and costs specific to this barilga
        const zardluudForBarilga = finalBarilgiinId
          ? ashiglaltiinZardluudData.filter(
              (z) =>
                !z.barilgiinId ||
                z.barilgiinId === "" ||
                String(z.barilgiinId) === String(finalBarilgiinId)
            )
          : ashiglaltiinZardluudData;

        // Create zardluud array for contract
        const zardluudArray = zardluudForBarilga.map((zardal) => ({
          ner: zardal.ner,
          turul: zardal.turul,
          zardliinTurul: zardal.zardliinTurul,
          tariff: zardal.tariff,
          tariffUsgeer: zardal.tariffUsgeer || "",
          tulukhDun: 0,
          dun: zardal.dun || 0,
          bodokhArga: zardal.bodokhArga || "",
          tseverUsDun: zardal.tseverUsDun || 0,
          bokhirUsDun: zardal.bokhirUsDun || 0,
          usKhalaasniiDun: zardal.usKhalaasniiDun || 0,
          tsakhilgaanUrjver: zardal.tsakhilgaanUrjver || 1,
          tsakhilgaanChadal: zardal.tsakhilgaanChadal || 0,
          tsakhilgaanDemjikh: zardal.tsakhilgaanDemjikh || 0,
          suuriKhuraamj: zardal.suuriKhuraamj || 0,
          nuatNemekhEsekh: zardal.nuatNemekhEsekh || false,
          ognoonuud: zardal.ognoonuud || [],
          barilgiinId: zardal.barilgiinId || finalBarilgiinId || "",
        }));

        // Calculate niitTulbur
        const niitTulbur = zardluudForBarilga.reduce((total, zardal) => {
          const tariff = zardal.tariff || 0;

          const isLiftItem =
            zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";

          if (
            isLiftItem &&
            userData.davkhar &&
            choloolugdokhDavkhar.includes(userData.davkhar)
          ) {
            return total;
          }

          return total + tariff;
        }, 0);

        // Create contract - register field removed, ashiglaltiinZardal set to niitTulbur
        const contractData = {
          gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}-${i}`,
          gereeniiOgnoo: new Date(),
          turul: "Үндсэн",
          ovog: userData.ovog || "",
          ner: userData.ner,
          utas: [userData.utas],
          mail: userData.mail || "",
          baiguullagiinId: baiguullaga._id,
          baiguullagiinNer: baiguullaga.ner,
          barilgiinId: finalBarilgiinId || "",
          tulukhOgnoo: new Date(),
          ashiglaltiinZardal: niitTulbur, // Set to niitTulbur (sum of tariffs)
          niitTulbur: niitTulbur,
          toot: userObject.toot || 0,
          davkhar: userData.davkhar || "",
          bairNer: userData.bairniiNer || "",
          sukhBairshil: `${duuregNer}, ${horooNer}, ${sohNer}`, // From barilga tokhirgoo
          orts: userData.orts || "",
          burtgesenAjiltan: orshinSuugch._id,
          orshinSuugchId: orshinSuugch._id.toString(),
          temdeglel: "Excel файлаас автоматаар үүссэн гэрээ",
          actOgnoo: new Date(),
          baritsaaniiUldegdel: 0,
          zardluud: zardluudArray, // Populated from ashiglaltiinZardluud
          segmentuud: [],
          khungulultuud: [],
        };

        const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
        await geree.save();

        // Create invoice
        try {
          const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
            geree,
            baiguullaga,
            tukhainBaaziinKholbolt,
            "automataar"
          );

          if (!invoiceResult.success) {
            console.error(
              `Invoice creation failed for user ${userData.utas}:`,
              invoiceResult.error
            );
          }
        } catch (invoiceError) {
          console.error(
            `Error creating invoice for user ${userData.utas}:`,
            invoiceError.message
          );
        }

        results.success.push({
          row: rowNumber,
          utas: userData.utas,
          ner: userData.ner,
          message: "Амжилттай бүртгэгдлээ",
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          utas: row["Утас"]?.toString().trim() || "Тодорхойгүй",
          ner: row["Нэр"]?.toString().trim() || "Тодорхойгүй",
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `${results.success.length} хэрэглэгч амжилттай, ${results.failed.length} хэрэглэгч алдаатай`,
      result: results,
    });
  } catch (error) {
    console.error("Error importing users from Excel:", error);
    next(error);
  }
});

