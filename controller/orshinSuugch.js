const asyncHandler = require("express-async-handler");
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const MsgTuukh = require("../models/msgTuukh");
const IpTuukh = require("../models/ipTuukh");
const BatalgaajuulahCode = require("../models/batalgaajuulahCode");
const Geree = require("../models/geree");
const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const aldaa = require("../components/aldaa");
const request = require("request");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const walletApiService = require("../services/walletApiService");

const useragent = require("express-useragent");

async function verifyCodeHelper(baiguullagiinId, utas, code) {
  const { db } = require("zevbackv2");

  if (code.length !== 4 || !/^\d+$/.test(code)) {
    return {
      success: false,
      message: "Код буруу байна!",
    };
  }

  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
  );

  if (!tukhainBaaziinKholbolt) {
    return {
      success: false,
      message: "Холболтын мэдээлэл олдсонгүй!",
    };
  }

  const BatalgaajuulahCodeModel = BatalgaajuulahCode(tukhainBaaziinKholbolt);
  const verificationResult = await BatalgaajuulahCodeModel.verifyCode(
    utas,
    code,
    "password_reset"
  );

  if (!verificationResult.success) {
    await BatalgaajuulahCodeModel.incrementAttempts(
      utas,
      code,
      "password_reset"
    );
  }

  return verificationResult;
}

async function validateCodeOnly(
  baiguullagiinId,
  utas,
  code,
  purpose = "password_reset"
) {
  const { db } = require("zevbackv2");

  if (code.length !== 4 || !/^\d+$/.test(code)) {
    return {
      success: false,
      message: "Код буруу байна!",
    };
  }

  const tukhainBaaziinKholbolt = db.kholboltuud.find(
    (kholbolt) => kholbolt.baiguullagiinId === baiguullagiinId
  );

  if (!tukhainBaaziinKholbolt) {
    return {
      success: false,
      message: "Холболтын мэдээлэл олдсонгүй!",
    };
  }

  const BatalgaajuulahCodeModel = BatalgaajuulahCode(tukhainBaaziinKholbolt);

  const verificationCode = await BatalgaajuulahCodeModel.findOne({
    utas,
    code,
    purpose,
    khereglesenEsekh: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verificationCode) {
    return {
      success: false,
      message: "Хүчингүй код байна!",
    };
  }

  if (verificationCode.oroldlogo >= verificationCode.niitOroldokhErkh) {
    return {
      success: false,
      message: "Хэт их оролдлого хийгдсэн байна!",
    };
  }

  return {
    success: true,
    message: "Код зөв байна",
  };
}

function duusakhOgnooAvya(ugugdul, onFinish, next) {
  request.get(
    "http://103.143.40.123:8282/baiguullagiinDuusakhKhugatsaaAvya",
    { json: true, body: ugugdul },
    (err, res1, body) => {
      if (err) next(err);
      else {
        onFinish(body);
      }
    }
  );
}

// Helper function to update davkhar with toot in baiguullaga
// Structure: davkhar: ["1", "2", "3"], davkhariinToonuud: {1: ["103,104,105"], 2: ["201,202"]}
exports.updateDavkharWithToot = async function updateDavkharWithToot(
  baiguullaga,
  barilgiinId,
  davkhar,
  toot,
  tukhainBaaziinKholbolt
) {
  try {
    const { db } = require("zevbackv2");
    const targetBarilga = baiguullaga.barilguud?.find(
      (b) => String(b._id) === String(barilgiinId)
    );

    if (!targetBarilga) {
      console.log("Барилга олдсонгүй");
      return;
    }

    // Get or create davkhar array and davkhariinToonuud object
    const davkharArray = targetBarilga.tokhirgoo?.davkhar || [];
    const davkhariinToonuud = targetBarilga.tokhirgoo?.davkhariinToonuud || {};

    // Ensure davkhar (floor number) is in the array
    const davkharStr = String(davkhar);
    if (!davkharArray.includes(davkharStr)) {
      davkharArray.push(davkharStr);
      davkharArray.sort((a, b) => parseInt(a) - parseInt(b)); // Sort numerically
    }

    // Get or create toot array for this floor
    const floorKey = parseInt(davkharStr); // Use number as key
    if (!davkhariinToonuud[floorKey]) {
      davkhariinToonuud[floorKey] = [];
    }

    // Get existing toot string for this floor
    const existingToonuud = davkhariinToonuud[floorKey][0] || "";
    let tootList = existingToonuud
      ? existingToonuud
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t)
      : [];

    // Add toot if not already present
    if (toot && !tootList.includes(toot)) {
      tootList.push(toot);
      tootList.sort((a, b) => parseInt(a) - parseInt(b)); // Sort numerically
    }

    // Update davkhariinToonuud - store as array with comma-separated string
    davkhariinToonuud[floorKey] = [tootList.join(",")];

    // Update baiguullaga - find the building index first
    const barilgaIndex = baiguullaga.barilguud.findIndex(
      (b) => String(b._id) === String(barilgiinId)
    );

    if (barilgaIndex >= 0) {
      // Use Mongoose's positional operator for safer nested updates
      const davkharPath = `barilguud.${barilgaIndex}.tokhirgoo.davkhar`;
      const toonuudPath = `barilguud.${barilgaIndex}.tokhirgoo.davkhariinToonuud`;

      await Baiguullaga(db.erunkhiiKholbolt).findByIdAndUpdate(
        baiguullaga._id,
        {
          $set: {
            [davkharPath]: davkharArray,
            [toonuudPath]: davkhariinToonuud,
          },
        },
        { new: false }
      );
    }

    // Reload baiguullaga to get latest data
    const updatedBaiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullaga._id
    );
    const finalDavkharArray =
      updatedBaiguullaga?.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      )?.tokhirgoo?.davkhar || davkharArray;

    // Calculate and update liftShalgaya
    await exports.calculateLiftShalgaya(
      baiguullaga._id.toString(),
      barilgiinId,
      finalDavkharArray,
      tukhainBaaziinKholbolt
    );
  } catch (error) {
    console.error("Error updating davkhar with toot:", error);
  }
};

// Helper function to calculate liftShalgaya based on davkhar entries
// Now saves to baiguullaga.barilguud[].tokhirgoo.liftShalgaya
exports.calculateLiftShalgaya = async function calculateLiftShalgaya(
  baiguullagiinId,
  barilgiinId,
  davkharArray,
  tukhainBaaziinKholbolt
) {
  try {
    const { db } = require("zevbackv2");
    const Baiguullaga = require("../models/baiguullaga");

    // davkharArray is already an array of floor numbers like ["1", "2", "3"]
    // Extract all unique floor numbers
    const choloolugdokhDavkhar = [
      ...new Set(davkharArray.map((f) => String(f))),
    ];

    // Update liftShalgaya in baiguullaga.barilguud[].tokhirgoo
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga) {
      console.error("Байгууллага олдсонгүй");
      return;
    }

    const barilgaIndex = baiguullaga.barilguud.findIndex(
      (b) => String(b._id) === String(barilgiinId)
    );

    if (barilgaIndex >= 0) {
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo = {};
      }
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya = {};
      }
      baiguullaga.barilguud[
        barilgaIndex
      ].tokhirgoo.liftShalgaya.choloolugdokhDavkhar = choloolugdokhDavkhar;
      await baiguullaga.save();

      console.log(
        `LiftShalgaya updated: ${choloolugdokhDavkhar.length} floors exempted`
      );
    } else {
      console.error("Барилга олдсонгүй");
    }
  } catch (error) {
    console.error("Error calculating liftShalgaya:", error);
  }
};

