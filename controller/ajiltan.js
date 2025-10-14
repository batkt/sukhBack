const asyncHandler = require("express-async-handler");
const Ajiltan = require("../models/ajiltan");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const IpTuukh = require("../models/ipTuukh");
const aldaa = require("../components/aldaa");
const request = require("request");
const axios = require("axios");

const useragent = require("express-useragent");

function duusakhOgnooAvya(ugugdul, onFinish, next) {
  request.get(
    "http://103.143.40.123:8282/baiguullagiinDuusakhKhugatsaaAvya",
    { json: true, body: ugugdul },
    (err, res1, body) => {
      if (err) next(err);
      else {
        onFinish(body);
      }
    }
  );
}

async function nevtreltiinTuukhKhadgalya(tuukh, tukhainBaaziinKholbolt) {
  var ipTuukh = await IpTuukh(tukhainBaaziinKholbolt).findOne({ ip: tuukh.ip });
  if (ipTuukh) {
    tuukh.bairshilUls = ipTuukh.bairshilUls;
    tuukh.bairshilKhot = ipTuukh.bairshilKhot;
  } else if (tuukh.ip) {
    try {
      var axiosKhariu = await axios.get(
        "https://api.ipgeolocation.io/ipgeo?apiKey=8ee349f1c7304c379fdb6b855d1e9df4&ip=" +
          tuukh.ip.toString()
      );
      ipTuukh = new IpTuukh(tukhainBaaziinKholbolt)();
      ipTuukh.ognoo = new Date();
      ipTuukh.medeelel = axiosKhariu.data;
      ipTuukh.bairshilUls = axiosKhariu.data.country_name;
      ipTuukh.bairshilKhot = axiosKhariu.data.city;
      ipTuukh.ip = tuukh.ip;
      tuukh.bairshilUls = ipTuukh.bairshilUls;
      tuukh.bairshilKhot = ipTuukh.bairshilKhot;
      await ipTuukh.save();
    } catch (err) {}
  }
  await tuukh.save();
}

exports.ajiltanNevtrey = asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db } = require("zevbackv2");

  try {
    const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
      .findOne()
      .select("+nuutsUg")
      .where("nevtrekhNer")
      .equals(req.body.nevtrekhNer);

    if (!ajiltan)
      throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

    const ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
    if (!ok) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

    const baiguullagiinId = ajiltan?.baiguullagiinId || null;
    if (!baiguullagiinId)
      console.warn("Ajiltan missing baiguullagiinId:", ajiltan?._id);

    const baiguullaga = baiguullagiinId
      ? await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId)
      : null;

    let butsaakhObject = {
      result: ajiltan ? JSON.parse(JSON.stringify(ajiltan)) : null,
      success: true,
    };

    if (ajiltan?.nevtrekhNer !== "CAdmin1") {
      io.emit(`ajiltan${ajiltan._id}`, {
        ip: req.headers["x-real-ip"],
        type: "logout",
      });
    }

    duusakhOgnooAvya(
      { register: baiguullaga?.register, system: "sukh" },
      async (khariu) => {
        try {
          if (!khariu.success) throw new Error(khariu.msg);

          let butsaakhSalbaruud = [];
          if (
            khariu.salbaruud?.length > 0 &&
            baiguullaga?.barilguud?.length > 0
          ) {
            butsaakhSalbaruud.push({
              salbariinId: baiguullaga?.barilguud?.[0]?._id || null,
              duusakhOgnoo: khariu.duusakhOgnoo,
            });

            for await (const salbar of khariu.salbaruud) {
              const tukhainSalbar = baiguullaga.barilguud?.find(
                (x) => x.licenseRegister === salbar.register
              );
              if (tukhainSalbar) {
                butsaakhSalbaruud.push({
                  salbariinId: tukhainSalbar._id,
                  duusakhOgnoo: salbar.license?.duusakhOgnoo,
                });
              }
            }
          }
          butsaakhObject.salbaruud = butsaakhSalbaruud;

          const jwt = await ajiltan.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );
          butsaakhObject.duusakhOgnoo = khariu.duusakhOgnoo;
          butsaakhObject.token = jwt;

          butsaakhObject.result.zogsoolNer =
            baiguullaga?.tokhirgoo?.zogsoolNer || baiguullaga?.ner || null;

          const source = req.headers["user-agent"] || "";
          const ua = useragent.parse(source);
          const tuukh = new NevtreltiinTuukh(db.erunkhiiKholbolt)();

          tuukh.ajiltniiId = ajiltan?._id || null;
          tuukh.ajiltniiNer = ajiltan?.ner || null;
          tuukh.ognoo = new Date();
          tuukh.uildliinSystem = ua.os || null;
          tuukh.ip = req.headers["x-real-ip"]?.replace("::ffff:", "") || null;
          tuukh.browser = ua.browser || null;
          tuukh.useragent = ua || {};
          tuukh.baiguullagiinId = baiguullagiinId;
          tuukh.baiguullagiinRegister = baiguullaga?.register || null;

          await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);

          res.status(200).json(butsaakhObject);
        } catch (err) {
          console.error("Login flow error:", err);
          next(err);
        }
      },
      next
    );
  } catch (err) {
    console.error("Login error:", err);
    next(err);
  }
});
