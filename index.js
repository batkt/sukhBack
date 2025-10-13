const express = require("express");
const http = require("http");
const cors = require("cors");
const app = express();

const mongoose = require("mongoose");
const server = http.Server(app);

const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
const { db } = require("zevbackv2");
const io = require("socket.io")(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
});

const baiguullagaRoute = require("./routes/baiguullagaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const aldaaBarigch = require("./middleware/aldaaBarigch");

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
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

const dbUri =
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/testiinbaaz?authSource=admin";
mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB!");
});

app.use(ajiltanRoute);
app.use(baiguullagaRoute);

app.use(aldaaBarigch);
