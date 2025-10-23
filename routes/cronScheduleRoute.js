const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

crud(router, "nekhemjlekhCron", nekhemjlekhCron, UstsanBarimt);

// Custom route to create cron schedule in tenant database
router.post("/create", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, sarinUdur, idevkhitei = true } = req.body;

    if (!baiguullagiinId || !sarinUdur) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон сарын өдөр заавал бөглөх шаардлагатай!"
      });
    }

    // Get organization info
    const Baiguullaga = require("../models/baiguullaga");
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!"
      });
    }

    // Get tenant database connection
    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      k => k.baiguullagiinId === baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      console.log("Available connections:", db.kholboltuud.map(k => k.baiguullagiinId));
      console.log("Looking for:", baiguullagiinId);
      
      // Try to create connection if it doesn't exist
      try {
        const connection = await db.kholboltAvya(baiguullagiinId);
        tukhainBaaziinKholbolt = { kholbolt: connection };
        console.log("Created new connection for:", baiguullagiinId);
      } catch (connectionError) {
        console.error("Failed to create connection:", connectionError);
        return res.status(404).json({
          success: false,
          message: "Байгууллагын холболт үүсгэх боломжгүй!"
        });
      }
    }

    // Create or update cron schedule
    const cronSchedule = await nekhemjlekhCron(tukhainBaaziinKholbolt).findOneAndUpdate(
      { baiguullagiinId },
      {
        baiguullagiinId,
        sarinUdur,
        idevkhitei,
        shinechilsenOgnoo: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Амжилттай тохируулагдлаа! Нэхэмжлэх ${sarinUdur} сарын ${sarinUdur} өдөр үүсгэгдэнэ.`,
      data: cronSchedule
    });

  } catch (error) {
    console.error("Cron schedule creation error:", error);
    next(error);
  }
});

module.exports = router;
