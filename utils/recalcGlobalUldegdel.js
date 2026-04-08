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

  console.log(
    `📊 [RECALC ${gid}] ========== STARTING RECALCULATION ==========`,
  );
  console.log(
    `📊 [RECALC ${gid}] baiguullagiinId: ${oid}, excludeInvoiceId: ${excludeInvoiceId || "none"}`,
  );

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
    console.log(
      `📊 [RECALC ${gid}] Using fallback (excludeInvoiceId provided)`,
    );
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
    console.error(
      `❌ [RECALC ${gid}] Error getting ledger:`,
      ledgerError.message,
    );
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
  const finalUldegdel =
    ledgerResult.jagsaalt.length > 0
      ? ledgerResult.jagsaalt[ledgerResult.jagsaalt.length - 1].uldegdel
      : 0;

  const newGlobalUldegdel = finalUldegdel;
  const newPositiveBalance = Math.max(0, -newGlobalUldegdel);

  console.log(
    `📊 [RECALC ${gid}] Using ledger's final uldegdel: ${finalUldegdel}`,
  );
  console.log(
    `📊 [RECALC ${gid}]   Ledger entries: ${ledgerResult.jagsaalt.length}`,
  );
  if (ledgerResult.jagsaalt.length > 0) {
    const lastEntry = ledgerResult.jagsaalt[ledgerResult.jagsaalt.length - 1];
    console.log(
      `📊 [RECALC ${gid}]   Last entry: ${lastEntry.ner} (${lastEntry.sourceCollection}), uldegdel: ${lastEntry.uldegdel}`,
    );
  }

  // Validation: Ensure we're not getting impossible values
  if (!Number.isFinite(newGlobalUldegdel)) {
    console.error(
      `❌ [RECALC ${gid}] Invalid globalUldegdel from ledger: ${newGlobalUldegdel}`,
    );
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

  console.log(
    `📊 [RECALC ${gid}] ✅ SAVED: globalUldegdel ${oldGlobalUldegdel} → ${newGlobalUldegdel}, positiveBalance ${oldPositiveBalance} → ${newPositiveBalance}`,
  );

  // --- AUTOMATIC INVOICE SYSTEM SYNC ---
  // Keep each invoice internally consistent (invoice-scoped).
  // IMPORTANT: Do NOT force the newest invoice to "absorb" contract-wide globalUldegdel,
  // because that makes e.g. April show Feb+Mar+Apr combined.
  try {
    const allInvoices = await NekhemjlekhiinTuukhModel
      .find({ gereeniiId: gid })
      .sort({ ognoo: -1, createdAt: -1 });

    if (allInvoices.length > 0) {
      const invDate = (inv) => inv.ognoo || inv.nekhemjlekhiinOgnoo || inv.createdAt;
      /** YYYY-MM in Mongolia (same idea as history ledger — avoids server-local month drift). */
      const monthKeyMn = (d) => {
        const x = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(x.getTime())) return null;
        try {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ulaanbaatar",
            year: "numeric",
            month: "2-digit",
          }).formatToParts(x);
          const y = parts.find((p) => p.type === "year")?.value;
          const m = parts.find((p) => p.type === "month")?.value;
          if (y && m) return `${y}-${m}`;
        } catch (_e) {
          // fall through
        }
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      };
      const isAvlagaOnlyShellInvoice = (inv) => {
        const dugaar = String(inv.nekhemjlekhiinDugaar || "");
        if (dugaar.startsWith("AVL-")) return true;
        return inv.nekhemjlekhiin === "Авлагаар автоматаар үүсгэсэн нэхэмжлэх";
      };
      const isPaidInvoice = (inv) => String(inv?.tuluv || "") === "Төлсөн";
      const tulukhRowAmt = (row) =>
        Math.round(
          (Number(row.uldegdel) ||
            Number(row.undsenDun) ||
            Number(row.tulukhDun) ||
            0) * 100,
        ) / 100;
      const ascInvoices = [...allInvoices].sort((a, b) => {
        const da = invDate(a) ? new Date(invDate(a)).getTime() : 0;
        const db = invDate(b) ? new Date(invDate(b)).getTime() : 0;
        if (da !== db) return da - db;
        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ca !== cb) return ca - cb;
        return String(a._id).localeCompare(String(b._id));
      });

      // If a month has an AVL-* shell invoice, avlaga must be represented ONLY by that shell
      // (otherwise it shows up on both the normal invoice and the AVL invoice).
      const monthHasAvlagaShell = new Set();
      for (const inv of ascInvoices) {
        const m = monthKeyMn(invDate(inv));
        if (m && isAvlagaOnlyShellInvoice(inv)) {
          monthHasAvlagaShell.add(m);
        }
      }

      // Allocate open avlaga rows to invoice months so e.g. Feb avlaga increases Feb invoice.
      const avlagaByInvoiceId = {};
      ascInvoices.forEach((inv) => {
        avlagaByInvoiceId[String(inv._id)] = 0;
      });
      let openTulukhRows = [];
      try {
        openTulukhRows = await GereeniiTulukhAvlagaModel.find({
          gereeniiId: gid,
          baiguullagiinId: oid,
          uldegdel: { $gt: 0 },
        })
          .sort({ ognoo: 1, createdAt: 1 })
          .lean();

        for (const row of openTulukhRows) {
          const amt = tulukhRowAmt(row);
          if (amt <= 0) continue;

          const rMonth = monthKeyMn(row.ognoo || row.createdAt);
          let target = null;
          if (rMonth) {
            // Prefer AVL-* shell invoice for that month (unpaid), otherwise an unpaid normal invoice.
            target =
              ascInvoices.find(
                (inv) =>
                  monthKeyMn(invDate(inv)) === rMonth &&
                  !isPaidInvoice(inv) &&
                  isAvlagaOnlyShellInvoice(inv),
              ) ||
              ascInvoices.find(
                (inv) =>
                  monthKeyMn(invDate(inv)) === rMonth &&
                  !isPaidInvoice(inv) &&
                  !isAvlagaOnlyShellInvoice(inv),
              ) ||
              null;
          }
          // fallback: nearest next invoice, otherwise latest
          if (!target && rMonth) {
            target =
              ascInvoices.find((inv) => {
                const m = monthKeyMn(invDate(inv));
                return (
                  m &&
                  m >= rMonth &&
                  !isPaidInvoice(inv) &&
                  !isAvlagaOnlyShellInvoice(inv)
                );
              }) ||
              ascInvoices.find((inv) => {
                const m = monthKeyMn(invDate(inv));
                return m && m >= rMonth && !isPaidInvoice(inv);
              }) ||
              // last resort: latest unpaid invoice
              [...ascInvoices]
                .reverse()
                .find((inv) => !isPaidInvoice(inv)) ||
              // absolute last resort: keep old behavior (should be rare)
              ascInvoices[ascInvoices.length - 1];
          }
          if (!target) {
            target =
              [...ascInvoices].reverse().find((inv) => !isPaidInvoice(inv)) ||
              ascInvoices[ascInvoices.length - 1];
          }
          avlagaByInvoiceId[String(target._id)] =
            Math.round((avlagaByInvoiceId[String(target._id)] + amt) * 100) / 100;
        }
      } catch (_avlagaAllocErr) {
        // Continue with invoice-only calculation if avlaga allocation fails
      }

      for (const inv of allInvoices) {
        const id = String(inv._id);
        if (excludeInvoiceId && id === String(excludeInvoiceId)) continue;

        // 1) Recalculate originalTotal from zardluud (preferred), fallback to stored original.
        let originalTotal = 0;
        if (Array.isArray(inv.medeelel?.zardluud)) {
          originalTotal = inv.medeelel.zardluud
            .reduce((s, z) => {
              const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
              const d = z.dun != null ? Number(z.dun) : null;
              const tariff = z.tariff != null ? Number(z.tariff) : 0;
              const val = t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
              return s + (Number(val) || 0);
            }, 0);
        }
        originalTotal = Math.round(originalTotal * 100) / 100;
        const allocatedAvlaga = Math.round((avlagaByInvoiceId[id] || 0) * 100) / 100;

        if (isAvlagaOnlyShellInvoice(inv)) {
          // Auto "AVL-*" invoice: empty zardluud — total must track live gereeniiTulukhAvlaga.uldegdel,
          // not stale niitTulburOriginal (e.g. 200 vs 172 after partial avlaga settlement).
          if (allocatedAvlaga > 0.01) {
            originalTotal = allocatedAvlaga;
          } else {
            const invM = monthKeyMn(invDate(inv));
            let sameMonthOpen = 0;
            for (const row of openTulukhRows) {
              const a = tulukhRowAmt(row);
              if (a <= 0) continue;
              if (invM && monthKeyMn(row.ognoo || row.createdAt) === invM) {
                sameMonthOpen = Math.round((sameMonthOpen + a) * 100) / 100;
              }
            }
            originalTotal = sameMonthOpen;
            if (
              originalTotal <= 0.01 &&
              typeof inv.niitTulburOriginal === "number" &&
              inv.niitTulburOriginal > 0
            ) {
              originalTotal = Math.round(inv.niitTulburOriginal * 100) / 100;
            }
          }
        } else {
          if (
            originalTotal <= 0 &&
            typeof inv.niitTulburOriginal === "number" &&
            inv.niitTulburOriginal > 0
          ) {
            originalTotal = Math.round(inv.niitTulburOriginal * 100) / 100;
          }
          // If the month already has an AVL shell, do NOT also add the same avlaga to the normal invoice.
          const invM = monthKeyMn(invDate(inv));
          if (!(invM && monthHasAvlagaShell.has(invM))) {
            originalTotal = Math.round((originalTotal + allocatedAvlaga) * 100) / 100;
          }
        }

        // 2) Calculate paid amount excluding system_sync, then remaining.
        const totalPaid = Math.round(
          (inv.paymentHistory || []).reduce((s, p) => {
            if (p?.turul === "system_sync") return s;
            return s + (Number(p?.dun) || 0);
          }, 0) * 100,
        ) / 100;

        const remaining = Math.round(Math.max(0, originalTotal - totalPaid) * 100) / 100;
        const tuluv = remaining <= 0.01 ? "Төлсөн" : "Төлөөгүй";

        const needsFix =
          (originalTotal > 0 &&
            Math.abs((Number(inv.niitTulburOriginal) || 0) - originalTotal) > 0.01) ||
          Math.abs((Number(inv.uldegdel) || 0) - remaining) > 0.01 ||
          Math.abs((Number(inv.niitTulbur) || 0) - remaining) > 0.01 ||
          inv.tuluv !== tuluv;

        if (needsFix) {
          inv.niitTulburOriginal = originalTotal;
          inv.uldegdel = remaining;
          inv.niitTulbur = remaining;
          inv.tuluv = tuluv;
          inv._skipTuluvRecalc = true;
          await inv.save();
        }
      }
    }
  } catch (invSyncErr) {
    console.error(
      `❌ [RECALC ${gid}] Invoice sync failed:`,
      invSyncErr.message,
    );
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

  const ekhniiUldegdel = Number.isFinite(geree.ekhniiUldegdel)
    ? geree.ekhniiUldegdel
    : 0;
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
    const amount =
      Number.isFinite(a.undsenDun) && a.undsenDun > 0
        ? a.undsenDun
        : Number.isFinite(a.tulukhDun) && a.tulukhDun > 0
          ? a.tulukhDun
          : 0;
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
