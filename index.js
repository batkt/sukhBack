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

dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

const baiguullagaRoute = require("./routes/baiguullagaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const orshinSuugchRoute = require("./routes/orshinSuugchRoute");
const gereeRoute = require("./routes/gereeRoute");
const gereeniiZagvarRoute = require("./routes/gereeniiZagvarRoute");

const { db } = require("zevbackv2");

const aldaaBarigch = require("./middleware/aldaaBarigch");

process.setMaxListeners(0);
process.env.UV_THREADPOOL_SIZE = 20;

server.listen(8084);

process.env.TZ = "Asia/Ulaanbaatar";
app.set("socketio", io);
app.use(cors());

// Add request logging middleware
app.use((req, res, next) => {
  console.log("=== INCOMING REQUEST ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body before parsing:", req.body);
  next();
});

app.use(
  express.json({
    limit: "50mb",
    extended: true,
  })
);

// Add post-json parsing logging
app.use((req, res, next) => {
  console.log("=== AFTER JSON PARSING ===");
  console.log("Body after parsing:", JSON.stringify(req.body));
  console.log("Body type:", typeof req.body);
  console.log("Body is null:", req.body === null);
  console.log("Body is undefined:", req.body === undefined);
  next();
});

db.kholboltUusgey(
  app,
  "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
);

app.use(
  express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 })
);

console.log("=== REGISTERING ROUTES ===");
console.log("Registering ajiltanRoute");
app.use(ajiltanRoute);
console.log("Registering baiguullagaRoute");
app.use(baiguullagaRoute);
console.log("Registering orshinSuugchRoute");
app.use(orshinSuugchRoute);
console.log("Registering gereeRoute");
app.use(gereeRoute);
console.log("Registering gereeniiZagvarRoute");
app.use(gereeniiZagvarRoute);
console.log("=== ALL ROUTES REGISTERED ===");

app.use(aldaaBarigch);
