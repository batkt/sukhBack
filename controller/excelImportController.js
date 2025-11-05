const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const aldaa = require("../components/aldaa");
const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");

/**
 * Generic Excel download service
 * Accepts data array and headers, generates Excel file
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header objects with 'key' and 'label'
 * @param {String} fileName - Name of the file (without extension)
 * @param {String} sheetName - Name of the Excel sheet
 * @param {Array} colWidths - Optional array of column widths
 */
exports.downloadExcelList = asyncHandler(async (req, res, next) => {
  try {
    const { data, headers, fileName, sheetName, colWidths } = req.body;

    if (!data || !Array.isArray(data)) {
      throw new aldaa("Мэдээлэл оруулах шаардлагатай!");
    }

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      throw new aldaa("Гарчиг оруулах шаардлагатай!");
    }

    // Extract header labels
    const headerLabels = headers.map((h) => (typeof h === 'string' ? h : h.label || h.key));

    // Extract header keys
    const headerKeys = headers.map((h) => (typeof h === 'string' ? h : h.key));

    // Create data rows
    const rows = data.map((item) => {
      return headerKeys.map((key) => {
        // Handle nested properties (e.g., "user.name")
        const value = key.split('.').reduce((obj, prop) => {
          if (obj && obj[prop] !== undefined) {
            return obj[prop];
          }
          return null;
        }, item);

        // Format the value
        if (value === null || value === undefined) {
          return '';
        }
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return String(value);
      });
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);

    // Set column widths if provided
    if (colWidths && Array.isArray(colWidths)) {
      ws["!cols"] = colWidths.map((w) => ({ wch: typeof w === 'number' ? w : 15 }));
    } else {
      // Auto-width based on headers
      ws["!cols"] = headerLabels.map(() => ({ wch: 15 }));
    }

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");

    // Generate Excel buffer
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
      `attachment; filename="${fileName || `export_${Date.now()}`}.xlsx"`
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error("Error generating Excel download:", error);
    next(error);
  }
});

