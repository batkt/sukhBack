/**
 * Force create invoice for a specific user
 * Usage: node scripts/forceCreateInvoiceForUser.js <orshinSuugchId> <baiguullagiinId>
 * 
 * Example:
 * node scripts/forceCreateInvoiceForUser.js 696f2c23c5bfe23f794b5df1 6912daa3f8749d82e718dae2
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { db } = require("zevbackv2");
const OrshinSuugch = require("../models/orshinSuugch");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const { gereeNeesNekhemjlekhUusgekh } = require("../controller/nekhemjlekhController");

async function forceCreateInvoice(orshinSuugchId, baiguullagiinId) {
  try {
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

    // Force create invoice - skipDuplicateCheck = true bypasses all duplicate checks
    console.log(`\n📝 Creating invoice (bypassing date restrictions)...`);
    const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
      geree,
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
