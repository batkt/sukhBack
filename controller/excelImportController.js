const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const aldaa = require("../components/aldaa");
const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
const walletApiService = require("../services/walletApiService");

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
    // Building detection is automatic based on davkhar + orts + toot combination
    const headers = ["Овог", "Нэр", "Утас", "Имэйл", "Орц", "Давхар", "Тоот", "Эхний үлдэгдэл", "Цахилгаан кВт", "Тайлбар"];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    const colWidths = [
      { wch: 15 }, // Овог
      { wch: 15 }, // Нэр
      { wch: 12 }, // Утас
      { wch: 25 }, // Имэйл
      { wch: 10 }, // Орц
      { wch: 10 }, // Давхар
      { wch: 10 }, // Тоот
      { wch: 15 }, // Эхний үлдэгдэл
      { wch: 15 }, // Цахилгаан кВт
      { wch: 30 }, // Тайлбар
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
      throw new aldaa("Байгууллагын ID хоосон");
    }

    if (!req.file) {
      throw new aldaa("Excel файл оруулах");
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!data || data.length === 0) {
      throw new aldaa("Excel хоосон");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллага олдсонгүй");
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
      throw new aldaa("Холболт олдсонгүй");
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
        // Get initial electricity reading from Excel (optional, defaults to 0)
        const tsahilgaaniiZaalt = row["Цахилгаан кВт"] !== undefined && row["Цахилгаан кВт"] !== null && row["Цахилгаан кВт"] !== ""
          ? parseFloat(row["Цахилгаан кВт"]) || 0
          : 0; // Default to 0 кВт if not provided

        const userData = {
          ovog: row["Овог"]?.toString().trim() || "",
          ner: row["Нэр"]?.toString().trim() || "",
          utas: row["Утас"]?.toString().trim() || "",
          mail: row["Имэйл"]?.toString().trim() || "",
          davkhar: row["Давхар"]?.toString().trim() || "",
          toot: row["Тоот"]?.toString().trim() || "",
          orts: row["Орц"]?.toString().trim() || "",
          ekhniiUldegdel: row["Эхний үлдэгдэл"] ? parseFloat(row["Эхний үлдэгдэл"]) || 0 : 0,
          tsahilgaaniiZaalt: tsahilgaaniiZaalt, // Initial electricity reading
          tailbar: row["Тайлбар"]?.toString().trim() || "",
        };

        const validationErrors = [];

       

        if (!userData.ner || userData.ner.length === 0) {
          validationErrors.push("Нэр");
        }

        if (!userData.utas || userData.utas.length === 0) {
          validationErrors.push("Утас");
        } else {
          userData.utas = userData.utas.replace(/\s/g, "");
          if (userData.utas.length === 0) {
            validationErrors.push("Утас");
          } else if (!/^\d+$/.test(userData.utas)) {
            validationErrors.push("Утас буруу");
          } else if (userData.utas.length !== 8) {
            validationErrors.push("Утас 8 орон");
          }
        }

        if (!userData.davkhar || userData.davkhar.length === 0) {
          validationErrors.push("Давхар");
        } else {
          userData.davkhar = userData.davkhar.replace(/\s/g, "");
          if (userData.davkhar.length === 0) {
            validationErrors.push("Давхар");
          } else if (!/^\d+$/.test(userData.davkhar)) {
            validationErrors.push("Давхар буруу");
          }
        }

        if (!userData.toot || userData.toot.length === 0) {
          validationErrors.push("Тоот");
        } else {
          userData.toot = userData.toot.trim();
          if (userData.toot.length === 0) {
            validationErrors.push("Тоот");
          }
        }

        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(", ") + " хоосон эсвэл буруу");
        }

        // Determine the correct building for this user
        // Priority: 1) Excel "Барилга" column, 2) Match davkhar+orts+toot combination, 3) Default
        let finalBarilgiinId = barilgiinId || defaultBarilgiinId;

        // Check if Excel has "Барилга" or "Барилгын ID" column
        const excelBarilgaName =
          row["Барилга"]?.toString().trim() ||
          row["Барилгын нэр"]?.toString().trim() ||
          "";
        const excelBarilgiinId = row["Барилгын ID"]?.toString().trim() || "";

        if (excelBarilgiinId) {
          // If barilgiinId is provided in Excel, use it
          const matchingBarilga = baiguullaga.barilguud?.find(
            (b) => String(b._id) === String(excelBarilgiinId)
          );
          if (matchingBarilga) {
            finalBarilgiinId = String(matchingBarilga._id);
            console.log(
              `✅ Using building from Excel column: ${matchingBarilga.ner} (${finalBarilgiinId})`
            );
          }
        } else if (excelBarilgaName) {
          // If building name is provided in Excel, find by name
          const matchingBarilga = baiguullaga.barilguud?.find(
            (b) => String(b.ner).trim() === excelBarilgaName
          );
          if (matchingBarilga) {
            finalBarilgiinId = String(matchingBarilga._id);
            console.log(
              `✅ Found building by name from Excel: ${matchingBarilga.ner} (${finalBarilgiinId})`
            );
          }
        } else if (
          userData.toot &&
          userData.davkhar &&
          baiguullaga.barilguud &&
          baiguullaga.barilguud.length > 1
        ) {
          // Match based on davkhar + orts + toot combination
          // This ensures we find the exact building even if multiple buildings have the same toot
          // Support comma-separated toots like "101,69,1,2"
          const tootRaw = userData.toot.trim();
          const tootListToFind = tootRaw
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t && t.length > 0);
          
          const davkharToFind = userData.davkhar.trim();
          const ortsToFind = (userData.orts || "1").trim(); // Default to "1" if not provided
          const floorKey = `${ortsToFind}::${davkharToFind}`;

          let foundBuilding = null;
          let matchedToot = null;

          // Search through all buildings to find which one contains this exact combination
          for (const barilga of baiguullaga.barilguud) {
            const davkhariinToonuud =
              barilga.tokhirgoo?.davkhariinToonuud || {};

            // First, try exact floorKey match (orts::davkhar)
            if (davkhariinToonuud[floorKey]) {
              const tootArray = davkhariinToonuud[floorKey];

              if (
                tootArray &&
                Array.isArray(tootArray) &&
                tootArray.length > 0
              ) {
                let tootList = [];

                // Handle both formats: comma-separated string or array of strings
                if (
                  typeof tootArray[0] === "string" &&
                  tootArray[0].includes(",")
                ) {
                  tootList = tootArray[0]
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t);
                } else {
                  tootList = tootArray
                    .map((t) => String(t).trim())
                    .filter((t) => t);
                }

                // Check if ANY of the toots in tootListToFind is found in this building's tootList
                for (const tootToFind of tootListToFind) {
                  if (tootList.includes(tootToFind)) {
                    foundBuilding = barilga;
                    matchedToot = tootToFind;
                    break;
                  }
                }
              }
            }

            if (foundBuilding) {
              break;
            }
          }

          if (foundBuilding) {
            finalBarilgiinId = String(foundBuilding._id);
            console.log(
              `✅ Found building ${foundBuilding.ner} (${finalBarilgiinId}) for davkhar=${davkharToFind}, orts=${ortsToFind}, toot=${matchedToot} (from list: ${tootListToFind.join(", ")})`
            );
          } else {
            console.log(
              `⚠️  Could not find building for davkhar=${davkharToFind}, orts=${ortsToFind}, toot=${tootRaw}, using default: ${finalBarilgiinId}`
            );
          }
        }

        // Integrate with Wallet API (same as website and mobile registration)
        // This ensures Excel-imported users are unified with website/mobile users
        const phoneNumber = userData.utas;
        let walletUserInfo = null;
        let walletUserId = null;

        // Try to integrate with Wallet API if email is provided
        if (userData.mail && userData.mail.trim()) {
          try {
            const email = userData.mail.trim();
            
            // First, try to get existing user from Wallet API
            console.log(`📞 [EXCEL IMPORT] Row ${rowNumber}: Checking Wallet API for user ${phoneNumber}...`);
            walletUserInfo = await walletApiService.getUserInfo(phoneNumber);

            if (walletUserInfo && walletUserInfo.userId) {
              // User exists in Wallet API
              walletUserId = walletUserInfo.userId;
              console.log(`✅ [EXCEL IMPORT] Row ${rowNumber}: User found in Wallet API: ${walletUserId}`);
            } else {
              // User doesn't exist in Wallet API, register them
              console.log(`📞 [EXCEL IMPORT] Row ${rowNumber}: Registering user in Wallet API...`);
              walletUserInfo = await walletApiService.registerUser(phoneNumber, email);

              if (walletUserInfo && walletUserInfo.userId) {
                walletUserId = walletUserInfo.userId;
                console.log(`✅ [EXCEL IMPORT] Row ${rowNumber}: User registered in Wallet API: ${walletUserId}`);
              } else {
                console.warn(`⚠️ [EXCEL IMPORT] Row ${rowNumber}: Wallet API registration failed, continuing without walletUserId`);
              }
            }
          } catch (walletError) {
            console.error(`❌ [EXCEL IMPORT] Row ${rowNumber}: Wallet API error:`, walletError.message);
            // Continue without Wallet API integration if it fails
            console.warn(`⚠️ [EXCEL IMPORT] Row ${rowNumber}: Continuing without Wallet API integration`);
          }
        } else {
          console.log(`ℹ️ [EXCEL IMPORT] Row ${rowNumber}: No email provided, skipping Wallet API integration`);
        }

        // Check if user already exists (by phone number OR walletUserId - unified check)
        const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
          $or: [
            { utas: phoneNumber },
            ...(walletUserId ? [{ walletUserId: walletUserId }] : [])
          ]
        });

        // Multiple users can have the same toot, so no unique toot check needed
        // Toot validation will be done when adding to toots array

        const targetBarilga = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(finalBarilgiinId)
        );

        if (!targetBarilga) {
          throw new Error("Барилга олдсонгүй");
        }

        if (userData.toot && userData.davkhar) {
          // Support comma-separated toots like "101,69,1,2"
          const tootRaw = userData.toot.trim();
          const tootListToValidate = tootRaw
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t && t.length > 0);
          
          const davkharToValidate = userData.davkhar.trim();
          const ortsToValidate = (userData.orts || "1").trim();
          const floorKey = `${ortsToValidate}::${davkharToValidate}`;

          const davkhariinToonuud = targetBarilga.tokhirgoo?.davkhariinToonuud || {};
          let tootArray = davkhariinToonuud[floorKey];
          let foundToonuud = [];

          // First, try exact floorKey match
          if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
            let registeredToonuud = [];
            
            if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
              registeredToonuud = tootArray[0]
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t);
            } else {
              registeredToonuud = tootArray
                .map((t) => String(t).trim())
                .filter((t) => t);
            }

            // Validate each toot in the comma-separated list
            for (const tootToValidate of tootListToValidate) {
              if (registeredToonuud.includes(tootToValidate)) {
                foundToonuud.push(tootToValidate);
              }
            }
          }

          // If no toots were found, log warning but allow import to proceed
          if (foundToonuud.length === 0) {
            console.log(`⚠️  [EXCEL IMPORT] Row ${rowNumber}: Бүртгэлгүй тоот байна: ${tootListToValidate.join(", ")}. Import will proceed with provided toot values.`);
          } else if (foundToonuud.length < tootListToValidate.length) {
            // Log which toots were found and which were not
            const notFound = tootListToValidate.filter(t => !foundToonuud.includes(t));
            console.log(`⚠️  [EXCEL IMPORT] Row ${rowNumber}: Some toots not found: ${notFound.join(", ")}. Found: ${foundToonuud.join(", ")}. Import will proceed with all provided toot values.`);
          }
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
          mail: walletUserInfo?.email || userData.mail || "", // Use email from Wallet API if available
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
          toot: userData.toot || "", // Keep for backward compatibility
          orts: userData.orts || "",
          ekhniiUldegdel: userData.ekhniiUldegdel || 0,
          tsahilgaaniiZaalt: userData.tsahilgaaniiZaalt || 0, // Save electricity reading from Excel
          tailbar: userData.tailbar || "", // Save tailbar to orshinSuugch
          toots: [], // Initialize toots array
          // Link to Wallet API (unifies Excel-imported users with website/mobile users)
          ...(walletUserId ? { walletUserId: walletUserId } : {})
        };
        
        console.log(`⚡ [EXCEL IMPORT] Setting tsahilgaaniiZaalt in userObject:`, userObject.tsahilgaaniiZaalt);

        // If user already exists, update it; otherwise create new
        let orshinSuugch;
        if (existingUser) {
          orshinSuugch = existingUser;
          // Update basic info
          Object.assign(orshinSuugch, {
            ovog: userObject.ovog,
            ner: userObject.ner,
            mail: userObject.mail,
            baiguullagiinId: userObject.baiguullagiinId,
            baiguullagiinNer: userObject.baiguullagiinNer,
            barilgiinId: userObject.barilgiinId,
            duureg: userObject.duureg,
            horoo: userObject.horoo,
            soh: userObject.soh,
            davkhar: userObject.davkhar,
            bairniiNer: userObject.bairniiNer,
            toot: userObject.toot,
            orts: userObject.orts,
            ekhniiUldegdel: userObject.ekhniiUldegdel,
            tsahilgaaniiZaalt: userObject.tsahilgaaniiZaalt, // Update electricity reading
            tailbar: userObject.tailbar,
            // Update walletUserId if we got it from Wallet API
            ...(walletUserId ? { walletUserId: walletUserId } : {})
          });
          
          console.log(`⚡ [EXCEL IMPORT] Updated existing user with tsahilgaaniiZaalt:`, orshinSuugch.tsahilgaaniiZaalt);
          // Initialize toots array if it doesn't exist
          if (!orshinSuugch.toots) {
            orshinSuugch.toots = [];
          }
        } else {
          orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userObject);
        }

        // Add toot(s) to toots array if provided
        // Support comma-separated toots like "101,69,1,2"
        if (userData.toot && finalBarilgiinId) {
          // Split comma-separated toots
          const tootRaw = userData.toot.trim();
          const tootList = tootRaw
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t && t.length > 0); // Filter out empty strings
          
          console.log(`🔍 [EXCEL IMPORT] Raw toot: "${tootRaw}", Split into:`, tootList);
          
          // Create a toot entry for each toot
          for (const individualToot of tootList) {
            const tootEntry = {
              toot: individualToot,
              source: "OWN_ORG",
              baiguullagiinId: baiguullaga._id.toString(),
              barilgiinId: finalBarilgiinId,
              davkhar: userData.davkhar || "",
              orts: userData.orts || "1",
              duureg: duuregNer,
              horoo: horooData,
              soh: sohNer,
              bairniiNer: targetBarilga.ner || "",
              createdAt: new Date()
            };
            
            // Check if this toot already exists in user's toots array
            const existingTootIndex = orshinSuugch.toots?.findIndex(
              t => t.toot === tootEntry.toot && 
                   t.barilgiinId === tootEntry.barilgiinId
            );
            
            if (existingTootIndex >= 0) {
              // Update existing toot entry
              orshinSuugch.toots[existingTootIndex] = tootEntry;
              console.log(`🔄 [EXCEL IMPORT] Updated existing toot: ${individualToot}`);
            } else {
              // Add new toot to array
              orshinSuugch.toots.push(tootEntry);
              console.log(`➕ [EXCEL IMPORT] Added new toot: ${individualToot}`);
            }
          }
        }

        await orshinSuugch.save();
        
        // Verify tsahilgaaniiZaalt was saved
        const savedOrshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(orshinSuugch._id).select("tsahilgaaniiZaalt ner utas");
        console.log(`✅ [EXCEL IMPORT] Verified tsahilgaaniiZaalt saved to orshinSuugch:`, {
          ner: savedOrshinSuugch?.ner,
          utas: savedOrshinSuugch?.utas,
          tsahilgaaniiZaalt: savedOrshinSuugch?.tsahilgaaniiZaalt
        });

        // Create gerees for all OWN_ORG toots that don't have gerees yet
        if (orshinSuugch.toots && Array.isArray(orshinSuugch.toots) && orshinSuugch.toots.length > 0) {
          const ownOrgToots = orshinSuugch.toots.filter(t => t.source === "OWN_ORG" && t.baiguullagiinId && t.barilgiinId);
          
          for (const tootEntry of ownOrgToots) {
            try {
              console.log(`📋 [EXCEL IMPORT] Processing OWN_ORG toot: ${tootEntry.toot} for geree creation...`);
              
              // Check if geree already exists for this specific toot (user + barilgiinId + toot combination)
              const GereeModel = Geree(tukhainBaaziinKholbolt);
              const existingGeree = await GereeModel.findOne({
                orshinSuugchId: orshinSuugch._id.toString(),
                barilgiinId: tootEntry.barilgiinId,
                toot: tootEntry.toot,
                tuluv: { $ne: "Цуцалсан" } // Only check active gerees
              });

              if (existingGeree) {
                console.log(`ℹ️ [EXCEL IMPORT] Geree already exists for toot ${tootEntry.toot}:`, existingGeree._id);
                continue;
              }
              
              console.log(`📋 [EXCEL IMPORT] No active geree found for toot ${tootEntry.toot} - creating new geree...`);
              
              // Get ashiglaltiinZardluud from barilga
              const targetBarilgaForToot = baiguullaga.barilguud?.find(
                (b) => String(b._id) === String(tootEntry.barilgiinId)
              );

              if (!targetBarilgaForToot) {
                console.error(`❌ [EXCEL IMPORT] Target barilga not found for toot ${tootEntry.toot}`);
                continue;
              }

              const ashiglaltiinZardluudData = targetBarilgaForToot.tokhirgoo?.ashiglaltiinZardluud || [];
              const liftShalgayaData = targetBarilgaForToot.tokhirgoo?.liftShalgaya;
              const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

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
                barilgiinId: zardal.barilgiinId || tootEntry.barilgiinId || "",
              }));

              // Extract tailbar from ashiglaltiinZardluud (combine all tailbar values if multiple exist)
              const tailbarFromZardluud = ashiglaltiinZardluudData
                .map((zardal) => zardal.tailbar)
                .filter((tailbar) => tailbar && tailbar.trim())
                .join("; ") || "";

              const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
                const tariff = zardal.tariff || 0;
                const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                if (isLiftItem && tootEntry.davkhar && choloolugdokhDavkhar.includes(tootEntry.davkhar)) {
                  return total;
                }
                return total + tariff;
              }, 0);

              const duuregNer = targetBarilgaForToot.tokhirgoo?.duuregNer || tootEntry.duureg || "";
              const horooData = targetBarilgaForToot.tokhirgoo?.horoo || tootEntry.horoo || {};
              const horooNer = horooData.ner || "";
              const sohNer = targetBarilgaForToot.tokhirgoo?.sohNer || tootEntry.soh || "";

              // Create geree (contract) for this specific toot
              // Use timestamp + microsecond precision to ensure uniqueness
              const uniqueSuffix = Date.now() + i;
              const contractData = {
                gereeniiDugaar: `ГД-${uniqueSuffix.toString().slice(-8)}`,
                gereeniiOgnoo: new Date(),
                turul: "Үндсэн",
                tuluv: "Идэвхтэй",
                ovog: userData.ovog || "",
                ner: userData.ner,
                utas: [userData.utas],
                mail: userData.mail || "",
                baiguullagiinId: baiguullaga._id,
                baiguullagiinNer: baiguullaga.ner,
                barilgiinId: tootEntry.barilgiinId,
                tulukhOgnoo: new Date(),
                ashiglaltiinZardal: niitTulbur,
                niitTulbur: niitTulbur,
                toot: tootEntry.toot,
                davkhar: tootEntry.davkhar || "",
                bairNer: targetBarilgaForToot.ner || "",
                sukhBairshil: `${duuregNer}, ${horooNer}, ${sohNer}`,
                duureg: duuregNer,
                horoo: horooData,
                sohNer: sohNer,
                orts: tootEntry.orts || "",
                burtgesenAjiltan: orshinSuugch._id,
                orshinSuugchId: orshinSuugch._id.toString(),
                temdeglel: `${userData.tailbar || "Excel файлаас автоматаар үүссэн гэрээ"} (Тоот: ${tootEntry.toot})`,
                tailbar: userData.tailbar || tailbarFromZardluud || "",
                actOgnoo: new Date(),
                baritsaaniiUldegdel: 0,
                ekhniiUldegdel: userData.ekhniiUldegdel || 0,
                // Save initial electricity reading (will be used in invoice calculations)
                umnukhZaalt: userData.tsahilgaaniiZaalt || 0, // Previous reading (initial reading from Excel)
                suuliinZaalt: userData.tsahilgaaniiZaalt || 0, // Current reading (same as initial at import)
                zaaltTog: 0, // Day reading (will be updated later)
                zaaltUs: 0, // Night reading (will be updated later)
                zardluud: zardluudArray,
                segmentuud: [],
                khungulultuud: [],
              };

              const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
              await geree.save();
              console.log(`✅ [EXCEL IMPORT] Geree created for toot ${tootEntry.toot}:`, geree._id);

              // Update davkhar with toot if provided
              if (tootEntry.toot && tootEntry.davkhar) {
                const { updateDavkharWithToot } = require("./orshinSuugch");
                await updateDavkharWithToot(
                  baiguullaga,
                  tootEntry.barilgiinId,
                  tootEntry.davkhar,
                  tootEntry.toot,
                  tukhainBaaziinKholbolt
                );
                console.log(`✅ [EXCEL IMPORT] Davkhar updated with toot ${tootEntry.toot}`);
              }

              // Create invoice for this geree
              try {
                const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
                  geree,
                  baiguullaga,
                  tukhainBaaziinKholbolt,
                  "automataar"
                );

                if (!invoiceResult.success) {
                  console.error(
                    `❌ [EXCEL IMPORT] Invoice creation failed for toot ${tootEntry.toot}:`,
                    invoiceResult.error
                  );
                } else {
                  console.log(`✅ [EXCEL IMPORT] Invoice created for toot ${tootEntry.toot}`);
                }
              } catch (invoiceError) {
                console.error(
                  `❌ [EXCEL IMPORT] Error creating invoice for toot ${tootEntry.toot}:`,
                  invoiceError.message
                );
              }
            } catch (tootGereeError) {
              console.error(`❌ [EXCEL IMPORT] Error creating geree for toot ${tootEntry.toot}:`, tootGereeError.message);
              // Continue with next toot if this one fails
            }
          }
        } else {
          // Backward compatibility: if toots array is empty but old fields exist, create geree for primary toot
          console.log("📋 [EXCEL IMPORT] No toots array found, using backward compatibility mode...");
          
          // Include all charges for the baiguullaga (same as regular registration)
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

          // Extract tailbar from ashiglaltiinZardluud (combine all tailbar values if multiple exist)
          const tailbarFromZardluud = ashiglaltiinZardluudData
            .map((zardal) => zardal.tailbar)
            .filter((tailbar) => tailbar && tailbar.trim())
            .join("; ") || "";

          const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
            const tariff = zardal.tariff || 0;
            const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
            if (isLiftItem && userData.davkhar && choloolugdokhDavkhar.includes(userData.davkhar)) {
              return total;
            }
            return total + tariff;
          }, 0);

          // Use timestamp + microsecond precision to ensure uniqueness
          const uniqueSuffix = Date.now() + i;
          const contractData = {
            gereeniiDugaar: `ГД-${uniqueSuffix.toString().slice(-8)}`,
            gereeniiOgnoo: new Date(),
            turul: "Үндсэн",
            tuluv: "Идэвхтэй",
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
            temdeglel: userData.tailbar || "Excel файлаас автоматаар үүссэн гэрээ",
            tailbar: userData.tailbar || tailbarFromZardluud || "",
            actOgnoo: new Date(),
            baritsaaniiUldegdel: 0,
            ekhniiUldegdel: userData.ekhniiUldegdel || 0,
            // Save initial electricity reading (will be used in invoice calculations)
            umnukhZaalt: tsahilgaaniiZaalt, // Previous reading (initial reading at import)
            suuliinZaalt: tsahilgaaniiZaalt, // Current reading (same as initial at import)
            zaaltTog: 0, // Day reading (will be updated later)
            zaaltUs: 0, // Night reading (will be updated later)
            zardluud: zardluudArray,
            segmentuud: [],
            khungulultuud: [],
          };
          
          console.log(`⚡ [EXCEL IMPORT] Setting electricity readings in geree:`, {
            gereeniiDugaar: contractData.gereeniiDugaar,
            tsahilgaaniiZaalt: tsahilgaaniiZaalt,
            umnukhZaalt: contractData.umnukhZaalt,
            suuliinZaalt: contractData.suuliinZaalt
          });

          const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
          await geree.save();
          console.log(`✅ [EXCEL IMPORT] Geree created (backward compatibility):`, geree._id);

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
                `❌ [EXCEL IMPORT] Invoice creation failed for user ${userData.utas}:`,
                invoiceResult.error
              );
            }
          } catch (invoiceError) {
            console.error(
              `❌ [EXCEL IMPORT] Error creating invoice for user ${userData.utas}:`,
              invoiceError.message
            );
          }
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