exports.orshinSuugchBurtgey = asyncHandler(async (req, res, next) => {
  try {
    console.log("Энэ рүү орлоо: orshinSuugchBurtgey");
    console.log("📥 REQUEST BODY:", {
      barilgiinId: req.body.barilgiinId,
      baiguullagiinId: req.body.baiguullagiinId,
      toot: req.body.toot,
      davkhar: req.body.davkhar,
      orts: req.body.orts,
      duureg: req.body.duureg,
      horoo: req.body.horoo,
      soh: req.body.soh,
      sohNer: req.body.sohNer,
      bairniiNer: req.body.bairniiNer,
    });
    const { db } = require("zevbackv2");

    if (!req.body.duureg || !req.body.horoo || !req.body.soh) {
      throw new aldaa("Дүүрэг, Хороо, СӨХ заавал бөглөх шаардлагатай!");
    }

    if (!req.body.baiguullagiinId) {
      throw new aldaa("Байгууллагын ID заавал бөглөх шаардлагатай!");
    }

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    if (!req.body.nuutsUg) {
      throw new aldaa("Нууц үг заавал бөглөх шаардлагатай!");
    }

    if (!req.body.ner) {
      throw new aldaa("Нэр заавал бөглөх шаардлагатай!");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );

    if (!baiguullaga) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
    }

    // Check for existing user by utas
    const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      utas: req.body.utas,
    });

    // If user exists and is active (not deleted), throw error
    if (existingUser) {
      throw new aldaa("Утасны дугаар давхардаж байна!");
    }

    // Check for cancelled gerees by utas (user might have been deleted but gerees still exist)
    // This allows restoring data when re-registering
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
    );

    let existingCancelledGeree = null;
    if (tukhainBaaziinKholbolt) {
      const GereeModel = Geree(tukhainBaaziinKholbolt);
      // Find cancelled geree by utas (not by orshinSuugchId since user was deleted)
      existingCancelledGeree = await GereeModel.findOne({
        utas: { $in: [req.body.utas] }, // utas is an array in geree
        tuluv: "Цуцалсан",
        baiguullagiinId: baiguullaga._id.toString(),
      });
    }

    // Use barilgiinId from request if provided - RESPECT IT!
    // Check all possible fields where barilgiinId might be sent
    let barilgiinId =
      (req.body.barilgiinId && req.body.barilgiinId.toString().trim()) ||
      (req.body.barilgaId && req.body.barilgaId.toString().trim()) ||
      null;

    console.log(`🔍 barilgiinId check:`, {
      "req.body.barilgiinId": req.body.barilgiinId,
      "req.body.barilgaId": req.body.barilgaId,
      "req.body.bairniiNer": req.body.bairniiNer,
      "final barilgiinId": barilgiinId,
      type: typeof req.body.barilgiinId,
      isTruthy: !!req.body.barilgiinId,
    });

    // If barilgiinId is provided, use it directly - don't search!
    if (barilgiinId) {
      // Validate that this barilgiinId exists in baiguullaga
      const providedBarilga = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );
      if (providedBarilga) {
        console.log(
          `✅ Using provided barilgiinId: ${barilgiinId} (${providedBarilga.ner})`
        );
      } else {
        console.log(
          `⚠️  Provided barilgiinId ${barilgiinId} not found in baiguullaga, will search instead`
        );
        barilgiinId = null; // Reset to null so we can search
      }
    }

    // If barilgiinId not provided but bairniiNer (building name) is provided, find by name
    if (!barilgiinId && req.body.bairniiNer && baiguullaga.barilguud) {
      const bairniiNerToFind = req.body.bairniiNer.toString().trim();
      const barilgaByName = baiguullaga.barilguud.find(
        (b) => String(b.ner).trim() === bairniiNerToFind
      );
      if (barilgaByName) {
        barilgiinId = String(barilgaByName._id);
        console.log(
          `✅ Found building by name (bairniiNer): ${bairniiNerToFind} -> ${barilgiinId} (${barilgaByName.ner})`
        );
      } else {
        console.log(
          `⚠️  Building name "${bairniiNerToFind}" not found in baiguullaga, available buildings:`,
          baiguullaga.barilguud.map((b) => b.ner).join(", ")
        );
      }
    }

    // If still no barilgiinId, try to match by location (duureg, horoo, sohNer)
    if (
      !barilgiinId &&
      req.body.duureg &&
      req.body.horoo &&
      req.body.soh &&
      baiguullaga.barilguud
    ) {
      const duuregToFind = req.body.duureg.toString().trim();
      const horooToFind = req.body.horoo.toString().trim();
      const sohToFind = req.body.soh.toString().trim();
      const sohNerToFind = req.body.sohNer
        ? req.body.sohNer.toString().trim()
        : null;

      console.log(
        `🔍 Trying to find building by location: duureg=${duuregToFind}, horoo=${horooToFind}, soh=${sohToFind}, sohNer=${sohNerToFind}`
      );

      const barilgaByLocation = baiguullaga.barilguud.find((b) => {
        const tokhirgoo = b.tokhirgoo || {};
        const barilgaDuureg = tokhirgoo.duuregNer
          ? String(tokhirgoo.duuregNer).trim()
          : "";
        const barilgaHoroo = tokhirgoo.horoo?.ner
          ? String(tokhirgoo.horoo.ner).trim()
          : "";
        const barilgaSohNer = tokhirgoo.sohNer
          ? String(tokhirgoo.sohNer).trim()
          : "";

        // Match on duureg, horoo, and sohNer if provided
        const duuregMatch = !barilgaDuureg || barilgaDuureg === duuregToFind;
        const horooMatch = !barilgaHoroo || barilgaHoroo === horooToFind;
        const sohMatch =
          !sohNerToFind ||
          !barilgaSohNer ||
          barilgaSohNer === sohNerToFind ||
          barilgaSohNer === sohToFind;

        return duuregMatch && horooMatch && sohMatch;
      });

      if (barilgaByLocation) {
        barilgiinId = String(barilgaByLocation._id);
        console.log(
          `✅ Found building by location: ${barilgiinId} (${barilgaByLocation.ner})`
        );
      } else {
        console.log(
          `⚠️  No building found matching location: duureg=${duuregToFind}, horoo=${horooToFind}, soh=${sohToFind}`
        );
      }
    }

    // Only search for building if barilgiinId is NOT provided in the request
    if (
      !barilgiinId &&
      req.body.toot &&
      baiguullaga.barilguud &&
      baiguullaga.barilguud.length > 1
    ) {
      console.log(
        `🔍 Searching for building because barilgiinId was not provided...`
      );
      const tootToFind = req.body.toot.trim();
      const davkharToFind = req.body.davkhar ? req.body.davkhar.trim() : null;
      const ortsToFind = req.body.orts ? req.body.orts.trim() : "1";
      const floorKey = davkharToFind ? `${ortsToFind}::${davkharToFind}` : null;

      let foundBuilding = null;
      let foundBuildings = []; // Track all matches if davkhar not provided

      // Search through all buildings to find which one contains this toot
      for (const barilga of baiguullaga.barilguud) {
        const davkhariinToonuud = barilga.tokhirgoo?.davkhariinToonuud || {};

        if (floorKey && davkhariinToonuud[floorKey]) {
          // If davkhar is provided, match on exact floorKey
          const tootArray = davkhariinToonuud[floorKey];

          if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
            let tootList = [];

            if (
              typeof tootArray[0] === "string" &&
              tootArray[0].includes(",")
            ) {
              tootList = tootArray[0]
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t);
            } else {
              tootList = tootArray
                .map((t) => String(t).trim())
                .filter((t) => t);
            }

            if (tootList.includes(tootToFind)) {
              foundBuilding = barilga;
              break;
            }
          }
        } else if (!floorKey) {
          // If davkhar is NOT provided, search all floors for this toot
          for (const [key, tootArray] of Object.entries(davkhariinToonuud)) {
            if (!key.includes("::")) {
              continue;
            }

            if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
              let tootList = [];

              if (
                typeof tootArray[0] === "string" &&
                tootArray[0].includes(",")
              ) {
                tootList = tootArray[0]
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t);
              } else {
                tootList = tootArray
                  .map((t) => String(t).trim())
                  .filter((t) => t);
              }

              if (tootList.includes(tootToFind)) {
                foundBuildings.push(barilga);
                break; // Found in this building, move to next building
              }
            }
          }
        }
      }

      // If davkhar was provided and we found a match, use it
      if (foundBuilding) {
        barilgiinId = String(foundBuilding._id);
        console.log(
          `✅ Found building ${foundBuilding.ner} (${barilgiinId}) for davkhar=${davkharToFind}, orts=${ortsToFind}, toot=${tootToFind}`
        );
      } else if (foundBuildings.length === 1) {
        // If davkhar not provided but only one building has this toot, use it
        barilgiinId = String(foundBuildings[0]._id);
        console.log(
          `✅ Found unique building ${foundBuildings[0].ner} (${barilgiinId}) for toot ${tootToFind}`
        );
      } else if (foundBuildings.length > 1) {
        // Multiple buildings have this toot - use first one (original behavior)
        barilgiinId = String(foundBuildings[0]._id);
        console.log(
          `⚠️  Multiple buildings found for toot ${tootToFind}, using first: ${foundBuildings[0].ner} (${barilgiinId})`
        );
      } else if (davkharToFind) {
        console.log(
          `⚠️  Could not find building for davkhar=${davkharToFind}, orts=${ortsToFind}, toot=${tootToFind}`
        );
      }
    }

    // If still no barilgiinId, use first building as fallback
    if (
      !barilgiinId &&
      baiguullaga.barilguud &&
      baiguullaga.barilguud.length > 0
    ) {
      barilgiinId = String(baiguullaga.barilguud[0]._id);
      console.log(`⚠️  Using first building as fallback: ${barilgiinId}`);
    }

    // Check if toot already has a registered user (1:1 relationship - one toot can only have one user)
    if (req.body.toot && barilgiinId) {
      const tootToCheck = req.body.toot.trim();
      const existingTootUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
        toot: tootToCheck,
        barilgiinId: barilgiinId,
      });

      if (existingTootUser) {
        throw new aldaa(
          `(${tootToCheck}) тоот бүртгэл үүссэн байна`
        );
      }
    }

    // Automatically determine davkhar from toot if toot is provided
    let determinedDavkhar = req.body.davkhar || "";

    if (req.body.toot && barilgiinId) {
      const targetBarilga = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );

      if (targetBarilga) {
        const davkhariinToonuud =
          targetBarilga.tokhirgoo?.davkhariinToonuud || {};
        const tootToFind = req.body.toot.trim();
        let foundFloor = null;
        let foundOrts = null;

        // Search through all floors to find which floor contains this toot
        // Key format: 'orts::davkhar' (e.g., '1::1' = Entrance 1, Floor 1)
        for (const [floorKey, tootArray] of Object.entries(davkhariinToonuud)) {
          // Skip invalid entries that don't have :: separator (like '456')
          if (!floorKey.includes("::")) {
            continue;
          }

          if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
            let tootList = [];

            // Handle both formats:
            // Format 1: ['101,102,103'] - comma-separated string in first element
            // Format 2: ['101', '102', '103'] - array of individual strings
            if (
              typeof tootArray[0] === "string" &&
              tootArray[0].includes(",")
            ) {
              // Comma-separated format
              tootList = tootArray[0]
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t);
            } else {
              // Array of individual strings format
              tootList = tootArray
                .map((t) => String(t).trim())
                .filter((t) => t);
            }

            if (tootList.includes(tootToFind)) {
              // Parse key format: 'orts::davkhar' (e.g., '1::1' or '1::2')
              const parts = floorKey.split("::");
              if (parts.length === 2) {
                foundOrts = parts[0].trim(); // orts (entrance)
                foundFloor = parts[1].trim(); // davkhar (floor)
              }
              break;
            }
          }
        }

        // If toot is found in davkhariinToonuud, use that floor and orts automatically
        if (foundFloor) {
          determinedDavkhar = foundFloor;
          // Also set orts if found (unless already provided from frontend)
          if (foundOrts && !req.body.orts) {
            req.body.orts = foundOrts;
          }
        } else {
          // If toot is not found in davkhariinToonuud:
          // For registration, always allow new toots to be registered
          // - If davkhar is provided from frontend, use it (allows new toot registration)
          // - If davkhar is not provided, allow registration anyway (will be set later or remain empty)
          // - The toot will be registered in the system when updateDavkharWithToot is called

          // If davkhar is provided from frontend, use it (allows new toot registration)
          if (req.body.davkhar) {
            determinedDavkhar = req.body.davkhar;
          }
          // If davkhar is not provided, determinedDavkhar will remain as empty string or use req.body.davkhar
          // This allows registration of new toots that aren't in the system yet
        }
      }
    }

    let orshinSuugch;
    let isReactivating = false;

    // Create new user (existing user check already handled above)
    const userData = {
      ...req.body,
      baiguullagiinId: baiguullaga._id,
      baiguullagiinNer: baiguullaga.ner,
      barilgiinId: barilgiinId,
      mail: req.body.mail,
      erkh: "OrshinSuugch",
      duureg: req.body.duureg,
      horoo: req.body.horoo,
      soh: req.body.soh,
      nevtrekhNer: req.body.utas,
      toot: req.body.toot || "",
      davkhar: determinedDavkhar, // Automatically determined from toot
      orts: req.body.orts || "", // Automatically determined from toot if found
      ekhniiUldegdel: req.body.ekhniiUldegdel
        ? parseFloat(req.body.ekhniiUldegdel) || 0
        : 0, // Optional: from frontend
    };

    orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
    await orshinSuugch.save();

    try {
      // Reuse tukhainBaaziinKholbolt from above (already declared)
      if (!tukhainBaaziinKholbolt) {
        throw new Error("Байгууллагын холболтын мэдээлэл олдсонгүй");
      }

      // Get ashiglaltiinZardluud from baiguullaga.barilguud[].tokhirgoo
      const targetBarilgaForZardluud = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );
      const ashiglaltiinZardluudData =
        targetBarilgaForZardluud?.tokhirgoo?.ashiglaltiinZardluud || [];

      // Get liftShalgaya from baiguullaga.barilguud[].tokhirgoo
      const liftShalgayaData =
        targetBarilgaForZardluud?.tokhirgoo?.liftShalgaya;
      const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

      const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
        ner: zardal.ner,
        turul: zardal.turul,
        zardliinTurul: zardal.zardliinTurul,
        tariff: zardal.tariff,
        tariffUsgeer: zardal.tariffUsgeer || "",
        tulukhDun: 0, // Default value
        dun: zardal.dun || 0,
        bodokhArga: zardal.bodokhArga || "",
        tseverUsDun: zardal.tseverUsDun || 0,
        bokhirUsDun: zardal.bokhirUsDun || 0,
        usKhalaasniiDun: zardal.usKhalaasniiDun || 0,
        tsakhilgaanUrjver: zardal.tsakhilgaanUrjver || 1,
        tsakhilgaanChadal: zardal.tsakhilgaanChadal || 0,
        tsakhilgaanDemjikh: zardal.tsakhilgaanDemjikh || 0,
        suuriKhuraamj: zardal.suuriKhuraamj || 0,
        nuatNemekhEsekh: zardal.nuatNemekhEsekh || false,
        ognoonuud: zardal.ognoonuud || [],
      }));

      const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
        const tariff = zardal.tariff || 0;

        const isLiftItem =
          zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";

        if (
          isLiftItem &&
          orshinSuugch.davkhar &&
          choloolugdokhDavkhar.includes(orshinSuugch.davkhar)
        ) {
          return total;
        }

        return total + tariff;
      }, 0);

      // If there's a cancelled geree, reactivate it and link it to the new user
      // Do this AFTER fetching charges so we can update zardluud with current charges
      if (existingCancelledGeree && tukhainBaaziinKholbolt) {
        isReactivating = true;
        const GereeModel = Geree(tukhainBaaziinKholbolt);

        // Reactivate the cancelled geree and link it to the new user
        // Update with current charges (zardluud) and niitTulbur
        const updateData = {
          tuluv: "Идэвхтэй", // Reactivate from "Цуцалсан" to "Идэвхтэй"
          gereeniiOgnoo: new Date(), // Update contract date
          orshinSuugchId: orshinSuugch._id.toString(), // Link to new user
          zardluud: zardluudArray, // Update with current charges
          niitTulbur: niitTulbur, // Update with current total
          ashiglaltiinZardal: 0, // Reset to 0
          // Update user info in geree if needed
          ovog: req.body.ovog || existingCancelledGeree.ovog,
          ner: req.body.ner || existingCancelledGeree.ner,
          register: req.body.register || existingCancelledGeree.register,
          utas: [req.body.utas],
          mail: req.body.mail || existingCancelledGeree.mail,
          toot: orshinSuugch.toot || existingCancelledGeree.toot,
          davkhar: orshinSuugch.davkhar || existingCancelledGeree.davkhar,
          duureg: req.body.duureg || existingCancelledGeree.duureg,
          horoo: req.body.horoo || existingCancelledGeree.horoo,
          sohNer: req.body.soh || existingCancelledGeree.sohNer,
        };

        // Add optional fields from frontend if provided
        if (req.body.tailbar) {
          updateData.temdeglel = req.body.tailbar;
        }
        if (req.body.ekhniiUldegdel !== undefined) {
          updateData.ekhniiUldegdel = parseFloat(req.body.ekhniiUldegdel) || 0;
        }

        await GereeModel.findByIdAndUpdate(existingCancelledGeree._id, {
          $set: updateData,
        });
      }

      // barilgiinId is already declared above (line 337), reuse it here
      const targetBarilga = barilgiinId
        ? baiguullaga.barilguud?.find(
            (b) => String(b._id) === String(barilgiinId)
          )
        : null;

      const duuregNer =
        targetBarilga?.tokhirgoo?.duuregNer || req.body.duureg || "";
      const horooData = targetBarilga?.tokhirgoo?.horoo || req.body.horoo || {};
      const sohNer = targetBarilga?.tokhirgoo?.sohNer || req.body.soh || "";

      // Only create new geree if not reactivating (no cancelled geree found)
      if (!isReactivating) {
        const contractData = {
          gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
          gereeniiOgnoo: new Date(),
          turul: "Үндсэн",
          tuluv: "Идэвхтэй",
          ovog: req.body.ovog || "",
          ner: req.body.ner,
          register: req.body.register || "",
          utas: [req.body.utas],
          mail: req.body.mail || "",
          baiguullagiinId: baiguullaga._id,
          baiguullagiinNer: baiguullaga.ner,
          barilgiinId: barilgiinId || "",
          tulukhOgnoo: new Date(),
          ashiglaltiinZardal: 0,
          niitTulbur: niitTulbur,
          toot: orshinSuugch.toot || "",
          davkhar: orshinSuugch.davkhar || "",
          bairNer: req.body.bairniiNer || "",
          sukhBairshil: `${req.body.duureg}, ${req.body.horoo}, ${req.body.soh}`,
          duureg: duuregNer, // Save separately
          horoo: horooData, // Save horoo object separately
          sohNer: sohNer, // Save sohNer separately
          burtgesenAjiltan: orshinSuugch._id,
          orshinSuugchId: orshinSuugch._id.toString(),
          temdeglel: req.body.tailbar || "Автоматаар үүссэн гэрээ", // Optional: tailbar from frontend
          actOgnoo: new Date(),
          baritsaaniiUldegdel: 0,
          ekhniiUldegdel: req.body.ekhniiUldegdel
            ? parseFloat(req.body.ekhniiUldegdel) || 0
            : 0, // Optional: from frontend
          zardluud: zardluudArray,
          segmentuud: [],
          khungulultuud: [],
        };

        const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
        await geree.save();

        // Update davkhar with toot if provided from frontend
        // Frontend should send: { toot: "102", davkhar: "1", barilgiinId: "..." }
        if (orshinSuugch.toot && orshinSuugch.davkhar) {
          console.log(
            `Updating davkhar with toot: Floor ${orshinSuugch.davkhar}, Toot ${orshinSuugch.toot}, Building ${barilgiinId}`
          );
          await exports.updateDavkharWithToot(
            baiguullaga,
            barilgiinId,
            orshinSuugch.davkhar,
            orshinSuugch.toot,
            tukhainBaaziinKholbolt
          );
        } else {
          console.log(
            `Skipping davkhar update - toot: ${orshinSuugch.toot}, davkhar: ${orshinSuugch.davkhar}`
          );
        }

        // Invoice will be created by cron job on scheduled date
        // Do not create invoice immediately for new users
      }

      // If reactivating, check if today is the scheduled invoice creation date
      // Only create invoice if today matches nekhemjlekhCron date
      // Otherwise, let the cron job handle invoice creation on the scheduled date
      // This ensures invoices are created according to the schedule, not immediately on reactivation
      if (isReactivating && existingCancelledGeree && tukhainBaaziinKholbolt) {
        const GereeModel = Geree(tukhainBaaziinKholbolt);
        const reactivatedGeree = await GereeModel.findById(
          existingCancelledGeree._id
        );

        if (reactivatedGeree) {
          try {
            // Check if today matches the nekhemjlekhCron scheduled date
            const NekhemjlekhCron = require("../models/cronSchedule");
            const cronSchedule = await NekhemjlekhCron(
              tukhainBaaziinKholbolt
            ).findOne({
              baiguullagiinId: baiguullaga._id.toString(),
              idevkhitei: true,
            });

            const today = new Date();
            const todayDate = today.getDate();
            const shouldCreateInvoice =
              cronSchedule &&
              cronSchedule.nekhemjlekhUusgekhOgnoo === todayDate;

            if (shouldCreateInvoice) {
              // Today is the scheduled date, create invoice (or return existing unpaid)
              const {
                gereeNeesNekhemjlekhUusgekh,
              } = require("./nekhemjlekhController");

              // This will check for existing unpaid invoices in current month
              // If found, it returns the existing invoice (preserving payment status)
              // If not found, it creates a new invoice
              const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
                reactivatedGeree,
                baiguullaga,
                tukhainBaaziinKholbolt,
                "automataar"
              );

              if (!invoiceResult.success) {
                console.error("Invoice creation failed:", invoiceResult.error);
              } else if (invoiceResult.alreadyExists) {
                console.log(
                  "Existing unpaid invoice found and preserved for reactivated geree:",
                  invoiceResult.nekhemjlekh._id
                );
              } else {
                console.log(
                  "New invoice created for reactivated geree on scheduled date:",
                  invoiceResult.nekhemjlekh._id
                );
              }
            } else {
              // Not the scheduled date, skip invoice creation
              // The cron job will create invoices on the scheduled date
              // Geree already has current month's ashiglaltiinZardluud updated
              console.log(
                `Skipping invoice creation - today (${todayDate}) is not the scheduled date (${
                  cronSchedule?.nekhemjlekhUusgekhOgnoo || "not set"
                }). Cron job will handle it.`
              );
            }
          } catch (invoiceError) {
            console.error(
              "Error checking/creating invoice:",
              invoiceError.message
            );
          }
        }
      }
    } catch (contractError) {
      console.error("Error creating contract:", contractError.message);
    }

    const response = {
      success: true,
      message: isReactivating
        ? "Хэрэглэгч болон гэрээ амжилттай дахин идэвхжүүллээ"
        : "Амжилттай бүртгэгдлээ",
      result: orshinSuugch,
      isReactivated: isReactivating,
      hierarchy: {
        duureg: req.body.duureg,
        horoo: req.body.horoo,
        soh: req.body.soh,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error in orshinSuugchBurtgey:", error.message);
    next(error);
  }
});

