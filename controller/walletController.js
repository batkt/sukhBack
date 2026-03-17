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

  // Wallet-Service expects walletUserId (UUID) in userId header, not phone number
  // Return walletUserId if available, otherwise fall back to phone number
  return orshinSuugch.walletUserId || orshinSuugch.utas || tokenObject.id;
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
    // For getBillingByBiller, Wallet-Service requires phone number as userId, not walletUserId
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }
    
    // Use phone number for this endpoint (Wallet-Service requirement)
    const userId = orshinSuugch.utas;
    
    const { billerCode, customerCode } = req.params;
    
    if (!billerCode || !customerCode) {
      throw new aldaa("Биллер код болон хэрэглэгчийн код заавал бөглөх шаардлагатай!");
    }

    const billing = await walletApiService.getBillingByBiller(userId, billerCode, customerCode);
    
    // Check if billing is null, undefined, or empty array
    if (!billing || (Array.isArray(billing) && billing.length === 0)) {
      // Get user info to check if they have walletCustomerCode
      const { db } = require("zevbackv2");
      const OrshinSuugch = require("../models/orshinSuugch");
      const jwt = require("jsonwebtoken");
      const token = req.headers.authorization.split(" ")[1];
      const tokenObject = jwt.verify(token, process.env.APP_SECRET);
      const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
      
      let errorMessage = "Биллингийн мэдээлэл олдсонгүй";
      if (orshinSuugch && orshinSuugch.walletCustomerCode && orshinSuugch.walletCustomerCode !== customerCode) {
        errorMessage = `Хэрэглэгчийн код буруу байна. Таны бүртгэлтэй код: ${orshinSuugch.walletCustomerCode}`;
      }
      
      return res.status(404).json({
        success: false,
        message: errorMessage,
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
    // For getBillingList, Wallet-Service requires phone number as userId, not walletUserId
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }
    
    // Use phone number for this endpoint (Wallet-Service requirement)
    const userId = orshinSuugch.utas;
    
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
    // For billing endpoints, Wallet-Service requires phone number as userId, not walletUserId
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }
    
    // Use phone number for this endpoint (Wallet-Service requirement)
    const userId = orshinSuugch.utas;
    
    const { billingId } = req.params;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    // Verify user exists in Wallet API before making the call
    // getUserInfo also needs phone number
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
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    
    // Find orshinSuugch
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }
    
    const userId = orshinSuugch.utas;
    const { billingId } = req.params;
    
    if (!billingId) {
      throw new aldaa("Биллингийн ID заавал бөглөх шаардлагатай!");
    }

    // 1. Identify which address this billing belongs to before deleting
    let billingToRemove = null;
    try {
      const billingList = await walletApiService.getBillingList(userId);
      billingToRemove = billingList.find(b => b.billingId === billingId);
    } catch (listErr) {
      console.warn("⚠️ [WALLET REMOVE] Could not fetch billing list for cleanup info:", listErr.message);
    }

    // Capture current primary fields for fallback matching before they are cleared
    const primaryBairId = orshinSuugch.walletBairId;
    const primaryDoorNo = orshinSuugch.walletDoorNo;
    const primaryCustomerId = orshinSuugch.walletCustomerId;

    // 2. Remove from Wallet API
    const result = await walletApiService.removeBilling(userId, billingId);

    // 3. Local Cleanup
    let localUpdated = false;

    // Remove from toots array
    if (orshinSuugch.toots && orshinSuugch.toots.length > 0) {
      const initialLength = orshinSuugch.toots.length;
      
      orshinSuugch.toots = orshinSuugch.toots.filter(t => {
        if (t.source !== "WALLET_API") return true;

        // A. Match by billing info from API (if we successfully fetched it)
        if (billingToRemove) {
          const matchByAddress = String(t.walletBairId || "") === String(billingToRemove.bairId || "") && 
                                 String(t.walletDoorNo || "") === String(billingToRemove.doorNo || "");
          const matchByCustomer = billingToRemove.customerId && String(t.walletCustomerId || "") === String(billingToRemove.customerId);
          
          if (matchByAddress || matchByCustomer) return false;
        }

        // B. Fallback: Match against the primary wallet fields we captured
        const matchPrimaryAddress = primaryBairId && primaryDoorNo && 
                                    String(t.walletBairId || "") === String(primaryBairId) && 
                                    String(t.walletDoorNo || "") === String(primaryDoorNo);
        const matchPrimaryCustomer = primaryCustomerId && String(t.walletCustomerId || "") === String(primaryCustomerId);

        if (matchPrimaryAddress || matchPrimaryCustomer) return false;

        return true;
      });

      if (orshinSuugch.toots.length !== initialLength) {
        localUpdated = true;
      }
    }

    // Clear primary fields if they match the deleted billing
    const isPrimaryMatch = billingToRemove && 
      (orshinSuugch.walletCustomerId === billingToRemove.customerId || 
       (orshinSuugch.walletBairId === billingToRemove.bairId && orshinSuugch.walletDoorNo === billingToRemove.doorNo));

    if (isPrimaryMatch || (!billingToRemove && orshinSuugch.walletCustomerId)) {
      // Clear wallet-specific connection fields - set to empty strings as requested
      orshinSuugch.walletBairId = "";
      orshinSuugch.walletDoorNo = "";
      orshinSuugch.walletCustomerId = "";
      orshinSuugch.walletCustomerCode = "";
      orshinSuugch.bairniiNer = "";
      
      localUpdated = true;
    }

    if (localUpdated) {
      await orshinSuugch.save();
    }

    res.status(200).json({
      success: true,
      data: result,
      localUpdated,
      message: "Биллинг амжилттай устгаж, дотоод мэдээллийг цэвэрлэлээ",
    });
  } catch (err) {
    next(err);
  }
});

