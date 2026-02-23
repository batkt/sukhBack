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
} = require("quickqpaypackvSukh");

// BANK ACCOUNT ENDPOINT - MUST BE FIRST TO AVOID ROUTE CONFLICTS
router.get("/qpayBankAccountsView", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, salbariinId } = req.query;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    var kholbolt = db.kholboltuud.find(
      (a) => String(a.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).send({
        success: false,
        message: "Organization connection not found",
      });
    }

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);
    const qpayConfig = await qpayKhariltsagch
      .findOne({
        baiguullagiinId: baiguullagiinId,
      })
      .lean();

    if (!qpayConfig || !qpayConfig.salbaruud || !Array.isArray(qpayConfig.salbaruud)) {
      return res.send({
        success: true,
        bank_accounts: [],
        message: "No salbaruud found",
      });
    }

    // If salbariinId is provided, get bank_accounts for that specific salbar
    if (salbariinId) {
      const targetSalbar = qpayConfig.salbaruud.find(
        (salbar) => String(salbar.salbariinId) === String(salbariinId)
      );

      if (targetSalbar && targetSalbar.bank_accounts) {
        return res.send({
          success: true,
          salbariinNer: targetSalbar.salbariinNer,
          salbariinId: targetSalbar.salbariinId,
          bank_accounts: targetSalbar.bank_accounts,
        });
      } else {
        return res.send({
          success: true,
          bank_accounts: [],
          message: `No bank accounts found for salbar ${salbariinId}`,
        });
      }
    }

    // If no salbariinId, return all bank_accounts from all salbaruud with salbar info
    const result = qpayConfig.salbaruud
      .filter((salbar) => salbar.bank_accounts && salbar.bank_accounts.length > 0)
      .map((salbar) => ({
        salbariinId: salbar.salbariinId,
        salbariinNer: salbar.salbariinNer,
        bank_accounts: salbar.bank_accounts,
      }));

    res.send({
      success: true,
      baiguullagiinId: baiguullagiinId,
      salbaruud: result,
    });
  } catch (err) {
    next(err);
  }
});

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
          io.emit(
            `qpayMobileSdk${req.params.baiguullagiinId}${req.params.cameraIP}`,
            {
              khaalgaTurul: "Гарах",
              turul: "qpayMobile",
              mashiniiDugaar: req.params.mashiniiDugaar,
              cameraIP: req.params.cameraIP,
              uilchluulegchiinId: qpayObject.zogsoolUilchluulegch.uId,
            }
          );
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

