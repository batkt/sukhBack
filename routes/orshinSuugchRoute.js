const express = require("express");
const router = express.Router();
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const request = require("request");
const {
  tokenShalgakh,
  crudWithFile,
  crud,
  UstsanBarimt,
  db,
} = require("zevbackv2");
const {
  orshinSuugchBurtgey,
  orshinSuugchNevtrey,
  tokenoorOrshinSuugchAvya,
  nuutsUgShalgakhOrshinSuugch,
  khayagaarBaiguullagaAvya,
  dugaarBatalgaajuulya,
  dugaarBatalgaajuulakh,
} = require("../controller/orshinSuugch");
const aldaa = require("../components/aldaa");
const session = require("../models/session");

// crudWithFile(
//   router,
//   "orshinSuugch",
//   OrshinSuugch,
//   {
//     fileZam: "./zurag/orshinSuugch",
//     fileName: "zurag",
//   },
//   UstsanBarimt,
//   async (req, res, next) => {
//     try {
//       const { db } = require("zevbackv2");
//       var orshinSuugchModel = OrshinSuugch(req.body.tukhainBaaziinKholbolt);
//       console.log("orshinSuugch model" + JSON.stringify(req.params.id));
//       if (req.params.id) {
//         var ObjectId = require("mongodb").ObjectId;
//         var orshinSuugch = await orshinSuugchModel.findOne({
//           nevtrekhNer: req.body.nevtrekhNer,
//           _id: { $ne: ObjectId(req.params.id) },
//         });
//         if (orshinSuugch) throw new Error("Нэвтрэх нэр давхардаж байна!");
//       } else {
//         console.log(
//           "req.body.nevtrekhNer ----" + JSON.stringify(req.body.nevtrekhNer)
//         );
//         if (req.body.nevtrekhNer) {
//           var orshinSuugch = await orshinSuugchModel.findOne({
//             nevtrekhNer: req.body.nevtrekhNer,
//           });
//           if (orshinSuugch) throw new Error("Нэвтрэх нэр давхардаж байна!");
//           console.log("orshinSuugch ----" + JSON.stringify(orshinSuugch));
//         }
//       }
//       next();
//     } catch (error) {
//       console.log("error") + error;
//       next(error);
//     }
//   }
// );

crud(router, "orshinSuugch", OrshinSuugch, UstsanBarimt);
crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);
crud(router, "backTuukh", BackTuukh, UstsanBarimt);
crud(router, "session", session, UstsanBarimt);

router.route("/orshinSuugchBurtgey").post(orshinSuugchBurtgey);
router.post("/dugaarBatalgaajuulya", dugaarBatalgaajuulya);
router.post("/dugaarBatalgaajuulakh", dugaarBatalgaajuulakh);
router.route("/orshinSuugchNevtrey").post(orshinSuugchNevtrey);
router.route("/tokenoorOrshinSuugchAvya").post(tokenoorOrshinSuugchAvya);
router.route("/nuutsUgShalgakhOrshinSuugch").post(nuutsUgShalgakhOrshinSuugch);
router.route("/khayagaarBaiguullagaAvya/:duureg/:horoo/:soh").get(khayagaarBaiguullagaAvya);

router.get("/orshinSuugchiiZuragAvya/:baiguullaga/:ner", (req, res, next) => {
  const fileName = req.params.ner;
  const directoryPath = "zurag/orshinSuugch/" + req.params.baiguullaga + "/";
  res.download(directoryPath + fileName, fileName, (err) => {
    if (err) {
      next(err);
    }
  });
});

router.get("/ustsanBarimt", tokenShalgakh, async (req, res, next) => {
  try {
    const body = req.query;
    const {
      query = {},
      order,
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 10,
      search,
      collation = {},
      select = {},
    } = body;
    if (!!body?.query) body.query = JSON.parse(body.query);
    if (req.body.baiguullagiinId) {
      if (!body.query) body.query = {};
      body.query["baiguullagiinId"] = req.body.baiguullagiinId;
    }
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.select) body.select = JSON.parse(body.select);
    if (!!body?.collation) body.collation = JSON.parse(body.collation);
    if (!!body?.khuudasniiDugaar)
      body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
    if (!!body?.khuudasniiKhemjee)
      body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);
    let jagsaalt = await UstsanBarimt(req.body.tukhainBaaziinKholbolt)
      .find(body.query)
      .sort(body.order)
      .collation(body.collation ? body.collation : {})
      .skip((body.khuudasniiDugaar - 1) * body.khuudasniiKhemjee)
      .limit(body.khuudasniiKhemjee);
    let niitMur = await UstsanBarimt(
      req.body.tukhainBaaziinKholbolt
    ).countDocuments(body.query);
    let niitKhuudas =
      niitMur % khuudasniiKhemjee == 0
        ? Math.floor(niitMur / khuudasniiKhemjee)
        : Math.floor(niitMur / khuudasniiKhemjee) + 1;
    if (jagsaalt != null) jagsaalt.forEach((mur) => (mur.key = mur._id));
    res.send({
      khuudasniiDugaar,
      khuudasniiKhemjee,
      jagsaalt,
      niitMur,
      niitKhuudas,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/orshinSuugchdTokenOnooyo", tokenShalgakh, (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    let filter = {
      _id: req.body.id,
    };
    let update = {
      firebaseToken: req.body.token,
    };
    OrshinSuugch(db.erunkhiiKholbolt)
      .updateOne(filter, update)
      .then((result) => {
        res.send("Amjilttai");
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
