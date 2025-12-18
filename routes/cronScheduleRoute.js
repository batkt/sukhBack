const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

router.post("/", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const baiguullagiinId = req.body.baiguullagiinId;
    const barilgiinId = req.body.barilgiinId || null; // Optional: if provided, schedule is per building
    const { nekhemjlekhUusgekhOgnoo, idevkhitei = true } = req.body;

    if (!baiguullagiinId || !nekhemjlekhUusgekhOgnoo) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон сарын өдөр заавал бөглөх шаардлагатай!",
      });
    }

    const Baiguullaga = require("../models/baiguullaga");
    let baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
        _id: baiguullagiinId,
      });

      if (!baiguullaga) {
        return res.status(404).json({
          success: false,
          message: "Байгууллагын мэдээлэл олдсонгүй!",
        });
      }
    }

    // If barilgiinId is provided, validate it exists in baiguullaga
    if (barilgiinId) {
      const targetBarilga = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );
      if (!targetBarilga) {
        return res.status(404).json({
          success: false,
          message: "Барилгын мэдээлэл олдсонгүй!",
        });
      }
    }

    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй! Олдсон холболтууд: ${db.kholboltuud
          .map((k) => k.baiguullagiinId)
          .join(", ")}`,
      });
    }

    // Query by both baiguullagiinId and barilgiinId (barilgiinId can be null for org-level)
    const query = { baiguullagiinId };
    if (barilgiinId) {
      query.barilgiinId = barilgiinId;
    } else {
      query.barilgiinId = null; // Explicitly set to null for organization-level
    }

    const cronSchedule = await nekhemjlekhCron(
      tukhainBaaziinKholbolt
    ).findOneAndUpdate(
      query,
      {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        nekhemjlekhUusgekhOgnoo,
        idevkhitei,
        shinechilsenOgnoo: new Date(),
      },
      { upsert: true, new: true }
    );

    const scheduleType = barilgiinId ? "барилга" : "байгууллага";
    res.json({
      success: true,
      message: `Амжилттай тохируулагдлаа! Нэхэмжлэх ${nekhemjlekhUusgekhOgnoo} сарын ${nekhemjlekhUusgekhOgnoo} өдөр үүсгэгдэнэ (${scheduleType} түвшинд).`,
      data: cronSchedule,
    });
  } catch (error) {
    console.error("Cron schedule creation error:", error);
    next(error);
  }
});

router.get("/:baiguullagiinId", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId } = req.params;
    const { barilgiinId } = req.query; // Optional: filter by building

    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй!`,
      });
    }

    // Build query: if barilgiinId provided, get that specific schedule, otherwise get all
    const query = { baiguullagiinId };
    if (barilgiinId) {
      query.barilgiinId = barilgiinId;
    }

    const schedules = await nekhemjlekhCron(tukhainBaaziinKholbolt).find(query);
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("Cron schedule fetch error:", error);
    next(error);
  }
});

module.exports = router;
