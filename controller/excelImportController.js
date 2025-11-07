const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const aldaa = require("../components/aldaa");
const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");

/**
 *
 * @param {Array} data - Array of objects to export (REQUIRED)
 * @param {Array} headers - Optional: Array of header strings OR objects with 'key' and 'label'
 * @param {String} fileName - Name of the file (without extension)
 * @param {String} sheetName - Name of the Excel sheet
 * @param {Array} colWidths - Optional array of column widths
 */
/**
 * Recursively extract all keys from an object (including nested)
 */
function extractAllKeys(obj, prefix = "") {
  const keys = [];
  if (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    !(obj instanceof Date)
  ) {
    Object.keys(obj).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        obj[key] &&
        typeof obj[key] === "object" &&
        !Array.isArray(obj[key]) &&
        !(obj[key] instanceof Date)
      ) {
        keys.push(...extractAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    });
  }
  return keys;
}

// NekhemjlekhiinTuukh Excel Download
exports.downloadNekhemjlekhiinTuukhExcel = asyncHandler(
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

      const tukhainBaaziinKholbolt = req.body.tukhainBaaziinKholbolt;
      if (!tukhainBaaziinKholbolt) {
        throw new aldaa("Холболтын мэдээлэл олдсонгүй!");
      }

      const { baiguullagiinId, barilgiinId, filters } = req.body;

      // Build query
      const query = {};
      if (baiguullagiinId) query.baiguullagiinId = baiguullagiinId;
      if (barilgiinId) query.barilgiinId = barilgiinId;

      // Apply additional filters if provided
      if (filters) {
        Object.assign(query, filters);
      }

      // Fetch nekhemjlekhiinTuukh data
      const nekhemjlekhiinTuukhList = await NekhemjlekhiinTuukh(
        tukhainBaaziinKholbolt
      )
        .find(query)
        .lean()
        .sort({ createdAt: -1 });

      if (!nekhemjlekhiinTuukhList || nekhemjlekhiinTuukhList.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Нэхэмжлэхийн мэдээлэл олдсонгүй",
        });
      }

      // Format data with only required columns: №, Нэр, Гэрээний дугаар, Төлбөр, Төлөв
      const formattedData = nekhemjlekhiinTuukhList.map((item, index) => ({
        dugaar: index + 1, // № (row number)
        ner: item.ner || "", // Нэр (name)
        gereeniiDugaar: item.gereeniiDugaar || "", // Гэрээний дугаар (contract number)
        tulbur: item.niitTulbur || 0, // Төлбөр (payment amount)
        tuluv: item.tuluv || "", // Төлөв (status)
      }));

      // Set data for download with specific headers
      req.body.data = formattedData;
      req.body.headers = [
        { key: "dugaar", label: "№" },
        { key: "ner", label: "Нэр" },
        { key: "gereeniiDugaar", label: "Гэрээний дугаар" },
        { key: "tulbur", label: "Төлбөр" },
        { key: "tuluv", label: "Төлөв" },
      ];
      req.body.fileName =
        req.body.fileName || `nekhemjlekhiinTuukh_${Date.now()}`;
      req.body.sheetName = req.body.sheetName || "Нэхэмжлэх";
      req.body.colWidths = [10, 25, 20, 15, 15]; // Column widths

      // Call downloadExcelList function directly
      return exports.downloadExcelList(req, res, next);
    } catch (error) {
      console.error("Error downloading nekhemjlekhiinTuukh Excel:", error);
      next(error);
    }
  }
);

// Ebarimt Excel Download
exports.downloadEbarimtExcel = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const EbarimtShine = require("../models/ebarimtShine");

    const tukhainBaaziinKholbolt = req.body.tukhainBaaziinKholbolt;
    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Холболтын мэдээлэл олдсонгүй!");
    }

    const { baiguullagiinId, barilgiinId, filters } = req.body;

    // Build query
    const query = {};
    if (baiguullagiinId) query.baiguullagiinId = baiguullagiinId;
    if (barilgiinId) query.barilgiinId = barilgiinId;

    // Apply additional filters if provided
    if (filters) {
      Object.assign(query, filters);
    }

    // Fetch ebarimt data
    const ebarimtList = await EbarimtShine(tukhainBaaziinKholbolt)
      .find(query)
      .lean()
      .sort({ createdAt: -1 });

    if (!ebarimtList || ebarimtList.length === 0) {
      return res.status(404).json({
        success: false,
        message: "E-Barimt мэдээлэл олдсонгүй",
      });
    }

    // Set data for download
    req.body.data = ebarimtList;
    req.body.fileName = req.body.fileName || `ebarimt_${Date.now()}`;
    req.body.sheetName = req.body.sheetName || "E-Barimt";

    // Call downloadExcelList function directly
    return exports.downloadExcelList(req, res, next);
  } catch (error) {
    console.error("Error downloading ebarimt Excel:", error);
    next(error);
  }
});

