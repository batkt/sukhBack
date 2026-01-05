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

// Custom GET handler to filter barilguud by barilgiinId - must be before crud() call
router.get("/baiguullaga/:id", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { id } = req.params;
    const { barilgiinId } = req.query;

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
      .findById(id)
      .lean();

    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллага олдсонгүй",
      });
    }

    // If barilgiinId is provided, filter barilguud to only include the matching barilga
    if (barilgiinId) {
      const filteredBarilga = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );

      if (!filteredBarilga) {
        return res.status(404).json({
          success: false,
          message: "Барилгын мэдээлэл олдсонгүй",
        });
      }

      // Return baiguullaga with only the filtered barilga
      return res.json({
        ...baiguullaga,
        barilguud: [filteredBarilga],
      });
    }

    // If no barilgiinId provided, return full baiguullaga (default behavior)
    res.json(baiguullaga);
  } catch (error) {
    next(error);
  }
});

crud(router, "baiguullaga", Baiguullaga, UstsanBarimt);

router.post("/baiguullagaBurtgekh", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const baiguullaga = new Baiguullaga(db.erunkhiiKholbolt)(req.body);
    console.log("------------->" + JSON.stringify(baiguullaga));
    baiguullaga.isNew = !baiguullaga.zasakhEsekh;
    // Don't create default barilga - only create when explicitly requested from frontend
    // If barilguud is provided in req.body, it will be used, otherwise it will be empty
    baiguullaga
      .save()
      .then(async (result) => {
        try {
          // Create separate database for the organization
          // Note: kholboltNemye should include authSource=admin in connection string
          await db.kholboltNemye(
            baiguullaga._id,
            req.body.baaziinNer,
            false, // cloudMongoDBEsekh
            "127.0.0.1:27017",
            "Br1stelback1",
            "admin"
          );
          console.log(
            `✅ Database connection created for: ${req.body.baaziinNer}`
          );

          // Verify connection was created
          const createdConnection = db.kholboltuud?.find(
            (k) => String(k.baiguullagiinId) === String(baiguullaga._id)
          );
          if (createdConnection) {
            console.log(`✅ Connection verified for ${req.body.baaziinNer}`);
          } else {
            console.warn(
              `⚠️ Connection not found in kholboltuud for ${req.body.baaziinNer}`
            );
          }
        } catch (dbErr) {
          console.error(
            `❌ Failed to create database connection for ${req.body.baaziinNer}:`,
            dbErr
          );
          // Continue anyway - organization is saved
        }

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
        ner: 1,
        dotoodNer: 1,
        register: 1,
        khayag: 1,
        "barilguud._id": 1,
        "barilguud.ner": 1,
        "barilguud.tokhirgoo.duuregNer": 1,
        "barilguud.tokhirgoo.districtCode": 1,
        "barilguud.tokhirgoo.sohNer": 1,
        "barilguud.tokhirgoo.horoo": 1,
        "barilguud.tokhirgoo.davkhar": 1,
        "barilguud.tokhirgoo.davkhariinToonuud": 1,
      }
    )
    .then((result) => {
      const transformedResult = result.map((item) => {
        // Transform all barilguud into an array
        const barilguud = (item.barilguud || []).map((barilga) => {
          const tokhirgoo = barilga?.tokhirgoo;
          return {
            barilgiinId: barilga._id?.toString() || "",
            bairniiNer: barilga?.ner || "", // Барилгын нэр from barilguud[].ner
            duuregNer: tokhirgoo?.duuregNer || "",
            districtCode: tokhirgoo?.districtCode || "",
            sohNer: tokhirgoo?.sohNer || "",
            horoo: tokhirgoo?.horoo || {},
            davkhar: Array.isArray(tokhirgoo?.davkhar)
              ? tokhirgoo.davkhar
              : tokhirgoo?.davkhar
              ? [tokhirgoo.davkhar]
              : [],
            davkhariinToonuud: tokhirgoo?.davkhariinToonuud || {}, // Include davkhariinToonuud structure
          };
        });

        return {
          baiguullagiinId: item._id,
          baiguullagiinNer: item.ner || "",
          dotoodNer: item.dotoodNer || "",
          register: item.register || "",
          khayag: item.khayag || "",
          barilguud: barilguud, // Array of all buildings
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
    const { baiguullagiinId, ner, sohNer, davkhar } = req.body;

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

    // Update sohNer and davkhar in tokhirgoo
    // davkhar is an array
    // Note: bairniiNer comes from barilga.ner, not from tokhirgoo
    if (newBarilga.tokhirgoo) {
      newBarilga.tokhirgoo.sohNer = sohNer;
      if (davkhar !== undefined) {
        newBarilga.tokhirgoo.davkhar = Array.isArray(davkhar)
          ? davkhar
          : davkhar
          ? [davkhar]
          : [];
      }
    }

    // Add the new barilga to the barilguud array
    baiguullaga.barilguud.push(newBarilga);
    await baiguullaga.save();

    // Get the newly created barilga ID (last one in the array)
    const newBarilgiinId =
      baiguullaga.barilguud[baiguullaga.barilguud.length - 1]._id.toString();

    // Find the company's database connection
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
    );

    if (tukhainBaaziinKholbolt) {
      // Copy ashiglaltiinZardluud from first barilga tokhirgoo to new barilga tokhirgoo
      const firstBarilgiinId = firstBarilga._id.toString();
      const existingZardluud =
        firstBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
      const existingLiftShalgaya = firstBarilga.tokhirgoo?.liftShalgaya || {};
      const existingDans = firstBarilga.tokhirgoo?.dans || null;

      // Copy to new barilga's tokhirgoo
      if (existingZardluud && existingZardluud.length > 0) {
        const newZardluudArray = existingZardluud.map((zardal) => {
          // Create a clean copy without Mongoose metadata
          const zardalCopy = JSON.parse(JSON.stringify(zardal));
          return zardalCopy;
        });

        // Find the new barilga index and update its tokhirgoo
        const newBarilgaIndex = baiguullaga.barilguud.findIndex(
          (b) => String(b._id) === String(newBarilgiinId)
        );

        if (newBarilgaIndex >= 0) {
          if (!baiguullaga.barilguud[newBarilgaIndex].tokhirgoo) {
            baiguullaga.barilguud[newBarilgaIndex].tokhirgoo = {};
          }
          baiguullaga.barilguud[
            newBarilgaIndex
          ].tokhirgoo.ashiglaltiinZardluud = newZardluudArray;

          // Also copy liftShalgaya
          if (
            existingLiftShalgaya &&
            Object.keys(existingLiftShalgaya).length > 0
          ) {
            baiguullaga.barilguud[newBarilgaIndex].tokhirgoo.liftShalgaya =
              JSON.parse(JSON.stringify(existingLiftShalgaya));
          }

          // Also copy dans (bank account info)
          if (existingDans) {
            baiguullaga.barilguud[newBarilgaIndex].tokhirgoo.dans = JSON.parse(
              JSON.stringify(existingDans)
            );
          }

          await baiguullaga.save();
        }
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
        bairniiNer: ner, // Барилгын нэр comes from barilga.ner
        davkhar: Array.isArray(davkhar) ? davkhar : davkhar ? [davkhar] : [],
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
