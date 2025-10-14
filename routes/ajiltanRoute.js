const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const Baiguullaga = require("../models/baiguullaga");
const request = require("request");
const UstsanBarimt = require("../models/ustsanBarimt");
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
      if (req.method === "GET") {
        return next();
      }

      const { db } = require("zevbackv2");
      var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
      console.log("ajiltan model" + JSON.stringify(req.params.id));
      if (req.params.id) {
        var ObjectId = require("mongodb").ObjectId;
        var ajiltan = await ajiltanModel.findOne({
          nevtrekhNer: req.body.nevtrekhNer,
          _id: { $ne: ObjectId(req.params.id) },
        });
        if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
      } else {
        console.log(
          "req.body.nevtrekhNer ----" + JSON.stringify(req.body.nevtrekhNer)
        );
        if (req.body.nevtrekhNer) {
          var ajiltan = await ajiltanModel.findOne({
            nevtrekhNer: req.body.nevtrekhNer,
          });
          if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
          console.log("ajiltan ----" + JSON.stringify(ajiltan));
        }
      }
      next();
    } catch (error) {
      console.log("error") + error;
      next(error);
    }
  }
);

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);

router.route("/ajiltanNevtrey").post(ajiltanNevtrey);

module.exports = router;