exports.davhardsanOrshinSuugchShalgayy = asyncHandler(
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const { utas, baiguullagiinId } = req.body;

      const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
        baiguullagiinId: baiguullagiinId,
        $or: [{ utas: utas }],
      });

      if (existingUser) {
        let message = "";
        if (utas && existingUser.utas === utas) {
          message = "Утасны дугаар давхардаж байна!";
        }

        if (utas && existingUser.utas === utas) {
          message = "Утасны дугаар болон регистр давхардаж байна!";
        }

        return res.json({
          success: false,
          message: message,
        });
      }

      res.json({
        success: true,
        message: "Ашиглах боломжтой",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Toot validation endpoint
exports.tootShalgaya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { toot, baiguullagiinId, utas } = req.body;

    if (!toot) {
      return res.status(400).json({
        success: false,
        message: "Тоот заавал оруулах шаардлагатай!",
      });
    }

    if (!utas) {
      return res.status(400).json({
        success: false,
        message: "Утасны дугаар заавал оруулах шаардлагатай!",
      });
    }

    // Find user by utas
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      utas: utas,
    });

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Бүртгэлгүй тоот байна",
      });
    }

    // Check if provided toot matches registered toot
    if (orshinSuugch.toot && orshinSuugch.toot.trim() === toot.trim()) {
      return res.json({
        success: true,
        message: "Тоот зөв байна",
        result: {
          validated: true,
          toot: orshinSuugch.toot,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Бүртгэлгүй тоот байна",
      });
    }
  } catch (error) {
    next(error);
  }
});

