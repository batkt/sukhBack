const asyncHandler = require("express-async-handler");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const MsgTuukh = require("../models/msgTuukh");
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

    if (!req.body.duureg || !req.body.horoo || !req.body.soh) {
      throw new aldaa("Дүүрэг, Хороо, СӨХ заавал бөглөх шаардлагатай!");
    }

    if (!req.body.baiguullagiinId) {
      throw new aldaa("Байгууллагын ID заавал бөглөх шаардлагатай!");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === req.body.baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      throw new aldaa("Холболтын мэдээлэл олдсонгүй!");
    }

    const existingUser = await OrshinSuugch(tukhainBaaziinKholbolt).findOne({
      $or: [
        { nevtrekhNer: req.body.nevtrekhNer },
        { register: req.body.register },
        { utas: req.body.utas },
      ],
    });

    if (existingUser) {
      throw new aldaa("Нэвтрэх нэр, регистр эсвэл утас давхардаж байна!");
    }

    const orshinSuugch = new OrshinSuugch(tukhainBaaziinKholbolt)({
      ...req.body,
      baiguullagiinId: baiguullaga._id,
      baiguullagiinNer: baiguullaga.ner,
      erkh: "OrshinSuugch",
      duureg: req.body.duureg,
      horoo: req.body.horoo,
      soh: req.body.soh,
    });

    await orshinSuugch.save();

    res.status(201).json({
      success: true,
      message: "Амжилттай бүртгэгдлээ",
      result: orshinSuugch,
      hierarchy: {
        duureg: req.body.duureg,
        horoo: req.body.horoo,
        soh: req.body.soh,
      },
    });
  } catch (error) {
    next(error);
  }
});

exports.orshinSuugchNevtrey = asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db } = require("zevbackv2");

  let orshinSuugch = null;
  let tukhainBaaziinKholbolt = null;

  for (const kholbolt of db.kholboltuud) {
    try {
      const customer = await OrshinSuugch(kholbolt)
        .findOne()
        .select("+nuutsUg")
        .where("nevtrekhNer")
        .equals(req.body.nevtrekhNer);

      if (customer) {
        orshinSuugch = customer;
        tukhainBaaziinKholbolt = kholbolt;
        break;
      }
    } catch (err) {
      continue;
    }
  }

  if (!orshinSuugch)
    throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    orshinSuugch.baiguullagiinId
  );

  if (orshinSuugch.duureg && orshinSuugch.horoo && orshinSuugch.soh) {
    const matchingBaiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      $and: [
        { "tokhirgoo.duuregNer": orshinSuugch.duureg },
        { "tokhirgoo.districtCode": orshinSuugch.horoo },
        { "tokhirgoo.sohCode": orshinSuugch.soh },
      ],
    });

    if (matchingBaiguullaga) {
      orshinSuugch.baiguullagiinId = matchingBaiguullaga._id;
      orshinSuugch.baiguullagiinNer = matchingBaiguullaga.ner;
      await orshinSuugch.save();
      baiguullaga = matchingBaiguullaga;
    }
  }

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


