const asyncHandler = require("express-async-handler");
const walletApiService = require("../services/walletApiService");
const aldaa = require("../components/aldaa");
const {
  qpayGargaya,
  QuickQpayObject,
  qpayShalgay,
} = require("quickqpaypackvSukh");
const OrshinSuugch = require("../models/orshinSuugch");
const WalletInvoice = require("../models/walletInvoice");
const jwt = require("jsonwebtoken");

/**
 * Helper: get orshinSuugch + phone from auth token
 */
async function getOrshinSuugchFromToken(req) {
  const { db } = require("zevbackv2");
  if (!req.headers.authorization) return null;
  const token = req.headers.authorization.split(" ")[1];
  if (!token) return null;
  try {
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    if (!tokenObject?.id || tokenObject.id === "zochin") return null;
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .lean();
    return orshinSuugch || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────
//  POST /walletQpay/create
//  Same QPay flow as original, but source = WALLET_API
//
//  Body: { baiguullagiinId, barilgiinId?,
//          billingId, billIds[], vatReceiveType?,
//          dun? (override amount) }
// ──────────────────────────────────────────────────────
exports.createWalletQpayInvoice = asyncHandler(async (req, res, next) => {
  const { db } = require("zevbackv2");
  const { Dugaarlalt } = require("zevbackv2");

  const {
    baiguullagiinId,
    barilgiinId,
    billingId,
    billIds,
    vatReceiveType,
    dun: overrideDun,
  } = req.body;

  if (!baiguullagiinId) {
    throw new aldaa("baiguullagiinId заавал бөглөх шаардлагатай!");
  }

  /* ── 1. org connection ── */
  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );
  if (!tukhainBaaziinKholbolt) {
    throw new aldaa("Байгууллагын холболт олдсонгүй!");
  }

  /* ── 2. resident / phone ── */
  const orshinSuugch = await getOrshinSuugchFromToken(req);
  const userPhone = orshinSuugch?.utas;
  if (!userPhone) {
    throw new aldaa("Хэрэглэгчийн утас олдсонгүй. Нэвтрэх шаардлагатай.");
  }

  /* ── 3. Wallet API: create invoice ── */
  let walletInvoiceId = req.body.invoiceId || req.body.walletInvoiceId || null;
  let walletInvoiceResult = null;

  if (!walletInvoiceId && billingId && Array.isArray(billIds) && billIds.length > 0) {
    const invoiceData = {
      billingId,
      billIds,
      vatReceiveType: vatReceiveType || "CITIZEN",
      vatCompanyReg: req.body.vatCompanyReg || "",
    };

    try {
      walletInvoiceResult = await walletApiService.createInvoice(userPhone, invoiceData);
      walletInvoiceId = walletInvoiceResult.invoiceId;
      console.log(`✅ [WALLET QPAY] Wallet invoice created: ${walletInvoiceId}`);

      // Save wallet invoice metadata locally
      try {
        await WalletInvoice(db.erunkhiiKholbolt).create({
          userId: userPhone,
          orshinSuugchId: orshinSuugch?._id?.toString() || null,
          walletInvoiceId,
          billingId,
          billIds: billIds || [],
          billingName: walletInvoiceResult.billingName || "",
          customerId: walletInvoiceResult.customerId || "",
          customerName: walletInvoiceResult.customerName || "",
          customerAddress: walletInvoiceResult.customerAddress || "",
          totalAmount: walletInvoiceResult.invoiceTotal || walletInvoiceResult.totalAmount || null,
          source: "WALLET_QPAY",
        });
      } catch (saveErr) {
        console.error("⚠️ [WALLET QPAY] Failed to save wallet invoice locally:", saveErr.message);
      }
    } catch (err) {
      console.error("❌ [WALLET QPAY] Wallet invoice creation failed:", err.message);
      throw new aldaa(`Wallet нэхэмжлэх үүсгэхэд алдаа: ${err.message}`);
    }
  }

  if (!walletInvoiceId) {
    throw new aldaa("invoiceId эсвэл billingId+billIds заавал бөглөнө!");
  }

  /* ── 4. Wallet API: create payment ── */
  let walletPaymentResult;
  try {
    walletPaymentResult = await walletApiService.createPayment(userPhone, {
      invoiceId: walletInvoiceId,
    });
    console.log(`✅ [WALLET QPAY] Wallet payment created: ${walletPaymentResult.paymentId}`);
  } catch (err) {
    console.error("❌ [WALLET QPAY] Wallet payment creation failed:", err.message);
    throw new aldaa(`Wallet төлбөр үүсгэхэд алдаа: ${err.message}`);
  }

  const walletPaymentId = walletPaymentResult.paymentId;
  const paymentAmount = overrideDun
    ? parseFloat(overrideDun)
    : walletPaymentResult.paymentAmount || walletInvoiceResult?.invoiceTotal || 0;

  /* ── 5. QPay: create invoice (same as original flow) ── */
  // Build order number
  let maxDugaar = 1;
  try {
    const latest = await Dugaarlalt(tukhainBaaziinKholbolt)
      .find({
        baiguullagiinId,
        barilgiinId: barilgiinId || "",
        turul: "walletQpay",
      })
      .sort({ dugaar: -1 })
      .limit(1);
    if (latest.length > 0) maxDugaar = latest[0].dugaar + 1;
  } catch {
    // ignore
  }

  const zakhialgiinDugaar = `WQ-${maxDugaar}`;

  const qpayBody = {
    baiguullagiinId,
    barilgiinId: barilgiinId || "",
    dun: paymentAmount.toString(),
    tailbar: walletPaymentResult.transactionDescrion || walletPaymentResult.transactionDescription || `Wallet QPay - ${walletPaymentId}`,
    zakhialgiinDugaar,
    // Generic Mode: Pass Wallet API bank details directly
    merchant_id: "c6e38076-1791-4efc-b80c-0f8142d26d77",
    merchant_name: walletPaymentResult.receiverAccountName || "Токи ББСБ",
    custom_bank_accounts: [
      {
        account_bank_code: walletPaymentResult.receiverBankCode,
        account_number: walletPaymentResult.receiverAccountNo,
        account_name: walletPaymentResult.receiverAccountName,
      },
    ],
  };

  // Callback URL — wallet-specific callback
  const callback_url =
    process.env.UNDSEN_SERVER +
    "/walletQpay/callback/" +
    baiguullagiinId +
    "/" +
    walletPaymentId;

  let qpayResult;
  try {
    qpayResult = await qpayGargaya(qpayBody, callback_url, tukhainBaaziinKholbolt);
    
    // Check if qpayResult is an error message (string) or missing QR data
    if (typeof qpayResult === "string" || !qpayResult.invoice_id) {
       const errorMsg = typeof qpayResult === "string" ? qpayResult : "QPay нэхэмжлэх үүсгэхэд алдаа гарлаа (QR дата олдсонгүй)";
       console.error("❌ [WALLET QPAY] QPay error:", errorMsg);
       throw new Error(errorMsg);
    }
    
    console.log(`✅ [WALLET QPAY] QPay invoice created: ${qpayResult.invoice_id}`);
  } catch (qpayError) {
    console.error("❌ [WALLET QPAY] QPay invoice creation failed:", qpayError.message);
    throw new aldaa(`QPay нэхэмжлэх үүсгэхэд алдаа: ${qpayError.message}`);
  }

  /* ── 6. Save order number ── */
  try {
    const dugaarlalt = new Dugaarlalt(tukhainBaaziinKholbolt)();
    dugaarlalt.baiguullagiinId = baiguullagiinId;
    dugaarlalt.barilgiinId = barilgiinId || "";
    dugaarlalt.turul = "walletQpay";
    dugaarlalt.dugaar = maxDugaar;
    await dugaarlalt.save();
  } catch {
    // non-critical
  }

  /* ── 7. Tag the QuickQpayObject with wallet metadata ── */
  try {
    const qpayInvoiceId = qpayResult.invoice_id || qpayResult.invoiceId || qpayResult.id;
    // Wait briefly for the QuickQpayObject to be saved by the package
    await new Promise((r) => setTimeout(r, 500));
    await QuickQpayObject(tukhainBaaziinKholbolt).findOneAndUpdate(
      { invoice_id: qpayInvoiceId },
      {
        $set: {
          walletPaymentId,
          walletInvoiceId,
          source: "WALLET_QPAY",
        },
      },
      { new: true, strict: false }
    );
  } catch (tagErr) {
    console.error("⚠️ [WALLET QPAY] Failed to tag QuickQpayObject:", tagErr.message);
  }

  /* ── 8. Respond ── */
  res.status(200).json({
    success: true,
    source: "WALLET_QPAY",
    data: qpayResult, // QR image, qr_text, urls, etc. — same shape as original
    walletPaymentId,
    walletInvoiceId,
    paymentAmount,
  });
});

// ──────────────────────────────────────────────────────
//  GET /walletQpay/callback/:baiguullagiinId/:walletPaymentId
//  QPay calls this URL after user pays.
//  Same logic as original callback, but additionally
//  calls Wallet API paidByQpay to settle the bill.
// ──────────────────────────────────────────────────────
exports.walletQpayCallback = asyncHandler(async (req, res, next) => {
  const { db } = require("zevbackv2");
  const { baiguullagiinId, walletPaymentId } = req.params;

  console.log(`📥 [WALLET QPAY CALLBACK] baiguullagiinId=${baiguullagiinId}, walletPaymentId=${walletPaymentId}`);

  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );
  if (!tukhainBaaziinKholbolt) {
    return res.status(404).send("Organization not found");
  }

  /* ── 1. Find the QuickQpayObject tagged with this walletPaymentId ── */
  let qpayObject = await QuickQpayObject(tukhainBaaziinKholbolt).findOne({
    walletPaymentId,
    tulsunEsekh: false,
  });

  // Fallback: search by callback_url pattern
  if (!qpayObject) {
    qpayObject = await QuickQpayObject(tukhainBaaziinKholbolt).findOne({
      "qpay.callback_url": { $regex: walletPaymentId },
      tulsunEsekh: false,
    });
  }

  if (!qpayObject) {
    console.error("❌ [WALLET QPAY CALLBACK] QuickQpayObject not found for walletPaymentId:", walletPaymentId);
    return res.status(404).send("Payment not found");
  }

  /* ── 2. Mark paid (same as original) ── */
  qpayObject.tulsunEsekh = true;
  qpayObject.isNew = false;
  if (req.query?.qpay_payment_id) {
    qpayObject.payment_id = req.query.qpay_payment_id;
  }
  await qpayObject.save();

  /* ── 3. Get QPay payment details for the paidByQpay call ── */
  let qpayPaymentId = req.query?.qpay_payment_id || "";
  let trxNo = "";
  let trxDate = new Date().toISOString();
  let trxAmount = parseFloat(qpayObject.qpay?.amount || 0);

  if (qpayObject.invoice_id) {
    try {
      const checkResult = await qpayShalgay(
        { invoice_id: qpayObject.invoice_id },
        tukhainBaaziinKholbolt
      );
      if (checkResult?.payments?.[0]) {
        const payment = checkResult.payments[0];
        qpayPaymentId = qpayPaymentId || payment.payment_id || "";
        if (payment.transactions?.[0]) {
          trxNo = payment.transactions[0].id || "";
          trxDate = payment.transactions[0].settlement_date || trxDate;
          trxAmount = payment.transactions[0].amount || trxAmount;
        }
      }
    } catch (checkErr) {
      console.error("⚠️ [WALLET QPAY CALLBACK] QPay check failed:", checkErr.message);
    }
  }

  /* ── 4. Call Wallet API paidByQpay ── */
  const walletInvoiceId = qpayObject.walletInvoiceId || "";

  // We need the user's phone to call Wallet API.
  // Try finding it via the walletInvoice we saved earlier.
  let userId = null;
  try {
    const walletInvoiceDoc = await WalletInvoice(db.erunkhiiKholbolt)
      .findOne({ walletInvoiceId })
      .lean();
    userId = walletInvoiceDoc?.userId || null;
  } catch {
    // ignore
  }

  if (userId) {
    try {
      const paidByQpayData = {
        qpayPaymentId: qpayPaymentId,
        trxDate: trxDate,
        trxNo: trxNo,
        trxDescription: qpayObject.qpay?.description || `WalletQPay-${walletPaymentId}`,
        amount: trxAmount,
        receiverBankCode: qpayObject.qpay?.receiver_bank_code || "",
        receiverAccountNo: qpayObject.qpay?.receiver_account_number || "",
        receiverAccountName: qpayObject.qpay?.receiver_account_name || "",
      };

      console.log(`📤 [WALLET QPAY CALLBACK] Calling Wallet paidByQpay for paymentId=${walletPaymentId}`);
      await walletApiService.updateQPayPayment(userId, walletPaymentId, paidByQpayData);
      console.log(`✅ [WALLET QPAY CALLBACK] Wallet paidByQpay success`);
    } catch (walletErr) {
      console.error("❌ [WALLET QPAY CALLBACK] Wallet paidByQpay failed:", walletErr.message);
      // Non-critical — payment is already marked paid in QPay side
    }
  } else {
    console.warn("⚠️ [WALLET QPAY CALLBACK] Could not find userId for Wallet API call");
  }

  /* ── 5. Emit socket event ── */
  const io = req.app.get("socketio");
  if (io) {
    io.emit(`walletQpay/${baiguullagiinId}/${walletPaymentId}`, {
      status: "PAID",
      qpayPaymentId,
    });
  }

  res.sendStatus(200);
});

