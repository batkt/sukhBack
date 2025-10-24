const express = require("express");
const Baiguullaga = require("../models/baiguullaga");
const Nekhemjlekh = require("../models/nekhemjlekhiinTuukh");
const { tokenShalgakh, Dugaarlalt } = require("zevbackv2");
const {
  qpayGuilgeeUtgaAvya,
  qpayTulye,
} = require("../controller/qpayController");
const {
  qpayGargaya,
  qpayShalgay,
  QuickQpayObject,
  qpayKhariltsagchUusgey,
  QpayKhariltsagch,
} = require("quickqpaypackv2");
const router = express.Router();

// Create QPay payment for invoice
router.post("/qpayInvoiceGargaya", tokenShalgakh, async (req, res, next) => {
  try {
    const { nekhemjlekhId, baiguullagiinId, barilgiinId } = req.body;

    // Get invoice
    const nekhemjlekh = await Nekhemjlekh(
      req.body.tukhainBaaziinKholbolt
    ).findById(nekhemjlekhId);
    if (!nekhemjlekh) {
      return res
        .status(404)
        .json({ success: false, message: "Нэхэмжлэх олдсонгүй!" });
    }

    if (nekhemjlekh.tuluv === "Төлсөн") {
      return res.status(400).json({
        success: false,
        message: "Энэ нэхэмжлэх аль хэдийн төлөгдсөн байна!",
      });
    }

    // Get organization from main database
    const { db } = require("zevbackv2");
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga) {
      return res
        .status(404)
        .json({ success: false, message: "Байгууллагын мэдээлэл олдсонгүй!" });
    }

    // Check if organization has required QPay data
    if (!baiguullaga.dans || !baiguullaga.register) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагад QPay-д шаардлагатай мэдээлэл дутуу байна!",
        missing: {
          dans: !baiguullaga.dans,
          register: !baiguullaga.register,
        },
      });
    }

    // Generate invoice number
    const lastInvoice = await Nekhemjlekh(req.body.tukhainBaaziinKholbolt)
      .findOne({ baiguullagiinId })
      .sort({ dugaalaltDugaar: -1 });
    const maxDugaar = (lastInvoice?.dugaalaltDugaar || 0) + 1;

    // Create QPay payment
    const qpayData = {
      baiguullagiinId,
      barilgiinId: barilgiinId || "DEFAULT_BRANCH",
      dun: nekhemjlekh.niitTulbur,
      tailbar: `Нэхэмжлэх ${nekhemjlekh.dugaalaltDugaar || maxDugaar} - ${
        nekhemjlekh.ner || "Invoice"
      }`,
      zakhialgiinDugaar: maxDugaar.toString(),
      gereeniiId: nekhemjlekh.gereeniiId || nekhemjlekhId,
      dansniiDugaar: baiguullaga.dans,
      burtgeliinDugaar: baiguullaga.register,
    };

    console.log("🔍 QPay Data:", qpayData);
    console.log("🔍 Organization Data:", {
      dans: baiguullaga.dans,
      register: baiguullaga.register,
      ner: baiguullaga.ner,
    });
    console.log("🔍 Invoice Data:", {
      dugaalaltDugaar: nekhemjlekh.dugaalaltDugaar,
      ner: nekhemjlekh.ner,
      gereeniiId: nekhemjlekh.gereeniiId,
      niitTulbur: nekhemjlekh.niitTulbur,
    });

    const callbackUrl = `${process.env.UNDSEN_SERVER}/qpayInvoiceCallback/${baiguullagiinId}/${nekhemjlekhId}`;

    let qpayResponse;
    try {
      qpayResponse = await qpayGargaya(
        qpayData,
        callbackUrl,
        req.body.tukhainBaaziinKholbolt
      );
      console.log("✅ QPay Response:", qpayResponse);
    } catch (qpayError) {
      console.error("❌ QPay Error:", qpayError);
      throw qpayError;
    }

    // Save payment record
    const dugaarlalt = new Dugaarlalt(req.body.tukhainBaaziinKholbolt)();
    dugaarlalt.baiguullagiinId = baiguullagiinId;
    dugaarlalt.barilgiinId = barilgiinId;
    dugaarlalt.ognoo = new Date();
    dugaarlalt.turul = "qpayInvoice";
    dugaarlalt.dugaar = maxDugaar;
    await dugaarlalt.save();

    // Save QPay payment object
    const qpayObject = new QuickQpayObject(req.body.tukhainBaaziinKholbolt)();
    qpayObject.zakhialgiinDugaar = nekhemjlekhId;
    qpayObject.gereeniiId = nekhemjlekhId;
    qpayObject.baiguullagiinId = baiguullagiinId;
    qpayObject.barilgiinId = barilgiinId;
    qpayObject.amount = nekhemjlekh.niitTulbur;
    qpayObject.currency = "MNT";
    qpayObject.status = "error"; // Set as error since QPay failed
    qpayObject.description = qpayData.tailbar;
    qpayObject.qpay = qpayResponse;
    qpayObject.invoice_id = qpayResponse?.invoice_id || null;
    qpayObject.callback_url = callbackUrl;
    qpayObject.tulsunEsekh = false;
    await qpayObject.save();

    // Update invoice
    nekhemjlekh.qpayPaymentId = qpayResponse?.invoice_id || null;
    await nekhemjlekh.save();

    // Check if QPay response is valid
    if (
      typeof qpayResponse === "string" &&
      qpayResponse.includes("олдсонгүй")
    ) {
      return res.status(400).json({
        success: false,
        message: "QPay төлбөр үүсгэхэд алдаа гарлаа!",
        error: qpayResponse,
        data: {
          invoiceId: nekhemjlekhId,
          amount: nekhemjlekh.niitTulbur,
          qpayData: qpayData,
        },
      });
    }

    res.json({
      success: true,
      message: "QPay төлбөр амжилттай үүсгэгдлээ!",
      data: {
        qpayUrl: qpayResponse?.urls?.qPay,
        invoiceId: nekhemjlekhId,
        amount: nekhemjlekh.niitTulbur,
        paymentId: qpayResponse?.invoice_id,
      },
    });
  } catch (error) {
    console.error("QPay invoice payment creation error:", error);
    next(error);
  }
});

