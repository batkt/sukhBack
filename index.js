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
const nekhemjlekhCronRoute = require("./routes/cronScheduleRoute");
const qpayRoute = require("./routes/qpayRoute");

const { db } = require("zevbackv2");

const aldaaBarigch = require("./middleware/aldaaBarigch");
const nekhemjlekhiinZagvar = require("./models/nekhemjlekhiinZagvar");
const nekhemjlekhController = require("./controller/nekhemjlekhController");
const NekhemjlekhCron = require("./models/cronSchedule");

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
app.use("/nekhemjlekhCron", nekhemjlekhCronRoute);
app.use(qpayRoute);

app.use(aldaaBarigch);

// Автоматаар нэхэмжлэх үүсгэх функц (өдөр бүр шөнийн 12 цагт ажиллана)
async function automataarNekhemjlekhUusgekh() {
  try {
    const { db } = require("zevbackv2");
    const Baiguullaga = require("./models/baiguullaga");
    const Geree = require("./models/geree");

    console.log(
      "=== АВТОМАТААР НЭХЭМЖЛЭХ ҮҮСГЭХ - ӨДРИЙН АЖИЛЛАГАА ЭХЭЛЛЭЭ ==="
    );

    // Одоогийн огноо авах
    const odoo = new Date();
    const nekhemjlekhUusgekhOgnoo = odoo.getDate();

    console.log(`Өнөөдөр сарын ${nekhemjlekhUusgekhOgnoo} өдөр`);

    // Өнөөдрийн хувьд идэвхтэй тохиргоонуудыг авах
    console.log("Хайлтын нөхцөл:", { nekhemjlekhUusgekhOgnoo: nekhemjlekhUusgekhOgnoo, idevkhitei: true });

    // Get all organizations first
    const baiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({});
    console.log(`Олдсон байгууллагын тоо: ${baiguullaguud.length}`);

    const tovchoonuud = [];

    // Check each organization for schedules
    for (const baiguullaga of baiguullaguud) {
      try {
        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (k) => k.baiguullagiinId === baiguullaga._id.toString()
        );

        if (!tukhainBaaziinKholbolt) {
          console.log(`Байгууллага ${baiguullaga._id} холболт олдсонгүй`);
          continue;
        }

        const schedules = await NekhemjlekhCron(tukhainBaaziinKholbolt).find({
          nekhemjlekhUusgekhOgnoo: nekhemjlekhUusgekhOgnoo,
          idevkhitei: true,
        });

        for (const schedule of schedules) {
          tovchoonuud.push({
            ...schedule.toObject(),
            baiguullaga: baiguullaga,
          });
        }
      } catch (error) {
        console.log(
          `Байгууллага ${baiguullaga._id} шалгах алдаа:`,
          error.message
        );
      }
    }

    console.log(`Олдсон тохиргоонуудын тоо: ${tovchoonuud.length}`);
    console.log("Тохиргоонууд:", JSON.stringify(tovchoonuud, null, 2));

    if (tovchoonuud.length === 0) {
      console.log(
        `Сарын ${nekhemjlekhUusgekhOgnoo} өдрийн хувьд нэхэмжлэх үүсгэх тохиргоо олдсонгүй`
      );
      return;
    }

    console.log(
      `Өнөөдрийн хувьд ${tovchoonuud.length} байгууллагын тохиргоо олдлоо`
    );

    for (const tovchoo of tovchoonuud) {
      try {
        const baiguullaga = tovchoo.baiguullaga;
        console.log(
          `Байгууллага боловсруулах: ${baiguullaga.ner} (${baiguullaga._id})`
        );

        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (k) => k.baiguullagiinId === baiguullaga._id.toString()
        );

        // Find ALL contracts for this organization
        const gereenuud = await Geree(tukhainBaaziinKholbolt).find({
          baiguullagiinId: baiguullaga._id.toString()
        });

        if (gereenuud.length === 0) {
          console.log(`${baiguullaga.ner}-д боловсруулах гэрээ олдсонгүй`);
          continue;
        }

        console.log(
          `${baiguullaga.ner}-д ${gereenuud.length} гэрээ боловсруулах олдлоо`
        );

        for (const geree of gereenuud) {
          const urdun = await nekhemjlekhController.gereeNeesNekhemjlekhUusgekh(
            geree,
            baiguullaga,
            tukhainBaaziinKholbolt,
            "automataar"
          );

          if (urdun.success) {
            console.log(
              `✅ Гэрээ ${urdun.gereeniiDugaar}-д нэхэмжлэх үүсгэгдлээ - Төлбөр: ${urdun.tulbur}₮`
            );
          } else {
            console.error(
              `❌ Гэрээ ${urdun.gereeniiDugaar} боловсруулах алдаа:`,
              urdun.error
            );
          }
        }

        // Сүүлийн ажилласан огноо шинэчлэх
        await NekhemjlekhCron(tukhainBaaziinKholbolt).findByIdAndUpdate(
          tovchoo._id,
          {
            suuldAjillasanOgnoo: new Date(),
          }
        );
      } catch (baiguullagiinAldaa) {
        console.error(
          `❌ Байгууллага ${tovchoo.baiguullagiinId} боловсруулах алдаа:`,
          baiguullagiinAldaa.message
        );
      }
    }

    console.log(
      "=== АВТОМАТААР НЭХЭМЖЛЭХ ҮҮСГЭХ - ӨДРИЙН АЖИЛЛАГАА ДУУССАН ==="
    );
  } catch (aldaa) {
    console.error("❌ АВТОМАТААР НЭХЭМЖЛЭХ ҮҮСГЭХ КРИТИК АЛДАА:", aldaa);
  }
}

// Өдөр бүр 10:10 цагт ажиллах cron job
cron.schedule(
  "55 11 * * *", // Өдөр бүр 10:10 цагт
  function () {
    automataarNekhemjlekhUusgekh();
  },
  {
    scheduled: true,
    timezone: "Asia/Ulaanbaatar",
  }
);

console.log(
  "🕐 Cron job тохируулагдлаа: Өдөр бүр 10:10 цагт автоматаар нэхэмжлэх үүсгэх"
);
