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

// Validation function for duplicate toots
function validateDavkhariinToonuud(barilguud) {
  if (!barilguud || !Array.isArray(barilguud)) {
    return null; // No error
  }

  // Check each building's davkhariinToonuud for duplicate toots across davkhars
  for (let barilgaIndex = 0; barilgaIndex < barilguud.length; barilgaIndex++) {
    const barilga = barilguud[barilgaIndex];
    
    if (!barilga.tokhirgoo || !barilga.tokhirgoo.davkhariinToonuud) {
      continue;
    }

    const davkhariinToonuud = barilga.tokhirgoo.davkhariinToonuud;
    // Map<toot, {davkhars: Set, floorKeys: Array}> - track which davkhars and floor keys each toot appears in
    const tootMap = new Map();

    // Iterate through all floor keys (format: "orts::davkhar" or just "davkhar")
    for (const [floorKey, tootArray] of Object.entries(davkhariinToonuud)) {
      if (!tootArray || !Array.isArray(tootArray)) {
        continue;
      }

      // Extract davkhar from floorKey
      let davkhar = "";
      if (floorKey.includes("::")) {
        const parts = floorKey.split("::");
        davkhar = parts[1] || parts[0]; // davkhar is the second part (e.g., "1::4" -> "4")
      } else {
        davkhar = floorKey; // If no ::, the key itself is davkhar (e.g., "1" -> "1")
      }

      // Parse toot list from array (can be comma-separated string or array)
      let tootList = [];
      if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
        tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
      } else {
        tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
      }

      // Check each toot for duplicates across DIFFERENT davkhars
      for (const toot of tootList) {
        if (tootMap.has(toot)) {
          const tootInfo = tootMap.get(toot);
          // Only error if this toot appears in a DIFFERENT davkhar
          if (!tootInfo.davkhars.has(davkhar)) {
            // This toot already exists in a different davkhar
            const existingDavkhars = Array.from(tootInfo.davkhars).join(", ");
            const existingFloorKeys = tootInfo.floorKeys.join(", ");
            console.error(`❌ [VALIDATION] Duplicate detected: toot "${toot}" in davkhar ${existingDavkhars} (floorKeys: ${existingFloorKeys}) and davkhar ${davkhar} (floorKey: ${floorKey})`);
            return new Error(
              `Тоот "${toot}" аль хэдийн ${existingDavkhars}-р давхарт байна (floor keys: ${existingFloorKeys}). ${davkhar}-р давхарт давхардсан тоот байж болохгүй!`
            );
          }
          // Same davkhar, same toot - this is OK (might be in different floor keys like "1" and "1::1")
          // Add this floor key to the list
          if (!tootInfo.floorKeys.includes(floorKey)) {
            tootInfo.floorKeys.push(floorKey);
          }
        } else {
          // First time seeing this toot, create tracking info
          tootMap.set(toot, {
            davkhars: new Set([davkhar]),
            floorKeys: [floorKey]
          });
        }
      }
    }
  }

  return null; // No error
}

// Custom PUT route with validation - MUST be before crud() to intercept PUT requests
router.put("/baiguullaga/:id", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    console.log(`🔍 [ROUTE VALIDATION] PUT request to /baiguullaga/${req.params.id}`);
    
    // Validate barilguud if present in request body
    if (req.body.barilguud && Array.isArray(req.body.barilguud)) {
      console.log(`🔍 [ROUTE VALIDATION] Validating ${req.body.barilguud.length} buildings for duplicate toots...`);
      
      // Fetch current document to understand what's being changed
      const currentDoc = await Baiguullaga(db.erunkhiiKholbolt).findById(req.params.id).lean();
      
      if (!currentDoc) {
        return res.status(404).json({
          success: false,
          message: "Байгууллага олдсонгүй",
        });
      }
      
      // The request body contains the NEW state, so validate it directly
      // This allows users to remove duplicates by updating the data
      console.log(`🔍 [ROUTE VALIDATION] Validating new state (allows removing duplicates)...`);
      
      // Log what we're validating for debugging
      req.body.barilguud.forEach((barilga, idx) => {
        if (barilga.tokhirgoo && barilga.tokhirgoo.davkhariinToonuud) {
          console.log(`🔍 [ROUTE VALIDATION] Barilga[${idx}] (${barilga.ner || 'N/A'}) davkhariinToonuud:`, JSON.stringify(barilga.tokhirgoo.davkhariinToonuud, null, 2));
        }
      });
      
      const error = validateDavkhariinToonuud(req.body.barilguud);
      if (error) {
        console.error(`❌ [ROUTE VALIDATION] Validation failed:`, error.message);
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.log(`✅ [ROUTE VALIDATION] Validation passed, proceeding with update`);
    }
    
    // If validation passes, proceed with the update using findByIdAndUpdate
    const result = await Baiguullaga(db.erunkhiiKholbolt).findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Байгууллага олдсонгүй",
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [ROUTE VALIDATION] Error:`, error);
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
