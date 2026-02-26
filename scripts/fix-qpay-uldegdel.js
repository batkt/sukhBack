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
 * Usage (Linux):
 *   DRY_RUN=true node scripts/fix-qpay-uldegdel.js                              # preview
 *   node scripts/fix-qpay-uldegdel.js                                            # apply all orgs
 *   ORG_ID=697c70e81e782d8110d3b064 node scripts/fix-qpay-uldegdel.js            # specific org
 *   DRY_RUN=true ORG_ID=697c70e81e782d8110d3b064 node scripts/fix-qpay-uldegdel.js  # preview specific org
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

// Change to project root
const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);

// Load environment variables
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const { db } = require("zevbackv2");
const NekhemjlekhiinTuukhModel = require(path.join(projectRoot, "models", "nekhemjlekhiinTuukh"));
const GereeModel = require(path.join(projectRoot, "models", "geree"));
const GereeniiTulsunAvlagaModel = require(path.join(projectRoot, "models", "gereeniiTulsunAvlaga"));
const GereeniiTulukhAvlagaModel = require(path.join(projectRoot, "models", "gereeniiTulukhAvlaga"));
const BaiguullagaModel = require(path.join(projectRoot, "models", "baiguullaga"));

const DRY_RUN = process.env.DRY_RUN === "true";
const ORG_ID = process.env.ORG_ID || null;

// Initialize database connection (same as index.js)
const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

