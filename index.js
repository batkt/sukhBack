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
const licenseRoute = require("./routes/licenseRoute");
const nekhemjlekhiinZagvarRoute = require("./routes/nekhemjlekhiinZagvarRoute");
const gereeRoute = require("./routes/gereeRoute");
const gereeniiZagvarRoute = require("./routes/gereeniiZagvarRoute");
const nekhemjlekhRoute = require("./routes/nekhemjlekhRoute");

const { db } = require("zevbackv2");

const aldaaBarigch = require("./middleware/aldaaBarigch");
const nekhemjlekhiinZagvar = require("./models/nekhemjlekhiinZagvar");

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
