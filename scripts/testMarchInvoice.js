/**
 * Test: Create March 2026 invoice for ГД-71811549 (Үүрцайх)
 * 
 * Usage:  node scripts/testMarchInvoice.js
 */

const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const ORG_ID = "697c70e81e782d8110d3b064";
const CONTRACT_NUM = "ГД-71811549";

async function main() {
  // ── 1. Bootstrap DB exactly like index.js ──
  const { db } = require("zevbackv2");
  const MONGODB_URI = process.env.MONGODB_URI;
  console.log("🔌 Bootstrapping DB connections...");
  db.kholboltUusgey(app, MONGODB_URI);

  // Wait for kholboltuud to populate
  let retries = 0;
  while ((!db.kholboltuud || db.kholboltuud.length === 0) && retries < 20) {
    await new Promise((r) => setTimeout(r, 1000));
    retries++;
  }

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.log("❌ kholboltuud empty after 20s. Check MongoDB.");
    process.exit(1);
  }
  console.log(`✅ ${db.kholboltuud.length} kholbolt(s) ready\n`);

  // ── 2. Find the target ──
  const Geree = require("../models/geree");
  const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
  const Baiguullaga = require("../models/baiguullaga");
  const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");

  const kholbolt = db.kholboltuud[0];
  console.log("Using kholbolt:", kholbolt.baaziinNer || "default");

  const targetOrg = await Baiguullaga(db.erunkhiiKholbolt).findById(ORG_ID).lean();
  const targetGeree = await Geree(kholbolt).findOne({ gereeniiDugaar: CONTRACT_NUM }).lean();

  if (!targetGeree) {
    console.log("❌ Contract " + CONTRACT_NUM + " not found!");
    const sample = await Geree(kholbolt).find({}).limit(5).select("gereeniiDugaar ner toot").lean();
    console.log("Sample contracts:", sample.map(g => g.gereeniiDugaar + " - " + g.ner));
    process.exit(1);
  }

  console.log("📋 CONTRACT:");
  console.log(`   ${targetGeree.gereeniiDugaar} | ${targetGeree.ner} | toot: ${targetGeree.toot}`);
  console.log(`   ekhniiUldegdel: ${targetGeree.ekhniiUldegdel || 0}₮ | globalUldegdel: ${targetGeree.globalUldegdel || 0}₮`);
  console.log();

  // ── 3. Show ALL invoices ──
  const allInvoices = await nekhemjlekhiinTuukh(kholbolt).find({
    gereeniiId: String(targetGeree._id),
  }).sort({ ognoo: 1, createdAt: 1 }).lean();

  console.log(`📄 ALL INVOICES: ${allInvoices.length}`);
  console.log("─".repeat(80));

  for (const inv of allInvoices) {
    const zardluud = (inv.medeelel && inv.medeelel.zardluud) || [];
    const ekhniiRow = zardluud.find(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл");
    const ognoo = inv.ognoo ? new Date(inv.ognoo).toISOString().slice(0, 10) : "no-date";

    console.log(`  ${inv.nekhemjlekhiinDugaar || "N/A"} | ${ognoo} | niitTulbur: ${inv.niitTulbur}₮ | ekhnii(field): ${inv.ekhniiUldegdel || 0}₮`);
    if (ekhniiRow) {
      console.log(`    ⬅️  EKHNII ROW: dun=${ekhniiRow.dun}, tariff=${ekhniiRow.tariff}`);
    }
    console.log(`    Zardluud: ${zardluud.map(z => z.ner + "(" + (z.dun || z.tariff || 0) + ")").join(" | ")}`);
  }
  console.log("─".repeat(80));
  console.log();

  // ── 4. Count existing invoices with ekhnii ──
  const ekhniiCount = await nekhemjlekhiinTuukh(kholbolt).countDocuments({
    gereeniiId: String(targetGeree._id),
    $or: [
      { ekhniiUldegdel: { $exists: true, $gt: 0 } },
      { "medeelel.zardluud": { $elemMatch: { isEkhniiUldegdel: true } } },
      { "medeelel.zardluud": { $elemMatch: { ner: "Эхний үлдэгдэл" } } },
    ],
  });
  console.log(`🔢 Guard counter (invoices with ekhnii): ${ekhniiCount}\n`);

  // ── 5. Delete March 2026 invoices ──
  const marchStart = new Date(2026, 2, 1, 0, 0, 0, 0);
  const marchEnd = new Date(2026, 2, 31, 23, 59, 59, 999);

  const marchInvoices = await nekhemjlekhiinTuukh(kholbolt).find({
    gereeniiId: String(targetGeree._id),
    $or: [
      { ognoo: { $gte: marchStart, $lte: marchEnd } },
      { $and: [{ $or: [{ ognoo: { $exists: false } }, { ognoo: null }] }, { createdAt: { $gte: marchStart, $lte: marchEnd } }] },
    ],
  }).lean();

  if (marchInvoices.length > 0) {
    console.log(`🗑️  Deleting ${marchInvoices.length} existing March invoice(s)...`);
    for (const inv of marchInvoices) {
      await nekhemjlekhiinTuukh(kholbolt).deleteOne({ _id: inv._id });
      console.log(`   Deleted: ${inv.nekhemjlekhiinDugaar || inv._id}`);
    }
    console.log();
  }

  // ── 6. Create March invoice ──
  console.log("═".repeat(60));
  console.log("📝 CREATING March 2026 invoice...");
  console.log("═".repeat(60));

  const { manualSendInvoice } = require("../services/invoiceSendService");

  const result = await manualSendInvoice(
    String(targetGeree._id),
    String(ORG_ID),
    true,   // override
    3,      // March
    2026,
    null,
  );

  console.log(`\n   success: ${result.success}`);
  console.log(`   tulbur:  ${result.tulbur}₮`);
  console.log(`   error:   ${result.error || "none"}`);

  if (result.success && result.nekhemjlekh) {
    const inv = typeof result.nekhemjlekh.toObject === "function"
      ? result.nekhemjlekh.toObject() : result.nekhemjlekh;
    const zardluud = (inv.medeelel && inv.medeelel.zardluud) || [];

    console.log(`\n📊 NEW INVOICE: ${inv.nekhemjlekhiinDugaar}`);
    console.log(`   niitTulbur: ${inv.niitTulbur}₮ | niitTulburOriginal: ${inv.niitTulburOriginal}₮`);
    console.log(`\n📋 ZARDLUUD:`);
    zardluud.forEach((z, i) => {
      const flag = (z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл") ? " ⬅️ EKHNII" : "";
      console.log(`   ${i + 1}. ${z.ner} | dun: ${z.dun || 0}₮${flag}`);
    });

    const hasEkhnii = zardluud.some(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл");
    const ekhniiDun = (zardluud.find(z => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл") || {}).dun || 0;

    console.log("\n" + "═".repeat(60));
    if (hasEkhnii && ekhniiDun > 0) {
      console.log(`⚠️  EKHNII ROW PRESENT: ${ekhniiDun}₮`);
      console.log(ekhniiCount > 0
        ? "❌ BUG: Other invoices already had ekhnii!"
        : "✅ First invoice with ekhnii — correct");
    } else {
      console.log("✅ NO ekhnii row — clean invoice");
    }
    console.log("═".repeat(60));
  }

  console.log("\n✅ Done!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
