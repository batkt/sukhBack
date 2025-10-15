const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const Baiguullaga = require("../models/baiguullaga");
const request = require("request");
const { crudWithFile, crud, UstsanBarimt } = require("zevbackv2");
const { ajiltanNevtrey } = require("../controller/ajiltan");

// crudWithFile(
//   router,
//   "ajiltan",
//   Ajiltan,
//   {
//     fileZam: "./zurag/ajiltan",
//     fileName: "zurag",
//   },
//   UstsanBarimt,
//   async (req, res, next) => {
//     try {
//       const { db } = require("zevbackv2");
//       var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
//       if (req.params.id) {
//         var ObjectId = require("mongodb").ObjectId;
//         var ajiltan = await ajiltanModel.findOne({
//           nevtrekhNer: req.body?.nevtrekhNer,
//           _id: { $ne: ObjectId(req.params.id) },
//         });
//         if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
//       } else {
//         if (req.body?.nevtrekhNer) {
//           var ajiltan = await ajiltanModel.findOne({
//             nevtrekhNer: req.body.nevtrekhNer,
//           });
//           if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
//         }
//       }
//       next();
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// Custom GET route for ajiltan with pagination support
router.get("/ajiltan", UstsanBarimt, async (req, res, next) => {
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
    
    // Parse JSON strings if they exist
    if (!!body?.query) body.query = JSON.parse(body.query);
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.select) body.select = JSON.parse(body.select);
    if (!!body?.collation) body.collation = JSON.parse(body.collation);
    
    // Convert to numbers
    if (!!body?.khuudasniiDugaar)
      body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
    if (!!body?.khuudasniiKhemjee)
      body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);
    
    // Add baiguullagiinId filter if provided
    if (req.body?.baiguullagiinId) {
      if (!body.query) body.query = {};
      body.query["baiguullagiinId"] = req.body.baiguullagiinId;
    }
    
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    
    // Get paginated data
    let jagsaalt = await ajiltanModel
      .find(body.query)
      .sort(body.order)
      .collation(body.collation ? body.collation : {})
      .skip((body.khuudasniiDugaar - 1) * body.khuudasniiKhemjee)
      .limit(body.khuudasniiKhemjee);
    
    // Get total count
    let niitMur = await ajiltanModel.countDocuments(body.query);
    
    // Calculate total pages
    let niitKhuudas =
      niitMur % khuudasniiKhemjee == 0
        ? Math.floor(niitMur / khuudasniiKhemjee)
        : Math.floor(niitMur / khuudasniiKhemjee) + 1;
    
    // Add key field for frontend
    if (jagsaalt != null) jagsaalt.forEach((mur) => (mur.key = mur._id));
    
    res.json({
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

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);

router.route("/ajiltanNevtrey").post(ajiltanNevtrey);

module.exports = router;
