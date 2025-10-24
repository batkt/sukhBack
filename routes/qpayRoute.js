const express = require("express");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const { tokenShalgakh, Dugaarlalt } = require("zevbackv2");
const {
  qpayGuilgeeUtgaAvya,
  qpayTulye,
  qpayGargayaKhuuchin,
} = require("../controller/qpayController");
const router = express.Router();
const {
  qpayKhariltsagchUusgey,
  qpayGargaya,
  QuickQpayObject,
  QpayKhariltsagch,
  qpayShalgay,
} = require("quickqpaypackv2");
const { tulburUridchiljTulukh } = require("../controller/zogsool");

router.get(
  "/qpaycallback/:baiguullagiinId/:zakhialgiinDugaar",
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const b = req.params.baiguullagiinId;
      var kholbolt = db.kholboltuud.find((a) => a.baiguullagiinId == b);
      const qpayObject = await QuickQpayObject(kholbolt).findOne({
        zakhialgiinDugaar: req.params.zakhialgiinDugaar,
        tulsunEsekh: false,
      });

      qpayObject.tulsunEsekh = true;
      qpayObject.isNew = false;
      await qpayObject.save();
      req.app.get("socketio").emit(`qpay/${b}/${qpayObject.zakhialgiinDugaar}`);
      if (qpayObject.zogsooliinId) {
        const body = {
          tukhainBaaziinKholbolt: kholbolt,
          turul: "qpayUridchilsan",
          uilchluulegchiinId: qpayObject.zogsoolUilchluulegch.uId,
          paid_amount: qpayObject.zogsoolUilchluulegch.pay_amount,
          plate_number: qpayObject.zogsoolUilchluulegch.plate_number,
          barilgiinId: qpayObject.salbariinId,
          ajiltniiNer: "zochin",
          zogsooliinId: qpayObject.zogsooliinId,
        };
        await tulburUridchiljTulukh(body, res, next);
      }
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }
);
router.get(
  "/qpaycallbackGadaaSticker/:baiguullagiinId/:barilgiinId/:mashiniiDugaar/:cameraIP/:zakhialgiinDugaar",
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const b = req.params.baiguullagiinId;
      var kholbolt = db.kholboltuud.find((a) => a.baiguullagiinId == b);
      const qpayObject = await QuickQpayObject(kholbolt).findOne({
        zakhialgiinDugaar: req.params.zakhialgiinDugaar,
        tulsunEsekh: false,
      });

      qpayObject.tulsunEsekh = true;
      qpayObject.isNew = false;
      await qpayObject.save();
      req.app.get("socketio").emit(`qpay/${b}/${qpayObject.zakhialgiinDugaar}`);
      if (qpayObject.zogsooliinId) {
        const body = {
          tukhainBaaziinKholbolt: kholbolt,
          turul: req.params.cameraIP == "dotor" ? "qpayUridchilsan" : "qpay",
          uilchluulegchiinId: qpayObject.zogsoolUilchluulegch.uId,
          paid_amount: qpayObject.zogsoolUilchluulegch.pay_amount,
          plate_number: qpayObject.zogsoolUilchluulegch.plate_number,
          barilgiinId: qpayObject.salbariinId,
          ajiltniiNer: "qpaySticker",
          zogsooliinId: qpayObject.zogsooliinId,
        };
        await tulburUridchiljTulukh(body, res, next);
      }
      if (
        !!req.params.mashiniiDugaar &&
        !!req.params.cameraIP &&
        req.params.cameraIP != "dotor"
      ) {
        const io = req.app.get("socketio");
        if (io) {
          io.emit(`qpayMobileSdk${req.params.baiguullagiinId}${req.params.cameraIP}`, {
            khaalgaTurul: "Гарах",
            turul: "qpayMobile",
            mashiniiDugaar: req.params.mashiniiDugaar,
            cameraIP: req.params.cameraIP,
            uilchluulegchiinId: qpayObject.zogsoolUilchluulegch.uId,
          });
        }
      }
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }
);
router.get("/qpayObjectAvya", tokenShalgakh, async (req, res, next) => {
  try {
    const qpayObject = await QuickQpayObject(
      req.body.tukhainBaaziinKholbolt
    ).findOne({
      invoice_id: req.query.invoice_id,
    });
    res.send(qpayObject);
  } catch (err) {
    next(err);
  }
});

