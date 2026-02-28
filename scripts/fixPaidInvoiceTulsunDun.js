/**
 * Script to fix invoices marked as "Төлсөн" to show actual total paid amount (tulsunDun)
 * 
 * The issue: When invoices are marked as "Төлсөн", the ledger should show the actual
 * total paid amount, not individual payment entries that become messy.
 * 
 * This script:
 *   1. Finds invoices marked as "Төлсөн" 
 *   2. Calculates total paid from paymentHistory and gereeniiTulsunAvlaga
 *   3. Ensures uldegdel is 0 and shows correct total paid amount
 * 
 * Usage (Linux):
 *   DRY_RUN=true node scripts/fixPaidInvoiceTulsunDun.js          # dry-run, show what would happen
 *   node scripts/fixPaidInvoiceTulsunDun.js                        # apply fixes
 *   ORG_ID=697c70e81e782d8110d3b064 DRY_RUN=true node scripts/fixPaidInvoiceTulsunDun.js
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const { db } = require("zevbackv2");
const NekhemjlekhiinTuukhModel = require(path.join(projectRoot, "models", "nekhemjlekhiinTuukh"));
const GereeniiTulsunAvlagaModel = require(path.join(projectRoot, "models", "gereeniiTulsunAvlaga"));
const BaiguullagaModel = require(path.join(projectRoot, "models", "baiguullaga"));

const DRY_RUN = process.env.DRY_RUN === "true";
const ORG_ID = process.env.ORG_ID || null;

// Initialize database connection
const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

async function fixOrgData(kholbolt, baiguullagiinId, orgName) {
  const NekhemjlekhModel = NekhemjlekhiinTuukhModel(kholbolt);
  const GereeniiTulsunAvlaga = GereeniiTulsunAvlagaModel(kholbolt);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  // Find all invoices marked as "Төлсөн"
  const paidInvoices = await NekhemjlekhModel.find({
    baiguullagiinId: String(baiguullagiinId),
    tuluv: "Төлсөн",
  }).lean();

  if (paidInvoices.length === 0) {
    console.log(`  ✅ No invoices marked as "Төлсөн" found.`);
    return { fixed, skipped, errors };
  }

  console.log(`  📄 Found ${paidInvoices.length} invoice(s) marked as "Төлсөн"`);

  for (const invoice of paidInvoices) {
    try {
      const invId = invoice._id.toString();
      
      // Calculate total paid from paymentHistory only (to avoid duplication)
      // gereeniiTulsunAvlaga records are duplicates of paymentHistory entries
      const totalPaidFromHistory = (invoice.paymentHistory || []).reduce(
        (sum, p) => sum + (p.dun || 0),
        0
      );

      const currentUldegdel = typeof invoice.uldegdel === "number" ? invoice.uldegdel : 0;
      const currentNiitTulbur = typeof invoice.niitTulbur === "number" ? invoice.niitTulbur : 0;
      const isFullyPaid = invoice.tuluv === "Төлсөн" && currentUldegdel <= 0.01;
      
      // Total paid is only from paymentHistory (no avlaga to avoid duplication)
      let totalPaid = totalPaidFromHistory;
      
      // Get niitTulburOriginal (original invoice amount)
      const niitTulburOriginal = typeof invoice.niitTulburOriginal === "number" 
        ? invoice.niitTulburOriginal 
        : (invoice.niitTulbur || 0);
      
      // If totalPaid is 0 but invoice is marked as paid, use niitTulburOriginal as totalPaid
      // This handles cases where paymentHistory/avlaga records are missing but invoice is paid
      if (totalPaid === 0 && niitTulburOriginal > 0 && isFullyPaid) {
        totalPaid = niitTulburOriginal;
        console.log(`    ⚠️ No payment records found, using niitTulburOriginal: ${totalPaid.toFixed(2)}`);
      }
      
      const finalTotalPaid = totalPaid;

      // Check if invoice needs fixing
      // For paid invoices: niitTulbur should equal totalPaid (not 0)
      const needsFix = 
        currentUldegdel > 0.01 || // Should be 0 for paid invoices
        (finalTotalPaid > 0 && Math.abs(currentNiitTulbur - finalTotalPaid) > 0.01); // niitTulbur should match totalPaid for paid invoices

      if (!needsFix) {
        console.log(
          `  [SKIP] Invoice ${invoice.nekhemjlekhiinDugaar || invId}: Already correct ` +
          `(uldegdel: ${currentUldegdel}, niitTulbur: ${currentNiitTulbur}, totalPaid: ${totalPaid.toFixed(2)})`
        );
        skipped++;
        continue;
      }

      console.log(
        `  [${invoice.gereeniiDugaar || "N/A"}] Invoice ${invoice.nekhemjlekhiinDugaar || invId}: ` +
        `uldegdel: ${currentUldegdel} → 0, ` +
        `niitTulbur: ${currentNiitTulbur} → ${finalTotalPaid.toFixed(2)}, ` +
        `totalPaid: ${finalTotalPaid.toFixed(2)} (from ${invoice.paymentHistory?.length || 0} paymentHistory)`
      );

      if (!DRY_RUN) {
        // Update invoice to ensure it's correctly marked as paid
        const updateData = {
          uldegdel: 0,
          tuluv: "Төлсөн",
        };
        
        // Save total paid amount to niitTulbur for paid invoices
        if (finalTotalPaid > 0) {
          updateData.niitTulbur = finalTotalPaid;
        } else if (niitTulburOriginal > 0) {
          // Fallback: use existing niitTulburOriginal if no payments found
          updateData.niitTulbur = niitTulburOriginal;
        } else {
          // If no total found, set to 0
          updateData.niitTulbur = 0;
        }
        
        await NekhemjlekhModel.findByIdAndUpdate(invoice._id, {
          $set: updateData,
        });
        
        console.log(`    ✅ Updated: niitTulbur = ${updateData.niitTulbur}`);
      }

      fixed++;
    } catch (err) {
      console.error(`  ❌ Error processing invoice ${invoice._id}:`, err.message);
      errors++;
    }
  }

  return { fixed, skipped, errors };
}

async function main() {
  console.log("⏳ Waiting for database connections to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Fix Paid Invoices: Show Actual Total Paid Amount      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(DRY_RUN ? "🔍 MODE: DRY RUN (no changes will be saved)" : "⚡ MODE: LIVE (changes will be applied)");
  if (ORG_ID) console.log(`🏢 Filtering by ORG_ID: ${ORG_ID}`);
  console.log(`📊 Available connections: ${db.kholboltuud?.length || 0}`);

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("❌ No database connections found!");
    process.exit(1);
  }

  let kholboltuudToProcess = db.kholboltuud;
  if (ORG_ID) {
    kholboltuudToProcess = db.kholboltuud.filter(
      (k) => String(k.baiguullagiinId) === String(ORG_ID)
    );
    if (kholboltuudToProcess.length === 0) {
      console.error(`❌ No connection found for ORG_ID: ${ORG_ID}`);
      db.kholboltuud.forEach((k) => console.log(`  - ${k.baiguullagiinId}`));
      process.exit(1);
    }
  }

  let totalFixed = 0, totalSkipped = 0, totalErrors = 0;

  for (const kholbolt of kholboltuudToProcess) {
    const baiguullagiinId = kholbolt.baiguullagiinId;
    let orgName = baiguullagiinId;
    try {
      const b = await BaiguullagaModel(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
      if (b) orgName = b.ner || baiguullagiinId;
    } catch (e) {}

    console.log(`\n── Processing: ${orgName} (${baiguullagiinId}) ──`);
    try {
      const result = await fixOrgData(kholbolt, baiguullagiinId, orgName);
      totalFixed += result.fixed;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
      console.log(`  ${DRY_RUN ? "Would fix" : "Fixed"}: ${result.fixed}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
    } catch (err) {
      console.error(`  ❌ Error processing org ${baiguullagiinId}:`, err.message);
      totalErrors++;
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Migration Summary                                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  ${DRY_RUN ? "🔍 DRY RUN" : "⚡ APPLIED"}`);
  console.log(`  ${DRY_RUN ? "Would fix" : "Fixed"}: ${totalFixed} invoice(s)`);
  console.log(`  Skipped : ${totalSkipped} (already correct)`);
  console.log(`  Errors  : ${totalErrors}`);
  if (DRY_RUN && totalFixed > 0) {
    console.log("\n💡 Run without DRY_RUN=true to apply:");
    console.log("   node scripts/fixPaidInvoiceTulsunDun.js");
  }
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
