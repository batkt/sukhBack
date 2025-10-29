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

      /*Нэхэмжлэхийн төлбөр callback url*/
      if (req.body.nekhemjlekhiinId) {
        callback_url =
          ("http://103.143.40.46:8084") +
          "/qpayNekhemjlekhCallback/" +
          req.body.baiguullagiinId.toString() +
          "/" +
          req.body.nekhemjlekhiinId.toString();
      }

      const khariu = await qpayGargaya(
        req.body,
        callback_url,
        req.body.tukhainBaaziinKholbolt
      );
      
      // Save invoice_id and qpayUrl to nekhemjlekh if this is an invoice payment
      if (req.body.nekhemjlekhiinId && khariu) {
        const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
        const kholbolt = db.kholboltuud.find(
          (a) => a.baiguullagiinId == req.body.baiguullagiinId
        );
        
        const invoiceId = khariu.invoice_id || khariu.invoiceId || khariu.id;
        const qpayUrl = khariu.qr_text || khariu.url || khariu.invoice_url || khariu.qr_image;
        
        // Fetch the invoice to get real data
        const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(req.body.nekhemjlekhiinId);
        
        if (nekhemjlekh) {
          // Update nekhemjlekh with QPay invoice info
          await nekhemjlekhiinTuukh(kholbolt).findByIdAndUpdate(req.body.nekhemjlekhiinId, {
            qpayInvoiceId: invoiceId,
            qpayUrl: qpayUrl
          });
          
          // Update QuickQpayObject with invoice data
          if (invoiceId) {
            await QuickQpayObject(kholbolt).findOneAndUpdate(
              { invoice_id: invoiceId },
              {
                nekhemjlekh: {
                  nekhemjlekhiinId: nekhemjlekh._id.toString(),
                  gereeniiDugaar: nekhemjlekh.gereeniiDugaar || "",
                  utas: nekhemjlekh.utas?.[0] || "",
                  pay_amount: (nekhemjlekh.niitTulbur || req.body.dun || "").toString()
                }
              },
              { new: true }
            );
          }
        }
      }
      
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


// Check nekhemjlekh payment status
router.get("/nekhemjlekhPaymentStatus/:baiguullagiinId/:nekhemjlekhiinId", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    
    const baiguullagiinId = req.params.baiguullagiinId;
    const nekhemjlekhiinId = req.params.nekhemjlekhiinId;
    
    // Find the database connection for this organization
    const kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullagiinId
    );
    
    if (!kholbolt) {
      return res.status(404).send("Organization not found");
    }

    // Find the nekhemjlekh record
    const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(nekhemjlekhiinId);
    
    if (!nekhemjlekh) {
      return res.status(404).send("Invoice not found");
    }

    res.send({
      success: true,
      nekhemjlekh: {
        _id: nekhemjlekh._id,
        dugaalaltDugaar: nekhemjlekh.dugaalaltDugaar,
        niitTulbur: nekhemjlekh.niitTulbur,
        tuluv: nekhemjlekh.tuluv,
        tulsunOgnoo: nekhemjlekh.tulsunOgnoo,
        qpayPaymentId: nekhemjlekh.qpayPaymentId,
        qpayInvoiceId: nekhemjlekh.qpayInvoiceId,
        qpayUrl: nekhemjlekh.qpayUrl,
        canPay: nekhemjlekh.canPay,
        paymentHistory: nekhemjlekh.paymentHistory
      }
    });
  } catch (err) {
    next(err);
  }
});

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

