const express = require("express");
const router = express.Router();
const Baiguullaga = require("../models/baiguullaga");
const Ajiltan = require("../models/ajiltan");
//const { crudWithFile, crud } = require("../components/crud");
//const UstsanBarimt = require("../models/ustsanBarimt");
const { tokenShalgakh, crud, UstsanBarimt } = require("zevbackv2");
const axios = require("axios");
const request = require("request");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");

crud(router, "baiguullaga", Baiguullaga, UstsanBarimt);
router.post("/baiguullagaBurtgekh", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const baiguullaga = new Baiguullaga(db.erunkhiiKholbolt)(req.body);
    console.log("------------->" + JSON.stringify(baiguullaga));
    baiguullaga.isNew = !baiguullaga.zasakhEsekh;
    baiguullaga.barilguud = [
      {
        ner: baiguullaga.ner,
        khayag: baiguullaga.khayag,
        register: baiguullaga.register,
      },
    ];
    baiguullaga
      .save()
      .then((result) => {
        db.kholboltNemye(
          baiguullaga._id,
          req.body.baaziinNer
          // "127.0.0.1:27017",
          // "admin",
          // "Br1stelback1"
        );
        if (req.body.ajiltan) {
          let ajiltan = new Ajiltan(db.erunkhiiKholbolt)(req.body.ajiltan);
          ajiltan.erkh = "Admin";
          ajiltan.baiguullagiinId = result._id;
          ajiltan.baiguullagiinNer = result.ner;
          ajiltan
            .save()
            .then((result1) => {
              res.send("Amjilttai");
            })
            .catch((err) => {
              next(err);
            });
        } else res.send("Amjilttai");
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
