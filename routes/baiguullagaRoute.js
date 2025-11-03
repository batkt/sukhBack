const express = require("express");
const router = express.Router();
const Baiguullaga = require("../models/baiguullaga");
const Ajiltan = require("../models/ajiltan");
//const { crudWithFile, crud } = require("../components/crud");
//const UstsanBarimt = require("../models/ustsanBarimt");
const TatvariinAlba = require("../models/tatvariinAlba");
const { tokenShalgakh, crud, UstsanBarimt, khuudaslalt } = require("zevbackv2");
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
          req.body.baaziinNer,
          "127.0.0.1:27017",
          "admin",
          "Br1stelback1"
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

router.post("/salbarBurtgey", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    Baiguullaga(db.erunkhiiKholbolt)
      .updateOne(
        { register: req.body.tolgoiCompany },
        {
          $push: {
            barilguud: {
              licenseRegister: req.body.register,
              ner: req.body.ner,
              khayag: req.body.khayag,
            },
          },
        }
      )
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

router.post("/baiguullagaAvya", (req, res, next) => {
  const { db } = require("zevbackv2");
  Baiguullaga(db.erunkhiiKholbolt)
    .findOne({
      register: req.body.register,
    })
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      next(err);
    });
});

router.get("/baiguullagaBairshilaarAvya", (req, res, next) => {
  const { db } = require("zevbackv2");

  Baiguullaga(db.erunkhiiKholbolt)
    .find(
      {},
      {
        _id: 1,
        "barilguud.tokhirgoo.duuregNer": 1,
        "barilguud.tokhirgoo.districtCode": 1,
        "barilguud.tokhirgoo.sohNer": 1,
        "barilguud.tokhirgoo.horoo": 1,
        "barilguud.tokhirgoo.orts": 1,
        "barilguud.tokhirgoo.davkhar": 1,
      }
    )
    .then((result) => {
      const transformedResult = result.map((item) => {
        const tokhirgoo = item.barilguud?.[0]?.tokhirgoo;
        return {
          baiguullagiinId: item._id,
          duuregNer: tokhirgoo?.duuregNer || "",
          districtCode: tokhirgoo?.districtCode || "",
          sohNer: tokhirgoo?.sohNer || "",
          horoo: tokhirgoo?.horoo || {},
          orts: tokhirgoo?.orts || "",
          davkhar: tokhirgoo?.davkhar || "",
        };
      });

      res.json({
        success: true,
        message: "Бүх байгууллагын мэдээлэл олдлоо",
        result: transformedResult,
      });
    })
    .catch((err) => {
      next(err);
    });
});

router.get("/tatvariinAlba", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    const body = req.query;
    if (!!body?.query) body.query = JSON.parse(body.query);
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.khuudasniiDugaar)
      body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
    if (!!body?.khuudasniiKhemjee)
      body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);
    if (!!body?.search) body.search = String(body.search);
    khuudaslalt(TatvariinAlba(db.erunkhiiKholbolt), body)
      .then((result) => {
        res.send(result);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/tatvariinAlbaOlnoorNemye",
  tokenShalgakh,
  async (req, res, next) => {
    const { db } = require("zevbackv2");

    try {
      const jagsaalt = req.body.jagsaalt;
      TatvariinAlba(db.erunkhiiKholbolt)
        .insertMany(jagsaalt)
        .then((x) => {
          res.send(x);
        })
        .catch((a) => {
          next(a);
        });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/barilgaBurtgekh", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, ner, sohNer, orts, davkhar } = req.body;

    if (!baiguullagiinId || !ner || !sohNer) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId, ner, and sohNer are required",
      });
    }

    // Find the baiguullaga
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );

    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллага олдсонгүй",
      });
    }

    // Check if barilguud array exists and has at least one barilga
    if (!baiguullaga.barilguud || baiguullaga.barilguud.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагад барилга байхгүй байна",
      });
    }

    // Get the first barilga (the template)
    const firstBarilga = baiguullaga.barilguud[0];

    // Create a new barilga object by copying the first one
    // But use main baiguullaga tokhirgoo as base, then merge with first barilga's tokhirgoo
    const newBarilga = {
      ner: ner,
      khayag: firstBarilga.khayag || baiguullaga.khayag || "",
      register: firstBarilga.register || baiguullaga.register || "",
      niitTalbai: firstBarilga.niitTalbai || 0,
      bairshil: firstBarilga.bairshil || {
        type: "Point",
        coordinates: [],
      },
      // Get main tokhirgoo from baiguullaga, then merge with first barilga's barilga-specific tokhirgoo
      tokhirgoo: firstBarilga.tokhirgoo
        ? JSON.parse(JSON.stringify(firstBarilga.tokhirgoo))
        : baiguullaga.tokhirgoo
        ? JSON.parse(JSON.stringify(baiguullaga.tokhirgoo))
        : {},
      davkharuud: firstBarilga.davkharuud
        ? JSON.parse(JSON.stringify(firstBarilga.davkharuud))
        : [],
    };

    // Update sohNer, orts, and davkhar in tokhirgoo
    if (newBarilga.tokhirgoo) {
      newBarilga.tokhirgoo.sohNer = sohNer;
      if (orts !== undefined) {
        newBarilga.tokhirgoo.orts = orts;
      }
      if (davkhar !== undefined) {
        newBarilga.tokhirgoo.davkhar = davkhar;
      }
    }

    // Add the new barilga to the barilguud array
    baiguullaga.barilguud.push(newBarilga);
    await baiguullaga.save();

    // Get the newly created barilga ID (last one in the array)
    const newBarilgiinId = baiguullaga.barilguud[
      baiguullaga.barilguud.length - 1
    ]._id.toString();

    // Find the company's database connection
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
    );

    if (tukhainBaaziinKholbolt) {
      // Copy ashiglaltiinZardluud from first barilga to new barilga
      const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
      const firstBarilgiinId = firstBarilga._id.toString();

      // Find all ashiglaltiinZardluud entries for the first barilga
      const existingZardluud = await AshiglaltiinZardluud(
        tukhainBaaziinKholbolt
      ).find({
        baiguullagiinId: baiguullagiinId,
        barilgiinId: firstBarilgiinId,
      });

      // Create copies for the new barilga
      if (existingZardluud && existingZardluud.length > 0) {
        const newZardluudArray = existingZardluud.map((zardal) => {
          const zardalObj = zardal.toObject();
          delete zardalObj._id;
          delete zardalObj.__v;
          delete zardalObj.createdAt;
          delete zardalObj.updatedAt;
          return {
            ...zardalObj,
            barilgiinId: newBarilgiinId,
          };
        });

        await AshiglaltiinZardluud(tukhainBaaziinKholbolt).insertMany(
          newZardluudArray
        );
      }
    }

    res.json({
      success: true,
      message: "Барилга амжилттай бүртгэгдлээ",
      result: {
        baiguullagiinId: baiguullagiinId,
        barilgiinId: newBarilgiinId,
        ner: ner,
        sohNer: sohNer,
        orts: orts || "",
        davkhar: davkhar || "",
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
