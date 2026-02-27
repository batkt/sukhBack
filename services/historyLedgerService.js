/**
 * History Ledger service: builds ledger rows for one contract and computes
 * backend running balance (uldegdel) for the History modal.
 *
 * GET /geree/:gereeniiId/history-ledger?baiguullagiinId=...&barilgiinId=...
 * Returns { jagsaalt: LedgerRow[] } with uldegdel computed chronologically.
 */

const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");

/**
 * Format date for LedgerRow.ognoo (ISO or YYYY-MM-DD string).
 * @param {Date|string|null} d
 * @returns {string}
 */
function toOgnooString(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * Build flat ledger rows from invoices, tulukh avlaga, and tulsun avlaga for one contract,
 * then sort by date (oldest first) and compute running balance.
 *
 * @param {Object} options
 * @param {string} options.gereeniiId - Contract ID
 * @param {string} options.baiguullagiinId - Organization ID
 * @param {string|null} [options.barilgiinId] - Optional building ID filter
 * @returns {Promise<{ jagsaalt: Array<LedgerRow> }>}
 */
async function getHistoryLedger(options) {
  const { gereeniiId, baiguullagiinId, barilgiinId } = options;

  if (!baiguullagiinId || !gereeniiId) {
    throw new Error("baiguullagiinId and gereeniiId are required");
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
  );
  if (!kholbolt) {
    throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
  }

  const NekhemjlekhiinTuukhModel = nekhemjlekhiinTuukh(kholbolt);
  const GereeniiTulsunAvlagaModel = GereeniiTulsunAvlaga(kholbolt);
  const GereeniiTulukhAvlagaModel = GereeniiTulukhAvlaga(kholbolt);

  const gid = String(gereeniiId);
  const invoiceQuery = {
    baiguullagiinId: String(baiguullagiinId),
    gereeniiId: gid,
  };
  const tulukhQuery = {
    baiguullagiinId: String(baiguullagiinId),
    gereeniiId: gid,
  };
  const tulsunQuery = {
    baiguullagiinId: String(baiguullagiinId),
    gereeniiId: gid,
  };
  if (barilgiinId) {
    invoiceQuery.barilgiinId = String(barilgiinId);
    tulukhQuery.barilgiinId = String(barilgiinId);
    tulsunQuery.barilgiinId = String(barilgiinId);
  }

  const GereeModel = Geree(kholbolt);
  const [invoices, tulukhList, tulsunList, gereeDoc] = await Promise.all([
    NekhemjlekhiinTuukhModel.find(invoiceQuery)
      .lean()
      .sort({ ognoo: 1, createdAt: 1 }),
    GereeniiTulukhAvlagaModel.find(tulukhQuery)
      .lean()
      .sort({ ognoo: 1, createdAt: 1 }),
    GereeniiTulsunAvlagaModel.find(tulsunQuery)
      .lean()
      .sort({ ognoo: 1, createdAt: 1 }),
    GereeModel.findById(gereeniiId)
      .select("ekhniiUldegdel gereeniiOgnoo createdAt zardluud")
      .lean(),
  ]);

  /** @type {Array<{ ognoo: Date, createdAt: Date, tulukhDun: number, tulsunDun: number, ner: string, isSystem: boolean, _id: string, ajiltan?: string, khelber?: string, tailbar?: string, burtgesenOgnoo?: string, parentInvoiceId?: string, sourceCollection: string }>} */
  const rawRows = [];

  // 0) Geree ekhniiUldegdel (initial balance) — so ledger shows when contract has initial balance
  if (
    gereeDoc &&
    typeof gereeDoc.ekhniiUldegdel === "number" &&
    gereeDoc.ekhniiUldegdel > 0
  ) {
    const gereeOgnoo =
      gereeDoc.gereeniiOgnoo || gereeDoc.createdAt || new Date(0);
    rawRows.push({
      ognoo: gereeOgnoo ? new Date(gereeOgnoo) : new Date(0),
      createdAt: gereeDoc.createdAt
        ? new Date(gereeDoc.createdAt)
        : new Date(0),
      tulukhDun: gereeDoc.ekhniiUldegdel,
      tulsunDun: 0,
      ner: "Эхний үлдэгдэл",
      isSystem: true,
      _id: `geree-ekhnii-${gid}`,
      khelber: "Авлага",
      tailbar: "Эхний үлдэгдэл",
      burtgesenOgnoo: gereeDoc.createdAt
        ? new Date(gereeDoc.createdAt).toISOString()
        : undefined,
      sourceCollection: "geree",
    });
  }

  // 1) Invoice charge lines (zardluud) — every line (Lift, dundiin omch, tseverlegee, etc.)
  for (const inv of invoices) {
    const invId = inv._id.toString();
    const invOgnoo = inv.ognoo || inv.nekhemjlekhiinOgnoo || inv.createdAt;
    const invCreated = inv.createdAt ? new Date(inv.createdAt) : new Date(0);
    const ajiltan = inv.maililgeesenAjiltniiNer || "";
    const burtgesenOgnoo = inv.createdAt
      ? new Date(inv.createdAt).toISOString()
      : undefined;
    const zardluud = inv.medeelel?.zardluud || [];
    for (let i = 0; i < zardluud.length; i++) {
      const z = zardluud[i];
      const t = typeof z.tulukhDun === "number" ? z.tulukhDun : null;
      const d = z.dun != null ? Number(z.dun) : null;
      const tariff = z.tariff != null ? Number(z.tariff) : 0;
      const tulukhDun =
        t != null && t > 0 ? t : d != null && d > 0 ? d : tariff;
      rawRows.push({
        ognoo: invOgnoo ? new Date(invOgnoo) : new Date(0),
        createdAt: invCreated,
        tulukhDun,
        tulsunDun: 0,
        ner: z.ner || "Нэхэмжлэх",
        isSystem: true,
        _id: (z._id && z._id.toString()) || `inv-${invId}-z-${i}`,
        ajiltan,
        khelber: "Нэхэмжлэх",
        tailbar: z.tailbar || "",
        burtgesenOgnoo,
        parentInvoiceId: invId,
        sourceCollection: "nekhemjlekhiinTuukh",
      });
    }
    // Invoice payment lines (guilgeenuud)
    const guilgeenuud = inv.medeelel?.guilgeenuud || [];
    for (let i = 0; i < guilgeenuud.length; i++) {
      const g = guilgeenuud[i];
      const tulsunDun =
        typeof g.tulsunDun === "number"
          ? g.tulsunDun
          : g.dun != null
            ? Number(g.dun)
            : 0;
      const gOgnoo = g.ognoo || invOgnoo;
      rawRows.push({
        ognoo: gOgnoo ? new Date(gOgnoo) : new Date(0),
        createdAt: invCreated,
        tulukhDun: 0,
        tulsunDun,
        ner: g.tailbar || "Төлбөр",
        isSystem: false,
        _id: `inv-${invId}-g-${i}`,
        ajiltan,
        khelber: "Төлбөр",
        tailbar: g.tailbar || "",
        burtgesenOgnoo,
        parentInvoiceId: invId,
        sourceCollection: "nekhemjlekhiinTuukh",
      });
    }
  }

  // 2) GereeniiTulukhAvlaga (every avlaga / receivable — Эхний үлдэгдэл, Авлага, etc.)
  for (const s of tulukhList) {
    const tulukhDun =
      typeof s.tulukhDun === "number"
        ? s.tulukhDun
        : s.undsenDun != null
          ? Number(s.undsenDun)
          : 0;
    const ognoo = s.ognoo || s.createdAt;
    rawRows.push({
      ognoo: ognoo ? new Date(ognoo) : new Date(0),
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(0),
      tulukhDun,
      tulsunDun: 0,
      ner: s.zardliinNer || s.tailbar || "Авлага",
      isSystem: !!s.ekhniiUldegdelEsekh,
      _id: s._id.toString(),
      ajiltan: s.guilgeeKhiisenAjiltniiNer || "",
      khelber: "Авлага",
      tailbar: s.tailbar || "",
      burtgesenOgnoo: s.createdAt
        ? new Date(s.createdAt).toISOString()
        : undefined,
      sourceCollection: "gereeniiTulukhAvlaga",
    });
  }

  // 3) GereeniiTulsunAvlaga (every payment — Төлбөр, ashiglalt, tulult, QPay, etc.)
  for (const p of tulsunList) {
    const tulsunDun = typeof p.tulsunDun === "number" ? p.tulsunDun : 0;
    const ognoo = p.ognoo || p.createdAt;
    rawRows.push({
      ognoo: ognoo ? new Date(ognoo) : new Date(0),
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(0),
      tulukhDun: 0,
      tulsunDun,
      ner: p.tailbar || "Төлбөр",
      isSystem: false,
      _id: p._id.toString(),
      ajiltan: p.guilgeeKhiisenAjiltniiNer || "",
      khelber: p.turul || p.source || "Төлбөр",
      tailbar: p.tailbar || "",
      burtgesenOgnoo: p.createdAt
        ? new Date(p.createdAt).toISOString()
        : undefined,
      sourceCollection: "gereeniiTulsunAvlaga",
    });
  }

  // When no other rows exist, add placeholder rows from geree.zardluud (ashiglaltiinZardluud) so the ledger is not empty (avoids white screen)
  if (
    rawRows.length === 0 &&
    gereeDoc &&
    Array.isArray(gereeDoc.zardluud) &&
    gereeDoc.zardluud.length > 0
  ) {
    const gereeOgnoo =
      gereeDoc.gereeniiOgnoo || gereeDoc.createdAt || new Date();
    const gereeCreated = gereeDoc.createdAt
      ? new Date(gereeDoc.createdAt)
      : new Date(0);
    const burtgesenOgnoo = gereeDoc.createdAt
      ? new Date(gereeDoc.createdAt).toISOString()
      : undefined;
    gereeDoc.zardluud.forEach((z, i) => {
      const tulukhDun =
        typeof z.tulukhDun === "number"
          ? z.tulukhDun
          : z.dun != null
            ? Number(z.dun)
            : z.tariff != null
              ? Number(z.tariff)
              : 0;
      rawRows.push({
        ognoo: gereeOgnoo ? new Date(gereeOgnoo) : new Date(0),
        createdAt: gereeCreated,
        tulukhDun,
        tulsunDun: 0,
        ner: z.ner || "Нэхэмжлэх",
        isSystem: true,
        _id: (z._id && z._id.toString()) || `geree-zard-${gid}-${i}`,
        khelber: "Нэхэмжлэх",
        tailbar: z.tailbar || "",
        burtgesenOgnoo,
        sourceCollection: "geree",
      });
    });
  }

  // If still empty, add one zero row so frontend has at least one row (avoids plain white screen)
  if (rawRows.length === 0 && gereeDoc) {
    const gereeOgnoo =
      gereeDoc.gereeniiOgnoo || gereeDoc.createdAt || new Date();
    rawRows.push({
      ognoo: gereeOgnoo ? new Date(gereeOgnoo) : new Date(0),
      createdAt: gereeDoc.createdAt
        ? new Date(gereeDoc.createdAt)
        : new Date(0),
      tulukhDun: 0,
      tulsunDun: 0,
      ner: "Эхний үлдэгдэл",
      isSystem: true,
      _id: `geree-empty-${gid}`,
      khelber: "Нэхэмжлэх",
      tailbar: "",
      sourceCollection: "geree",
    });
  }

  // Sort by date (oldest first), then by createdAt for same day
  rawRows.sort((a, b) => {
    const ta = a.ognoo.getTime();
    const tb = b.ognoo.getTime();
    if (ta !== tb) return ta - tb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Running balance: uldegdel = cumulative charges - cumulative payments after this row
  let runningBalance = 0;
  const jagsaalt = rawRows.map((row) => {
    const charge = row.tulukhDun ?? 0;
    const pay = row.tulsunDun ?? 0;
    runningBalance += charge - pay;
    return {
      _id: row._id,
      ognoo: toOgnooString(row.ognoo),
      ner: row.ner,
      tulukhDun: row.tulukhDun ?? 0,
      tulsunDun: row.tulsunDun ?? 0,
      uldegdel: runningBalance,
      isSystem: !!row.isSystem,
      ...(row.ajiltan != null &&
        row.ajiltan !== "" && { ajiltan: row.ajiltan }),
      ...(row.khelber != null &&
        row.khelber !== "" && { khelber: row.khelber }),
      ...(row.tailbar != null &&
        row.tailbar !== "" && { tailbar: row.tailbar }),
      ...(row.burtgesenOgnoo && { burtgesenOgnoo: row.burtgesenOgnoo }),
      ...(row.parentInvoiceId && { parentInvoiceId: row.parentInvoiceId }),
      sourceCollection: row.sourceCollection,
    };
  });

  return { jagsaalt };
}

module.exports = {
  getHistoryLedger,
};