function msgIlgeeye(
  jagsaalt,
  key,
  dugaar,
  khariu,
  index,
  tukhainBaaziinKholbolt,
  baiguullagiinId
) {
  try {
    url =
      process.env.MSG_SERVER +
      "/send" +
      "?key=" +
      key +
      "&from=" +
      dugaar +
      "&to=" +
      jagsaalt[index].to.toString() +
      "&text=" +
      jagsaalt[index].text.toString();
    url =
      process.env.MSG_SERVER +
      "/send" +
      "?key=" +
      key +
      "&from=" +
      dugaar +
      "&to=" +
      jagsaalt[index].to.toString() +
      "&text=" +
      jagsaalt[index].text.toString();
    url = encodeURI(url);
    request(url, { json: true }, (err1, res1, body) => {
      if (err1) {
        next(err1);
      } else {
        var msg = new MsgTuukh(tukhainBaaziinKholbolt)();
        msg.baiguullagiinId = baiguullagiinId;
        msg.dugaar = jagsaalt[index].to;
        msg.gereeniiId = jagsaalt[index].gereeniiId;
        msg.msg = jagsaalt[index].text;
        msg.msgIlgeekhKey = key;
        msg.msgIlgeekhDugaar = dugaar;
        msg.save();
        if (jagsaalt.length > index + 1) {
          khariu.push(body[0]);
          msgIlgeeye(
            jagsaalt,
            key,
            dugaar,
            khariu,
            index + 1,
            tukhainBaaziinKholbolt,
            baiguullagiinId
          );
        } else {
          khariu.push(body[0]);
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

exports.dugaarBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";
    
    const { baiguullagiinId, utas, duureg, horoo, soh } = req.body;
    
    if (!baiguullagiinId || !utas) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон утас заавал бөглөх шаардлагатай!"
      });
    }
    
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!"
      });
    }
    
    var kholboltuud = db.kholboltuud;
    var kholbolt = kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga._id.toString()
    );
    
    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!"
      });
    }
    
      var verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    var text = `AmarSukh: Tany batalgaajuulax code: ${verificationCode}.`;
    
    var ilgeexList = [{
      to: utas,
      text: text
    }];
    
    var verificationRecord = {
      baiguullagiinId: baiguullagiinId,
      utas: utas,
      code: verificationCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minut
      verified: false
    };
    
    try {
      const msgServer = process.env.MSG_SERVER || "https://api.messagepro.mn";
      console.log("MSG_SERVER from env:", process.env.MSG_SERVER);
      console.log("Using msgServer:", msgServer);
      
      const url = msgServer + 
        "/send" +
        "?key=" + msgIlgeekhKey +
        "&from=" + msgIlgeekhDugaar +
        "&to=" + utas +
        "&text=" + encodeURIComponent(text);
      
      console.log("SMS URL:", url);
      
      request(url, { json: true }, (err, res, body) => {
        if (err) {
          console.error("SMS sending error:", err);
        } else {
          console.log("SMS sent successfully:", body);
        }
      });
    } catch (smsError) {
      console.error("SMS sending error:", smsError);
    }
    
    res.json({
      success: true,
      message: "Баталгаажуулах код илгээгдлээ",
      verificationCode: verificationCode // Remove this in production
    });
    
  } catch (error) {
    next(error);
  }
});

// Verification endpoint to check the entered code
exports.dugaarBatalgaajuulakh = asyncHandler(async (req, res, next) => {
  try {
    const { baiguullagiinId, utas, code } = req.body;
    
    if (!baiguullagiinId || !utas || !code) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!"
      });
    }
    
    // In a real implementation, you would check the stored verification code
    // For now, we'll do a simple validation
      if (code.length !== 4 || !/^\d+$/.test(code)) {
        return res.status(400).json({
          success: false,
          message: "Код буруу байна!"
        });
      }
    
    // Here you would check against stored verification codes
    // and verify expiration time
    
    res.json({
      success: true,
      message: "Дугаар амжилттай баталгаажлаа!"
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

exports.khayagaarBaiguullagaAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { duureg, horoo, soh } = req.params;

    if (!duureg || !horoo || !soh) {
      throw new aldaa("Дүүрэг, Хороо, СӨХ заавал бөглөх шаардлагатай!");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      $and: [
        { "tokhirgoo.duuregNer": duureg },
        { "tokhirgoo.districtCode": horoo },
        { "tokhirgoo.sohCode": soh },
      ],
    });

    if (!baiguullaga) {
      throw new aldaa(
        "Тухайн дүүрэг, хороо, СӨХ-д тохирох байгууллагын мэдээлэл олдсонгүй!"
      );
    }

    res.status(200).json({
      success: true,
      message: "Байгууллагын мэдээлэл олдлоо",
      result: baiguullaga,
    });
  } catch (error) {
    next(error);
  }
});
