const express = require("express");
const router = express.Router();
const OrshinSuugch = require("../models/orshinSuugch");
const { tokenShalgakh, crud, db } = require("zevbackv2");
const {
  khariltsagchidSonorduulgaIlgeeye,
} = require("../controller/appNotification");
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
      firebaseToken,
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

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      _id: orshinSuugchId,
    });

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Оршин суугч олдсонгүй",
      });
    }

    // Get Firebase token from request body first, then from user account
    const orshinSuugchToken = firebaseToken || orshinSuugch?.firebaseToken;

    if (!orshinSuugchToken) {
      return res.status(400).json({
        success: false,
        message: "Firebase token олдсонгүй. Оршин суугчид Firebase token тохируулах шаардлагатай.",
      });
    }

    // Save the medegdel first
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

    // Send Firebase notification
    khariltsagchidSonorduulgaIlgeeye(
      orshinSuugchToken,
      medeelel,
      async (response, error) => {
        if (error) {
          // Firebase notification failed but notification is saved
          return res.json({
            success: true,
            message: "Мэдэгдэл хадгалагдлаа (Firebase илгээлт алдаатай)",
            data: sonorduulga,
            firebaseError: error.message,
          });
        }

        return res.json({
          success: true,
          message: "Мэдэгдэл амжилттай илгээгдлээ",
          data: sonorduulga,
        });
      },
      (error) => {
        // If Firebase fails before callback, still return success since notification is saved
        console.error("Firebase notification error:", error);
        return res.json({
          success: true,
          message: "Мэдэгдэл хадгалагдлаа (Firebase илгээлт алдаатай)",
          data: sonorduulga,
          firebaseError: error.message,
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

router.get("/medegdel", tokenShalgakh, medegdelAvya);
router.get("/medegdel/:id", tokenShalgakh, medegdelNegAvya);
router.put("/medegdel/:id", tokenShalgakh, medegdelZasah);
router.delete("/medegdel/:id", tokenShalgakh, medegdelUstgakh);

module.exports = router;
