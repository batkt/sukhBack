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
      console.log("=== AJILTAN MIDDLEWARE START ===");
      console.log("Request Method:", req.method);
      console.log("Request URL:", req.url);
      console.log("Request Params:", JSON.stringify(req.params));
      console.log("Request Query:", JSON.stringify(req.query));
      console.log("Request Body:", JSON.stringify(req.body));
      console.log("Request Body Type:", typeof req.body);
      console.log("Request Body is null:", req.body === null);
      console.log("Request Body is undefined:", req.body === undefined);
      
      const { db } = require("zevbackv2");
      console.log("Database connection:", !!db);
      console.log("Database erunkhiiKholbolt:", !!db.erunkhiiKholbolt);
      
      var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
      console.log("Ajiltan model created:", !!ajiltanModel);
      console.log("req.params.id:", JSON.stringify(req.params.id));
      
      if (req.params.id) {
        console.log("=== UPDATE MODE (has params.id) ===");
        var ObjectId = require("mongodb").ObjectId;
        console.log("Looking for ajiltan with nevtrekhNer:", req.body?.nevtrekhNer);
        var ajiltan = await ajiltanModel.findOne({
          nevtrekhNer: req.body?.nevtrekhNer,
          _id: { $ne: ObjectId(req.params.id) },
        });
        console.log("Found existing ajiltan:", JSON.stringify(ajiltan));
        if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
      } else {
        console.log("=== CREATE MODE (no params.id) ===");
        console.log("req.body?.nevtrekhNer:", JSON.stringify(req.body?.nevtrekhNer));
        console.log("req.body?.nevtrekhNer exists:", !!req.body?.nevtrekhNer);
        
        if (req.body?.nevtrekhNer) {
          console.log("Checking for duplicate nevtrekhNer:", req.body.nevtrekhNer);
          var ajiltan = await ajiltanModel.findOne({
            nevtrekhNer: req.body.nevtrekhNer,
          });
          console.log("Found duplicate ajiltan:", JSON.stringify(ajiltan));
          if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
        } else {
          console.log("No nevtrekhNer provided, skipping duplicate check");
        }
      }
      console.log("=== AJILTAN MIDDLEWARE SUCCESS - CALLING NEXT ===");
      next();
    } catch (error) {
      console.log("=== AJILTAN MIDDLEWARE ERROR ===");
      console.log("Error message:", error.message);
      console.log("Error stack:", error.stack);
      console.log("Full error object:", JSON.stringify(error, null, 2));
      next(error);
    }
  }
);

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);

router.route("/ajiltanNevtrey").post(ajiltanNevtrey);

module.exports = router;
