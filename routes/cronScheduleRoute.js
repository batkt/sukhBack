const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

// Custom route to create cron schedule in tenant database
router.post("/", tokenShalgakh, async (req, res, next) => {
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
      
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй! Олдсон холболтууд: ${db.kholboltuud.map(k => k.baiguullagiinId).join(', ')}`
      });
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

// GET route to fetch cron schedules for an organization
router.get("/:baiguullagiinId", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId } = req.params;

    // Get tenant database connection
    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      k => k.baiguullagiinId === baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй!`
      });
    }

    const schedules = await nekhemjlekhCron(tukhainBaaziinKholbolt).find({ baiguullagiinId });
    res.json({ success: true, data: schedules });

  } catch (error) {
    console.error("Cron schedule fetch error:", error);
    next(error);
  }
});

module.exports = router;