// Check QPay payment status for invoice
router.post("/qpayInvoiceShalgay", tokenShalgakh, async (req, res, next) => {
  try {
    const { nekhemjlekhId, baiguullagiinId, barilgiinId } = req.body;

    const nekhemjlekh = await Nekhemjlekh(
      req.body.tukhainBaaziinKholbolt
    ).findById(nekhemjlekhId);
    if (!nekhemjlekh) {
      return res
        .status(404)
        .json({ success: false, message: "Нэхэмжлэх олдсонгүй!" });
    }

    if (!nekhemjlekh.qpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "QPay төлбөрийн мэдээлэл олдсонгүй!",
      });
    }

    // Check payment status
    const paymentStatus = await qpayShalgay(
      {
        baiguullagiinId,
        barilgiinId: barilgiinId || "",
        id: nekhemjlekh.qpayPaymentId,
      },
      req.body.tukhainBaaziinKholbolt
    );

    res.json({
      success: true,
      data: {
        invoiceId: nekhemjlekhId,
        tuluv: nekhemjlekh.tuluv,
        amount: nekhemjlekh.niitTulbur,
        paymentStatus,
      },
    });
  } catch (error) {
    console.error("QPay invoice payment check error:", error);
    next(error);
  }
});

// Get invoice payment status
router.get(
  "/invoicePaymentStatus/:nekhemjlekhId",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      const { nekhemjlekhId } = req.params;

      const nekhemjlekh = await Nekhemjlekh(
        req.body.tukhainBaaziinKholbolt
      ).findById(nekhemjlekhId);
      if (!nekhemjlekh) {
        return res
          .status(404)
          .json({ success: false, message: "Нэхэмжлэх олдсонгүй!" });
      }

      // Check if payment is overdue
      const today = new Date();
      if (
        nekhemjlekh.tulukhOgnoo &&
        today > nekhemjlekh.tulukhOgnoo &&
        nekhemjlekh.tuluv !== "Төлсөн"
      ) {
        nekhemjlekh.tuluv = "Хугацаа хэтэрсэн";
        await nekhemjlekh.save();
      }

      res.json({
        success: true,
        data: {
          invoiceId: nekhemjlekhId,
          tuluv: nekhemjlekh.tuluv,
          amount: nekhemjlekh.niitTulbur,
          tulukhOgnoo: nekhemjlekh.tulukhOgnoo,
          tulsunOgnoo: nekhemjlekh.tulsunOgnoo,
          qpayPaymentId: nekhemjlekh.qpayPaymentId,
          paymentHistory: nekhemjlekh.paymentHistory,
        },
      });
    } catch (error) {
      console.error("Invoice payment status error:", error);
      next(error);
    }
  }
);

