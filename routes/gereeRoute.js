const express = require("express");
const router = express.Router();
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const OrshinSuugch = require("../models/orshinSuugch");
const ashiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
const uilchilgeeniiZardluud = require("../models/uilchilgeeniiZardluud");
const LiftShalgaya = require("../models/liftShalgaya");
const { crud, tokenShalgakh, Dugaarlalt, UstsanBarimt } = require("zevbackv2");
const multer = require("multer");
const {
  gereeZasakhShalguur,
  gereeSungakhShalguur,
  gereeSergeekhShalguur,
  gereeTsutslakhShalguur,
  guilgeeUstgakhShalguur,
  shalguurFieldValidate,
} = require("../components/shalguur");
const {
  gereeniiExcelAvya,
  gereeniiExcelTatya,
  zaaltExcelTemplateAvya,
  zaaltExcelTatya,
  zaaltExcelDataAvya,
} = require("../controller/excel");
const {
  downloadGuilgeeniiTuukhExcel,
  generateTootBurtgelExcelTemplate,
  importTootBurtgelFromExcel,
} = require("../controller/excelImportController");
const { gereeniiGuilgeeKhadgalya } = require("../controller/gereeController");

const storage = multer.memoryStorage();
const uploadFile = multer({ storage: storage });

router
  .route("/gereeniiExcelAvya/:barilgiinId")
  .get(tokenShalgakh, gereeniiExcelAvya);
router
  .route("/gereeniiExcelTatya")
  .post(uploadFile.single("file"), tokenShalgakh, gereeniiExcelTatya);

// Electricity (Цахилгаан) Excel routes
router
  .route("/zaaltExcelTemplateAvya")
  .post(tokenShalgakh, zaaltExcelTemplateAvya);
router
  .route("/zaaltExcelTatya")
  .post(uploadFile.single("file"), tokenShalgakh, zaaltExcelTatya);
// Electricity data export - MUST be before crud to avoid conflicts
router.post("/zaaltExcelDataAvya", tokenShalgakh, zaaltExcelDataAvya);

// GuilgeeniiTuukh Excel download route - MUST be before crud to avoid conflicts
router.post(
  "/guilgeeniiTuukhExcelDownload",
  tokenShalgakh,
  downloadGuilgeeniiTuukhExcel
);

crud(router, "ashiglaltiinZardluud", ashiglaltiinZardluud, UstsanBarimt);
crud(router, "uilchilgeeniiZardluud", uilchilgeeniiZardluud, UstsanBarimt);
crud(router, "liftShalgaya", LiftShalgaya, UstsanBarimt);

