const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const fs = require("fs");
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
const walletRoute = require("./routes/walletRoute");
const licenseRoute = require("./routes/licenseRoute");
const nekhemjlekhiinZagvarRoute = require("./routes/nekhemjlekhiinZagvarRoute");
const bankniiGuilgeeRoute = require("./routes/bankniiGuilgeeRoute");
const gereeRoute = require("./routes/gereeRoute");
const dansRoute = require("./routes/dansRoute");
const gereeniiZagvarRoute = require("./routes/gereeniiZagvarRoute");
const nekhemjlekhRoute = require("./routes/nekhemjlekhRoute");
const nekhemjlekhCronRoute = require("./routes/cronScheduleRoute");
const qpayRoute = require("./routes/qpayRoute");
const ebarimtRoute = require("./routes/ebarimtRoute");
const tailanRoute = require("./routes/tailanRoute");
const pdfRoute = require("./routes/pdfRoute");
const medegdelRoute = require("./routes/medegdelRoute");
const msgRoute = require("./routes/msgRoute");
const mailRoute = require("./routes/mailRoute");
const ashiglaltiinZardluudRoute = require("./routes/ashiglaltiinZardluudRoute");
const zogsoolRoute = require("./routes/zogsoolRoute");
const parkingRoute = require("./routes/parkingRoute");
const uneguiMashinRoute = require("./routes/uneguiMashinRoute");
const zochinUrikhRoute = require("./routes/zochinUrikhRoute");
const auditRoute = require("./routes/auditRoute");
const transformationRoute = require("./routes/transformationRoute");
const walletQpayRoute = require("./routes/walletQpayRoute");
const appVersionRoute = require("./routes/appVersionRoute");
const blogRoute = require("./routes/blogRoute");


const { db } = require("zevbackv2");

const aldaaBarigch = require("./middleware/aldaaBarigch");
const { requestContextMiddleware } = require("./middleware/requestContext");
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

app.use(requestContextMiddleware);

const { getMedegdelRoots, getMedegdelPublicRoot } = require("./config/medegdelPaths");
const serveMedegdelImage = (req, res, next) => {
  const fileName = (req.params.ner || "").replace(/\.\./g, "");
  const baiguullagiinId = (req.params.baiguullagiinId || "").replace(/\.\./g, "");
  if (!fileName || !baiguullagiinId) {
    return res.status(404).json({ success: false, message: "Зураг олдсонгүй" });
  }
  const roots = getMedegdelRoots();
  let filePath = null;
  for (const root of roots) {
    const candidate = path.join(root, baiguullagiinId, fileName);
    if (fs.existsSync(candidate)) {
      filePath = path.resolve(candidate);
      break;
    }
    // Fallback: multer sometimes saves to root when baiguullagiinId isn't parsed yet (form field order)
    const fallback = path.join(root, fileName);
    if (fs.existsSync(fallback)) {
      filePath = path.resolve(fallback);
      break;
    }
  }

  console.log(`🔍 [INDEX DEBUG] URL: ${req.url} -> file: ${filePath || "not found"}`);

  if (filePath) {
    res.sendFile(filePath);
  } else {
    if (fileName.match(/\.(jpg|jpeg|png|gif|pdf|webp|webm|m4a)$/i)) {
      const tried = roots.map((r) => path.join(r, baiguullagiinId, fileName));
      console.log(`❌ [INDEX DEBUG] File not found (404). Tried: ${tried.join("; ")}`);
      const body = { success: false, message: "Зураг олдсонгүй" };
      if (req.query.debug === "1") {
        body.tried = tried;
        body.uploadRoot = getMedegdelPublicRoot();
      }
      res.status(404).json(body);
    } else {
      next();
    }
  }
};

// Medegdel API (thread, reply, etc.) must be tried before image route so /medegdel/thread/:id is not matched as image
app.get("/medegdel/:baiguullagiinId/:ner", serveMedegdelImage);
app.get("/api/medegdel/:baiguullagiinId/:ner", serveMedegdelImage);
app.get("/:baiguullagiinId/:ner", serveMedegdelImage);

app.use(baiguullagaRoute);
app.use(ajiltanRoute);
app.use(licenseRoute);
app.use(orshinSuugchRoute);
app.use("/wallet", walletRoute);
app.use(gereeRoute);
app.use(gereeniiZagvarRoute);
app.use(nekhemjlekhiinZagvarRoute);
app.use(bankniiGuilgeeRoute);
app.use(dansRoute);
app.use(ebarimtRoute);
app.use("/nekhemjlekhCron", nekhemjlekhCronRoute);
app.use(medegdelRoute);
app.use(msgRoute);
app.use(nekhemjlekhRoute);
app.use(qpayRoute);
app.use(tailanRoute);
app.use(pdfRoute);
app.use(mailRoute);
app.use(ashiglaltiinZardluudRoute);
app.use(zogsoolRoute);
app.use(parkingRoute);
app.use(uneguiMashinRoute);
app.use(zochinUrikhRoute);
app.use("/audit", auditRoute);
app.use(transformationRoute);
app.use(walletQpayRoute);
app.use(appVersionRoute);
app.use(blogRoute);


app.use(aldaaBarigch);

