const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const { downloadNekhemjlekhiinTuukhExcel } = require("../controller/excelImportController");
const { gereeNeesNekhemjlekhUusgekhPreviousMonth, markInvoicesAsPaid, previewInvoice, manualSendInvoice, manualSendMassInvoices, manualSendSelectedInvoices } = require("../controller/nekhemjlekhController");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const { db } = require("zevbackv2");

// Excel download route - MUST be before crud to avoid conflicts
router.post(
  "/nekhemjlekhiinTuukhExcelDownload",
  tokenShalgakh,
  downloadNekhemjlekhiinTuukhExcel
);

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);

// Make this route more specific to avoid conflicts with other routes like /parking
router.get("/nekhemjlekhiinTuukh/:id", tokenShalgakh, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate that id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Нэхэмжлэхийн ID буруу байна!",
      });
    }

    const nekhemjlekh = await nekhemjlekhiinTuukh(
      req.body.tukhainBaaziinKholbolt
    ).findById(id);
    if (!nekhemjlekh) {
      return res.status(404).json({
        success: false,
        message: "Нэхэмжлэх олдсонгүй!",
      });
    }

    const wasUpdated = nekhemjlekh.checkOverdue();
    if (wasUpdated) {
      await nekhemjlekh.save();
    }

    res.json({
      success: true,
      data: nekhemjlekh,
    });
  } catch (error) {
    console.error("Invoice fetch error:", error);
    next(error);
  }
});

// Create invoices for previous months
// POST /nekhemjlekh/previousMonth
// Body: { baiguullagiinId, barilgiinId (optional), monthsAgo (1 or 2), gereeniiDugaar (optional - for specific contract) }
router.post("/previousMonth", tokenShalgakh, async (req, res, next) => {
  try {
    const { baiguullagiinId, barilgiinId, monthsAgo, gereeniiDugaar } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId шаардлагатай",
      });
    }

    if (!monthsAgo || (monthsAgo !== 1 && monthsAgo !== 2)) {
      return res.status(400).json({
        success: false,
        message: "monthsAgo нь 1 эсвэл 2 байх ёстой (1 = өмнөх сар, 2 = 2 сарын өмнө)",
      });
    }

    // Find the connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    // Get baiguullaga
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллага олдсонгүй!",
      });
    }

    // Find gerees (contracts)
    const gereeQuery = {
      baiguullagiinId: baiguullagiinId,
      tuluv: "Идэвхтэй",
    };

    if (barilgiinId) {
      gereeQuery.barilgiinId = barilgiinId;
    }

    if (gereeniiDugaar) {
      gereeQuery.gereeniiDugaar = gereeniiDugaar;
    }

    const gerees = await Geree(kholbolt).find(gereeQuery).lean();

    if (gerees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Идэвхтэй гэрээ олдсонгүй!",
      });
    }

    console.log(`📅 [PREVIOUS MONTH] Creating invoices for ${gerees.length} contract(s) - ${monthsAgo} month(s) ago`);

    const results = {
      success: true,
      total: gerees.length,
      created: 0,
      alreadyExists: 0,
      errors: 0,
      invoices: [],
      errorsList: [],
    };

    // Create invoices for each contract
    for (let i = 0; i < gerees.length; i++) {
      const geree = gerees[i];
      try {
        console.log(`📝 [${i + 1}/${gerees.length}] Processing contract ${geree.gereeniiDugaar}...`);
        
        const invoiceResult = await gereeNeesNekhemjlekhUusgekhPreviousMonth(
          geree,
          baiguullaga,
          kholbolt,
          monthsAgo,
          "garan",
          false // Don't skip duplicate check
        );

        if (invoiceResult.success) {
          if (invoiceResult.alreadyExists) {
            results.alreadyExists++;
            console.log(`ℹ️  [${i + 1}/${gerees.length}] Invoice already exists for ${geree.gereeniiDugaar}`);
          } else {
            results.created++;
            console.log(`✅ [${i + 1}/${gerees.length}] Created invoice for ${geree.gereeniiDugaar}`);
          }
          results.invoices.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            nekhemjlekhiinId: invoiceResult.nekhemjlekh?._id || invoiceResult.nekhemjlekh,
            tulbur: invoiceResult.tulbur,
            alreadyExists: invoiceResult.alreadyExists || false,
          });
        } else {
          results.errors++;
          const errorMsg = invoiceResult.error || "Unknown error";
          results.errorsList.push({
            gereeniiDugaar: geree.gereeniiDugaar,
            error: errorMsg,
          });
          console.log(`❌ [${i + 1}/${gerees.length}] Error for ${geree.gereeniiDugaar}: ${errorMsg}`);
        }
      } catch (error) {
        results.errors++;
        const errorMsg = error.message || "Unknown error";
        results.errorsList.push({
          gereeniiDugaar: geree.gereeniiDugaar,
          error: errorMsg,
        });
        console.error(`❌ [${i + 1}/${gerees.length}] Гэрээ ${geree.gereeniiDugaar} боловсруулах алдаа:`, errorMsg);
      }
    }

    console.log(`📊 [PREVIOUS MONTH] Results: Created: ${results.created}, Already exists: ${results.alreadyExists}, Errors: ${results.errors}, Total: ${results.total}`);

    res.json(results);
  } catch (error) {
    console.error("Error creating previous month invoices:", error);
    next(error);
  }
});