router.get("/accountNumbers", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const AccountNumber = require("../models/accountNumber");
    const { baiguullagiinId } = req.query;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).send({
        success: false,
        message: "Organization connection not found",
      });
    }

    const accountNumbers = await AccountNumber(tukhainBaaziinKholbolt).find({
      baiguullagiinId: baiguullagiinId,
    });

    res.send({
      success: true,
      data: accountNumbers,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/qpayGargaya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const OrshinSuugch = require("../models/orshinSuugch");
    const walletApiService = require("../services/walletApiService");

    // Auto-detect address source and route to appropriate QPay service
    let useWalletQPay = false;
    let userPhoneNumber = null;
    let detectedSource = "CUSTOM"; // CUSTOM or WALLET_API

    // Priority 1: Check if baiguullagiinId is provided in request body (definitely OWN_ORG)
    if (req.body.baiguullagiinId) {
      detectedSource = "CUSTOM";
    } else {
      // Priority 2: Try to get user from token to check address source
      try {
        const jwt = require("jsonwebtoken");
        if (req.headers.authorization) {
          const token = req.headers.authorization.split(" ")[1];
          if (token) {
            const tokenObject = jwt.verify(token, process.env.APP_SECRET);
            if (tokenObject?.id && tokenObject.id !== "zochin") {
              const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id).lean();
              if (orshinSuugch) {
                userPhoneNumber = orshinSuugch.utas;
                // If user has baiguullagiinId, it's OWN_ORG address - use custom QPay
                // If user doesn't have baiguullagiinId, it's Wallet API address - use Wallet QPay
                if (orshinSuugch.baiguullagiinId) {
                  detectedSource = "CUSTOM";
                } else if (orshinSuugch.walletUserId || orshinSuugch.walletBairId) {
                  detectedSource = "WALLET_API";
                  useWalletQPay = true;
                }
              }
            }
          }
        }
      } catch (tokenError) {
        // Default to custom QPay if detection fails
        detectedSource = "CUSTOM";
      }
    }

    // If useWalletQPay is true, route to Wallet API QPay
    if (useWalletQPay && userPhoneNumber) {
      try {
        
        // Create a safe copy of request body for logging (exclude Mongoose objects)
        const safeBody = {};
        for (const key in req.body) {
          if (key !== 'tukhainBaaziinKholbolt' && key !== 'erunkhiiKholbolt' && 
              typeof req.body[key] !== 'object' || req.body[key] === null || 
              Array.isArray(req.body[key]) || req.body[key].constructor?.name === 'String') {
            try {
              JSON.stringify(req.body[key]);
              safeBody[key] = req.body[key];
            } catch (e) {
              safeBody[key] = `[${typeof req.body[key]}]`;
            }
          } else {
            safeBody[key] = `[${req.body[key]?.constructor?.name || typeof req.body[key]}]`;
          }
        }
        
        let invoiceId = req.body.invoiceId || req.body.walletInvoiceId;
        
        // If invoiceId is not provided, but billingId and billIds are provided, create invoice first
        if (!invoiceId && req.body.billingId && req.body.billIds && Array.isArray(req.body.billIds) && req.body.billIds.length > 0) {
          
          const invoiceData = {
            billingId: req.body.billingId,
            billIds: req.body.billIds,
            vatReceiveType: req.body.vatReceiveType || "CITIZEN",
            vatCompanyReg: req.body.vatCompanyReg || "",
          };
          
          try {
            const invoiceResult = await walletApiService.createInvoice(userPhoneNumber, invoiceData);
            
            if (invoiceResult && invoiceResult.invoiceId) {
              invoiceId = invoiceResult.invoiceId;
            } else {
              throw new Error("Failed to create invoice - invoiceId not returned");
            }
          } catch (invoiceError) {
            // If invoice creation fails because bill is already in another invoice
            const errorMessage = invoiceError.message || "";
            
            // Check if error indicates bill is already being paid
            const isBillAlreadyInInvoice = 
              errorMessage.includes("өөр нэхэмжлэлээр төлөлт") || 
              errorMessage.includes("already") || 
              errorMessage.includes("төлөлт хийгдэж") ||
              errorMessage.includes("Билл өөр нэхэмжлэлээр");
            
            if (isBillAlreadyInInvoice) {
              
              try {
                // Try to get existing payments for this billing
                const existingPayments = await walletApiService.getBillingPayments(userPhoneNumber, req.body.billingId);
                
                if (existingPayments && existingPayments.length > 0) {
                  
                  // Get the most recent payment
                  const latestPayment = existingPayments[existingPayments.length - 1];
                  
                  // Extract paymentId - it might be in different fields
                  const paymentId = latestPayment.paymentId || latestPayment.id || latestPayment._id;
                  
                  if (paymentId) {
                    
                    // Fetch full payment details to get bank information
                    try {
                      const fullPaymentDetails = await walletApiService.getPayment(userPhoneNumber, paymentId);
                      
                      if (fullPaymentDetails) {
                        // Extract bank details from payment status
                        let bankCode = fullPaymentDetails.receiverBankCode;
                        let accountNo = fullPaymentDetails.receiverAccountNo;
                        let accountName = fullPaymentDetails.receiverAccountName;
                        
                        // Check in lines -> billTransactions
                        if (!bankCode && fullPaymentDetails.lines && Array.isArray(fullPaymentDetails.lines)) {
                          for (const line of fullPaymentDetails.lines) {
                            if (line.billTransactions && Array.isArray(line.billTransactions) && line.billTransactions.length > 0) {
                              const transaction = line.billTransactions[0];
                              bankCode = bankCode || transaction.receiverBankCode;
                              accountNo = accountNo || transaction.receiverAccountNo;
                              accountName = accountName || transaction.receiverAccountName;
                              if (bankCode && accountNo) break;
                            }
                          }
                        }
                        
                        // Return the existing payment with full details
                        return res.status(200).json({
                          success: true,
                          data: {
                            paymentId: paymentId,
                            paymentAmount: fullPaymentDetails.amount || fullPaymentDetails.totalAmount || fullPaymentDetails.paymentAmount || latestPayment.paymentAmount || latestPayment.amount,
                            receiverBankCode: bankCode || "",
                            receiverAccountNo: accountNo || "",
                            receiverAccountName: accountName || "",
                            transactionDescription: fullPaymentDetails.transactionDescription || latestPayment.transactionDescription || "",
                            paymentStatus: fullPaymentDetails.paymentStatus,
                            paymentStatusText: fullPaymentDetails.paymentStatusText,
                            message: "Төлбөр аль хэдийн үүссэн байна",
                            existingPayment: true,
                          },
                          message: "Төлбөр аль хэдийн үүссэн байна. Дээрх төлбөрийг ашиглана уу.",
                          source: "WALLET_API",
                        });
                      }
                    } catch (getPaymentError) {
                      // Fall through to return basic payment info
                    }
                    
                    // If we couldn't get full details, return what we have
                    return res.status(200).json({
                      success: true,
                      data: {
                        paymentId: paymentId,
                        paymentAmount: latestPayment.paymentAmount || latestPayment.amount || latestPayment.totalAmount,
                        receiverBankCode: latestPayment.receiverBankCode || "",
                        receiverAccountNo: latestPayment.receiverAccountNo || "",
                        receiverAccountName: latestPayment.receiverAccountName || "",
                        transactionDescription: latestPayment.transactionDescription || "",
                        message: "Төлбөр аль хэдийн үүссэн байна",
                        existingPayment: true,
                      },
                      message: "Төлбөр аль хэдийн үүссэн байна. Дээрх төлбөрийг ашиглана уу.",
                      source: "WALLET_API",
                    });
                  } else {
                  }
                } else {
                }
              } catch (paymentError) {
                // Don't throw - continue to return error about bill already in invoice
              }
              
              // If no existing payments found, return clear error
              return res.status(400).json({
                success: false,
                message: errorMessage,
                error: "BILL_ALREADY_IN_INVOICE",
                errorCode: "BILL_ALREADY_IN_INVOICE",
                suggestion: "Энэ биллийг өөр нэхэмжлэлээр төлөлт хийгдэж байна. Төлбөрийн түүхийг шалгана уу.",
                billingId: req.body.billingId,
                billIds: req.body.billIds,
              });
            }
            
            // For other errors, re-throw
            throw invoiceError;
          }
        } else if (!invoiceId) {
        }
        
        // Check if invoiceId is available (required for Wallet API payment)
        if (!invoiceId) {
          const errorMsg = "Invoice ID is required for Wallet API QPay payment. " +
            "Please provide one of the following:\n" +
            "1. invoiceId (if invoice already created)\n" +
            "2. billingId + billIds[] (to auto-create invoice)\n\n" +
            "Current request has: " + Object.keys(req.body).filter(k => 
              !['tukhainBaaziinKholbolt', 'erunkhiiKholbolt', 'nevtersenAjiltniiToken'].includes(k)
            ).join(', ');
          throw new Error(errorMsg);
        }
        
        const paymentData = {
          invoiceId: invoiceId,
          // paymentMethod is not needed - Wallet API auto-detects QPay
        };
        
        const result = await walletApiService.createPayment(userPhoneNumber, paymentData);
        
        
        // Check if bank details are in the initial createPayment response
        const hasInitialBankDetails = result.receiverBankCode && result.receiverAccountNo;
        
        // If bank details are empty, try to get full payment details
        if (!hasInitialBankDetails) {
          
          let bankCode = null;
          let accountNo = null;
          let accountName = null;
          let paymentStatus = null;
          let paymentStatusText = null;
          
          const initialDelay = 3000; // Wait 3 seconds for payment to be processed by Wallet API
          
          // Wait for payment to be processed by Wallet API
          await new Promise(resolve => setTimeout(resolve, initialDelay));
          
          try {
            
            const fullPaymentDetails = await walletApiService.getPayment(userPhoneNumber, result.paymentId);
            
            if (fullPaymentDetails) {
              paymentStatus = fullPaymentDetails.paymentStatus;
              paymentStatusText = fullPaymentDetails.paymentStatusText;
              
              
              // Try root level first
              bankCode = fullPaymentDetails.receiverBankCode;
              accountNo = fullPaymentDetails.receiverAccountNo;
              accountName = fullPaymentDetails.receiverAccountName;
              
              
              // Check in lines -> billTransactions (as seen in Postman collection)
              if ((!bankCode || !accountNo) && fullPaymentDetails.lines && Array.isArray(fullPaymentDetails.lines)) {
                
                for (let lineIdx = 0; lineIdx < fullPaymentDetails.lines.length; lineIdx++) {
                  const line = fullPaymentDetails.lines[lineIdx];
                  
                  if (line.billTransactions && Array.isArray(line.billTransactions) && line.billTransactions.length > 0) {
                    
                    bankCode = bankCode || transaction.receiverBankCode;
                    accountNo = accountNo || transaction.receiverAccountNo;
                    accountName = accountName || transaction.receiverAccountName;
                    
                    if (bankCode && accountNo) {
                      break;
                    }
                  } else {
                  }
                }
              } else {
                if (!fullPaymentDetails.lines) {
                }
              }
              
              if (bankCode && accountNo) {
              } else {
              }
            }
          } catch (getPaymentError) {
          }
          
          // Merge payment details with initial response
          Object.assign(result, {
            receiverBankCode: bankCode || result.receiverBankCode || "",
            receiverAccountNo: accountNo || result.receiverAccountNo || "",
            receiverAccountName: accountName || result.receiverAccountName || "",
            paymentStatus: paymentStatus || result.paymentStatus,
            paymentStatusText: paymentStatusText || result.paymentStatusText,
          });
          
          if (!bankCode || !accountNo) {
          }
        }
        
        // Check for QR code in response
        if (result.qrText) {
        } else {
        }
        
        // Check if bank details are still missing after retries
        const hasBankDetails = result.receiverBankCode && result.receiverAccountNo;
        
        return res.status(200).json({
          success: true,
          data: result,
          message: hasBankDetails 
            ? "QPay төлбөр амжилттай үүсгэлээ" 
            : "Төлбөр үүссэн. Банкны мэдээлэл бэлтгэж байна. Түр хүлээнэ үү.",
          source: "WALLET_API",
          invoiceId: invoiceId, // Return invoiceId in case frontend needs it
          needsPolling: !hasBankDetails, // Flag to indicate frontend should poll for bank details
          pollingEndpoint: hasBankDetails ? null : `/api/payment/${result.paymentId}`, // Endpoint to poll (relative path)
        });
      } catch (walletQPayError) {
        // Fall back to custom QPay if Wallet QPay fails
        useWalletQPay = false;
        detectedSource = "CUSTOM";
      }
    }

    // Continue with custom QPay (OWN_ORG or fallback)
    if (!req.body.tukhainBaaziinKholbolt && req.body.baiguullagiinId) {
      req.body.tukhainBaaziinKholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(req.body.baiguullagiinId)
      );
    }

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
        req.body.dansniiDugaar = "5112418947";
      req.body.tailbar = tailbar;
      var callback_url =
        process.env.UNDSEN_SERVER +
        "/qpaycallback/" +
        req.body.baiguullagiinId +
        "/" +
        req.body?.zakhialgiinDugaar;
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
        if (req.body.dun > 0) {
          // qpayShimtgel feature removed
        }
      }

      // Handle multiple invoices payment
      if (
        req.body.nekhemjlekhiinTuukh &&
        Array.isArray(req.body.nekhemjlekhiinTuukh)
      ) {
        // Multiple invoices payment
        if (!req.body.tukhainBaaziinKholbolt) {
          req.body.tukhainBaaziinKholbolt = db.kholboltuud.find(
            (k) =>
              String(k.baiguullagiinId) === String(req.body.baiguullagiinId)
          );
        }

        const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
        const invoiceIds = req.body.nekhemjlekhiinTuukh;

        // Fetch all invoices
        const invoices = await nekhemjlekhiinTuukh(
          req.body.tukhainBaaziinKholbolt
        )
          .find({ _id: { $in: invoiceIds } })
          .lean();

        if (invoices.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Нэхэмжлэхүүд олдсонгүй",
          });
        }

        // Calculate total amount if not provided
        if (!req.body.dun) {
          const totalAmount = invoices.reduce((sum, inv) => {
            return sum + (inv.niitTulbur || 0);
          }, 0);
          req.body.dun = totalAmount.toString();
        }

        // Get common fields from first invoice
        const firstInvoice = invoices[0];
        if (!req.body.barilgiinId && firstInvoice.barilgiinId) {
          req.body.barilgiinId = firstInvoice.barilgiinId;
        }
        if (!req.body.dansniiDugaar && firstInvoice.dansniiDugaar) {
          req.body.dansniiDugaar = firstInvoice.dansniiDugaar;
        }

        // For multiple invoices, use the barilgiinId from the first invoice
        // The QpayKhariltsagch lookup below will handle getting the correct bank account

        // Create callback URL with comma-separated invoice IDs
        const invoiceIdsString = invoiceIds.join(",");
        callback_url =
          process.env.UNDSEN_SERVER +
          "/qpayNekhemjlekhMultipleCallback/" +
          req.body.baiguullagiinId.toString() +
          "/" +
          invoiceIdsString;
      } else if (req.body.nekhemjlekhiinId) {
        // Single invoice payment (existing logic)
        callback_url =
          process.env.UNDSEN_SERVER +
          "/qpayNekhemjlekhCallback/" +
          req.body.baiguullagiinId.toString() +
          "/" +
          req.body.nekhemjlekhiinId.toString();

        if (!req.body.dun && req.body.tukhainBaaziinKholbolt) {
          try {
            const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
            const nekhemjlekh = await nekhemjlekhiinTuukh(
              req.body.tukhainBaaziinKholbolt
            )
              .findById(req.body.nekhemjlekhiinId)
              .lean();
            if (nekhemjlekh) {
              if (nekhemjlekh.niitTulbur) {
                req.body.dun = nekhemjlekh.niitTulbur.toString();
              }
              if (!req.body.barilgiinId && nekhemjlekh.barilgiinId) {
                req.body.barilgiinId = nekhemjlekh.barilgiinId;
              }
              if (!req.body.dansniiDugaar && nekhemjlekh.dansniiDugaar) {
                req.body.dansniiDugaar = nekhemjlekh.dansniiDugaar;
              }
              if (!req.body.gereeniiId && nekhemjlekh.gereeniiId) {
                req.body.gereeniiId = nekhemjlekh.gereeniiId;
              }
            } else {
            }
          } catch (err) {
          }
        }
      }

      // Fetch QpayKhariltsagch to get building-specific bank account
      // This should happen after barilgiinId is determined
      if (req.body.barilgiinId && req.body.tukhainBaaziinKholbolt) {
        try {
          const { Dans } = require("zevbackv2");
          const qpayKhariltsagch = new QpayKhariltsagch(
            req.body.tukhainBaaziinKholbolt
          );
          const qpayConfig = await qpayKhariltsagch
            .findOne({
              baiguullagiinId: req.body.baiguullagiinId,
            })
            .lean();

          if (
            qpayConfig &&
            qpayConfig.salbaruud &&
            Array.isArray(qpayConfig.salbaruud)
          ) {
            // Find the salbar that matches barilgiinId (salbariinId)
            const targetSalbar = qpayConfig.salbaruud.find(
              (salbar) =>
                String(salbar.salbariinId) === String(req.body.barilgiinId)
            );

            if (
              targetSalbar &&
              targetSalbar.bank_accounts &&
              Array.isArray(targetSalbar.bank_accounts) &&
              targetSalbar.bank_accounts.length > 0
            ) {
              // Use the first bank account from this salbar
              const bankAccount = targetSalbar.bank_accounts[0];
              const newDansniiDugaar =
                bankAccount.account_number || req.body.dansniiDugaar;

              // Check if this account exists in Dans model with merchant credentials
              const dansModel = Dans(req.body.tukhainBaaziinKholbolt);
              const dansWithMerchant = await dansModel
                .findOne({
                  dugaar: newDansniiDugaar,
                  baiguullagiinId: req.body.baiguullagiinId,
                })
                .lean();

              if (dansWithMerchant && dansWithMerchant.qpayAshiglakhEsekh) {
                // Account exists in Dans with QPay enabled, use it
                req.body.dansniiDugaar = newDansniiDugaar;
                req.body.burtgeliinDugaar =
                  bankAccount.account_bank_code || req.body.burtgeliinDugaar;

              } else {
                // Account doesn't exist in Dans or doesn't have QPay enabled
                // Try to find a Dans entry for this barilga with QPay enabled
                let fallbackDans = await dansModel
                  .findOne({
                    baiguullagiinId: req.body.baiguullagiinId,
                    barilgiinId: req.body.barilgiinId,
                    qpayAshiglakhEsekh: true,
                  })
                  .lean();

                if (!fallbackDans) {
                  // Try organization-level Dans (without barilgiinId filter)
                  fallbackDans = await dansModel
                    .findOne({
                      baiguullagiinId: req.body.baiguullagiinId,
                      qpayAshiglakhEsekh: true,
                    })
                    .lean();
                }

                if (fallbackDans) {
                  // Use the Dans account number for merchant credentials lookup
                  // But we can still use building-specific account for display if needed
                  req.body.dansniiDugaar = fallbackDans.dugaar;
                  req.body.burtgeliinDugaar =
                    bankAccount.account_bank_code || req.body.burtgeliinDugaar;

                } else {
                  // Don't change dansniiDugaar if no valid Dans found
                }
              }
            } else {
            }
          } else {
          }
        } catch (qpayConfigError) {
          // Continue with existing dansniiDugaar if error occurs
        }
      }

      let khariu;
      try {
        khariu = await qpayGargaya(
          req.body,
          callback_url,
          req.body.tukhainBaaziinKholbolt
        );
      } catch (qpayError) {
        // Enhanced error logging for QPay errors
        let errorBody = null;
        try {
          // Try to extract response body in different ways
          if (qpayError?.response?.body !== undefined) {
            errorBody =
              typeof qpayError.response.body === "string"
                ? qpayError.response.body
                : JSON.stringify(qpayError.response.body);
          } else if (qpayError?.body !== undefined) {
            errorBody =
              typeof qpayError.body === "string"
                ? qpayError.body
                : JSON.stringify(qpayError.body);
          } else if (qpayError?.response) {
            // Response exists but body is undefined
            errorBody = "Response exists but body is undefined";
          } else {
            errorBody = "No response object found";
          }
        } catch (parseError) {
          errorBody = "Could not parse error body: " + parseError.message;
        }

        throw qpayError;
      }

      // Handle saving QPay info for multiple invoices
      if (
        req.body.nekhemjlekhiinTuukh &&
        Array.isArray(req.body.nekhemjlekhiinTuukh) &&
        khariu
      ) {
        try {
          const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
          const kholbolt = db.kholboltuud.find(
            (a) =>
              String(a.baiguullagiinId) === String(req.body.baiguullagiinId)
          );

          if (!kholbolt) {

            throw new Error("Tenant connection not found");
          }

          const invoiceId = khariu.invoice_id || khariu.invoiceId || khariu.id;
          const qpayUrl =
            khariu.qr_text ||
            khariu.url ||
            khariu.invoice_url ||
            khariu.qr_image;

          // Update all invoices with QPay info
          await nekhemjlekhiinTuukh(kholbolt).updateMany(
            { _id: { $in: req.body.nekhemjlekhiinTuukh } },
            {
              qpayInvoiceId: invoiceId,
              qpayUrl: qpayUrl,
            }
          );

        } catch (saveErr) {
        }
      } else if (req.body.nekhemjlekhiinId && khariu) {
        // Single invoice payment (existing logic)
        try {
          const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
          const kholbolt = db.kholboltuud.find(
            (a) =>
              String(a.baiguullagiinId) === String(req.body.baiguullagiinId)
          );

          if (!kholbolt) {
            throw new Error("Tenant connection not found");
          }

          const invoiceId = khariu.invoice_id || khariu.invoiceId || khariu.id;
          const qpayUrl =
            khariu.qr_text ||
            khariu.url ||
            khariu.invoice_url ||
            khariu.qr_image;

          const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(
            req.body.nekhemjlekhiinId
          );

          if (nekhemjlekh) {
            await nekhemjlekhiinTuukh(kholbolt).findByIdAndUpdate(
              req.body.nekhemjlekhiinId,
              {
                qpayInvoiceId: invoiceId,
                qpayUrl: qpayUrl,
              }
            );

            if (invoiceId && nekhemjlekh._id) {
              const nekhemjlekhiinId = nekhemjlekh._id.toString();
              const sukhemjlekhData = {
                nekhemjlekhiinId: nekhemjlekhiinId,
                gereeniiDugaar: nekhemjlekh.gereeniiDugaar || "",
                utas: nekhemjlekh.utas?.[0] || "",
                pay_amount: (
                  nekhemjlekh.niitTulbur ||
                  req.body.dun ||
                  ""
                ).toString(),
              };

              const updateNekhemjlekhData = async () => {
                let updated = null;

                updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                  { invoice_id: invoiceId },
                  { sukhNekhemjlekh: sukhemjlekhData },
                  { new: true }
                );

                if (updated) {
                  return;
                }

                if (!updated && nekhemjlekhiinId) {
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    {
                      baiguullagiinId: req.body.baiguullagiinId,
                      "qpay.callback_url": { $regex: nekhemjlekhiinId },
                    },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    return;
                  }
                }

                if (!updated && req.body.zakhialgiinDugaar) {
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    {
                      zakhialgiinDugaar: req.body.zakhialgiinDugaar,
                      baiguullagiinId: req.body.baiguullagiinId,
                      ognoo: { $gte: new Date(Date.now() - 60000) }, // Last minute
                    },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    return;
                  }
                }

                if (!updated && nekhemjlekhiinId) {
                  const recent = await QuickQpayObject(kholbolt)
                    .findOne({
                      baiguullagiinId: req.body.baiguullagiinId,
                      "qpay.callback_url": { $regex: nekhemjlekhiinId },
                    })
                    .sort({ ognoo: -1 })
                    .limit(1);
                  if (recent) {
                    updated = await QuickQpayObject(kholbolt).findByIdAndUpdate(
                      recent._id,
                      { sukhNekhemjlekh: sukhemjlekhData },
                      { new: true }
                    );
                    if (updated) {
                      return;
                    }
                  }
                }

                if (!updated) {
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    { invoice_id: invoiceId },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    return;
                  }
                }

                if (!updated) {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    { invoice_id: invoiceId },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    }
                }
              };

              updateNekhemjlekhData().catch((err) => {
              });
            } else {
            }
          } else {
          }
        } catch (saveErr) {
        }
      } else {
      }

      var dugaarlalt = new Dugaarlalt(req.body.tukhainBaaziinKholbolt)();
      dugaarlalt.baiguullagiinId = req.body.baiguullagiinId;
      dugaarlalt.barilgiinId = req.body.barilgiinId;
      dugaarlalt.ognoo = new Date();
      dugaarlalt.turul = "qpay";
      dugaarlalt.dugaar = maxDugaar;
      await dugaarlalt.save();

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
    // Enhanced error logging for QPay Shalgay errors
    let errorBody = null;
    try {
      // Try to extract response body in different ways
      if (err?.response?.body !== undefined) {
        errorBody =
          typeof err.response.body === "string"
            ? err.response.body
            : JSON.stringify(err.response.body);
      } else if (err?.body !== undefined) {
        errorBody =
          typeof err.body === "string" ? err.body : JSON.stringify(err.body);
      } else if (err?.response) {
        // Response exists but body is undefined
        errorBody = "Response exists but body is undefined";
      } else {
        errorBody = "No response object found";
      }
    } catch (parseError) {
      errorBody = "Could not parse error body: " + parseError.message;
    }

    next(err);
  }
});
router.post("/qpayGuilgeeUtgaAvya", tokenShalgakh, qpayGuilgeeUtgaAvya);

