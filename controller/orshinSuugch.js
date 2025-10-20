const asyncHandler = require("express-async-handler");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const MsgTuukh = require("../models/msgTuukh");
const IpTuukh = require("../models/ipTuukh");
const BatalgaajuulahCode = require("../models/batalgaajuulahCode");
const aldaa = require("../components/aldaa");
const request = require("request");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const useragent = require("express-useragent");

// Helper function to verify code using dugaarBatalgaajuulakh logic
async function verifyCodeHelper(baiguullagiinId, utas, code) {
  const { db } = require("zevbackv2");
  
  // Validate code format
  if (code.length !== 4 || !/^\d+$/.test(code)) {
    return {
      success: false,
      message: "Код буруу байна!",
    };
  }

  // Find the correct database connection
  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
  );

  if (!tukhainBaaziinKholbolt) {
    return {
      success: false,
      message: "Холболтын мэдээлэл олдсонгүй!",
    };
  }

  // Verify code against database
  const BatalgaajuulahCodeModel = BatalgaajuulahCode(tukhainBaaziinKholbolt);
  const verificationResult = await BatalgaajuulahCodeModel.verifyCode(
    utas,
    code,
    "password_reset"
  );

  if (!verificationResult.success) {
    // Increment failed attempts
    await BatalgaajuulahCodeModel.incrementAttempts(
      utas,
      code,
      "password_reset"
    );
  }

  return verificationResult;
}

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

    // Debug logging
    console.log(
      "orshinSuugchBurtgey request body:",
      JSON.stringify(req.body, null, 2)
    );

    // Validate required fields
    if (!req.body.duureg || !req.body.horoo || !req.body.soh) {
      throw new aldaa("Дүүрэг, Хороо, СӨХ заавал бөглөх шаардлагатай!");
    }

    if (!req.body.baiguullagiinId) {
      throw new aldaa("Байгууллагын ID заавал бөглөх шаардлагатай!");
    }

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    if (!req.body.nuutsUg) {
      throw new aldaa("Нууц үг заавал бөглөх шаардлагатай!");
    }

    if (!req.body.ner) {
      throw new aldaa("Нэр заавал бөглөх шаардлагатай!");
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
      $or: [{ utas: req.body.utas }, { register: req.body.register }],
    });

    if (existingUser) {
      throw new aldaa("Утасны дугаар эсвэл регистр давхардаж байна!");
    }

    const orshinSuugch = new OrshinSuugch(tukhainBaaziinKholbolt)({
      ...req.body,
      baiguullagiinId: baiguullaga._id,
      baiguullagiinNer: baiguullaga.ner,
      erkh: "OrshinSuugch",
      duureg: req.body.duureg,
      horoo: req.body.horoo,
      soh: req.body.soh,
      nevtrekhNer: req.body.utas, // Set nevtrekhNer to phone number
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
    console.error("orshinSuugchBurtgey error:", error);
    next(error);
  }
});

exports.davhardsanOrshinSuugchShalgayy = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas, register, baiguullagiinId } = req.body;

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
    );

    const existingUser = await OrshinSuugch(tukhainBaaziinKholbolt).findOne({
      baiguullagiinId: baiguullagiinId,
      $or: [{ utas: utas }, { register: register }]
    });

    if (existingUser) {
      let message = "";
      if (utas && existingUser.utas === utas) {
        message = "Утасны дугаар давхардаж байна!";
      }
      if (register && existingUser.register === register) {
        message = "Регистр давхардаж байна!";
      }
      if (utas && register && existingUser.utas === utas && existingUser.register === register) {
        message = "Утасны дугаар болон регистр давхардаж байна!";
      }

      return res.json({
        success: false,
        message: message
      });
    }

    res.json({
      success: true,
      message: "Ашиглах боломжтой"
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
        .where("utas")
        .equals(req.body.utas);

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
    throw new aldaa("Утасны дугаар эсвэл нууц үг буруу байна!");

  var ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new aldaa("Утасны дугаар эсвэл нууц үг буруу байна!");

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
});

exports.dugaarBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    const { baiguullagiinId, utas, duureg, horoo, soh } = req.body;

    if (!baiguullagiinId || !utas) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон утас заавал бөглөх шаардлагатай!",
      });
    }

    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
      });
    }

    var kholboltuud = db.kholboltuud;
    var kholbolt = kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga._id.toString()
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    console.log(
      "Using connection for code creation:",
      kholbolt.baiguullagiinId
    );
    const BatalgaajuulahCodeModel = BatalgaajuulahCode(kholbolt);
    const batalgaajuulkhCodeDoc =
      await BatalgaajuulahCodeModel.batalgaajuulkhCodeUusgeye(
        utas,
        "password_reset",
        10
      );

    console.log("=== Verification Code Created ===");
    console.log("Phone:", utas);
    console.log("Code:", batalgaajuulkhCodeDoc.code);
    console.log("Expires at:", batalgaajuulkhCodeDoc.expiresAt);
    console.log("Purpose:", batalgaajuulkhCodeDoc.purpose);

    var text = `AmarSukh: Tany batalgaajuulax code: ${batalgaajuulkhCodeDoc.code}.`;

    var ilgeexList = [
      {
        to: utas,
        text: text,
        gereeniiId: "password_reset",
      },
    ];

    var khariu = [];

    msgIlgeeye(
      ilgeexList,
      msgIlgeekhKey,
      msgIlgeekhDugaar,
      khariu,
      0,
      kholbolt,
      baiguullagiinId
    );

    res.json({
      success: true,
      message: "Баталгаажуулах код илгээгдлээ",
      expiresIn: 10,
    });
  } catch (error) {
    next(error);
  }
});