crud(
  router,
  "geree",
  Geree,
  UstsanBarimt,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const tukhainBaaziinKholbolt = db.kholboltuud.find(
        (kholbolt) => String(kholbolt.baiguullagiinId) === String(req.body.baiguullagiinId)
      );

      if (!tukhainBaaziinKholbolt) {
        return next(new Error("Холболтын мэдээлэл олдсонгүй!"));
      }

      // Normalize utas field: convert array to string for OrshinSuugch model
      const orshinSuugchData = { ...req.body };
      if (Array.isArray(orshinSuugchData.utas) && orshinSuugchData.utas.length > 0) {
        orshinSuugchData.utas = orshinSuugchData.utas[0];
      } else if (!orshinSuugchData.utas) {
        orshinSuugchData.utas = "";
      }

      const orshinSuugch = new OrshinSuugch(tukhainBaaziinKholbolt)(orshinSuugchData);
      orshinSuugch.id;

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

      // Only append maxDugaar suffix if it's greater than 1 (multiple contracts on same day)
      // Format: ГД-12345678 (for first contract) or ГД-12345678-2 (for subsequent contracts)
      // This prevents "-0" or "-1" suffixes from appearing
      if (maxDugaar && maxDugaar > 1) {
        req.body.gereeniiDugaar = req.body.gereeniiDugaar + "-" + maxDugaar;
      }
      
      // Set orshinSuugchId in req.body so geree can reference it
      req.body.orshinSuugchId = orshinSuugch._id.toString();

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
  async (req, res, next) => {
    if (req.method === "GET") {
      try {
        const { db } = require("zevbackv2");
        const body = req.query;
        const baiguullagiinId = body.baiguullagiinId || req.body?.baiguullagiinId;
        
        if (!baiguullagiinId) {
          return res.status(400).json({
            success: false,
            aldaa: "Байгууллагын ID заавал бөглөх шаардлагатай!",
          });
        }
        
        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (kholbolt) => String(kholbolt.baiguullagiinId) === String(baiguullagiinId)
        );

        if (!tukhainBaaziinKholbolt) {
          return res.status(400).json({
            success: false,
            aldaa: "Холболтын мэдээлэл олдсонгүй!",
          });
        }
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
        if (!!body?.order) body.order = JSON.parse(body.order);
        if (!!body?.select) body.select = JSON.parse(body.select);
        if (!!body?.collation) body.collation = JSON.parse(body.collation);
        if (!!body?.khuudasniiDugaar)
          body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
        if (!!body?.khuudasniiKhemjee)
          body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);

        let jagsaalt = await Geree(tukhainBaaziinKholbolt)
          .find(body.query)
          .sort(body.order)
          .collation(body.collation ? body.collation : {})
          .skip((body.khuudasniiDugaar - 1) * body.khuudasniiKhemjee)
          .limit(body.khuudasniiKhemjee);

        let niitMur = await Geree(tukhainBaaziinKholbolt).countDocuments(
          body.query
        );
        let niitKhuudas =
          niitMur % body.khuudasniiKhemjee == 0
            ? Math.floor(niitMur / body.khuudasniiKhemjee)
            : Math.floor(niitMur / body.khuudasniiKhemjee) + 1;

        // Normalize horoo field to always be an object format for consistency
        if (jagsaalt != null) {
          jagsaalt.forEach((mur) => {
            mur.key = mur._id;
            // Normalize horoo field: convert string to object if needed
            if (mur.horoo && typeof mur.horoo === 'string') {
              mur.horoo = { ner: mur.horoo, kod: mur.horoo };
            } else if (!mur.horoo || typeof mur.horoo !== 'object') {
              mur.horoo = {};
            }
          });
        }

        console.log("Found contracts:", jagsaalt.length);

        res.json({
          khuudasniiDugaar: body.khuudasniiDugaar,
          khuudasniiKhemjee: body.khuudasniiKhemjee,
          jagsaalt,
          niitMur,
          niitKhuudas,
        });
        return;
      } catch (error) {
        console.error("Geree GET error:", error);
        next(error);
        return;
      }
    }
    
    // Handle PUT requests - automatically update electricity readings if tsahilgaaniiZaalt is provided
    if (req.method === "PUT" && req.body.tsahilgaaniiZaalt !== undefined) {
      try {
        const { db } = require("zevbackv2");
        const baiguullagiinId = req.body.baiguullagiinId;
        
        if (!baiguullagiinId) {
          // Try to get baiguullagiinId from the geree document if ID is provided
          if (req.params.id) {
            const allConnections = db.kholboltuud || [];
            let foundGeree = null;
            
            for (const conn of allConnections) {
              try {
                const tempGeree = await Geree(conn, true).findById(req.params.id).select("baiguullagiinId");
                if (tempGeree) {
                  foundGeree = tempGeree;
                  req.body.baiguullagiinId = tempGeree.baiguullagiinId;
                  break;
                }
              } catch (err) {
                // Continue searching
              }
            }
          }
          
          if (!req.body.baiguullagiinId) {
            console.log("⚠️ [GEREE PUT] baiguullagiinId not found, skipping automatic electricity update");
            return next();
          }
        }
        
        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (kholbolt) => String(kholbolt.baiguullagiinId) === String(req.body.baiguullagiinId)
        );

        if (!tukhainBaaziinKholbolt) {
          console.log("⚠️ [GEREE PUT] Connection not found, skipping automatic electricity update");
          return next();
        }

        // Parse tsahilgaaniiZaalt (default to 0 if invalid)
        const tsahilgaaniiZaalt = req.body.tsahilgaaniiZaalt !== undefined 
          ? parseFloat(req.body.tsahilgaaniiZaalt) || 0 
          : 0;

        // Automatically update electricity readings in req.body
        req.body.umnukhZaalt = tsahilgaaniiZaalt;
        req.body.suuliinZaalt = tsahilgaaniiZaalt;
        req.body.zaaltTog = req.body.zaaltTog !== undefined ? req.body.zaaltTog : 0;
        req.body.zaaltUs = req.body.zaaltUs !== undefined ? req.body.zaaltUs : 0;

        console.log("⚡ [GEREE PUT] Automatically updated electricity readings from tsahilgaaniiZaalt:", {
          tsahilgaaniiZaalt: tsahilgaaniiZaalt,
          umnukhZaalt: req.body.umnukhZaalt,
          suuliinZaalt: req.body.suuliinZaalt,
          zaaltTog: req.body.zaaltTog,
          zaaltUs: req.body.zaaltUs
        });

        // Remove tsahilgaaniiZaalt from body as it's not a geree field
        delete req.body.tsahilgaaniiZaalt;
      } catch (error) {
        console.error("⚠️ [GEREE PUT] Error updating electricity readings:", error);
        // Don't block the request, just log the error
      }
    }
    
    // IMPORTANT: When cancelling a geree (tuluv: "Цуцалсан"), preserve the original barilgiinId
    // Do NOT allow barilgiinId to be changed when cancelling a contract
    if (req.method === "PUT" && req.body.tuluv === "Цуцалсан" && req.params.id) {
      try {
        const { db } = require("zevbackv2");
        const allConnections = db.kholboltuud || [];
        let originalGeree = null;
        
        // Find the original geree to preserve its barilgiinId
        for (const conn of allConnections) {
          try {
            const tempGeree = await Geree(conn, true).findById(req.params.id).select("barilgiinId");
            if (tempGeree) {
              originalGeree = tempGeree;
              break;
            }
          } catch (err) {
            // Continue searching
          }
        }
        
        // If original geree found, preserve its barilgiinId
        if (originalGeree && originalGeree.barilgiinId) {
          req.body.barilgiinId = originalGeree.barilgiinId;
          console.log(`🔒 [GEREE PUT] Preserving original barilgiinId: ${originalGeree.barilgiinId} when cancelling contract`);
        }
      } catch (error) {
        console.error("⚠️ [GEREE PUT] Error preserving barilgiinId:", error);
        // Don't block the request, just log the error
      }
    }
    
    next();
  }
);

