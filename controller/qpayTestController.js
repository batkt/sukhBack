const asyncHandler = require("express-async-handler");
const { Dugaarlalt, Token, db } = require("zevbackv2");
const { QuickQpayObject } = require("quickqpaypackv2");
const Nekhemjlekh = require("../models/nekhemjlekhiinTuukh");
const Baiguullaga = require("../models/baiguullaga");
const got = require("got");
const { URL } = require("url");

const instance = got.extend({
  hooks: {
    beforeRequest: [
      (options) => {
        options.headers["Content-Type"] = "application/json";
        if (options.context && options.context.token) {
          options.headers["Authorization"] = options.context.token;
        }
      },
    ],
  },
});

// QPay Test Environment Setup
const QPAY_TEST_CONFIG = {
  username: "ZEV_TABS1",
  password: "PB5RcI2g",
  terminal_id: "95000059",
  base_url: process.env.QPAY_TEST_SERVER || "https://merchant-sandbox.qpay.mn/"
};

// Get QPay test token
async function getTestToken(baiguullagiinId, tukhainBaaziinKholbolt) {
  try {
    const url = new URL(QPAY_TEST_CONFIG.base_url + "v2/auth/token/");
    url.username = QPAY_TEST_CONFIG.username;
    url.password = QPAY_TEST_CONFIG.password;
    
    const response = await instance.post(url, {
      body: JSON.stringify({ terminal_id: QPAY_TEST_CONFIG.terminal_id })
    });
    
    const tokenData = JSON.parse(response.body);
    
    // Save token to database
    await Token(tukhainBaaziinKholbolt).updateOne(
      { turul: "qpay_test", baiguullagiinId: baiguullagiinId },
      {
        ognoo: new Date(),
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        turul: "qpay_test"
      },
      { upsert: true }
    );
    
    return tokenData;
  } catch (error) {
    console.error("QPay test token error:", error);
    throw error;
  }
}

// Create test payment
async function createTestPayment(paymentData, token, tukhainBaaziinKholbolt) {
  try {
    const url = QPAY_TEST_CONFIG.base_url + "v2/invoice";
    const context = { token: "Bearer " + token };
    
    const response = await instance.post(url, {
      context,
      body: JSON.stringify(paymentData)
    });
    
    return JSON.parse(response.body);
  } catch (error) {
    console.error("QPay test payment creation error:", error);
    throw error;
  }
}

// Check payment status
async function checkTestPaymentStatus(invoiceId, token) {
  try {
    const url = QPAY_TEST_CONFIG.base_url + "v2/payment/check";
    const context = { token: "Bearer " + token };
    
    const response = await instance.post(url, {
      context,
      body: JSON.stringify({ invoice_id: invoiceId })
    });
    
    return JSON.parse(response.body);
  } catch (error) {
    console.error("QPay test payment check error:", error);
    throw error;
  }
}

// Create test invoice for QPay testing
exports.createTestInvoice = asyncHandler(async (req, res) => {
  try {
    const { baiguullagiinId, amount = 1000, description = "QPay Test Payment" } = req.body;
    
    // Get organization
    const baiguullaga = await Baiguullaga(req.body.tukhainBaaziinKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({ success: false, message: "Байгууллагын мэдээлэл олдсонгүй!" });
    }

    // Get or create test token
    let tokenObject = await Token(req.body.tukhainBaaziinKholbolt).findOne({
      turul: "qpay_test",
      baiguullagiinId: baiguullagiinId,
      ognoo: { $gte: new Date(new Date().getTime() - 29 * 60000) }
    });
    
    let token;
    if (!tokenObject) {
      const tokenData = await getTestToken(baiguullagiinId, req.body.tukhainBaaziinKholbolt);
      token = tokenData.access_token;
    } else {
      token = tokenObject.token;
    }

    // Create test payment data
    const paymentData = {
      invoice_code: `TEST_${Date.now()}`,
      sender_invoice_no: `TEST_INV_${Date.now()}`,
      invoice_receiver_code: baiguullaga.dans || "TEST_DANS",
      invoice_description: description,
      amount: amount,
      callback_url: `${process.env.UNDSEN_SERVER || 'http://localhost:8084'}/qpay/testCallback/${baiguullagiinId}`,
      sender_branch_code: "001",
      sender_terminal_id: QPAY_TEST_CONFIG.terminal_id
    };

    // Create QPay test payment
    const qpayResponse = await createTestPayment(paymentData, token, req.body.tukhainBaaziinKholbolt);
    
    // Save test payment record
    const testPayment = new QuickQpayObject(req.body.tukhainBaaziinKholbolt)();
    testPayment.zakhialgiinDugaar = paymentData.sender_invoice_no;
    testPayment.baiguullagiinId = baiguullagiinId;
    testPayment.amount = amount;
    testPayment.currency = "MNT";
    testPayment.status = "pending";
    testPayment.description = description;
    testPayment.qpay = qpayResponse;
    testPayment.invoice_id = qpayResponse.invoice_id;
    testPayment.callback_url = paymentData.callback_url;
    await testPayment.save();

    res.json({
      success: true,
      message: "QPay тест төлбөр амжилттай үүсгэгдлээ!",
      data: {
        invoiceId: qpayResponse.invoice_id,
        qrData: qpayResponse.qr_data,
        qrImage: qpayResponse.qr_image,
        urls: qpayResponse.urls,
        amount: amount,
        description: description,
        testPaymentId: testPayment._id
      }
    });

  } catch (error) {
    console.error("QPay test invoice creation error:", error);
    res.status(500).json({ success: false, message: "Тест төлбөр үүсгэхэд алдаа гарлаа!", error: error.message });
  }
});

