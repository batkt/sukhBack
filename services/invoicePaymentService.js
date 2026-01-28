const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");

/**
 * Mark invoices as paid with credit/overpayment system
 * Payment reduces from latest month first, then previous months
 * If payment exceeds all invoices, remaining is saved as positiveBalance
 * @param {Object} options - Payment options
 * @param {String} options.baiguullagiinId - Organization ID (required)
 * @param {Number} options.dun - Payment amount (required)
 * @param {String} [options.orshinSuugchId] - User ID (mark all invoices for this user)
 * @param {String} [options.gereeniiId] - Contract ID (mark all invoices for this contract)
 * @param {Array<String>} [options.nekhemjlekhiinIds] - Array of invoice IDs (mark specific invoices)
 * @param {Boolean} [options.markEkhniiUldegdel] - If true, also mark invoices with ekhniiUldegdel (default: false)
 * @param {String} [options.tailbar] - Payment description/notes
 * @returns {Object} - Result with updated invoices count and details
 */
async function markInvoicesAsPaid(options) {
  const {
    baiguullagiinId,
    dun, // Payment amount (required)
    orshinSuugchId,
    gereeniiId,
    nekhemjlekhiinIds,
    markEkhniiUldegdel = false,
    tailbar = null,
  } = options;

  if (!baiguullagiinId) {
    throw new Error("baiguullagiinId is required");
  }

  if (!dun || dun <= 0) {
    throw new Error("dun (payment amount) is required and must be greater than 0");
  }

  // Validate that at least one identifier is provided
  if (!orshinSuugchId && !gereeniiId && (!nekhemjlekhiinIds || nekhemjlekhiinIds.length === 0)) {
    throw new Error("Either orshinSuugchId, gereeniiId, or nekhemjlekhiinIds must be provided");
  }

  // Get database connection
  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  if (!kholbolt) {
    throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
  }

  const NekhemjlekhiinTuukh = nekhemjlekhiinTuukh(kholbolt);
  const GereeModel = Geree(kholbolt);
  const GereeniiTulsunAvlagaModel = GereeniiTulsunAvlaga(kholbolt);

  // Build query to find invoices
  const query = {
    baiguullagiinId: String(baiguullagiinId),
    tuluv: { $ne: "Төлсөн" }, // Only unpaid invoices
  };

  // If markEkhniiUldegdel is false, exclude invoices with ekhniiUldegdel
  if (!markEkhniiUldegdel) {
    query.$or = [
      { ekhniiUldegdel: { $exists: false } },
      { ekhniiUldegdel: 0 },
      { ekhniiUldegdel: null },
    ];
  }

  if (nekhemjlekhiinIds && nekhemjlekhiinIds.length > 0) {
    // Mark specific invoices by IDs
    query._id = { $in: nekhemjlekhiinIds };
  } else if (orshinSuugchId) {
    // Mark all invoices for a user
    const gerees = await GereeModel.find({
      orshinSuugchId: String(orshinSuugchId),
      baiguullagiinId: String(baiguullagiinId),
      tuluv: { $ne: "Цуцалсан" },
    }).select("_id").lean();

    if (gerees.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: "No active contracts found for this user",
        invoices: [],
        remainingBalance: dun,
      };
    }

    const gereeniiIds = gerees.map((g) => g._id.toString());
    query.gereeniiId = { $in: gereeniiIds };
  } else if (gereeniiId) {
    // Mark all invoices for a contract
    query.gereeniiId = String(gereeniiId);
  }

  // Find all unpaid invoices matching the query, sorted by date (latest first)
  const invoices = await NekhemjlekhiinTuukh.find(query)
    .sort({ ognoo: -1, createdAt: -1 }) // Latest month first
    .lean();

  if (invoices.length === 0) {
    // No invoices found - save entire payment as positiveBalance
    let gereeToUpdate = null;
    if (gereeniiId) {
      gereeToUpdate = await GereeModel.findById(gereeniiId);
    } else if (orshinSuugchId) {
      // Get the first active contract for this user
      const firstGeree = await GereeModel.findOne({
        orshinSuugchId: String(orshinSuugchId),
        baiguullagiinId: String(baiguullagiinId),
        tuluv: { $ne: "Цуцалсан" },
      });
      gereeToUpdate = firstGeree;
    }

    if (gereeToUpdate) {
      gereeToUpdate.positiveBalance = (gereeToUpdate.positiveBalance || 0) + dun;
      await gereeToUpdate.save();
      console.log(`💰 [INVOICE PAYMENT] No invoices found, saved ${dun} as positiveBalance in geree ${gereeToUpdate._id}`);
    }

    return {
      success: true,
      updatedCount: 0,
      totalFound: 0,
      message: `No unpaid invoices found. Saved ${dun} as positive balance.`,
      invoices: [],
      remainingBalance: dun,
      positiveBalanceAdded: dun,
    };
  }

  console.log(`💰 [INVOICE PAYMENT] Found ${invoices.length} unpaid invoice(s), applying payment of ${dun}`);

  let remainingPayment = dun;
  const updatedInvoices = [];
  const gereePositiveBalanceMap = new Map(); // Track positiveBalance per geree
  const tulsunAvlagaDocs = []; // Track created gereeniiTulsunAvlaga records
  const gereesNeedingRecalc = new Set(); // geree IDs whose globalUldegdel we will recalculate

  // Process invoices from latest to oldest
  for (const invoice of invoices) {
    if (remainingPayment <= 0) {
      break; // Payment fully applied
    }

    try {
      const invoiceAmount = invoice.niitTulbur || 0;
      const unpaidAmount = invoiceAmount; // Since invoice is unpaid, full amount is unpaid

      if (unpaidAmount <= 0) {
        continue; // Skip invoices with 0 amount
      }

      // Calculate how much to apply to this invoice
      const amountToApply = Math.min(remainingPayment, unpaidAmount);
      const isFullyPaid = amountToApply >= unpaidAmount;

      // Update invoice
      const updateData = {
        $push: {
          paymentHistory: {
            ognoo: new Date(),
            dun: amountToApply,
            turul: "manual",
            guilgeeniiId: `payment_${Date.now()}_${invoice._id}`,
            tailbar: tailbar || (isFullyPaid ? "Төлбөр хийгдлээ" : `Хэсэгчилсэн төлбөр: ${amountToApply}₮`),
          },
        },
      };

      if (isFullyPaid) {
        updateData.$set = {
          tuluv: "Төлсөн",
          tulsunOgnoo: new Date(),
        };
      } else {
        // Partial payment - update uldegdel (remaining balance)
        updateData.$set = {
          uldegdel: unpaidAmount - amountToApply,
        };
      }

      const updatedInvoice = await NekhemjlekhiinTuukh.findByIdAndUpdate(
        invoice._id,
        updateData,
        { new: true }
      );

      if (!updatedInvoice) {
        console.error(`❌ [INVOICE PAYMENT] Failed to update invoice ${invoice._id}`);
        continue;
      }

      console.log(`✅ [INVOICE PAYMENT] Applied ${amountToApply}₮ to invoice ${updatedInvoice._id} (${isFullyPaid ? 'fully paid' : 'partial'})`);

      remainingPayment -= amountToApply;
      updatedInvoices.push({
        invoice: updatedInvoice,
        amountApplied: amountToApply,
        isFullyPaid,
      });

      // Track geree whose invoices changed, to recalc globalUldegdel later
      if (updatedInvoice.gereeniiId) {
        gereesNeedingRecalc.add(String(updatedInvoice.gereeniiId));
      }

      // NEW: persist paid portion as gereeniiTulsunAvlaga row
      try {
        const tulsunDoc = new GereeniiTulsunAvlagaModel({
          baiguullagiinId: String(updatedInvoice.baiguullagiinId),
          baiguullagiinNer: updatedInvoice.baiguullagiinNer || "",
          barilgiinId: updatedInvoice.barilgiinId || "",
          gereeniiId: updatedInvoice.gereeniiId,
          gereeniiDugaar: updatedInvoice.gereeniiDugaar || "",
          orshinSuugchId: updatedInvoice.orshinSuugchId || "",
          nekhemjlekhId: updatedInvoice._id.toString(),

          ognoo: new Date(),
          tulsunDun: amountToApply,
          tulsunAldangi: 0, // can be split later if needed

          turul: "invoice_payment",
          zardliinTurul: "",
          zardliinId: "",
          zardliinNer: "",

          tailbar:
            tailbar ||
            (isFullyPaid
              ? "Нэхэмжлэх бүрэн төлөгдлөө"
              : `Нэхэмжлэлийн хэсэгчилсэн төлбөр: ${amountToApply}₮`),

          source: "nekhemjlekh",
          guilgeeKhiisenAjiltniiNer: null,
          guilgeeKhiisenAjiltniiId: null,
        });

        const savedTulsun = await tulsunDoc.save();
        tulsunAvlagaDocs.push(savedTulsun);
      } catch (tulsunError) {
        console.error(
          "❌ [INVOICE PAYMENT] Error creating gereeniiTulsunAvlaga:",
          tulsunError.message
        );
      }

      // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel and is fully paid
      if (isFullyPaid && updatedInvoice.ekhniiUldegdel && updatedInvoice.ekhniiUldegdel > 0) {
        try {
          const gereeForUpdate = await GereeModel.findById(updatedInvoice.gereeniiId);
          if (gereeForUpdate) {
            gereeForUpdate.ekhniiUldegdel = 0;
            await gereeForUpdate.save();
            console.log(`✅ [INVOICE PAYMENT] Updated geree.ekhniiUldegdel to 0 for geree ${gereeForUpdate._id}`);
          }
        } catch (error) {
          console.error(`❌ [INVOICE PAYMENT] Error updating geree.ekhniiUldegdel:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ [INVOICE PAYMENT] Error updating invoice ${invoice._id}:`, error.message);
    }
  }

  // If there's remaining payment, save as positiveBalance
  if (remainingPayment > 0) {
    // Determine which geree(s) to update
    const gereesToUpdate = new Set();
    
    if (gereeniiId) {
      gereesToUpdate.add(gereeniiId);
    } else if (orshinSuugchId) {
      const gerees = await GereeModel.find({
        orshinSuugchId: String(orshinSuugchId),
        baiguullagiinId: String(baiguullagiinId),
        tuluv: { $ne: "Цуцалсан" },
      }).select("_id").lean();
      
      gerees.forEach(g => gereesToUpdate.add(g._id.toString()));
    } else if (nekhemjlekhiinIds && nekhemjlekhiinIds.length > 0) {
      // Get gerees from invoices
      const invoiceGerees = await NekhemjlekhiinTuukh.find({
        _id: { $in: nekhemjlekhiinIds }
      }).select("gereeniiId").lean();
      
      invoiceGerees.forEach(inv => {
        if (inv.gereeniiId) gereesToUpdate.add(inv.gereeniiId);
      });
    }

    // If we have multiple gerees, distribute remaining payment equally
    // Otherwise, add to single geree
    if (gereesToUpdate.size > 0) {
      const balancePerGeree = remainingPayment / gereesToUpdate.size;
      
      for (const gereeId of gereesToUpdate) {
        try {
          const geree = await GereeModel.findById(gereeId);
          if (geree) {
            geree.positiveBalance = (geree.positiveBalance || 0) + balancePerGeree;
            await geree.save();
            gereePositiveBalanceMap.set(gereeId, geree.positiveBalance);
            console.log(`💰 [INVOICE PAYMENT] Added ${balancePerGeree}₮ to positiveBalance for geree ${gereeId}`);

            // NEW: persist positiveBalance as gereeniiTulsunAvlaga row (prepayment)
            try {
              const prepayDoc = new GereeniiTulsunAvlagaModel({
                baiguullagiinId: String(baiguullagiinId),
                baiguullagiinNer: geree.baiguullagiinNer || "",
                barilgiinId: geree.barilgiinId || "",
                gereeniiId: geree._id.toString(),
                gereeniiDugaar: geree.gereeniiDugaar || "",
                orshinSuugchId: geree.orshinSuugchId || "",
                nekhemjlekhId: null,

                ognoo: new Date(),
                tulsunDun: balancePerGeree,
                tulsunAldangi: 0,

                turul: "prepayment",
                zardliinTurul: "",
                zardliinId: "",
                zardliinNer: "",

                tailbar:
                  tailbar ||
                  `Нэхэмжлэхгүй илүү төлөлт (positiveBalance): ${balancePerGeree}₮`,

                source: "geree",
                guilgeeKhiisenAjiltniiNer: null,
                guilgeeKhiisenAjiltniiId: null,
              });

              const savedPrepay = await prepayDoc.save();
              tulsunAvlagaDocs.push(savedPrepay);
            } catch (prepayError) {
              console.error(
                "❌ [INVOICE PAYMENT] Error creating prepayment gereeniiTulsunAvlaga:",
                prepayError.message
              );
            }

            // PositiveBalance changes also affect globalUldegdel view, so recalc
            gereesNeedingRecalc.add(String(geree._id.toString()));
          }
        } catch (error) {
          console.error(`❌ [INVOICE PAYMENT] Error updating positiveBalance for geree ${gereeId}:`, error.message);
        }
      }
    }
  }

  // Recalculate and store globalUldegdel on affected gerees
  try {
    const NekhemjlekhiinTuukhForRecalc = NekhemjlekhiinTuukh;

    for (const gereeId of gereesNeedingRecalc) {
      try {
        const invs = await NekhemjlekhiinTuukhForRecalc.find({
          baiguullagiinId: String(baiguullagiinId),
          gereeniiId: String(gereeId),
          tuluv: { $ne: "Төлсөн" },
        })
          .select("niitTulbur uldegdel")
          .lean();

        let globalUldegdel = 0;
        invs.forEach((inv) => {
          const unpaid =
            typeof inv.uldegdel === "number" && !isNaN(inv.uldegdel)
              ? inv.uldegdel
              : inv.niitTulbur || 0;
          globalUldegdel += unpaid;
        });

        const gereeToUpdate = await GereeModel.findById(gereeId);
        if (gereeToUpdate) {
          gereeToUpdate.globalUldegdel = globalUldegdel;
          await gereeToUpdate.save();
        }
      } catch (recalcError) {
        console.error(
          `❌ [INVOICE PAYMENT] Error recalculating globalUldegdel for geree ${gereeId}:`,
          recalcError.message
        );
      }
    }
  } catch (outerRecalcError) {
    console.error("❌ [INVOICE PAYMENT] Error in globalUldegdel recalculation loop:", outerRecalcError.message);
  }

  return {
    success: true,
    updatedCount: updatedInvoices.length,
    totalFound: invoices.length,
    paymentAmount: dun,
    remainingBalance: remainingPayment,
    positiveBalanceAdded: remainingPayment > 0 ? remainingPayment : 0,
    message: `Applied ${dun - remainingPayment}₮ to ${updatedInvoices.length} invoice(s)${remainingPayment > 0 ? `, saved ${remainingPayment}₮ as positive balance` : ''}`,
    invoices: updatedInvoices.map(({ invoice, amountApplied, isFullyPaid }) => ({
      _id: invoice._id,
      nekhemjlekhiinDugaar: invoice.nekhemjlekhiinDugaar,
      gereeniiDugaar: invoice.gereeniiDugaar,
      niitTulbur: invoice.niitTulbur,
      amountApplied,
      isFullyPaid,
      uldegdel: invoice.uldegdel || 0,
      tuluv: invoice.tuluv,
      tulsunOgnoo: invoice.tulsunOgnoo,
    })),
    // NEW: high‑level view of payment projection rows created
    tulsunAvlaga: tulsunAvlagaDocs.map((doc) => ({
      _id: doc._id,
      gereeniiId: doc.gereeniiId,
      gereeniiDugaar: doc.gereeniiDugaar,
      nekhemjlekhId: doc.nekhemjlekhId,
      tulsunDun: doc.tulsunDun,
      turul: doc.turul,
      source: doc.source,
      ognoo: doc.ognoo,
    })),
    positiveBalance: Array.from(gereePositiveBalanceMap.entries()).map(([gereeId, balance]) => ({
      gereeniiId: gereeId,
      positiveBalance: balance,
    })),
  };
}

module.exports = {
  markInvoicesAsPaid,
};