// BankniiGuilgee Excel Download
exports.downloadBankniiGuilgeeExcel = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const BankniiGuilgee = require("../models/bankniiGuilgee");

    const tukhainBaaziinKholbolt = req.body.tukhainBaaziinKholbolt;
    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Холболтын мэдээлэл олдсонгүй!");
    }

    const {
      baiguullagiinId,
      barilgiinId,
      filters,
      historical = false,
    } = req.body;

    // Build query
    const query = {};
    if (baiguullagiinId) query.baiguullagiinId = baiguullagiinId;
    if (barilgiinId) query.barilgiinId = barilgiinId;

    // Apply additional filters if provided
    if (filters) {
      Object.assign(query, filters);
    }

    // Fetch bankniiGuilgee data
    const bankniiGuilgeeList = await BankniiGuilgee(
      tukhainBaaziinKholbolt,
      historical
    )
      .find(query)
      .lean()
      .sort({ tranDate: -1 });

    if (!bankniiGuilgeeList || bankniiGuilgeeList.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Банкны гүйлгээний мэдээлэл олдсонгүй",
      });
    }

    // Fetch Dans (account registry) information for all unique combinations of baiguullagiinId and dansniiDugaar
    const { Dans } = require("zevbackv2");
    const dansModel = Dans(tukhainBaaziinKholbolt);

    // Get unique combinations of baiguullagiinId and dansniiDugaar
    const uniqueDansCombinations = new Map();
    bankniiGuilgeeList.forEach((item) => {
      if (item.dansniiDugaar && item.baiguullagiinId) {
        const key = `${item.baiguullagiinId}_${item.dansniiDugaar}`;
        if (!uniqueDansCombinations.has(key)) {
          uniqueDansCombinations.set(key, {
            baiguullagiinId: item.baiguullagiinId,
            dansniiDugaar: item.dansniiDugaar,
          });
        }
      }
    });

    // Create a map of baiguullagiinId_dansniiDugaar -> dans field from Dans model
    const dansMap = {};
    for (const [key, combo] of uniqueDansCombinations) {
      try {
        const dans = await dansModel
          .findOne({
            baiguullagiinId: combo.baiguullagiinId.toString(),
            dugaar: combo.dansniiDugaar,
          })
          .lean();

        if (dans) {
          // Use 'dugaar' field from Dans model (account number), not dans or dansniiNer which are names
          dansMap[key] = dans.dugaar || "";
        }
      } catch (dansError) {
        console.error(`Error fetching dans for ${key}:`, dansError);
        dansMap[key] = "";
      }
    }

    // Format data with only required columns: №, Огноо, Гүйлгээний утга, Гүйлгээний дүн, Шилжүүлсэн данс
    const formattedData = bankniiGuilgeeList.map((item, index) => ({
      dugaar: index + 1, // № (row number)
      ognoo: item.tranDate
        ? new Date(item.tranDate).toISOString().split("T")[0]
        : "", // Огноо (date)
      guilgeeniiUtga: item.description || "", // Гүйлгээний утга (transaction description)
      guilgeeniiDun: item.amount || 0, // Гүйлгээний дүн (transaction amount)
      shiljuulsenDans:
        item.dansniiDugaar && item.baiguullagiinId
          ? dansMap[`${item.baiguullagiinId}_${item.dansniiDugaar}`] || ""
          : item.relatedAccount || "", // Шилжүүлсэн данс (from Dans model dans field)
    }));

    // Set data for download with specific headers
    req.body.data = formattedData;
    req.body.headers = [
      { key: "dugaar", label: "№" },
      { key: "ognoo", label: "Огноо" },
      { key: "guilgeeniiUtga", label: "Гүйлгээний утга" },
      { key: "guilgeeniiDun", label: "Гүйлгээний дүн" },
      { key: "shiljuulsenDans", label: "Шилжүүлсэн данс" },
    ];
    req.body.fileName = req.body.fileName || `bankniiGuilgee_${Date.now()}`;
    req.body.sheetName = req.body.sheetName || "Банкны гүйлгээ";
    req.body.colWidths = [10, 15, 40, 15, 20]; // Column widths

    // Call downloadExcelList function directly
    return exports.downloadExcelList(req, res, next);
  } catch (error) {
    console.error("Error downloading bankniiGuilgee Excel:", error);
    next(error);
  }
});

