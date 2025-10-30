const asyncHandler = require("express-async-handler");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const MsgTuukh = require("../models/msgTuukh");
const IpTuukh = require("../models/ipTuukh");
const BatalgaajuulahCode = require("../models/batalgaajuulahCode");
const Geree = require("../models/geree");
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

// Helper function to only validate code without marking as used (for Step 2)
async function validateCodeOnly(baiguullagiinId, utas, code, purpose = "password_reset") {
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

  const BatalgaajuulahCodeModel = BatalgaajuulahCode(tukhainBaaziinKholbolt);

  // Only check if code exists and is valid, don't mark as used
  const verificationCode = await BatalgaajuulahCodeModel.findOne({
    utas,
    code,
    purpose,
    khereglesenEsekh: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verificationCode) {
    return {
      success: false,
      message: "Хүчингүй код байна!",
    };
  }

  if (verificationCode.oroldlogo >= verificationCode.niitOroldokhErkh) {
    return {
      success: false,
      message: "Хэт их оролдлого хийгдсэн байна!",
    };
  }

  return {
    success: true,
    message: "Код зөв байна",
  };
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

// async function nevtreltiinTuukhKhadgalya(tuukh, tukhainBaaziinKholbolt) {
//   var ipTuukh = await IpTuukh(tukhainBaaziinKholbolt).findOne({ ip: tuukh.ip });
//   if (ipTuukh) {
//     tuukh.bairshilUls = ipTuukh.bairshilUls;
//     tuukh.bairshilKhot = ipTuukh.bairshilKhot;
//   } else if (tuukh.ip) {
//     try {
//       var axiosKhariu = await axios.get(
//         "https://api.ipgeolocation.io/ipgeo?apiKey=8ee349f1c7304c379fdb6b855d1e9df4&ip=" +
//           tuukh.ip.toString()
//       );
//       ipTuukh = new IpTuukh(tukhainBaaziinKholbolt)();
//       ipTuukh.ognoo = new Date();
//       ipTuukh.medeelel = axiosKhariu.data;
//       ipTuukh.bairshilUls = axiosKhariu.data.country_name;
//       ipTuukh.bairshilKhot = axiosKhariu.data.city;
//       ipTuukh.ip = tuukh.ip;
//       tuukh.bairshilUls = ipTuukh.bairshilUls;
//       tuukh.bairshilKhot = ipTuukh.bairshilKhot;
//       await ipTuukh.save();
//     } catch (err) {}
//   }
//   await tuukh.save();
// }

exports.orshinSuugchBurtgey = asyncHandler(async (req, res, next) => {
  try {
    console.log("📨 dugaarBatalgaajuulya called", {
      body: {
        baiguullagiinId: req.body?.baiguullagiinId,
        utas: req.body?.utas,
        purpose: req.body?.purpose,
      },
    });
    console.log("Энэ рүү орлоо: orshinSuugchBurtgey");
    const { db } = require("zevbackv2");

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

    // Find organization
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
    }

    // Check for existing user
    const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [{ utas: req.body.utas }, { mail: req.body.mail }],
    });

    if (existingUser) {
      throw new aldaa("Утасны дугаар эсвэл регистр, мэйл давхардаж байна!");
    }

    // Create user
    const userData = {
      ...req.body,
      baiguullagiinId: baiguullaga._id,
      baiguullagiinNer: baiguullaga.ner,
      barilgiinId: baiguullaga.barilgiinId, // Store barilgiinId from baiguullaga
      mail: req.body.mail,
      erkh: "OrshinSuugch",
      duureg: req.body.duureg,
      horoo: req.body.horoo,
      soh: req.body.soh,
      nevtrekhNer: req.body.utas,
    };

    const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
    await orshinSuugch.save();

    // Create contract
    try {
      const tukhainBaaziinKholbolt = db.kholboltuud.find(
        (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
      );

      if (!tukhainBaaziinKholbolt) {
        throw new Error("Байгууллагын холболтын мэдээлэл олдсонгүй");
      }

      // Fetch ashiglaltiinZardluud data for this organization
      const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
      const ashiglaltiinZardluudData = await AshiglaltiinZardluud(
        tukhainBaaziinKholbolt
      ).find({
        baiguullagiinId: baiguullaga._id.toString(),
      });

      // Fetch liftShalgaya data to get excluded departments for lift items
      const LiftShalgaya = require("../models/liftShalgaya");
      const liftShalgayaData = await LiftShalgaya(
        tukhainBaaziinKholbolt
      ).findOne({
        baiguullagiinId: baiguullaga._id.toString(),
      });

      const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

      // Map ashiglaltiinZardluud data to zardluud array format
      const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
        ner: zardal.ner,
        turul: zardal.turul,
        zardliinTurul: zardal.zardliinTurul,
        tariff: zardal.tariff,
        tariffUsgeer: zardal.tariffUsgeer || "",
        tulukhDun: 0, // Default value
        dun: zardal.dun || 0,
        bodokhArga: zardal.bodokhArga || "",
        tseverUsDun: zardal.tseverUsDun || 0,
        bokhirUsDun: zardal.bokhirUsDun || 0,
        usKhalaasniiDun: zardal.usKhalaasniiDun || 0,
        tsakhilgaanUrjver: zardal.tsakhilgaanUrjver || 1,
        tsakhilgaanChadal: zardal.tsakhilgaanChadal || 0,
        tsakhilgaanDemjikh: zardal.tsakhilgaanDemjikh || 0,
        suuriKhuraamj: zardal.suuriKhuraamj || 0,
        nuatNemekhEsekh: zardal.nuatNemekhEsekh || false,
        ognoonuud: zardal.ognoonuud || [],
      }));

      // Calculate niitTulbur by summing all tariff values, excluding departments for lift items
      const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
        const tariff = zardal.tariff || 0;

        // Check if this is a lift-related item (by zardliinTurul field)
        const isLiftItem =
          zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";

        // If it's a lift item and user's department is in excluded list, don't count it
        if (
          isLiftItem &&
          orshinSuugch.davkhar &&
          choloolugdokhDavkhar.includes(orshinSuugch.davkhar)
        ) {
          return total; // Don't add this tariff
        }

        return total + tariff;
      }, 0);

      const contractData = {
        gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
        gereeniiOgnoo: new Date(),
        turul: "Үндсэн",
        ovog: req.body.ovog || "",
        ner: req.body.ner,
        register: req.body.register || "",
        utas: [req.body.utas],
        mail: req.body.mail || "",
        baiguullagiinId: baiguullaga._id,
        baiguullagiinNer: baiguullaga.ner,
        tulukhOgnoo: new Date(),
        ashiglaltiinZardal: 0,
        niitTulbur: niitTulbur, // Use calculated total from tariff values
        toot: orshinSuugch.toot || 0, // Get toot from user data
        davkhar: orshinSuugch.davkhar || "", // Get davkhar from user data
        bairNer: req.body.bairniiNer || "",
        sukhBairshil: `${req.body.duureg}, ${req.body.horoo}, ${req.body.soh}`,
        orts: req.body.orts || "",
        burtgesenAjiltan: orshinSuugch._id,
        orshinSuugchId: orshinSuugch._id.toString(), // Add user ID for filtering
        temdeglel: "Автоматаар үүссэн гэрээ",
        actOgnoo: new Date(),
        baritsaaniiUldegdel: 0,
        zardluud: zardluudArray, // Use populated zardluud data
        segmentuud: [],
        khungulultuud: [],
      };

      const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
      await geree.save();

      // Create invoice automatically after contract creation
      try {
        const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
        
        const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
          geree,
          baiguullaga,
          tukhainBaaziinKholbolt,
          "automataar"
        );
        
        if (!invoiceResult.success) {
          console.error("Invoice creation failed:", invoiceResult.error);
        }
      } catch (invoiceError) {
        console.error("Error creating invoice:", invoiceError.message);
      }
    } catch (contractError) {
      console.error("Error creating contract:", contractError.message);
    }

    // Send response
    const response = {
      success: true,
      message: "Амжилттай бүртгэгдлээ",
      result: orshinSuugch,
      hierarchy: {
        duureg: req.body.duureg,
        horoo: req.body.horoo,
        soh: req.body.soh,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error in orshinSuugchBurtgey:", error.message);
    next(error);
  }
});

