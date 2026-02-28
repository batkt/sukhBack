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
