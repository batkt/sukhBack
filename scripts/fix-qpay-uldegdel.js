/**
 * Migration script: Fix QPay payments that were recorded without updating uldegdel,
 * gereeniiTulsunAvlaga, gereeniiTulukhAvlaga, and globalUldegdel.
 *
 * What it does:
 *   1. Finds all invoices with tuluv="Төлсөн" that have QPay entries in paymentHistory
 *      but uldegdel > 0 (meaning uldegdel was never zeroed out)
 *   2. Also finds invoices with tuluv="Төлсөн" + QPay payments where gereeniiTulsunAvlaga
 *      records are missing
 *   3. For each affected invoice:
 *      a) Sets uldegdel = max(0, currentUldegdel - totalQpayPaid)
 *      b) Creates missing gereeniiTulsunAvlaga record
 *      c) Updates gereeniiTulukhAvlaga uldegdel
 *      d) Recalculates globalUldegdel on affected geree
 *
 * Usage:
 *   DRY_RUN=true node scripts/fix-qpay-uldegdel.js          # preview only
 *   node scripts/fix-qpay-uldegdel.js                        # apply fixes
 *   ORG_ID=<orgId> node scripts/fix-qpay-uldegdel.js         # fix specific org only
 *
 * Env vars:
 *   MONGO_URI     - MongoDB connection string (default: from tokhirgoo.env)
 *   DRY_RUN       - set to "true" to preview changes without writing (default: false)
 *   ORG_ID        - optional: fix only this organization
 */

const mongoose = require("mongoose");
const path = require("path");

// Load env
require("dotenv").config({
  path: path.resolve(__dirname, "../tokhirgoo/tokhirgoo.env"),
});

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin";
const DRY_RUN = process.env.DRY_RUN === "true";
const ORG_ID = process.env.ORG_ID || null;

// ─── Schema stubs (minimal, just the fields we need) ──────────────────────
const nekhemjlekhiinTuukhSchema = new mongoose.Schema(
  {
    baiguullagiinId: String,
    baiguullagiinNer: String,
    barilgiinId: String,
    gereeniiId: String,
    gereeniiDugaar: String,
    orshinSuugchId: String,
    niitTulbur: Number,
    uldegdel: Number,
    tuluv: String,
    tulsunOgnoo: Date,
    paymentHistory: [mongoose.Schema.Types.Mixed],
    qpayInvoiceId: String,
    qpayPaymentId: String,
  },
  { strict: false, collection: "nekhemjlekhiinTuukh" }
);

const gereeniiTulsunAvlagaSchema = new mongoose.Schema(
  {
    baiguullagiinId: String,
    baiguullagiinNer: String,
    barilgiinId: String,
    gereeniiId: String,
    gereeniiDugaar: String,
    orshinSuugchId: String,
    nekhemjlekhId: String,
    ognoo: Date,
    tulsunDun: Number,
    tulsunAldangi: Number,
    turul: String,
    zardliinTurul: String,
    zardliinId: String,
    zardliinNer: String,
    tailbar: String,
    source: String,
    guilgeeKhiisenAjiltniiNer: String,
    guilgeeKhiisenAjiltniiId: String,
  },
  { strict: false, collection: "gereeniiTulsunAvlaga", timestamps: true }
);

const gereeniiTulukhAvlagaSchema = new mongoose.Schema(
  {
    baiguullagiinId: String,
    barilgiinId: String,
    gereeniiId: String,
    ognoo: Date,
    undsenDun: Number,
    tulukhDun: Number,
    uldegdel: Number,
  },
  { strict: false, collection: "gereeniiTulukhAvlaga" }
);

