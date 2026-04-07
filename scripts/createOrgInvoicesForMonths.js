/**
 * Run nekhemjlekh (invoice) creation for selected calendar months, one organization.
 * Uses the same logic as manual mass send: active gerees only, optional --override
 * to remove existing invoices in each month window first.
 *
 * From repo root:
 *   node scripts/createOrgInvoicesForMonths.js
 *   node scripts/createOrgInvoicesForMonths.js --year=2026 --months=2,3
 *   node scripts/createOrgInvoicesForMonths.js --override
 *   node scripts/createOrgInvoicesForMonths.js --baiguullagiinId=OTHER_ID
 *
 * Requires tokhirgoo/tokhirgoo.env and MongoDB (same as the main app).
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
process.chdir(projectRoot);
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
process.env.TZ = process.env.TZ || "Asia/Ulaanbaatar";

const { db } = require("zevbackv2");
const { manualSendMassInvoices } = require("../services/invoiceSendService");

const DEFAULT_BAIGUULLAGIIN_ID = "697723dc3e77b46e52ccf577";

function parseArgs(argv) {
  const out = {
    baiguullagiinId: DEFAULT_BAIGUULLAGIIN_ID,
    year: new Date().getFullYear(),
    months: [2, 3],
    override: false,
    barilgiinId: null,
    waitMs: 4000,
  };

  for (const arg of argv) {
    if (arg === "--override") out.override = true;
    else if (arg.startsWith("--baiguullagiinId="))
      out.baiguullagiinId = arg.slice("--baiguullagiinId=".length).trim();
    else if (arg.startsWith("--year="))
      out.year = parseInt(arg.slice("--year=".length), 10);
    else if (arg.startsWith("--months=")) {
      out.months = arg
        .slice("--months=".length)
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 12);
    } else if (arg.startsWith("--barilgiinId="))
      out.barilgiinId = arg.slice("--barilgiinId=".length).trim() || null;
    else if (arg.startsWith("--waitMs="))
      out.waitMs = parseInt(arg.slice("--waitMs=".length), 10) || 4000;
  }

  if (!out.months.length) {
    out.months = [2, 3];
  }
  if (Number.isNaN(out.year)) {
    out.year = new Date().getFullYear();
  }
  return out;
}

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log("createOrgInvoicesForMonths");
  console.log("  baiguullagiinId:", opts.baiguullagiinId);
  console.log("  year:", opts.year);
  console.log(
    "  months:",
    opts.months.map((m) => `${m} (${MONTH_NAMES[m]})`).join(", "),
  );
  console.log("  override:", opts.override);
  if (opts.barilgiinId) console.log("  barilgiinId:", opts.barilgiinId);
  console.log("");

  const app = express();
  db.kholboltUusgey(
    app,
    process.env.MONGODB_URI ||
      "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin",
  );

  console.log(`Waiting ${opts.waitMs}ms for DB connections...`);
  await new Promise((r) => setTimeout(r, opts.waitMs));

  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("No tenant connections (db.kholboltuud). Check MONGODB_URI.");
    process.exit(1);
  }

  const summary = [];

  for (const month of opts.months) {
    const label = `${MONTH_NAMES[month]} ${opts.year}`;
    console.log(`\n---------- ${label} (month=${month}) ----------`);
    const result = await manualSendMassInvoices(
      opts.baiguullagiinId,
      opts.barilgiinId,
      opts.override,
      month,
      opts.year,
      null,
    );

    summary.push({ month, year: opts.year, result });

    if (!result.success) {
      console.error("Batch failed:", result.error);
      continue;
    }

    console.log(
      `Total gerees: ${result.total}, reported success count: ${result.created}, errors: ${result.errors}`,
    );
    if (result.errorsList && result.errorsList.length) {
      console.log("Errors (first 20):");
      console.log(JSON.stringify(result.errorsList.slice(0, 20), null, 2));
    }
  }

  console.log("\n========== Done ==========");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
