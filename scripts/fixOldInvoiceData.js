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

const { db } = require("zevbackv2");
const { getHistoryLedger } = require("../services/historyLedgerService");
const NekhemjlekhModel = require("../models/nekhemjlekhiinTuukh");
const mongoose = require("mongoose");

async function fixOldInvoiceData(baiguullagiinId, options = {}) {
  const { dryRun = false, barilgiinId = null, invoiceId = null } = options;

  console.log("🚀 Starting invoice data fix...");
  console.log(`📊 baiguullagiinId: ${baiguullagiinId}`);
  console.log(`📊 Dry run: ${dryRun ? "YES" : "NO"} (${dryRun ? "no changes will be made" : "changes will be saved"})`);
  if (barilgiinId) {
    console.log(`📊 barilgiinId: ${barilgiinId}`);
  }
  if (invoiceId) {
    console.log(`📊 invoiceId: ${invoiceId} (fixing only this invoice)`);
  }
  console.log("");

  // HARDCODED: Connect directly to amarSukh database - NO turees connection
  const AMARSUKH_CONNECTION_STRING = "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin";
  
  console.log(`📊 Connecting to amarSukh database to get tenant connection...`);
  
  // Create mongoose connection directly to amarSukh
  const amarSukhConnection = mongoose.createConnection(AMARSUKH_CONNECTION_STRING, {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    amarSukhConnection.once('connected', () => {
      console.log(`✅ Connected to amarSukh database`);
      resolve();
    });
    amarSukhConnection.once('error', (err) => {
      reject(err);
    });
    // If already connected, resolve immediately
    if (amarSukhConnection.readyState === 1) {
      resolve();
    }
  });

  // Query tenant connections from amarSukh database
  // Tenant connections are stored in a collection (likely "kholboltuud" or similar)
  const tenantConnections = await amarSukhConnection.db.collection("kholboltuud").find({
    baiguullagiinId: baiguullagiinId
  }).toArray();

  // Try ObjectId comparison if string comparison fails
  let tenantConnection = tenantConnections.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  if (!tenantConnection && mongoose.Types.ObjectId.isValid(baiguullagiinId)) {
    const baiguullagiinObjectId = new mongoose.Types.ObjectId(baiguullagiinId);
    tenantConnection = tenantConnections.find((k) => {
      const kId = k.baiguullagiinId;
      if (mongoose.Types.ObjectId.isValid(kId)) {
        return new mongoose.Types.ObjectId(kId).equals(baiguullagiinObjectId);
      }
      return String(kId) === String(baiguullagiinId);
    });
  }

  if (!tenantConnection) {
    // Try querying all connections to see what's available
    const allConnections = await amarSukhConnection.db.collection("kholboltuud").find({}).toArray();
    console.error("Available tenant connections in amarSukh:");
    allConnections.forEach((k) => {
      console.error(`  - baiguullagiinId: ${k.baiguullagiinId}, dbName: ${k.dbName || k.baaziinNer || "N/A"}`);
    });
    throw new Error(`Tenant connection not found in amarSukh for baiguullagiinId: ${baiguullagiinId}`);
  }

  console.log(`📊 Found tenant connection: ${tenantConnection.dbName || tenantConnection.baaziinNer || "N/A"}`);

  // Build connection string for tenant database
  const clusterUrl = tenantConnection.clusterUrl || "127.0.0.1:27017";
  const userName = tenantConnection.userName || "admin";
  const password = tenantConnection.password || "Br1stelback1";
  const tenantDbName = tenantConnection.dbName || tenantConnection.baaziinNer;
  
  const tenantConnectionString = `mongodb://${userName}:${password}@${clusterUrl}/${tenantDbName}?authSource=admin`;
  
  console.log(`📊 Connecting to tenant database: ${tenantDbName}...`);

  // Create connection to actual tenant database
  const tenantDbConnection = mongoose.createConnection(tenantConnectionString, {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Wait for tenant connection
  await new Promise((resolve, reject) => {
    tenantDbConnection.once('connected', () => {
      console.log(`✅ Connected to tenant database: ${tenantDbName}`);
      resolve();
    });
    tenantDbConnection.once('error', (err) => {
      reject(err);
    });
    if (tenantDbConnection.readyState === 1) {
      resolve();
    }
  });

  // Create kholbolt object for models
  const tukhainBaaziinKholbolt = {
    kholbolt: tenantDbConnection,
    baiguullagiinId: baiguullagiinId,
    dbName: tenantDbName,
    baaziinNer: tenantDbName
  };

  console.log(`📊 Using tenant database: ${tenantDbName}`);

  // Initialize models with tenant connection (tukhainBaaziinKholbolt)
  // NOTE: We do NOT query Baiguullaga to avoid connecting to wrong database
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
