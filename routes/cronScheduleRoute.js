const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

router.post("/", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const baiguullagiinId = req.body.baiguullagiinId;
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

    const cronSchedule = await nekhemjlekhCron(
      tukhainBaaziinKholbolt
    ).findOneAndUpdate(
      { baiguullagiinId },
      {
        baiguullagiinId,
        nekhemjlekhUusgekhOgnoo,
        idevkhitei,
        shinechilsenOgnoo: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Амжилттай тохируулагдлаа! Нэхэмжлэх ${nekhemjlekhUusgekhOgnoo} сарын ${nekhemjlekhUusgekhOgnoo} өдөр үүсгэгдэнэ.`,
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

    let tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).json({
        success: false,
        message: `Байгууллагын холболт олдсонгүй!`,
      });
    }

    const schedules = await nekhemjlekhCron(tukhainBaaziinKholbolt).find({
      baiguullagiinId,
    });
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("Cron schedule fetch error:", error);
    next(error);
  }
});

module.exports = router;
