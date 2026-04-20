/**
 * Test script: Create March 2026 invoice for ONE specific contract
 * 
 * Target:
 *   DB: nairamdalSukh
 *   Resident: Үүрцайх (toot 35, utas 99096051)
 *   Contract: ГД-71811549
 * 
 * Usage:
 *   1. Make sure MongoDB is running (mongod service)
 *   2. Run: node scripts/testMarchInvoice.js
 * 
 * This will:
 *   1. Connect via the app's bootstrap (zevbackv2)
 *   2. Find the specific contract ГД-71811549
 *   3. Show existing invoices with ekhniiUldegdel info
 *   4. Delete March 2026 invoices for that contract (clean test)
 *   5. Create a fresh March invoice
 *   6. Print the result to verify ekhniiUldegdel behavior
 */

// Bootstrap the full app DB connections (same as index.js does)
process.env.NODE_ENV = process.env.NODE_ENV || "development";
require("dotenv").config({ path: require("path").join(__dirname, "../tokhirgoo/tokhirgoo.env") });

const mongoose = require("mongoose");
const path = require("path");

async function main() {
  // ── 1. Connect to MongoDB ──
  const mongoUri = process.env.MONGODB_URI || "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin";
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   URI: ${mongoUri.replace(/:[^:@]+@/, ':***@')}\n`);
  
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to main MongoDB\n");

  // ── 2. Bootstrap zevbackv2 DB connections ──
  const { db } = require("zevbackv2");
  
  // Wait for kholboltuud to initialize
  let retries = 0;
  while ((!db.kholboltuud || db.kholboltuud.length === 0) && retries < 10) {
    await new Promise((r) => setTimeout(r, 1000));
    retries++;
    console.log(`   Waiting for DB connections... (${retries}s)`);
  }

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.log("❌ No kholboltuud found. DB connections didn't initialize.");
    console.log("   Make sure MongoDB is running: net start MongoDB");
    process.exit(1);
  }

  console.log(`✅ Found ${db.kholboltuud.length} kholbolt(s)\n`);

  // ── 3. Find the specific contract ──
  const Geree = require("../models/geree");
  const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
  const Baiguullaga = require("../models/baiguullaga");
  const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");

  const ORG_ID = "697c70e81e782d8110d3b064";
  const CONTRACT_NUM = "ГД-71811549";

  const kholbolt = getKholboltByBaiguullagiinId(ORG_ID);
  if (!kholbolt) {
    console.log("❌ kholbolt not found for org " + ORG_ID);
    process.exit(1);
  }

  const targetOrg = await Baiguullaga(db.erunkhiiKholbolt).findById(ORG_ID).lean();
  const targetGeree = await Geree(kholbolt).findOne({ gereeniiDugaar: CONTRACT_NUM }).lean();

  if (!targetGeree) {
    console.log("❌ Contract " + CONTRACT_NUM + " not found!");
    process.exit(1);
  }

  console.log("\n📋 Contract Details:");
  console.log(`   Org:            ${targetOrg?.ner || "N/A"} (${targetOrg?._id})`);
  console.log(`   Contract:       ${targetGeree.gereeniiDugaar} (${targetGeree._id})`);
  console.log(`   Resident:       ${targetGeree.ner} ${targetGeree.ovog || ""}`);
  console.log(`   Toot:           ${targetGeree.toot || "N/A"}`);
  console.log(`   OrshinSuugchId: ${targetGeree.orshinSuugchId || "N/A"}`);
  console.log(`   ekhniiUldegdel: ${targetGeree.ekhniiUldegdel || 0}₮`);
  console.log(`   globalUldegdel: ${targetGeree.globalUldegdel || 0}₮`);
  console.log(`   tuluv:          ${targetGeree.tuluv}`);
  console.log();

  // ── 4. Show ALL invoices for this contract ──
  const allInvoices = await nekhemjlekhiinTuukh(kholbolt).find({
    gereeniiId: String(targetGeree._id),
  }).sort({ ognoo: 1, createdAt: 1 }).lean();

  console.log(`📄 ALL invoices for this contract: ${allInvoices.length}`);
  console.log("─".repeat(90));
  
  for (const inv of allInvoices) {
    const zardluud = inv.medeelel?.zardluud || [];
    const ekhniiRow = zardluud.find(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл");
    const ognoo = inv.ognoo ? new Date(inv.ognoo).toISOString().slice(0, 10) : "no-date";
    
    console.log(`   ${inv.nekhemjlekhiinDugaar || "N/A"} | ${ognoo} | niitTulbur: ${inv.niitTulbur}₮ | original: ${inv.niitTulburOriginal || "N/A"}₮ | ekhnii field: ${inv.ekhniiUldegdel || 0}₮`);
    
    if (ekhniiRow) {
      console.log(`      ⬅️  HAS EKHNII ROW: dun=${ekhniiRow.dun}, tariff=${ekhniiRow.tariff}`);
    }
    
    // Show all zardluud names
    if (zardluud.length > 0) {
      console.log(`      Zardluud: ${zardluud.map(z => `${z.ner}(${z.dun || z.tariff || 0})`).join(" | ")}`);
    }
  }
  console.log("─".repeat(90));
  console.log();

  // ── 5. Count existing invoices with ekhniiUldegdel ──
  const ekhniiCount = await nekhemjlekhiinTuukh(kholbolt).countDocuments({
    gereeniiId: String(targetGeree._id),
    $or: [
      { ekhniiUldegdel: { $exists: true, $gt: 0 } },
      { "medeelel.zardluud": { $elemMatch: { isEkhniiUldegdel: true } } },
      { "medeelel.zardluud": { $elemMatch: { ner: "Эхний үлдэгдэл" } } },
    ],
  });
  console.log(`🔢 Invoices with ekhniiUldegdel (guard counter): ${ekhniiCount}\n`);

  // ── 6. Find & delete existing March 2026 invoices ──
  const marchStart = new Date(2026, 2, 1, 0, 0, 0, 0);
  const marchEnd = new Date(2026, 2, 31, 23, 59, 59, 999);

  const existingMarchInvoices = await nekhemjlekhiinTuukh(kholbolt).find({
    gereeniiId: String(targetGeree._id),
    $or: [
      { ognoo: { $gte: marchStart, $lte: marchEnd } },
      {
        $and: [
          { $or: [{ ognoo: { $exists: false } }, { ognoo: null }] },
          { createdAt: { $gte: marchStart, $lte: marchEnd } },
        ],
      },
    ],
  }).lean();

  console.log(`📅 Existing March 2026 invoices: ${existingMarchInvoices.length}`);
  
  if (existingMarchInvoices.length > 0) {
    console.log("🗑️  Deleting existing March invoices for clean test...");
    for (const inv of existingMarchInvoices) {
      console.log(`   Deleting: ${inv.nekhemjlekhiinDugaar || inv._id}`);
      await nekhemjlekhiinTuukh(kholbolt).deleteOne({ _id: inv._id });
    }
    console.log(`   ✅ Deleted ${existingMarchInvoices.length} invoice(s)\n`);
  }

  // ── 7. Create March invoice ──
  console.log("═".repeat(60));
  console.log("📝 Creating March 2026 invoice via manualSendInvoice...");
  console.log("═".repeat(60));
  console.log();

  const { manualSendInvoice } = require("../services/invoiceSendService");
  
  const result = await manualSendInvoice(
    String(targetGeree._id),    // gereeId
    String(targetOrg._id),      // baiguullagiinId
    true,                        // override = true (force fresh)
    3,                           // targetMonth = March
    2026,                        // targetYear
    null,                        // app (no socket needed)
  );

  console.log("📦 Result:");
  console.log(`   success:       ${result.success}`);
  console.log(`   tulbur:        ${result.tulbur}₮`);
  console.log(`   alreadyExists: ${result.alreadyExists || false}`);
  console.log(`   updated:       ${result.updated || false}`);
  console.log(`   skipped:       ${result.skipped || false}`);
  console.log(`   error:         ${result.error || "none"}`);
  console.log();

  if (result.success && result.nekhemjlekh) {
    const inv = typeof result.nekhemjlekh.toObject === "function" 
      ? result.nekhemjlekh.toObject() 
      : result.nekhemjlekh;
    
    const zardluud = inv.medeelel?.zardluud || [];
    
    console.log("📊 New Invoice:");
    console.log(`   Dugaar:             ${inv.nekhemjlekhiinDugaar}`);
    console.log(`   niitTulbur:         ${inv.niitTulbur}₮`);
    console.log(`   niitTulburOriginal: ${inv.niitTulburOriginal}₮`);
    console.log(`   ekhniiUldegdel:     ${inv.ekhniiUldegdel || 0}₮`);
    console.log(`   uldegdel:           ${inv.uldegdel}₮`);
    console.log(`   tuluv:              ${inv.tuluv}`);
    console.log();

    console.log("📋 Zardluud (line items):");
    zardluud.forEach((z, i) => {
      const isEkhnii = z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл";
      console.log(`   ${i + 1}. ${z.ner} | dun: ${z.dun || 0}₮ | tariff: ${z.tariff || 0}₮${isEkhnii ? " ⬅️  ЭХНИЙ ҮЛДЭГДЭЛ" : ""}`);
    });

    const hasEkhniiRow = zardluud.some(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл");
    const ekhniiRowDun = zardluud.find(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл")?.dun || 0;

    console.log();
    console.log("═".repeat(60));
    console.log("VERDICT:");
    if (hasEkhniiRow && ekhniiRowDun > 0) {
      console.log(`  ⚠️  ekhniiUldegdel ROW present: ${ekhniiRowDun}₮`);
      const newEkhniiCount = await nekhemjlekhiinTuukh(kholbolt).countDocuments({
        gereeniiId: String(targetGeree._id),
        $or: [
          { ekhniiUldegdel: { $exists: true, $gt: 0 } },
          { "medeelel.zardluud": { $elemMatch: { isEkhniiUldegdel: true } } },
          { "medeelel.zardluud": { $elemMatch: { ner: "Эхний үлдэгдэл" } } },
        ],
      });
      console.log(`  Total invoices with ekhnii now: ${newEkhniiCount}`);
      if (newEkhniiCount > 1) {
        console.log("  ❌ BUG: Multiple invoices have ekhniiUldegdel!");
      } else {
        console.log("  ✅ Only 1 invoice has ekhnii — correct");
      }
    } else if (hasEkhniiRow && ekhniiRowDun === 0) {
      console.log("  ⚠️  ekhniiUldegdel row exists but dun=0 (stale display row)");
    } else {
      console.log("  ✅ No ekhniiUldegdel row in this invoice");
      if (ekhniiCount > 0) {
        console.log(`  (Correct: guard found ${ekhniiCount} other invoice(s) already have it)`);
      }
    }
    console.log("═".repeat(60));
  }

  console.log("\n✅ Done!");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Fatal error:", err.message || err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
