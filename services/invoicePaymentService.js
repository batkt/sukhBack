const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");

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
    barilgiinId, // Optional: if provided, restrict to contracts/invoices in this building
    ognoo, // Optional: payment date (YYYY-MM-DD or ISO string) - uses selected date instead of today
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
  const GereeniiTulukhAvlagaModel = GereeniiTulukhAvlaga(kholbolt);

  // Build query to find invoices
  const query = {
    baiguullagiinId: String(baiguullagiinId),
    tuluv: { $ne: "Төлсөн" }, // Only unpaid invoices
  };

  // Restrict to specific building if provided
  if (barilgiinId) {
    query.barilgiinId = String(barilgiinId);
  }

  // NOTE: Previously excluded invoices with ekhniiUldegdel when markEkhniiUldegdel=false.
  // Removed: all unpaid invoices should be payable regardless of ekhniiUldegdel.

  if (nekhemjlekhiinIds && nekhemjlekhiinIds.length > 0) {
    // Mark specific invoices by IDs
    query._id = { $in: nekhemjlekhiinIds };
  } else if (gereeniiId) {
    // Mark all invoices for a specific contract (highest priority after explicit IDs)
    query.gereeniiId = String(gereeniiId);
  } else if (orshinSuugchId) {
    // Mark all invoices for a user (all their active contracts)
    const gereeQuery = {
      orshinSuugchId: String(orshinSuugchId),
      baiguullagiinId: String(baiguullagiinId),
      tuluv: { $ne: "Цуцалсан" },
    };

    // IMPORTANT: If barilgiinId is provided, ONLY find contracts in that building
    if (barilgiinId) {
      gereeQuery.barilgiinId = String(barilgiinId);
    }

    const gerees = await GereeModel.find(gereeQuery).select("_id").lean();

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
      // Get the first active contract for this user (respecting barilgiinId)
      const gereeQuery = {
        orshinSuugchId: String(orshinSuugchId),
        baiguullagiinId: String(baiguullagiinId),
        tuluv: { $ne: "Цуцалсан" },
      };
      if (barilgiinId) {
        gereeQuery.barilgiinId = String(barilgiinId);
      }
      const firstGeree = await GereeModel.findOne(gereeQuery);
      gereeToUpdate = firstGeree;
    }

    if (gereeToUpdate) {
      gereeToUpdate.positiveBalance = (gereeToUpdate.positiveBalance || 0) + dun;
      await gereeToUpdate.save();

      // NEW: Also create a history record for this prepayment so it's visible and counts 
      // towards the dashboard balance reduction.
      try {
        const paymentDate = ognoo ? new Date(ognoo) : new Date();
        const prepayDoc = new GereeniiTulsunAvlagaModel({
          baiguullagiinId: String(baiguullagiinId),
          baiguullagiinNer: gereeToUpdate.baiguullagiinNer || "",
          barilgiinId: gereeToUpdate.barilgiinId || "",
          gereeniiId: gereeToUpdate._id.toString(),
          gereeniiDugaar: gereeToUpdate.gereeniiDugaar || "",
          orshinSuugchId: gereeToUpdate.orshinSuugchId || orshinSuugchId || "",
          nekhemjlekhId: null,

          ognoo: paymentDate,
          tulsunDun: dun,
          tulsunAldangi: 0,

          turul: "prepayment",
          zardliinTurul: "",
          zardliinId: "",
          zardliinNer: "",

          tailbar: tailbar || `Илүү төлөлт (positiveBalance): ${dun}₮`,

          source: "geree",
          guilgeeKhiisenAjiltniiNer: null,
          guilgeeKhiisenAjiltniiId: null,
        });
        await prepayDoc.save();
      } catch (historyError) {
        console.error(`❌ [INVOICE PAYMENT] Error creating prepayment history:`, historyError.message);
      }
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

  let remainingPayment = dun;
  const updatedInvoices = [];
  const gereePositiveBalanceMap = new Map(); // Track positiveBalance per geree
  const tulsunAvlagaDocs = []; // Track created gereeniiTulsunAvlaga records
  const gereesNeedingRecalc = new Set(); // geree IDs whose globalUldegdel we will recalculate
  const gereePaymentMap = new Map(); // Track how much payment (including prepayment) applied per geree

  // Process invoices from latest to oldest
  for (const invoice of invoices) {
    if (remainingPayment <= 0) {
      break; // Payment fully applied
    }

    try {
      const invoiceAmount = invoice.niitTulbur || 0;
      // Use uldegdel if it exists and is valid, otherwise use full amount
      const existingUldegdel = (typeof invoice.uldegdel === 'number' && !isNaN(invoice.uldegdel) && invoice.uldegdel > 0) 
        ? invoice.uldegdel 
        : invoiceAmount;
      const unpaidAmount = existingUldegdel;

      if (unpaidAmount <= 0) {
        continue; // Skip invoices with 0 remaining
      }

      // Calculate how much to apply to this invoice
      const amountToApply = Math.min(remainingPayment, unpaidAmount);
      const newUldegdel = unpaidAmount - amountToApply;
      const isFullyPaid = newUldegdel <= 0.01; // Use small threshold for floating point

      // Calculate per-item (zardluud) payment distribution
      let zardluudUpdate = null;
      if (invoice.medeelel && invoice.medeelel.zardluud && invoice.medeelel.zardluud.length > 0) {
        let remainingToDistribute = amountToApply;
        const updatedZardluud = invoice.medeelel.zardluud.map(z => {
          const itemDun = z.dun || 0;
          const itemTulsunDun = z.tulsunDun || 0;
          const itemUldegdel = itemDun - itemTulsunDun;
          
          if (remainingToDistribute <= 0 || itemUldegdel <= 0) {
            return { ...z };
          }
          
          const applyToItem = Math.min(remainingToDistribute, itemUldegdel);
          remainingToDistribute -= applyToItem;
          
          return {
            ...z,
            tulsunDun: itemTulsunDun + applyToItem,
            tulsenEsekh: (itemTulsunDun + applyToItem) >= (itemDun - 0.01),
          };
        });
        zardluudUpdate = updatedZardluud;
      }

      // Update invoice
      const paymentDate = ognoo ? new Date(ognoo) : new Date();
      const updateData = {
        $push: {
          paymentHistory: {
            ognoo: paymentDate,
            dun: amountToApply,
            turul: "manual",
            guilgeeniiId: `payment_${Date.now()}_${invoice._id}`,
            tailbar: tailbar || (isFullyPaid ? "Төлбөр хийгдлээ" : `Хэсэгчилсэн төлбөр: ${amountToApply}₮`),
          },
        },
        $set: {
          uldegdel: isFullyPaid ? 0 : newUldegdel,
          tuluv: isFullyPaid ? "Төлсөн" : "Төлөөгүй", // tuluv stays Төлөөгүй until uldegdel reaches 0
        },
      };

      if (isFullyPaid) {
        updateData.$set.tulsunOgnoo = paymentDate;
      }

      // Update zardluud with per-item payment tracking
      if (zardluudUpdate) {
        updateData.$set['medeelel.zardluud'] = zardluudUpdate;
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

      remainingPayment -= amountToApply;
      updatedInvoices.push({
        invoice: updatedInvoice,
        amountApplied: amountToApply,
        isFullyPaid,
      });

      // Track geree whose invoices changed, to recalc globalUldegdel later
      if (updatedInvoice.gereeniiId) {
        gereesNeedingRecalc.add(String(updatedInvoice.gereeniiId));
        const key = String(updatedInvoice.gereeniiId);
        const prev = gereePaymentMap.get(key) || 0;
        gereePaymentMap.set(key, prev + amountToApply);
      }

      // NOTE: Do NOT create gereeniiTulsunAvlaga per invoice here - we create ONE consolidated record after the loop

      // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel and is fully paid
      if (isFullyPaid && updatedInvoice.ekhniiUldegdel && updatedInvoice.ekhniiUldegdel > 0) {
        try {
          const gereeForUpdate = await GereeModel.findById(updatedInvoice.gereeniiId);
          if (gereeForUpdate) {
            gereeForUpdate.ekhniiUldegdel = 0;
            await gereeForUpdate.save();
          }
        } catch (error) {
          console.error(`❌ [INVOICE PAYMENT] Error updating geree.ekhniiUldegdel:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ [INVOICE PAYMENT] Error updating invoice ${invoice._id}:`, error.message);
    }
  }

  // Create ONE consolidated gereeniiTulsunAvlaga record for the full payment amount (dun)
  // so one user payment shows as one entry in HistoryModal, not split across invoices
  if (dun > 0 && (updatedInvoices.length > 0 || invoices.length > 0)) {
    const paymentDate = ognoo ? new Date(ognoo) : new Date();
    const firstInvoice = updatedInvoices.length > 0 ? updatedInvoices[0].invoice : invoices[0];
    try {
      const tulsunDoc = new GereeniiTulsunAvlagaModel({
        baiguullagiinId: String(firstInvoice.baiguullagiinId),
        baiguullagiinNer: firstInvoice.baiguullagiinNer || "",
        barilgiinId: firstInvoice.barilgiinId || "",
        gereeniiId: firstInvoice.gereeniiId,
        gereeniiDugaar: firstInvoice.gereeniiDugaar || "",
        orshinSuugchId: firstInvoice.orshinSuugchId || "",
        nekhemjlekhId: firstInvoice._id?.toString() || null,

        ognoo: paymentDate,
        tulsunDun: dun,
        tulsunAldangi: 0,

        turul: "invoice_payment",
        zardliinTurul: "",
        zardliinId: "",
        zardliinNer: "",

        tailbar: tailbar || "Төлөлт хийгдлээ",

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
  }

  // If there's remaining payment, save as positiveBalance
  if (remainingPayment > 0) {
    // Determine which geree(s) to update
    const gereesToUpdate = new Set();

    if (gereeniiId) {
      gereesToUpdate.add(gereeniiId);
    } else if (orshinSuugchId) {
      const gereeQuery = {
        orshinSuugchId: String(orshinSuugchId),
        baiguullagiinId: String(baiguullagiinId),
        tuluv: { $ne: "Цуцалсан" },
      };
      // Respect barilgiinId filter when finding contracts to distribute positive balance
      if (barilgiinId) {
        gereeQuery.barilgiinId = String(barilgiinId);
      }

      const gerees = await GereeModel.find(gereeQuery).select("_id").lean();
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

            // Skip creating separate prepayment gereeniiTulsunAvlaga - the consolidated record above already has the full payment
            // (Creating both would show 2 payment entries for one user payment)

            // PositiveBalance changes also affect globalUldegdel view, so recalc
            gereesNeedingRecalc.add(String(geree._id.toString()));

            // Track this prepayment against geree as well
            const key = String(geree._id.toString());
            const prev = gereePaymentMap.get(key) || 0;
            gereePaymentMap.set(key, prev + balancePerGeree);
          }
        } catch (error) {
          console.error(`❌ [INVOICE PAYMENT] Error updating positiveBalance for geree ${gereeId}:`, error.message);
        }
      }
    }
  }

  // Apply payments to gereeniiTulukhAvlaga (reduce uldegdel on avlaga side)
  try {
    for (const [gereeId, paymentForGeree] of gereePaymentMap.entries()) {
      let remainingForGeree = paymentForGeree;
      if (remainingForGeree <= 0) continue;

      const openTulukhRows = await GereeniiTulukhAvlagaModel.find({
        gereeniiId: String(gereeId),
        baiguullagiinId: String(baiguullagiinId),
        uldegdel: { $gt: 0 },
      })
        .sort({ ognoo: 1, createdAt: 1 })
        .lean();

      for (const row of openTulukhRows) {
        if (remainingForGeree <= 0) break;
        const currentUldegdel = row.uldegdel || 0;
        if (currentUldegdel <= 0) continue;

        const applyHere = Math.min(remainingForGeree, currentUldegdel);
        const newUldegdel = currentUldegdel - applyHere;

        await GereeniiTulukhAvlagaModel.updateOne(
          { _id: row._id },
          { $set: { uldegdel: newUldegdel } }
        );

        remainingForGeree -= applyHere;
      }
    }
  } catch (tulukhUpdateError) {
    console.error(
      "❌ [INVOICE PAYMENT] Error updating gereeniiTulukhAvlaga uldegdel:",
      tulukhUpdateError.message
    );
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
          const positive = gereeToUpdate.positiveBalance || 0;
          // Global balance = unpaid invoices - positiveBalance (can be negative when overpaid)
          gereeToUpdate.globalUldegdel = globalUldegdel - positive;
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
      nekhemjlekhiinDugaar: invoice.nekhemjlekhiiDugaar,
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

/**
 * Get payment summary (tulsunDun) for a single geree from gereeniiTulsunAvlaga.
 *
 * Returns total paid, split by invoice payments and prepayments.
 *
 * @param {Object} options
 * @param {String} options.baiguullagiinId - Organization ID (required)
 * @param {String} options.gereeniiId - Contract ID (required)
 */
async function getGereeniiTulsunSummary(options) {
  const { baiguullagiinId, gereeniiId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } = options || {};

  if (!baiguullagiinId) {
    throw new Error("baiguullagiinId is required");
  }
  if (!gereeniiId && !barilgiinId) {
    throw new Error("Either gereeniiId or barilgiinId must be provided");
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  if (!kholbolt) {
    throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
  }

  const GereeniiTulsunAvlagaModel = GereeniiTulsunAvlaga(kholbolt);

  const match = { baiguullagiinId: String(baiguullagiinId) };
  if (gereeniiId) match.gereeniiId = String(gereeniiId);
  if (barilgiinId) match.barilgiinId = String(barilgiinId);

  if (ekhlekhOgnoo || duusakhOgnoo) {
    match.ognoo = {};
    if (ekhlekhOgnoo) match.ognoo.$gte = new Date(ekhlekhOgnoo);
    if (duusakhOgnoo) match.ognoo.$lte = new Date(duusakhOgnoo);
  }

  const [row] = await GereeniiTulsunAvlagaModel.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$gereeniiId",
        totalTulsunDun: { $sum: "$tulsunDun" },
        totalInvoicePayment: {
          $sum: {
            $cond: [
              { $eq: ["$turul", "invoice_payment"] },
              "$tulsunDun",
              0,
            ],
          },
        },
        totalPrepayment: {
          $sum: {
            $cond: [{ $eq: ["$turul", "prepayment"] }, "$tulsunDun", 0],
          },
        },
      },
    },
  ]);

  return {
    success: true,
    gereeniiId: gereeniiId ? String(gereeniiId) : undefined,
    barilgiinId: barilgiinId ? String(barilgiinId) : undefined,
    totalTulsunDun: row?.totalTulsunDun || 0,
    totalInvoicePayment: row?.totalInvoicePayment || 0,
    totalPrepayment: row?.totalPrepayment || 0,
  };
}

module.exports = {
  markInvoicesAsPaid,
  getGereeniiTulsunSummary,
};
