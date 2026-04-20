/**
 * Test: Create March 2026 invoice for ГД-71811549 (Үүрцайх)
 * Based on dotoodOrgInvoiceMonths.js connection pattern.
 *
 *   node scripts/testMarchInvoice.js
 *   node scripts/testMarchInvoice.js --skip-db-name-check
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const BAIGUULLAGIIN_ID = "697c70e81e782d8110d3b064";
const CONTRACT_NUM = "ГД-71811549";
const TENANT_DATABASE_NAME = "nairamdalSukh";

const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
process.env.TZ = process.env.TZ || "Asia/Ulaanbaatar";
process.setMaxListeners(0);

const { db } = require("zevbackv2");
const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");
const Geree = require("../models/geree");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Baiguullaga = require("../models/baiguullaga");
const { manualSendInvoice } = require("../services/invoiceSendService");

const skipDbCheck = process.argv.includes("--skip-db-name-check");

async function main() {
  console.log("testMarchInvoice — ГД-71811549 (Үүрцайх)");
  console.log("  org:", BAIGUULLAGIIN_ID);
  console.log("  target: March 2026\n");

  const app = express();
  db.kholboltUusgey(
    app,
    process.env.MONGODB_URI ||
      "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin",
  );

  console.log("Waiting 5s for DB connections...");
  await new Promise((r) => setTimeout(r, 5000));

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("No tenant connections. Check MONGODB_URI.");
    process.exit(1);
  }
  console.log(`✅ ${db.kholboltuud.length} kholbolt(s) ready\n`);

  const kholboltEntry = getKholboltByBaiguullagiinId(BAIGUULLAGIIN_ID);
  if (!kholboltEntry) {
    console.error("No kholbolt for org:", BAIGUULLAGIIN_ID);
    console.log("Available:");
    db.kholboltuud.forEach((k) =>
      console.log("  ", k.baiguullagiinId, k.baaziinNer || "")
    );
    process.exit(1);
  }

  const tenantDbName =
    kholboltEntry.kholbolt?.db?.databaseName ?? "(unknown)";
  console.log("Tenant DB:", tenantDbName);

  if (!skipDbCheck && tenantDbName !== TENANT_DATABASE_NAME) {
    console.error(`❌ DB mismatch: got "${tenantDbName}", expected "${TENANT_DATABASE_NAME}"`);
    console.error("   Use --skip-db-name-check to override");
    process.exit(1);
  }

  // ── Find contract ──
  const targetGeree = await Geree(kholboltEntry)
    .findOne({ gereeniiDugaar: CONTRACT_NUM })
    .lean();

  if (!targetGeree) {
    console.error("❌ Contract " + CONTRACT_NUM + " not found!");
    const sample = await Geree(kholboltEntry).find({}).limit(5).select("gereeniiDugaar ner").lean();
    console.log("Sample:", sample.map((g) => g.gereeniiDugaar + " " + g.ner));
    process.exit(1);
  }

  console.log("\n📋 CONTRACT:");
  console.log(`   ${targetGeree.gereeniiDugaar} | ${targetGeree.ner} | toot: ${targetGeree.toot}`);
  console.log(`   ekhniiUldegdel: ${targetGeree.ekhniiUldegdel || 0}₮ | globalUldegdel: ${targetGeree.globalUldegdel || 0}₮\n`);

  // ── Show ALL invoices ──
  const allInvoices = await nekhemjlekhiinTuukh(kholboltEntry)
    .find({ gereeniiId: String(targetGeree._id) })
    .sort({ ognoo: 1, createdAt: 1 })
    .lean();

  console.log(`📄 ALL INVOICES: ${allInvoices.length}`);
  console.log("─".repeat(80));

  for (const inv of allInvoices) {
    const zardluud = (inv.medeelel && inv.medeelel.zardluud) || [];
    const ekhniiRow = zardluud.find(
      (z) => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
    );
    const ognoo = inv.ognoo
      ? new Date(inv.ognoo).toISOString().slice(0, 10)
      : "no-date";

    console.log(
      `  ${inv.nekhemjlekhiinDugaar || "N/A"} | ${ognoo} | niitTulbur: ${inv.niitTulbur}₮ | ekhnii(field): ${inv.ekhniiUldegdel || 0}₮`
    );
    if (ekhniiRow) {
      console.log(`    ⬅️  EKHNII ROW: dun=${ekhniiRow.dun}, tariff=${ekhniiRow.tariff}`);
    }
    console.log(
      `    Zardluud: ${zardluud.map((z) => z.ner + "(" + (z.dun || z.tariff || 0) + ")").join(" | ")}`
    );
  }
  console.log("─".repeat(80));

  // ── Guard counter ──
  const ekhniiCount = await nekhemjlekhiinTuukh(kholboltEntry).countDocuments({
    gereeniiId: String(targetGeree._id),
    $or: [
      { ekhniiUldegdel: { $exists: true, $gt: 0 } },
      { "medeelel.zardluud": { $elemMatch: { isEkhniiUldegdel: true } } },
      { "medeelel.zardluud": { $elemMatch: { ner: "Эхний үлдэгдэл" } } },
    ],
  });
  console.log(`\n🔢 Guard counter (invoices with ekhnii): ${ekhniiCount}\n`);

  // ── Delete March 2026 invoices ──
  const marchStart = new Date(2026, 2, 1, 0, 0, 0, 0);
  const marchEnd = new Date(2026, 2, 31, 23, 59, 59, 999);

  const marchInvoices = await nekhemjlekhiinTuukh(kholboltEntry)
    .find({
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
    })
    .lean();

  if (marchInvoices.length > 0) {
    console.log(`🗑️  Deleting ${marchInvoices.length} existing March invoice(s)...`);
    for (const inv of marchInvoices) {
      await nekhemjlekhiinTuukh(kholboltEntry).deleteOne({ _id: inv._id });
      console.log(`   Deleted: ${inv.nekhemjlekhiinDugaar || inv._id}`);
    }
    console.log();
  }

  // ── Create March invoice ──
  console.log("═".repeat(60));
  console.log("📝 CREATING March 2026 invoice...");
  console.log("═".repeat(60));

  const result = await manualSendInvoice(
    String(targetGeree._id),
    BAIGUULLAGIIN_ID,
    true, // override
    3, // March
    2026,
    null,
  );

  console.log(`\n   success: ${result.success}`);
  console.log(`   tulbur:  ${result.tulbur}₮`);
  console.log(`   error:   ${result.error || "none"}`);

  if (result.success && result.nekhemjlekh) {
    const inv =
      typeof result.nekhemjlekh.toObject === "function"
        ? result.nekhemjlekh.toObject()
        : result.nekhemjlekh;
    const zardluud = (inv.medeelel && inv.medeelel.zardluud) || [];

    console.log(`\n📊 NEW INVOICE: ${inv.nekhemjlekhiinDugaar}`);
    console.log(
      `   niitTulbur: ${inv.niitTulbur}₮ | niitTulburOriginal: ${inv.niitTulburOriginal}₮`
    );
    console.log(`\n📋 ZARDLUUD:`);
    zardluud.forEach((z, i) => {
      const flag =
        z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
          ? " ⬅️ EKHNII"
          : "";
      console.log(`   ${i + 1}. ${z.ner} | dun: ${z.dun || 0}₮${flag}`);
    });

    const hasEkhnii = zardluud.some(
      (z) => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
    );
    const ekhniiDun =
      (
        zardluud.find(
          (z) => z.isEkhniiUldegdel || z.ner === "Эхний үлдэгдэл"
        ) || {}
      ).dun || 0;

    console.log("\n" + "═".repeat(60));
    if (hasEkhnii && ekhniiDun > 0) {
      console.log(`⚠️  EKHNII ROW PRESENT: ${ekhniiDun}₮`);
      console.log(
        ekhniiCount > 0
          ? "❌ BUG: Other invoices already had ekhnii!"
          : "✅ First invoice with ekhnii — correct"
      );
    } else {
      console.log("✅ NO ekhnii row — clean invoice");
    }
    console.log("═".repeat(60));
  }

  console.log("\n✅ Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
