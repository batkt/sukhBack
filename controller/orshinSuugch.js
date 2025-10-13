const asyncHandler = require("express-async-handler");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const IpTuukh = require("../models/ipTuukh");
const aldaa = require("../components/aldaa");
const request = require("request");
const axios = require("axios");
const jwt = require("jsonwebtoken");

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

exports.orshinSuugchBurtgey = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      khayag: req.body.khayag,
    });

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын хаяг олдсонгүй!");
    }

    const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      nevtrekhNer: req.body.nevtrekhNer,
    });

    if (existingUser) {
      throw new aldaa("Нэвтрэх нэр давхардаж байна!");
    }

    const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)({
      ...req.body,
      baiguullagiinId: baiguullaga._id,
      baiguullagiinNer: baiguullaga.ner,
      erkh: "OrshinSuugch",
    });

    await orshinSuugch.save();

    res.status(201).json({
      success: true,
      message: "Амжилттай бүртгэгдлээ",
      result: orshinSuugch,
    });
  } catch (error) {
    next(error);
  }
});

exports.orshinSuugchNevtrey = asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db } = require("zevbackv2");

  const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
    .findOne()
    .select("+nuutsUg")
    .where("nevtrekhNer")
    .equals(req.body.nevtrekhNer)
    .catch((err) => {
      next(err);
    });

  if (!orshinSuugch)
    throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    orshinSuugch.baiguullagiinId
  );

  var butsaakhObject = {
    result: orshinSuugch,
    success: true,
  };

  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "sukh" },
    async (khariu) => {
      try {
        if (khariu.success) {
          if (!!khariu.salbaruud) {
            var butsaakhSalbaruud = [];
            butsaakhSalbaruud.push({
              salbariinId: baiguullaga?.barilguud?.[0]?._id,
              duusakhOgnoo: khariu.duusakhOgnoo,
            });

            for await (const salbar of khariu.salbaruud) {
              var tukhainSalbar = baiguullaga?.barilguud?.find((x) => {
                return (
                  !!x.licenseRegister && x.licenseRegister == salbar.register
                );
              });
              if (!!tukhainSalbar) {
                butsaakhSalbaruud.push({
                  salbariinId: tukhainSalbar._id,
                  duusakhOgnoo: salbar.license?.duusakhOgnoo,
                });
              }
            }
            butsaakhObject.salbaruud = butsaakhSalbaruud;
          }

          const jwt = await orshinSuugch.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );

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
          tuukh.ajiltniiId = orshinSuugch._id;
          tuukh.ajiltniiNer = orshinSuugch.ner;
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
          tuukh.baiguullagiinId = orshinSuugch.baiguullagiinId;
          tuukh.baiguullagiinRegister = baiguullaga.register;
          await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);
          res.status(200).json(butsaakhObject);
        } else throw new Error(khariu.msg);
      } catch (err) {
        next(err);
      }
    },
    next
  );
});

exports.tokenoorOrshinSuugchAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    if (!req.headers.authorization) {
      next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401));
    }
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET, 401);
    if (tokenObject.id == "zochin")
      next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401));
    OrshinSuugch(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .then((urDun) => {
        var urdunJson = urDun.toJSON();
        urdunJson.duusakhOgnoo = tokenObject.duusakhOgnoo;
        urdunJson.salbaruud = tokenObject.salbaruud;
        res.send(urdunJson);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgShalgakhOrshinSuugch = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findById(req.body.id)
      .select("+nuutsUg");
    const ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
    if (ok) res.send({ success: true });
    else
      res.send({
        success: false,
        message: "Хэрэглэгчийн одоо ашиглаж буй нууц үг буруу байна!",
      });
  } catch (error) {
    next(error);
  }
});

// exports.khayagaarBaiguullagaAvya = asyncHandler(async (req, res, next) => {
//   try {
//     const { db } = require("zevbackv2");
//     const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
//       khayag: req.params.khayag,
//     });
//     if (!baiguullaga) throw new Error("Байгууллагын мэдээлэл олдсонгүй!");
//     res.send(baiguullaga);
//   } catch (error) {
//     next(error);
//   }
// });