// QPay callback for invoice payment
router.get(
  "/qpayInvoiceCallback/:baiguullagiinId/:nekhemjlekhId",
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const { baiguullagiinId, nekhemjlekhId } = req.params;

      const kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == baiguullagiinId
      );
      if (!kholbolt) {
        return res
          .status(404)
          .json({ success: false, message: "Байгууллагын холболт олдсонгүй!" });
      }

      const qpayObject = await QuickQpayObject(kholbolt).findOne({
        zakhialgiinDugaar: nekhemjlekhId,
        tulsunEsekh: false,
      });

      if (!qpayObject) {
        return res.status(404).json({
          success: false,
          message: "QPay төлбөрийн мэдээлэл олдсонгүй!",
        });
      }

      // Mark as paid
      qpayObject.tulsunEsekh = true;
      qpayObject.isNew = false;
      await qpayObject.save();

      // Update invoice payment status
      const nekhemjlekh = await Nekhemjlekh(kholbolt).findById(nekhemjlekhId);
      if (nekhemjlekh && nekhemjlekh.tuluv !== "Төлсөн") {
        nekhemjlekh.tuluv = "Төлсөн";
        nekhemjlekh.tulsunOgnoo = new Date();
        nekhemjlekh.paymentHistory.push({
          ognoo: new Date(),
          dun: qpayObject.qpay?.amount || nekhemjlekh.niitTulbur,
          turul: "qpay",
          guilgeeniiId: qpayObject._id,
          tailbar: "QPay төлбөр",
        });
        await nekhemjlekh.save();
      }

      // Emit socket event
      req.app
        .get("socketio")
        .emit(`qpayInvoice/${baiguullagiinId}/${nekhemjlekhId}`);

      res.sendStatus(200);
    } catch (err) {
      console.error("QPay invoice callback error:", err);
      next(err);
    }
  }
);

// ===== ADDITIONAL QPAY ROUTES FROM SIMILAR PROJECT =====

// Update payment records
router.post("/qpayGuilgeeUtgaAvya", tokenShalgakh, qpayGuilgeeUtgaAvya);

// QPay callback for general payments (not just invoices)
router.get("/qpayTulye/:baiguullagiinId/:barilgiinId/:dugaar", qpayTulye);

router.post(
  "/qpayKhariltsagchUusgey",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      console.log("🔍 qpayKhariltsagchUusgey called with:", req.body);

      const { db } = require("zevbackv2");
      var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
        register: req.body.register,
      });

      console.log(
        "🔍 Found organization:",
        baiguullaga
          ? {
              id: baiguullaga._id,
              ner: baiguullaga.ner,
              register: baiguullaga.register,
            }
          : "NOT FOUND"
      );

      var kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == baiguullaga._id
      );

      console.log("🔍 Found database connection:", kholbolt ? "YES" : "NO");

      req.body.baiguullagiinId = baiguullaga._id;
      delete req.body.tukhainBaaziinKholbolt;
      delete req.body.erunkhiiKholbolt;

      console.log("🔍 Prepared data for QPay:", req.body);

      var khariu = await qpayKhariltsagchUusgey(req.body, kholbolt);

      console.log("🔍 QPay response:", khariu);

      if (khariu === "Amjilttai") {
        console.log("✅ QPay customer created successfully");
        res.send(khariu);
      } else {
        console.log("❌ QPay customer creation failed:", khariu);
        throw new Error(khariu);
      }
    } catch (err) {
      console.error("❌ qpayKhariltsagchUusgey error:", err);
      next(err);
    }
  }
);

router.post("/qpayKhariltsagchAvay", tokenShalgakh, async (req, res, next) => {
  try {
    console.log("🔍 qpayKhariltsagchAvay called with:", req.body);

    const { db } = require("zevbackv2");
    var baiguullaga1 = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: req.body.register,
    });

    console.log(
      "🔍 Found organization:",
      baiguullaga1
        ? {
            id: baiguullaga1._id,
            ner: baiguullaga1.ner,
            register: baiguullaga1.register,
          }
        : "NOT FOUND"
    );

    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );

    console.log("🔍 Found database connection:", kholbolt ? "YES" : "NO");

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);

    req.body.baiguullagiinId = baiguullaga1._id;

    console.log(
      "🔍 Searching for QPay customer with baiguullagiinId:",
      req.body.baiguullagiinId
    );

    const baiguullaga = await qpayKhariltsagch.findOne({
      baiguullagiinId: req.body.baiguullagiinId,
    });

    console.log("🔍 Found QPay customer:", baiguullaga ? "YES" : "NO");

    if (baiguullaga) {
      console.log("✅ Returning QPay customer data");
      res.send(baiguullaga);
    } else {
      console.log("❌ QPay customer not found, returning undefined");
      res.send(undefined);
    }
  } catch (err) {
    console.error("❌ qpayKhariltsagchAvay error:", err);
    next(err);
  }
});

module.exports = router;