exports.orshinSuugchNevtrey = asyncHandler(async (req, res, next) => {
  try {
    console.log("🔐 [WALLET LOGIN] Login request received");
    console.log("🔐 [WALLET LOGIN] Phone:", req.body.utas);
    console.log("🔐 [WALLET LOGIN] Firebase token provided:", !!req.body.firebaseToken);

    const { db } = require("zevbackv2");

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    const phoneNumber = String(req.body.utas).trim();

    console.log("📞 [WALLET LOGIN] Fetching user from Wallet API...");
    const walletUserInfo = await walletApiService.getUserInfo(phoneNumber);

    if (!walletUserInfo || !walletUserInfo.userId) {
      throw new aldaa("Хэтэвчний системд бүртгэлгүй байна. Эхлээд хэтэвчний системд бүртгүүлнэ үү.");
    }

    console.log("✅ [WALLET LOGIN] User found in Wallet API:", walletUserInfo.userId);

    let orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [
        { utas: phoneNumber },
        { walletUserId: walletUserInfo.userId }
      ]
    });

    const userData = {
      utas: phoneNumber,
      mail: walletUserInfo.email || (orshinSuugch?.mail || ""),
      walletUserId: walletUserInfo.userId,
      erkh: "OrshinSuugch",
      nevtrekhNer: phoneNumber,
    };

    // Preserve existing baiguullagiinId if user already has one
    if (orshinSuugch && orshinSuugch.baiguullagiinId) {
      userData.baiguullagiinId = orshinSuugch.baiguullagiinId;
      userData.baiguullagiinNer = orshinSuugch.baiguullagiinNer;
    }

    if (req.body.barilgiinId) {
      userData.barilgiinId = req.body.barilgiinId;
    } else if (orshinSuugch && orshinSuugch.barilgiinId) {
      // Preserve existing barilgiinId if user already has one
      userData.barilgiinId = orshinSuugch.barilgiinId;
    }

    if (req.body.duureg) userData.duureg = req.body.duureg;
    if (req.body.horoo) userData.horoo = req.body.horoo;
    if (req.body.soh) userData.soh = req.body.soh;
    if (req.body.toot) userData.toot = req.body.toot;
    if (req.body.davkhar) userData.davkhar = req.body.davkhar;
    if (req.body.orts) userData.orts = req.body.orts;

    // Save address if provided, or preserve existing
    if (req.body.bairId) {
      userData.walletBairId = req.body.bairId;
    } else if (orshinSuugch && orshinSuugch.walletBairId) {
      // Preserve existing walletBairId if user already has one
      userData.walletBairId = orshinSuugch.walletBairId;
    }

    if (req.body.doorNo) {
      userData.walletDoorNo = req.body.doorNo;
    } else if (orshinSuugch && orshinSuugch.walletDoorNo) {
      // Preserve existing walletDoorNo if user already has one
      userData.walletDoorNo = orshinSuugch.walletDoorNo;
    }

    // Store address values before saving for later use
    const bairIdToUse = userData.walletBairId || req.body.bairId;
    const doorNoToUse = userData.walletDoorNo || req.body.doorNo;

    if (orshinSuugch) {
      console.log("🔄 [WALLET LOGIN] Updating existing user:", orshinSuugch._id);
      Object.assign(orshinSuugch, userData);
    } else {
      console.log("➕ [WALLET LOGIN] Creating new user");
      orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
    }

    if (req.body.firebaseToken) {
      orshinSuugch.firebaseToken = req.body.firebaseToken;
      console.log("📱 [WALLET LOGIN] Updating Firebase token");
    }

    await orshinSuugch.save();
    console.log("✅ [WALLET LOGIN] User saved to database:", orshinSuugch._id);
    console.log("✅ [WALLET LOGIN] Saved fields:", Object.keys(userData).join(", "));
    console.log("🔍 [WALLET LOGIN] Address check - bairId:", bairIdToUse, "doorNo:", doorNoToUse);

    // Automatically fetch and connect billing if address is available
    let billingInfo = null;

    if (bairIdToUse && doorNoToUse) {
      try {
        console.log("🏠 [WALLET LOGIN] Auto-fetching billing with saved address...");
        console.log("🏠 [WALLET LOGIN] bairId:", bairIdToUse, "doorNo:", doorNoToUse);
        
        const billingResponse = await walletApiService.getBillingByAddress(
          phoneNumber,
          bairIdToUse,
          doorNoToUse
        );

        if (billingResponse && billingResponse.length > 0) {
          billingInfo = billingResponse[0];
          console.log("✅ [WALLET LOGIN] Billing info found:", billingInfo.customerName);
          
          // If billingId is not in the response, try to get it using customerId
          if (!billingInfo.billingId && billingInfo.customerId) {
            try {
              console.log("🔍 [WALLET LOGIN] Billing ID not found, fetching by customer ID...");
              console.log("🔍 [WALLET LOGIN] Customer ID:", billingInfo.customerId);
              const billingByCustomer = await walletApiService.getBillingByCustomer(
                phoneNumber,
                billingInfo.customerId
              );
              if (billingByCustomer && billingByCustomer.billingId) {
                billingInfo.billingId = billingByCustomer.billingId;
                billingInfo.billingName = billingByCustomer.billingName || billingInfo.billingName;
                console.log("✅ [WALLET LOGIN] Billing ID found via customer ID:", billingInfo.billingId);
              } else {
                console.warn("⚠️ [WALLET LOGIN] getBillingByCustomer returned null or no billingId");
                console.warn("⚠️ [WALLET LOGIN] Response:", JSON.stringify(billingByCustomer));
                
                // Try to find billingId from billing list
                try {
                  console.log("🔍 [WALLET LOGIN] Trying to find billingId from billing list...");
                  const billingList = await walletApiService.getBillingList(phoneNumber);
                  if (billingList && billingList.length > 0) {
                    // Try to find matching billing by customerId
                    const matchingBilling = billingList.find(b => 
                      b.customerId === billingInfo.customerId || 
                      b.customerCode === billingInfo.customerCode
                    );
                    if (matchingBilling && matchingBilling.billingId) {
                      billingInfo.billingId = matchingBilling.billingId;
                      billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                      console.log("✅ [WALLET LOGIN] Billing ID found from billing list:", billingInfo.billingId);
                    } else {
                      // If no match, use first billing if available
                      if (billingList[0] && billingList[0].billingId) {
                        billingInfo.billingId = billingList[0].billingId;
                        billingInfo.billingName = billingList[0].billingName || billingInfo.billingName;
                        console.log("✅ [WALLET LOGIN] Using first billing from list:", billingInfo.billingId);
                      }
                    }
                  }
                } catch (listError) {
                  console.error("⚠️ [WALLET LOGIN] Error fetching billing list:", listError.message);
                }
              }
            } catch (customerBillingError) {
              console.error("⚠️ [WALLET LOGIN] Error fetching billing by customer ID:", customerBillingError.message);
              if (customerBillingError.response) {
                console.error("⚠️ [WALLET LOGIN] Error response:", JSON.stringify(customerBillingError.response.data));
              }
              
              // Try billing list as fallback
              try {
                console.log("🔍 [WALLET LOGIN] Trying billing list as fallback...");
                const billingList = await walletApiService.getBillingList(phoneNumber);
                if (billingList && billingList.length > 0) {
                  const matchingBilling = billingList.find(b => 
                    b.customerId === billingInfo.customerId
                  );
                  if (matchingBilling && matchingBilling.billingId) {
                    billingInfo.billingId = matchingBilling.billingId;
                    billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                    console.log("✅ [WALLET LOGIN] Billing ID found from billing list (fallback):", billingInfo.billingId);
                  }
                }
              } catch (listError) {
                console.error("⚠️ [WALLET LOGIN] Error in billing list fallback:", listError.message);
              }
            }
          }

          // Automatically connect billing to Wallet API account
          if (billingInfo.billingId) {
            try {
              console.log("🔗 [WALLET LOGIN] Auto-connecting billing to Wallet API account...");
              console.log("🔗 [WALLET LOGIN] Billing ID:", billingInfo.billingId);
              const billingData = {
                billingId: billingInfo.billingId,
                billingName: billingInfo.billingName || billingInfo.customerName || "Орон сууцны төлбөр",
              };
              
              if (billingInfo.customerId) {
                billingData.customerId = billingInfo.customerId;
              }
              if (billingInfo.customerCode) {
                billingData.customerCode = billingInfo.customerCode;
              }

              const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
              console.log("✅ [WALLET LOGIN] Billing auto-connected to Wallet API account");
              console.log("✅ [WALLET LOGIN] Connection result:", JSON.stringify(connectResult));
            } catch (connectError) {
              console.error("❌ [WALLET LOGIN] Error auto-connecting billing:", connectError.message);
              if (connectError.response) {
                console.error("❌ [WALLET LOGIN] Error response status:", connectError.response.status);
                console.error("❌ [WALLET LOGIN] Error response data:", JSON.stringify(connectError.response.data));
              }
              // Don't throw - billing info is still saved locally
            }
          } else {
            console.warn("⚠️ [WALLET LOGIN] Billing ID not found - cannot connect to Wallet API");
            console.warn("⚠️ [WALLET LOGIN] Customer ID:", billingInfo.customerId);
            console.warn("⚠️ [WALLET LOGIN] Customer Code:", billingInfo.customerCode);
          }

          // Update user with billing data
          const updateData = {};
          if (billingInfo.customerName) {
            const nameParts = billingInfo.customerName.split(" ");
            if (nameParts.length >= 2) {
              updateData.ovog = nameParts[0];
              updateData.ner = nameParts.slice(1).join(" ");
            } else {
              updateData.ner = billingInfo.customerName;
            }
          }
          if (billingInfo.customerAddress) {
            updateData.bairniiNer = billingInfo.customerAddress;
          }
          if (billingInfo.customerId) {
            updateData.walletCustomerId = billingInfo.customerId;
          }
          if (billingInfo.customerCode) {
            updateData.walletCustomerCode = billingInfo.customerCode;
          }

          if (Object.keys(updateData).length > 0) {
            Object.assign(orshinSuugch, updateData);
            await orshinSuugch.save();
            console.log("✅ [WALLET LOGIN] User updated with billing data");
          }
        } else {
          console.log("⚠️ [WALLET LOGIN] No billing info found for saved address");
        }
      } catch (billingError) {
        // Log error but don't fail login
        console.error("⚠️ [WALLET LOGIN] Error auto-fetching billing (continuing anyway):", billingError.message);
      }
    } else {
      console.log("ℹ️ [WALLET LOGIN] No address available for auto-billing fetch");
    }

    const token = await orshinSuugch.tokenUusgeye();

    const butsaakhObject = {
      result: orshinSuugch,
      success: true,
      token: token,
      walletUserInfo: walletUserInfo,
    };

    if (billingInfo) {
      butsaakhObject.billingInfo = billingInfo;
    }

    console.log("✅ [WALLET LOGIN] Login successful for user:", orshinSuugch._id);
    res.status(200).json(butsaakhObject);
  } catch (err) {
    console.error("❌ [WALLET LOGIN] Error:", err.message);
    next(err);
  }
});