// GuilgeeniiTuukh Excel Download (combines geree, orshinSuugch, nekhemjlekhiinTuukh)
exports.downloadGuilgeeniiTuukhExcel = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");
    const OrshinSuugch = require("../models/orshinSuugch");
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    const tukhainBaaziinKholbolt = req.body.tukhainBaaziinKholbolt;
    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Холболтын мэдээлэл олдсонгүй!");
    }

    const { baiguullagiinId, barilgiinId, gereeniiId, filters } = req.body;

    // Build query for geree
    const gereeQuery = {};
    if (baiguullagiinId) gereeQuery.baiguullagiinId = baiguullagiinId;
    if (barilgiinId) gereeQuery.barilgiinId = barilgiinId;
    if (gereeniiId) gereeQuery._id = gereeniiId;

    // Apply additional filters if provided
    if (filters) {
      Object.assign(gereeQuery, filters);
    }

    // Fetch geree records
    const gereeList = await Geree(tukhainBaaziinKholbolt)
      .find(gereeQuery)
      .lean()
      .sort({ createdAt: -1 });

    if (!gereeList || gereeList.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Гэрээний мэдээлэл олдсонгүй",
      });
    }

    // Expand guilgeenuud and join with related data
    // Note: guilgeenuud might be nested in avlagiinTurul or directly on geree
    const guilgeeniiTuukhList = [];

    for (const geree of gereeList) {
      // Check both geree.guilgeenuud and geree.avlagiinTurul?.guilgeenuud
      let guilgeenuud = geree.guilgeenuud;
      if (
        !guilgeenuud &&
        geree.avlagiinTurul &&
        geree.avlagiinTurul.guilgeenuud
      ) {
        guilgeenuud = geree.avlagiinTurul.guilgeenuud;
      }

      // If no guilgeenuud, create one entry per geree with nekhemjlekhiinTuukh data
      if (
        !guilgeenuud ||
        !Array.isArray(guilgeenuud) ||
        guilgeenuud.length === 0
      ) {
        // Create one row per geree even if no guilgeenuud exists
        const guilgeenuudArray = [{}]; // Empty guilgee object
        guilgeenuud = guilgeenuudArray;
      }

      if (Array.isArray(guilgeenuud) && guilgeenuud.length > 0) {
        // Get orshinSuugch data
        let orshinSuugch = null;
        if (geree.orshinSuugchId) {
          orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
            .findById(geree.orshinSuugchId)
            .lean();
        }

        // Get nekhemjlekhiinTuukh data
        let nekhemjlekhiinTuukh = null;
        if (geree._id) {
          nekhemjlekhiinTuukh = await NekhemjlekhiinTuukh(
            tukhainBaaziinKholbolt
          )
            .findOne({ gereeniiId: geree._id.toString() })
            .lean()
            .sort({ createdAt: -1 });
        }

        // Expand each guilgee entry
        for (const guilgee of guilgeenuud) {
          guilgeeniiTuukhList.push({
            // Geree fields
            gereeniiId: geree._id?.toString(),
            gereeniiDugaar: geree.gereeniiDugaar,
            gereeniiOgnoo: geree.gereeniiOgnoo,
            gereeOvog: geree.ovog,
            gereeNer: geree.ner,
            gereeUtas: Array.isArray(geree.utas)
              ? geree.utas.join(", ")
              : geree.utas,
            gereeMail: geree.mail,
            gereeBairNer: geree.bairNer,
            gereeDavkhar: geree.davkhar,
            gereeToot: geree.toot,
            gereeBaiguullagiinNer: geree.baiguullagiinNer,

            // OrshinSuugch fields
            orshinSuugchNer: orshinSuugch?.ner || "",
            orshinSuugchOvog: orshinSuugch?.ovog || "",
            orshinSuugchUtas: orshinSuugch?.utas || "",
            orshinSuugchMail: orshinSuugch?.mail || "",

            // NekhemjlekhiinTuukh fields
            nekhemjlekhiinDugaar: nekhemjlekhiinTuukh?.dugaalaltDugaar || "",
            nekhemjlekhiinOgnoo: nekhemjlekhiinTuukh?.nekhemjlekhiinOgnoo || "",
            nekhemjlekhiinTuluv: nekhemjlekhiinTuukh?.tuluv || "",
            nekhemjlekhiinNiitTulbur: nekhemjlekhiinTuukh?.niitTulbur || 0,

            // Guilgee fields
            guilgeeniiOgnoo: guilgee.ognoo,
            guilgeeniiTurul: guilgee.turul,
            guilgeeniiTailbar: guilgee.tailbar,
            guilgeeniiNemeltTailbar: guilgee.nemeltTailbar,
            guilgeeniiUndsenDun: guilgee.undsenDun || 0,
            guilgeeniiTulukhDun: guilgee.tulukhDun || 0,
            guilgeeniiTulukhAldangi: guilgee.tulukhAldangi || 0,
            guilgeeniiTulsunDun: guilgee.tulsunDun || 0,
            guilgeeniiTulsunAldangi: guilgee.tulsunAldangi || 0,
            guilgeeniiUldegdel: guilgee.uldegdel || 0,
            guilgeeniiTariff: guilgee.tariff || 0,
            guilgeeniiZardliinTurul: guilgee.zardliinTurul || "",
            guilgeeniiZardliinNer: guilgee.zardliinNer || "",
            guilgeeniiKhiisenAjiltniiNer:
              guilgee.guilgeeKhiisenAjiltniiNer || "",
            guilgeeniiKhiisenOgnoo: guilgee.guilgeeKhiisenOgnoo,
          });
        }
      }
    }

    if (guilgeeniiTuukhList.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Гүйлгээний мэдээлэл олдсонгүй",
      });
    }

    // Format data with only required columns: №, Нэр, Гэрээний дугаар, Төлбөр, Төлөв
    const formattedData = guilgeeniiTuukhList.map((item, index) => ({
      dugaar: index + 1, // № (row number)
      ner: item.gereeNer || item.orshinSuugchNer || "", // Нэр (name from geree or orshinSuugch)
      gereeniiDugaar: item.gereeniiDugaar || "", // Гэрээний дугаар (contract number)
      tulbur: item.guilgeeniiTulukhDun || item.nekhemjlekhiinNiitTulbur || 0, // Төлбөр (payment amount)
      tuluv: item.nekhemjlekhiinTuluv || "", // Төлөв (status)
    }));

    // Set data for download with specific headers
    req.body.data = formattedData;
    req.body.headers = [
      { key: "dugaar", label: "№" },
      { key: "ner", label: "Нэр" },
      { key: "gereeniiDugaar", label: "Гэрээний дугаар" },
      { key: "tulbur", label: "Төлбөр" },
      { key: "tuluv", label: "Төлөв" },
    ];
    req.body.fileName = req.body.fileName || `guilgeeniiTuukh_${Date.now()}`;
    req.body.sheetName = req.body.sheetName || "Гүйлгээний түүх";
    req.body.colWidths = [10, 25, 20, 15, 15]; // Column widths

    // Call downloadExcelList function directly
    return exports.downloadExcelList(req, res, next);
  } catch (error) {
    console.error("Error downloading guilgeeniiTuukh Excel:", error);
    next(error);
  }
});

