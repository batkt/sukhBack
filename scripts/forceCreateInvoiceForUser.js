/**
 * Force create invoice for a specific user
 * Usage: node scripts/forceCreateInvoiceForUser.js <orshinSuugchId> <baiguullagiinId>
 * 
 * Example:
 * node scripts/forceCreateInvoiceForUser.js 696f2c23c5bfe23f794b5df1 6912daa3f8749d82e718dae2
 */

// Change to project root directory
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);

// Load environment variables
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const { db } = require("zevbackv2");
const OrshinSuugch = require(path.join(projectRoot, "models", "orshinSuugch"));
const Geree = require(path.join(projectRoot, "models", "geree"));
const Baiguullaga = require(path.join(projectRoot, "models", "baiguullaga"));
const { gereeNeesNekhemjlekhUusgekh } = require(path.join(projectRoot, "controller", "nekhemjlekhController"));

/**
 * Normalize turul field: "тогтмол" -> "Тогтмол"
 */
function normalizeTurul(turul) {
  if (!turul || typeof turul !== 'string') {
    return turul;
  }
  // Normalize "тогтмол" (lowercase) to "Тогтмол" (uppercase first letter)
  if (turul.toLowerCase() === 'тогтмол') {
    return 'Тогтмол';
  }
  return turul;
}

/**
 * Remove duplicate zardluud entries based on ner, turul, zardliinTurul, and barilgiinId
 * Keeps only the first occurrence of each unique combination
 */
function deduplicateZardluud(zardluud) {
  if (!Array.isArray(zardluud)) {
    return zardluud;
  }
  
  const seen = new Set();
  const deduplicated = [];
  
  for (const zardal of zardluud) {
    if (!zardal || typeof zardal !== 'object') {
      continue;
    }
    
    // Create a unique key based on ner, turul, zardliinTurul, and barilgiinId
    const normalizedTurul = normalizeTurul(zardal.turul);
    const key = `${zardal.ner || ''}|${normalizedTurul || ''}|${zardal.zardliinTurul || ''}|${zardal.barilgiinId || ''}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(zardal);
    }
  }
  
  return deduplicated;
}

// Initialize database connection (same as index.js)
const app = express();
db.kholboltUusgey(
  app,
  process.env.MONGODB_URI ||
    "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

async function forceCreateInvoice(orshinSuugchId, baiguullagiinId) {
  try {
    // Wait a bit for database connection to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`🚀 Force creating invoice for orshinSuugch: ${orshinSuugchId}`);
    console.log(`📋 BaiguullagiinId: ${baiguullagiinId}`);

    // Find orshinSuugch
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(orshinSuugchId);
    if (!orshinSuugch) {
      throw new Error(`Оршин суугч олдсонгүй! ID: ${orshinSuugchId}`);
    }

    console.log(`✅ Found orshinSuugch: ${orshinSuugch.ner} (${orshinSuugch.utas})`);

    // Find the connection
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      throw new Error(`Холболтын мэдээлэл олдсонгүй! baiguullagiinId: ${baiguullagiinId}`);
    }

    // Find geree for this orshinSuugch
    const geree = await Geree(kholbolt)
      .findOne({
        orshinSuugchId: orshinSuugchId,
        baiguullagiinId: baiguullagiinId,
        tuluv: "Идэвхтэй", // Only active contracts
      })
      .sort({ createdAt: -1 }); // Get the most recent contract

    if (!geree) {
      throw new Error(`Идэвхтэй гэрээ олдсонгүй! orshinSuugchId: ${orshinSuugchId}`);
    }

    console.log(`✅ Found active geree: ${geree.gereeniiDugaar}`);

    // Get baiguullaga
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      throw new Error(`Байгууллага олдсонгүй! baiguullagiinId: ${baiguullagiinId}`);
    }

    console.log(`✅ Found baiguullaga: ${baiguullaga.ner}`);

    // CRITICAL: Convert geree to plain object, deduplicate zardluud, and set dun = tariff
    // This ensures all charges are included in the invoice total without duplicates
    const gereeObj = geree.toObject ? geree.toObject() : geree;
    if (gereeObj.zardluud && Array.isArray(gereeObj.zardluud)) {
      // First, normalize turul values
      gereeObj.zardluud = gereeObj.zardluud.map((zardal) => ({
        ...zardal,
        turul: normalizeTurul(zardal.turul)
      }));
      
      // Remove duplicates
      const beforeDedup = gereeObj.zardluud.length;
      gereeObj.zardluud = deduplicateZardluud(gereeObj.zardluud);
      const afterDedup = gereeObj.zardluud.length;
      if (beforeDedup !== afterDedup) {
        console.log(`✅ Removed ${beforeDedup - afterDedup} duplicate zardluud items`);
      }
      
      // Set dun = tariff for all zardluud items
      gereeObj.zardluud = gereeObj.zardluud.map((zardal) => {
        // For electricity charges (zaalt: true), keep dun as is (already calculated)
        if (zardal.zaalt === true) {
          return zardal;
        }
        // For regular charges, ALWAYS set dun = tariff
        return {
          ...zardal,
          dun: zardal.tariff || 0
        };
      });
      console.log(`✅ Fixed dun = tariff for ${gereeObj.zardluud.length} zardluud items`);
    }

    // Force create invoice - skipDuplicateCheck = true bypasses all duplicate checks
    console.log(`\n📝 Creating invoice (bypassing date restrictions)...`);
    const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
      gereeObj,
      baiguullaga,
      kholbolt,
      "garan",
      true // skipDuplicateCheck = true - FORCE CREATE
    );

    if (!invoiceResult.success) {
      throw new Error(invoiceResult.error || "Нэхэмжлэх үүсгэхэд алдаа гарлаа");
    }

    if (invoiceResult.alreadyExists) {
      console.log(`\n⚠️  Invoice already exists for this month:`);
      console.log(`   Invoice ID: ${invoiceResult.nekhemjlekh._id}`);
      console.log(`   Total Amount: ${invoiceResult.tulbur}`);
      console.log(`\n✅ Returning existing invoice`);
    } else {
      console.log(`\n✅ Invoice created successfully!`);
      console.log(`   Invoice ID: ${invoiceResult.nekhemjlekh._id}`);
      console.log(`   Contract: ${invoiceResult.gereeniiDugaar}`);
      console.log(`   Total Amount: ${invoiceResult.tulbur}`);
    }

    return {
      success: true,
      invoice: invoiceResult.nekhemjlekh,
      gereeniiId: invoiceResult.gereeniiId,
      gereeniiDugaar: invoiceResult.gereeniiDugaar,
      tulbur: invoiceResult.tulbur,
      alreadyExists: invoiceResult.alreadyExists || false,
    };
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

// Run script
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: node scripts/forceCreateInvoiceForUser.js <orshinSuugchId> <baiguullagiinId>");
    console.error("\nExample:");
    console.error("node scripts/forceCreateInvoiceForUser.js 696f2c23c5bfe23f794b5df1 6912daa3f8749d82e718dae2");
    process.exit(1);
  }

  const [orshinSuugchId, baiguullagiinId] = args;

  forceCreateInvoice(orshinSuugchId, baiguullagiinId)
    .then((result) => {
      console.log("\n✅ Script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error.message);
      process.exit(1);
    });
}

module.exports = { forceCreateInvoice };
