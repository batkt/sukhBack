/**
 * Script to fix old invoice data where uldegdel doesn't match ledger's final balance
 * 
 * Usage:
 *   node scripts/fixOldInvoiceData.js <baiguullagiinId> [--dry-run] [--barilgiinId=<id>] [--invoiceId=<id>]
 * 
 * Examples:
 *   # Fix all invoices for an organization
 *   node scripts/fixOldInvoiceData.js 697723dc3e77b46e52ccf577 --dry-run
 * 
 *   # Fix only a specific invoice
 *   node scripts/fixOldInvoiceData.js 697723dc3e77b46e52ccf577 --invoiceId=6982adc408db41c95a445947
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const { db } = require("zevbackv2");
const { getHistoryLedger } = require("../services/historyLedgerService");
const NekhemjlekhModel = require("../models/nekhemjlekhiinTuukh");
const BaiguullagaModel = require("../models/baiguullaga");

// Initialize database connection
const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

async function fixOldInvoiceData(baiguullagiinId, options = {}) {
  const { dryRun = false, barilgiinId = null, invoiceId = null } = options;

  console.log("⏳ Waiting for database connections to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🚀 Starting invoice data fix...");
  console.log(`📊 baiguullagiinId: ${baiguullagiinId}`);
  console.log(`📊 Dry run: ${dryRun ? "YES" : "NO"} (${dryRun ? "no changes will be made" : "changes will be saved"})`);
  if (barilgiinId) {
    console.log(`📊 barilgiinId: ${barilgiinId}`);
  }
  if (invoiceId) {
    console.log(`📊 invoiceId: ${invoiceId} (fixing only this invoice)`);
  }
  console.log(`📊 Available connections: ${db.kholboltuud?.length || 0}`);
  console.log("");

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    throw new Error("❌ No database connections found!");
  }

  // Get tenant connection for this organization
  let tukhainBaaziinKholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  // Try ObjectId comparison if string comparison failed
  if (!tukhainBaaziinKholbolt) {
    const mongoose = require("mongoose");
    if (mongoose.Types.ObjectId.isValid(baiguullagiinId)) {
      const baiguullagiinObjectId = new mongoose.Types.ObjectId(baiguullagiinId);
      tukhainBaaziinKholbolt = db.kholboltuud.find((k) => {
        const kId = k.baiguullagiinId;
        if (mongoose.Types.ObjectId.isValid(kId)) {
          return new mongoose.Types.ObjectId(kId).equals(baiguullagiinObjectId);
        }
        return String(kId) === String(baiguullagiinId);
      });
    }
  }
  
  if (!tukhainBaaziinKholbolt) {
    // List available connections for debugging
    console.error("Available connections:");
    db.kholboltuud.forEach((k) => {
      console.error(`  - baiguullagiinId: ${k.baiguullagiinId}, dbName: ${k.dbName || k.baaziinNer || "N/A"}`);
    });
    throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
  }

  // Get organization name
  let orgName = baiguullagiinId;
  try {
    const b = await BaiguullagaModel(db.erunkhiiKholbolt).findById(baiguullagiinId).lean();
    if (b) orgName = b.ner || baiguullagiinId;
  } catch (e) {
    // Ignore error
  }

  console.log(`📋 Organization: ${orgName}`);
  console.log(`📊 Database: ${tukhainBaaziinKholbolt.dbName || tukhainBaaziinKholbolt.baaziinNer || "N/A"}`);

  // Initialize models with tenant connection (tukhainBaaziinKholbolt)
  const NekhemjlekhiinTuukhModel = NekhemjlekhModel(tukhainBaaziinKholbolt);

  // Build query for invoices
  const invoiceQuery = { baiguullagiinId: String(baiguullagiinId) };
  if (barilgiinId) {
    invoiceQuery.barilgiinId = String(barilgiinId);
  }
  if (invoiceId) {
    invoiceQuery._id = invoiceId;
  }

  // Get all invoices (or just the specific one)
  const invoices = await NekhemjlekhiinTuukhModel.find(invoiceQuery).lean();
  console.log(`📦 Found ${invoices.length} invoice(s) to process\n`);
  
  if (invoiceId && invoices.length === 0) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  if (invoices.length === 0) {
    console.log("✅ No invoices to process");
    return {
      success: true,
      updated: 0,
      unchanged: 0,
      errors: 0,
      details: [],
    };
  }

  // Group invoices by contract
  const invoicesByContract = {};
  for (const invoice of invoices) {
    if (!invoice.gereeniiId) continue;
    const gereeniiId = invoice.gereeniiId.toString();
    if (!invoicesByContract[gereeniiId]) {
      invoicesByContract[gereeniiId] = [];
    }
    invoicesByContract[gereeniiId].push(invoice);
  }

  const gereeniiIds = Object.keys(invoicesByContract);
  console.log(`📋 Found ${gereeniiIds.length} unique contract(s)\n`);

  const results = {
    success: true,
    updated: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  // Process each contract
  for (let i = 0; i < gereeniiIds.length; i++) {
    const gereeniiId = gereeniiIds[i];
    try {
      console.log(`[${i + 1}/${gereeniiIds.length}] Processing contract ${gereeniiId}...`);

      // Get latest ledger entry for this contract
      const ledgerResult = await getHistoryLedger({
        gereeniiId: gereeniiId,
        baiguullagiinId: String(baiguullagiinId),
      });

      let latestUldegdel = 0;
      if (ledgerResult && ledgerResult.jagsaalt && ledgerResult.jagsaalt.length > 0) {
        const lastEntry = ledgerResult.jagsaalt[ledgerResult.jagsaalt.length - 1];
        latestUldegdel = typeof lastEntry.uldegdel === "number" 
          ? parseFloat(lastEntry.uldegdel.toFixed(2)) 
          : 0;
      }

      // Find all invoices for this contract
      const contractInvoices = invoicesByContract[gereeniiId];

      console.log(`  Found ${contractInvoices.length} invoice(s) for this contract`);
      console.log(`  Latest ledger uldegdel: ${latestUldegdel}`);

      // Update each invoice for this contract
      for (const invoice of contractInvoices) {
        try {
          const currentUldegdel = typeof invoice.uldegdel === "number" 
            ? parseFloat(invoice.uldegdel.toFixed(2)) 
            : 0;

          // Check if update is needed
          if (Math.abs(currentUldegdel - latestUldegdel) < 0.01) {
            results.unchanged++;
            results.details.push({
              invoiceId: invoice._id.toString(),
              gereeniiDugaar: invoice.gereeniiDugaar || "",
              nekhemjlekhiinDugaar: invoice.nekhemjlekhiinDugaar || "",
              currentUldegdel,
              latestUldegdel,
              status: "unchanged",
            });
            console.log(`    ✓ Invoice ${invoice.nekhemjlekhiinDugaar || invoice._id}: No change needed (${currentUldegdel})`);
            continue;
          }

          // Determine tuluv based on latest balance
          let newTuluv = invoice.tuluv || "Төлөөгүй";
          if (latestUldegdel <= 0.01) {
            newTuluv = "Төлсөн";
          } else if (invoice.tulukhOgnoo && new Date() > new Date(invoice.tulukhOgnoo) && latestUldegdel > 0.01) {
            newTuluv = "Хугацаа хэтэрсэн";
          } else if (latestUldegdel > 0.01) {
            newTuluv = "Төлөөгүй";
          }

          if (!dryRun) {
            // Update invoice - only update uldegdel to match ledger
            await NekhemjlekhiinTuukhModel.updateOne(
              { _id: invoice._id },
              {
                $set: {
                  uldegdel: latestUldegdel,
                  tuluv: newTuluv,
                },
              }
            );
          }

          results.updated++;
          results.details.push({
            invoiceId: invoice._id.toString(),
            gereeniiDugaar: invoice.gereeniiDugaar || "",
            nekhemjlekhiinDugaar: invoice.nekhemjlekhiinDugaar || "",
            currentUldegdel,
            latestUldegdel,
            newTuluv,
            status: dryRun ? "would_update" : "updated",
          });

          console.log(
            `    ${dryRun ? '⚠️' : '✓'} Invoice ${invoice.nekhemjlekhiinDugaar || invoice._id}: ` +
            `uldegdel: ${currentUldegdel} → ${latestUldegdel} (${newTuluv})`
          );
        } catch (invoiceError) {
          results.errors++;
          results.details.push({
            invoiceId: invoice._id.toString(),
            gereeniiDugaar: invoice.gereeniiDugaar || "",
            nekhemjlekhiinDugaar: invoice.nekhemjlekhiinDugaar || "",
            error: invoiceError.message,
            status: "error",
          });
          console.error(`    ❌ Error processing invoice ${invoice._id}:`, invoiceError.message);
        }
      }
    } catch (contractError) {
      results.errors++;
      console.error(`  ❌ Error processing contract ${gereeniiId}:`, contractError.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  ✅ Updated: ${results.updated}`);
  console.log(`  ⏭️  Unchanged: ${results.unchanged}`);
  console.log(`  ❌ Errors: ${results.errors}`);
  console.log("=".repeat(60));

  return results;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const baiguullagiinId = args[0];
  const dryRun = args.includes("--dry-run");
  const barilgiinIdArg = args.find((arg) => arg.startsWith("--barilgiinId="));
  const barilgiinId = barilgiinIdArg ? barilgiinIdArg.split("=")[1] : null;
  const invoiceIdArg = args.find((arg) => arg.startsWith("--invoiceId="));
  const invoiceId = invoiceIdArg ? invoiceIdArg.split("=")[1] : null;

  if (!baiguullagiinId) {
    console.error("❌ Error: baiguullagiinId is required");
    console.error("Usage: node scripts/fixOldInvoiceData.js <baiguullagiinId> [--dry-run] [--barilgiinId=<id>] [--invoiceId=<id>]");
    process.exit(1);
  }

  fixOldInvoiceData(baiguullagiinId, { dryRun, barilgiinId, invoiceId })
    .then((results) => {
      if (results.errors > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error.message);
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fixOldInvoiceData };
