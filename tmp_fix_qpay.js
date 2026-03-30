const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
const { db } = require("zevbackv2");
const { QuickQpayObject } = require("quickqpaypackvSukh");
const BankniiGuilgee = require("./models/bankniiGuilgee");
const nekhemjlekhiinTuukh = require("./models/nekhemjlekhiinTuukh");
const BaiguullagaModel = require("./models/baiguullaga");
const EbarimtShineModel = require("./models/ebarimtShine");
const { nekhemjlekheesEbarimtShineUusgye, ebarimtDuudya } = require("./routes/ebarimtRoute");
const mongoose = require("mongoose");

async function fix() {
  const baiguullagiinId = "697c70e81e782d8110d3b064";
  const invoiceId = "69be54b1125cb96e42a4bc27";
  const qpayInvoiceId = "5bdffc26-4e28-440e-94f4-9e763fcd635f";
  const amount = 119889.2;
  const mongoUriBase = "mongodb://admin:Br1stelback1@127.0.0.1:27017/";

  console.log("Connecting to Databases...");
  const primaryConn = mongoose.createConnection(`${mongoUriBase}amarSukh?authSource=admin`);
  const tenantConn = mongoose.createConnection(`${mongoUriBase}nairamdalSukh?authSource=admin`);

  await Promise.all([
    new Promise(r => primaryConn.on('open', r)),
    new Promise(r => tenantConn.on('open', r))
  ]);

  console.log("✅ Databases Connected.");
  
  db.erunkhiiKholbolt = { kholbolt: primaryConn };
  const kholbolt = { kholbolt: tenantConn, baiguullagiinId: baiguullagiinId };

  // 1. Update QPay Object
  console.log("Updating QPay object to PAID...");
  const qpayUpdate = await QuickQpayObject(kholbolt).findOneAndUpdate(
    { invoice_id: qpayInvoiceId },
    { tulsunEsekh: true },
    { new: true }
  );
  console.log("Qpay updated:", !!qpayUpdate);

  // 2. Fix Bank Record
  console.log("Updating Bank Record amount...");
  const bankUpdate = await BankniiGuilgee(kholbolt).findOneAndUpdate(
    { tranId: qpayInvoiceId },
    { amount: amount, kholbosonDun: amount },
    { new: true }
  );
  console.log("Bank record updated:", !!bankUpdate);

  // 3. Generate E-Barimt
  const invoice = await nekhemjlekhiinTuukh(kholbolt).findById(invoiceId);
  const Baiguullaga = BaiguullagaModel({ kholbolt: primaryConn });
  const org = await Baiguullaga.findById(baiguullagiinId);
  const bldg = org.barilguud.find(b => String(b._id) === String(invoice.barilgiinId));
  const tokhirgoo = bldg.tokhirgoo;

  invoice.niitTulbur = amount; 
  const finalDistrictCode = "2204"; // BZD
  
  console.log(`Calling E-Barimt Service (District code: ${finalDistrictCode})...`);
  const ebarimtData = await nekhemjlekheesEbarimtShineUusgye(
    invoice,
    "", // customerNo
    "", // customerTin
    tokhirgoo.merchantTin,
    finalDistrictCode,
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
        console.log("✅ Saved to database. ALL DONE!");
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

fix().catch(err => {
  console.error("CRITICAL ERROR:", err.message);
  process.exit(1);
});