router.post("/qpayGargaya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var maxDugaar = 1;
    await Dugaarlalt(req.body.tukhainBaaziinKholbolt)
      .find({
        baiguullagiinId: req.body.baiguullagiinId,
        barilgiinId: req.body.barilgiinId,
        turul: "qpay",
      })
      .sort({
        dugaar: -1,
      })
      .limit(1)
      .then((result) => {
        if (result != 0) maxDugaar = result[0].dugaar + 1;
      });
    if (req.body.baiguullagiinId == "664ac9b28bfeed5bdce01388") {
      req.body.dansniiDugaar = "5069538136";
      req.body.burtgeliinDugaar = "6078893";
      await qpayGargayaKhuuchin(req, res, next);
    } else {
      var tailbar =
        "Төлбөр " +
        (req.body.mashiniiDugaar ? req.body.mashiniiDugaar : "") +
        (req.body.turul ? req.body.turul : "");
      if (!!req.body.gereeniiId) {
        var geree = await Geree(req.body.tukhainBaaziinKholbolt, true).findById(
          req.body.gereeniiId
        );
        tailbar = " " + geree.gereeniiDugaar;
      }
      if (req.body?.nevtersenAjiltniiToken?.id == "66384a9061eeda747d01a320")
        req.body.dansniiDugaar = "416075707";
      else if (
        req.body.baiguullagiinId == "6115f350b35689cdbf1b9da3" &&
        !req.body.gereeniiId &&
        !req.body.dansniiDugaar
      )
        req.body.dansniiDugaar = "5129057717";
      if (req.body.baiguullagiinId == "65cf2f027fbc788f85e50b90")
        // sakura khaan dans
        req.body.dansniiDugaar = "5112418947";
      req.body.tailbar = tailbar;
      /*Төлбөр callback url*/
      var callback_url =
        process.env.UNDSEN_SERVER +
        "/qpaycallback/" +
        req.body.baiguullagiinId +
        "/" +
        req.body?.zakhialgiinDugaar;
      // zogsool gadaa sticker qr
      if (
        req.body.turul === "QRGadaa" &&
        !!req.body.mashiniiDugaar &&
        !!req.body.cameraIP
      ) {
        callback_url =
          process.env.UNDSEN_SERVER +
          "/qpaycallbackGadaaSticker/" +
          req.body.baiguullagiinId +
          "/" +
          req.body.barilgiinId.toString() +
          "/" +
          req.body.mashiniiDugaar +
          "/" +
          req.body.cameraIP +
          "/" +
          req.body?.zakhialgiinDugaar;
      }

      /*Түрээсийн төлбөр callback url*/
      if (req.body.gereeniiId && req.body.dansniiDugaar) {
        callback_url =
          process.env.UNDSEN_SERVER +
          "/qpayTulye/" +
          req.body.baiguullagiinId.toString() +
          "/" +
          req.body.barilgiinId.toString() +
          "/" +
          maxDugaar.toString();

        req.body.zakhialgiinDugaar = maxDugaar.toString();
        //gereetei ued mungun dun 300tugrug nemex
        if (req.body.dun > 0) {
          var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
            req.body.baiguullagiinId
          );
          if (
            !!baiguullaga &&
            baiguullaga.tokhirgoo?.qpayShimtgelTusdaa == true
          ) {
            req.body.dun = Number(req.body.dun) + 300 + "";
          }
        }
      }

      const khariu = await qpayGargaya(
        req.body,
        callback_url,
        req.body.tukhainBaaziinKholbolt
      );
      var dugaarlalt = new Dugaarlalt(req.body.tukhainBaaziinKholbolt)();
      dugaarlalt.baiguullagiinId = req.body.baiguullagiinId;
      dugaarlalt.barilgiinId = req.body.barilgiinId;
      dugaarlalt.ognoo = new Date();
      dugaarlalt.turul = "qpay";
      dugaarlalt.dugaar = maxDugaar;
      dugaarlalt.save();
      res.send(khariu);
    }
  } catch (err) {
    next(err);
  }
});

router.post("/qpayShalgay", tokenShalgakh, async (req, res, next) => {
  try {
    const khariu = await qpayShalgay(req.body, req.body.tukhainBaaziinKholbolt);
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});
router.post("/qpayGuilgeeUtgaAvya", tokenShalgakh, qpayGuilgeeUtgaAvya);

router.post(
  "/qpayKhariltsagchUusgey",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
        register: req.body.register,
      });
      var kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == baiguullaga._id
      );
      req.body.baiguullagiinId = baiguullaga._id;
      delete req.body.tukhainBaaziinKholbolt;
      delete req.body.erunkhiiKholbolt;
      var khariu = await qpayKhariltsagchUusgey(req.body, kholbolt);
      if (khariu === "Amjilttai") {
        res.send(khariu);
      } else throw new Error(khariu);
    } catch (err) {
      next(err);
    }
  }
);

router.post("/qpayKhariltsagchAvay", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var baiguullaga1 = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: req.body.register,
    });
    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );
    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);

    req.body.baiguullagiinId = baiguullaga1._id;
    const baiguullaga = await qpayKhariltsagch.findOne({
      baiguullagiinId: req.body.baiguullagiinId,
    });
    if (baiguullaga) res.send(baiguullaga);
    else res.send(undefined);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