exports.walletBurtgey = asyncHandler(async (req, res, next) => {
  try {
    console.log("📝 [WALLET REGISTER] Registration request received");
    console.log("📝 [WALLET REGISTER] Phone:", req.body.utas);
    console.log("📝 [WALLET REGISTER] Email:", req.body.mail);

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    if (!req.body.mail) {
      throw new aldaa("И-мэйл заавал бөглөх шаардлагатай!");
    }

    const { db } = require("zevbackv2");
    const phoneNumber = String(req.body.utas).trim();
    const email = String(req.body.mail).trim();

    console.log("📞 [WALLET REGISTER] Registering user in Wallet API...");
    const walletUserInfo = await walletApiService.registerUser(phoneNumber, email);

    if (!walletUserInfo || !walletUserInfo.userId) {
      throw new aldaa("Хэтэвчний системд бүртгүүлэхэд алдаа гарлаа.");
    }

    console.log("✅ [WALLET REGISTER] User registered in Wallet API:", walletUserInfo.userId);

    let orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [
        { utas: phoneNumber },
        { walletUserId: walletUserInfo.userId }
      ]
    });

    const userData = {
      utas: phoneNumber,
      mail: walletUserInfo.email || email,
      walletUserId: walletUserInfo.userId,
      erkh: "OrshinSuugch",
      nevtrekhNer: phoneNumber,
    };

    if (req.body.barilgiinId) {
      userData.barilgiinId = req.body.barilgiinId;
    }

    if (req.body.duureg) userData.duureg = req.body.duureg;
    if (req.body.horoo) userData.horoo = req.body.horoo;
    if (req.body.soh) userData.soh = req.body.soh;
    if (req.body.toot) userData.toot = req.body.toot;
    if (req.body.davkhar) userData.davkhar = req.body.davkhar;
    if (req.body.orts) userData.orts = req.body.orts;

    // Save address if provided
    if (req.body.bairId) {
      userData.walletBairId = req.body.bairId;
    }
    if (req.body.doorNo) {
      userData.walletDoorNo = req.body.doorNo;
    }

    if (orshinSuugch) {
      console.log("🔄 [WALLET REGISTER] Updating existing user:", orshinSuugch._id);
      Object.assign(orshinSuugch, userData);
    } else {
      console.log("➕ [WALLET REGISTER] Creating new user");
      orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
    }

    if (req.body.firebaseToken) {
      orshinSuugch.firebaseToken = req.body.firebaseToken;
      console.log("📱 [WALLET REGISTER] Updating Firebase token");
    }

    await orshinSuugch.save();
    console.log("✅ [WALLET REGISTER] User saved to database:", orshinSuugch._id);

    // Automatically fetch and connect billing if address is provided
    let billingInfo = null;
    if (req.body.bairId && req.body.doorNo) {
      try {
        console.log("🏠 [WALLET REGISTER] Auto-fetching billing with provided address...");
        console.log("🏠 [WALLET REGISTER] bairId:", req.body.bairId, "doorNo:", req.body.doorNo);
        
        const billingResponse = await walletApiService.getBillingByAddress(
          phoneNumber,
          req.body.bairId,
          req.body.doorNo
        );

        if (billingResponse && billingResponse.length > 0) {
          billingInfo = billingResponse[0];
          console.log("✅ [WALLET REGISTER] Billing info found:", billingInfo.customerName);
          
          // If billingId is not in the response, try to get it using customerId
          if (!billingInfo.billingId && billingInfo.customerId) {
            try {
              console.log("🔍 [WALLET REGISTER] Billing ID not found, fetching by customer ID...");
              console.log("🔍 [WALLET REGISTER] Customer ID:", billingInfo.customerId);
              const billingByCustomer = await walletApiService.getBillingByCustomer(
                phoneNumber,
                billingInfo.customerId
              );
              if (billingByCustomer && billingByCustomer.billingId) {
                billingInfo.billingId = billingByCustomer.billingId;
                billingInfo.billingName = billingByCustomer.billingName || billingInfo.billingName;
                console.log("✅ [WALLET REGISTER] Billing ID found via customer ID:", billingInfo.billingId);
              } else {
                console.warn("⚠️ [WALLET REGISTER] getBillingByCustomer returned null or no billingId");
                
                // Try to find billingId from billing list
                try {
                  console.log("🔍 [WALLET REGISTER] Trying to find billingId from billing list...");
                  const billingList = await walletApiService.getBillingList(phoneNumber);
                  if (billingList && billingList.length > 0) {
                    const matchingBilling = billingList.find(b => 
                      b.customerId === billingInfo.customerId || 
                      b.customerCode === billingInfo.customerCode
                    );
                    if (matchingBilling && matchingBilling.billingId) {
                      billingInfo.billingId = matchingBilling.billingId;
                      billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                      console.log("✅ [WALLET REGISTER] Billing ID found from billing list:", billingInfo.billingId);
                    } else if (billingList[0] && billingList[0].billingId) {
                      billingInfo.billingId = billingList[0].billingId;
                      billingInfo.billingName = billingList[0].billingName || billingInfo.billingName;
                      console.log("✅ [WALLET REGISTER] Using first billing from list:", billingInfo.billingId);
                    }
                  }
                } catch (listError) {
                  console.error("⚠️ [WALLET REGISTER] Error fetching billing list:", listError.message);
                }
              }
            } catch (customerBillingError) {
              console.error("⚠️ [WALLET REGISTER] Error fetching billing by customer ID:", customerBillingError.message);
              
              // Try billing list as fallback
              try {
                console.log("🔍 [WALLET REGISTER] Trying billing list as fallback...");
                const billingList = await walletApiService.getBillingList(phoneNumber);
                if (billingList && billingList.length > 0) {
                  const matchingBilling = billingList.find(b => 
                    b.customerId === billingInfo.customerId
                  );
                  if (matchingBilling && matchingBilling.billingId) {
                    billingInfo.billingId = matchingBilling.billingId;
                    billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                    console.log("✅ [WALLET REGISTER] Billing ID found from billing list (fallback):", billingInfo.billingId);
                  }
                }
              } catch (listError) {
                console.error("⚠️ [WALLET REGISTER] Error in billing list fallback:", listError.message);
              }
            }
          }

          // Automatically connect billing to Wallet API account
          if (billingInfo.billingId) {
            try {
              console.log("🔗 [WALLET REGISTER] Auto-connecting billing to Wallet API account...");
              console.log("🔗 [WALLET REGISTER] Billing ID:", billingInfo.billingId);
              const billingData = {
                billingId: billingInfo.billingId,
                billingName: billingInfo.billingName || billingInfo.customerName || "Орон сууцны төлбөр",
              };
              
              if (billingInfo.customerId) {
                billingData.customerId = billingInfo.customerId;
              }
              if (billingInfo.customerCode) {
                billingData.customerCode = billingInfo.customerCode;
              }

              const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
              console.log("✅ [WALLET REGISTER] Billing auto-connected to Wallet API account");
              console.log("✅ [WALLET REGISTER] Connection result:", JSON.stringify(connectResult));
            } catch (connectError) {
              console.error("❌ [WALLET REGISTER] Error auto-connecting billing:", connectError.message);
              if (connectError.response) {
                console.error("❌ [WALLET REGISTER] Error response status:", connectError.response.status);
                console.error("❌ [WALLET REGISTER] Error response data:", JSON.stringify(connectError.response.data));
              }
              // Don't throw - billing info is still saved locally
            }
          } else {
            console.warn("⚠️ [WALLET REGISTER] Billing ID not found - cannot connect to Wallet API");
            console.warn("⚠️ [WALLET REGISTER] Customer ID:", billingInfo.customerId);
            console.warn("⚠️ [WALLET REGISTER] Customer Code:", billingInfo.customerCode);
          }

          // Update user with billing data
          const updateData = {};
          if (billingInfo.customerName) {
            const nameParts = billingInfo.customerName.split(" ");
            if (nameParts.length >= 2) {
              updateData.ovog = nameParts[0];
              updateData.ner = nameParts.slice(1).join(" ");
            } else {
              updateData.ner = billingInfo.customerName;
            }
          }
          if (billingInfo.customerAddress) {
            updateData.bairniiNer = billingInfo.customerAddress;
          }
          if (billingInfo.customerId) {
            updateData.walletCustomerId = billingInfo.customerId;
          }
          if (billingInfo.customerCode) {
            updateData.walletCustomerCode = billingInfo.customerCode;
          }

          if (Object.keys(updateData).length > 0) {
            Object.assign(orshinSuugch, updateData);
            await orshinSuugch.save();
            console.log("✅ [WALLET REGISTER] User updated with billing data");
          }
        } else {
          console.log("⚠️ [WALLET REGISTER] No billing info found for provided address");
        }
      } catch (billingError) {
        // Log error but don't fail registration
        console.error("⚠️ [WALLET REGISTER] Error auto-fetching billing (continuing anyway):", billingError.message);
      }
    }

    const token = await orshinSuugch.tokenUusgeye();

    const butsaakhObject = {
      result: orshinSuugch,
      success: true,
      token: token,
      walletUserInfo: walletUserInfo,
      message: "Хэтэвчний системд амжилттай бүртгүүлж, нэвтэрлээ",
    };

    if (billingInfo) {
      butsaakhObject.billingInfo = billingInfo;
    }

    console.log("✅ [WALLET REGISTER] Registration and login successful for user:", orshinSuugch._id);
    res.status(200).json(butsaakhObject);
  } catch (err) {
    console.error("❌ [WALLET REGISTER] Error:", err.message);
    next(err);
  }
});

