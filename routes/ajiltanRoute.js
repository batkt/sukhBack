const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const Baiguullaga = require("../models/baiguullaga");
const request = require("request");
const { crudWithFile, crud, UstsanBarimt } = require("zevbackv2");
const { ajiltanNevtrey } = require("../controller/ajiltan");

crudWithFile(
  router,
  "ajiltan",
  Ajiltan,
  {
    fileZam: "./zurag/ajiltan",
    fileName: "zurag",
  },
  UstsanBarimt,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
      if (req.params.id) {
        var ObjectId = require("mongodb").ObjectId;
        var ajiltan = await ajiltanModel.findOne({
          nevtrekhNer: req.body?.nevtrekhNer,
          _id: { $ne: ObjectId(req.params.id) },
        });
        if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
      } else {
        if (req.body?.nevtrekhNer) {
          var ajiltan = await ajiltanModel.findOne({
            nevtrekhNer: req.body.nevtrekhNer,
          });
          if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  }
);

// Custom GET route for ajiltan that bypasses crudWithFile
router.get("/ajiltan", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    const ajiltanList = await ajiltanModel.find({});
    res.json({
      success: true,
      data: ajiltanList
    });
  } catch (error) {
    next(error);
  }
});

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);

router.route("/ajiltanNevtrey").post(ajiltanNevtrey);

module.exports = router;
