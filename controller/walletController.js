const asyncHandler = require("express-async-handler");
const walletApiService = require("../services/walletApiService");
const aldaa = require("../components/aldaa");
const jwt = require("jsonwebtoken");
const OrshinSuugch = require("../models/orshinSuugch");

async function getUserIdFromToken(req) {
  if (!req.headers.authorization) {
    throw new aldaa("Нэвтрэх шаардлагатай!");
  }

  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    throw new aldaa("Token олдсонгүй!");
  }

  let tokenObject;
  try {
    tokenObject = jwt.verify(token, process.env.APP_SECRET);
  } catch (jwtError) {
    throw new aldaa("Token хүчингүй байна!");
  }

  if (!tokenObject?.id || tokenObject.id === "zochin") {
    throw new aldaa("Энэ үйлдлийг хийх эрх байхгүй байна!");
  }

  const { db } = require("zevbackv2");
  const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
  if (!orshinSuugch) {
    throw new aldaa("Хэрэглэгч олдсонгүй!");
  }

  return orshinSuugch.utas || tokenObject.id;
}

exports.walletBillers = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const billers = await walletApiService.getBillers(userId);
    res.status(200).json({
      success: true,
      data: billers,
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillingByBiller = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billerCode, customerCode } = req.params;
    
    if (!billerCode || !customerCode) {
      throw new aldaa("Биллер код болон хэрэглэгчийн код заавал бөглөх шаардлагатай!");
    }

    const billing = await walletApiService.getBillingByBiller(userId, billerCode, customerCode);
    
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Биллингийн мэдээлэл олдсонгүй",
      });
    }

    res.status(200).json({
      success: true,
      data: billing,
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillingByCustomer = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { customerId } = req.params;
    
    if (!customerId) {
      throw new aldaa("Хэрэглэгчийн ID заавал бөглөх шаардлагатай!");
    }

    const billing = await walletApiService.getBillingByCustomer(userId, customerId);
    
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: "Биллингийн мэдээлэл олдсонгүй",
      });
    }

    res.status(200).json({
      success: true,
      data: billing,
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillingList = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    console.log("📋 [WALLET BILLING LIST] Fetching billing list for user:", userId);
    
    const billingList = await walletApiService.getBillingList(userId);
    
    const data = Array.isArray(billingList) ? billingList : [];
    
    console.log("✅ [WALLET BILLING LIST] Returning", data.length, "billing(s)");
    if (data.length > 0) {
      console.log("✅ [WALLET BILLING LIST] First billing:", {
        billingId: data[0].billingId,
        billingName: data[0].billingName,
        customerName: data[0].customerName,
        hasPayableBills: data[0].hasPayableBills,
        payableBillCount: data[0].payableBillCount,
      });
    }
    
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (err) {
    console.error("❌ [WALLET BILLING LIST] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET BILLING LIST] Error response:", JSON.stringify(err.response.data));
    }
    next(err);
  }
});

exports.walletBillingBills = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);  // Returns phoneNumber (utas)
    const { billingId } = req.params;
    
    console.log("📄 [WALLET BILLING BILLS] Fetching bills for billingId:", billingId);
    console.log("📄 [WALLET BILLING BILLS] Using userId (phoneNumber):", userId);
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    // Verify user exists in Wallet API before making the call
    try {
      const walletUserInfo = await walletApiService.getUserInfo(userId);
      if (!walletUserInfo || !walletUserInfo.userId) {
        throw new aldaa("Хэтэвчний системд бүртгэлгүй байна. Эхлээд нэвтэрнэ үү.");
      }
      console.log("✅ [WALLET BILLING BILLS] User verified in Wallet API");
    } catch (userCheckError) {
      console.error("❌ [WALLET BILLING BILLS] User not found in Wallet API:", userCheckError.message);
      throw new aldaa("Хэтэвчний системд бүртгэлгүй байна. Эхлээд нэвтэрнэ үү.");
    }

    const bills = await walletApiService.getBillingBills(userId, billingId);
    const data = Array.isArray(bills) ? bills : [];
    
    console.log("✅ [WALLET BILLING BILLS] Returning", data.length, "bill(s) for billingId:", billingId);
    
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (err) {
    console.error("❌ [WALLET BILLING BILLS] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET BILLING BILLS] Error response:", JSON.stringify(err.response.data));
    }
    next(err);
  }
});

exports.walletBillingPayments = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billingId } = req.params;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    const payments = await walletApiService.getBillingPayments(userId, billingId);
    const data = Array.isArray(payments) ? payments : [];
    
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (err) {
    console.error("❌ [WALLET BILLING PAYMENTS] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET BILLING PAYMENTS] Error response:", JSON.stringify(err.response.data));
    }
    next(err);
  }
});

