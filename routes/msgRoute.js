const express = require("express");
const router = express.Router();
const { tokenShalgakh, db } = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");
const OrshinSuugch = require("../models/orshinSuugch");
const { sendSms } = require("../services/smsService");

router.route("/msgIlgeeye").post(tokenShalgakh, async (req, res, next) => {
  try {
    const {
      orshinSuugchId,
      baiguullagiinId,
      barilgiinId,
      medeelel,
      turul,
    } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй",
      });
    }

    if (!orshinSuugchId) {
      return res.status(400).json({
        success: false,
        message: "orshinSuugchId is required",
      });
    }

    if (!medeelel || !medeelel.title || !medeelel.body) {
      return res.status(400).json({
        success: false,
        message: "medeelel (title and body) is required",
      });
    }

    const BaiguullagaModel = Baiguullaga(kholbolt);
    const baiguullaga = await BaiguullagaModel.findById(baiguullagiinId);

    const msgIlgeekhKey = baiguullaga?.tokhirgoo?.msgIlgeekhKey;
    const msgIlgeekhDugaar = baiguullaga?.tokhirgoo?.msgIlgeekhDugaar;

    if (!msgIlgeekhKey || !msgIlgeekhDugaar) {
      return res.status(400).json({
        success: false,
        message: "Мэссэж илгээх тохиргоо хийгдээгүй байна!",
      });
    }

    const orshinSuugchIds = Array.isArray(orshinSuugchId)
      ? orshinSuugchId
      : [orshinSuugchId];

    const OrshinSuugchModel = OrshinSuugch(kholbolt);
    const residents = await OrshinSuugchModel.find({
      _id: { $in: orshinSuugchIds },
    }).select("utas");

    const smsMessages = residents
      .filter((resident) => resident.utas && resident.utas.trim() !== "")
      .map((resident) => ({
        to: resident.utas,
        text: `${medeelel.title}\n${medeelel.body}`,
        baiguullagiinId: baiguullagiinId,
        barilgiinId: barilgiinId,
        turul: turul || "medegdel",
      }));

    if (smsMessages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Утасны дугаартай оршин суугч олдсонгүй",
      });
    }

    const smsResults = await sendSms(
      smsMessages,
      msgIlgeekhKey,
      msgIlgeekhDugaar,
      kholbolt
    );

    return res.json({
      success: true,
      message: "Мэссэж амжилттай илгээгдлээ",
      results: smsResults,
      total: smsMessages.length,
      sent: smsResults.filter((r) => r.status === "SUCCESS").length,
      failed: smsResults.filter((r) => r.status === "FAILED").length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
