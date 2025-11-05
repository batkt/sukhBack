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
  orshinSuugchBatalgaajuulya,
  nuutsUgSergeeye,
  davhardsanOrshinSuugchShalgayy,
  orshinSuugchiinNuutsUgSoliyo,
  orshinSuugchOorooUstgakh,
} = require("../controller/orshinSuugch");
const aldaa = require("../components/aldaa");
const session = require("../models/session");
const multer = require("multer");
const {
  generateExcelTemplate,
  importUsersFromExcel,
  downloadExcelList,
} = require("../controller/excelImportController");

// Configure multer for memory storage (Excel files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Зөвхөн Excel файл (.xlsx, .xls) оруулах боломжтой!"), false);
    }
  },
});

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
router
  .route("/khayagaarBaiguullagaAvya/:duureg/:horoo/:soh")
  .get(khayagaarBaiguullagaAvya);

router.post("/orshinSuugchBatalgaajuulya", orshinSuugchBatalgaajuulya);
router.post("/nuutsUgSergeeye", nuutsUgSergeeye);
router.post("/orshinSuugchNuutsUgSoliyo", tokenShalgakh, orshinSuugchiinNuutsUgSoliyo);
router.post("/davhardsanOrshinSuugchShalgayy", davhardsanOrshinSuugchShalgayy);

// Excel template download
router.get(
  "/orshinSuugchExcelTemplate",
  tokenShalgakh,
  generateExcelTemplate
);

// Excel import (with file upload)
router.post(
  "/orshinSuugchExcelImport",
  tokenShalgakh,
  upload.single("excelFile"),
  importUsersFromExcel
);

// Excel download service - generic list download
router.post(
  "/downloadExcelList",
  tokenShalgakh,
  downloadExcelList
);

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

/**
 * POST /orshinSuugch/oorooUstgakh - Self-delete orshinSuugch and all related data
 * Requires password in request body for verification
 * This endpoint allows an orshinSuugch to delete themselves and removes all traces:
 * - geree (invoices/contracts where orshinSuugchId matches)
 * - nekhemjlekhiinTuukh (invoice history related to deleted gerees)
 * - nevtreltiinTuukh (login history)
 */
router.post(
  "/orshinSuugch/oorooUstgakh",
  tokenShalgakh,
  orshinSuugchOorooUstgakh
);

module.exports = router;
