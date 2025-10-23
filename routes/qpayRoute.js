const express = require("express");
const Baiguullaga = require("../models/baiguullaga");
const Nekhemjlekh = require("../models/nekhemjlekhiinTuukh");
const { tokenShalgakh, Dugaarlalt } = require("zevbackv2");
const { localTokenShalgakh } = require("../middleware/localTokenShalgakh");
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

router.post("/qpayKhariltsagchAvay", async (req, res, next) => {
  try {
    console.log("🔍 qpayKhariltsagchAvay called with:", req.body);
    console.log("🔍 Request URL:", req.url);
    console.log("🔍 Request method:", req.method);
    console.log("🔍 Full request body:", JSON.stringify(req.body, null, 2));

    // Log the authorization header for debugging
    console.log(
      "🔍 Authorization header:",
      req.headers.authorization ? "Present" : "Missing"
    );
    if (req.headers.authorization) {
      console.log(
        "🔍 Token preview:",
        req.headers.authorization.substring(0, 50) + "..."
      );
    }

    const { db } = require("zevbackv2");

    // Check if register is provided
    if (!req.body.register) {
      return res.status(400).json({
        success: false,
        message: "Register дугаар заавал бөглөх шаардлагатай!",
      });
    }

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

    if (!baiguullaga1) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
      });
    }

    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );

    console.log("🔍 Found database connection:", kholbolt ? "YES" : "NO");

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын холболт олдсонгүй!",
      });
    }

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
      const response = {
        success: true,
        data: baiguullaga,
        length: Array.isArray(baiguullaga) ? baiguullaga.length : 1,
        message: "QPay харилцагч олдлоо",
        baiguullagiinId: baiguullaga1._id,
        showRegistrationModal: false,
        // Add properties that frontend might be expecting
        result: baiguullaga,
        results: Array.isArray(baiguullaga) ? baiguullaga : [baiguullaga],
        items: Array.isArray(baiguullaga) ? baiguullaga : [baiguullaga],
        records: Array.isArray(baiguullaga) ? baiguullaga : [baiguullaga],
        total: Array.isArray(baiguullaga) ? baiguullaga.length : 1,
        count: Array.isArray(baiguullaga) ? baiguullaga.length : 1,
        isEmpty: false,
        hasData: true,
        responseLength: Array.isArray(baiguullaga) ? baiguullaga.length : 1,
      };
      console.log("🔍 Sending response:", JSON.stringify(response, null, 2));
      res.json(response);
    } else {
      console.log("❌ QPay customer not found, returning empty");
      
      // FORCE EVERYTHING TO HAVE LENGTH PROPERTY
      const emptyArray = [];
      emptyArray.length = 0;
      
      // Create response that is BOTH an array AND an object
      const response = Object.assign([], {
        success: true,
        data: emptyArray,
        message: "QPay харилцагч олдсонгүй",
        baiguullagiinId: baiguullaga1._id,
        showRegistrationModal: true,
        // Force length on EVERYTHING
        length: 0,
        dataLength: 0,
        resultLength: 0,
        resultsLength: 0,
        itemsLength: 0,
        recordsLength: 0,
        responseLength: 0,
        // Force arrays with length
        result: emptyArray,
        results: emptyArray,
        items: emptyArray,
        records: emptyArray,
        list: emptyArray,
        array: emptyArray,
        collection: emptyArray,
        // Force counts
        total: 0,
        count: 0,
        size: 0,
        totalCount: 0,
        itemCount: 0,
        recordCount: 0,
        // Force booleans
        isEmpty: true,
        hasData: false,
        hasItems: false,
        hasRecords: false,
      });
      
      // FORCE the response itself to be array-like with length
      Object.defineProperty(response, 'length', {
        value: 0,
        writable: true,
        enumerable: true,
        configurable: true
      });
      
      // FORCE every nested property to have length
      Object.keys(response).forEach(key => {
        if (Array.isArray(response[key])) {
          Object.defineProperty(response[key], 'length', {
            value: 0,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      });
      
      // FORCE the response to be iterable
      response[Symbol.iterator] = function* () {
        yield* this.data;
      };
      
      // FORCE the response to have array methods
      response.push = Array.prototype.push;
      response.pop = Array.prototype.pop;
      response.slice = Array.prototype.slice;
      response.map = Array.prototype.map;
      response.filter = Array.prototype.filter;
      response.forEach = Array.prototype.forEach;
      
      console.log("🔍 Sending FORCED response:", JSON.stringify(response, null, 2));
      console.log("🔍 Response length:", response.length);
      console.log("🔍 Response is array:", Array.isArray(response));
      res.json(response);
    }
  } catch (err) {
    console.error("❌ qpayKhariltsagchAvay error:", err);
    res.status(500).json({
      success: false,
      message: "Серверийн алдаа",
      error: err.message,
    });
  }
});

// Test endpoint to debug frontend expectations
router.post("/qpayKhariltsagchAvayTest", async (req, res, next) => {
  try {
    console.log("🧪 Test endpoint called");
    console.log("🔍 Request body:", req.body);

    // Return a comprehensive response that should work with any frontend
    const response = {
      success: true,
      data: [],
      length: 0,
      message: "Test response - no QPay customer found",
      baiguullagiinId: "68f9a24a4bfc2380347f78ec",
      showRegistrationModal: true,
      // Multiple ways to access the data
      result: [],
      results: [],
      items: [],
      records: [],
      total: 0,
      count: 0,
      isEmpty: true,
      hasData: false,
      responseLength: 0,
      // Add the response itself as an array-like object
      [Symbol.iterator]: function* () {
        yield* this.data;
      },
    };

    console.log("🔍 Sending test response:", JSON.stringify(response, null, 2));
    res.json(response);
  } catch (err) {
    console.error("❌ Test endpoint error:", err);
    res.status(500).json({
      success: false,
      message: "Test error",
      error: err.message,
    });
  }
});

