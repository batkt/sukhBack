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

    // Ensure billingId is included (should already be added by getBillingByBiller)
    // Sanitize null values to empty strings for String fields
    const sanitizeResponse = (data) => {
      if (Array.isArray(data)) {
        return data.map(item => {
          const sanitized = { ...item };
          for (const key in sanitized) {
            if (sanitized[key] === null || sanitized[key] === undefined) {
              sanitized[key] = "";
            }
          }
          return sanitized;
        });
      } else if (typeof data === 'object') {
        const sanitized = { ...data };
        for (const key in sanitized) {
          if (sanitized[key] === null || sanitized[key] === undefined) {
            sanitized[key] = "";
          }
        }
        return sanitized;
      }
      return data;
    };

    const sanitizedBilling = sanitizeResponse(billing);

    res.status(200).json({
      success: true,
      data: sanitizedBilling,
    });
  } catch (err) {
    console.error("❌ [WALLET BILLING BY BILLER] Error:", err.message);
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
    const billingList = await walletApiService.getBillingList(userId);
    const data = Array.isArray(billingList) ? billingList : [];
    
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
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    // Verify user exists in Wallet API before making the call
    try {
      const walletUserInfo = await walletApiService.getUserInfo(userId);
      if (!walletUserInfo || !walletUserInfo.userId) {
        throw new aldaa("Хэтэвчний системд бүртгэлгүй байна. Эхлээд нэвтэрнэ үү.");
      }
    } catch (userCheckError) {
      console.error("❌ [WALLET BILLING BILLS] User not found in Wallet API:", userCheckError.message);
      throw new aldaa("Хэтэвчний системд бүртгэлгүй байна. Эхлээд нэвтэрнэ үү.");
    }

    const bills = await walletApiService.getBillingBills(userId, billingId);
    const data = Array.isArray(bills) ? bills : [];
    
    // Ensure all bills are properly sanitized (double-check)
    const sanitizedData = data.map((bill) => {
      const sanitized = {};
      for (const key in bill) {
        if (bill.hasOwnProperty(key)) {
          const value = bill[key];
          
          // Convert null/undefined to empty string for all fields
          if (value === null || value === undefined) {
            sanitized[key] = "";
          } else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) => {
              return (item === null || item === undefined) ? "" : item;
            });
          } else {
            sanitized[key] = value;
          }
        }
      }
      return sanitized;
    });
    
    res.status(200).json({
      success: true,
      data: sanitizedData,
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
    
    if (!invoiceData) {
      throw new aldaa("Нэхэмжлэхийн мэдээлэл заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.createInvoice(userId, invoiceData);
    
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
    
    if (!invoiceId) {
      throw new aldaa("Нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const invoice = await walletApiService.getInvoice(userId, invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Нэхэмжлэх олдсонгүй",
      });
    }
    
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
    
    if (!invoiceId) {
      throw new aldaa("Нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.cancelInvoice(userId, invoiceId);
    
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
    
    if (!paymentData || !paymentData.invoiceId) {
      throw new aldaa("Төлбөрийн мэдээлэл болон нэхэмжлэхийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.createPayment(userId, paymentData);
    
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