exports.generateExcelTemplate = asyncHandler(async (req, res, next) => {
  try {
    const headers = [
      "Овог",
      "Нэр",
      "Утас",
      "Имэйл",
      "Давхар",
      "Орц",
      "Тоот",
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    const colWidths = [
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Хэрэглэгч бүртгэх");

    const excelBuffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!data || data.length === 0) {
      throw new aldaa("Excel файл хоосон байна!");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
    }

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

    const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
    const LiftShalgaya = require("../models/liftShalgaya");

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

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const userData = {
          ovog: row["Овог"]?.toString().trim() || "",
          ner: row["Нэр"]?.toString().trim() || "",
          utas: row["Утас"]?.toString().trim() || "",
          mail: row["Имэйл"]?.toString().trim() || "",
          davkhar: row["Давхар"]?.toString().trim() || "",
          orts: row["Орц"]?.toString().trim() || "",
          toot: row["Тоот"]?.toString().trim() || "",
        };

        const validationErrors = [];

        if (!userData.ovog || userData.ovog.length === 0) {
          validationErrors.push("Овог хоосон байна!");
        }

        if (!userData.ner || userData.ner.length === 0) {
          validationErrors.push("Нэр хоосон байна!");
        }

        if (!userData.utas || userData.utas.length === 0) {
          validationErrors.push("Утасны дугаар хоосон байна!");
        } else {
          userData.utas = userData.utas.replace(/\s/g, "");
          if (userData.utas.length === 0) {
            validationErrors.push("Утасны дугаарт хоосон зай байна!");
          } else if (!/^\d+$/.test(userData.utas)) {
            validationErrors.push("Утасны дугаар зөвхөн тоо байх ёстой!");
          } else if (userData.utas.length !== 8) {
            validationErrors.push("Утасны дугаар 8 оронтой байх ёстой!");
          }
        }

        if (!userData.mail || userData.mail.length === 0) {
          validationErrors.push("Имэйл хоосон байна!");
        } else {
          userData.mail = userData.mail.replace(/\s/g, "");
          if (userData.mail.length === 0) {
            validationErrors.push("Имэйл талбарт хоосон зай байна!");
          } else {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(userData.mail)) {
              validationErrors.push("Имэйл формат буруу байна! (жишээ: name@gmail.com, name@yahoo.com)");
            }
          }
        }

        if (!userData.davkhar || userData.davkhar.length === 0) {
          validationErrors.push("Давхар хоосон байна!");
        } else {
          userData.davkhar = userData.davkhar.replace(/\s/g, "");
          if (userData.davkhar.length === 0) {
            validationErrors.push("Давхар талбарт хоосон зай байна!");
          } else if (!/^\d+$/.test(userData.davkhar)) {
            validationErrors.push("Давхар зөвхөн тоо байх ёстой!");
          }
        }

        if (!userData.orts || userData.orts.length === 0) {
          validationErrors.push("Орц хоосон байна!");
        } else {
          userData.orts = userData.orts.replace(/\s/g, "");
          if (userData.orts.length === 0) {
            validationErrors.push("Орц талбарт хоосон зай байна!");
          } else if (!/^\d+$/.test(userData.orts)) {
            validationErrors.push("Орц зөвхөн тоо байх ёстой!");
          }
        }

        if (!userData.toot || userData.toot.length === 0) {
          validationErrors.push("Тоот хоосон байна!");
        } else {
          userData.toot = userData.toot.trim();
          if (userData.toot.length === 0) {
            validationErrors.push("Тоот талбарт хоосон байна!");
          }
        }

        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(" "));
        }

        const finalBarilgiinId = barilgiinId || defaultBarilgiinId;

        // Check for duplicate user within the same barilga (barilgiinId)
        // Same phone number can exist in different barilga, but not in the same barilga
        const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
          utas: userData.utas,
          barilgiinId: finalBarilgiinId,
        });

        if (existingUser) {
          throw new Error("Энэ барилгад утасны дугаар давхардаж байна!");
        }

        const targetBarilga = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(finalBarilgiinId)
        );

        if (!targetBarilga) {
          throw new Error(
            `Барилга олдсонгүй. Барилгын ID: ${finalBarilgiinId}`
          );
        }

        const duuregNer = targetBarilga.tokhirgoo?.duuregNer || "";
        const horooData = targetBarilga.tokhirgoo?.horoo || {};
        const horooNer = horooData.ner || "";
        const sohNer = targetBarilga.tokhirgoo?.sohNer || "";

        const userObject = {
          ovog: userData.ovog || "",
          ner: userData.ner,
          utas: userData.utas,
          mail: userData.mail || "",
          nuutsUg: "1234",
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
          bairniiNer: targetBarilga.ner || "",
          toot: userData.toot || "",
        };

        const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userObject);
        await orshinSuugch.save();

        const zardluudForBarilga = finalBarilgiinId
          ? ashiglaltiinZardluudData.filter(
              (z) =>
                !z.barilgiinId ||
                z.barilgiinId === "" ||
                String(z.barilgiinId) === String(finalBarilgiinId)
            )
          : ashiglaltiinZardluudData;

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
          ashiglaltiinZardal: niitTulbur,
          niitTulbur: niitTulbur,
          toot: userObject.toot || "",
          davkhar: userData.davkhar || "",
          bairNer: targetBarilga.ner || "",
          sukhBairshil: `${duuregNer}, ${horooNer}, ${sohNer}`,
          duureg: duuregNer,
          horoo: horooData,
          sohNer: sohNer,
          orts: userData.orts || "",
          burtgesenAjiltan: orshinSuugch._id,
          orshinSuugchId: orshinSuugch._id.toString(),
          temdeglel: "Excel файлаас автоматаар үүссэн гэрээ",
          actOgnoo: new Date(),
          baritsaaniiUldegdel: 0,
          zardluud: zardluudArray, 
          segmentuud: [],
          khungulultuud: [],
        };

        const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
        await geree.save();

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