exports.walletBillRemove = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET);
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }
    
    // Use phone number for this endpoint (Wallet-Service requirement)
    const userId = orshinSuugch.utas;
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

exports.walletPaymentGet = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { paymentId } = req.params;
    
    if (!paymentId) {
      throw new aldaa("Төлбөрийн ID заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.getPayment(userId, paymentId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Төлбөр олдсонгүй",
      });
    }
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("❌ [WALLET PAYMENT GET] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET PAYMENT GET] Error response:", JSON.stringify(err.response.data));
    }
    next(err);
  }
});

exports.walletPaymentUpdateQPay = asyncHandler(async (req, res, next) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { paymentId } = req.params;
    const qpayData = req.body;
    
    if (!paymentId) {
      throw new aldaa("Төлбөрийн ID заавал бөглөх шаардлагатай!");
    }

    if (!qpayData || !qpayData.qpayPaymentId) {
      throw new aldaa("QPay төлбөрийн мэдээлэл заавал бөглөх шаардлагатай!");
    }

    const result = await walletApiService.updateQPayPayment(userId, paymentId, qpayData);
    
    // Local DB-д давхар хадгалах
    try {
      const { db } = require("zevbackv2");
      const WalletPayment = require("../models/walletPayment");
      
      let orshinSuugchId = null;
      if (req.headers.authorization) {
        const jwt = require("jsonwebtoken");
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const tokenObject = jwt.verify(token, process.env.APP_SECRET);
          if (tokenObject && tokenObject.id && tokenObject.id !== "zochin") {
            orshinSuugchId = tokenObject.id;
          }
        }
      }

      await WalletPayment(db.erunkhiiKholbolt).findOneAndUpdate(
        { paymentId: paymentId },
        { 
          $set: {
            userId: userId,
            orshinSuugchId: orshinSuugchId,
            qpayPaymentId: qpayData.qpayPaymentId,
            trxDate: qpayData.trxDate,
            trxNo: qpayData.trxNo,
            trxDescription: qpayData.trxDescription,
            amount: qpayData.amount,
            receiverBankCode: qpayData.receiverBankCode,
            receiverAccountNo: qpayData.receiverAccountNo,
            receiverAccountName: qpayData.receiverAccountName,
            rawQpayData: qpayData,
            status: "PAID"
          }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ [WALLET PAYMENT UPDATE QPAY] Payment saved to DB: ${paymentId}`);
    } catch (dbError) {
      console.error("❌ [WALLET PAYMENT UPDATE QPAY] Failed to save locally:", dbError.message);
    }

    res.status(200).json({
      success: true,
      data: result,
      message: "QPay төлбөрийн мэдээлэл амжилттай шинэчлэгдлээ",
    });
  } catch (err) {
    console.error("❌ [WALLET PAYMENT UPDATE QPAY] Error:", err.message);
    if (err.response) {
      console.error("❌ [WALLET PAYMENT UPDATE QPAY] Error response:", JSON.stringify(err.response.data));
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

