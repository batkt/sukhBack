/**
 * Shared utility to recalculate geree.globalUldegdel from raw source data.
 *
 * Uses the SAME approach as historyLedgerService to guarantee consistency:
 *   totalCharges = geree.ekhniiUldegdel
 *                + SUM(invoice zardluud.dun, excluding ekhniiUldegdel entries)
 *                + SUM(gereeniiTulukhAvlaga.undsenDun || tulukhDun)
 *   totalPayments = SUM(gereeniiTulsunAvlaga.tulsunDun)
 *   globalUldegdel = totalCharges - totalPayments
 *   positiveBalance = max(0, -globalUldegdel)
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

  // 1) Start with geree-level ekhniiUldegdel
  const ekhniiUldegdel = Number.isFinite(geree.ekhniiUldegdel) ? geree.ekhniiUldegdel : 0;
  let totalCharges = ekhniiUldegdel;
  console.log(`📊 [RECALC ${gid}] Step 1 - Ekhnii Uldegdel: ${ekhniiUldegdel}, totalCharges: ${totalCharges}`);

  // 2) Sum invoice charges from individual zardluud (same as historyLedgerService)
  //    This avoids depending on niitTulburOriginal which can be 0/NaN after payments.
  const invoiceQuery = { baiguullagiinId: oid, gereeniiId: gid };
  if (excludeInvoiceId) {
    invoiceQuery._id = { $ne: excludeInvoiceId };
  }
  const allInvoices = await NekhemjlekhiinTuukhModel.find(invoiceQuery)
    .select("medeelel.zardluud medeelel.guilgeenuud _id")
    .lean();

  console.log(`📊 [RECALC ${gid}] Step 2 - Found ${allInvoices.length} invoice(s)`);
  let invoiceZardluudCount = 0;
  for (const inv of allInvoices) {
    // Sum zardluud (operational charges), skipping ekhniiUldegdel entries
    const zardluud = inv.medeelel?.zardluud || [];
    for (const z of zardluud) {
      if (z.isEkhniiUldegdel === true || z.ner === "Эхний үлдэгдэл") {
        continue; // Already counted via geree.ekhniiUldegdel or standalone avlaga
      }
      const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
      const d = z.dun != null ? Number(z.dun) : null;
      const tariff = z.tariff != null ? Number(z.tariff) : 0;
      const amount = t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
      if (Number.isFinite(amount) && amount > 0) {
        totalCharges += amount;
        invoiceZardluudCount++;
        console.log(`📊 [RECALC ${gid}]   Invoice ${inv._id} zardluud: ${z.ner || 'unnamed'} = ${amount}, totalCharges now: ${totalCharges}`);
      }
    }
  }
  console.log(`📊 [RECALC ${gid}] Step 2 - Processed ${invoiceZardluudCount} invoice zardluud, totalCharges: ${totalCharges}`);

  // 3) Sum all standalone receivable charges (gereeniiTulukhAvlaga)
  // IMPORTANT: Use undsenDun if available, otherwise tulukhDun (don't sum both)
  const allAvlaga = await GereeniiTulukhAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("undsenDun tulukhDun _id tailbar")
    .lean();
  console.log(`📊 [RECALC ${gid}] Step 3 - Found ${allAvlaga.length} avlaga record(s)`);
  let totalAvlaga = 0;
  for (const a of allAvlaga) {
    // Prefer undsenDun, fallback to tulukhDun (they should not both be set)
    const amount = Number.isFinite(a.undsenDun) && a.undsenDun > 0
      ? a.undsenDun
      : (Number.isFinite(a.tulukhDun) && a.tulukhDun > 0 ? a.tulukhDun : 0);
    if (amount > 0) {
      totalAvlaga += amount;
      totalCharges += amount;
      console.log(`📊 [RECALC ${gid}]   Avlaga ${a._id} (${a.tailbar || 'unnamed'}): ${amount} (undsenDun: ${a.undsenDun || 0}, tulukhDun: ${a.tulukhDun || 0}), totalCharges now: ${totalCharges}`);
    }
  }
  console.log(`📊 [RECALC ${gid}] Step 3 - Total avlaga: ${totalAvlaga}, totalCharges: ${totalCharges}`);

  // 4) Sum all payments (ensure we get all records, sorted by creation to verify)
  const allPayments = await GereeniiTulsunAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("tulsunDun createdAt _id tailbar")
    .sort({ createdAt: 1 })
    .lean();
  console.log(`📊 [RECALC ${gid}] Step 4 - Found ${allPayments.length} payment record(s)`);
  let totalPayments = 0;
  for (const p of allPayments) {
    if (Number.isFinite(p.tulsunDun) && p.tulsunDun > 0) {
      totalPayments += p.tulsunDun;
      console.log(`📊 [RECALC ${gid}]   Payment ${p._id} (${p.tailbar || 'unnamed'}): ${p.tulsunDun}, totalPayments now: ${totalPayments}`);
    }
  }
  console.log(`📊 [RECALC ${gid}] Step 4 - Total payments: ${totalPayments}`);

  // 5) Calculate and save
  const invoiceZardluudTotal = totalCharges - ekhniiUldegdel - totalAvlaga;
  const newGlobalUldegdel = totalCharges - totalPayments;
  const newPositiveBalance = Math.max(0, -newGlobalUldegdel);
  
  console.log(`📊 [RECALC ${gid}] Step 5 - Calculation:`);
  console.log(`📊 [RECALC ${gid}]   Total Charges = ${totalCharges}`);
  console.log(`📊 [RECALC ${gid}]     - Ekhnii Uldegdel: ${ekhniiUldegdel}`);
  console.log(`📊 [RECALC ${gid}]     - Invoice Zardluud: ${invoiceZardluudTotal}`);
  console.log(`📊 [RECALC ${gid}]     - Avlaga: ${totalAvlaga}`);
  console.log(`📊 [RECALC ${gid}]   Total Payments = ${totalPayments}`);
  console.log(`📊 [RECALC ${gid}]   Global Uldegdel = ${totalCharges} - ${totalPayments} = ${newGlobalUldegdel}`);
  console.log(`📊 [RECALC ${gid}]   Positive Balance = ${newPositiveBalance}`);
  
  // Validation: Ensure we're not getting impossible values
  if (!Number.isFinite(newGlobalUldegdel)) {
    console.error(`❌ [RECALC ${gid}] Invalid globalUldegdel calculated: ${newGlobalUldegdel}`);
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

module.exports = { recalcGlobalUldegdel };