async function automataarNekhemjlekhUusgekh() {
  try {
    const { db } = require("zevbackv2");
    const Baiguullaga = require("./models/baiguullaga");
    const Geree = require("./models/geree");

    const odoo = new Date();
    const nekhemjlekhUusgekhOgnoo = odoo.getDate();

    console.log(
      "=== АВТОМАТААР НЭХЭМЖЛЭХ ҮҮСГЭХ - ӨДРИЙН АЖИЛЛАГАА ЭХЭЛЛЭЭ ==="
    );
    console.log(
      `📅 Огноо: ${odoo.toLocaleString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
      })}`
    );
    console.log(
      `🔍 Хайж байна: Сарын ${nekhemjlekhUusgekhOgnoo} өдрийн тохиргоо`
    );

    const baiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({});

    const tovchoonuud = [];

    for (const baiguullaga of baiguullaguud) {
      try {
        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (k) => k.baiguullagiinId === baiguullaga._id.toString()
        );

        if (!tukhainBaaziinKholbolt) {
          console.log(`Байгууллага ${baiguullaga._id} холболт олдсонгүй`);
          continue;
        }

        // Find all schedules for today (both organization-level and building-level)
        const schedules = await NekhemjlekhCron(tukhainBaaziinKholbolt).find({
          nekhemjlekhUusgekhOgnoo: nekhemjlekhUusgekhOgnoo,
          idevkhitei: true,
          baiguullagiinId: baiguullaga._id.toString(),
        });

        console.log(
          `🔍 Байгууллага ${baiguullaga.ner}: ${schedules.length} тохиргоо олдлоо`
        );

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

        // Process contracts based on schedule type (organization-level or building-level)
        // If schedule has barilgiinId, only process contracts for that building
        // If schedule has barilgiinId: null, process all contracts for the organization
        const gereeQuery = {
          baiguullagiinId: baiguullaga._id.toString(),
          tuluv: "Идэвхтэй", // Only active contracts
        };

        // If this is a building-level schedule, filter by barilgiinId
        if (tovchoo.barilgiinId) {
          gereeQuery.barilgiinId = tovchoo.barilgiinId;
        }

        const gereenuud = await Geree(tukhainBaaziinKholbolt).find(gereeQuery);

        if (gereenuud.length === 0) {
          console.log(
            `ℹ️  ${
              baiguullaga.ner
            }-д идэвхтэй гэрээ олдсонгүй (нийт: ${await Geree(
              tukhainBaaziinKholbolt
            ).countDocuments({
              baiguullagiinId: baiguullaga._id.toString(),
            })})`
          );
          continue;
        }

        console.log(
          `✅ ${baiguullaga.ner}-д ${gereenuud.length} идэвхтэй гэрээ боловсруулах олдлоо`
        );

        const batchSize = 20;
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < gereenuud.length; i += batchSize) {
          const batch = gereenuud.slice(i, i + batchSize);

          const results = await Promise.allSettled(
            batch.map((geree) =>
              nekhemjlekhController.gereeNeesNekhemjlekhUusgekh(
                geree,
                baiguullaga,
                tukhainBaaziinKholbolt,
                "automataar"
              )
            )
          );

          results.forEach((result, index) => {
            processedCount++;
            if (result.status === "fulfilled" && result.value.success) {
              successCount++;
              const urdun = result.value;
              if (urdun.alreadyExists) {
                console.log(
                  `ℹ️  [${processedCount}/${gereenuud.length}] Гэрээ ${batch[index].gereeniiDugaar} - Нэхэмжлэх энэ сард аль хэдийн байна (${urdun.nekhemjlekh._id})`
                );
              } else {
                console.log(
                  `✅ [${processedCount}/${gereenuud.length}] Гэрээ ${batch[index].gereeniiDugaar} - Шинэ нэхэмжлэх үүсгэлээ (${urdun.nekhemjlekh._id})`
                );
              }
            } else {
              errorCount++;
              const error =
                result.status === "rejected"
                  ? result.reason
                  : result.value?.error || "Unknown error";
              const errorMessage =
                error?.message || error?.toString() || JSON.stringify(error);
              console.error(
                `❌ [${processedCount}/${gereenuud.length}] Гэрээ ${batch[index].gereeniiDugaar} боловсруулах алдаа:`,
                errorMessage
              );
            }
          });
        }

        console.log(
          `📊 ${baiguullaga.ner}: Төлөв - Amjilttai: ${successCount}, Aldaa: ${errorCount}, Niit: ${processedCount}`
        );

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
    console.error("❌ АВТОМАТААР НЭХЭМЖЛЭХ ҮҮСГЭХ АЛДАА:", aldaa);
  }
}

//nehemjleh ilgeeh tsag
const cronJob = cron.schedule(
  "10 15 * * *",
  function () {
    const now = new Date();
    console.log(
      `⏰ [CRON] Cron job triggered at ${now.toLocaleString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
      })}`
    );
    automataarNekhemjlekhUusgekh();
  },
  {
    scheduled: true,
    timezone: "Asia/Ulaanbaatar",
  }
);

cron.schedule(
  "20 7 * * * ",
  async function () {
    await zogsool.archiveUilchluulegchKhonog();
  },
  {
    scheduled: true,
    timezone: "Asia/Ulaanbaatar",
  },
);

console.log(
  "🕐 Cron job тохируулагдлаа: Өдөр бүр 16:18 цагт автоматаар нэхэмжлэх үүсгэх"
);
console.log(
  `🕐 Cron job status: ${cronJob.running ? "Ажиллаж байна" : "Зогссон"}`
);
