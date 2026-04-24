/**
 * Sync nekhemjlekhiin + QuickQpayObject (and related rows) when QPay shows PAID but the
 * callback never finished (e.g. two nekhemjlekhiin _ids in one callback path segment).
 *
 * Recommended (same server route as production — includes e-barimt, bank row, tulukh, recalc):
 *   node scripts/syncQpayPaidNekhemjlekh.js --http
 *
 * Dry run (prints URL only):
 *   node scripts/syncQpayPaidNekhemjlekh.js --http --dry-run
 *
 * Override defaults:
 *   node scripts/syncQpayPaidNekhemjlekh.js --http \
 *     --base="https://amarhome.mn/api" \
 *     --baiguullagiin-id=697c70e81e782d8110d3b064 \
 *     --nekhemjlekhiin-ids=69be54b4125cb96e42a4d329,69e997bf99e8cc8abafac153
 *
 * Local DB repair (no HTTP; skips e-barimt — use --http on server when possible):
 *   node scripts/syncQpayPaidNekhemjlekh.js --local --dry-run
 *   node scripts/syncQpayPaidNekhemjlekh.js --local
 *
 * Resolve ids from QuickQpayObject only (omit --nekhemjlekhiin-ids):
 *   node scripts/syncQpayPaidNekhemjlekh.js --local --invoice-id=6782b65c-6a07-4e87-a832-7fe9aaebfe56
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const axios = require("axios");
const mongoose = require("mongoose");
const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const { QuickQpayObject, qpayShalgay } = require("quickqpaypackvSukh");
const { recalcGlobalUldegdel } = require("../utils/recalcGlobalUldegdel");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");

const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin",
);

const DEFAULTS = {
  baiguullagiinId: "697c70e81e782d8110d3b064",
  nekhemjlekhiinIds: "69be54b4125cb96e42a4d329,69e997bf99e8cc8abafac153",
  qpayInvoiceId: "6782b65c-6a07-4e87-a832-7fe9aaebfe56",
};

function parseArgs() {
  const out = {
    http: false,
    local: false,
    dryRun: false,
    base: (process.env.UNDSEN_SERVER || "").replace(/\/$/, ""),
    baiguullagiinId: DEFAULTS.baiguullagiinId,
    nekhemjlekhiinIds: DEFAULTS.nekhemjlekhiinIds,
    qpayInvoiceId: DEFAULTS.qpayInvoiceId,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--http") out.http = true;
    if (a === "--local") out.local = true;
    if (a === "--dry-run") out.dryRun = true;
    if (a.startsWith("--base="))
      out.base = a.slice("--base=".length).replace(/\/$/, "");
    if (a.startsWith("--baiguullagiin-id="))
      out.baiguullagiinId = a.slice("--baiguullagiin-id=".length);
    if (a.startsWith("--nekhemjlekhiin-ids="))
      out.nekhemjlekhiinIds = a.slice("--nekhemjlekhiin-ids=".length);
    if (a.startsWith("--invoice-id="))
      out.qpayInvoiceId = a.slice("--invoice-id=".length);
  }
  if (!out.http && !out.local) out.http = true;
  return out;
}

function parseIdsFromCallbackUrl(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.match(
    /qpayNekhemjlekh(?:Multiple)?Callback\/([^/]+)\/([^?]+)/,
  );
  if (!m) return null;
  return { baiguullagiinId: m[1], nekhemjlekhiinIds: m[2] };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runHttp(opts) {
  const { base, baiguullagiinId, nekhemjlekhiinIds, dryRun } = opts;
  if (!base) {
    console.error(
      "Missing base URL. Set UNDSEN_SERVER in tokhirgoo.env or pass --base=https://amarhome.mn/api",
    );
    process.exit(1);
  }
  const p = `/qpayNekhemjlekhMultipleCallback/${baiguullagiinId}/${nekhemjlekhiinIds}`;
  const url = `${base}${p}`;
  console.log("Request:", "GET", url);
  if (dryRun) {
    console.log("Dry run: not sending HTTP request.");
    return;
  }
  const res = await axios.get(url, {
    maxRedirects: 8,
    validateStatus: () => true,
    timeout: 120000,
  });
  console.log("HTTP status:", res.status);
  const body =
    typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  console.log("Body:", body.slice(0, 800));
  if (res.status >= 400) {
    console.error("Callback returned an error status.");
    process.exit(1);
  }
}

function paymentAlreadyRecorded(nekhemjlekh, paymentTransactionId, qpayInvoiceId) {
  const hist = nekhemjlekh.paymentHistory || [];
  return hist.some(
    (h) =>
      (paymentTransactionId && h.guilgeeniiId === paymentTransactionId) ||
      h.guilgeeniiId === qpayInvoiceId ||
      (typeof h.tailbar === "string" &&
        h.tailbar.includes("QPay төлбөр (sync script")),
  );
}

async function runLocal(opts) {
  const { dryRun, baiguullagiinId, nekhemjlekhiinIds, qpayInvoiceId } = opts;
  console.log("⏳ Waiting for DB…");
  await sleep(3000);

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    throw new Error("No kholboltuud — check MONGODB_URI and db.kholboltUusgey");
  }

  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
  );
  if (!kholbolt) {
    throw new Error(`kholbolt not found for baiguullagiinId=${baiguullagiinId}`);
  }

  const NModel = nekhemjlekhiinTuukh(kholbolt);
  let ids = nekhemjlekhiinIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const qpayObj = await QuickQpayObject(kholbolt).findOne({
    invoice_id: qpayInvoiceId,
  });
  if (qpayObj?.qpay?.callback_url) {
    const parsed = parseIdsFromCallbackUrl(qpayObj.qpay.callback_url);
    if (parsed && parsed.baiguullagiinId === String(baiguullagiinId)) {
      if (!opts._explicitNekhemjlekhiinIds && parsed.nekhemjlekhiinIds) {
        ids = parsed.nekhemjlekhiinIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        console.log("Using nekhemjlekhiin ids from QuickQpayObject.callback_url:", ids.join(","));
      }
    }
  }

  const oid = (id) => new mongoose.Types.ObjectId(id);
  const invoices = await NModel.find({ _id: { $in: ids.map(oid) } });
  if (invoices.length === 0) {
    throw new Error(`No nekhemjlekhiin for ids: ${ids.join(",")}`);
  }

  let paymentTransactionId = null;
  try {
    const khariu = await qpayShalgay(
      { invoice_id: qpayInvoiceId, baiguullagiinId },
      kholbolt,
    );
    const paid =
      khariu?.invoice_status === "PAID" ||
      khariu?.invoice_status === "CLOSED" ||
      (Array.isArray(khariu?.payments) && khariu.payments.length > 0);
    if (!paid && khariu?.invoice_status && khariu.invoice_status !== "OPEN") {
      console.warn("QPay status:", khariu.invoice_status);
    }
    if (khariu?.payments?.[0]?.transactions?.[0]?.id) {
      paymentTransactionId = khariu.payments[0].transactions[0].id;
    }
  } catch (e) {
    console.warn("qpayShalgay failed (continuing with invoice_id as ref):", e.message);
  }
  if (!paymentTransactionId) paymentTransactionId = qpayInvoiceId;

  console.log("Invoices:", invoices.map((i) => i._id.toString()).join(", "));
  console.log("QPay invoice_id:", qpayInvoiceId);
  console.log("Payment ref (guilgeeniiId):", paymentTransactionId);

  if (dryRun) {
    console.log("Dry run: no writes.");
    return;
  }

  const gereeIds = new Set();

  for (const nekhemjlekh of invoices) {
    const inv = await NModel.findById(nekhemjlekh._id);
    if (!inv) continue;

    if (inv.tuluv === "Төлсөн" && (inv.uldegdel || 0) <= 0.01) {
      console.log("Already paid:", inv._id.toString());
      gereeIds.add(String(inv.gereeniiId));
      continue;
    }

    if (paymentAlreadyRecorded(inv, paymentTransactionId, qpayInvoiceId)) {
      console.log("Payment history already has this QPay ref:", inv._id.toString());
      gereeIds.add(String(inv.gereeniiId));
      continue;
    }

    const multiPaidAmount = inv.niitTulbur || 0;
    const multiCurrentUldegdel =
      typeof inv.uldegdel === "number" &&
      !Number.isNaN(inv.uldegdel) &&
      inv.uldegdel > 0
        ? inv.uldegdel
        : multiPaidAmount;
    const multiNewUldegdel = Math.max(
      0,
      multiCurrentUldegdel - multiPaidAmount,
    );
    const multiIsFullyPaid = multiNewUldegdel <= 0.01;

    await NModel.findByIdAndUpdate(inv._id, {
      $set: {
        tuluv: multiIsFullyPaid ? "Төлсөн" : "Хэсэгчлэн төлсөн",
        tulsunOgnoo: new Date(),
        uldegdel: multiIsFullyPaid ? 0 : multiNewUldegdel,
        qpayPaymentId: paymentTransactionId,
      },
      $push: {
        paymentHistory: {
          ognoo: new Date(),
          dun: multiPaidAmount,
          turul: "төлөлт",
          guilgeeniiId: paymentTransactionId || qpayInvoiceId,
          tailbar: "QPay төлбөр (sync script manual)",
        },
      },
    });

    try {
      const tulsunDoc = new (GereeniiTulsunAvlaga(kholbolt))({
        baiguullagiinId: String(inv.baiguullagiinId),
        baiguullagiinNer: inv.baiguullagiinNer || "",
        barilgiinId: inv.barilgiinId || "",
        gereeniiId: String(inv.gereeniiId),
        gereeniiDugaar: inv.gereeniiDugaar || "",
        orshinSuugchId: inv.orshinSuugchId || "",
        nekhemjlekhId: inv._id?.toString() || null,
        ognoo: new Date(),
        tulsunDun: multiPaidAmount,
        tulsunAldangi: 0,
        turul: "төлөлт",
        zardliinTurul: "",
        zardliinId: "",
        zardliinNer: "",
        tailbar: `QPay sync script — ${inv.gereeniiDugaar || ""}`,
        source: "nekhemjlekh",
        guilgeeKhiisenAjiltniiNer: null,
        guilgeeKhiisenAjiltniiId: null,
      });
      await tulsunDoc.save();
    } catch (e) {
      console.error("GereeniiTulsunAvlaga save failed:", e.message);
    }

    try {
      let remainingForGeree = multiPaidAmount;
      const openTulukhRows = await GereeniiTulukhAvlaga(kholbolt)
        .find({
          gereeniiId: String(inv.gereeniiId),
          baiguullagiinId: String(baiguullagiinId),
          uldegdel: { $gt: 0 },
        })
        .sort({ ognoo: 1, createdAt: 1 })
        .lean();

      for (const row of openTulukhRows) {
        if (remainingForGeree <= 0) break;
        const rowUldegdel = row.uldegdel || 0;
        if (rowUldegdel <= 0) continue;
        const applyHere = Math.min(remainingForGeree, rowUldegdel);
        const newRowUldegdel = rowUldegdel - applyHere;
        await GereeniiTulukhAvlaga(kholbolt).updateOne(
          { _id: row._id },
          { $set: { uldegdel: newRowUldegdel } },
        );
        remainingForGeree -= applyHere;
      }
    } catch (e) {
      console.error("TulukhAvlaga update failed:", e.message);
    }

    gereeIds.add(String(inv.gereeniiId));
  }

  for (const gid of gereeIds) {
    try {
      await recalcGlobalUldegdel({
        gereeId: gid,
        baiguullagiinId,
        GereeModel: Geree(kholbolt),
        NekhemjlekhiinTuukhModel: nekhemjlekhiinTuukh(kholbolt),
        GereeniiTulukhAvlagaModel: GereeniiTulukhAvlaga(kholbolt),
        GereeniiTulsunAvlagaModel: GereeniiTulsunAvlaga(kholbolt),
      });
      console.log("recalcGlobalUldegdel ok for geree", gid);
    } catch (e) {
      console.error("recalcGlobalUldegdel failed", gid, e.message);
    }
  }

  if (qpayObj) {
    await QuickQpayObject(kholbolt).updateOne(
      { _id: qpayObj._id },
      {
        $set: {
          tulsunEsekh: true,
          invoice_status: "PAID",
        },
      },
    );
    console.log("QuickQpayObject marked tulsunEsekh + invoice_status PAID");
  } else {
    await QuickQpayObject(kholbolt).updateMany(
      { invoice_id: qpayInvoiceId },
      { $set: { tulsunEsekh: true, invoice_status: "PAID" } },
    );
    console.log("QuickQpayObject updateMany by invoice_id");
  }

  console.log("");
  console.log("Local sync done. E-barimt: run with --http against production if building config enables it.");
}

async function main() {
  const opts = parseArgs();
  opts._explicitNekhemjlekhiinIds = process.argv.some((a) =>
    a.startsWith("--nekhemjlekhiin-ids="),
  );

  if (opts.http) {
    await runHttp(opts);
    return;
  }

  await runLocal(opts);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
