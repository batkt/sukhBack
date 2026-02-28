/**
 * Standalone script to fix old invoice data by updating uldegdel from latest ledger entries
 * 
 * Usage:
 *   node scripts/fixOldInvoiceData.js <baiguullagiinId> [barilgiinId] [--dry-run]
 * 
 * Examples:
 *   node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011 --dry-run
 *   node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012
 *   node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011
 */

const { db } = require("zevbackv2");
const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const { getHistoryLedger } = require("../services/historyLedgerService");

// Get command line arguments
const args = process.argv.slice(2);
const baiguullagiinId = args[0];
const barilgiinId = args[1] && !args[1].startsWith('--') ? args[1] : null;
const dryRun = args.includes('--dry-run') || args.includes('-d');

if (!baiguullagiinId) {
  console.error("❌ Error: baiguullagiinId is required");
  console.log("\nUsage:");
  console.log("  node scripts/fixOldInvoiceData.js <baiguullagiinId> [barilgiinId] [--dry-run]");
  console.log("\nExamples:");
  console.log("  node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011 --dry-run");
  console.log("  node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012");
  console.log("  node scripts/fixOldInvoiceData.js 507f1f77bcf86cd799439011");
  process.exit(1);
}

async function fixOldInvoiceData() {
  try {
    console.log("🚀 Starting invoice data fix...");
    console.log(`📊 baiguullagiinId: ${baiguullagiinId}`);
    if (barilgiinId) {
      console.log(`📊 barilgiinId: ${barilgiinId}`);
    }
    console.log(`📊 Dry run: ${dryRun ? 'YES (no changes will be made)' : 'NO (will update data)'}`);
    console.log("");

    // Find the database connection
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
    }

    // Build query
    const query = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) {
      query.barilgiinId = String(barilgiinId);
    }

    // Fetch all invoices
    const NekhemjlekhModel = NekhemjlekhiinTuukh(tukhainBaaziinKholbolt);
    const invoices = await NekhemjlekhModel.find(query).lean();

    if (!invoices || invoices.length === 0) {
      console.log("✅ No invoices found to update");
      return;
    }

    console.log(`📋 Found ${invoices.length} invoices`);

    // Get unique gereeniiId values
    const gereeniiIds = [...new Set(invoices.map(item => item.gereeniiId).filter(Boolean))];
    console.log(`📋 Found ${gereeniiIds.length} unique contracts\n`);

    const results = {
      updated: 0,
      errors: 0,
      unchanged: 0,
      details: [],
    };

    // Process each contract
    for (let i = 0; i < gereeniiIds.length; i++) {
      const gereeniiId = gereeniiIds[i];
      try {
        console.log(`[${i + 1}/${gereeniiIds.length}] Processing contract ${gereeniiId}...`);

        // Get latest ledger entry for this contract
        const ledgerResult = await getHistoryLedger({
          gereeniiId: gereeniiId.toString(),
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
        const contractInvoices = invoices.filter(
          inv => inv.gereeniiId && inv.gereeniiId.toString() === gereeniiId.toString()
        );

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
              // Update invoice
              await NekhemjlekhModel.updateOne(
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
              `${currentUldegdel} → ${latestUldegdel} (${newTuluv})`
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
            console.error(`    ❌ Error updating invoice ${invoice._id}:`, invoiceError.message);
          }
        }
        console.log("");
      } catch (contractError) {
        results.errors++;
        console.error(`❌ Error processing contract ${gereeniiId}:`, contractError.message);
        console.log("");
      }
    }

    // Print summary
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total invoices: ${invoices.length}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Unchanged: ${results.unchanged}`);
    console.log(`Errors: ${results.errors}`);
    console.log("");

    if (dryRun) {
      console.log("⚠️  DRY RUN MODE - No changes were made");
      console.log("   Run without --dry-run to apply changes");
    } else {
      console.log("✅ Updates completed!");
    }

    // Save detailed results to file
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fixOldInvoiceData_${baiguullagiinId}_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'logs', filename);
    
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify({
      baiguullagiinId,
      barilgiinId,
      dryRun,
      timestamp: new Date().toISOString(),
      summary: {
        total: invoices.length,
        updated: results.updated,
        unchanged: results.unchanged,
        errors: results.errors,
      },
      details: results.details,
    }, null, 2));

    console.log(`📄 Detailed results saved to: ${filepath}`);

  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
fixOldInvoiceData()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error.message);
    process.exit(1);
  });
