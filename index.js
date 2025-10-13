const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const app = express();
const server = http.Server(app);

const { db } = require("zevbackv2");
const io = require("socket.io")(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
});
const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const baiguullagaRoute = require("./routes/baiguullagaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const gereeRoute = require("./routes/gereeRoute");
const aldaaBarigch = require("./middleware/aldaaBarigch");

const PORT = process.env.PORT || 8084;

process.setMaxListeners(0);
process.env.UV_THREADPOOL_SIZE = 20;

app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

app.get("/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date(),
  });
});

app.get("/debug", (req, res) => {
  res.json({
    hasAppSecret: !!process.env.APP_SECRET,
    appSecretLength: process.env.APP_SECRET ? process.env.APP_SECRET.length : 0,
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
  });
});

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
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

app.use(ajiltanRoute);
app.use(baiguullagaRoute);
app.use(gereeRoute);

app.use(aldaaBarigch);

mongoose.connection.on("connected", async () => {
  console.log("✅ MongoDB connected:", process.env.BAAZ);
  
  // Create empty collections to initialize the amarSukhTest database
  try {
    const Baiguullaga = require("./models/baiguullaga");
    const Ajiltan = require("./models/ajiltan");
    const OrshinSuugch = require("./models/orshinSuugch");
    
    console.log("🌱 Creating amarSukhTest database structure...");
    
    // Create empty collections (this will create the database and collections)
    await Baiguullaga(db.erunkhiiKholbolt).createCollection();
    console.log("✅ Baiguullaga collection created");
    
    await Ajiltan(db.erunkhiiKholbolt).createCollection();
    console.log("✅ Ajiltan collection created");
    
    await OrshinSuugch(db.erunkhiiKholbolt).createCollection();
    console.log("✅ OrshinSuugch collection created");
    
    console.log("🎉 amarSukhTest database created with empty collections!");
    console.log("📊 Database structure ready for data");
  } catch (error) {
    console.error("❌ Error creating database structure:", error);
  }
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
