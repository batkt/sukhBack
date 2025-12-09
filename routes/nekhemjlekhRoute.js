const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const { downloadNekhemjlekhiinTuukhExcel } = require("../controller/excelImportController");

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

module.exports = router;