// QPay callback for nekhemjlekh (invoice) payments
router.get(
  "/qpayNekhemjlekhCallback/:baiguullagiinId/:nekhemjlekhiinId",
  async (req, res, next) => {
    try {
      console.log("Энэ рүү орлоо: qpayNekhemjlekhCallback");
      const { db } = require("zevbackv2");
      const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
      
      const baiguullagiinId = req.params.baiguullagiinId;
      const nekhemjlekhiinId = req.params.nekhemjlekhiinId;
      
      // Find the database connection for this organization
      const kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == baiguullagiinId
      );
      
      if (!kholbolt) {
        return res.status(404).send("Organization not found");
      }

      // Find the nekhemjlekh record
      const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(nekhemjlekhiinId);
      
      if (!nekhemjlekh) {
        return res.status(404).send("Invoice not found");
      }

      // Check if payment is already completed
      if (nekhemjlekh.tuluv === "Төлсөн") {
        return res.status(200).send("Payment already completed");
      }

      let paymentTransactionId = null;
      
      // Try to get the actual payment transaction ID from QPay
      if (nekhemjlekh.qpayInvoiceId) {
        try {
          const qpayShalgay = require("../controller/qpayController").qpayShalgay;
          const khariu = await qpayShalgay({ invoice_id: nekhemjlekh.qpayInvoiceId }, kholbolt);
          
          // Extract payment transaction ID from QPay response
          if (khariu?.payments?.[0]?.transactions?.[0]?.id) {
            paymentTransactionId = khariu.payments[0].transactions[0].id;
            nekhemjlekh.qpayPaymentId = paymentTransactionId;
          }
        } catch (err) {
          console.error("Could not fetch QPay payment details:", err);
        }
      }
      
      // Fallback to query parameter if available
      if (!paymentTransactionId && req.query.qpay_payment_id) {
        paymentTransactionId = req.query.qpay_payment_id;
        nekhemjlekh.qpayPaymentId = paymentTransactionId;
      }

      // Update payment status
      nekhemjlekh.tuluv = "Төлсөн";
      nekhemjlekh.tulsunOgnoo = new Date();

      // Add payment to history
      nekhemjlekh.paymentHistory = nekhemjlekh.paymentHistory || [];
      nekhemjlekh.paymentHistory.push({
        ognoo: new Date(),
        dun: nekhemjlekh.niitTulbur,
        turul: "qpay",
        guilgeeniiId: paymentTransactionId || nekhemjlekh.qpayInvoiceId || "unknown",
        tailbar: "QPay төлбөр амжилттай хийгдлээ"
      });

      // Save the updated nekhemjlekh
      await nekhemjlekh.save();

      // Create bank payment record for this invoice
      try {
        const BankniiGuilgee = require("../models/bankniiGuilgee");
        const Geree = require("../models/geree");
        
        // Get the contract to link the payment correctly
        const geree = await Geree(kholbolt).findById(nekhemjlekh.gereeniiId).lean();
        
        // Use the invoice dans info directly
        const bankGuilgee = new BankniiGuilgee(kholbolt)();
        
        // Map QPay payment to bank payment record
        bankGuilgee.tranDate = new Date();
        bankGuilgee.amount = nekhemjlekh.niitTulbur;
        bankGuilgee.description = `QPay төлбөр - Гэрээ ${nekhemjlekh.gereeniiDugaar}`;
        bankGuilgee.accName = nekhemjlekh.nekhemjlekhiinDansniiNer || "";
        bankGuilgee.accNum = nekhemjlekh.nekhemjlekhiinDans || "";
        
        // QPay specific fields (using as virtual bank transaction)
        bankGuilgee.record = paymentTransactionId || nekhemjlekh.qpayInvoiceId;
        bankGuilgee.tranId = paymentTransactionId || nekhemjlekh.qpayInvoiceId;
        bankGuilgee.balance = 0;
        bankGuilgee.requestId = nekhemjlekh.qpayInvoiceId;
        
        // Link to contract (not invoice directly, as per system design)
        bankGuilgee.kholbosonGereeniiId = [nekhemjlekh.gereeniiId];
        bankGuilgee.kholbosonTalbainId = geree?.talbainDugaar ? [geree.talbainDugaar] : [];
        bankGuilgee.dansniiDugaar = nekhemjlekh.nekhemjlekhiinDans;
        bankGuilgee.bank = nekhemjlekh.nekhemjlekhiinBank || "qpay";
        bankGuilgee.baiguullagiinId = nekhemjlekh.baiguullagiinId;
        bankGuilgee.barilgiinId = nekhemjlekh.barilgiinId || "";
        bankGuilgee.kholbosonDun = nekhemjlekh.niitTulbur;
        bankGuilgee.ebarimtAvsanEsekh = false;
        bankGuilgee.drOrCr = "Credit";
        bankGuilgee.tranCrnCode = "MNT";
        bankGuilgee.exchRate = 1;
        bankGuilgee.postDate = new Date();
        
        // Generate index for uniqueness
        bankGuilgee.indexTalbar = `${bankGuilgee.barilgiinId}${bankGuilgee.bank}${bankGuilgee.dansniiDugaar}${bankGuilgee.record}${bankGuilgee.amount}`;
        
        await bankGuilgee.save();
      } catch (bankErr) {
        console.error("Error creating bank payment record:", bankErr);
      }

      // Automatically create e-barimt after successful payment
      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(nekhemjlekh.baiguullagiinId);
        
        // Try to find building by baiguullaga.barilgiinId
        let tuxainSalbar = baiguullaga?.barilguud?.find(
          (e) => e._id.toString() == baiguullaga.barilgiinId
        )?.tokhirgoo;
        
        // If not found, use first building as fallback
        if (!tuxainSalbar && baiguullaga?.barilguud?.length > 0) {
          tuxainSalbar = baiguullaga.barilguud[0].tokhirgoo;
        }

        if (tuxainSalbar && tuxainSalbar.eBarimtShine) {
          const { nekhemjlekheesEbarimtShineUusgye, ebarimtDuudya } = require("./ebarimtRoute");
          const EbarimtShine = require("../models/ebarimtShine");
          
          const nuatTulukhEsekh = !!tuxainSalbar.nuatTulukhEsekh;
          
          const ebarimt = await nekhemjlekheesEbarimtShineUusgye(
            nekhemjlekh,
            nekhemjlekh.register || "",
            "",
            tuxainSalbar.merchantTin,
            tuxainSalbar.districtCode,
            kholbolt,
            nuatTulukhEsekh
          );

          var butsaakhMethod = function (d, khariuObject) {
            try {
              if (d?.status != "SUCCESS" && !d.success) {
                return;
              }
              
              var shineBarimt = new EbarimtShine(kholbolt)(d);
              // Keep the original invoice ID that was set in nekhemjlekheesEbarimtShineUusgye
              shineBarimt.nekhemjlekhiinId = khariuObject.nekhemjlekhiinId;
              shineBarimt.baiguullagiinId = khariuObject.baiguullagiinId;
              shineBarimt.barilgiinId = khariuObject.barilgiinId;
              shineBarimt.gereeniiDugaar = khariuObject.gereeniiDugaar;
              shineBarimt.utas = khariuObject.utas;
              
              // Save QR code and receipt info from e-Barimt response
              if (d.qrData) shineBarimt.qrData = d.qrData;
              if (d.lottery) shineBarimt.lottery = d.lottery;
              if (d.id) shineBarimt.receiptId = d.id;
              if (d.date) shineBarimt.date = d.date;
              
              shineBarimt.save();
            } catch (err) {
              console.error("Failed to save e-barimt:", err);
            }
          };

          ebarimtDuudya(ebarimt, butsaakhMethod, null, true);
        }
      } catch (ebarimtError) {
        console.error("Failed to create e-barimt:", ebarimtError.message);
      }

      // Emit socket event for real-time updates
      req.app.get("socketio").emit(`nekhemjlekhPayment/${baiguullagiinId}/${nekhemjlekhiinId}`, {
        status: "success",
        tuluv: "Төлсөн",
        tulsunOgnoo: nekhemjlekh.tulsunOgnoo,
        paymentId: nekhemjlekh.qpayPaymentId
      });

      res.sendStatus(200);
    } catch (err) {
      console.error("QPay nekhemjlekh callback error:", err);
      next(err);
    }
  }
);

module.exports = router;
