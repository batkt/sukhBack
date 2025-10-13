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
  const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
    .findOne()
    .select("+nuutsUg")
    .where("nevtrekhNer")
    .equals(req.body.nevtrekhNer)
    .catch((err) => {
      next(err);
    });

  if (!ajiltan) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  var ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    ajiltan.baiguullagiinId
  );
  console.log("--------->Baiguullagiin id" + baiguullaga);

  var butsaakhObject = {
    result: ajiltan,
    success: true,
  };
  if (ajiltan.nevtrekhNer !== "CAdmin1") {
    io.emit(`ajiltan${ajiltan._id}`, {
      ip: req.headers["x-real-ip"],
      type: "logout",
    });
  }

  console.log("----------------->ajiltan.nevtrekhNer " + ajiltan);
  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "sukh" },
    async (khariu) => {
      try {
        if (khariu.success) {
          if (!!khariu.salbaruud) {
            console.log("------>khariu.salbaruud" + khariu.salbaruud);
            var butsaakhSalbaruud = [];
            butsaakhSalbaruud.push({
              salbariinId: baiguullaga?.barilguud?.[0]?._id,
              duusakhOgnoo: khariu.duusakhOgnoo,
            });
            console.log("------>duusahOgnoo" + khariu.duusakhOgnoo);
            for await (const salbar of khariu.salbaruud) {
              console.log("🔍 Processing salbar:", salbar);
              console.log("🔍 Looking for licenseRegister:", salbar.register);
              console.log(
                "🔍 Available barilguud:",
                baiguullaga?.barilguud?.map((b) => ({
                  ner: b.ner,
                  licenseRegister: b.licenseRegister,
                }))
              );

              var tukhainSalbar = baiguullaga?.barilguud?.find((x) => {
                console.log(
                  "🔍 Checking barilguu:",
                  x.ner,
                  "licenseRegister:",
                  x.licenseRegister,
                  "matches:",
                  x.licenseRegister == salbar.register
                );
                return (
                  !!x.licenseRegister && x.licenseRegister == salbar.register
                );
              });

              console.log(
                "--------------------------->tukhainSalbar",
                tukhainSalbar
              );

              if (!!tukhainSalbar) {
                butsaakhSalbaruud.push({
                  salbariinId: tukhainSalbar._id,
                  duusakhOgnoo: salbar.license?.duusakhOgnoo,
                });
              }
            }
            butsaakhObject.salbaruud = butsaakhSalbaruud;
          }
          console.log("butsaahobject" + JSON.stringify(butsaakhObject));

          const jwt = await ajiltan.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );

          console.log("--------------->token" + jwt);

          butsaakhObject.duusakhOgnoo = khariu.duusakhOgnoo;
          if (!!butsaakhObject.result) {
            butsaakhObject.result = JSON.parse(
              JSON.stringify(butsaakhObject.result)
            );
            butsaakhObject.result.salbaruud = butsaakhObject.salbaruud;
            butsaakhObject.result.duusakhOgnoo = khariu.duusakhOgnoo;
          }
          butsaakhObject.token = jwt;
          if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
            butsaakhObject.result.zogsoolNer =
              baiguullaga?.tokhirgoo?.zogsoolNer;
          else butsaakhObject.result.zogsoolNer = baiguullaga.ner;
          var source = req.headers["user-agent"];
          var ua = useragent.parse(source);
          var tuukh = new NevtreltiinTuukh(db.erunkhiiKholbolt)();
          console.log("------->" + tuukh);
          tuukh.ajiltniiId = ajiltan._id;
          tuukh.ajiltniiNer = ajiltan.ner;
          tuukh.ognoo = new Date();
          tuukh.uildliinSystem = ua.os;
          tuukh.ip = req.headers["x-real-ip"];
          if (tuukh.ip && tuukh.ip.substr(0, 7) == "::ffff:") {
            tuukh.ip = tuukh.ip.substr(7);
          }
          ua = Object.keys(ua).reduce(function (r, e) {
            if (ua[e]) r[e] = ua[e];
            return r;
          }, {});
          tuukh.browser = ua.browser;
          tuukh.useragent = ua;
          tuukh.baiguullagiinId = ajiltan.baiguullagiinId;
          tuukh.baiguullagiinRegister = baiguullaga.register;
          await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);
          res.status(200).json(butsaakhObject);
        } else throw new Error(khariu.msg);
      } catch (err) {
        next(err);
        console.log("------------>aldaaaa" + err);
      }
    },
    next
  );
});
