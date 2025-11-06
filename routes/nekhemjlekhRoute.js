const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const { downloadNekhemjlekhiinTuukhExcel } = require("../controller/excelImportController");

// Excel download route - MUST be before crud to avoid conflicts
router.post(
  "/nekhemjlekhiinTuukhExcelDownload",
  tokenShalgakh,
  downloadNekhemjlekhiinTuukhExcel
);

// Test route to verify router is working
router.get("/testExcelRoute", (req, res) => {
  res.json({ message: "Route is working!", path: req.path });
});

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);

router.get("/:id", tokenShalgakh, async (req, res, next) => {
  try {
    const { id } = req.params;

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

module.exports = router;