// ──────────────────────────────────────────────────────
//  GET /walletQpay/check/:baiguullagiinId/:walletPaymentId
//  Frontend polls this to check if QPay payment is done
// ──────────────────────────────────────────────────────
exports.walletQpayCheck = asyncHandler(async (req, res, next) => {
  const { db } = require("zevbackv2");
  const { baiguullagiinId, walletPaymentId } = req.params;

  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );
  if (!tukhainBaaziinKholbolt) {
    throw new aldaa("Байгууллагын холболт олдсонгүй!");
  }

  // Find the QPay object tagged with this walletPaymentId
  const qpayObject = await QuickQpayObject(tukhainBaaziinKholbolt).findOne({
    walletPaymentId,
  });

  if (!qpayObject) {
    return res.status(404).json({ success: false, message: "Payment not found" });
  }

  // If already marked paid locally
  if (qpayObject.tulsunEsekh) {
    return res.json({
      success: true,
      status: "PAID",
      walletPaymentId,
      qpayPaymentId: qpayObject.payment_id || "",
    });
  }

  // Otherwise check QPay status
  if (qpayObject.invoice_id) {
    try {
      const checkResult = await qpayShalgay(
        { invoice_id: qpayObject.invoice_id },
        tukhainBaaziinKholbolt
      );
      const isPaid = checkResult?.payments?.some(
        (p) => p.payment_status === "PAID" || p.status === "PAID"
      );
      if (isPaid) {
        return res.json({ success: true, status: "PAID", walletPaymentId });
      }
    } catch {
      // ignore
    }
  }

  res.json({ success: true, status: "PENDING", walletPaymentId });
});
