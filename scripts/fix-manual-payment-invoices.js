/**
 * Migration: Fix invoices where manual payments (tulult/ashiglalt) were recorded
 * in gereeniiTulsunAvlaga but never applied to the invoice's uldegdel/tuluv.
 *
 * The bug: gereeniiGuilgeeKhadgalya for tulult/ashiglalt saved a gereeniiTulsunAvlaga
 * record with turul='prepayment' and nekhemjlekhId=null, reduced globalUldegdel on the
 * geree — but NEVER updated the invoice's uldegdel or tuluv.
 *
 * This script:
 *   1. Finds gereeniiTulsunAvlaga records with turul='prepayment' and nekhemjlekhId=null
 *   2. Checks if the contract has unpaid invoices whose paymentHistory does NOT already
 *      contain an entry with the same guilgeeniiId (to avoid double-applying)
 *   3. Applies the payment to unpaid invoices oldest-first
 *   4. Updates uldegdel and tuluv on the invoice
 *   5. Adds paymentHistory entry to the invoice
 *
 * Usage (Linux):
 *   DRY_RUN=true node scripts/fix-manual-payment-invoices.js
 *   ORG_ID=697723dc3e77b46e52ccf577 DRY_RUN=true node scripts/fix-manual-payment-invoices.js
 *   node scripts/fix-manual-payment-invoices.js
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
const GereeModel = require(path.join(projectRoot, "models", "geree"));
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
  const Geree = GereeModel(kholbolt);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  const affectedGerees = new Set();

  // Step 1: Find all manual prepayment records NOT linked to an invoice
  // These come from gereeniiGuilgeeKhadgalya tulult/ashiglalt path
  const prepayments = await GereeniiTulsunAvlaga.find({
    baiguullagiinId: String(baiguullagiinId),
    nekhemjlekhId: null,
    turul: "prepayment",
    tulsunDun: { $gt: 0 },
  }).sort({ ognoo: 1 }).lean();

  if (prepayments.length === 0) {
    console.log(`  ✅ No unlinked prepayment records found.`);
    return { fixed, skipped, errors };
  }

  console.log(`  📄 Unlinked prepayment records found: ${prepayments.length}`);

  // Group by gereeniiId, sum up total unlinked prepayment per contract
  const byGeree = {};
  for (const p of prepayments) {
    const gid = String(p.gereeniiId);
    if (!byGeree[gid]) byGeree[gid] = { totalPaid: 0, payments: [] };
    byGeree[gid].totalPaid += p.tulsunDun;
    byGeree[gid].payments.push(p);
  }

  for (const gereeniiId of Object.keys(byGeree)) {
    const { payments } = byGeree[gereeniiId];

    // Find unpaid invoices for this contract (oldest first)
    const unpaidInvoices = await NekhemjlekhModel.find({
      gereeniiId: gereeniiId,
      tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
    }).sort({ createdAt: 1 }).lean();

    // Apply each prepayment in order
    for (const payment of payments) {
      const tulsunId = payment._id.toString();

      try {
        // Check if this payment is already in any invoice's paymentHistory
        // (search ALL invoices for this geree — including fully paid ones)
        const alreadyApplied = await NekhemjlekhModel.findOne({
          gereeniiId: gereeniiId,
          "paymentHistory.guilgeeniiId": tulsunId,
        }).lean();

        if (alreadyApplied) {
          // Already applied — fix nekhemjlekhId backlink if missing
          if (!payment.nekhemjlekhId) {
            console.log(
              `  [${alreadyApplied.gereeniiDugaar}] Payment ${tulsunId} already in paymentHistory ` +
              `of invoice ${alreadyApplied.nekhemjlekhiinDugaar} — ${
                DRY_RUN ? "would fix" : "fixing"
              } nekhemjlekhId backlink`
            );
            if (!DRY_RUN) {
              await GereeniiTulsunAvlaga.findByIdAndUpdate(payment._id, {
                $set: { nekhemjlekhId: alreadyApplied._id.toString() },
              });
            }
          } else {
            console.log(
              `  [SKIP] Payment ${tulsunId} already fully linked (nekhemjlekhId=${payment.nekhemjlekhId})`
            );
          }
          skipped++;
          continue;
        }

        // Not yet in paymentHistory — check if there are any unpaid invoices to apply to
        if (unpaidInvoices.length === 0) {
          console.log(
            `  [SKIP] Payment ${tulsunId} (${payment.tulsunDun}₮): no unpaid invoices and not in paymentHistory`
          );
          skipped++;
          continue;
        }

        // Find the invoice to apply to (first one with remaining balance)
        let appliedToInvoice = null;
        let remainingPayment = payment.tulsunDun;

        for (const invoice of unpaidInvoices) {
          if (remainingPayment <= 0) break;

          const invoiceUldegdel =
            typeof invoice.uldegdel === "number" && !isNaN(invoice.uldegdel) && invoice.uldegdel > 0
              ? invoice.uldegdel
              : invoice.niitTulbur || 0;

          if (invoiceUldegdel <= 0) continue;

          const amountToApply = Math.min(remainingPayment, invoiceUldegdel);
          const newUldegdel = invoiceUldegdel - amountToApply;
          const isFullyPaid = newUldegdel <= 0.01;

          console.log(
            `  [${invoice.gereeniiDugaar}] Invoice ${invoice.nekhemjlekhiinDugaar}: ` +
            `Applying ${amountToApply}₮ from prepayment (${tulsunId}), ` +
            `uldegdel ${invoiceUldegdel} → ${isFullyPaid ? 0 : newUldegdel} ` +
            `(${isFullyPaid ? "Төлсөн" : "Хэсэгчлэн төлсөн"})`
          );

          if (!DRY_RUN) {
            const updateSet = {
              uldegdel: isFullyPaid ? 0 : newUldegdel,
              tuluv: isFullyPaid ? "Төлсөн" : "Хэсэгчлэн төлсөн",
            };
            if (isFullyPaid) updateSet.tulsunOgnoo = payment.ognoo || new Date();

            await NekhemjlekhModel.findByIdAndUpdate(invoice._id, {
              $set: updateSet,
              $push: {
                paymentHistory: {
                  ognoo: payment.ognoo || new Date(),
                  dun: amountToApply,
                  turul: "manual",
                  guilgeeniiId: tulsunId,
                  tailbar: payment.tailbar || "Гараар орсон төлбөр (migration)",
                },
              },
            });

            // Update the gereeniiTulsunAvlaga to link it to this invoice
            if (!appliedToInvoice) {
              await GereeniiTulsunAvlaga.findByIdAndUpdate(payment._id, {
                $set: { nekhemjlekhId: invoice._id.toString() },
              });
            }
          }

          appliedToInvoice = invoice;
          remainingPayment -= amountToApply;

          // Update local copy for next payment iteration
          if (!isFullyPaid) {
            invoice.uldegdel = newUldegdel;
          } else {
            invoice.uldegdel = 0;
            invoice.tuluv = "Төлсөн";
          }
        }

        if (appliedToInvoice) {
          fixed++;
          affectedGerees.add(gereeniiId);
        } else {
          // Payment exists but no invoice to apply to — skip
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ Error applying payment ${tulsunId}:`, err.message);
        errors++;
      }
    }
  }

  // Recalculate globalUldegdel for affected gerees
  for (const gereeniiId of affectedGerees) {
    try {
      const unpaidInvs = await NekhemjlekhModel.find({
        gereeniiId: String(gereeniiId),
        tuluv: { $nin: ["Төлсөн", "Хүчингүй"] },
      }).select("niitTulbur uldegdel").lean();

      let globalUldegdel = 0;
      for (const inv of unpaidInvs) {
        globalUldegdel += typeof inv.uldegdel === "number" && !isNaN(inv.uldegdel)
          ? inv.uldegdel
          : inv.niitTulbur || 0;
      }

      const geree = await Geree.findById(gereeniiId).lean();
      if (geree && !DRY_RUN) {
        const newGlobal = globalUldegdel - (geree.positiveBalance || 0);
        await Geree.findByIdAndUpdate(gereeniiId, { $set: { globalUldegdel: newGlobal } });
      }
    } catch (err) {
      console.error(`  ❌ Error recalculating geree ${gereeniiId}:`, err.message);
    }
  }

  return { fixed, skipped, errors };
}

async function main() {
  console.log("⏳ Waiting for database connections to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Fix Invoices: Manual Payments Not Applied             ║");
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
  console.log(`  ${DRY_RUN ? "Would fix" : "Fixed"}  : ${totalFixed} payment(s)`);
  console.log(`  Skipped : ${totalSkipped} (already applied or no invoice)`);
  console.log(`  Errors  : ${totalErrors}`);
  if (DRY_RUN && totalFixed > 0) {
    console.log("\n💡 Run without DRY_RUN=true to apply:");
    console.log("   node scripts/fix-manual-payment-invoices.js");
  }
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
