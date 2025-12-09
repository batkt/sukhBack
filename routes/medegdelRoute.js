const express = require("express");
const router = express.Router();
const { tokenShalgakh, crud, db } = require("zevbackv2");
const Sonorduulga = require("../models/medegdel");
const {
  medegdelIlgeeye,
  medegdelAvya,
  medegdelNegAvya,
  medegdelZasah,
  medegdelUstgakh,
} = require("../controller/medegdel");

router.route("/medegdelIlgeeye").post(tokenShalgakh, async (req, res, next) => {
  try {
    const {
      medeelel,
      orshinSuugchId,
      baiguullagiinId,
      barilgiinId,
      tukhainBaaziinKholbolt,
      turul,
    } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    // Find the connection object
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

    // Save the medegdel
    const sonorduulga = new Sonorduulga(kholbolt)();
    sonorduulga.orshinSuugchId = orshinSuugchId;
    sonorduulga.baiguullagiinId = baiguullagiinId;
    sonorduulga.barilgiinId = barilgiinId;
    sonorduulga.title = medeelel.title;
    sonorduulga.message = medeelel.body;
    sonorduulga.kharsanEsekh = false;
    if (turul) sonorduulga.turul = String(turul);

    await sonorduulga.save();

    const io = req.app.get("socketio");
    if (io) {
      io.emit("orshinSuugch" + orshinSuugchId, sonorduulga);
    }

    return res.json({
      success: true,
      message: "Мэдэгдэл амжилттай хадгалагдлаа",
      data: sonorduulga,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/medegdel", tokenShalgakh, medegdelAvya);
router.get("/medegdel/:id", tokenShalgakh, medegdelNegAvya);
router.put("/medegdel/:id", tokenShalgakh, medegdelZasah);
router.delete("/medegdel/:id", tokenShalgakh, medegdelUstgakh);

module.exports = router;
