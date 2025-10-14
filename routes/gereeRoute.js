const express = require("express");
const router = express.Router();
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const OrshinSuugch = require("../models/orshinSuugch");
const { crud, tokenShalgakh, Dugaarlalt, UstsanBarimt } = require("zevbackv2");
const multer = require("multer");
const {
  gereeZasakhShalguur,
  gereeSungakhShalguur,
  gereeSergeekhShalguur,
  gereeTsutslakhShalguur,
  guilgeeUstgakhShalguur,
} = require("../components/shalguur");

const storage = multer.memoryStorage();
const uploadFile = multer({ storage: storage });

crud(
  router,
  "geree",
  Geree,
  UstsanBarimt,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      // Get tenant database connection
      const tukhainBaaziinKholbolt = db.kholboltuud.find(
        (kholbolt) => kholbolt.baiguullagiinId === req.body.baiguullagiinId
      );

      if (!tukhainBaaziinKholbolt) {
        return next(new Error("Холболтын мэдээлэл олдсонгүй!"));
      }

      const orshinSuugch = new OrshinSuugch(tukhainBaaziinKholbolt)(req.body);
      orshinSuugch.id = orshinSuugch.register;
      
      var unuudur = new Date();
      unuudur = new Date(
        unuudur.getFullYear(),
        unuudur.getMonth(),
        unuudur.getDate()
      );
      
      var maxDugaar = 1;
      const dugaarlaltResult = await Dugaarlalt(tukhainBaaziinKholbolt)
        .find({
          baiguullagiinId: req.body.baiguullagiinId,
          barilgiinId: req.body.barilgiinId,
          turul: "geree",
          ognoo: unuudur,
        })
        .sort({
          dugaar: -1,
        })
        .limit(1);
      
      if (dugaarlaltResult && dugaarlaltResult.length > 0) {
        maxDugaar = dugaarlaltResult[0].dugaar + 1;
      }
      
      var dugaarlalt = new Dugaarlalt(tukhainBaaziinKholbolt)({
        baiguullagiinId: req.body.baiguullagiinId,
        barilgiinId: req.body.barilgiinId,
        dugaar: maxDugaar,
        turul: "geree",
        ognoo: unuudur,
        isNew: true,
      });
      
      req.body.gereeniiDugaar = req.body.gereeniiDugaar + maxDugaar;
      
      try {
        await orshinSuugch.save();
        await dugaarlalt.save();
        next();
      } catch (err) {
        next(err);
      }
    } catch (error) {
      next(error);
    }
  },
  gereeZasakhShalguur
);

router.get("/gereeAvya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === req.params.baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй!" });
    }

    const contracts = await Geree(tukhainBaaziinKholbolt).find({
      baiguullagiinId: req.params.baiguullagiinId,
    });

    res.json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/gereeUusgey", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === req.body.baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй!" });
    }

    const contract = new Geree(tukhainBaaziinKholbolt)(req.body);
    await contract.save();

    res.status(201).json({
      success: true,
      message: "Гэрээ амжилттай үүсгэгдлээ",
      data: contract,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/gereeZasya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === req.body.baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй!" });
    }

    const contract = await Geree(tukhainBaaziinKholbolt).findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!contract) {
      return res
        .status(404)
        .json({ success: false, message: "Гэрээ олдсонгүй!" });
    }

    res.json({
      success: true,
      message: "Гэрээ амжилттай засагдлаа",
      data: contract,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/gereeUstgaya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === req.body.baiguullagiinId
    );

    if (!tukhainBaaziinKholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй!" });
    }

    const contract = await Geree(tukhainBaaziinKholbolt).findByIdAndDelete(
      req.params.id
    );

    if (!contract) {
      return res
        .status(404)
        .json({ success: false, message: "Гэрээ олдсонгүй!" });
    }

    res.json({
      success: true,
      message: "Гэрээ амжилттай устгагдлаа",
    });
  } catch (error) {
    next(error);
  }
});

router.route("/gereeKhadgalya").post(tokenShalgakh, async (req, res, next) => {
  const { db } = require("zevbackv2");
  const khariltsagch = new Khariltsagch(db.erunkhiiKholbolt)(req.body);
  khariltsagch.id = khariltsagch.register
    ? khariltsagch.register
    : khariltsagch.customerTin;
  if (req.body.gereeniiDugaar === `ГД${moment(new Date()).format("YYMMDD")}`) {
    var unuudur = new Date();
    unuudur = new Date(
      unuudur.getFullYear(),
      unuudur.getMonth(),
      unuudur.getDate()
    );
    var maxDugaar = 1;
    await Dugaarlalt(req.body.tukhainBaaziinKholbolt)
      .find({
        baiguullagiinId: req.body.baiguullagiinId,
        barilgiinId: req.body.barilgiinId,
        turul: "geree",
        ognoo: unuudur,
      })
      .sort({
        dugaar: -1,
      })
      .limit(1)
      .then((result) => {
        if (result != 0) maxDugaar = result[0].dugaar + 1;
      });
    var dugaarlalt = new Dugaarlalt(req.body.tukhainBaaziinKholbolt)({
      baiguullagiinId: req.body.baiguullagiinId,
      barilgiinId: req.body.barilgiinId,
      dugaar: maxDugaar,
      turul: "geree",
      ognoo: unuudur,
      isNew: true,
    });
    req.body.gereeniiDugaar = req.body.gereeniiDugaar + maxDugaar;
    dugaarlalt.save();
  }

  var khariltsagchShalguur;
  if (!!khariltsagch.register) {
    khariltsagchShalguur = await Khariltsagch(db.erunkhiiKholbolt).findOne({
      register: khariltsagch.register,
      barilgiinId: req.body.barilgiinId,
    });
  } else if (!!khariltsagch.customerTin) {
    khariltsagchShalguur = await Khariltsagch(db.erunkhiiKholbolt).findOne({
      customerTin: khariltsagch.customerTin,
      barilgiinId: req.body.barilgiinId,
    });
  }
  if (!khariltsagchShalguur) await khariltsagch.save();
  var geree = new Geree(req.body.tukhainBaaziinKholbolt)(req.body);
  var daraagiinTulukhOgnoo = geree.duusakhOgnoo;
  try {
    if (geree.avlaga.guilgeenuud && geree.avlaga.guilgeenuud.length > 0)
      daraagiinTulukhOgnoo = geree.avlaga.guilgeenuud[0].ognoo;
  } catch (err) {
    if (!!next) next(err);
  }
  geree.daraagiinTulukhOgnoo = daraagiinTulukhOgnoo;
  geree.tuluv = 1;
  await geree.save().then((result) => {
    talbaiKhariltsagchiinTuluvUurchluy(
      [result._id],
      req.body.tukhainBaaziinKholbolt
    );
  });
  res.send("Amjilttai");
});

module.exports = router;
