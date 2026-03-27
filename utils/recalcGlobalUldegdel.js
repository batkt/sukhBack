/**
 * Shared utility to recalculate geree.globalUldegdel using the ledger's calculation.
 * 
 * Instead of recalculating from scratch, we use the same logic as historyLedgerService
 * to build the ledger and get the final uldegdel from the last entry.
 * This ensures globalUldegdel always matches what the ledger shows.
 *
 * @param {Object} opts
 * @param {string} opts.gereeId - The contract ID
 * @param {string} opts.baiguullagiinId - The organization ID
 * @param {Model} opts.GereeModel - Connected Mongoose model for Geree
 * @param {Model} opts.NekhemjlekhiinTuukhModel - Connected Mongoose model for invoices
 * @param {Model} opts.GereeniiTulukhAvlagaModel - Connected Mongoose model for receivables
 * @param {Model} opts.GereeniiTulsunAvlagaModel - Connected Mongoose model for payments
 * @param {string} [opts.excludeInvoiceId] - Optional invoice ID to exclude (for deletion)
 * @returns {Object|null} The updated geree document, or null if not found
 */
async function recalcGlobalUldegdel({
  gereeId,
  baiguullagiinId,
  GereeModel,
  NekhemjlekhiinTuukhModel,
  GereeniiTulukhAvlagaModel,
  GereeniiTulsunAvlagaModel,
  excludeInvoiceId,
}) {
  const oid = String(baiguullagiinId);
  const gid = String(gereeId);

  console.log(`📊 [RECALC ${gid}] ========== STARTING RECALCULATION ==========`);
  console.log(`📊 [RECALC ${gid}] baiguullagiinId: ${oid}, excludeInvoiceId: ${excludeInvoiceId || 'none'}`);

  // Read geree document fresh (re-fetch to avoid stale data)
  const geree = await GereeModel.findById(gereeId);
  if (!geree) {
    console.error(`❌ [RECALC ${gid}] Geree not found`);
    return null;
  }

  // Use the ledger calculation approach: build ledger entries and get final uldegdel
  // This ensures we always match what the ledger shows
  // If excludeInvoiceId is provided (e.g., during deletion), use fallback method
  if (excludeInvoiceId) {
    console.log(`📊 [RECALC ${gid}] Using fallback (excludeInvoiceId provided)`);
    return await recalcGlobalUldegdelFallback({
      gereeId,
      baiguullagiinId,
      GereeModel,
      NekhemjlekhiinTuukhModel,
      GereeniiTulukhAvlagaModel,
      GereeniiTulsunAvlagaModel,
      excludeInvoiceId,
    });
  }
  
  const { getHistoryLedger } = require("../services/historyLedgerService");
  
  // Get the ledger - it calculates the running balance correctly
  let ledgerResult;
  try {
    ledgerResult = await getHistoryLedger({
      gereeniiId: gid,
      baiguullagiinId: oid,
    });
  } catch (ledgerError) {
    console.error(`❌ [RECALC ${gid}] Error getting ledger:`, ledgerError.message);
    // Fallback to old calculation method
    return await recalcGlobalUldegdelFallback({
      gereeId,
      baiguullagiinId,
      GereeModel,
      NekhemjlekhiinTuukhModel,
      GereeniiTulukhAvlagaModel,
      GereeniiTulsunAvlagaModel,
      excludeInvoiceId,
    });
  }

  // Get the final uldegdel from the last ledger entry
  const finalUldegdel = ledgerResult.jagsaalt.length > 0
    ? ledgerResult.jagsaalt[ledgerResult.jagsaalt.length - 1].uldegdel
    : 0;
  
  const newGlobalUldegdel = finalUldegdel;
  const newPositiveBalance = Math.max(0, -newGlobalUldegdel);
  
  console.log(`📊 [RECALC ${gid}] Using ledger's final uldegdel: ${finalUldegdel}`);
  console.log(`📊 [RECALC ${gid}]   Ledger entries: ${ledgerResult.jagsaalt.length}`);
  if (ledgerResult.jagsaalt.length > 0) {
    const lastEntry = ledgerResult.jagsaalt[ledgerResult.jagsaalt.length - 1];
    console.log(`📊 [RECALC ${gid}]   Last entry: ${lastEntry.ner} (${lastEntry.sourceCollection}), uldegdel: ${lastEntry.uldegdel}`);
  }

  // Validation: Ensure we're not getting impossible values
  if (!Number.isFinite(newGlobalUldegdel)) {
    console.error(`❌ [RECALC ${gid}] Invalid globalUldegdel from ledger: ${newGlobalUldegdel}`);
    return geree; // Don't save invalid value
  }
  
  // Re-fetch geree to ensure we have the latest version before updating
  const freshGeree = await GereeModel.findById(gereeId);
  if (!freshGeree) {
    console.error(`❌ [RECALC ${gid}] Geree not found after recalculation`);
    return null;
  }
  
  const oldGlobalUldegdel = freshGeree.globalUldegdel;
  const oldPositiveBalance = freshGeree.positiveBalance;
  
  freshGeree.globalUldegdel = newGlobalUldegdel;
  freshGeree.positiveBalance = newPositiveBalance;
  await freshGeree.save();

  console.log(`📊 [RECALC ${gid}] ✅ SAVED: globalUldegdel ${oldGlobalUldegdel} → ${newGlobalUldegdel}, positiveBalance ${oldPositiveBalance} → ${newPositiveBalance}`);

  // --- AUTOMATIC INVOICE SYSTEM SYNC ---
  // Ensure the invoice document mathematically tracks the newly calculated ledger globalUldegdel
  try {
    const allInvoices = await NekhemjlekhiinTuukhModel
      .find({ gereeniiId: gid })
      .sort({ ognoo: -1, createdAt: -1 });

    if (allInvoices.length > 0) {
      let remainingDebt = Math.round(newGlobalUldegdel * 100) / 100;
      for (const inv of allInvoices) {
        // ALWAYS recalculate originalTotal from zardluud to pick up newly added charges (like Electricity)
        let calculatedOriginalTotal = 0;
        if (Array.isArray(inv.medeelel?.zardluud)) {
          calculatedOriginalTotal = inv.medeelel.zardluud
            .filter(z => !z.isEkhniiUldegdel && z.ner !== "Эхний үлдэгдэл")
            .reduce((s, z) => {
              const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
              const d = z.dun != null ? Number(z.dun) : null;
              const tariff = z.tariff != null ? Number(z.tariff) : 0;
              const val = t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
              return s + (Number(val) || 0);
            }, 0);
        }
        
        // If we found zero from zardluud (unlikely for a real invoice), use niitTulburOriginal if it exists
        let originalTotal = Math.round(calculatedOriginalTotal * 100) / 100;
        if (originalTotal <= 0 && typeof inv.niitTulburOriginal === "number" && inv.niitTulburOriginal > 0) {
          originalTotal = inv.niitTulburOriginal;
        }

        // The newest invoice dynamically absorbs any un-invoiced Avlagas so they coexist as ONE balance
        if (inv === allInvoices[0]) {
          originalTotal = Math.max(originalTotal, Math.round(remainingDebt * 100) / 100);
        }

        const targetUldegdel = Math.round(Math.min(originalTotal, Math.max(0, remainingDebt)) * 100) / 100;
        remainingDebt = Math.round(Math.max(0, remainingDebt - targetUldegdel) * 100) / 100;

        const targetTuluv = targetUldegdel <= 0.01 ? "Төлсөн" : "Төлөөгүй";
        const targetTotalPaid = Math.round((originalTotal - targetUldegdel) * 100) / 100;
        const currentTotalPaid = Math.round(
          (inv.paymentHistory || []).reduce((s, p) => s + (Number(p.dun) || 0), 0) * 100
        ) / 100;

        const paymentDiff = Math.round((targetTotalPaid - currentTotalPaid) * 100) / 100;

        const needsFix =
          Math.abs((inv.uldegdel ?? 0) - targetUldegdel) > 0.01 ||
          Math.abs((inv.niitTulbur ?? 0) - targetUldegdel) > 0.01 ||
          inv.tuluv !== targetTuluv ||
          Math.abs(paymentDiff) > 0.01 ||
          (inv.niitTulburOriginal !== originalTotal && originalTotal > 0);

        if (needsFix && (!excludeInvoiceId || String(inv._id) !== String(excludeInvoiceId))) {
          inv.niitTulburOriginal = originalTotal;
          if (Math.abs(paymentDiff) > 0.01) {
            const existingSyncIdx = (inv.paymentHistory || []).findIndex(p => p.turul === 'system_sync');
            if (existingSyncIdx > -1) {
              inv.paymentHistory[existingSyncIdx].dun = Math.round((inv.paymentHistory[existingSyncIdx].dun + paymentDiff) * 100) / 100;
              if (Math.abs(inv.paymentHistory[existingSyncIdx].dun) <= 0.01) {
                inv.paymentHistory.splice(existingSyncIdx, 1);
              }
            } else if (paymentDiff > 0) {
              if (!inv.paymentHistory) inv.paymentHistory = [];
              inv.paymentHistory.push({
                ognoo: inv.tulsunOgnoo || new Date(),
                dun: paymentDiff,
                turul: "system_sync",
                guilgeeniiId: `sync_${Date.now()}`,
                tailbar: "Системээс тэгшитгэв (Эерэг үлдэгдэл / Төлбөр)"
              });
            } else if (paymentDiff < 0) {
              if (!inv.paymentHistory) inv.paymentHistory = [];
              inv.paymentHistory.push({
                ognoo: new Date(),
                dun: paymentDiff,
                turul: "system_sync",
                guilgeeniiId: `sync_neg_${Date.now()}`,
                tailbar: "Системээс илүү гарсан төлөлтийг тэгшитгэж хасав"
              });
            }
          }

          // SYNCHRONIZE ZARDLUUD PAID STATUS:
          // We must ensure the sum(z.tulsunDun) matches the net payment history sum.
          const finalNetPayment = Math.round((originalTotal - targetUldegdel) * 100) / 100;
          if (inv.medeelel && Array.isArray(inv.medeelel.zardluud)) {
            let runningPaymentTotal = finalNetPayment;
            inv.medeelel.zardluud = inv.medeelel.zardluud.map(z => {
                if (z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл") return z;
                
                const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
                const d = z.dun != null ? Number(z.dun) : null;
                const tariff = z.tariff != null ? Number(z.tariff) : 0;
                const zItemTotal = t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
                
                const applyToThis = Math.max(0, Math.min(runningPaymentTotal, zItemTotal));
                runningPaymentTotal -= applyToThis;
                
                return {
                    ...z,
                    tulsunDun: Math.round(applyToThis * 100) / 100,
                    tulsenEsekh: applyToThis >= zItemTotal - 0.01
                };
            });
            inv.markModified("medeelel.zardluud");
          }

          inv.markModified("paymentHistory");
          inv.uldegdel = targetUldegdel;
          inv.niitTulbur = targetUldegdel;
          inv.tuluv = targetTuluv;
          await inv.save();
        }
      }
    }
  } catch (invSyncErr) {
    console.error(`❌ [RECALC ${gid}] Invoice sync failed:`, invSyncErr.message);
  }

  return freshGeree;
}

/**
 * Fallback calculation method (old approach) - used if ledger service fails
 */
async function recalcGlobalUldegdelFallback({
  gereeId,
  baiguullagiinId,
  GereeModel,
  NekhemjlekhiinTuukhModel,
  GereeniiTulukhAvlagaModel,
  GereeniiTulsunAvlagaModel,
  excludeInvoiceId,
}) {
  const oid = String(baiguullagiinId);
  const gid = String(gereeId);
  
  console.log(`📊 [RECALC ${gid}] Using fallback calculation method`);
  
  const geree = await GereeModel.findById(gereeId);
  if (!geree) return null;

  const ekhniiUldegdel = Number.isFinite(geree.ekhniiUldegdel) ? geree.ekhniiUldegdel : 0;
  let totalCharges = ekhniiUldegdel;

  const invoiceQuery = { baiguullagiinId: oid, gereeniiId: gid };
  if (excludeInvoiceId) {
    invoiceQuery._id = { $ne: excludeInvoiceId };
  }
  const allInvoices = await NekhemjlekhiinTuukhModel.find(invoiceQuery)
    .select("medeelel.zardluud")
    .lean();

  for (const inv of allInvoices) {
    const zardluud = inv.medeelel?.zardluud || [];
    for (const z of zardluud) {
      if (z.isEkhniiUldegdel === true || z.ner === "Эхний үлдэгдэл") continue;
      const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
      const d = z.dun != null ? Number(z.dun) : null;
      const tariff = z.tariff != null ? Number(z.tariff) : 0;
      const amount = t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
      if (Number.isFinite(amount) && amount > 0) {
        totalCharges += amount;
      }
    }
  }

  const allAvlaga = await GereeniiTulukhAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("undsenDun tulukhDun")
    .lean();
  for (const a of allAvlaga) {
    const amount = Number.isFinite(a.undsenDun) && a.undsenDun > 0
      ? a.undsenDun
      : (Number.isFinite(a.tulukhDun) && a.tulukhDun > 0 ? a.tulukhDun : 0);
    if (amount > 0) {
      totalCharges += amount;
    }
  }

  const allPayments = await GereeniiTulsunAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("tulsunDun")
    .lean();
  let totalPayments = 0;
  for (const p of allPayments) {
    if (Number.isFinite(p.tulsunDun) && p.tulsunDun > 0) {
      totalPayments += p.tulsunDun;
    }
  }

  const newGlobalUldegdel = totalCharges - totalPayments;
  const newPositiveBalance = Math.max(0, -newGlobalUldegdel);
  
  geree.globalUldegdel = newGlobalUldegdel;
  geree.positiveBalance = newPositiveBalance;
  await geree.save();
  
  return geree;
}

module.exports = { recalcGlobalUldegdel };
