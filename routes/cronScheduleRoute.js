const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

// Custom route to create cron schedule in tenant database
router.post("/", tokenShalgakh, async (req, res, next) => {
  try {
    console.log("=== ROUTE HIT ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("=== END ROUTE HIT ===");
    
    const { db } = require("zevbackv2");
    
    console.log("=== RAW REQUEST DEBUG ===");
    console.log("req.body keys:", Object.keys(req.body));
    console.log("req.body.baiguullagiinId:", req.body.baiguullagiinId);
    console.log("req.body.sarinUdur:", req.body.sarinUdur);
    console.log("req.body.idevkhitei:", req.body.idevkhitei);
    console.log("=== END RAW REQUEST DEBUG ===");
    
    const { baiguullagiinId, sarinUdur, idevkhitei = true } = req.body;

    console.log("=== REQUEST DEBUG ===");
    console.log("Extracted baiguullagiinId:", baiguullagiinId);
    console.log("Type of baiguullagiinId:", typeof baiguullagiinId);
    console.log("sarinUdur:", sarinUdur);
    console.log("idevkhitei:", idevkhitei);
    console.log("=== END REQUEST DEBUG ===");

    if (!baiguullagiinId || !sarinUdur) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон сарын өдөр заавал бөглөх шаардлагатай!"
      });
    }

    // Get organization info
    const Baiguullaga = require("../models/baiguullaga");
    console.log("Looking for organization:", baiguullagiinId);
    console.log("Database connection:", db.erunkhiiKholbolt ? "Connected" : "Not connected");
    
    // First, let's see what organizations exist
    const allOrgs = await Baiguullaga(db.erunkhiiKholbolt).find({}).limit(5);
    console.log("Sample organizations in database:", allOrgs.map(org => ({ id: org._id, name: org.ner })));
    
    let baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    console.log("Found organization by findById:", baiguullaga ? "Yes" : "No");
    
    if (!baiguullaga) {
      // Try to find by string ID
      const baiguullagaByString = await Baiguullaga(db.erunkhiiKholbolt).findOne({ _id: baiguullagiinId });
      console.log("Found by string ID:", baiguullagaByString ? "Yes" : "No");
      
      if (!baiguullagaByString) {
        return res.status(404).json({
          success: false,
          message: "Байгууллагын мэдээлэл олдсонгүй!"
        });
      }
      // Use the found organization
      baiguullaga = baiguullagaByString;
    }
    
    console.log("Using organization:", baiguullaga.ner, "ID:", baiguullaga._id);

    // Get tenant database connection
    console.log("Available connections:", db.kholboltuud.map(k => k.baiguullagiinId));
    console.log("Looking for tenant connection:", baiguullagiinId);
    
    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      k => k.baiguullagiinId === baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      console.log("Tenant connection not found!");
      
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй! Олдсон холболтууд: ${db.kholboltuud.map(k => k.baiguullagiinId).join(', ')}`
      });
    }
    
    console.log("Tenant connection found:", tukhainBaaziinKholbolt ? "Yes" : "No");

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
