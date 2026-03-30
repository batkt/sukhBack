const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
const { db } = require("zevbackv2");
const { QuickQpayObject } = require("quickqpaypackvSukh");
const BankniiGuilgee = require("./models/bankniiGuilgee");
const nekhemjlekhiinTuukh = require("./models/nekhemjlekhiinTuukh");
const Baiguullaga = require("./models/baiguullaga");
const EbarimtShineModel = require("./models/ebarimtShine");
const { nekhemjlekheesEbarimtShineUusgye, ebarimtDuudya } = require("./routes/ebarimtRoute");

async function fix() {
  const baiguullagiinId = "697c70e81e782d8110d3b064";
  const invoiceId = "69be54b1125cb96e42a4bc27";
  const qpayInvoiceId = "5bdffc26-4e28-440e-94f4-9e763fcd635f";
  const amount = 119889.2;

  console.log("Initializing DB connection...");
  db.kholboltUusgey(
    { use: () => {} }, // mock app
    process.env.MONGODB_URI || "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
  );

  // Wait for DB to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  if (!db.kholboltuud || db.kholboltuud.length === 0) {
    console.error("DB connections not initialized yet. Make sure you run this within the environment where zevbackv2 is initialized.");
    process.exit(1);
  }

  const kholbolt = db.kholboltuud.find(a => String(a.baiguullagiinId) === baiguullagiinId);
  if (!kholbolt) throw new Error("Connection not found for organization " + baiguullagiinId);

  // 1. Update QPay Object
  console.log("Updating QPay object to PAID...");
  await QuickQpayObject(kholbolt).findOneAndUpdate(
    { invoice_id: qpayInvoiceId },
    { tulsunEsekh: true }
  );

  // 2. Fix Bank Record
  console.log("Updating Bank Record amount...");
  await BankniiGuilgee(kholbolt).findOneAndUpdate(
    { tranId: qpayInvoiceId },
    { amount: amount, kholbosonDun: amount }
  );

  // 3. Generate E-Barimt
  console.log("Fetching invoice and building config...");
  const invoice = await nekhemjlekhiinTuukh(kholbolt).findById(invoiceId);
  if (!invoice) throw new Error("Invoice not found: " + invoiceId);
  
  const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
  if (!baiguullaga) throw new Error("Baiguullaga not found: " + baiguullagiinId);
  
  const bldg = baiguullaga.barilguud.find(b => String(b._id) === String(invoice.barilgiinId));
  if (!bldg || !bldg.tokhirgoo) throw new Error("Building config not found");
  
  const tokhirgoo = bldg.tokhirgoo;

  // Temporarily override amount for ebarimt helper logic
  invoice.niitTulbur = amount; 

  console.log("Calling E-Barimt Service...");
  const ebarimtData = await nekhemjlekheesEbarimtShineUusgye(
    invoice,
    "", // customerNo
    "", // customerTin
    tokhirgoo.merchantTin,
    tokhirgoo.districtCode,
    kholbolt,
    !!tokhirgoo.nuatTulukhEsekh
  );

  ebarimtDuudya(ebarimtData, async (d) => {
    if (d?.status === "SUCCESS" || d?.success) {
        console.log("✅ Ebarimt API success:", d.id);
        const shineBarimt = new EbarimtShineModel(kholbolt)(d);
        shineBarimt.nekhemjlekhiinId = invoiceId;
        shineBarimt.baiguullagiinId = baiguullagiinId;
        shineBarimt.barilgiinId = invoice.barilgiinId;
        shineBarimt.gereeniiDugaar = invoice.gereeniiDugaar;
        if (d.qrData) shineBarimt.qrData = d.qrData;
        if (d.lottery) shineBarimt.lottery = d.lottery;
        if (d.id) shineBarimt.receiptId = d.id;
        if (d.date) shineBarimt.date = d.date;

        await shineBarimt.save();
        console.log("✅ Saved to database. DONE!");
        process.exit(0);
    } else {
        console.error("❌ Ebarimt API failed check:", JSON.stringify(d));
        process.exit(1);
    }
  }, (err) => {
    console.error("❌ Ebarimt Error callback:", err.message);
    process.exit(1);
  }, true, baiguullagiinId);
}

// In some environments, we might need to trigger DB connection first
// But zevbackv2 usually does this automatically on require if config is present.
fix().catch(err => {
  console.error("CRITICAL ERROR:", err.message);
  process.exit(1);
});
