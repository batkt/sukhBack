#!/usr/bin/env node
/**
 * Migration: Fix unpaid invoices missing ekhniiUldegdel (initial balance)
 *
 * The bug: When an initial balance (Эхний үлдэгдэл) was imported via Excel or
 * added manually AFTER an invoice already existed, the invoice was never
 * updated to include that amount. The invoice shows a lower niitTulbur/uldegdel
 * than what the resident actually owes.
 *
 * This script finds all unpaid invoices where:
 *   invoice.ekhniiUldegdel (or medeelel.zardluud ekhniiUldegdel dun) = 0
 *   BUT gereeniiTulukhAvlaga has ekhniiUldegdelEsekh=true records with uldegdel > 0
 *
 * Usage:
 *   DRY_RUN=true node scripts/fix-invoice-ekhnii-uldegdel.js
 *   ORG_ID=697c70e81e782d8110d3b064 node scripts/fix-invoice-ekhnii-uldegdel.js
 *   node scripts/fix-invoice-ekhnii-uldegdel.js
 */

process.chdir(require("path").join(__dirname, ".."));
require("dotenv").config();

const DRY_RUN = process.env.DRY_RUN === "true";
const ORG_ID = process.env.ORG_ID || null;

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║   Fix Unpaid Invoices Missing Эхний үлдэгдэл            ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(DRY_RUN ? "🔍 MODE: DRY RUN (no changes will be saved)" : "⚡ MODE: LIVE (changes will be applied)");
if (ORG_ID) console.log(`🏢 Filtering by ORG_ID: ${ORG_ID}`);

async function main() {
  const { db } = require("zevbackv2");

  // Wait for connections
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log(`\n📊 Available connections: ${db.kholboltuud.length}`);

  const connections = ORG_ID
    ? db.kholboltuud.filter((k) => k.baiguullagiinId === ORG_ID)
    : db.kholboltuud;

  if (connections.length === 0) {
    console.log("❌ No matching connections found.");
    process.exit(1);
  }

  const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
  const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const kholbolt of connections) {
    const orgName = kholbolt.baiguullagiinNer || kholbolt.baiguullagiinId;
    console.log(`\n── Processing: ${orgName} (${kholbolt.baiguullagiinId}) ──`);

    try {
      const TulukhAvlagaModel = GereeniiTulukhAvlaga(kholbolt);
      const NekhemjlekhModel = NekhemjlekhiinTuukh(kholbolt);

      // Step 1: Find all ekhniiUldegdel records that still have uldegdel > 0
      // (i.e., not fully paid yet)
      const ekhniiAvlagaRecords = await TulukhAvlagaModel.find({
        ekhniiUldegdelEsekh: true,
        uldegdel: { $gt: 0 },
      }).lean();

      if (ekhniiAvlagaRecords.length === 0) {
        console.log("  ✅ No outstanding initial balance records found.");
        continue;
      }

      // Group by gereeniiId, summing uldegdel (remaining initial balance)
      const byGeree = {};
      for (const rec of ekhniiAvlagaRecords) {
        const id = rec.gereeniiId;
        if (!byGeree[id]) byGeree[id] = { totalUldegdel: 0, tailbar: "", ognoo: rec.ognoo };
        byGeree[id].totalUldegdel += rec.uldegdel || 0;
        byGeree[id].tailbar = rec.tailbar || byGeree[id].tailbar;
      }

      const gereeniiIds = Object.keys(byGeree);
      console.log(`  📄 Contracts with outstanding initial balance: ${gereeniiIds.length}`);

      let orgFixed = 0;

      for (const gereeniiId of gereeniiIds) {
        const { totalUldegdel, tailbar } = byGeree[gereeniiId];

        // Find unpaid invoices for this contract
        const unpaidInvoices = await NekhemjlekhModel.find({
          gereeniiId: gereeniiId,
          tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
        }).lean();

        for (const invoice of unpaidInvoices) {
          // Check the current ekhniiUldegdel in the invoice's zardal row
          const ekhniiZardal = (invoice.medeelel?.zardluud || []).find(
            (z) => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
          );
          const currentInvoiceEkhnii = ekhniiZardal?.dun || invoice.ekhniiUldegdel || 0;

          // Skip if the invoice already has the correct ekhniiUldegdel
          if (Math.abs(currentInvoiceEkhnii - totalUldegdel) < 0.01) {
            totalSkipped++;
            continue;
          }

          const missingAmount = totalUldegdel - currentInvoiceEkhnii;

          if (missingAmount <= 0) {
            // Invoice already has equal or more — skip
            totalSkipped++;
            continue;
          }

          const newNiitTulbur = (invoice.niitTulbur || 0) + missingAmount;
          const newUldegdel = (invoice.uldegdel || 0) + missingAmount;
          const newEkhniiUldegdel = currentInvoiceEkhnii + missingAmount;

          // Update the zardluud array
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
            `  [${invoice.gereeniiDugaar}] Invoice ${invoice.nekhemjlekhiinDugaar}: ` +
            `ekhniiUldegdel ${currentInvoiceEkhnii} → ${newEkhniiUldegdel} ` +
            `(adding ${missingAmount}₮), niitTulbur ${invoice.niitTulbur} → ${newNiitTulbur}`
          );

          if (!DRY_RUN) {
            try {
              await NekhemjlekhModel.findByIdAndUpdate(invoice._id, {
                $set: {
                  niitTulbur: newNiitTulbur,
                  uldegdel: newUldegdel,
                  ekhniiUldegdel: newEkhniiUldegdel,
                  "medeelel.zardluud": zardluud,
                },
              });
              orgFixed++;
              totalFixed++;
            } catch (err) {
              console.error(`  ❌ Error updating invoice ${invoice._id}:`, err.message);
              totalErrors++;
            }
          } else {
            orgFixed++;
            totalFixed++;
          }
        }
      }

      console.log(`  ✅ ${DRY_RUN ? "Would fix" : "Fixed"} ${orgFixed} invoice(s) in ${orgName}`);
    } catch (err) {
      console.error(`  ❌ Error processing org ${orgName}:`, err.message);
      totalErrors++;
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Migration Summary                                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  ${DRY_RUN ? "Would fix" : "Fixed"}  : ${totalFixed} invoices`);
  console.log(`  Skipped : ${totalSkipped} invoices (already correct)`);
  console.log(`  Errors  : ${totalErrors}`);

  if (DRY_RUN && totalFixed > 0) {
    console.log("\n💡 Run without DRY_RUN=true to apply changes.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