exports.davhardsanOrshinSuugchShalgayy = asyncHandler(
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const { utas, baiguullagiinId } = req.body;

      const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
        baiguullagiinId: baiguullagiinId,
        $or: [{ utas: utas }],
      });

      if (existingUser) {
        let message = "";
        if (utas && existingUser.utas === utas) {
          message = "Утасны дугаар давхардаж байна!";
        }

        if (utas && existingUser.utas === utas) {
          message = "Утасны дугаар болон регистр давхардаж байна!";
        }

        return res.json({
          success: false,
          message: message,
        });
      }

      res.json({
        success: true,
        message: "Ашиглах боломжтой",
      });
    } catch (error) {
      next(error);
    }
  }
);

exports.orshinSuugchNevtrey = asyncHandler(async (req, res, next) => {
  try {
    const io = req.app.get("socketio");
    const { db } = require("zevbackv2");

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({ utas: req.body.utas })
      .select("+nuutsUg")
      .catch((err) => {
        next(err);
      });

    if (!orshinSuugch)
      throw new aldaa("Утасны дугаар эсвэл нууц үг буруу байна!");

    var ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
    if (!ok) throw new aldaa("Утасны дугаар эсвэл нууц үг буруу байна!");

    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      orshinSuugch.baiguullagiinId
    );

    // Update barilgiinId if baiguullaga has a new one
    if (
      baiguullaga &&
      baiguullaga.barilgiinId &&
      baiguullaga.barilgiinId !== orshinSuugch.barilgiinId
    ) {
      console.log(
        "Updating user barilgiinId from baiguullaga:",
        baiguullaga.barilgiinId
      );
      orshinSuugch.barilgiinId = baiguullaga.barilgiinId;
      await orshinSuugch.save();
    }

    // REMOVED: Organization reassignment logic
    // Users should stay in their original organization to maintain data access
    // The organization reassignment was causing users to lose access to their contracts

    // Keep the original organization assignment
    console.log(
      "User stays in original organization:",
      orshinSuugch.baiguullagiinId
    );

    var butsaakhObject = {
      result: orshinSuugch,
      success: true,
    };

    const token = await orshinSuugch.tokenUusgeye();
    butsaakhObject.token = token;

    res.status(200).json(butsaakhObject);
  } catch (err) {
    next(err);
  }
});