// router
//   .route("/gereeTsutslaya")
//   .post(tokenShalgakh, async (req, res, next) => {
//     try {
//       var geree = await Geree(req.body.tukhainBaaziinKholbolt, true)
//         .findById(req.body.gereeniiId)
//         .select({
//           gereeniiTuukhuud: 1,
//           duusakhOgnoo: 1,
//         });
//       var tuukh = {
//         umnukhDuusakhOgnoo: geree.duusakhOgnoo,
//         tsutslasanShaltgaan: req.body.shaltgaan,
//         khiisenOgnoo: new Date(),
//         turul: "Tsutslakh",
//         ajiltniiNer: req.body.nevtersenAjiltniiToken.ner,
//         ajiltniiId: req.body.nevtersenAjiltniiToken.id,
//       };
//       var avlagaMatch = req.body.udruurBodokhEsekh
//         ? {
//             ognoo: {
//               $gte: new Date(moment(req.body.tsutslakhOgnoo).startOf("month")),
//             },
//             tulsunDun: { $exists: false },
//           }
//         : { ognoo: { $gt: new Date() } };
//       if (geree.gereeniiTuukhuud) {
//         Geree(req.body.tukhainBaaziinKholbolt)
//           .findOneAndUpdate(
//             { _id: req.body.gereeniiId },
//             {
//               $push: {
//                 [`gereeniiTuukhuud`]: tuukh,
//               },
//               $set: {
//                 tsutsalsanOgnoo: new Date(),
//                 tuluv: -1,
//               },
//               $pull: { "avlaga.guilgeenuud": avlagaMatch },
//             }
//           )
//           .then((result) => {
//             talbaiKhariltsagchiinTuluvUurchluy(
//               [geree._id],
//               req.body.tukhainBaaziinKholbolt
//             );
//             res.send("Amjilttai");
//           })
//           .catch((err) => {
//             next(err);
//           });
//       } else {
//         tuukh = [tuukh];
//         Geree(req.body.tukhainBaaziinKholbolt)
//           .findOneAndUpdate(
//             { _id: req.body.gereeniiId },
//             {
//               $set: {
//                 gereeniiTuukhuud: tuukh,
//                 tsutsalsanOgnoo: new Date(),
//                 tuluv: -1,
//               },
//               $pull: { "avlaga.guilgeenuud": avlagaMatch },
//             }
//           )
//           .then((result) => {
//             talbaiKhariltsagchiinTuluvUurchluy(
//               [geree._id],
//               req.body.tukhainBaaziinKholbolt
//             );
//             res.send("Amjilttai");
//           })
//           .catch((err) => {
//             next(err);
//           });
//       }
//       if (
//         req.body.udruurBodokhEsekh &&
//         req.body.suuliinSariinAvlaguud &&
//         req.body.suuliinSariinAvlaguud?.length > 0
//       ) {
//         var suuliinSariinAvlaguud = req.body.suuliinSariinAvlaguud;
//         for (const savlaga of suuliinSariinAvlaguud)
//           savlaga.tailbar = req.body.shaltgaan;
//         Geree(req.body.tukhainBaaziinKholbolt)
//           .findOneAndUpdate(
//             { _id: req.body.gereeniiId },
//             {
//               $push: { "avlaga.guilgeenuud": suuliinSariinAvlaguud },
//             }
//           )
//           .then((result) => {})
//           .catch((err) => {
//             next(err);
//           });
//       }
//     } catch (error) {
//       next(error);
//     }
//   });