exports.walletBillingHavakh = asyncHandler(async (req, res, next) => {
  try {
    console.log("🏠 [WALLET BILLING] Billing fetch request received");
    
    const { db } = require("zevbackv2");
    
    if (!req.body.bairId || !req.body.doorNo) {
      throw new aldaa("Байрын ID болон тоот заавал бөглөх шаардлагатай!");
    }

    if (!req.headers.authorization) {
      throw new aldaa("Нэвтрэх шаардлагатай!");
    }

    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      throw new aldaa("Token олдсонгүй!");
    }

    let tokenObject;
    try {
      tokenObject = jwt.verify(token, process.env.APP_SECRET);
    } catch (jwtError) {
      throw new aldaa("Token хүчингүй байна!");
    }

    if (!tokenObject?.id || tokenObject.id === "zochin") {
      throw new aldaa("Энэ үйлдлийг хийх эрх байхгүй байна!");
    }

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(tokenObject.id);
    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }

    const phoneNumber = orshinSuugch.utas;
    const bairId = req.body.bairId;
    const doorNo = req.body.doorNo;

    console.log("🏠 [WALLET BILLING] Fetching billing info from Wallet API...");
    console.log("🏠 [WALLET BILLING] User:", phoneNumber, "bairId:", bairId, "doorNo:", doorNo);

    let billingInfo = null;
    try {
      const billingResponse = await walletApiService.getBillingByAddress(
        phoneNumber,
        bairId,
        doorNo
      );

      if (billingResponse && billingResponse.length > 0) {
        billingInfo = billingResponse[0];
        console.log("✅ [WALLET BILLING] Billing info found:", billingInfo.customerName);
        console.log("✅ [WALLET BILLING] Customer ID:", billingInfo.customerId);
        console.log("✅ [WALLET BILLING] Customer Code:", billingInfo.customerCode);
        console.log("✅ [WALLET BILLING] Billing ID:", billingInfo.billingId);
        
        // If billingId is not in the response, try to get it using customerId
        if (!billingInfo.billingId && billingInfo.customerId) {
          try {
            console.log("🔍 [WALLET BILLING] Billing ID not found, fetching by customer ID...");
            console.log("🔍 [WALLET BILLING] Customer ID:", billingInfo.customerId);
            const billingByCustomer = await walletApiService.getBillingByCustomer(
              phoneNumber,
              billingInfo.customerId
            );
            if (billingByCustomer && billingByCustomer.billingId) {
              billingInfo.billingId = billingByCustomer.billingId;
              billingInfo.billingName = billingByCustomer.billingName || billingInfo.billingName;
              console.log("✅ [WALLET BILLING] Billing ID found via customer ID:", billingInfo.billingId);
            } else {
              console.warn("⚠️ [WALLET BILLING] getBillingByCustomer returned null or no billingId");
              
              // Try to find billingId from billing list
              try {
                console.log("🔍 [WALLET BILLING] Trying to find billingId from billing list...");
                const billingList = await walletApiService.getBillingList(phoneNumber);
                if (billingList && billingList.length > 0) {
                  const matchingBilling = billingList.find(b => 
                    b.customerId === billingInfo.customerId || 
                    b.customerCode === billingInfo.customerCode
                  );
                  if (matchingBilling && matchingBilling.billingId) {
                    billingInfo.billingId = matchingBilling.billingId;
                    billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                    console.log("✅ [WALLET BILLING] Billing ID found from billing list:", billingInfo.billingId);
                  } else if (billingList[0] && billingList[0].billingId) {
                    billingInfo.billingId = billingList[0].billingId;
                    billingInfo.billingName = billingList[0].billingName || billingInfo.billingName;
                    console.log("✅ [WALLET BILLING] Using first billing from list:", billingInfo.billingId);
                  }
                }
              } catch (listError) {
                console.error("⚠️ [WALLET BILLING] Error fetching billing list:", listError.message);
              }
            }
          } catch (customerBillingError) {
            console.error("⚠️ [WALLET BILLING] Error fetching billing by customer ID:", customerBillingError.message);
            if (customerBillingError.response) {
              console.error("⚠️ [WALLET BILLING] Error response:", JSON.stringify(customerBillingError.response.data));
            }
            
            // Try billing list as fallback
            try {
              console.log("🔍 [WALLET BILLING] Trying billing list as fallback...");
              const billingList = await walletApiService.getBillingList(phoneNumber);
              if (billingList && billingList.length > 0) {
                const matchingBilling = billingList.find(b => 
                  b.customerId === billingInfo.customerId
                );
                if (matchingBilling && matchingBilling.billingId) {
                  billingInfo.billingId = matchingBilling.billingId;
                  billingInfo.billingName = matchingBilling.billingName || billingInfo.billingName;
                  console.log("✅ [WALLET BILLING] Billing ID found from billing list (fallback):", billingInfo.billingId);
                }
              }
            } catch (listError) {
              console.error("⚠️ [WALLET BILLING] Error in billing list fallback:", listError.message);
            }
          }
        }
      } else {
        console.log("⚠️ [WALLET BILLING] No billing info found for this address");
        return res.status(404).json({
          success: false,
          message: "Энэ хаягийн биллингийн мэдээлэл олдсонгүй",
        });
      }
    } catch (billingError) {
      console.error("❌ [WALLET BILLING] Error fetching billing info:", billingError.message);
      throw new aldaa(`Биллингийн мэдээлэл авахад алдаа гарлаа: ${billingError.message}`);
    }

    // Automatically connect billing to Wallet API account if billingId is available
    let billingConnected = false;
    let connectionError = null;
    
    if (billingInfo.billingId) {
      try {
        console.log("🔗 [WALLET BILLING] Connecting billing to Wallet API account...");
        console.log("🔗 [WALLET BILLING] Billing ID:", billingInfo.billingId);
        const billingData = {
          billingId: billingInfo.billingId,
          billingName: billingInfo.billingName || billingInfo.customerName || "Орон сууцны төлбөр",
        };
        
        if (billingInfo.customerId) {
          billingData.customerId = billingInfo.customerId;
        }
        if (billingInfo.customerCode) {
          billingData.customerCode = billingInfo.customerCode;
        }

        const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
        console.log("✅ [WALLET BILLING] Billing connected to Wallet API account");
        console.log("✅ [WALLET BILLING] Connection result:", JSON.stringify(connectResult));
        billingConnected = true;
      } catch (connectError) {
        console.error("❌ [WALLET BILLING] Error connecting billing:", connectError.message);
        if (connectError.response) {
          console.error("❌ [WALLET BILLING] Error response status:", connectError.response.status);
          console.error("❌ [WALLET BILLING] Error response data:", JSON.stringify(connectError.response.data));
        }
        connectionError = connectError.message;
      }
    } else {
      console.warn("⚠️ [WALLET BILLING] Billing ID not found - cannot connect to Wallet API");
      console.warn("⚠️ [WALLET BILLING] Customer ID:", billingInfo.customerId);
      console.warn("⚠️ [WALLET BILLING] Customer Code:", billingInfo.customerCode);
      connectionError = "Биллингийн ID олдсонгүй";
    }

    const updateData = {};

    if (billingInfo.customerName) {
      const nameParts = billingInfo.customerName.split(" ");
      if (nameParts.length >= 2) {
        updateData.ovog = nameParts[0];
        updateData.ner = nameParts.slice(1).join(" ");
      } else {
        updateData.ner = billingInfo.customerName;
      }
    }

    if (billingInfo.customerAddress) {
      updateData.bairniiNer = billingInfo.customerAddress;
    }

    if (billingInfo.customerId) {
      updateData.walletCustomerId = billingInfo.customerId;
    }

    if (billingInfo.customerCode) {
      updateData.walletCustomerCode = billingInfo.customerCode;
    }

    updateData.walletBairId = bairId;
    updateData.walletDoorNo = doorNo;

    if (req.body.duureg) updateData.duureg = req.body.duureg;
    if (req.body.horoo) updateData.horoo = req.body.horoo;
    if (req.body.soh) updateData.soh = req.body.soh;
    if (req.body.toot) updateData.toot = req.body.toot;
    if (req.body.davkhar) updateData.davkhar = req.body.davkhar;
    if (req.body.orts) updateData.orts = req.body.orts;

    Object.assign(orshinSuugch, updateData);
    await orshinSuugch.save();

    console.log("✅ [WALLET BILLING] Billing data saved to local user record");
    console.log("💾 [WALLET BILLING] Saved fields:", Object.keys(updateData).join(", "));

    res.status(200).json({
      success: true,
      message: billingConnected 
        ? "Биллингийн мэдээлэл амжилттай хадгалж, Wallet API-д холболоо" 
        : "Биллингийн мэдээлэл хадгалагдсан боловч Wallet API-д холбогдоогүй байна",
      result: orshinSuugch,
      billingInfo: billingInfo,
      billingConnected: billingConnected,
      connectionError: connectionError,
    });
  } catch (err) {
    console.error("❌ [WALLET BILLING] Error:", err.message);
    next(err);
  }
});

