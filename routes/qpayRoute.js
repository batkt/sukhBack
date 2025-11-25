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

router.post("/qpayGargaya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

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
              console.warn("⚠️  Invoice not found:", req.body.nekhemjlekhiinId);
            }
          } catch (err) {
            console.error("❌ Error fetching invoice for amount:", err.message);
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

                console.log(
                  `✅ Using building-specific bank account for barilga ${req.body.barilgiinId}: ${bankAccount.account_number} (${bankAccount.account_name}) with merchant credentials`
                );
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

                  console.log(
                    `⚠️  Building-specific account ${newDansniiDugaar} not configured in Dans, using Dans account ${fallbackDans.dugaar} for merchant credentials (barilga: ${req.body.barilgiinId})`
                  );
                } else {
                  console.log(
                    `⚠️  No QPay-enabled Dans found for building ${req.body.barilgiinId}, keeping existing dansniiDugaar: ${req.body.dansniiDugaar}`
                  );
                  // Don't change dansniiDugaar if no valid Dans found
                }
              }
            } else {
              console.log(
                `⚠️  No bank_accounts found for salbar ${req.body.barilgiinId}, using existing dansniiDugaar`
              );
            }
          } else {
            console.log(
              `⚠️  QpayKhariltsagch not found or has no salbaruud, using existing dansniiDugaar`
            );
          }
        } catch (qpayConfigError) {
          console.error(
            "❌ Error fetching QpayKhariltsagch for bank account:",
            qpayConfigError.message
          );
          // Continue with existing dansniiDugaar if error occurs
        }
      }

      const khariu = await qpayGargaya(
        req.body,
        callback_url,
        req.body.tukhainBaaziinKholbolt
      );

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
            console.error(
              "❌ Tenant connection not found for saving QPay info"
            );
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

          console.log(
            `✅ Updated ${req.body.nekhemjlekhiinTuukh.length} invoices with QPay info`
          );
        } catch (saveErr) {
          console.error(
            "❌ Error saving QPay info to multiple invoices:",
            saveErr.message
          );
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
            console.error(
              "❌ Tenant connection not found for saving QPay info"
            );
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
                  console.log("✅ QuickQpayObject updated via Strategy 1");
                  return;
                }

                if (!updated && nekhemjlekhiinId) {
                  console.log("🔍 Strategy 2: Searching by callback_url regex");
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    {
                      baiguullagiinId: req.body.baiguullagiinId,
                      "qpay.callback_url": { $regex: nekhemjlekhiinId },
                    },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    console.log("✅ QuickQpayObject updated via Strategy 2");
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
                    console.log("✅ QuickQpayObject updated via Strategy 3");
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
                      console.log("✅ QuickQpayObject updated via Strategy 4");
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
                    console.log("✅ QuickQpayObject updated via Retry 1");
                    return;
                  }
                }

                if (!updated) {
                  console.log(
                    "⏳ Retry 2: Waiting 2 seconds, then retrying by invoice_id"
                  );
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  updated = await QuickQpayObject(kholbolt).findOneAndUpdate(
                    { invoice_id: invoiceId },
                    { sukhNekhemjlekh: sukhemjlekhData },
                    { new: true }
                  );
                  if (updated) {
                    console.log("✅ QuickQpayObject updated via Retry 2");
                  } else {
                    console.warn(
                      "⚠️  QuickQpayObject not found after all strategies and retries"
                    );
                  }
                }
              };

              updateNekhemjlekhData().catch((err) => {
                console.error(
                  "❌ Error updating QuickQpayObject with nekhemjlekh data:",
                  err.message
                );
              });
            } else {
              console.warn(
                "⚠️  Cannot update QuickQpayObject - missing invoiceId or invoice _id"
              );
            }
          } else {
            console.error(
              "❌ Invoice not found for updating QPay info:",
              req.body.nekhemjlekhiinId
            );
          }
        } catch (saveErr) {
          console.error(
            "❌ Error saving QPay info to invoice:",
            saveErr.message
          );
        }
      } else {
        console.log(
          "ℹ️  Skipping invoice update - no nekhemjlekhiinId or QPay response"
        );
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
        console.error("❌ Organization not found:", baiguullagiinId);
        return res.status(404).send("Organization not found");
      }

      const nekhemjlekh = await nekhemjlekhiinTuukh(kholbolt).findById(
        nekhemjlekhiinId
      );

      if (!nekhemjlekh) {
        console.error("❌ Invoice not found:", nekhemjlekhiinId);
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
          } else {
            console.warn(
              "⚠️  Payment transaction ID not found in QPay response"
            );
          }
        } catch (err) {
          console.error(
            "❌ Could not fetch QPay payment details:",
            err.message
          );
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
          const gereeForUpdate = await Geree(kholbolt).findById(nekhemjlekh.gereeniiId);
          if (gereeForUpdate) {
            gereeForUpdate.ekhniiUldegdel = 0;
            await gereeForUpdate.save();
            console.log(`✅ Updated geree.ekhniiUldegdel to 0 for geree ${gereeForUpdate._id}`);
          }
        } catch (ekhniiUldegdelError) {
          console.error("❌ Error updating geree.ekhniiUldegdel:", ekhniiUldegdelError.message);
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
          console.error("Error updating QuickQpayObject in callback:", err);
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
        console.log("✅ Bank payment record created");
      } catch (bankErr) {
        console.error(
          "❌ Error creating bank payment record:",
          bankErr.message
        );
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

        if (tuxainSalbar && tuxainSalbar.eBarimtShine) {
          if (!tuxainSalbar.merchantTin) {
            throw new Error("merchantTin is required for e-barimt creation");
          }
          if (!tuxainSalbar.districtCode) {
            console.error(
              "⚠️  Cannot create e-barimt: districtCode is missing"
            );
            throw new Error("districtCode is required for e-barimt creation");
          }

          const {
            nekhemjlekheesEbarimtShineUusgye,
            ebarimtDuudya,
          } = require("./ebarimtRoute");
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
                console.error(
                  "❌ E-barimt API error:",
                  d?.message || d?.error || JSON.stringify(d)
                );
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

              shineBarimt.save();
              console.log(
                "✅ E-barimt saved successfully for invoice:",
                khariuObject.nekhemjlekhiinId
              );
            } catch (err) {
              console.error("❌ Failed to save e-barimt:", err.message);
            }
          };

          ebarimtDuudya(ebarimt, butsaakhMethod, null, true);
        } else {
          console.log("ℹ️  E-barimt creation skipped:", {
            hasSalbar: !!tuxainSalbar,
            eBarimtShine: tuxainSalbar?.eBarimtShine,
          });
        }
      } catch (ebarimtError) {}

      req.app
        .get("socketio")
        .emit(`nekhemjlekhPayment/${baiguullagiinId}/${nekhemjlekhiinId}`, {
          status: "success",
          tuluv: "Төлсөн",
          tulsunOgnoo: nekhemjlekh.tulsunOgnoo,
          paymentId: nekhemjlekh.qpayPaymentId,
        });

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
        console.error("❌ Organization not found:", baiguullagiinId);
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

      console.log("🔍 Fetching invoices with IDs:", invoiceObjectIds);

      // Fetch all invoices
      const invoices = await nekhemjlekhiinTuukh(kholbolt).find({
        _id: { $in: invoiceObjectIds },
      });

      console.log(`📄 Found ${invoices.length} invoices to update`);

      if (invoices.length === 0) {
        console.error("❌ Invoices not found:", invoiceIds);
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
          } else {
            console.warn(
              "⚠️  Payment transaction ID not found in QPay response"
            );
          }
        } catch (err) {
          console.error(
            "❌ Could not fetch QPay payment details:",
            err.message
          );
        }
      }

      if (!paymentTransactionId && req.query.qpay_payment_id) {
        paymentTransactionId = req.query.qpay_payment_id;
      }

      // Update all invoices as paid
      const updatePromises = invoices.map(async (nekhemjlekh) => {
        try {
          if (nekhemjlekh.tuluv === "Төлсөн") {
            console.log(`ℹ️  Invoice ${nekhemjlekh._id} already paid`);
            return;
          }

          console.log(`💰 Updating invoice ${nekhemjlekh._id} to paid status`);

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
            console.error(`❌ Failed to update invoice ${nekhemjlekh._id}`);
            return;
          }

          console.log(`✅ Invoice ${updatedInvoice._id} updated successfully`);

          // Use the updated invoice for further operations
          nekhemjlekh = updatedInvoice;

          // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel
          if (nekhemjlekh.ekhniiUldegdel && nekhemjlekh.ekhniiUldegdel > 0) {
            try {
              const gereeForUpdate = await Geree(kholbolt).findById(nekhemjlekh.gereeniiId);
              if (gereeForUpdate) {
                gereeForUpdate.ekhniiUldegdel = 0;
                await gereeForUpdate.save();
                console.log(`✅ Updated geree.ekhniiUldegdel to 0 for geree ${gereeForUpdate._id}`);
              }
            } catch (ekhniiUldegdelError) {
              console.error("❌ Error updating geree.ekhniiUldegdel:", ekhniiUldegdelError.message);
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
            console.error(
              `❌ Error creating bank payment record for invoice ${nekhemjlekh._id}:`,
              bankErr.message
            );
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

            if (tuxainSalbar && tuxainSalbar.eBarimtShine) {
              if (!tuxainSalbar.merchantTin) {
                console.error(
                  `⚠️  Cannot create e-barimt for invoice ${updatedInvoice._id}: merchantTin is required`
                );
              } else if (!tuxainSalbar.districtCode) {
                console.error(
                  `⚠️  Cannot create e-barimt for invoice ${updatedInvoice._id}: districtCode is missing`
                );
              } else {
                const {
                  nekhemjlekheesEbarimtShineUusgye,
                  ebarimtDuudya,
                } = require("./ebarimtRoute");
                const EbarimtShine = require("../models/ebarimtShine");

                const nuatTulukhEsekh = !!tuxainSalbar.nuatTulukhEsekh;

                const ebarimt = await nekhemjlekheesEbarimtShineUusgye(
                  updatedInvoice,
                  updatedInvoice.register || "",
                  "",
                  tuxainSalbar.merchantTin,
                  tuxainSalbar.districtCode,
                  kholbolt,
                  nuatTulukhEsekh
                );

                // The ebarimt object already has invoice data set in nekhemjlekheesEbarimtShineUusgye
                // ebarimtDuudya calls onFinish(body, ugugdul) where ugugdul is the ebarimt object
                var butsaakhMethod = function (d, ebarimtObject) {
                  try {
                    if (d?.status != "SUCCESS" && !d.success) {
                      console.error(
                        `❌ E-barimt API error for invoice ${ebarimtObject.nekhemjlekhiinId}:`,
                        d?.message || d?.error || JSON.stringify(d)
                      );
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

                    shineBarimt.save();
                    console.log(
                      `✅ E-barimt saved successfully for invoice:`,
                      ebarimtObject.nekhemjlekhiinId
                    );
                  } catch (err) {
                    console.error(
                      `❌ Failed to save e-barimt for invoice ${
                        ebarimtObject?.nekhemjlekhiinId || "unknown"
                      }:`,
                      err.message
                    );
                  }
                };

                // ebarimtDuudya signature: (ugugdul, onFinish, next, shine)
                // The ebarimt object already contains invoice data, and it's passed as second param to onFinish
                ebarimtDuudya(ebarimt, butsaakhMethod, null, true);
              }
            } else {
              console.log(
                `ℹ️  E-barimt creation skipped for invoice ${updatedInvoice._id}:`,
                {
                  hasSalbar: !!tuxainSalbar,
                  eBarimtShine: tuxainSalbar?.eBarimtShine,
                }
              );
            }
          } catch (ebarimtError) {
            console.error(
              `❌ Error creating e-barimt for invoice ${updatedInvoice._id}:`,
              ebarimtError.message
            );
          }

          // Emit socket event for each invoice
          req.app
            .get("socketio")
            .emit(
              `nekhemjlekhPayment/${baiguullagiinId}/${updatedInvoice._id}`,
              {
                status: "success",
                tuluv: "Төлсөн",
                tulsunOgnoo: updatedInvoice.tulsunOgnoo,
                paymentId: updatedInvoice.qpayPaymentId,
              }
            );
        } catch (invoiceErr) {
          console.error(
            `❌ Error updating invoice ${nekhemjlekh._id}:`,
            invoiceErr.message
          );
        }
      });

      await Promise.all(updatePromises);

      console.log(
        `✅ Successfully processed payment for ${invoices.length} invoices`
      );

      res.sendStatus(200);
    } catch (err) {
      console.error("❌ Error in multiple invoice callback:", err);
      next(err);
    }
  }
);

module.exports = router;