router.get(
  "/nekhemjlekhPaymentStatus/:baiguullagiinId/:nekhemjlekhiinId",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

      const baiguullagiinId = req.params.baiguullagiinId;
      const nekhemjlekhiinId = req.params.nekhemjlekhiinId;

      const kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == baiguullagiinId
      );

      if (!kholbolt) {
        return res.status(404).send("Organization not found");
      }

      const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(
        nekhemjlekhiinId
      );

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
          paymentHistory: nekhemjlekh.paymentHistory,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

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

router.get("/qpayBankAccounts", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, salbariinId } = req.query;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    var kholbolt = db.kholboltuud.find(
      (a) => String(a.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(404).send({
        success: false,
        message: "Organization connection not found",
      });
    }

    var qpayKhariltsagch = new QpayKhariltsagch(kholbolt);
    const qpayConfig = await qpayKhariltsagch
      .findOne({
        baiguullagiinId: baiguullagiinId,
      })
      .lean();

    if (!qpayConfig || !qpayConfig.salbaruud || !Array.isArray(qpayConfig.salbaruud)) {
      return res.send({
        success: true,
        bank_accounts: [],
      });
    }

    // If salbariinId is provided, get bank_accounts for that specific salbar
    if (salbariinId) {
      const targetSalbar = qpayConfig.salbaruud.find(
        (salbar) => String(salbar.salbariinId) === String(salbariinId)
      );

      if (targetSalbar && targetSalbar.bank_accounts) {
        return res.send({
          success: true,
          bank_accounts: targetSalbar.bank_accounts,
        });
      } else {
        return res.send({
          success: true,
          bank_accounts: [],
        });
      }
    }

    // If no salbariinId, return all bank_accounts from all salbaruud
    const allBankAccounts = qpayConfig.salbaruud
      .filter((salbar) => salbar.bank_accounts && salbar.bank_accounts.length > 0)
      .flatMap((salbar) => salbar.bank_accounts);

    res.send({
      success: true,
      bank_accounts: allBankAccounts,
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/qpayNekhemjlekhCallback/:baiguullagiinId/:nekhemjlekhiinId",
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

      const baiguullagiinId = req.params.baiguullagiinId;
      const nekhemjlekhiinId = req.params.nekhemjlekhiinId;

      const kholbolt = db.kholboltuud.find(
        (a) => String(a.baiguullagiinId) === String(baiguullagiinId)
      );

      if (!kholbolt) {
        return res.status(404).send("Organization not found");
      }

      const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(
        nekhemjlekhiinId
      );

      if (!nekhemjlekh) {
        return res.status(404).send("Invoice not found");
      }

      if (nekhemjlekh.tuluv === "Төлсөн") {
        return res.status(200).send("Payment already completed");
      }

      let paymentTransactionId = null;

      if (nekhemjlekh.qpayInvoiceId) {
        try {
          const khariu = await qpayShalgay(
            { invoice_id: nekhemjlekh.qpayInvoiceId },
            kholbolt
          );
          if (khariu?.payments?.[0]?.transactions?.[0]?.id) {
            paymentTransactionId = khariu.payments[0].transactions[0].id;
            nekhemjlekh.qpayPaymentId = paymentTransactionId;
          }
        } catch (err) {
        }
      }

      if (!paymentTransactionId && req.query.qpay_payment_id) {
        paymentTransactionId = req.query.qpay_payment_id;
        nekhemjlekh.qpayPaymentId = paymentTransactionId;
      }

      nekhemjlekh.tuluv = "Төлсөн";
      nekhemjlekh.tulsunOgnoo = new Date();

      nekhemjlekh.paymentHistory = nekhemjlekh.paymentHistory || [];
      nekhemjlekh.paymentHistory.push({
        ognoo: new Date(),
        dun: nekhemjlekh.niitTulbur,
        turul: "qpay",
        guilgeeniiId:
          paymentTransactionId || nekhemjlekh.qpayInvoiceId || "unknown",
        tailbar: "QPay төлбөр амжилттай хийгдлээ",
      });

      await nekhemjlekh.save();

      // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel
      if (nekhemjlekh.ekhniiUldegdel && nekhemjlekh.ekhniiUldegdel > 0) {
        try {
          const gereeForUpdate = await Geree(kholbolt).findById(
            nekhemjlekh.gereeniiId
          );
          if (gereeForUpdate) {
            gereeForUpdate.ekhniiUldegdel = 0;
            await gereeForUpdate.save();
          }
        } catch (ekhniiUldegdelError) {
        }
      }

      // Reset electricity readings to 0 if electricity invoice is paid
      // User will upload new readings for next month
      if (nekhemjlekh.tsahilgaanNekhemjlekh && nekhemjlekh.tsahilgaanNekhemjlekh > 0) {
        try {
          const gereeForUpdate = await Geree(kholbolt).findById(
            nekhemjlekh.gereeniiId
          );
          if (gereeForUpdate) {
            gereeForUpdate.umnukhZaalt = 0;
            gereeForUpdate.suuliinZaalt = 0;
            gereeForUpdate.zaaltTog = 0;
            gereeForUpdate.zaaltUs = 0;
            await gereeForUpdate.save();
          }
        } catch (zaaltError) {
        }
      }

      if (nekhemjlekh.qpayInvoiceId && nekhemjlekh._id) {
        try {
          const nekhemjlekhiinId = nekhemjlekh._id.toString();
          const sukhemjlekhData = {
            nekhemjlekhiinId: nekhemjlekhiinId,
            gereeniiDugaar: nekhemjlekh.gereeniiDugaar || "",
            utas: nekhemjlekh.utas?.[0] || "",
            pay_amount: (nekhemjlekh.niitTulbur || "").toString(),
          };

          let qpayObject = await QuickQpayObject(kholbolt).findOne({
            invoice_id: nekhemjlekh.qpayInvoiceId,
          });

          if (!qpayObject) {
            qpayObject = await QuickQpayObject(kholbolt).findOne({
              baiguullagiinId: nekhemjlekh.baiguullagiinId,
              "qpay.callback_url": { $regex: nekhemjlekhiinId },
            });
          }

          if (
            qpayObject &&
            (!qpayObject.sukhNekhemjlekh ||
              !qpayObject.sukhNekhemjlekh.nekhemjlekhiinId)
          ) {
            await QuickQpayObject(kholbolt).findByIdAndUpdate(
              qpayObject._id,
              { sukhNekhemjlekh: sukhemjlekhData },
              { new: true }
            );
          }
        } catch (err) {
        }
      }

      try {
        const BankniiGuilgee = require("../models/bankniiGuilgee");
        const Geree = require("../models/geree");

        const geree = await Geree(kholbolt)
          .findById(nekhemjlekh.gereeniiId)
          .lean();

        const bankGuilgee = new BankniiGuilgee(kholbolt)();

        bankGuilgee.tranDate = new Date();
        bankGuilgee.amount = nekhemjlekh.niitTulbur;
        bankGuilgee.description = `QPay төлбөр - Гэрээ ${nekhemjlekh.gereeniiDugaar}`;
        bankGuilgee.accName = nekhemjlekh.nekhemjlekhiinDansniiNer || "";
        bankGuilgee.accNum = nekhemjlekh.nekhemjlekhiinDans || "";

        bankGuilgee.record = paymentTransactionId || nekhemjlekh.qpayInvoiceId;
        bankGuilgee.tranId = paymentTransactionId || nekhemjlekh.qpayInvoiceId;
        bankGuilgee.balance = 0;
        bankGuilgee.requestId = nekhemjlekh.qpayInvoiceId;

        bankGuilgee.kholbosonGereeniiId = [nekhemjlekh.gereeniiId];
        bankGuilgee.kholbosonTalbainId = geree?.talbainDugaar
          ? [geree.talbainDugaar]
          : [];
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

        bankGuilgee.indexTalbar = `${bankGuilgee.barilgiinId}${bankGuilgee.bank}${bankGuilgee.dansniiDugaar}${bankGuilgee.record}${bankGuilgee.amount}`;

        await bankGuilgee.save();
      } catch (bankErr) {
      }

      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
          nekhemjlekh.baiguullagiinId
        );

        let tuxainSalbar = null;
        if (nekhemjlekh.barilgiinId && baiguullaga?.barilguud) {
          tuxainSalbar = baiguullaga.barilguud.find(
            (e) => e._id.toString() === String(nekhemjlekh.barilgiinId)
          )?.tokhirgoo;
        }

        if (!tuxainSalbar && baiguullaga?.barilguud?.length > 0) {
          tuxainSalbar = baiguullaga.barilguud[0].tokhirgoo;
        }

        // Check both eBarimtAshiglakhEsekh and eBarimtShine for backward compatibility
        const shouldCreateEbarimt = tuxainSalbar && (tuxainSalbar.eBarimtAshiglakhEsekh || tuxainSalbar.eBarimtShine);
        
        if (shouldCreateEbarimt) {
          
          if (!tuxainSalbar.merchantTin) {
            throw new Error("merchantTin is required for e-barimt creation");
          }
          
          // Ebarimt API requires a 4-digit numeric district code
          // Look up the code from tatvariinAlba using city name and district/horoo name
          let ebarimtDistrictCode = null;
          
          try {
            const TatvariinAlba = require("../models/tatvariinAlba");
            const cityName = tuxainSalbar.EbarimtDuuregNer || tuxainSalbar.duuregNer;
            const districtCodeString = tuxainSalbar.EbarimtDistrictCode || tuxainSalbar.districtCode || "";
            
            // Extract horoo/district name from the district code string
            // E.g., "Сонгинохайрхан20-р хороо" -> "20-р хороо"
            // Or use horoo.ner if available
            const horooName = tuxainSalbar.EbarimtDHoroo?.ner || tuxainSalbar.horoo?.ner || 
                              districtCodeString.replace(cityName, "").trim();
            
            
            if (cityName && horooName) {
              // Find the city in tatvariinAlba - try exact match first, then case-insensitive
              let city = await TatvariinAlba(db.erunkhiiKholbolt).findOne({ ner: cityName });
              
              // If not found, try case-insensitive search
              if (!city) {
                const allCities = await TatvariinAlba(db.erunkhiiKholbolt).find({});
                city = allCities.find(c => c.ner && c.ner.trim().toLowerCase() === cityName.trim().toLowerCase());
                if (city) {
                }
              }
              
              if (city && city.kod) {
                
                // Find the district/horoo within the city - try exact match, then partial match
                let district = city.ded?.find(d => d.ner === horooName || d.ner === horooName.trim());
                
                // If not found, try case-insensitive or partial match
                if (!district && city.ded) {
                  district = city.ded.find(d => {
                    const dName = d.ner?.trim().toLowerCase() || "";
                    const hName = horooName.trim().toLowerCase();
                    return dName === hName || dName.includes(hName) || hName.includes(dName);
                  });
                  if (district) {
                  }
                }
                
                if (district && district.kod) {
                  // Combine city code + district code to create 4-digit code
                  const cityCode = city.kod.padStart(2, '0');
                  const districtCode = district.kod.padStart(2, '0');
                  ebarimtDistrictCode = cityCode + districtCode;
                  
                } else {
                }
              } else {
              }
            }
            
            // Fallback: try to extract 4-digit numeric code directly
            if (!ebarimtDistrictCode) {
              const numericMatch = districtCodeString?.match(/\d{4}/);
              if (numericMatch) {
                ebarimtDistrictCode = numericMatch[0];
              } else if (/^\d{4}$/.test(districtCodeString)) {
                ebarimtDistrictCode = districtCodeString;
              }
            }
            
            if (!ebarimtDistrictCode || !/^\d{4}$/.test(ebarimtDistrictCode)) {
              throw new Error("districtCode must be a 4-digit numeric code for e-barimt creation");
            }
            
          } catch (lookupError) {
            throw new Error("Failed to lookup district code for e-barimt creation");
          }

          const {
            nekhemjlekheesEbarimtShineUusgye,
            ebarimtDuudya,
            autoApproveQr,
          } = require("./ebarimtRoute");
          const EbarimtShine = require("../models/ebarimtShine");

          const nuatTulukhEsekh = !!tuxainSalbar.nuatTulukhEsekh;

          const ebarimt = await nekhemjlekheesEbarimtShineUusgye(
            nekhemjlekh,
            nekhemjlekh.register || "",
            "",
            tuxainSalbar.merchantTin,
            ebarimtDistrictCode,
            kholbolt,
            nuatTulukhEsekh
          );

          var butsaakhMethod = async function (d, khariuObject) {
            try {
              
              if (d?.status != "SUCCESS" && !d.success) {
                return;
              }

              var shineBarimt = new EbarimtShine(kholbolt)(d);
              shineBarimt.nekhemjlekhiinId = khariuObject.nekhemjlekhiinId;
              shineBarimt.baiguullagiinId = khariuObject.baiguullagiinId;
              shineBarimt.barilgiinId = khariuObject.barilgiinId;
              shineBarimt.gereeniiDugaar = khariuObject.gereeniiDugaar;
              shineBarimt.utas = khariuObject.utas;

              if (d.qrData) shineBarimt.qrData = d.qrData;
              if (d.lottery) shineBarimt.lottery = d.lottery;
              if (d.id) shineBarimt.receiptId = d.id;
              if (d.date) shineBarimt.date = d.date;

              shineBarimt.save()
                .then(() => {
                  // Auto-approve QR for Easy Register if customerNo and qrData are available
                  if (khariuObject.customerNo && d.qrData) {
                    autoApproveQr(
                      khariuObject.customerNo,
                      d.qrData,
                      baiguullagiinId,
                      kholbolt
                    ).catch((err) => {
                      // Non-critical error - don't fail the response
                      console.log("Auto-approveQr failed (non-critical):", err.message);
                    });
                  }
                })
                .catch((saveErr) => {
                });
            } catch (err) {
            }
          };

          ebarimtDuudya(ebarimt, butsaakhMethod, null, true);
        } else {
        }
      } catch (ebarimtError) {}

      const io = req.app.get("socketio");
      io.emit(`nekhemjlekhPayment/${baiguullagiinId}/${nekhemjlekhiinId}`, {
        status: "success",
        tuluv: "Төлсөн",
        tulsunOgnoo: nekhemjlekh.tulsunOgnoo,
        paymentId: nekhemjlekh.qpayPaymentId,
      });
      io.emit(`tulburUpdated:${baiguullagiinId}`, {});

      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }
);

