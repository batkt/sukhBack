const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const server = http.Server(app);
const io = require("socket.io")(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
});
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const baiguullagaRoute = require("./routes/baiguullagaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const orshinSuugchRoute = require("./routes/orshinSuugchRoute");
const licenseRoute = require("./routes/licenseRoute");
const nekhemjlekhiinZagvarRoute = require("./routes/nekhemjlekhiinZagvarRoute");
const gereeRoute = require("./routes/gereeRoute");
const gereeniiZagvarRoute = require("./routes/gereeniiZagvarRoute");
const nekhemjlekhRoute = require("./routes/nekhemjlekhRoute");

const { db } = require("zevbackv2");

const aldaaBarigch = require("./middleware/aldaaBarigch");
const nekhemjlekhiinZagvar = require("./models/nekhemjlekhiinZagvar");
const nekhemjlekhController = require("./controller/nekhemjlekhController");

process.setMaxListeners(0);
process.env.UV_THREADPOOL_SIZE = 20;

server.listen(8084);

process.env.TZ = "Asia/Ulaanbaatar";
app.set("socketio", io);
app.use(cors());
app.use(
  express.json({
    limit: "50mb",
    extended: true,
  })
);

db.kholboltUusgey(
  app,
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

app.use(
  express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 })
);

app.use((req, res, next) => {
  if (!req.body) {
    req.body = {};
  }
  next();
});

app.use(baiguullagaRoute);
app.use(ajiltanRoute);
app.use(licenseRoute);
app.use(orshinSuugchRoute);
app.use(gereeRoute);
app.use(gereeniiZagvarRoute);
app.use(nekhemjlekhiinZagvarRoute);
app.use(nekhemjlekhRoute);

app.use(aldaaBarigch);

// Auto create invoices function for cron
async function autoCreateInvoices() {
  try {
    const { db } = require("zevbackv2");
    const Baiguullaga = require("./models/baiguullaga");
    const Geree = require("./models/geree");
    
    console.log("=== AUTO CREATING INVOICES - CRON JOB STARTED ===");
    
    // Get all organizations
    const organizations = await Baiguullaga(db.erunkhiiKholbolt).find({});
    
    for (const org of organizations) {
      try {
        console.log(`Processing organization: ${org.ner} (${org._id})`);
        
        // Get all active contracts for this organization that don't have invoices yet
        const contracts = await Geree(org.kholbolt).find({
          baiguullagiinId: org._id.toString(),
          nekhemjlekhiinOgnoo: { $exists: false } // Only contracts without invoices
        });
        
        if (contracts.length === 0) {
          console.log(`No contracts to process for ${org.ner}`);
          continue;
        }
        
        console.log(`Found ${contracts.length} contracts to process for ${org.ner}`);
        
        for (const contract of contracts) {
          const result = await nekhemjlekhController.createInvoiceFromContract(contract, org, org.kholbolt, "cron_job");
          
          if (result.success) {
            console.log(`✅ Invoice created for contract ${result.contractNumber} - Amount: ${result.amount}₮`);
          } else {
            console.error(`❌ Error processing contract ${result.contractNumber}:`, result.error);
          }
        }
        
      } catch (orgError) {
        console.error(`❌ Error processing organization ${org.ner}:`, orgError.message);
      }
    }
    
    console.log("=== AUTO CREATING INVOICES - CRON JOB COMPLETED ===");
    
  } catch (error) {
    console.error("❌ CRITICAL ERROR in auto invoice creation:", error);
  }
}

// Schedule cron job to run every 5 minutes
cron.schedule(
  "*/5 * * * *",
  function () {
    autoCreateInvoices();
  },
  {
    scheduled: true,
    timezone: "Asia/Ulaanbaatar",
  }
);

console.log("🕐 Cron job scheduled: Auto invoice creation every 5 minutes");