exports.orshinSuugchBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas } = req.body;

    if (!utas) {
      return res.status(400).json({
        success: false,
        message: "Утасны дугаар заавал бөглөх шаардлагатай!",
      });
    }

    let orshinSuugch = null;
    let tukhainBaaziinKholbolt = null;

    for (const kholbolt of db.kholboltuud) {
      try {
        const customer = await OrshinSuugch(kholbolt)
          .findOne()
          .where("utas")
          .equals(utas);

        if (customer) {
          orshinSuugch = customer;
          tukhainBaaziinKholbolt = kholbolt;
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
      });
    }

    req.body.baiguullagiinId = orshinSuugch.baiguullagiinId;

    await exports.dugaarBatalgaajuulya(req, res, next);
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgSergeeye = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas, code, shineNuutsUg } = req.body;

    console.log("=== Password Reset Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Timestamp:", new Date().toISOString());

    if (!utas || !code || !shineNuutsUg) {
      console.log("Missing required fields - request rejected");
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    // Find user first to get baiguullagiinId
    let orshinSuugch = null;
    let tukhainBaaziinKholbolt = null;

    for (const kholbolt of db.kholboltuud) {
      try {
        console.log("Checking connection:", kholbolt.baiguullagiinId);
        const customer = await OrshinSuugch(kholbolt)
          .findOne()
          .where("utas")
          .equals(utas);

        if (customer) {
          console.log("User found in connection:", kholbolt.baiguullagiinId);
          orshinSuugch = customer;
          tukhainBaaziinKholbolt = kholbolt;
          break;
        }
      } catch (err) {
        console.log(
          "Error checking connection:",
          kholbolt.baiguullagiinId,
          err.message
        );
        continue;
      }
    }

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
      });
    }

    // Use helper function for code verification
    const verificationResult = await verifyCodeHelper(
      orshinSuugch.baiguullagiinId, 
      utas, 
      code
    );

    if (!verificationResult.success) {
      console.log("Code verification failed:", verificationResult.message);
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }
    
    console.log("Code verification passed - code is valid and not expired");

    console.log("=== Password Reset Process ===");
    console.log("Phone number:", utas);
    console.log("User found:", orshinSuugch.ner);
    console.log("User ID:", orshinSuugch._id);
    console.log("Old password hash:", orshinSuugch.nuutsUg);
    console.log("New password:", shineNuutsUg);
    console.log("Verification code:", code);

    const oldPasswordHash = orshinSuugch.nuutsUg;

    orshinSuugch.nuutsUg = shineNuutsUg;
    await orshinSuugch.save();

    const updatedUser = await OrshinSuugch(tukhainBaaziinKholbolt)
      .findById(orshinSuugch._id)
      .select("+nuutsUg");

    console.log("Password change verification:");
    console.log("Old hash:", oldPasswordHash);
    console.log("New hash:", updatedUser.nuutsUg);
    console.log(
      "Password changed successfully:",
      oldPasswordHash !== updatedUser.nuutsUg
    );
    console.log("=== End Password Reset Process ===");

    res.json({
      success: true,
      message: "Нууц үг амжилттай сэргээгдлээ",
      data: {
        step: 3,
        passwordChanged: oldPasswordHash !== updatedUser.nuutsUg,
        userId: orshinSuugch._id,
        userName: orshinSuugch.ner,
      },
    });
  } catch (error) {
    next(error);
  }
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
    const msgServer = process.env.MSG_SERVER || "https://api.messagepro.mn";
    let url =
      msgServer +
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
        console.error("SMS sending error:", err1);
      } else {
        var msg = new MsgTuukh(tukhainBaaziinKholbolt)();
        msg.baiguullagiinId = baiguullagiinId;
        msg.dugaar = jagsaalt[index].to;
        msg.gereeniiId = jagsaalt[index].gereeniiId || "";
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
    console.error("msgIlgeeye error:", err);
  }
}

exports.dugaarBatalgaajuulakh = asyncHandler(async (req, res, next) => {
  try {
    const { baiguullagiinId, utas, code } = req.body;

    if (!baiguullagiinId || !utas || !code) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    // Use helper function for verification
    const verificationResult = await verifyCodeHelper(baiguullagiinId, utas, code);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    res.json({
      success: true,
      message: "Дугаар амжилттай баталгаажлаа!",
      data: {
        verified: true,
        phone: utas,
        code: code,
      },
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

exports.cleanupExpiredCodes = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const BatalgaajuulahCodeModel = BatalgaajuulahCode(db.erunkhiiKholbolt);
    const deletedCount = await BatalgaajuulahCodeModel.cleanupExpired();

    console.log(`Cleaned up ${deletedCount} expired verification codes`);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired verification codes`,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

exports.getVerificationCodeStatus = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { phone } = req.params;

    const BatalgaajuulahCodeModel = BatalgaajuulahCode(db.erunkhiiKholbolt);
    const codes = await BatalgaajuulahCodeModel.find({ utas: phone })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      message: "Verification codes retrieved",
      codes: codes.map((code) => ({
        code: code.code,
        purpose: code.purpose,
        used: code.khereglesenEsekh,
        attempts: code.oroldlogo,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
        isExpired: code.expiresAt < new Date(),
      })),
    });
  } catch (error) {
    next(error);
  }
});