// Check test payment status
exports.checkTestPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { testPaymentId, baiguullagiinId } = req.body;
    
    // Get test payment record
    const testPayment = await QuickQpayObject(req.body.tukhainBaaziinKholbolt).findById(testPaymentId);
    if (!testPayment) {
      return res.status(404).json({ success: false, message: "Тест төлбөрийн мэдээлэл олдсонгүй!" });
    }

    // Get token
    const tokenObject = await Token(req.body.tukhainBaaziinKholbolt).findOne({
      turul: "qpay_test",
      baiguullagiinId: baiguullagiinId,
      ognoo: { $gte: new Date(new Date().getTime() - 29 * 60000) }
    });
    
    if (!tokenObject) {
      return res.status(400).json({ success: false, message: "QPay токен олдсонгүй!" });
    }

    // Check payment status
    const paymentStatus = await checkTestPaymentStatus(testPayment.invoice_id, tokenObject.token);
    
    // Update local status
    if (paymentStatus.payments && paymentStatus.payments.length > 0) {
      const payment = paymentStatus.payments[0];
      testPayment.status = payment.payment_status;
      testPayment.tulsunEsekh = payment.payment_status === "PAID";
      testPayment.payment_id = payment.payment_id;
      testPayment.transaction_id = payment.transaction_id;
      await testPayment.save();
    }

    res.json({
      success: true,
      data: {
        testPaymentId: testPaymentId,
        invoiceId: testPayment.invoice_id,
        status: testPayment.status,
        isPaid: testPayment.tulsunEsekh,
        amount: testPayment.amount,
        paymentStatus: paymentStatus,
        lastChecked: new Date()
      }
    });

  } catch (error) {
    console.error("QPay test payment status check error:", error);
    res.status(500).json({ success: false, message: "Төлбөрийн статус шалгахад алдаа гарлаа!", error: error.message });
  }
});

// Get all test payments
exports.getTestPayments = asyncHandler(async (req, res) => {
  try {
    const { baiguullagiinId, status, limit = 10, page = 1 } = req.query;
    
    const query = { baiguullagiinId: baiguullagiinId };
    if (status) {
      query.status = status;
    }
    
    const testPayments = await QuickQpayObject(req.body.tukhainBaaziinKholbolt)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await QuickQpayObject(req.body.tukhainBaaziinKholbolt).countDocuments(query);
    
    res.json({
      success: true,
      data: {
        testPayments: testPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get test payments error:", error);
    res.status(500).json({ success: false, message: "Тест төлбөрүүдийг авахад алдаа гарлаа!", error: error.message });
  }
});

// Test payment callback handler
exports.testPaymentCallback = asyncHandler(async (req, res) => {
  try {
    const { baiguullagiinId } = req.params;
    const { invoice_id, payment_status } = req.body;
    
    console.log("QPay Test Callback received:", { baiguullagiinId, invoice_id, payment_status });
    
    // Find test payment
    const testPayment = await QuickQpayObject(req.body.tukhainBaaziinKholbolt).findOne({
      invoice_id: invoice_id,
      baiguullagiinId: baiguullagiinId
    });
    
    if (testPayment) {
      testPayment.status = payment_status;
      testPayment.tulsunEsekh = payment_status === "PAID";
      testPayment.updated_at = new Date();
      await testPayment.save();
      
      // Emit real-time update
      req.app.get("socketio").emit(`qpayTestUpdate/${baiguullagiinId}`, {
        testPaymentId: testPayment._id,
        status: payment_status,
        isPaid: testPayment.tulsunEsekh,
        timestamp: new Date()
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("QPay test callback error:", error);
    res.status(500).json({ success: false, message: "Callback боловсруулахад алдаа гарлаа!" });
  }
});
