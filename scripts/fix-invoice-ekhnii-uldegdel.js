/**
 * Migration: Fix unpaid invoices missing ekhniiUldegdel (initial balance)
 *
 * The bug: When an initial balance (Эхний үлдэгдэл) was imported via Excel or
 * added manually AFTER an invoice already existed, the invoice was never updated
 * to include that amount. The invoice showed a lower niitTulbur/uldegdel than
 * what the resident actually owes.
 *
 * This script finds all unpaid invoices where:
 *   invoice's "Эхний үлдэгдэл" zardal row dun = 0
 *   BUT gereeniiTulukhAvlaga has ekhniiUldegdelEsekh=true records with uldegdel > 0
 *
 * Usage (Linux):
 *   DRY_RUN=true node scripts/fix-invoice-ekhnii-uldegdel.js
 *   ORG_ID=697c70e81e782d8110d3b064 DRY_RUN=true node scripts/fix-invoice-ekhnii-uldegdel.js
 *   node scripts/fix-invoice-ekhnii-uldegdel.js
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
const GereeniiTulukhAvlagaModel = require(path.join(projectRoot, "models", "gereeniiTulukhAvlaga"));
const GereeModel = require(path.join(projectRoot, "models", "geree"));
const BaiguullagaModel = require(path.join(projectRoot, "models", "baiguullaga"));

const DRY_RUN = process.env.DRY_RUN === "true";
const ORG_ID = process.env.ORG_ID || null;

// Initialize database connection (same pattern as fix-qpay-uldegdel.js)
const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

async function fixOrgData(kholbolt, baiguullagiinId, orgName) {
  const NekhemjlekhiinTuukh = NekhemjlekhiinTuukhModel(kholbolt);
  const GereeniiTulukhAvlaga = GereeniiTulukhAvlagaModel(kholbolt);
  const Geree = GereeModel(kholbolt);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  const affectedGerees = new Set();

  // Step 1: Find all ekhniiUldegdel records with remaining uldegdel > 0
  const ekhniiAvlagaRecords = await GereeniiTulukhAvlaga.find({
    ekhniiUldegdelEsekh: true,
    uldegdel: { $gt: 0 },
  }).lean();

  if (ekhniiAvlagaRecords.length === 0) {
    console.log(`  ✅ No outstanding initial balance records found.`);
    return { fixed, skipped, errors };
  }

  // Group by gereeniiId, summing uldegdel
  const byGeree = {};
  for (const rec of ekhniiAvlagaRecords) {
    const id = String(rec.gereeniiId);
    if (!byGeree[id]) byGeree[id] = { totalUldegdel: 0, tailbar: "" };
    byGeree[id].totalUldegdel += rec.uldegdel || 0;
    byGeree[id].tailbar = rec.tailbar || byGeree[id].tailbar;
  }

  const gereeniiIds = Object.keys(byGeree);
  console.log(`  📄 Contracts with outstanding initial balance: ${gereeniiIds.length}`);

  for (const gereeniiId of gereeniiIds) {
    const { totalUldegdel, tailbar } = byGeree[gereeniiId];

    // Find all unpaid invoices for this contract
    const unpaidInvoices = await NekhemjlekhiinTuukh.find({
      gereeniiId: gereeniiId,
      tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
    }).lean();

    for (const invoice of unpaidInvoices) {
      try {
        // Find current ekhniiUldegdel in the invoice's zardal row
        const ekhniiZardal = (invoice.medeelel?.zardluud || []).find(
          (z) => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
        );
        const currentInvoiceEkhnii = ekhniiZardal?.dun || invoice.ekhniiUldegdel || 0;

        // How much is missing from the invoice vs what's owed
        const missingAmount = totalUldegdel - currentInvoiceEkhnii;

        if (missingAmount < 0.01) {
          // Already correct (or invoice has more than owed — don't touch)
          skipped++;
          continue;
        }

        const newNiitTulbur = (invoice.niitTulbur || 0) + missingAmount;
        const newUldegdel = (invoice.uldegdel || 0) + missingAmount;
        const newEkhniiUldegdel = currentInvoiceEkhnii + missingAmount;

        // Update zardluud: patch the "Эхний үлдэгдэл" row
        const zardluud = (invoice.medeelel?.zardluud || []).map((z) => {
          if (z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл") {
            return {
              ...z,
              tariff: (z.tariff || 0) + missingAmount,
              dun: (z.dun || 0) + missingAmount,
              tailbar: tailbar || "Эхний үлдэгдэл",
            };
          }
          return z;
        });

        console.log(
          `  [${invoice.gereeniiDugaar}] ${invoice.nekhemjlekhiinDugaar}: ` +
          `ekhnii ${currentInvoiceEkhnii} → ${newEkhniiUldegdel} (+${missingAmount}₮), ` +
          `niitTulbur ${invoice.niitTulbur} → ${newNiitTulbur}`
        );

        if (!DRY_RUN) {
          await NekhemjlekhiinTuukh.findByIdAndUpdate(invoice._id, {
            $set: {
              niitTulbur: newNiitTulbur,
              uldegdel: newUldegdel,
              ekhniiUldegdel: newEkhniiUldegdel,
              "medeelel.zardluud": zardluud,
            },
          });
        }

        fixed++;
        affectedGerees.add(gereeniiId);
      } catch (err) {
        console.error(`  ❌ Error fixing invoice ${invoice._id}:`, err.message);
        errors++;
      }
    }
  }

  // Step 2: Recalculate globalUldegdel for affected gerees
  let recalculated = 0;
  for (const gereeniiId of affectedGerees) {
    try {
      const unpaidInvoices = await NekhemjlekhiinTuukh.find({
        gereeniiId: String(gereeniiId),
        tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
      }).select("niitTulbur uldegdel").lean();

      let globalUldegdel = 0;
      for (const inv of unpaidInvoices) {
        globalUldegdel += (typeof inv.uldegdel === "number" && !isNaN(inv.uldegdel))
          ? inv.uldegdel
          : inv.niitTulbur || 0;
      }

      const geree = await Geree.findById(gereeniiId).lean();
      if (geree) {
        const newGlobalUldegdel = globalUldegdel - (geree.positiveBalance || 0);
        if (!DRY_RUN) {
          await Geree.findByIdAndUpdate(gereeniiId, { $set: { globalUldegdel: newGlobalUldegdel } });
        }
        recalculated++;
      }
    } catch (err) {
      console.error(`  ❌ Error recalculating geree ${gereeniiId}:`, err.message);
    }
  }

  if (recalculated > 0) {
    console.log(`  🔄 Recalculated globalUldegdel for ${recalculated} gerees`);
  }

  return { fixed, skipped, errors };
}

async function main() {
  // Wait for zevbackv2 to establish all connections (same as fix-qpay-uldegdel.js)
  console.log("⏳ Waiting for database connections to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Fix Invoices Missing Эхний үлдэгдэл                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(DRY_RUN ? "🔍 MODE: DRY RUN (no changes will be saved)" : "⚡ MODE: LIVE (changes will be applied)");
  if (ORG_ID) console.log(`🏢 Filtering by ORG_ID: ${ORG_ID}`);
  console.log(`📊 Available connections: ${db.kholboltuud?.length || 0}`);

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("❌ No database connections found! Make sure zevbackv2 is initialized.");
    process.exit(1);
  }

  let kholboltuudToProcess = db.kholboltuud;
  if (ORG_ID) {
    kholboltuudToProcess = db.kholboltuud.filter(
      (k) => String(k.baiguullagiinId) === String(ORG_ID)
    );
    if (kholboltuudToProcess.length === 0) {
      console.error(`❌ No connection found for ORG_ID: ${ORG_ID}`);
      console.log("Available org IDs:");
      db.kholboltuud.forEach((k) => console.log(`  - ${k.baiguullagiinId} (${k.baiguullagiinNer || ""})`));
      process.exit(1);
    }
  }

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const kholbolt of kholboltuudToProcess) {
    const baiguullagiinId = kholbolt.baiguullagiinId;

    let orgName = baiguullagiinId;
    try {
      const baiguullaga = await BaiguullagaModel(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
      if (baiguullaga) orgName = baiguullaga.ner || baiguullagiinId;
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
  console.log(`  ${DRY_RUN ? "Would fix" : "Fixed"}  : ${totalFixed} invoice(s)`);
  console.log(`  Skipped : ${totalSkipped} invoice(s) (already correct)`);
  console.log(`  Errors  : ${totalErrors}`);

  if (DRY_RUN && totalFixed > 0) {
    console.log("\n💡 Run without DRY_RUN=true to apply changes:");
    console.log("   ORG_ID=697c70e81e782d8110d3b064 node scripts/fix-invoice-ekhnii-uldegdel.js");
  }

  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