exports.dugaarBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    const { baiguullagiinId, utas } = req.body;
    const purpose = req.body.purpose || "password_reset"; // "register" | "password_reset"

    if (!baiguullagiinId || !utas) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон утас заавал бөглөх шаардлагатай!",
      });
    }

    console.log("🔎 Fetching baiguullaga by id...");
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga) {
      console.log("❌ Baiguullaga not found", { baiguullagiinId });
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
      console.log("❌ Connection not found for org", { baiguullagiinId });
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    // Validate existence based on purpose
    console.log("🔎 Checking existing user by phone...");
    const existing = await OrshinSuugch(db.erunkhiiKholbolt).findOne({ utas });
    console.log("🔎 Existing:", !!existing);
    if (purpose === "registration") {
      if (existing) {
        console.log("🚫 Registration requested but phone already exists");
        return res.status(409).json({
          success: false,
          message: "Энэ утас аль хэдийн бүртгэгдсэн байна!",
          codeSent: false,
        });
      }
    } else if (purpose === "password_reset") {
      if (!existing) {
        console.log("🚫 Password reset requested but phone not found");
        return res.status(404).json({
          success: false,
          message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
          codeSent: false,
        });
      }
    } else if (purpose === "register") {
      console.log(
        "⚠️ purpose=register received; schema expects 'registration'. Consider mapping before saving."
      );
    }

    const BatalgaajuulahCodeModel = BatalgaajuulahCode(kholbolt);
    console.log("🧾 Creating verification code...", { purpose });
    const batalgaajuulkhCodeDoc =
      await BatalgaajuulahCodeModel.batalgaajuulkhCodeUusgeye(
        utas,
        purpose,
        10
      );

    console.log("✅ Code created:", {
      id: batalgaajuulkhCodeDoc?._id?.toString?.(),
      purpose: batalgaajuulkhCodeDoc?.purpose,
      expiresAt: batalgaajuulkhCodeDoc?.expiresAt,
    });

    var text = `AmarSukh: Tany batalgaajuulax code: ${batalgaajuulkhCodeDoc.code}.`;

    var ilgeexList = [
      {
        to: utas,
        text: text,
        gereeniiId: "password_reset",
      },
    ];

    var khariu = [];

    console.log("📤 Sending SMS via msgIlgeeye...", {
      to: utas,
      textLength: text.length,
    });
    msgIlgeeye(
      ilgeexList,
      msgIlgeekhKey,
      msgIlgeekhDugaar,
      khariu,
      0,
      kholbolt,
      baiguullagiinId
    );

    console.log("📬 Response: code sent");
    res.json({
      success: true,
      message: "Баталгаажуулах код илгээгдлээ",
      expiresIn: 10,
      baiguullagiinId: baiguullagiinId,
      purpose: purpose,
      codeSent: true,
    });
  } catch (error) {
    console.error("🔥 dugaarBatalgaajuulya error:", error?.message);
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

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({ utas: utas })
      .catch((err) => {
        next(err);
      });

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
      });
    }

    // Set baiguullagiinId for the next step
    req.body.baiguullagiinId = orshinSuugch.baiguullagiinId;

    // Call the next function to continue the flow
    await exports.dugaarBatalgaajuulya(req, res, next);
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgSergeeye = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas, code, shineNuutsUg } = req.body;

    if (!utas || !code || !shineNuutsUg) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    // Validate password strength
    if (shineNuutsUg.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой!",
      });
    }

    // Find user first to get baiguullagiinId
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({ utas: utas })
      .catch((err) => {
        next(err);
      });

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
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    const oldPasswordHash = orshinSuugch.nuutsUg || null;
    let passwordChanged = false;

    try {
      orshinSuugch.nuutsUg = shineNuutsUg;
      await orshinSuugch.save();
    } catch (saveError) {
      console.error("Error saving password:", saveError);
      return res.status(400).json({
        success: false,
        message: "Нууц үг хадгалахад алдаа гарлаа!",
      });
    }

    try {
      const updatedUser = await OrshinSuugch(db.erunkhiiKholbolt)
        .findById(orshinSuugch._id)
        .select("+nuutsUg");

      passwordChanged = oldPasswordHash
        ? oldPasswordHash !== updatedUser.nuutsUg
        : true;
    } catch (fetchError) {
      console.error("Error fetching updated user:", fetchError);
      return res.status(400).json({
        success: false,
        message: "Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа!",
      });
    }

    res.json({
      success: true,
      message: "Нууц үг амжилттай сэргээгдлээ",
      data: {
        step: 3,
        passwordChanged: passwordChanged,
        userId: orshinSuugch._id.toString(),
        userName: orshinSuugch.ner,
      },
    });
  } catch (error) {
    console.error("Password reset error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Нууц үг солиход алдаа гарлаа",
      error: error.message,
    });
  }
});

exports.tokenoorOrshinSuugchAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    if (!req.headers.authorization) {
      return next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!"));
    }
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return next(new Error("Token олдсонгүй!"));
    }

    let tokenObject;
    try {
      tokenObject = jwt.verify(token, process.env.APP_SECRET);
    } catch (jwtError) {
      console.error("JWT Verification Error:", jwtError.message);
      if (jwtError.name === "JsonWebTokenError") {
        return next(new Error("Token буруу байна!"));
      } else if (jwtError.name === "TokenExpiredError") {
        return next(new Error("Token хугацаа дууссан байна!"));
      } else {
        return next(new Error("Token шалгах үед алдаа гарлаа!"));
      }
    }

    if (tokenObject.id == "zochin")
      return next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!"));

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
    console.error("Token verification error:", error);
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
    const purposeRaw = req.body.purpose || "password_reset"; // "registration" | "register" | "password_reset"
    const purpose = purposeRaw === "register" ? "registration" : purposeRaw;

    if (!baiguullagiinId || !utas || !code) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    // Use validateCodeOnly for Step 2 - don't mark code as used yet
    const verificationResult = await validateCodeOnly(
      baiguullagiinId,
      utas,
      code,
      purpose
    );

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
        purpose,
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
        { "tokhirgoo.sohNer": soh },
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
