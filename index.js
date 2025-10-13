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

const ajiltanRoute = require("./routes/ajiltanRoute");

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
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

app.use(ajiltanRoute);
