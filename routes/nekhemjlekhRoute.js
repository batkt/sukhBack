const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const { downloadNekhemjlekhiinTuukhExcel } = require("../controller/excelImportController");
const { gereeNeesNekhemjlekhUusgekhPreviousMonth } = require("../controller/nekhemjlekhController");
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

router.get("/:id", tokenShalgakh, async (req, res, next) => {
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

module.exports = router;