// Callback route for multiple invoice payments
router.get(
  "/qpayNekhemjlekhMultipleCallback/:baiguullagiinId/:invoiceIds",
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
      const Baiguullaga = require("../models/baiguullaga");
      const Geree = require("../models/geree");
      const BankniiGuilgee = require("../models/bankniiGuilgee");
      // qpayShalgay and QuickQpayObject are already imported at the top

      const baiguullagiinId = req.params.baiguullagiinId;
      const invoiceIdsString = req.params.invoiceIds;
      const invoiceIds = invoiceIdsString.split(",").filter((id) => id.trim());

      if (invoiceIds.length === 0) {
        return res.status(400).send("No invoice IDs provided");
      }

      const kholbolt = db.kholboltuud.find(
        (a) => String(a.baiguullagiinId) === String(baiguullagiinId)
      );

      if (!kholbolt) {
        return res.status(404).send("Organization not found");
      }

      // Convert invoice IDs to ObjectId if needed
      const mongoose = require("mongoose");
      const ObjectId = mongoose.Types.ObjectId;
      const invoiceObjectIds = invoiceIds.map((id) => {
        try {
          return ObjectId(id);
        } catch (e) {
          return id;
        }
      });


      // Fetch all invoices
      const invoices = await nekhemjlekhiinTuukh(kholbolt).find({
        _id: { $in: invoiceObjectIds },
      });


      if (invoices.length === 0) {
        return res.status(404).send("Invoices not found");
      }

      // Get QPay invoice ID from first invoice
      const firstInvoice = invoices[0];
      let paymentTransactionId = null;

      if (firstInvoice.qpayInvoiceId) {
        try {
          const khariu = await qpayShalgay(
            { invoice_id: firstInvoice.qpayInvoiceId },
            kholbolt
          );

          if (khariu?.payments?.[0]?.transactions?.[0]?.id) {
            paymentTransactionId = khariu.payments[0].transactions[0].id;
          }
        } catch (err) {
        }
      }

      if (!paymentTransactionId && req.query.qpay_payment_id) {
        paymentTransactionId = req.query.qpay_payment_id;
      }

      // Update all invoices as paid
      const updatePromises = invoices.map(async (nekhemjlekh) => {
        try {
          if (nekhemjlekh.tuluv === "Төлсөн") {
            return;
          }


          // Use findByIdAndUpdate to ensure the update is applied
          const updatedInvoice = await nekhemjlekhiinTuukh(
            kholbolt
          ).findByIdAndUpdate(
            nekhemjlekh._id,
            {
              $set: {
                tuluv: "Төлсөн",
                tulsunOgnoo: new Date(),
                ...(paymentTransactionId && {
                  qpayPaymentId: paymentTransactionId,
                }),
              },
              $push: {
                paymentHistory: {
                  ognoo: new Date(),
                  dun: nekhemjlekh.niitTulbur || 0,
                  turul: "qpay",
                  guilgeeniiId:
                    paymentTransactionId ||
                    nekhemjlekh.qpayInvoiceId ||
                    "unknown",
                  tailbar: "QPay төлбөр (Олон нэхэмжлэх)",
                },
              },
            },
            { new: true }
          );

          if (!updatedInvoice) {
            return;
          }


          // Use the updated invoice for further operations
          nekhemjlekh = updatedInvoice;

          // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel
          if (nekhemjlekh.ekhniiUldegdel && nekhemjlekh.ekhniiUldegdel > 0) {
            try {
              const gereeForUpdate = await Geree(kholbolt).findById(
                nekhemjlekh.gereeniiId
              );
              if (gereeForUpdate) {
                gereeForUpdate.ekhniiUldegdel = 0;
                await gereeForUpdate.save();
              }
            } catch (ekhniiUldegdelError) {
            }
          }

          // Reset electricity readings to 0 if electricity invoice is paid
          // User will upload new readings for next month
          if (nekhemjlekh.tsahilgaanNekhemjlekh && nekhemjlekh.tsahilgaanNekhemjlekh > 0) {
            try {
              const gereeForUpdate = await Geree(kholbolt).findById(
                nekhemjlekh.gereeniiId
              );
              if (gereeForUpdate) {
                gereeForUpdate.umnukhZaalt = 0;
                gereeForUpdate.suuliinZaalt = 0;
                gereeForUpdate.zaaltTog = 0;
                gereeForUpdate.zaaltUs = 0;
                await gereeForUpdate.save();
              }
            } catch (zaaltError) {
            }
          }

          // Create bank payment record for each invoice
          try {
            const geree = await Geree(kholbolt)
              .findById(nekhemjlekh.gereeniiId)
              .lean();

            if (geree) {
              const bankGuilgee = new BankniiGuilgee(kholbolt)();

              bankGuilgee.tranDate = new Date();
              bankGuilgee.amount = nekhemjlekh.niitTulbur || 0;
              bankGuilgee.description = `QPay төлбөр (Олон нэхэмжлэх) - Гэрээ ${nekhemjlekh.gereeniiDugaar}`;
              bankGuilgee.accName = nekhemjlekh.nekhemjlekhiinDansniiNer || "";
              bankGuilgee.accNum = nekhemjlekh.nekhemjlekhiinDans || "";

              bankGuilgee.record =
                paymentTransactionId || nekhemjlekh.qpayInvoiceId || "";
              bankGuilgee.tranId =
                paymentTransactionId || nekhemjlekh.qpayInvoiceId || "";
              bankGuilgee.balance = 0;
              bankGuilgee.requestId = nekhemjlekh.qpayInvoiceId || "";

              bankGuilgee.kholbosonGereeniiId = [nekhemjlekh.gereeniiId];
              bankGuilgee.kholbosonTalbainId = geree?.talbainDugaar
                ? [geree.talbainDugaar]
                : [];
              bankGuilgee.dansniiDugaar = nekhemjlekh.nekhemjlekhiinDans || "";
              bankGuilgee.bank = nekhemjlekh.nekhemjlekhiinBank || "qpay";
              bankGuilgee.baiguullagiinId = nekhemjlekh.baiguullagiinId;
              bankGuilgee.barilgiinId = nekhemjlekh.barilgiinId || "";
              bankGuilgee.kholbosonDun = nekhemjlekh.niitTulbur || 0;
              bankGuilgee.ebarimtAvsanEsekh = false;
              bankGuilgee.drOrCr = "Credit";
              bankGuilgee.tranCrnCode = "MNT";
              bankGuilgee.exchRate = 1;
              bankGuilgee.postDate = new Date();

              bankGuilgee.indexTalbar = `${bankGuilgee.barilgiinId}${bankGuilgee.bank}${bankGuilgee.dansniiDugaar}${bankGuilgee.record}${bankGuilgee.amount}`;

              await bankGuilgee.save();
            }
          } catch (bankErr) {
          }

          // Create ebarimt for each invoice
          try {
            const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
              updatedInvoice.baiguullagiinId
            );

            let tuxainSalbar = null;
            if (updatedInvoice.barilgiinId && baiguullaga?.barilguud) {
              tuxainSalbar = baiguullaga.barilguud.find(
                (e) => e._id.toString() === String(updatedInvoice.barilgiinId)
              )?.tokhirgoo;
            }

            if (!tuxainSalbar && baiguullaga?.barilguud?.length > 0) {
              tuxainSalbar = baiguullaga.barilguud[0].tokhirgoo;
            }

            // Check both eBarimtAshiglakhEsekh and eBarimtShine for backward compatibility
            const shouldCreateEbarimt = tuxainSalbar && (tuxainSalbar.eBarimtAshiglakhEsekh || tuxainSalbar.eBarimtShine);
            
            if (shouldCreateEbarimt) {
              
              if (!tuxainSalbar.merchantTin) {
              } else {
                // Ebarimt API requires a 4-digit numeric district code
                // Look up the code from tatvariinAlba using city name and district/horoo name
                let ebarimtDistrictCode = null;
                
                try {
                  const TatvariinAlba = require("../models/tatvariinAlba");
                  const cityName = tuxainSalbar.EbarimtDuuregNer || tuxainSalbar.duuregNer;
                  const districtCodeString = tuxainSalbar.EbarimtDistrictCode || tuxainSalbar.districtCode || "";
                  
                  // Extract horoo/district name from the district code string
                  const horooName = tuxainSalbar.EbarimtDHoroo?.ner || tuxainSalbar.horoo?.ner || 
                                    districtCodeString.replace(cityName, "").trim();
                  
                  
                  if (cityName && horooName) {
                    // Find the city in tatvariinAlba - try exact match first, then case-insensitive
                    let city = await TatvariinAlba(db.erunkhiiKholbolt).findOne({ ner: cityName });
                    
                    // If not found, try case-insensitive search
                    if (!city) {
                      const allCities = await TatvariinAlba(db.erunkhiiKholbolt).find({});
                      city = allCities.find(c => c.ner && c.ner.trim().toLowerCase() === cityName.trim().toLowerCase());
                      if (city) {
                      }
                    }
                    
                    if (city && city.kod) {
                      
                      // Find the district/horoo within the city - try exact match, then partial match
                      let district = city.ded?.find(d => d.ner === horooName || d.ner === horooName.trim());
                      
                      // If not found, try case-insensitive or partial match
                      if (!district && city.ded) {
                        district = city.ded.find(d => {
                          const dName = d.ner?.trim().toLowerCase() || "";
                          const hName = horooName.trim().toLowerCase();
                          return dName === hName || dName.includes(hName) || hName.includes(dName);
                        });
                        if (district) {
                        }
                      }
                      
                      if (district && district.kod) {
                        // Combine city code + district code to create 4-digit code
                        const cityCode = city.kod.padStart(2, '0');
                        const districtCode = district.kod.padStart(2, '0');
                        ebarimtDistrictCode = cityCode + districtCode;
                        
                      } else {
                      }
                    } else {
                    }
                  }
                  
                  // Fallback: try to extract 4-digit numeric code directly
                  if (!ebarimtDistrictCode) {
                    const numericMatch = districtCodeString?.match(/\d{4}/);
                    if (numericMatch) {
                      ebarimtDistrictCode = numericMatch[0];
                    } else if (/^\d{4}$/.test(districtCodeString)) {
                      ebarimtDistrictCode = districtCodeString;
                    }
                  }
                  
                  if (!ebarimtDistrictCode || !/^\d{4}$/.test(ebarimtDistrictCode)) {
                  } else {
                  
                    const {
                      nekhemjlekheesEbarimtShineUusgye,
                      ebarimtDuudya,
                      autoApproveQr,
                    } = require("./ebarimtRoute");
                    const EbarimtShine = require("../models/ebarimtShine");

                    const nuatTulukhEsekh = !!tuxainSalbar.nuatTulukhEsekh;

                    const ebarimt = await nekhemjlekheesEbarimtShineUusgye(
                      updatedInvoice,
                      updatedInvoice.register || "",
                      "",
                      tuxainSalbar.merchantTin,
                      ebarimtDistrictCode,
                      kholbolt,
                      nuatTulukhEsekh
                    );

                    // The ebarimt object already has invoice data set in nekhemjlekheesEbarimtShineUusgye
                    // ebarimtDuudya calls onFinish(body, ugugdul) where ugugdul is the ebarimt object
                    var butsaakhMethod = async function (d, ebarimtObject) {
                      try {
                        if (d?.status != "SUCCESS" && !d.success) {
                          return;
                        }

                        var shineBarimt = new EbarimtShine(kholbolt)(d);
                        shineBarimt.nekhemjlekhiinId =
                          ebarimtObject.nekhemjlekhiinId;
                        shineBarimt.baiguullagiinId = ebarimtObject.baiguullagiinId;
                        shineBarimt.barilgiinId = ebarimtObject.barilgiinId;
                        shineBarimt.gereeniiDugaar = ebarimtObject.gereeniiDugaar;
                        shineBarimt.utas = ebarimtObject.utas;

                        if (d.qrData) shineBarimt.qrData = d.qrData;
                        if (d.lottery) shineBarimt.lottery = d.lottery;
                        if (d.id) shineBarimt.receiptId = d.id;
                        if (d.date) shineBarimt.date = d.date;

                        shineBarimt.save()
                          .then(() => {
                            // Auto-approve QR for Easy Register if customerNo and qrData are available
                            if (ebarimtObject.customerNo && d.qrData) {
                              autoApproveQr(
                                ebarimtObject.customerNo,
                                d.qrData,
                                baiguullagiinId,
                                kholbolt
                              ).catch((err) => {
                                // Non-critical error - don't fail the response
                                console.log("Auto-approveQr failed (non-critical):", err.message);
                              });
                            }
                          })
                          .catch((saveErr) => {
                          });
                      } catch (err) {
                      }
                    };

                    // ebarimtDuudya signature: (ugugdul, onFinish, next, shine)
                    // The ebarimt object already contains invoice data, and it's passed as second param to onFinish
                    ebarimtDuudya(ebarimt, butsaakhMethod, null, true);
                  }
                } catch (lookupError) {
                }
              }
            } else {
            }
          } catch (ebarimtError) {
          }

          // Emit socket event for each invoice
          const io = req.app.get("socketio");
          io.emit(
            `nekhemjlekhPayment/${baiguullagiinId}/${updatedInvoice._id}`,
            {
              status: "success",
              tuluv: "Төлсөн",
              tulsunOgnoo: updatedInvoice.tulsunOgnoo,
              paymentId: updatedInvoice.qpayPaymentId,
            }
          );
        } catch (invoiceErr) {
        }
      });

      await Promise.all(updatePromises);


      req.app.get("socketio").emit(`tulburUpdated:${baiguullagiinId}`, {});

      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
