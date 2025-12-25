const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

// Change to project root directory
const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);

// Load environment variables
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const { gereeNeesNekhemjlekhUusgekh } = require("../controller/nekhemjlekhController");

/**
 * Script to delete ALL invoices and recreate them with date set to December 21, 2025
 * Usage: node scripts/recreateInvoiceDec21.js
 * 
 * WARNING: This will delete ALL invoices and recreate them!
 */
async function recreateInvoiceDec21() {
  // Initialize database connections (same as index.js)
  const app = express();
  db.kholboltUusgey(
    app,
    process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
  );

  // Wait a bit for database connections to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if connections are initialized
  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("❌ No database connections found. Make sure the database is initialized.");
    process.exit(1);
  }
  
  console.log(`✅ Database connections initialized: ${db.kholboltuud.length} connection(s) found`);
  try {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`⚠️  WARNING: This script will DELETE ALL INVOICES`);
    console.log(`   and recreate them with date December 21, 2025`);
    console.log(`═══════════════════════════════════════════════════════════`);

    const targetDate = new Date(2025, 11, 21, 0, 0, 0, 0); // Month is 0-indexed (11 = December)
    console.log(`📅 Target date: ${targetDate.toISOString()}`);

    let totalDeleted = 0;
    let totalRecreated = 0;
    let totalErrors = 0;

    // Step 1: Delete ALL invoices from all database connections
    console.log(`\n🗑️  STEP 1: Deleting ALL invoices...`);
    for (const kholbolt of db.kholboltuud) {
      const NekhemjlekhiinTuukhModel = nekhemjlekhiinTuukh(kholbolt);
      
      // Count invoices before deletion
      const countBefore = await NekhemjlekhiinTuukhModel.countDocuments({});
      console.log(`   Database ${kholbolt.baiguullagiinId || 'unknown'}: Found ${countBefore} invoices`);
      
      // Delete ALL invoices
      const deleteResult = await NekhemjlekhiinTuukhModel.deleteMany({});
      totalDeleted += deleteResult.deletedCount;
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} invoices from this database`);
    }
    console.log(`\n✅ Total invoices deleted: ${totalDeleted}`);

    // Step 2: Find all active contracts and recreate invoices
    console.log(`\n🔄 STEP 2: Recreating invoices for all active contracts...`);
    
    for (const kholbolt of db.kholboltuud) {
      const baiguullagiinId = kholbolt.baiguullagiinId;
      
      if (!baiguullagiinId) {
        console.log(`   ⚠️  Skipping connection without baiguullagiinId`);
        continue;
      }

      console.log(`\n   Processing baiguullaga: ${baiguullagiinId}`);

      // Get baiguullaga
      const BaiguullagaModel = Baiguullaga(db.erunkhiiKholbolt);
      const baiguullaga = await BaiguullagaModel.findById(baiguullagiinId);
      
      if (!baiguullaga) {
        console.log(`   ⚠️  Baiguullaga ${baiguullagiinId} not found, skipping...`);
        continue;
      }

      // Get all active contracts (gerees)
      const GereeModel = Geree(kholbolt);
      const gerees = await GereeModel.find({
        baiguullagiinId: baiguullagiinId,
        tuluv: "Идэвхтэй" // Only active contracts
      });

      console.log(`   Found ${gerees.length} active contracts`);

      // Recreate invoice for each contract
      for (let i = 0; i < gerees.length; i++) {
        const geree = gerees[i];
        try {
          console.log(`   [${i + 1}/${gerees.length}] Processing contract: ${geree.gereeniiDugaar}`);

          // Convert geree to plain object and set target date
          const gereeData = geree.toObject();
          gereeData.ognoo = targetDate;
          gereeData.nekhemjlekhiinOgnoo = targetDate;

          // Recreate the invoice
          const result = await gereeNeesNekhemjlekhUusgekh(
            gereeData,
            baiguullaga,
            kholbolt,
            "automataar",
            true // skipDuplicateCheck = true since we deleted all invoices
          );

          if (result.success && result.nekhemjlekh) {
            // Get the newly created invoice
            const NekhemjlekhiinTuukhModel = nekhemjlekhiinTuukh(kholbolt);
            const invoiceId = result.nekhemjlekh._id || result.nekhemjlekh;
            const newInvoice = await NekhemjlekhiinTuukhModel.findById(invoiceId);
            
            if (newInvoice) {
              // Update the invoice date fields to December 21, 2025
              newInvoice.ognoo = targetDate;
              newInvoice.nekhemjlekhiinOgnoo = targetDate;
              
              // Also update medeelel.uusgegsenOgnoo if it exists
              if (newInvoice.medeelel) {
                newInvoice.medeelel.uusgegsenOgnoo = targetDate;
              }
              
              await newInvoice.save();
              totalRecreated++;
              console.log(`      ✅ Invoice recreated for ${geree.gereeniiDugaar}`);
            } else {
              totalRecreated++;
              console.log(`      ✅ Invoice recreated for ${geree.gereeniiDugaar} (ID: ${invoiceId})`);
            }
          } else {
            totalErrors++;
            console.error(`      ❌ Failed to recreate invoice for ${geree.gereeniiDugaar}: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          totalErrors++;
          console.error(`      ❌ Error processing contract ${geree.gereeniiDugaar}:`, error.message);
        }
      }
    }

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`✅ Script completed!`);
    console.log(`   Total invoices deleted: ${totalDeleted}`);
    console.log(`   Total invoices recreated: ${totalRecreated}`);
    console.log(`   Total errors: ${totalErrors}`);
    console.log(`═══════════════════════════════════════════════════════════`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

// Run the script
recreateInvoiceDec21();