router.route("/gereeKhadgalya").post(
  tokenShalgakh,
  shalguurFieldValidate(["register", "customerTin"]),
  async (req, res, next) => {
    const { db } = require("zevbackv2");
    const orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(req.body);
  orshinSuugch.id = orshinSuugch.register
    ? orshinSuugch.register
    : orshinSuugch.customerTin;
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
    // Only append maxDugaar suffix if it's greater than 1 (multiple contracts on same day)
    // This prevents "-0" or "-1" suffixes from appearing
    if (maxDugaar && maxDugaar > 1) {
      req.body.gereeniiDugaar = req.body.gereeniiDugaar + "-" + maxDugaar;
    }
    dugaarlalt.save();
  }

  var orshinSuugchShalguur;
  if (!!orshinSuugch.register) {
    orshinSuugchShalguur = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      register: orshinSuugch.register,
      barilgiinId: req.body.barilgiinId,
    });
  } else if (!!orshinSuugch.customerTin) {
    orshinSuugchShalguur = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      customerTin: orshinSuugch.customerTin,
      barilgiinId: req.body.barilgiinId,
    });
  }
  if (!orshinSuugchShalguur) await orshinSuugch.save();
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

router
  .route("/gereeniiGuilgeeKhadgalya")
  .post(tokenShalgakh, gereeniiGuilgeeKhadgalya);

