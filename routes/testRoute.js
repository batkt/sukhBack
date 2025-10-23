const express = require("express");
const router = express.Router();
const Baiguullaga = require("../models/baiguullaga");

// Get test organization ID (no auth required for testing)
router.get("/getTestOrgId", async (req, res) => {
  try {
    const { db } = require("zevbackv2");
    
    // Get the first organization for testing
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({});
    
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Тест байгууллага олдсонгүй!"
      });
    }
    
    res.json({
      success: true,
      data: {
        baiguullagiinId: baiguullaga._id,
        ner: baiguullaga.ner,
        dans: baiguullaga.dans,
        register: baiguullaga.register
      }
    });
  } catch (error) {
    console.error("Get test org ID error:", error);
    res.status(500).json({
      success: false,
      message: "Алдаа гарлаа!",
      error: error.message
    });
  }
});

module.exports = router;