exports.walletAddressCities = asyncHandler(async (req, res, next) => {
  try {
    const cities = await walletApiService.getAddressCities();
    res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (err) {
    console.error("❌ [WALLET ADDRESS] Error getting cities:", err.message);
    next(err);
  }
});

exports.walletAddressDistricts = asyncHandler(async (req, res, next) => {
  try {
    const { cityId } = req.params;
    if (!cityId) {
      throw new aldaa("Хотын ID заавал бөглөх шаардлагатай!");
    }
    const districts = await walletApiService.getAddressDistricts(cityId);
    res.status(200).json({
      success: true,
      data: districts,
    });
  } catch (err) {
    console.error("❌ [WALLET ADDRESS] Error getting districts:", err.message);
    next(err);
  }
});

exports.walletAddressKhoroo = asyncHandler(async (req, res, next) => {
  try {
    const { districtId } = req.params;
    if (!districtId) {
      throw new aldaa("Дүүргийн ID заавал бөглөх шаардлагатай!");
    }
    const khoroo = await walletApiService.getAddressKhoroo(districtId);
    res.status(200).json({
      success: true,
      data: khoroo,
    });
  } catch (err) {
    console.error("❌ [WALLET ADDRESS] Error getting khoroo:", err.message);
    next(err);
  }
});

exports.walletAddressBair = asyncHandler(async (req, res, next) => {
  try {
    const { khorooId } = req.params;
    if (!khorooId) {
      throw new aldaa("Хорооны ID заавал бөглөх шаардлагатай!");
    }
    const bair = await walletApiService.getAddressBair(khorooId);
    res.status(200).json({
      success: true,
      data: bair,
    });
  } catch (err) {
    console.error("❌ [WALLET ADDRESS] Error getting bair:", err.message);
    next(err);
  }
});

exports.dugaarBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
    var msgIlgeekhDugaar = "72002002";

    const { baiguullagiinId, utas } = req.body;
    const purpose = req.body.purpose || "password_reset"; // "register" | "password_reset"

    if (!baiguullagiinId || !utas) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID болон утас заавал бөглөх шаардлагатай!",
      });
    }

    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
      });
    }

    var kholboltuud = db.kholboltuud;
    var kholbolt = kholboltuud.find(
      (a) => a.baiguullagiinId == baiguullaga._id.toString()
    );

    if (!kholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболтын мэдээлэл олдсонгүй!",
      });
    }

    const existing = await OrshinSuugch(db.erunkhiiKholbolt).findOne({ utas });
    if (purpose === "registration") {
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Энэ утас аль хэдийн бүртгэгдсэн байна!",
          codeSent: false,
        });
      }
    } else if (purpose === "password_reset") {
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
          codeSent: false,
        });
      }
    } else if (purpose === "register") {
      console.log(
        "⚠️ purpose=register received; schema expects 'registration'. Consider mapping before saving."
      );
    }

    const BatalgaajuulahCodeModel = BatalgaajuulahCode(kholbolt);
    const batalgaajuulkhCodeDoc =
      await BatalgaajuulahCodeModel.batalgaajuulkhCodeUusgeye(
        utas,
        purpose,
        10
      );

    var text = `AmarSukh: Tany batalgaajuulax code: ${batalgaajuulkhCodeDoc.code}.`;

    var ilgeexList = [
      {
        to: utas,
        text: text,
        gereeniiId: "password_reset",
      },
    ];

    var khariu = [];

    msgIlgeeye(
      ilgeexList,
      msgIlgeekhKey,
      msgIlgeekhDugaar,
      khariu,
      0,
      kholbolt,
      baiguullagiinId
    );

    res.json({
      success: true,
      message: "Баталгаажуулах код илгээгдлээ",
      expiresIn: 10,
      baiguullagiinId: baiguullagiinId,
      purpose: purpose,
      codeSent: true,
    });
  } catch (error) {
    console.error("🔥 dugaarBatalgaajuulya error:", error?.message);
    next(error);
  }
});

exports.orshinSuugchBatalgaajuulya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas } = req.body;

    if (!utas) {
      return res.status(400).json({
        success: false,
        message: "Утасны дугаар заавал бөглөх шаардлагатай!",
      });
    }

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({ utas: utas })
      .catch((err) => {
        next(err);
      });

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
      });
    }

    req.body.baiguullagiinId = orshinSuugch.baiguullagiinId;

    await exports.dugaarBatalgaajuulya(req, res, next);
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgSergeeye = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { utas, code, shineNuutsUg } = req.body;

    if (!utas || !code || !shineNuutsUg) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    if (shineNuutsUg.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой!",
      });
    }

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({ utas: utas })
      .catch((err) => {
        next(err);
      });

    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Энэ утасны дугаартай хэрэглэгч олдсонгүй!",
      });
    }

    const verificationResult = await verifyCodeHelper(
      orshinSuugch.baiguullagiinId,
      utas,
      code
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    const oldPasswordHash = orshinSuugch.nuutsUg || null;
    let passwordChanged = false;

    try {
      orshinSuugch.nuutsUg = shineNuutsUg;
      await orshinSuugch.save();
    } catch (saveError) {
      console.error("Error saving password:", saveError);
      return res.status(400).json({
        success: false,
        message: "Нууц үг хадгалахад алдаа гарлаа!",
      });
    }

    try {
      const updatedUser = await OrshinSuugch(db.erunkhiiKholbolt)
        .findById(orshinSuugch._id)
        .select("+nuutsUg");

      passwordChanged = oldPasswordHash
        ? oldPasswordHash !== updatedUser.nuutsUg
        : true;
    } catch (fetchError) {
      console.error("Error fetching updated user:", fetchError);
      return res.status(400).json({
        success: false,
        message: "Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа!",
      });
    }

    res.json({
      success: true,
      message: "Нууц үг амжилттай сэргээгдлээ",
      data: {
        step: 3,
        passwordChanged: passwordChanged,
        userId: orshinSuugch._id.toString(),
        userName: orshinSuugch.ner,
      },
    });
  } catch (error) {
    console.error("Password reset error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Нууц үг солиход алдаа гарлаа",
      error: error.message,
    });
  }
});

exports.tokenoorOrshinSuugchAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    if (!req.headers.authorization) {
      return next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!"));
    }
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return next(new Error("Token олдсонгүй!"));
    }

    let tokenObject;
    try {
      tokenObject = jwt.verify(token, process.env.APP_SECRET);
    } catch (jwtError) {
      console.error("JWT Verification Error:", jwtError.message);
      if (jwtError.name === "JsonWebTokenError") {
        return next(new Error("Token буруу байна!"));
      } else if (jwtError.name === "TokenExpiredError") {
        return next(new Error("Token хугацаа дууссан байна!"));
      } else {
        return next(new Error("Token шалгах үед алдаа гарлаа!"));
      }
    }

    if (tokenObject.id == "zochin")
      return next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!"));

    OrshinSuugch(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .then((urDun) => {
        var urdunJson = urDun.toJSON();
        urdunJson.duusakhOgnoo = tokenObject.duusakhOgnoo;
        urdunJson.salbaruud = tokenObject.salbaruud;
        res.send(urdunJson);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    console.error("Token verification error:", error);
    next(error);
  }
});

function msgIlgeeye(
  jagsaalt,
  key,
  dugaar,
  khariu,
  index,
  tukhainBaaziinKholbolt,
  baiguullagiinId
) {
  try {
    const msgServer = process.env.MSG_SERVER || "https://api.messagepro.mn";
    let url =
      msgServer +
      "/send" +
      "?key=" +
      key +
      "&from=" +
      dugaar +
      "&to=" +
      jagsaalt[index].to.toString() +
      "&text=" +
      jagsaalt[index].text.toString();

    url = encodeURI(url);
    request(url, { json: true }, (err1, res1, body) => {
      if (err1) {
        console.error("SMS sending error:", err1);
      } else {
        var msg = new MsgTuukh(tukhainBaaziinKholbolt)();
        msg.baiguullagiinId = baiguullagiinId;
        msg.dugaar = jagsaalt[index].to;
        msg.gereeniiId = jagsaalt[index].gereeniiId || "";
        msg.msg = jagsaalt[index].text;
        msg.msgIlgeekhKey = key;
        msg.msgIlgeekhDugaar = dugaar;
        msg.save();
        if (jagsaalt.length > index + 1) {
          khariu.push(body[0]);
          msgIlgeeye(
            jagsaalt,
            key,
            dugaar,
            khariu,
            index + 1,
            tukhainBaaziinKholbolt,
            baiguullagiinId
          );
        } else {
          khariu.push(body[0]);
        }
      }
    });
  } catch (err) {
    console.error("msgIlgeeye error:", err);
  }
}

