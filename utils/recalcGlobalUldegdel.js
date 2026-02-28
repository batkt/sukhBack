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
  const geree = await GereeModel.findById(gereeId);
  if (!geree) return null;

  const oid = String(baiguullagiinId);
  const gid = String(gereeId);

  // 1) Start with geree-level ekhniiUldegdel
  let totalCharges = Number.isFinite(geree.ekhniiUldegdel) ? geree.ekhniiUldegdel : 0;

  // 2) Sum invoice charges from individual zardluud (same as historyLedgerService)
  //    This avoids depending on niitTulburOriginal which can be 0/NaN after payments.
  const invoiceQuery = { baiguullagiinId: oid, gereeniiId: gid };
  if (excludeInvoiceId) {
    invoiceQuery._id = { $ne: excludeInvoiceId };
  }
  const allInvoices = await NekhemjlekhiinTuukhModel.find(invoiceQuery)
    .select("medeelel.zardluud medeelel.guilgeenuud")
    .lean();

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
      if (Number.isFinite(amount)) {
        totalCharges += amount;
      }
    }
  }

  // 3) Sum all standalone receivable charges (gereeniiTulukhAvlaga)
  const allAvlaga = await GereeniiTulukhAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("undsenDun tulukhDun")
    .lean();
  for (const a of allAvlaga) {
    const amount = Number.isFinite(a.undsenDun) ? a.undsenDun : (Number.isFinite(a.tulukhDun) ? a.tulukhDun : 0);
    totalCharges += amount;
  }

  // 4) Sum all payments
  const allPayments = await GereeniiTulsunAvlagaModel.find({
    baiguullagiinId: oid,
    gereeniiId: gid,
  })
    .select("tulsunDun")
    .lean();
  let totalPayments = 0;
  for (const p of allPayments) {
    if (Number.isFinite(p.tulsunDun)) {
      totalPayments += p.tulsunDun;
    }
  }

  // 5) Calculate and save
  const newGlobalUldegdel = totalCharges - totalPayments;
  geree.globalUldegdel = newGlobalUldegdel;
  geree.positiveBalance = Math.max(0, -newGlobalUldegdel);
  await geree.save();

  console.log(
    `📊 [RECALC] geree ${gid}: charges=${totalCharges} (ekhnii=${geree.ekhniiUldegdel || 0}, inv zardluud=${totalCharges - (geree.ekhniiUldegdel || 0) - allAvlaga.reduce((s, a) => s + (a.undsenDun || a.tulukhDun || 0), 0)}, avlaga=${allAvlaga.reduce((s, a) => s + (a.undsenDun || a.tulukhDun || 0), 0)}) - payments=${totalPayments} = global=${newGlobalUldegdel}, positive=${geree.positiveBalance}`
  );

  return geree;
}

module.exports = { recalcGlobalUldegdel };