// Mark invoices as paid
// markEkhniiUldegdel: true to include ekhniiUldegdel invoices, false (default) to only mark regular ashiglaltiinZardluud invoices
router.post(
  "/markInvoicesAsPaid",
  tokenShalgakh,
  markInvoicesAsPaid
);

// Preview invoice before sending
// GET /nekhemjlekh/preview?gereeId=xxx&baiguullagiinId=xxx&barilgiinId=xxx&targetMonth=1&targetYear=2026
router.get("/preview", tokenShalgakh, async (req, res, next) => {
  try {
    const { gereeId, baiguullagiinId, barilgiinId, targetMonth, targetYear } = req.query;

    if (!gereeId || !baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "gereeId болон baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await previewInvoice(
      gereeId,
      baiguullagiinId,
      barilgiinId || null,
      month,
      year
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Preview invoice error:", error);
    next(error);
  }
});

// Manual send invoices for selected/checked contracts
// POST /nekhemjlekh/manualSend
// Body: { gereeIds: ["id1", "id2", ...], baiguullagiinId, override: true/false, targetMonth: 1, targetYear: 2026 }
// Supports both single contract (array with one item) or multiple contracts
router.post("/manualSend", tokenShalgakh, async (req, res, next) => {
  try {
    const { gereeIds, gereeId, baiguullagiinId, override = false, targetMonth, targetYear } = req.body;

    // Support both new format (gereeIds array) and old format (single gereeId) for backward compatibility
    let contractIds = gereeIds;
    if (!contractIds && gereeId) {
      // Backward compatibility: if gereeId is provided, convert to array
      contractIds = [gereeId];
    }

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "gereeIds (массив) болон baiguullagiinId шаардлагатай",
      });
    }

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await manualSendSelectedInvoices(
      contractIds,
      baiguullagiinId,
      override === true || override === "true",
      month,
      year
    );

    if (result.success) {
      const message = result.created === 1 
        ? "Нэхэмжлэх амжилттай үүсгэгдлээ"
        : `${result.created} нэхэмжлэх амжилттай үүсгэгдлээ`;
      
      res.json({
        success: true,
        message: message,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || "Нэхэмжлэхүүд үүсгэхэд алдаа гарлаа",
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Manual send invoice error:", error);
    next(error);
  }
});

// Manual send mass invoices
// POST /nekhemjlekh/manualSendMass
// Body: { baiguullagiinId, barilgiinId (optional), override: true/false, targetMonth: 1, targetYear: 2026 }
router.post("/manualSendMass", tokenShalgakh, async (req, res, next) => {
  try {
    const { baiguullagiinId, barilgiinId, override = false, targetMonth, targetYear } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await manualSendMassInvoices(
      baiguullagiinId,
      barilgiinId || null,
      override === true || override === "true",
      month,
      year
    );

    if (result.success) {
      res.json({
        success: true,
        message: `${result.created} нэхэмжлэх амжилттай үүсгэгдлээ`,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || "Нэхэмжлэхүүд үүсгэхэд алдаа гарлаа",
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Manual send mass invoices error:", error);
    next(error);
  }
});

module.exports = router;