exports.downloadExcelList = asyncHandler(async (req, res, next) => {
  try {
    const { data, headers, fileName, sheetName, colWidths } = req.body;

    if (!data || !Array.isArray(data)) {
      throw new aldaa("Мэдээлэл оруулах шаардлагатай!");
    }

    let headerLabels = [];
    let headerKeys = [];

    if (headers && Array.isArray(headers) && headers.length > 0) {
      headers.forEach((h) => {
        if (typeof h === "string") {
          headerKeys.push(h);
          headerLabels.push(h);
        } else if (typeof h === "object" && h !== null) {
          headerKeys.push(h.key || h.field || "");
          headerLabels.push(h.label || h.key || h.field || "");
        }
      });
    } else {
      // Require headers to be specified - don't extract all keys automatically
      throw new aldaa(
        "'headers' заавал зааж өгөх шаардлагатай! (headers: [{key: 'field', label: 'Label'}] эсвэл ['field1', 'field2'])"
      );
    }

    // Helper function to format row data
    const formatRow = (item) => {
      return headerKeys.map((key) => {
        let value;
        if (key.includes(".")) {
          value = key.split(".").reduce((obj, prop) => {
            if (obj && obj[prop] !== undefined) {
              return obj[prop];
            }
            return null;
          }, item);
        } else {
          value = item[key];
        }

        if (value === null || value === undefined) {
          return "";
        }
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        if (typeof value === "object" && !(value instanceof Date)) {
          if (value.ner && value.kod) {
            return `${value.ner} (${value.kod})`;
          }
          return JSON.stringify(value);
        }
        if (value instanceof Date) {
          return value.toISOString().split("T")[0];
        }
        return String(value);
      });
    };

    const wb = XLSX.utils.book_new();

    // Check if data has barilgiinId field and separate by it
    const hasBarilgiinId = data.some(
      (item) =>
        item &&
        item.barilgiinId !== undefined &&
        item.barilgiinId !== null &&
        item.barilgiinId !== ""
    );

    if (hasBarilgiinId) {
      // Group data by barilgiinId
      const groupedData = {};
      data.forEach((item) => {
        const barilgiinId = item?.barilgiinId || "Бусад";
        if (!groupedData[barilgiinId]) {
          groupedData[barilgiinId] = [];
        }
        groupedData[barilgiinId].push(item);
      });

      // Create a sheet for each barilgiinId
      const barilgiinIds = Object.keys(groupedData).sort();
      barilgiinIds.forEach((barilgiinId, index) => {
        const groupData = groupedData[barilgiinId];
        const rows = groupData.map(formatRow);

        const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);

        if (colWidths && Array.isArray(colWidths)) {
          ws["!cols"] = colWidths.map((w) => ({
            wch: typeof w === "number" ? w : 15,
          }));
        } else {
          ws["!cols"] = headerLabels.map(() => ({ wch: 15 }));
        }

        // Create sheet name from barilgiinId (Excel sheet names have limitations)
        let sheetNameForBarilga = barilgiinId;
        if (sheetNameForBarilga.length > 31) {
          sheetNameForBarilga = sheetNameForBarilga.substring(0, 28) + "...";
        }
        // Replace invalid characters for Excel sheet names
        sheetNameForBarilga = sheetNameForBarilga.replace(
          /[\\\/\?\*\[\]:]/g,
          "_"
        );

        // If we have a base sheetName, use it with barilgiinId
        const finalSheetName = sheetName
          ? `${sheetName}_${index + 1}`
          : barilgiinIds.length > 1
          ? sheetNameForBarilga
          : sheetName || "Sheet1";

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
      });
    } else {
      // No barilgiinId, create single sheet as before
      const rows = data.map(formatRow);
      const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);

      if (colWidths && Array.isArray(colWidths)) {
        ws["!cols"] = colWidths.map((w) => ({
          wch: typeof w === "number" ? w : 15,
        }));
      } else {
        ws["!cols"] = headerLabels.map(() => ({ wch: 15 }));
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");
    }

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
    const headers = ["Овог", "Нэр", "Утас", "Имэйл", "Давхар", "Тоот", "Орц"];

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

    // Note: ashiglaltiinZardluudData will be fetched per row from baiguullaga.barilguud[].tokhirgoo

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
          toot: row["Тоот"]?.toString().trim() || "",
          orts: row["Орц"]?.toString().trim() || "",
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

        // Get ashiglaltiinZardluud and liftShalgaya from baiguullaga.barilguud[].tokhirgoo
        const targetBarilgaForRow = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(finalBarilgiinId)
        );

        const ashiglaltiinZardluudData =
          targetBarilgaForRow?.tokhirgoo?.ashiglaltiinZardluud || [];
        const liftShalgayaData = targetBarilgaForRow?.tokhirgoo?.liftShalgaya;
        const choloolugdokhDavkhar =
          liftShalgayaData?.choloolugdokhDavkhar || [];

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
          bairniiNer: targetBarilga.ner || "",
          toot: userData.toot || "",
          orts: userData.orts || "",
        };

        const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userObject);
        await orshinSuugch.save();

        // Include all charges for the baiguullaga (same as regular registration)
        // Don't filter by barilgiinId - all charges should be included
        // The barilgiinId in zardal is just for tracking which building it came from
        const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
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

        const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
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

        // Update davkhar with toot if provided
        if (userObject.toot && userData.davkhar) {
          const { updateDavkharWithToot } = require("./orshinSuugch");
          await updateDavkharWithToot(
            baiguullaga,
            finalBarilgiinId,
            userData.davkhar,
            userObject.toot,
            tukhainBaaziinKholbolt
          );
        }

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
      message: `${results.success.length} хэрэглэгчийн бүртгэл амжилттай орлоо, ${results.failed.length} хэрэглэгчийн бүртгэл алдаатай байна`,
      result: results,
    });
  } catch (error) {
    console.error("Excel оруулахад алдаа гарлаа:", error);
    next(error);
  }
});