const gereeSchema = new mongoose.Schema(
  {
    baiguullagiinId: String,
    gereeniiDugaar: String,
    globalUldegdel: Number,
    positiveBalance: Number,
    orshinSuugchId: String,
  },
  { strict: false, collection: "geree" }
);

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   QPay Uldegdel Fix Migration Script                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(DRY_RUN ? "🔍 MODE: DRY RUN (no changes will be saved)" : "⚡ MODE: LIVE (changes will be applied)");
  if (ORG_ID) console.log(`🏢 Filtering by ORG_ID: ${ORG_ID}`);
  console.log("");

  // Connect
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log("✅ Connected to MongoDB");

  // Register models on this connection
  const NekhemjlekhiinTuukh = conn.model("NekhemjlekhiinTuukh", nekhemjlekhiinTuukhSchema);
  const GereeniiTulsunAvlaga = conn.model("GereeniiTulsunAvlaga", gereeniiTulsunAvlagaSchema);
  const GereeniiTulukhAvlaga = conn.model("GereeniiTulukhAvlaga", gereeniiTulukhAvlagaSchema);
  const Geree = conn.model("Geree", gereeSchema);

  // ─── Step 1: Find broken invoices ───────────────────────────────────
  console.log("\n── Step 1: Finding invoices with QPay payments but uldegdel not updated ──");

  const invoiceQuery = {
    tuluv: "Төлсөн",
    "paymentHistory.turul": "qpay",
    $or: [
      { uldegdel: { $gt: 0 } },
      { uldegdel: { $exists: false } },
      { uldegdel: null },
    ],
  };

  if (ORG_ID) {
    invoiceQuery.baiguullagiinId = ORG_ID;
  }

  const brokenInvoices = await NekhemjlekhiinTuukh.find(invoiceQuery).lean();
  console.log(`Found ${brokenInvoices.length} invoices with uldegdel not properly set`);

  // ─── Step 2: Find invoices missing gereeniiTulsunAvlaga records ─────
  console.log("\n── Step 2: Finding invoices missing gereeniiTulsunAvlaga records ──");

  const paidQpayQuery = {
    tuluv: "Төлсөн",
    "paymentHistory.turul": "qpay",
  };
  if (ORG_ID) paidQpayQuery.baiguullagiinId = ORG_ID;

  const allPaidQpayInvoices = await NekhemjlekhiinTuukh.find(paidQpayQuery)
    .select("_id baiguullagiinId baiguullagiinNer barilgiinId gereeniiId gereeniiDugaar orshinSuugchId niitTulbur uldegdel paymentHistory tulsunOgnoo")
    .lean();

  console.log(`Found ${allPaidQpayInvoices.length} total paid QPay invoices`);

  // Check which ones are missing tulsunAvlaga records
  const invoicesMissingTulsun = [];
  for (const inv of allPaidQpayInvoices) {
    const existingTulsun = await GereeniiTulsunAvlaga.findOne({
      nekhemjlekhId: inv._id.toString(),
      turul: "invoice_payment",
    }).lean();

    if (!existingTulsun) {
      invoicesMissingTulsun.push(inv);
    }
  }

  console.log(`Found ${invoicesMissingTulsun.length} invoices missing gereeniiTulsunAvlaga records`);

  // ─── Combine unique invoices to fix ─────────────────────────────────
  const allInvoiceIds = new Set();
  const allInvoicesToFix = [];

  for (const inv of brokenInvoices) {
    allInvoiceIds.add(inv._id.toString());
    allInvoicesToFix.push(inv);
  }
  for (const inv of invoicesMissingTulsun) {
    if (!allInvoiceIds.has(inv._id.toString())) {
      allInvoiceIds.add(inv._id.toString());
      allInvoicesToFix.push(inv);
    }
  }

  console.log(`\n📋 Total unique invoices to fix: ${allInvoicesToFix.length}`);

  if (allInvoicesToFix.length === 0) {
    console.log("\n✅ No broken data found. Everything looks good!");
    await conn.close();
    return;
  }

  // ─── Step 3: Fix each invoice ───────────────────────────────────────
  console.log("\n── Step 3: Applying fixes ──");

  let fixedUldegdel = 0;
  let createdTulsun = 0;
  let updatedTulukh = 0;
  const affectedGerees = new Set();
  let errors = 0;

  for (let i = 0; i < allInvoicesToFix.length; i++) {
    const inv = allInvoicesToFix[i];
    const invoiceId = inv._id.toString();
    const gereeniiId = inv.gereeniiId;

    try {
      // Calculate total QPay payments from paymentHistory
      const qpayPayments = (inv.paymentHistory || []).filter(
        (p) => p.turul === "qpay"
      );
      const totalQpayPaid = qpayPayments.reduce(
        (sum, p) => sum + (p.dun || 0),
        0
      );

      // ─── Fix 3a: Update uldegdel ───────
      const currentUldegdel = inv.uldegdel;
      const needsUldegdelFix =
        typeof currentUldegdel !== "number" ||
        isNaN(currentUldegdel) ||
        currentUldegdel > 0;

      if (needsUldegdelFix) {
        const baseAmount =
          typeof currentUldegdel === "number" && !isNaN(currentUldegdel) && currentUldegdel > 0
            ? currentUldegdel
            : inv.niitTulbur || 0;
        const newUldegdel = Math.max(0, baseAmount - totalQpayPaid);

        if (!DRY_RUN) {
          await NekhemjlekhiinTuukh.updateOne(
            { _id: inv._id },
            { $set: { uldegdel: newUldegdel } }
          );
        }
        fixedUldegdel++;

        if ((i + 1) % 50 === 0 || allInvoicesToFix.length <= 20) {
          console.log(
            `  [${i + 1}/${allInvoicesToFix.length}] Invoice ${invoiceId}: uldegdel ${currentUldegdel} → ${newUldegdel} (paid: ${totalQpayPaid})`
          );
        }
      }

      // ─── Fix 3b: Create missing gereeniiTulsunAvlaga ───────
      const existingTulsun = await GereeniiTulsunAvlaga.findOne({
        nekhemjlekhId: invoiceId,
        turul: "invoice_payment",
      }).lean();

      if (!existingTulsun && totalQpayPaid > 0) {
        const paymentDate =
          qpayPayments.length > 0
            ? new Date(qpayPayments[qpayPayments.length - 1].ognoo)
            : inv.tulsunOgnoo || new Date();

        if (!DRY_RUN) {
          await GereeniiTulsunAvlaga.create({
            baiguullagiinId: String(inv.baiguullagiinId),
            baiguullagiinNer: inv.baiguullagiinNer || "",
            barilgiinId: inv.barilgiinId || "",
            gereeniiId: String(gereeniiId),
            gereeniiDugaar: inv.gereeniiDugaar || "",
            orshinSuugchId: inv.orshinSuugchId || "",
            nekhemjlekhId: invoiceId,
            ognoo: paymentDate,
            tulsunDun: totalQpayPaid,
            tulsunAldangi: 0,
            turul: "invoice_payment",
            zardliinTurul: "",
            zardliinId: "",
            zardliinNer: "",
            tailbar: `QPay төлбөр (migration fix) - ${inv.gereeniiDugaar || ""}`,
            source: "nekhemjlekh",
            guilgeeKhiisenAjiltniiNer: null,
            guilgeeKhiisenAjiltniiId: null,
          });
        }
        createdTulsun++;
      }

      // ─── Fix 3c: Update gereeniiTulukhAvlaga uldegdel ───────
      if (gereeniiId && totalQpayPaid > 0) {
        // Check if there are open tulukh rows that should have been reduced
        const openTulukhRows = await GereeniiTulukhAvlaga.find({
          gereeniiId: String(gereeniiId),
          baiguullagiinId: String(inv.baiguullagiinId),
          uldegdel: { $gt: 0 },
        })
          .sort({ ognoo: 1, createdAt: 1 })
          .lean();

        let remainingForGeree = totalQpayPaid;
        for (const row of openTulukhRows) {
          if (remainingForGeree <= 0) break;
          const rowUldegdel = row.uldegdel || 0;
          if (rowUldegdel <= 0) continue;
          const applyHere = Math.min(remainingForGeree, rowUldegdel);
          const newRowUldegdel = rowUldegdel - applyHere;

          if (!DRY_RUN) {
            await GereeniiTulukhAvlaga.updateOne(
              { _id: row._id },
              { $set: { uldegdel: newRowUldegdel } }
            );
          }
          updatedTulukh++;
          remainingForGeree -= applyHere;
        }
      }

      // Track affected gerees for globalUldegdel recalculation
      if (gereeniiId) {
        affectedGerees.add(`${inv.baiguullagiinId}::${gereeniiId}`);
      }
    } catch (err) {
      errors++;
      console.error(
        `  ❌ Error fixing invoice ${invoiceId}:`,
        err.message
      );
    }
  }

  // ─── Step 4: Recalculate globalUldegdel for affected gerees ─────────
  console.log(`\n── Step 4: Recalculating globalUldegdel for ${affectedGerees.size} affected contracts ──`);

  let recalculated = 0;
  for (const key of affectedGerees) {
    const [baiguullagiinId, gereeniiId] = key.split("::");

    try {
      const unpaidInvoices = await NekhemjlekhiinTuukh.find({
        baiguullagiinId: String(baiguullagiinId),
        gereeniiId: String(gereeniiId),
        tuluv: { $ne: "Төлсөн" },
      })
        .select("niitTulbur uldegdel")
        .lean();

      let globalUldegdel = 0;
      unpaidInvoices.forEach((inv) => {
        const unpaid =
          typeof inv.uldegdel === "number" && !isNaN(inv.uldegdel)
            ? inv.uldegdel
            : inv.niitTulbur || 0;
        globalUldegdel += unpaid;
      });

      const geree = await Geree.findById(gereeniiId);
      if (geree) {
        const positive = geree.positiveBalance || 0;
        const newGlobalUldegdel = globalUldegdel - positive;

        if (!DRY_RUN) {
          geree.globalUldegdel = newGlobalUldegdel;
          await geree.save();
        }
        recalculated++;

        if (recalculated % 50 === 0 || affectedGerees.size <= 20) {
          console.log(
            `  Geree ${gereeniiId}: globalUldegdel → ${newGlobalUldegdel} (unpaid: ${globalUldegdel}, positive: ${positive})`
          );
        }
      }
    } catch (err) {
      console.error(
        `  ❌ Error recalculating geree ${gereeniiId}:`,
        err.message
      );
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Migration Summary                                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  ${DRY_RUN ? "🔍 DRY RUN" : "⚡ APPLIED"}`);
  console.log(`  📄 Invoices with uldegdel fixed:       ${fixedUldegdel}`);
  console.log(`  📝 gereeniiTulsunAvlaga records created: ${createdTulsun}`);
  console.log(`  📉 gereeniiTulukhAvlaga rows updated:   ${updatedTulukh}`);
  console.log(`  🔄 Geree globalUldegdel recalculated:   ${recalculated}`);
  console.log(`  ❌ Errors:                               ${errors}`);
  console.log("");

  if (DRY_RUN) {
    console.log("💡 This was a DRY RUN. To apply changes, run without DRY_RUN=true:");
    console.log("   node scripts/fix-qpay-uldegdel.js");
  }

  await conn.close();
  console.log("\n✅ Done. MongoDB connection closed.");
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
