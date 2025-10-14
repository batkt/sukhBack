// Load environment variables first
const dotenv = require("dotenv");
const path = require("path");
const result = dotenv.config({
  path: path.join(__dirname, "tokhirgoo", "tokhirgoo.env"),
});

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
} else {
  console.log("✅ Environment variables loaded");
  console.log("APP_SECRET loaded:", !!process.env.APP_SECRET);
}

// Ensure APP_SECRET is available globally
if (!process.env.APP_SECRET) {
  console.error("❌ APP_SECRET not found in environment variables");
  process.exit(1);
}

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

const baiguullagaRoute = require("./routes/baiguullagaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const orshinSuugchRoute = require("./routes/orshinSuugchRoute");
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
    envPath: "./tokhirgoo/tokhirgoo.env",
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

console.log("=== DATABASE CONNECTION DEBUG ===");
console.log("Attempting to connect to MongoDB...");
db.kholboltUusgey(
  app,
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);
console.log("Database connection setup completed");
console.log("=== END DATABASE CONNECTION DEBUG ===");

app.use(ajiltanRoute);
app.use(baiguullagaRoute);
app.use(orshinSuugchRoute);
app.use(gereeRoute);

app.use(aldaaBarigch);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
