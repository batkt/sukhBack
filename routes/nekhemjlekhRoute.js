const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);

// Enhanced GET route with QPay functionality
router.get("/:id", tokenShalgakh, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const nekhemjlekh = await nekhemjlekhiinTuukh(req.body.tukhainBaaziinKholbolt).findById(id);
    if (!nekhemjlekh) {
      return res.status(404).json({
        success: false,
        message: "Нэхэмжлэх олдсонгүй!"
      });
    }

    // Check and update overdue status
    const wasUpdated = nekhemjlekh.checkOverdue();
    if (wasUpdated) {
      await nekhemjlekh.save();
    }

    res.json({
      success: true,
      data: nekhemjlekh
    });

  } catch (error) {
    console.error("Invoice fetch error:", error);
    next(error);
  }
});

module.exports = router;
