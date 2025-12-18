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

    const orshinSuugchIds = Array.isArray(orshinSuugchId)
      ? orshinSuugchId
      : [orshinSuugchId];

    const sonorduulgaList = [];
    const io = req.app.get("socketio");

    for (const id of orshinSuugchIds) {
      const sonorduulga = new Sonorduulga(kholbolt)();
      sonorduulga.orshinSuugchId = id;
      sonorduulga.baiguullagiinId = baiguullagiinId;
      sonorduulga.barilgiinId = barilgiinId;
      sonorduulga.title = medeelel.title;
      sonorduulga.message = medeelel.body;
      sonorduulga.kharsanEsekh = false;
      if (turul) sonorduulga.turul = String(turul);
      // Set ognoo to current time (will be stored in UTC by MongoDB)
      sonorduulga.ognoo = new Date();

      await sonorduulga.save();
      
      // Convert UTC dates to Mongolian time (UTC+8) for response
      const sonorduulgaObj = sonorduulga.toObject();
      const mongolianOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      
      if (sonorduulgaObj.createdAt) {
        const createdAtMongolian = new Date(sonorduulgaObj.createdAt.getTime() + mongolianOffset);
        sonorduulgaObj.createdAt = createdAtMongolian.toISOString();
      }
      if (sonorduulgaObj.updatedAt) {
        const updatedAtMongolian = new Date(sonorduulgaObj.updatedAt.getTime() + mongolianOffset);
        sonorduulgaObj.updatedAt = updatedAtMongolian.toISOString();
      }
      if (sonorduulgaObj.ognoo) {
        const ognooMongolian = new Date(sonorduulgaObj.ognoo.getTime() + mongolianOffset);
        sonorduulgaObj.ognoo = ognooMongolian.toISOString();
      }
      
      sonorduulgaList.push(sonorduulgaObj);

      if (io) {
        const eventName = "orshinSuugch" + id;
        console.log("📡 [SOCKET] Emitting notification via medegdelIlgeeye route...", {
          eventName: eventName,
          orshinSuugchId: id,
          medegdelId: sonorduulgaObj._id,
          title: sonorduulgaObj.title,
          message: sonorduulgaObj.message,
          timestamp: new Date().toISOString(),
        });
        
        io.emit(eventName, sonorduulgaObj);
        
        console.log("✅ [SOCKET] Notification emitted successfully", {
          eventName: eventName,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn("⚠️ [SOCKET] Socket.io instance not available in req.app");
      }
    }

    return res.json({
      success: true,
      message: "Мэдэгдэл амжилттай хадгалагдлаа",
      data: sonorduulgaList,
      count: sonorduulgaList.length,
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