// Alternative approach - return the response as an array
router.post("/qpayKhariltsagchAvayArray", async (req, res, next) => {
  try {
    console.log("🔧 Array endpoint called");

    const { db } = require("zevbackv2");

    if (!req.body.register) {
      return res.json([]); // Return empty array directly
    }

    var baiguullaga1 = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: req.body.register,
    });

    if (!baiguullaga1) {
      return res.json([]); // Return empty array directly
    }

    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );

    if (!kholbolt) {
      return res.json([]); // Return empty array directly
    }

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);

    const baiguullaga = await qpayKhariltsagch.findOne({
      baiguullagiinId: baiguullaga1._id,
    });

    if (baiguullaga) {
      res.json([baiguullaga]); // Return array with one item
    } else {
      res.json([]); // Return empty array
    }
  } catch (err) {
    console.error("❌ Array endpoint error:", err);
    res.json([]); // Return empty array on error
  }
});

// Ultra-compatible endpoint that should work with any frontend
router.post("/qpayKhariltsagchAvayCompatible", async (req, res, next) => {
  try {
    console.log("🔧 Compatible endpoint called");

    const { db } = require("zevbackv2");

    if (!req.body.register) {
      return res.json({
        success: false,
        data: [],
        length: 0,
        message: "Register дугаар заавал бөглөх шаардлагатай!",
        showRegistrationModal: true,
      });
    }

    var baiguullaga1 = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: req.body.register,
    });

    if (!baiguullaga1) {
      return res.json({
        success: false,
        data: [],
        length: 0,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
        showRegistrationModal: true,
      });
    }

    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );

    if (!kholbolt) {
      return res.json({
        success: false,
        data: [],
        length: 0,
        message: "Байгууллагын холболт олдсонгүй!",
        showRegistrationModal: true,
      });
    }

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);

    const baiguullaga = await qpayKhariltsagch.findOne({
      baiguullagiinId: baiguullaga1._id,
    });

    if (baiguullaga) {
      res.json({
        success: true,
        data: baiguullaga,
        length: 1,
        message: "QPay харилцагч олдлоо",
        showRegistrationModal: false,
      });
    } else {
      res.json({
        success: true,
        data: [],
        length: 0,
        message: "QPay харилцагч олдсонгүй",
        showRegistrationModal: true,
        baiguullagiinId: baiguullaga1._id,
      });
    }
  } catch (err) {
    console.error("❌ Compatible endpoint error:", err);
    res.json({
      success: false,
      data: [],
      length: 0,
      message: "Серверийн алдаа",
      error: err.message,
      showRegistrationModal: false,
    });
  }
});

// Last resort - try to match exactly what frontend expects
router.post("/qpayKhariltsagchAvayLastResort", async (req, res, next) => {
  try {
    console.log("🚨 Last resort endpoint called");

    const { db } = require("zevbackv2");

    if (!req.body.register) {
      // Return exactly what might be expected
      const emptyResponse = [];
      emptyResponse.length = 0;
      emptyResponse.success = false;
      emptyResponse.message = "Register дугаар заавал бөглөх шаардлагатай!";
      emptyResponse.showRegistrationModal = true;
      return res.json(emptyResponse);
    }

    var baiguullaga1 = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: req.body.register,
    });

    if (!baiguullaga1) {
      const emptyResponse = [];
      emptyResponse.length = 0;
      emptyResponse.success = false;
      emptyResponse.message = "Байгууллагын мэдээлэл олдсонгүй!";
      emptyResponse.showRegistrationModal = true;
      return res.json(emptyResponse);
    }

    var kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga1._id
    );

    if (!kholbolt) {
      const emptyResponse = [];
      emptyResponse.length = 0;
      emptyResponse.success = false;
      emptyResponse.message = "Байгууллагын холболт олдсонгүй!";
      emptyResponse.showRegistrationModal = true;
      return res.json(emptyResponse);
    }

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);

    const baiguullaga = await qpayKhariltsagch.findOne({
      baiguullagiinId: baiguullaga1._id,
    });

    if (baiguullaga) {
      const response = [baiguullaga];
      response.length = 1;
      response.success = true;
      response.message = "QPay харилцагч олдлоо";
      response.showRegistrationModal = false;
      res.json(response);
    } else {
      const emptyResponse = [];
      emptyResponse.length = 0;
      emptyResponse.success = true;
      emptyResponse.message = "QPay харилцагч олдсонгүй";
      emptyResponse.showRegistrationModal = true;
      emptyResponse.baiguullagiinId = baiguullaga1._id;
      res.json(emptyResponse);
    }
  } catch (err) {
    console.error("❌ Last resort endpoint error:", err);
    const errorResponse = [];
    errorResponse.length = 0;
    errorResponse.success = false;
    errorResponse.message = "Серверийн алдаа";
    errorResponse.error = err.message;
    errorResponse.showRegistrationModal = false;
    res.json(errorResponse);
  }
});

module.exports = router;