router
  .route("/zaaltOlnoorOruulya")
  .post(tokenShalgakh, async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        req.body.baiguullagiinId
      );
      var ashiglaltiinZardal = await AshiglaltiinZardluud(
        req.body.tukhainBaaziinKholbolt
      ).findById(req.body.ashiglaltiinId);
      const jagsaalt = req.body.jagsaalt;
      var talbainDugaaruud = [];
      for await (const mur of jagsaalt) {
        talbainDugaaruud.push(mur.talbainId);
      }
      var niitGereenuud = [];
      var oldooguiGeree = [];
      var aldaaniiMsg = "";
      if (talbainDugaaruud.length > 0) {
        gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
          .find({
            talbainIdnuud: { $in: talbainDugaaruud },
            barilgiinId: req.body.barilgiinId,
            tuluv: 1,
          })
          .select("+avlaga");
        if (!!gereenuud) {
          oldooguiGeree = [];
          talbainDugaaruud.forEach((a) => {
            var oldsonGeree = gereenuud.find((b) =>
              b.talbainIdnuud.includes(a)
            );
            if (!oldsonGeree)
              oldooguiGeree.push(
                jagsaalt.find((x) => x.talbainId == a).talbainDugaar
              );
          });
          if (oldooguiGeree.length > 0) {
            aldaaniiMsg =
              aldaaniiMsg +
              " Дараах талбайн дугаартай гэрээнүүд олдсонгүй! " +
              oldooguiGeree.toString();
          } else niitGereenuud.push(...gereenuud);
        }
      }
      var bulkOps = [];
      var updateObject;
      if (niitGereenuud.length > 0) {
        for await (const tukhainZardal of jagsaalt) {
          var geree = niitGereenuud.find((x) =>
            x.talbainIdnuud.includes(tukhainZardal.talbainId)
          );
          updateObject = {};
          if (
            ashiglaltiinZardal.turul == "кВт" ||
            ashiglaltiinZardal.turul == "1м3" ||
            ashiglaltiinZardal.turul === "кг"
          ) {
            var umnukhZaalt = 0;
            var suuliinGuilgee = geree.avlaga.guilgeenuud.filter((x) => {
              return (
                x.khemjikhNegj == ashiglaltiinZardal.turul &&
                x.tailbar == ashiglaltiinZardal.ner &&
                (!x.tooluuriinDugaar ||
                  tukhainZardal.tooluuriinDugaar == x.tooluuriinDugaar)
              );
            });
            if (!!suuliinGuilgee && suuliinGuilgee.length > 0) {
              suuliinGuilgee = lodash.orderBy(
                suuliinGuilgee,
                ["ognoo"],
                ["asc"]
              );
              suuliinGuilgee = suuliinGuilgee[suuliinGuilgee.length - 1];
            }
            if (!!suuliinGuilgee?.suuliinZaalt) {
              umnukhZaalt = suuliinGuilgee.suuliinZaalt;
            }
          }
          var zoruuDun = tukhainZardal.suuliinZaalt - umnukhZaalt;
          var tsakhilgaanDun = 0;
          var tsakhilgaanKBTST = 0;
          var chadalDun = 0;
          var tsekhDun = 0;
          var sekhDemjikhTulburDun = 0;
          if (baiguullaga?.tokhirgoo?.guidelBuchiltKhonogEsekh) {
            tsakhilgaanKBTST =
              zoruuDun *
              (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
              (tukhainZardal.guidliinKoep || 1);
            chadalDun =
              baiguullaga?.tokhirgoo?.bichiltKhonog > 0 && tsakhilgaanKBTST > 0
                ? (tsakhilgaanKBTST /
                    baiguullaga?.tokhirgoo?.bichiltKhonog /
                    12) *
                  (req.body.baiguullagiinId === "679aea9032299b7ba8462a77"
                    ? 11520
                    : 15500)
                : 0;
            tsekhDun = ashiglaltiinZardal.tariff * tsakhilgaanKBTST;
            if (baiguullaga?.tokhirgoo?.sekhDemjikhTulburAvakhEsekh) {
              // URANGAN iknayd
              sekhDemjikhTulburDun =
                zoruuDun * (ashiglaltiinZardal.tsakhilgaanUrjver || 1) * 23.79;
              tsakhilgaanDun = chadalDun + tsekhDun + sekhDemjikhTulburDun;
            } else tsakhilgaanDun = chadalDun + tsekhDun;
          } else
            tsakhilgaanDun =
              ashiglaltiinZardal.tariff *
              (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
              (zoruuDun || 0);
          var tempDun =
            (ashiglaltiinZardal.ner?.includes("Хүйтэн ус") ||
              ashiglaltiinZardal.ner?.includes("Халуун ус")) &&
            ashiglaltiinZardal.bodokhArga === "Khatuu"
              ? ashiglaltiinZardal.tseverUsDun * zoruuDun +
                ashiglaltiinZardal.bokhirUsDun * zoruuDun +
                (ashiglaltiinZardal.ner?.includes("Халуун ус")
                  ? ashiglaltiinZardal.usKhalaasniiDun * zoruuDun
                  : 0)
              : tsakhilgaanDun;
          updateObject = {
            turul: "avlaga",
            tulsunDun: 0,
            tulukhDun: !!req.body.nuatBodokhEsekh
              ? ((ashiglaltiinZardal.suuriKhuraamj || 0) + tempDun) * 1.1
              : (ashiglaltiinZardal.suuriKhuraamj || 0) + tempDun,
            negj: zoruuDun && zoruuDun,
            khemjikhNegj: ashiglaltiinZardal.turul,
            tariff: ashiglaltiinZardal.tariff,
            tseverUsDun: ashiglaltiinZardal.tseverUsDun * zoruuDun || 0,
            bokhirUsDun: ashiglaltiinZardal.bokhirUsDun * zoruuDun || 0,
            usKhalaasanDun: ashiglaltiinZardal.ner?.includes("Халуун ус")
              ? ashiglaltiinZardal.usKhalaasniiDun * zoruuDun
              : 0,
            suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj || 0,
            tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver || 1,
            tsakhilgaanKBTST: tsakhilgaanKBTST || 0,
            guidliinKoep: tukhainZardal.guidliinKoep || 0,
            bichiltKhonog: baiguullaga?.tokhirgoo?.bichiltKhonog || 0,
            chadalDun: chadalDun || 0,
            tsekhDun: tsekhDun || 0,
            sekhDemjikhTulburDun: sekhDemjikhTulburDun || 0,
            ognoo: tukhainZardal.ognoo,
            gereeniiId: geree._id,
            tailbar: ashiglaltiinZardal.ner,
            nuatBodokhEsekh: req.body.nuatBodokhEsekh,
            tooluuriinDugaar: tukhainZardal.tooluuriinDugaar,
          };
          if (
            ashiglaltiinZardal.turul === "кВт" ||
            ashiglaltiinZardal.turul === "1м3" ||
            ashiglaltiinZardal.turul === "кг"
          ) {
            updateObject["suuliinZaalt"] = tukhainZardal.suuliinZaalt;
            updateObject["umnukhZaalt"] = umnukhZaalt;
          }
          updateObject["guilgeeKhiisenOgnoo"] = new Date();
          if (req.body.nevtersenAjiltniiToken) {
            updateObject["guilgeeKhiisenAjiltniiNer"] =
              req.body.nevtersenAjiltniiToken.ner;
            updateObject["guilgeeKhiisenAjiltniiId"] =
              req.body.nevtersenAjiltniiToken.id;
          }
          tukhainZardal.gereeniiId = geree._id;
          tukhainZardal.zoruu = ashiglaltiinZardal.zoruuDun;
          tukhainZardal.niitDun = tempDun;
          if (updateObject.tulukhDun > 0) {
            let upsertDoc = {
              updateOne: {
                filter: { _id: geree._id },
                update: {
                  $push: {
                    "avlaga.guilgeenuud": updateObject,
                  },
                },
              },
            };
            bulkOps.push(upsertDoc);
          }
        }
      }
      if (aldaaniiMsg) throw new Error(aldaaniiMsg);
      if (bulkOps && bulkOps.length > 0)
        await Geree(req.body.tukhainBaaziinKholbolt)
          .bulkWrite(bulkOps)
          .then((bulkWriteOpResult) => {
            AshiglaltiinExcel(req.body.tukhainBaaziinKholbolt).insertMany(
              jagsaalt
            );
            res.status(200).send("Amjilttai");
          })
          .catch((err) => {
            next(err);
          });
    } catch (err) {
      next(err);
    }
  });

router.get(
  "/tootBurtgelExcelTemplate",
  tokenShalgakh,
  generateTootBurtgelExcelTemplate
);

router.post(
  "/tootBurtgelExcelImport",
  tokenShalgakh,
  uploadFile.single("excelFile"),
  importTootBurtgelFromExcel
);

router.put(
  "/tootBurtgelExcelImport",
  tokenShalgakh,
  uploadFile.single("excelFile"),
  importTootBurtgelFromExcel
);

module.exports = router;