exports.dugaarBatalgaajuulakh = asyncHandler(async (req, res, next) => {
  try {
    const { baiguullagiinId, utas, code } = req.body;
    const purposeRaw = req.body.purpose || "password_reset"; // "registration" | "register" | "password_reset"
    const purpose = purposeRaw === "register" ? "registration" : purposeRaw;

    if (!baiguullagiinId || !utas || !code) {
      return res.status(400).json({
        success: false,
        message: "Бүх талбарыг бөглөх шаардлагатай!",
      });
    }

    const verificationResult = await validateCodeOnly(
      baiguullagiinId,
      utas,
      code,
      purpose
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    res.json({
      success: true,
      message: "Дугаар амжилттай баталгаажлаа!",
      data: {
        verified: true,
        phone: utas,
        code: code,
        purpose,
      },
    });
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgShalgakhOrshinSuugch = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findById(req.body.id)
      .select("+nuutsUg");
    const ok = await orshinSuugch.passwordShalgaya(req.body.nuutsUg);
    if (ok) res.send({ success: true });
    else
      res.send({
        success: false,
        message: "Хэрэглэгчийн одоо ашиглаж буй нууц үг буруу байна!",
      });
  } catch (error) {
    next(error);
  }
});

exports.orshinSuugchiinNuutsUgSoliyo = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { odoogiinNuutsUg, shineNuutsUg, davtahNuutsUg } = req.body || {};

    if (!odoogiinNuutsUg || !shineNuutsUg || !davtahNuutsUg) {
      return res
        .status(400)
        .json({ success: false, message: "Бүх талбарыг бөглөх шаардлагатай!" });
    }
    if (String(shineNuutsUg) !== String(davtahNuutsUg)) {
      return res
        .status(400)
        .json({ success: false, message: "Шинэ нууц үг таарахгүй байна!" });
    }
    if (String(shineNuutsUg).length < 4) {
      return res.status(400).json({
        success: false,
        message: "Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой!",
      });
    }

    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: "Энэ үйлдлийг хийх эрх байхгүй байна!",
      });
    }
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Token олдсонгүй!" });
    }

    let tokenObject;
    try {
      tokenObject = jwt.verify(token, process.env.APP_SECRET);
    } catch (jwtError) {
      return res
        .status(401)
        .json({ success: false, message: "Token хүчингүй байна!" });
    }
    if (!tokenObject?.id || tokenObject.id === "zochin") {
      return res.status(401).json({
        success: false,
        message: "Энэ үйлдлийг хийх эрх байхгүй байна!",
      });
    }

    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .select("+nuutsUg");
    if (!orshinSuugch) {
      return res
        .status(404)
        .json({ success: false, message: "Хэрэглэгч олдсонгүй!" });
    }

    const ok = await orshinSuugch.passwordShalgaya(odoogiinNuutsUg);
    if (!ok) {
      return res
        .status(400)
        .json({ success: false, message: "Одоогийн нууц үг буруу байна!" });
    }

    orshinSuugch.nuutsUg = shineNuutsUg;
    await orshinSuugch.save();

    return res.json({ success: true, message: "Нууц үг амжилттай солигдлоо" });
  } catch (error) {
    next(error);
  }
});

exports.khayagaarBaiguullagaAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { duureg, horoo, soh } = req.params;

    if (!duureg || !horoo || !soh) {
      throw new aldaa("Дүүрэг, Хороо, СӨХ заавал бөглөх шаардлагатай!");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      $and: [
        { "tokhirgoo.duuregNer": duureg },
        { "tokhirgoo.districtCode": horoo },
        { "tokhirgoo.sohNer": soh },
      ],
    });

    if (!baiguullaga) {
      throw new aldaa(
        "Тухайн дүүрэг, хороо, СӨХ-д тохирох байгууллагын мэдээлэл олдсонгүй!"
      );
    }

    res.status(200).json({
      success: true,
      message: "Байгууллагын мэдээлэл олдлоо",
      result: baiguullaga,
    });
  } catch (error) {
    next(error);
  }
});

exports.cleanupExpiredCodes = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const BatalgaajuulahCodeModel = BatalgaajuulahCode(db.erunkhiiKholbolt);
    const deletedCount = await BatalgaajuulahCodeModel.cleanupExpired();

    console.log(`Cleaned up ${deletedCount} expired verification codes`);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired verification codes`,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

exports.getVerificationCodeStatus = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { phone } = req.params;

    const BatalgaajuulahCodeModel = BatalgaajuulahCode(db.erunkhiiKholbolt);
    const codes = await BatalgaajuulahCodeModel.find({ utas: phone })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      message: "Verification codes retrieved",
      codes: codes.map((code) => ({
        code: code.code,
        purpose: code.purpose,
        used: code.khereglesenEsekh,
        attempts: code.oroldlogo,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
        isExpired: code.expiresAt < new Date(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Self-delete orshinSuugch and all related data
 * Requires password verification in request body
 * Deletes all traces of the user from:
 * - geree (invoices/contracts where orshinSuugchId matches)
 * - nekhemjlekhiinTuukh (invoice history related to deleted gerees)
 * - nevtreltiinTuukh (login history)
 * - Finally deletes the orshinSuugch user itself
 */
exports.orshinSuugchOorooUstgakh = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");

    // Verify password is provided
    const nuutsUg = req.body.nuutsUg;
    if (!nuutsUg) {
      throw new aldaa("Нууц код заавал оруулах шаардлагатай!");
    }

    // Get user ID from token (from tokenShalgakh middleware or manually verify)
    let userId;
    if (req.body.nevtersenOrshinSuugchiinToken?.id) {
      userId = req.body.nevtersenOrshinSuugchiinToken.id;
    } else if (req.headers.authorization) {
      // Fallback: manually verify token from header
      const token = req.headers.authorization.split(" ")[1];
      if (token) {
        try {
          const tokenObject = jwt.verify(token, process.env.APP_SECRET);
          userId = tokenObject.id;
        } catch (err) {
          throw new aldaa("Token хүчингүй байна!");
        }
      }
    }

    if (!userId) {
      throw new aldaa("Хэрэглэгчийн мэдээлэл олдсонгүй!");
    }

    const userIdString = String(userId);

    // Verify user exists and get user with password
    const OrshinSuugchModel = OrshinSuugch(db.erunkhiiKholbolt);
    const orshinSuugch = await OrshinSuugchModel.findById(userId).select(
      "+nuutsUg"
    );

    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }

    // Verify password
    const passwordMatch = await orshinSuugch.passwordShalgaya(nuutsUg);
    if (!passwordMatch) {
      throw new aldaa("Нууц код буруу байна!");
    }

    // Mark all gerees as "Цуцалсан" (Cancelled) instead of deleting
    // Don't delete nekhemjlekhiinTuukh, ebarimt, or any other related data
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) =>
        kholbolt.baiguullagiinId === orshinSuugch.baiguullagiinId?.toString()
    );

    let gereesToCancel = [];
    if (tukhainBaaziinKholbolt) {
      const GereeModel = Geree(tukhainBaaziinKholbolt);
      gereesToCancel = await GereeModel.find({
        orshinSuugchId: userIdString,
      });

      if (gereesToCancel.length > 0) {
        // Mark all gerees as "Цуцалсан" (Cancelled) - update tuluv field, keep turul unchanged
        await GereeModel.updateMany(
          { orshinSuugchId: userIdString },
          { $set: { tuluv: "Цуцалсан" } }
        );
      }
    }

    // Don't delete nekhemjlekhiinTuukh - keep all invoice history
    // Don't delete nevtreltiinTuukh - keep login history
    // Don't delete ebarimt - keep all receipts

    // Actually delete the orshinSuugch user account
    // The gerees are marked as "Цуцалсан" and can be restored when they register again with the same utas
    await OrshinSuugchModel.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Хэрэглэгчийн данс устгагдлаа. Бүх мэдээлэл хадгалагдсан байна.",
      data: {
        userId: userId,
        cancelledGerees: gereesToCancel?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /orshinSuugch/:id - Admin delete orshinSuugch
 * Same behavior as oorooUstgakh but without password verification (admin action)
 * Marks all gerees as "Цуцалсан" and deletes the user account
 */
exports.orshinSuugchUstgakh = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const Geree = require("../models/geree");

    const userId = req.params.id;
    if (!userId) {
      throw new aldaa("Хэрэглэгчийн ID заавал оруулах шаардлагатай!");
    }

    const userIdString = String(userId);

    // Verify user exists
    const OrshinSuugchModel = OrshinSuugch(db.erunkhiiKholbolt);
    const orshinSuugch = await OrshinSuugchModel.findById(userId);

    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }

    // Mark all gerees as "Цуцалсан" (Cancelled) instead of deleting
    // Don't delete nekhemjlekhiinTuukh, ebarimt, or any other related data
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) =>
        kholbolt.baiguullagiinId === orshinSuugch.baiguullagiinId?.toString()
    );

    let gereesToCancel = [];
    if (tukhainBaaziinKholbolt) {
      const GereeModel = Geree(tukhainBaaziinKholbolt);
      gereesToCancel = await GereeModel.find({
        orshinSuugchId: userIdString,
      });

      if (gereesToCancel.length > 0) {
        // Mark all gerees as "Цуцалсан" (Cancelled) - update tuluv field, keep turul unchanged
        await GereeModel.updateMany(
          { orshinSuugchId: userIdString },
          { $set: { tuluv: "Цуцалсан" } }
        );
      }
    }

    // Don't delete nekhemjlekhiinTuukh - keep all invoice history
    // Don't delete nevtreltiinTuukh - keep login history
    // Don't delete ebarimt - keep all receipts

    // Actually delete the orshinSuugch user account
    // The gerees are marked as "Цуцалсан" and can be restored when they register again with the same utas
    await OrshinSuugchModel.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Хэрэглэгчийн данс устгагдлаа. Бүх мэдээлэл хадгалагдсан байна.",
      data: {
        userId: userId,
        cancelledGerees: gereesToCancel?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});