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
const cron = require("node-cron");
const dotenv = require("dotenv");
// const { zuragPack } = require("zuragpack");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const PORT = process.env.PORT || 8084;
const ajiltanRoute = require("./routes/ajiltanRoute");
const licenseRoute = require("./routes/licenseRoute");
const baiguullagaRoute = require("./routes/baiguullagaRoute");
const orshinSuugchRoute = require("./routes/orshinSuugchRoute");
// const redisClient = require("./routes/redisClient");
const aldaaBarigch = require("./middleware/aldaaBarigch");

const cgw = require("./controller/cgw");
const ajiltanController = require("./controller/ajiltan");
const baiguullaga = require("./models/baiguullaga");

process.setMaxListeners(0);
process.env.UV_THREADPOOL_SIZE = 20;
server.listen(8084);

app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

app.get("/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date(),
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
  "mongodb://admin:anzaidev@127.0.0.1:27017/amarSukh?authSource=admin"
);

app.use(ajiltanRoute);
app.use(licenseRoute);
app.use(baiguullagaRoute);
app.use(orshinSuugchRoute);
// app.use(redisClient);
// zuragPack(app);

app.use(aldaaBarigch);

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected:", process.env.BAAZ);
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