exports.walletBillingSave = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const billingData = req.body;
    
    if (!billingData) {
      throw new aldaa("Биллингийн мэдээлэл заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.saveBilling(userId, billingData);
    res.status(200).json({
      success: true,
      data: result,
      message: "Биллингийн мэдээлэл амжилттай хадгаллаа",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillingRemove = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billingId } = req.params;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.removeBilling(userId, billingId);
    res.status(200).json({
      success: true,
      data: result,
      message: "Биллинг амжилттай устгалаа",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillRemove = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billingId, billId } = req.params;
    
    if (!billingId || !billId) {
      throw new aldaa("Биллингийн ID болон Билл-ийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.removeBill(userId, billingId, billId);
    res.status(200).json({
      success: true,
      data: result,
      message: "Билл амжилттай устгалаа",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillRecover = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billingId } = req.params;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.recoverBill(userId, billingId);
    res.status(200).json({
      success: true,
      data: result,
      message: "Билл амжилттай сэргээлээ",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillingChangeName = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { billingId } = req.params;
    const { name } = req.body;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    if (!name) {
      throw new aldaa("Биллингийн нэр заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.changeBillingName(userId, billingId, name);
    res.status(200).json({
      success: true,
      data: result,
      message: "Биллингийн нэр амжилттай өөрчлөгдлөө",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletInvoiceCreate = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const invoiceData = req.body;
    
    console.log("📝 [WALLET INVOICE CREATE] Creating invoice for user:", userId);
    console.log("📝 [WALLET INVOICE CREATE] Invoice data:", JSON.stringify(invoiceData));
    
    if (!invoiceData) {
      throw new aldaa("Нэхэмжлэхийн мэдээлэл заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.createInvoice(userId, invoiceData);
    
    console.log("✅ [WALLET INVOICE CREATE] Invoice created successfully");
    console.log("✅ [WALLET INVOICE CREATE] Invoice ID:", result.invoiceId);
    
    res.status(200).json({
      success: true,
      data: result,
      message: "Нэхэмжлэх амжилттай үүсгэлээ",
    });
  } catch (err) {
    console.error("❌ [WALLET INVOICE CREATE] Error:", err.message);
    next(err);
  }
});

exports.walletInvoiceGet = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { invoiceId } = req.params;
    
    console.log("📄 [WALLET INVOICE GET] Getting invoice for user:", userId);
    console.log("📄 [WALLET INVOICE GET] Invoice ID:", invoiceId);
    
    if (!invoiceId) {
      throw new aldaa("Нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const invoice = await walletApiService.getInvoice(userId, invoiceId);
    
    if (!invoice) {
      console.log("⚠️ [WALLET INVOICE GET] Invoice not found");
      return res.status(404).json({
        success: false,
        message: "Нэхэмжлэх олдсонгүй",
      });
    }

    console.log("✅ [WALLET INVOICE GET] Invoice found");
    console.log("✅ [WALLET INVOICE GET] Invoice status:", invoice.invoiceStatus);
    
    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("❌ [WALLET INVOICE GET] Error:", err.message);
    next(err);
  }
});

exports.walletInvoiceCancel = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { invoiceId } = req.params;
    
    console.log("🚫 [WALLET INVOICE CANCEL] Canceling invoice for user:", userId);
    console.log("🚫 [WALLET INVOICE CANCEL] Invoice ID:", invoiceId);
    
    if (!invoiceId) {
      throw new aldaa("Нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.cancelInvoice(userId, invoiceId);
    
    console.log("✅ [WALLET INVOICE CANCEL] Invoice canceled successfully");
    
    res.status(200).json({
      success: true,
      data: result,
      message: "Нэхэмжлэх амжилттай цуцлагдлаа",
    });
  } catch (err) {
    console.error("❌ [WALLET INVOICE CANCEL] Error:", err.message);
    next(err);
  }
});

exports.walletPaymentCreate = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const paymentData = req.body;
    
    console.log("💳 [WALLET PAYMENT CREATE] Creating payment for user:", userId);
    console.log("💳 [WALLET PAYMENT CREATE] Payment data:", JSON.stringify(paymentData));
    
    if (!paymentData || !paymentData.invoiceId) {
      throw new aldaa("Төлбөрийн мэдээлэл болон нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.createPayment(userId, paymentData);
    
    console.log("✅ [WALLET PAYMENT CREATE] Payment created successfully");
    console.log("✅ [WALLET PAYMENT CREATE] Payment ID:", result.paymentId);
    if (result.qrText) {
      console.log("✅ [WALLET PAYMENT CREATE] QR code generated");
    }
    
    res.status(200).json({
      success: true,
      data: result,
      message: "Төлбөр амжилттай үүсгэлээ",
    });
  } catch (err) {
    console.error("❌ [WALLET PAYMENT CREATE] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET PAYMENT CREATE] Error response:", JSON.stringify(err.response.data));
    }
    next(err);
  }
});

exports.walletUserEdit = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const userData = req.body;
    
    if (!userData) {
      throw new aldaa("Хэрэглэгчийн мэдээлэл заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.editUser(userId, userData);
    res.status(200).json({
      success: true,
      data: result,
      message: "Хэрэглэгчийн мэдээлэл амжилттай шинэчлэгдлээ",
    });
  } catch (err) {
    next(err);
  }
});