// TootBurtgel Excel Template Download
exports.generateTootBurtgelExcelTemplate = asyncHandler(
  async (req, res, next) => {
    try {
      const headers = ["Давхар", "Орц", "Тоот"];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers]);

      const colWidths = [
        { wch: 12 }, // Давхар (floor)
        { wch: 12 }, // Орц (entrance)
        { wch: 15 }, // Тоот (apartment number)
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Тоот бүртгэл");

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
        `attachment; filename="tootBurtgel_import_template_${Date.now()}.xlsx"`
      );

      res.send(excelBuffer);
    } catch (error) {
      console.error("Error generating tootBurtgel Excel template:", error);
      next(error);
    }
  }
);

// TootBurtgel Excel Import
exports.importTootBurtgelFromExcel = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const TootBurtgel = require("../models/tootBurtgel");
    const Baiguullaga = require("../models/baiguullaga");
    const { updateDavkharWithToot } = require("./orshinSuugch");
    const { shalguurValidate } = require("../components/shalguur");

    const { baiguullagiinId, barilgiinId } = req.body;

    if (!baiguullagiinId) {
      throw new aldaa("Байгууллагын ID хоосон");
    }

    if (!req.file) {
      throw new aldaa("Excel файл оруулах");
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!data || data.length === 0) {
      throw new aldaa("Excel хоосон");
    }

    // Validate that this is a tootExcel file, not an orshinSuugch Excel file
    // Check the first row to see what columns are present
    const firstRow = data[0] || {};
    const columnNames = Object.keys(firstRow);
    
    // orshinSuugch Excel has these specific columns that tootExcel doesn't have
    const orshinSuugchColumns = ["Овог", "Нэр", "Утас", "Имэйл"];
    const hasOrshinSuugchColumns = orshinSuugchColumns.some(col => columnNames.includes(col));
    
    // tootExcel should have at least "Тоот" and "Давхар" columns
    const requiredTootColumns = ["Тоот", "Давхар"];
    const hasRequiredTootColumns = requiredTootColumns.every(col => columnNames.includes(col));
    
    if (hasOrshinSuugchColumns || !hasRequiredTootColumns) {
      throw new aldaa("Буруу файл байна");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллага олдсонгүй");
    }

    const defaultBarilgiinId =
      barilgiinId ||
      (baiguullaga.barilguud && baiguullaga.barilguud.length > 0
        ? String(baiguullaga.barilguud[0]._id)
        : null);

    if (!defaultBarilgiinId) {
      throw new aldaa("Барилгын ID олдсонгүй");
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
    );

    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Холболт олдсонгүй");
    }

    // Get target barilga
    const targetBarilga = baiguullaga.barilguud?.find(
      (b) => String(b._id) === String(defaultBarilgiinId)
    );

    if (!targetBarilga) {
      throw new aldaa("Барилга олдсонгүй");
    }

    // Get or initialize davkhar array and davkhariinToonuud object
    const barilgaIndex = baiguullaga.barilguud.findIndex(
      (b) => String(b._id) === String(defaultBarilgiinId)
    );

    if (!targetBarilga.tokhirgoo) {
      targetBarilga.tokhirgoo = {};
    }

    let davkharArray = targetBarilga.tokhirgoo.davkhar || [];
    let davkhariinToonuud = targetBarilga.tokhirgoo.davkhariinToonuud || {};

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const tootRaw = row["Тоот"]?.toString().trim() || "";
        const davkhar = row["Давхар"]?.toString().trim() || "";
        const orts = row["Орц"]?.toString().trim() || "";

        const validationErrors = [];

        if (!tootRaw) {
          validationErrors.push("Тоот хоосон");
        }

        if (!davkhar) {
          validationErrors.push("Давхар хоосон");
        }

        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(", "));
        }

        // Split toot by comma to handle multiple toots in one field (e.g., "1,2,3,4,5")
        // Split first, then validate each individual toot (commas are separators, not part of the toot value)
        // Use simple comma split - commas are the separator, not part of the value
        const tootList = tootRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && t.length > 0); // Filter out empty strings

        console.log("🔍 [TOOT IMPORT] Raw toot:", tootRaw);
        console.log("🔍 [TOOT IMPORT] Split tootList:", tootList);
        console.log("🔍 [TOOT IMPORT] tootList length:", tootList.length);

        if (tootList.length === 0) {
          throw new Error("Тоот хоосон");
        }

        // Validate each individual toot (after splitting, so commas are not in the individual toots)
        // Each toot should only contain alphanumeric, hyphens, and slashes
        for (const toot of tootList) {
          if (!toot || typeof toot !== "string") {
            validationErrors.push(`Тоот "${toot}" буруу форматтай байна`);
            continue;
          }
          console.log("🔍 [TOOT IMPORT] Validating individual toot:", toot);
          const tootValidationError = shalguurValidate(toot, "Тоот");
          if (tootValidationError) {
            console.log("❌ [TOOT IMPORT] Validation failed for toot:", toot, "Error:", tootValidationError);
            validationErrors.push(`${tootValidationError} (Тоот: "${toot}")`);
          } else {
            console.log("✅ [TOOT IMPORT] Validation passed for toot:", toot);
          }
        }

        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(" "));
        }

        // Create a separate tootBurtgel record for each toot
        const createdTootBurtgelIds = [];
        console.log("📝 [TOOT IMPORT] Creating", tootList.length, "tootBurtgel records...");
        for (const toot of tootList) {
          const tootBurtgelData = {
            kharagdakhDugaar: toot,
            zaalt: "",
            khamragdsanGereenuud: [],
            khamaarakhKheseg: "",
            ashilgakhEsekh: "",
            baiguullagiinId: baiguullaga._id.toString(),
            baiguullagiinNer: baiguullaga.ner || "",
            barilgiinId: defaultBarilgiinId || "",
          };

          // Save tootBurtgel
          const tootBurtgel = new TootBurtgel(tukhainBaaziinKholbolt)(
            tootBurtgelData
          );
          await tootBurtgel.save();
          createdTootBurtgelIds.push(tootBurtgel._id.toString());
          console.log("✅ [TOOT IMPORT] Created tootBurtgel for toot:", toot, "ID:", tootBurtgel._id.toString());
        }
        console.log("📝 [TOOT IMPORT] Total records created:", createdTootBurtgelIds.length);

        // Update davkhar and davkhariinToonuud if davkhar and orts are provided
        if (davkhar && tootList.length > 0) {
          const davkharStr = String(davkhar).trim();
          const ortsStr = orts ? String(orts).trim() : "1"; // Default to "1" if orts not provided

          // Create key format: "orts::davkhar" (e.g., "1::1", "1::2")
          const floorKey = `${ortsStr}::${davkharStr}`;

          // Ensure davkhar is in the array
          if (!davkharArray.includes(davkharStr)) {
            davkharArray.push(davkharStr);
            davkharArray.sort((a, b) => parseInt(a) - parseInt(b));
          }

          // Get or create toot array for this floor::entrance combination
          if (!davkhariinToonuud[floorKey]) {
            davkhariinToonuud[floorKey] = [];
          }

          // Get existing toot string for this floor::entrance
          const existingToonuud = davkhariinToonuud[floorKey][0] || "";
          let existingTootList = existingToonuud
            ? existingToonuud
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t)
            : [];

          // Add all toots from the list if not already present
          for (const toot of tootList) {
            if (!existingTootList.includes(toot)) {
              existingTootList.push(toot);
            }
          }

          // Sort toots
          existingTootList.sort((a, b) => {
            // Sort numerically if possible, otherwise alphabetically
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB;
            }
            return a.localeCompare(b);
          });

          // Update davkhariinToonuud - store as array with comma-separated string
          davkhariinToonuud[floorKey] = [existingTootList.join(",")];
        }

        results.success.push({
          row: rowNumber,
          toot: tootList.join(","), // Show all toots in result
          davkhar: davkhar || "",
          orts: orts || "",
          id: createdTootBurtgelIds.join(","), // Show all created IDs
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          error: error.message || "Алдаа гарлаа",
          data: row,
        });
      }
    }

    // Update baiguullaga with davkhar and davkhariinToonuud
    if (barilgaIndex >= 0) {
      const davkharPath = `barilguud.${barilgaIndex}.tokhirgoo.davkhar`;
      const toonuudPath = `barilguud.${barilgaIndex}.tokhirgoo.davkhariinToonuud`;

      await Baiguullaga(db.erunkhiiKholbolt).findByIdAndUpdate(
        baiguullaga._id,
        {
          $set: {
            [davkharPath]: davkharArray,
            [toonuudPath]: davkhariinToonuud,
          },
        }
      );

      // Recalculate liftShalgaya
      try {
        const { calculateLiftShalgaya } = require("./orshinSuugch");
        await calculateLiftShalgaya(
          baiguullaga._id.toString(),
          defaultBarilgiinId,
          davkharArray,
          tukhainBaaziinKholbolt
        );
      } catch (liftError) {
        console.error("Error calculating liftShalgaya:", liftError);
      }
    }

    res.json({
      success: true,
      message: `${results.success.length} тоот бүртгэл амжилттай импорт хийгдлээ`,
      results: results,
    });
  } catch (error) {
    console.error("Error importing tootBurtgel from Excel:", error);
    next(error);
  }
});