async function fixOrgData(kholbolt, baiguullagiinId, orgName) {
  const NekhemjlekhiinTuukh = NekhemjlekhiinTuukhModel(kholbolt);
  const Geree = GereeModel(kholbolt);
  const GereeniiTulsunAvlaga = GereeniiTulsunAvlagaModel(kholbolt);
  const GereeniiTulukhAvlaga = GereeniiTulukhAvlagaModel(kholbolt);

  let fixedUldegdel = 0;
  let createdTulsun = 0;
  let updatedTulukh = 0;
  let errors = 0;
  const affectedGerees = new Set();

  // ─── Step 1: Find broken invoices (tuluv=Төлсөн + qpay payment + uldegdel > 0) ──
  const brokenInvoices = await NekhemjlekhiinTuukh.find({
    tuluv: "Төлсөн",
    "paymentHistory.turul": "qpay",
    $or: [
      { uldegdel: { $gt: 0 } },
      { uldegdel: { $exists: false } },
      { uldegdel: null },
    ],
  }).lean();

  console.log(`  📄 Invoices with uldegdel not zeroed: ${brokenInvoices.length}`);

  // ─── Step 2: Find invoices missing gereeniiTulsunAvlaga records ──
  const allPaidQpayInvoices = await NekhemjlekhiinTuukh.find({
    tuluv: "Төлсөн",
    "paymentHistory.turul": "qpay",
  })
    .select("_id baiguullagiinId baiguullagiinNer barilgiinId gereeniiId gereeniiDugaar orshinSuugchId niitTulbur uldegdel paymentHistory tulsunOgnoo")
    .lean();

  console.log(`  📄 Total paid QPay invoices found: ${allPaidQpayInvoices.length}`);

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

  console.log(`  📄 Invoices missing gereeniiTulsunAvlaga: ${invoicesMissingTulsun.length}`);

  // ─── Combine unique invoices ──
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

  console.log(`  📋 Total unique invoices to fix: ${allInvoicesToFix.length}`);

  if (allInvoicesToFix.length === 0) {
    console.log(`  ✅ No broken data for ${orgName}`);
    return { fixedUldegdel, createdTulsun, updatedTulukh, recalculated: 0, errors };
  }

  // ─── Step 3: Fix each invoice ──
  for (let i = 0; i < allInvoicesToFix.length; i++) {
    const inv = allInvoicesToFix[i];
    const invoiceId = inv._id.toString();
    const gereeniiId = inv.gereeniiId;

    try {
      const qpayPayments = (inv.paymentHistory || []).filter((p) => p.turul === "qpay");
      const totalQpayPaid = qpayPayments.reduce((sum, p) => sum + (p.dun || 0), 0);

      // ─── Fix 3a: Update uldegdel ───
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

        if (allInvoicesToFix.length <= 20 || (i + 1) % 50 === 0) {
          console.log(`    [${i + 1}/${allInvoicesToFix.length}] ${invoiceId}: uldegdel ${currentUldegdel} → ${newUldegdel} (paid: ${totalQpayPaid})`);
        }
      }

      // ─── Fix 3b: Create missing gereeniiTulsunAvlaga ───
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
          const tulsunDoc = new GereeniiTulsunAvlaga({
            baiguullagiinId: String(inv.baiguullagiinId || baiguullagiinId),
            baiguullagiinNer: inv.baiguullagiinNer || orgName || "",
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
          await tulsunDoc.save();
        }
        createdTulsun++;
      }

      // ─── Fix 3c: Update gereeniiTulukhAvlaga uldegdel ───
      if (gereeniiId && totalQpayPaid > 0) {
        const openTulukhRows = await GereeniiTulukhAvlaga.find({
          gereeniiId: String(gereeniiId),
          baiguullagiinId: String(inv.baiguullagiinId || baiguullagiinId),
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

      if (gereeniiId) {
        affectedGerees.add(gereeniiId);
      }
    } catch (err) {
      errors++;
      console.error(`    ❌ Error fixing invoice ${invoiceId}:`, err.message);
    }
  }

  // ─── Step 4: Recalculate globalUldegdel ──
  let recalculated = 0;
  for (const gereeniiId of affectedGerees) {
    try {
      const unpaidInvoices = await NekhemjlekhiinTuukh.find({
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
      }
    } catch (err) {
      console.error(`    ❌ Error recalculating geree ${gereeniiId}:`, err.message);
    }
  }

  console.log(`  🔄 Recalculated globalUldegdel for ${recalculated} gerees`);

  return { fixedUldegdel, createdTulsun, updatedTulukh, recalculated, errors };
}

async function main() {
  // Wait for zevbackv2 to establish all connections
  console.log("⏳ Waiting for database connections to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   QPay Uldegdel Fix Migration Script                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(DRY_RUN ? "🔍 MODE: DRY RUN (no changes will be saved)" : "⚡ MODE: LIVE (changes will be applied)");
  if (ORG_ID) console.log(`🏢 Filtering by ORG_ID: ${ORG_ID}`);
  console.log(`📊 Available connections: ${db.kholboltuud?.length || 0}`);
  console.log("");

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("❌ No database connections found! Make sure zevbackv2 is initialized.");
    process.exit(1);
  }

  // Get organizations to process
  let kholboltuudToProcess = db.kholboltuud;

  if (ORG_ID) {
    kholboltuudToProcess = db.kholboltuud.filter(
      (k) => String(k.baiguullagiinId) === String(ORG_ID)
    );
    if (kholboltuudToProcess.length === 0) {
      console.error(`❌ No connection found for ORG_ID: ${ORG_ID}`);
      console.log("Available org IDs:");
      db.kholboltuud.forEach((k) => console.log(`  - ${k.baiguullagiinId}`));
      process.exit(1);
    }
  }

  let totalFixed = { fixedUldegdel: 0, createdTulsun: 0, updatedTulukh: 0, recalculated: 0, errors: 0 };

  for (const kholbolt of kholboltuudToProcess) {
    const baiguullagiinId = kholbolt.baiguullagiinId;

    // Try to get org name
    let orgName = baiguullagiinId;
    try {
      const baiguullaga = await BaiguullagaModel(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
      if (baiguullaga) orgName = baiguullaga.ner || baiguullagiinId;
    } catch (e) {}

    console.log(`\n── Processing: ${orgName} (${baiguullagiinId}) ──`);

    try {
      const result = await fixOrgData(kholbolt, baiguullagiinId, orgName);
      totalFixed.fixedUldegdel += result.fixedUldegdel;
      totalFixed.createdTulsun += result.createdTulsun;
      totalFixed.updatedTulukh += result.updatedTulukh;
      totalFixed.recalculated += result.recalculated;
      totalFixed.errors += result.errors;
    } catch (err) {
      console.error(`  ❌ Error processing org ${baiguullagiinId}:`, err.message);
      totalFixed.errors++;
    }
  }

  // ─── Summary ──
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Migration Summary                                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  ${DRY_RUN ? "🔍 DRY RUN" : "⚡ APPLIED"}`);
  console.log(`  📄 Invoices with uldegdel fixed:        ${totalFixed.fixedUldegdel}`);
  console.log(`  📝 gereeniiTulsunAvlaga records created: ${totalFixed.createdTulsun}`);
  console.log(`  📉 gereeniiTulukhAvlaga rows updated:   ${totalFixed.updatedTulukh}`);
  console.log(`  🔄 Geree globalUldegdel recalculated:   ${totalFixed.recalculated}`);
  console.log(`  ❌ Errors:                               ${totalFixed.errors}`);
  console.log("");

  if (DRY_RUN) {
    console.log("💡 This was a DRY RUN. To apply changes, run without DRY_RUN=true:");
    console.log("   node scripts/fix-qpay-uldegdel.js");
  }

  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
