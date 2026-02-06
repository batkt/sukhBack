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
const addressService = require("../services/addressService");
const walletApiService = require("../services/walletApiService");

// ... existing code ...

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

  // Find the most recent code that matches (sort by createdAt descending)
  // This ensures we use the latest code if multiple codes exist for the same phone
  const verificationCode = await BatalgaajuulahCodeModel.findOne({
    utas,
    code,
    purpose,
    khereglesenEsekh: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

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

    // Validate that davkhar already exists - do not allow creating new davkhar when assigning toot
    const davkharStr = String(davkhar);
    if (!davkharArray.includes(davkharStr)) {
      console.warn(`⚠️ [updateDavkharWithToot] Davkhar "${davkharStr}" does not exist in barilga. Cannot assign toot "${toot}" to unregistered davkhar.`);
      return; // Exit early - do not create new davkhar or assign toot
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

    // NOTE: liftShalgaya.choloolugdokhDavkhar should be configured manually by admin
    // It represents floors EXEMPT from lift charges, NOT all floors in the building
    // So we do NOT auto-calculate it when registering users
  } catch (error) {
    console.error("Error updating davkhar with toot:", error);
  }
};

// Helper function to calculate liftShalgaya based on davkhar entries
// Saves to both baiguullaga.barilguud[].tokhirgoo.liftShalgaya AND liftShalgaya collection
exports.calculateLiftShalgaya = async function calculateLiftShalgaya(
  baiguullagiinId,
  barilgiinId,
  davkharArray,
  tukhainBaaziinKholbolt
) {
  try {
    const { db } = require("zevbackv2");
    const Baiguullaga = require("../models/baiguullaga");
    const LiftShalgaya = require("../models/liftShalgaya");

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

      // Also sync with liftShalgaya collection - update existing or create new
      if (tukhainBaaziinKholbolt) {
        const LiftShalgayaModel = LiftShalgaya(tukhainBaaziinKholbolt);
        await LiftShalgayaModel.findOneAndUpdate(
          {
            baiguullagiinId: String(baiguullagiinId),
            barilgiinId: String(barilgiinId)
          },
          {
            baiguullagiinId: String(baiguullagiinId),
            barilgiinId: String(barilgiinId),
            choloolugdokhDavkhar: choloolugdokhDavkhar
          },
          {
            upsert: true, // Create if doesn't exist, update if exists
            new: true
          }
        );
        console.log(
          `✅ LiftShalgaya collection synced: ${choloolugdokhDavkhar.length} floors exempted`
        );
      }

      console.log(
        `✅ LiftShalgaya updated in baiguullaga: ${choloolugdokhDavkhar.length} floors exempted`
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
    console.log("FULL BODY DEBUG:", JSON.stringify(req.body, null, 2));
    const { db } = require("zevbackv2");

    // Note: duureg, horoo, and soh are optional - can be retrieved from baiguullaga if not provided
    // baiguullagiinId can be determined from address selection (OWN_ORG) if not provided upfront
    // If email is provided, proceed with Wallet API registration and get baiguullagiinId from address

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    if (!req.body.ner) {
      throw new aldaa("Нэр заавал бөглөх шаардлагатай!");
    }

    // Auto-set defaults for nevtrekhNer and nuutsUg from backend
    const phoneNumber = String(req.body.utas).trim();
    
    // Set nevtrekhNer to utas if not provided
    if (!req.body.nevtrekhNer) {
      req.body.nevtrekhNer = phoneNumber;
      console.log(`✅ [REGISTER] Auto-set nevtrekhNer to: ${phoneNumber}`);
    }
    
    // Set default password to "1234" if not provided
    if (!req.body.nuutsUg) {
      req.body.nuutsUg = "1234";
      console.log(`✅ [REGISTER] Auto-set nuutsUg to default: 1234`);
    }

    // Email is optional - only register with Wallet API if email is provided
    const email = req.body.mail ? String(req.body.mail).trim() : null;
    
    // If email is provided, we'll proceed with Wallet API registration
    // baiguullagiinId can be determined from address selection later
    // Only require baiguullagiinId upfront if no email (direct OWN_ORG registration)
    let baiguullaga = null;
    if (req.body.baiguullagiinId) {
      baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        req.body.baiguullagiinId
      );

      if (!baiguullaga) {
        throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
      }
    } else if (!email) {
      // No email and no baiguullagiinId - require baiguullagiinId for OWN_ORG registration
      throw new aldaa("Байгууллагын ID заавал бөглөх шаардлагатай!");
    }
    // If email is provided but no baiguullagiinId, we'll try to get it from address selection later
    let walletUserInfo = null;
    let walletUserId = null;

    if (email) {
      try {
        // First, try to get existing user from Wallet API
        console.log("📞 [WEBSITE REGISTER] Checking Wallet API for existing user...");
        walletUserInfo = await walletApiService.getUserInfo(phoneNumber);

        if (walletUserInfo && walletUserInfo.userId) {
          // User exists in Wallet API
          walletUserId = walletUserInfo.userId;
          console.log("✅ [WEBSITE REGISTER] User found in Wallet API:", walletUserId);
        } else {
          // User doesn't exist in Wallet API, register them
          console.log("📞 [WEBSITE REGISTER] Registering user in Wallet API...");
          walletUserInfo = await walletApiService.registerUser(phoneNumber, email);

          if (!walletUserInfo || !walletUserInfo.userId) {
            throw new aldaa("Хэтэвчний системд бүртгүүлэхэд алдаа гарлаа.");
          }

          walletUserId = walletUserInfo.userId;
          console.log("✅ [WEBSITE REGISTER] User registered in Wallet API:", walletUserId);
        }
      } catch (walletError) {
        console.error("❌ [WEBSITE REGISTER] Wallet API error:", walletError.message);
        // If Wallet API fails, we can still proceed with registration
        // but user won't be able to login via mobile until they register there
        console.warn("⚠️ [WEBSITE REGISTER] Continuing without Wallet API integration");
      }
    } else {
      console.log("ℹ️ [WEBSITE REGISTER] Email not provided, skipping Wallet API registration");
    }

    // Check for existing user by utas OR walletUserId (unified check)
    // Allow same phone number to register multiple toots - no duplicate check
    // If user exists, we'll use that user and add new toot to their toots array
    const existingUser = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [
        { utas: phoneNumber },
        ...(walletUserId ? [{ walletUserId: walletUserId }] : [])
      ]
    });

    // Check for cancelled gerees by utas (user might have been deleted but gerees still exist)
    // This allows restoring data when re-registering
    // Only check if baiguullaga exists
    let tukhainBaaziinKholbolt = null;
    if (baiguullaga) {
      tukhainBaaziinKholbolt = db.kholboltuud.find(
        (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
      );
    }

    let existingCancelledGeree = null;
    if (tukhainBaaziinKholbolt && baiguullaga) {
      const GereeModel = Geree(tukhainBaaziinKholbolt);
      // Find cancelled geree by utas (not by orshinSuugchId since user was deleted)
      existingCancelledGeree = await GereeModel.findOne({
        utas: { $in: [req.body.utas] }, // utas is an array in geree
        tuluv: "Цуцалсан",
        baiguullagiinId: baiguullaga._id.toString(),
      });
    }

    // If baiguullaga is not set yet but we have address info, try to find it
    // This can happen when email is provided but baiguullagiinId wasn't in request body
    if (!baiguullaga && req.body.bairniiNer) {
      // Try to find baiguullaga by searching through all organizations
      // This is a fallback when baiguullagiinId wasn't provided upfront
      const allBaiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({});
      for (const org of allBaiguullaguud) {
        const matchingBarilga = org.barilguud?.find(
          (b) => String(b.ner).trim() === String(req.body.bairniiNer).trim()
        );
        if (matchingBarilga) {
          baiguullaga = org;
          console.log(`✅ Found baiguullaga from address: ${baiguullaga.ner} (${baiguullaga._id})`);
          // Also set tukhainBaaziinKholbolt now that we have baiguullaga
          tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );
          break;
        }
      }
    }

    // If still no baiguullaga and we need it, try to get it from address selection
    // This handles the case where email is provided but baiguullagiinId needs to be determined
    if (!baiguullaga && (req.body.duureg || req.body.horoo || req.body.soh)) {
      // Try to find baiguullaga by location matching
      // This is a fallback when baiguullagiinId wasn't provided upfront
      const allBaiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({});
      for (const org of allBaiguullaguud) {
        for (const barilga of org.barilguud || []) {
          const tokhirgoo = barilga.tokhirgoo || {};
          const matchesDuureg = !req.body.duureg || !tokhirgoo.duuregNer || 
            String(tokhirgoo.duuregNer).trim() === String(req.body.duureg).trim();
          const matchesHoroo = !req.body.horoo || !tokhirgoo.horoo?.ner || 
            String(tokhirgoo.horoo.ner).trim() === String(req.body.horoo).trim();
          const matchesSoh = !req.body.soh || !tokhirgoo.sohNer || 
            String(tokhirgoo.sohNer).trim() === String(req.body.soh).trim();
          
          if (matchesDuureg && matchesHoroo && matchesSoh) {
            baiguullaga = org;
            console.log(`✅ Found baiguullaga from location: ${baiguullaga.ner} (${baiguullaga._id})`);
            // Also set tukhainBaaziinKholbolt now that we have baiguullaga
            tukhainBaaziinKholbolt = db.kholboltuud.find(
              (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
            );
            break;
          }
        }
        if (baiguullaga) break;
      }
    }

    // If baiguullaga is still not found and we need it for OWN_ORG registration, throw error
    // But if email is provided, allow registration to proceed without baiguullaga (wallet-only)
    if (!baiguullaga && !email) {
      throw new aldaa("Байгууллагын мэдээлэл олдсонгүй! Хаягийн мэдээлэлээс байгууллагыг олж чадсангүй.");
    }

    // Use barilgiinId from request if provided - RESPECT IT!
    // Check all possible fields where barilgiinId might be sent
    let barilgiinId =
      (req.body.barilgiinId && req.body.barilgiinId.toString().trim()) ||
      (req.body.barilgaId && req.body.barilgaId.toString().trim()) ||
      null;

    // If barilgiinId is provided, use it directly - don't search!
    // Only validate if baiguullaga exists
    if (barilgiinId && baiguullaga) {
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

    // Multiple users can have the same toot, so no unique check needed
    // Toot validation will be done when adding to toots array

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
          // Strictly block registration if toot is not in the system
          throw new aldaa(
            `"${req.body.toot}" тоот бүртгэлгүй байна. Та барилгын тохиргооноос тоотыг шалгана уу.`
          );
        }
      }
    }

    let orshinSuugch;
    let isReactivating = false;

    // Get initial electricity reading from request (default to 0 if not provided)
    const tsahilgaaniiZaalt = req.body.tsahilgaaniiZaalt !== undefined 
      ? parseFloat(req.body.tsahilgaaniiZaalt) || 0 
      : 0; // Default to 0 кВт if not provided
    
    console.log("⚡ [REGISTER] Request body tsahilgaaniiZaalt:", req.body.tsahilgaaniiZaalt);
    console.log("⚡ [REGISTER] Parsed tsahilgaaniiZaalt:", tsahilgaaniiZaalt, "кВт");

    // If user exists, use existing user and add new toot to their toots array
    // If user doesn't exist, create new user
    if (existingUser) {
      // User already exists - use existing user and add new toot
      orshinSuugch = existingUser;
      
      // Update user info if provided (name, email, etc.) but DON'T update toot-related fields
      // We'll add the new toot to toots array instead
      if (req.body.ner) orshinSuugch.ner = req.body.ner;
      if (req.body.ovog) orshinSuugch.ovog = req.body.ovog;
      if (req.body.mail || walletUserInfo?.email) {
        orshinSuugch.mail = walletUserInfo?.email || req.body.mail || email || orshinSuugch.mail;
      }
      if (walletUserId) orshinSuugch.walletUserId = walletUserId;
      if (req.body.ekhniiUldegdel !== undefined) {
        orshinSuugch.ekhniiUldegdel = parseFloat(req.body.ekhniiUldegdel) || 0;
      }
      if (tsahilgaaniiZaalt !== undefined) {
        orshinSuugch.tsahilgaaniiZaalt = tsahilgaaniiZaalt;
      }
      // DON'T update toot, davkhar, barilgiinId - these are for the new toot being added
      // The new toot will be added to toots array, keeping existing toots intact
    } else {
      // Create new user
      // IMPORTANT: Set tsahilgaaniiZaalt explicitly to ensure it's saved
      const userData = {
        ...req.body,
        mail: walletUserInfo?.email || req.body.mail || email, // Use email from Wallet API if available
        erkh: "OrshinSuugch",
        duureg: req.body.duureg,
        horoo: req.body.horoo,
        soh: req.body.soh,
        nevtrekhNer: req.body.nevtrekhNer, // Auto-set from utas earlier if not provided
        utas: phoneNumber, // Ensure phone number is properly set
        toot: req.body.toot || "",
        davkhar: determinedDavkhar, // Automatically determined from toot
        orts: req.body.orts || "", // Automatically determined from toot if found
        ekhniiUldegdel: req.body.ekhniiUldegdel
          ? parseFloat(req.body.ekhniiUldegdel) || 0
          : 0, // Optional: from frontend
        // Link to Wallet API (unifies website and mobile users)
        ...(walletUserId ? { walletUserId: walletUserId } : {}),
      };
      
      // Only set baiguullaga fields if baiguullaga exists (OWN_ORG registration)
      if (baiguullaga) {
        userData.baiguullagiinId = baiguullaga._id.toString();
        userData.baiguullagiinNer = baiguullaga.ner;
      }
      
      // Only set barilgiinId if it exists (OWN_ORG registration)
      if (barilgiinId) {
        userData.barilgiinId = barilgiinId;
      }
      
      userData.tsahilgaaniiZaalt = tsahilgaaniiZaalt;
      
      console.log("⚡ [REGISTER] userData.tsahilgaaniiZaalt:", userData.tsahilgaaniiZaalt);
      console.log("⚡ [REGISTER] Full userData keys:", Object.keys(userData));

      orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
    }
    
    console.log("⚡ [REGISTER] orshinSuugch.tsahilgaaniiZaalt after creation:", orshinSuugch.tsahilgaaniiZaalt);
    
    // Validate: User can only register with ONE building
    // If user already has a barilgiinId, they cannot register with a different one
    if (orshinSuugch.barilgiinId && barilgiinId) {
      const existingBarilgiinId = String(orshinSuugch.barilgiinId);
      const newBarilgiinId = String(barilgiinId);
      
      if (existingBarilgiinId !== newBarilgiinId) {
        // Get building names for better error message
        let existingBuildingName = "";
        let newBuildingName = "";
        
        if (baiguullaga) {
          const existingBarilga = baiguullaga.barilguud?.find(
            (b) => String(b._id) === existingBarilgiinId
          );
          const newBarilga = baiguullaga.barilguud?.find(
            (b) => String(b._id) === newBarilgiinId
          );
          
          existingBuildingName = existingBarilga?.ner || existingBarilgiinId;
          newBuildingName = newBarilga?.ner || newBarilgiinId;
        }
        
        return res.status(400).json({
          success: false,
          message: `Та аль хэдийн "${existingBuildingName}" барилгад бүртгэгдсэн байна. Өөр барилгад бүртгүүлэх боломжгүй.`,
        });
      }
    }
    
    if (!orshinSuugch.toots) {
      orshinSuugch.toots = [];
    }
    
    // Check req.body.toot instead of orshinSuugch.toot (which might be empty for new users)
    // Also need baiguullaga and barilgiinId to create toot entry
    if (req.body.toot && barilgiinId && baiguullaga) {
      const targetBarilga = baiguullaga.barilguud?.find(
        (b) => String(b._id) === String(barilgiinId)
      );
      
      if (targetBarilga) {
        const duuregNer = targetBarilga.tokhirgoo?.duuregNer || req.body.duureg || "";
        // Normalize horoo to always be an object format
        let horooData = targetBarilga.tokhirgoo?.horoo || req.body.horoo || {};
        if (typeof horooData === 'string') {
          horooData = { ner: horooData, kod: horooData };
        } else if (!horooData || typeof horooData !== 'object') {
          horooData = {};
        }
        const sohNer = targetBarilga.tokhirgoo?.sohNer || req.body.soh || "";
        
        // Use toot from request body, not from orshinSuugch (which might be old toot for existing users)
        const newToot = req.body.toot || "";
        const newDavkhar = determinedDavkhar || req.body.davkhar || "";
        const newOrts = req.body.orts || "1";
        
        const tootEntry = {
          toot: newToot,
          source: "OWN_ORG",
          baiguullagiinId: baiguullaga._id.toString(),
          barilgiinId: barilgiinId,
          davkhar: newDavkhar,
          orts: newOrts,
          duureg: duuregNer,
          horoo: horooData,
          soh: sohNer,
          bairniiNer: targetBarilga.ner || "",
          createdAt: new Date()
        };
        
        const existingTootIndex = orshinSuugch.toots.findIndex(
          t => t.toot === tootEntry.toot && 
               t.barilgiinId === tootEntry.barilgiinId
        );
        
        if (existingTootIndex >= 0) {
          // Update existing toot entry if same toot and barilgiinId
          orshinSuugch.toots[existingTootIndex] = tootEntry;
          console.log(`orshinSuugch service`);
        } else {
          // Add new toot to array - don't update primary toot fields for existing users
          orshinSuugch.toots.push(tootEntry);
          console.log(`orshinSuugch service`);
        }
        
        // Only update primary toot fields (toot, davkhar, barilgiinId, bairniiNer) if this is a NEW user
        // For existing users, keep their primary toot and just add new toot to toots array
        if (!existingUser && newToot) {
          orshinSuugch.toot = newToot;
          orshinSuugch.davkhar = newDavkhar;
          orshinSuugch.orts = newOrts;
          orshinSuugch.barilgiinId = barilgiinId;
          orshinSuugch.baiguullagiinId = baiguullaga._id;
          orshinSuugch.baiguullagiinNer = baiguullaga.ner;
          // Set bairniiNer on main document (like Excel import does)
          orshinSuugch.bairniiNer = targetBarilga.ner || "";
        }
      }
    }
    
    await orshinSuugch.save();
    console.log("✅ [REGISTER] orshinSuugch saved successfully:", orshinSuugch._id);

     // --- AUTO CREATE GUEST SETTINGS (Mashin) ---
    try {
      const Mashin = require("../models/mashin");
      const targetBarilga = baiguullaga?.barilguud?.find(b => String(b._id) === String(barilgiinId));
      const buildingSettings = targetBarilga?.tokhirgoo?.zochinTokhirgoo;
      const orgSettings = baiguullaga?.tokhirgoo?.zochinTokhirgoo;
      
      const defaultSettings = buildingSettings && buildingSettings.zochinUrikhEsekh !== undefined
         ? buildingSettings 
         : orgSettings;

      if (defaultSettings) {
         console.log(`🔍 [AUTO-ZOCHIN] Found defaults for ${orshinSuugch.ner}. Quota: ${defaultSettings.zochinErkhiinToo}`);
         const MashinModel = Mashin(tukhainBaaziinKholbolt);
         
         const existingSettings = await MashinModel.findOne({
            ezemshigchiinId: orshinSuugch._id.toString(),
            zochinTurul: "Оршин суугч"
         });
         
         if (!existingSettings) {
            const newMashin = new MashinModel({
                ezemshigchiinId: orshinSuugch._id.toString(),
                ezemshigchiinNer: orshinSuugch.ner,
                ezemshigchiinUtas: orshinSuugch.utas,
                baiguullagiinId: baiguullaga._id.toString(),
                barilgiinId: barilgiinId,
                dugaar: (() => {
                  if (req.body.mashiniiDugaar) return req.body.mashiniiDugaar;
                  if (req.body.dugaar) return req.body.dugaar;
                  if (req.body.mashin && req.body.mashin.dugaar) return req.body.mashin.dugaar;
                  if (Array.isArray(req.body.mashinuud) && req.body.mashinuud.length > 0) {
                    const m = req.body.mashinuud[0];
                    return typeof m === 'object' ? (m.dugaar || m.mashiniiDugaar || "БҮРТГЭЛГҮЙ") : m;
                  }
                  return "БҮРТГЭЛГҮЙ";
                })(),
                mashiniiDugaar: (() => {
                  if (req.body.mashiniiDugaar) return req.body.mashiniiDugaar;
                  if (req.body.dugaar) return req.body.dugaar;
                  if (req.body.mashin && req.body.mashin.dugaar) return req.body.mashin.dugaar;
                  if (Array.isArray(req.body.mashinuud) && req.body.mashinuud.length > 0) {
                    const m = req.body.mashinuud[0];
                    return typeof m === 'object' ? (m.dugaar || m.mashiniiDugaar || "БҮРТГЭЛГҮЙ") : m;
                  }
                  return "БҮРТГЭЛГҮЙ";
                })(),
                ezenToot: orshinSuugch.toot || req.body.toot || "",
                zochinUrikhEsekh: defaultSettings.zochinUrikhEsekh !== false, 
                zochinTurul: "Оршин суугч", 
                zochinErkhiinToo: defaultSettings.zochinErkhiinToo || 0,
                zochinTusBurUneguiMinut: defaultSettings.zochinTusBurUneguiMinut || 0,
                zochinNiitUneguiMinut: defaultSettings.zochinNiitUneguiMinut || 0,
                zochinTailbar: defaultSettings.zochinTailbar || "",
                davtamjiinTurul: defaultSettings.davtamjiinTurul || "saraar",
                davtamjUtga: defaultSettings.davtamjUtga
            });
            
            await newMashin.save();
            console.log(`✅ [AUTO-ZOCHIN] Mashin record created for ${orshinSuugch.ner}`);
         } else {
            console.log(`ℹ️ [AUTO-ZOCHIN] Mashin record already exists for ${orshinSuugch.ner}`);
         }
      } else {
         console.log(`⚠️ [AUTO-ZOCHIN] No default guest settings found for building or organization`);
      }
    } catch (zochinErr) {
      console.error("❌ [AUTO-ZOCHIN] Error:", zochinErr.message);
    }
    
    // Verify tsahilgaaniiZaalt was saved
    const savedOrshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(orshinSuugch._id).select("tsahilgaaniiZaalt");
    console.log("✅ [REGISTER] Verified tsahilgaaniiZaalt saved to orshinSuugch:", savedOrshinSuugch?.tsahilgaaniiZaalt);

    try {
      // Only create contracts if baiguullaga exists (OWN_ORG registration)
      // If email is provided but no baiguullaga, skip contract creation (wallet-only registration)
      if (!baiguullaga) {
        console.log("ℹ️ [REGISTER] No baiguullaga found - skipping contract creation (wallet-only registration)");
      } else {
        // Reuse tukhainBaaziinKholbolt from above (already declared)
        if (!tukhainBaaziinKholbolt) {
          console.error("❌ [REGISTER] tukhainBaaziinKholbolt not found for baiguullaga:", baiguullaga._id);
          throw new Error("Байгууллагын холболтын мэдээлэл олдсонгүй");
        }
        
        console.log("✅ [REGISTER] tukhainBaaziinKholbolt found, proceeding with contract creation");

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

      // Extract tailbar from ashiglaltiinZardluud (combine all tailbar values if multiple exist)
      const tailbarFromZardluud = ashiglaltiinZardluudData
        .map((zardal) => zardal.tailbar)
        .filter((tailbar) => tailbar && tailbar.trim())
        .join("; ") || "";

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

      // Validate: One toot occupancy check
      // Check if this toot already has an active contract with a different orshinSuugchId
      const GereeModel = Geree(tukhainBaaziinKholbolt);
      if (orshinSuugch.toot && barilgiinId) {
        const conflictingGeree = await GereeModel.findOne({
          barilgiinId: barilgiinId,
          toot: orshinSuugch.toot,
          tuluv: "Идэвхтэй",
          orshinSuugchId: { $ne: orshinSuugch._id.toString() }
        });
 
        if (conflictingGeree) {
          // Log warning instead of throwing error to allow roommates/multi-family registration
          console.warn(`⚠️ [REGISTER] Unit ${orshinSuugch.toot} is already occupied by another user (${conflictingGeree.orshinSuugchId}). Allowing multiple registration.`);
        }
      }

      // If there's a cancelled geree, reactivate it and link it to the new user
      // Do this AFTER fetching charges so we can update zardluud with current charges
      const existingCancelledGeree = await GereeModel.findOne({
        toot: orshinSuugch.toot || "",
        barilgiinId: barilgiinId || "",
        tuluv: "Цуцалсан",
      });

      if (existingCancelledGeree && tukhainBaaziinKholbolt) {
        isReactivating = true;

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
          bairNer: targetBarilgaForZardluud?.ner || existingCancelledGeree.bairNer || "", // Update building name
          duureg: req.body.duureg || existingCancelledGeree.duureg,
          horoo: req.body.horoo || existingCancelledGeree.horoo,
          sohNer: req.body.soh || existingCancelledGeree.sohNer,
          // Update electricity readings if provided
          umnukhZaalt: tsahilgaaniiZaalt, // Previous reading (initial reading at reactivation)
          suuliinZaalt: tsahilgaaniiZaalt, // Current reading (same as initial at reactivation)
          zaaltTog: 0, // Day reading (will be updated later)
          zaaltUs: 0, // Night reading (will be updated later)
        };

        console.log("orshinSuugch service");

        // Add optional fields from frontend if provided
        if (req.body.tailbar) {
          updateData.temdeglel = req.body.tailbar;
          updateData.tailbar = req.body.tailbar;
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
      // Normalize horoo to always be an object format
      let horooData = targetBarilga?.tokhirgoo?.horoo || req.body.horoo || {};
      if (typeof horooData === 'string') {
        horooData = { ner: horooData, kod: horooData };
      } else if (!horooData || typeof horooData !== 'object') {
        horooData = {};
      }
      const sohNer = targetBarilga?.tokhirgoo?.sohNer || req.body.soh || "";

      // Only create new geree if not reactivating (no cancelled geree found)
      if (!isReactivating) {
        // Create geree for each toot in toots array
        // If toots array exists and has entries, create geree for each toot
        // Otherwise, create geree for primary toot (backward compatibility)
        const tootsToProcess = orshinSuugch.toots && orshinSuugch.toots.length > 0 
          ? orshinSuugch.toots 
          : (orshinSuugch.toot ? [{ 
              toot: orshinSuugch.toot, 
              barilgiinId: barilgiinId,
              davkhar: orshinSuugch.davkhar || "",
              orts: orshinSuugch.orts || "1",
              duureg: duuregNer,
              horoo: horooData,
              soh: sohNer,
              bairniiNer: req.body.bairniiNer || "",
            }] : []);

        for (const tootEntry of tootsToProcess) {
          // Check if geree already exists for this toot
          const existingGereeForToot = await GereeModel.findOne({
            toot: tootEntry.toot,
            barilgiinId: tootEntry.barilgiinId || barilgiinId,
            tuluv: "Идэвхтэй",
            orshinSuugchId: orshinSuugch._id.toString()
          });

          if (existingGereeForToot) {
            console.log(`ℹ️ [REGISTER] Geree already exists for toot ${tootEntry.toot}, skipping...`);
            continue; // Skip if geree already exists for this toot
          }

          // Get target barilga for this toot
          const targetBarilgaForToot = baiguullaga.barilguud?.find(
            (b) => String(b._id) === String(tootEntry.barilgiinId || barilgiinId)
          );

          if (!targetBarilgaForToot) {
            console.log(`⚠️ [REGISTER] Building not found for barilgiinId: ${tootEntry.barilgiinId || barilgiinId}, skipping geree creation for toot ${tootEntry.toot}`);
            continue; // Skip if barilga not found
          }
          
          console.log(`📋 [REGISTER] Creating geree for toot ${tootEntry.toot} in building ${targetBarilgaForToot.ner}...`);

          const duuregNerForToot = targetBarilgaForToot.tokhirgoo?.duuregNer || tootEntry.duureg || duuregNer || "";
          // Normalize horoo to always be an object format
          let horooDataForToot = targetBarilgaForToot.tokhirgoo?.horoo || tootEntry.horoo || horooData || {};
          if (typeof horooDataForToot === 'string') {
            horooDataForToot = { ner: horooDataForToot, kod: horooDataForToot };
          } else if (!horooDataForToot || typeof horooDataForToot !== 'object') {
            horooDataForToot = {};
          }
          const sohNerForToot = targetBarilgaForToot.tokhirgoo?.sohNer || tootEntry.soh || sohNer || "";

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
            barilgiinId: tootEntry.barilgiinId || barilgiinId || "",
            tulukhOgnoo: new Date(),
            ashiglaltiinZardal: 0,
            niitTulbur: niitTulbur,
            toot: tootEntry.toot,
            davkhar: tootEntry.davkhar || "",
            orts: tootEntry.orts || req.body.orts || "",
            bairNer: tootEntry.bairniiNer || targetBarilgaForToot.ner || "",
            sukhBairshil: `${duuregNerForToot}, ${horooDataForToot.ner || ""}, ${sohNerForToot}`,
            duureg: duuregNerForToot,
            horoo: horooDataForToot,
            sohNer: sohNerForToot,
            burtgesenAjiltan: orshinSuugch._id,
            orshinSuugchId: orshinSuugch._id.toString(),
            temdeglel: req.body.tailbar || `Автоматаар үүссэн гэрээ (Тоот: ${tootEntry.toot})`,
            tailbar: req.body.tailbar || tailbarFromZardluud || "",
            actOgnoo: new Date(),
            baritsaaniiUldegdel: 0,
            ekhniiUldegdel: req.body.ekhniiUldegdel
              ? parseFloat(req.body.ekhniiUldegdel) || 0
              : 0,
            umnukhZaalt: tsahilgaaniiZaalt,
            suuliinZaalt: tsahilgaaniiZaalt,
            zaaltTog: 0,
            zaaltUs: 0,
            zardluud: zardluudArray,
            segmentuud: [],
            khungulultuud: [],
          };

          const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
          await geree.save();
          console.log(`✅ [REGISTER] Geree created successfully for toot ${tootEntry.toot}:`, geree._id);
          console.log(`✅ [REGISTER] Geree number: ${geree.gereeniiDugaar}`);

          // Create invoice immediately (Like Excel Import)
          try {
            const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
            const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
              geree,
              baiguullaga,
              tukhainBaaziinKholbolt,
              "automataar"
            );
            if (invoiceResult.success) {
              console.log(`✅ [REGISTER] Initial invoice created for toot ${tootEntry.toot}`);
            }
          } catch (invErr) {
            console.error(`❌ [REGISTER] Invoice creation error for toot ${tootEntry.toot}:`, invErr.message);
          }

          // Update davkhar with toot if provided
          if (tootEntry.toot && tootEntry.davkhar) {
            await exports.updateDavkharWithToot(
              baiguullaga,
              tootEntry.barilgiinId || barilgiinId,
              tootEntry.davkhar,
              tootEntry.toot,
              tukhainBaaziinKholbolt
            );
            console.log(`✅ [REGISTER] Updated davkhar ${tootEntry.davkhar} with toot ${tootEntry.toot}`);
          }
        }
        
        console.log(`✅ [REGISTER] Processed ${tootsToProcess.length} toot(s) for geree creation`);
      } else {
        console.log(`ℹ️ [REGISTER] Skipping geree creation (reactivating existing geree)`);
        
        // If reactivating, we should also try to create/ensure invoice exists
        if (existingCancelledGeree && tukhainBaaziinKholbolt) {
          const GereeModel = Geree(tukhainBaaziinKholbolt);
          const reactivatedGeree = await GereeModel.findById(existingCancelledGeree._id);
          if (reactivatedGeree) {
            try {
              const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
              const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
                reactivatedGeree,
                baiguullaga,
                tukhainBaaziinKholbolt,
                "automataar"
              );
              console.log(`✅ [REGISTER] Invoice status for reactivated geree: ${invoiceResult.success ? 'Success' : 'Failed'}`);
            } catch (invErr) {
              console.error("❌ [REGISTER] Reactivation invoice error:", invErr.message);
            }
          }
        }
      }
      }
    } catch (contractError) {
      console.error("❌ [REGISTER] Error creating contract:", contractError);
      console.error("❌ [REGISTER] Contract error stack:", contractError?.stack);
      // Don't fail registration if contract creation fails - user is already saved
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
    console.error("❌ [REGISTER] Error in orshinSuugchBurtgey:", error);
    console.error("❌ [REGISTER] Error stack:", error?.stack);
    next(error);
  }
});

exports.davhardsanOrshinSuugchShalgayy = asyncHandler(
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const { utas, baiguullagiinId } = req.body;

      // Allow same phone number to register multiple toots - no duplicate check
      // User can have multiple toots, so always return success
      res.json({
        success: true,
        message: "Ашиглах боломжтой",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Toot validation endpoint for OWN_ORG bair
exports.validateOwnOrgToot = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { toot, baiguullagiinId, barilgiinId, davkhar, orts } = req.body;

    if (!toot) {
      return res.status(400).json({
        success: false,
        message: "Тоот заавал оруулах шаардлагатай!",
        valid: false
      });
    }

    if (!baiguullagiinId || !barilgiinId) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын болон барилгын ID заавал оруулах шаардлагатай!",
        valid: false
      });
    }

    // Find baiguullaga
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
        valid: false
      });
    }

    // Find target barilga
    const targetBarilga = baiguullaga.barilguud?.find(
      (b) => String(b._id) === String(barilgiinId)
    );

    if (!targetBarilga) {
      return res.status(404).json({
        success: false,
        message: "Барилгын мэдээлэл олдсонгүй!",
        valid: false
      });
    }

    const tootToValidate = String(toot).trim();
    const davkharToValidate = davkhar ? String(davkhar).trim() : "";
    const ortsToValidate = orts ? String(orts).trim() : "1";
    
    // Check if toot exists in davkhariinToonuud (available toots)
    const davkhariinToonuud = targetBarilga.tokhirgoo?.davkhariinToonuud || {};
    let tootFound = false;
    let foundDavkhar = null;
    let foundOrts = null;
    let availableToonuud = [];

    if (davkharToValidate) {
      // If davkhar is provided, check specific floor
      const floorKey = `${ortsToValidate}::${davkharToValidate}`;
      const tootArray = davkhariinToonuud[floorKey];
      
      if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
        let tootList = [];
        if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
          tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
        } else {
          tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
        }
        
        availableToonuud = tootList;
        if (tootList.includes(tootToValidate)) {
          tootFound = true;
          foundDavkhar = davkharToValidate;
          foundOrts = ortsToValidate;
        }
      }
    } else {
      // If davkhar not provided, search all floors
      for (const [floorKey, tootArray] of Object.entries(davkhariinToonuud)) {
        if (!floorKey.includes("::")) {
          continue; // Skip invalid keys
        }

        if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
          let tootList = [];
          if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
            tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
          } else {
            tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
          }
          
          // Collect all available toots
          availableToonuud = [...availableToonuud, ...tootList];
          
          if (tootList.includes(tootToValidate)) {
            tootFound = true;
            const parts = floorKey.split("::");
            if (parts.length === 2) {
              foundOrts = parts[0].trim();
              foundDavkhar = parts[1].trim();
            }
            break;
          }
        }
      }
    }

    if (!tootFound) {
      return res.status(400).json({
        success: false,
        message: "Бүртгэлгүй тоот байна",
        valid: false,
        availableToonuud: availableToonuud.length > 0 ? [...new Set(availableToonuud)].sort() : []
      });
    }

    // Check if toot is already assigned to a user
    // Check both new toots array and old toot field for backward compatibility
    const existingUserWithToot = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [
        {
          toots: {
            $elemMatch: {
              toot: tootToValidate,
              barilgiinId: String(barilgiinId)
            }
          }
        },
        {
          // Check old toot field for backward compatibility
          toot: tootToValidate,
          barilgiinId: String(barilgiinId)
        }
      ]
    });

    if (existingUserWithToot) {
      return res.status(400).json({
        success: false,
        message: `(${tootToValidate}) тоот аль хэдийн хэрэглэгчид бүртгэгдсэн байна`,
        valid: false,
        existingUser: {
          id: existingUserWithToot._id,
          ner: existingUserWithToot.ner,
          utas: existingUserWithToot.utas
        }
      });
    }

    return res.json({
      success: true,
      message: "Тоот зөв байна",
      valid: true,
      result: {
        toot: tootToValidate,
        davkhar: foundDavkhar,
        orts: foundOrts
      }
    });
  } catch (error) {
    console.error("❌ [TOOT VALIDATION] Error:", error.message);
    next(error);
  }
});

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
    console.log("🔐 [LOGIN] Login request received");
    console.log("🔐 [LOGIN] Phone:", req.body.utas);
    console.log("🔐 [LOGIN] Firebase token provided:", !!req.body.firebaseToken);

    const { db } = require("zevbackv2");

    if (!req.body.utas) {
      throw new aldaa("Утасны дугаар заавал бөглөх шаардлагатай!");
    }

    const phoneNumber = String(req.body.utas).trim();

    // Password validation - support both local and Wallet API passwords
    if (!req.body.nuutsUg) {
      throw new aldaa("Нууц үг заавал бөглөх шаардлагатай!");
    }

    const providedPassword = String(req.body.nuutsUg).trim();

    // Find user in local database first (password is stored locally, NOT in Wallet API)
    let orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt)
      .findOne({
        utas: phoneNumber
      })
      .select("+nuutsUg"); // Include password field (normally excluded by select: false)

    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }

    // Get Wallet API user info for other operations (billing, etc.) but NOT for password validation
    let walletUserInfo = null;
    let walletUserId = null;
    
    try {
      console.log("📞 [LOGIN] Fetching user from Wallet API for billing info...");
      walletUserInfo = await walletApiService.getUserInfo(phoneNumber);
      
      if (walletUserInfo && walletUserInfo.userId) {
        walletUserId = walletUserInfo.userId;
        console.log("✅ [LOGIN] User found in Wallet API:", walletUserId);
      } else {
        console.warn("⚠️ [LOGIN] User not found in Wallet API (will continue with local login)");
      }
    } catch (walletError) {
      console.warn("⚠️ [LOGIN] Wallet API error (will continue with local login):", walletError.message);
      // Continue without Wallet API - password validation is local only
    }

    // Validate password - only use local password (stored in our own DB)
    // Password is NOT sent to Wallet API, only stored in our database
    let passwordValid = false;

    if (!orshinSuugch) {
      throw new aldaa("Хэрэглэгч олдсонгүй!");
    }

    if (!orshinSuugch.nuutsUg) {
      throw new aldaa("Нууц үг тохируулаагүй байна. Эхлээд бүртгүүлнэ үү.");
    }

    // Validate against local password (stored in our database)
    console.log("🔐 [LOGIN] Validating password from local database...");
    try {
      passwordValid = await orshinSuugch.passwordShalgaya(providedPassword);
      if (passwordValid) {
        console.log("✅ [LOGIN] Password validated successfully");
      } else {
        console.log("❌ [LOGIN] Password validation failed");
      }
    } catch (passwordError) {
      console.error("❌ [LOGIN] Error validating password:", passwordError.message);
      passwordValid = false;
    }

    if (!passwordValid) {
      throw new aldaa("Нууц үг буруу байна!");
    }

    // Send SMS verification code on login
    // Frontend will handle verification status in local storage
    // TEMPORARILY DISABLED: SMS sending for login
    const ENABLE_LOGIN_SMS = false; // Set to true to re-enable SMS verification on login
    
    if (ENABLE_LOGIN_SMS) {
      try {
        console.log("📱 [LOGIN] Sending SMS verification code");
        
        // Get baiguullaga for SMS sending
        let baiguullagiinId = orshinSuugch.baiguullagiinId;
        if (!baiguullagiinId && req.body.baiguullagiinId) {
          baiguullagiinId = req.body.baiguullagiinId;
        }
        
        if (baiguullagiinId) {
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
          if (baiguullaga) {
            const tukhainBaaziinKholbolt = db.kholboltuud.find(
              (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
            );
            
            if (tukhainBaaziinKholbolt) {
              // Generate and send verification code
              const BatalgaajuulahCodeModel = BatalgaajuulahCode(tukhainBaaziinKholbolt);
              const verificationCodeDoc = await BatalgaajuulahCodeModel.batalgaajuulkhCodeUusgeye(
                phoneNumber,
                "login", // Purpose: login verification
                10 // Expires in 10 minutes
              );

              // Send SMS
              var msgIlgeekhKey = "aa8e588459fdd9b7ac0b809fc29cfae3";
              var msgIlgeekhDugaar = "72002002";
              var smsText = `AmarSukh: Tany nevtrekh batalgaajuulax code: ${verificationCodeDoc.code}.`;
              
              var ilgeexList = [
                {
                  to: phoneNumber,
                  text: smsText,
                  gereeniiId: "login_verification",
                },
              ];

              var khariu = [];
              msgIlgeeye(
                ilgeexList,
                msgIlgeekhKey,
                msgIlgeekhDugaar,
                khariu,
                0,
                tukhainBaaziinKholbolt,
                baiguullagiinId
              );

              console.log("✅ [LOGIN] SMS verification code sent to:", phoneNumber);
            }
          }
        }
      } catch (smsError) {
        console.error("⚠️ [LOGIN] Error sending SMS (continuing with login):", smsError.message);
        // Don't fail login if SMS fails
      }
    } else {
      console.log("⚠️ [LOGIN] SMS verification DISABLED - login proceeding without SMS");
    }

    const userData = {
      utas: phoneNumber,
      mail: walletUserInfo?.email || orshinSuugch.mail || "",
      erkh: "OrshinSuugch",
      nevtrekhNer: phoneNumber,
    };

    // Update walletUserId if available (for billing, etc.) but password stays local
    if (walletUserId) {
      userData.walletUserId = walletUserId;
    }

    // 1. Preserve existing primary organization - STRIKTLY IMMUTABLE
    if (orshinSuugch && orshinSuugch.baiguullagiinId) {
      // If user exists and has an org, that is their PERMANENT primary home in erunkhiiBaaz
      userData.baiguullagiinId = orshinSuugch.baiguullagiinId;
      userData.baiguullagiinNer = orshinSuugch.baiguullagiinNer;
      console.log(`ℹ️ [LOGIN] Locked primary org: ${orshinSuugch.baiguullagiinId}`);
    } else if (req.body.baiguullagiinId) {
      // For NEW users without an org, set the initial primary org
      userData.baiguullagiinId = req.body.baiguullagiinId;
    }
    
    // 2. Fetch baiguullaga name if we are setting it for the first time
    if (userData.baiguullagiinId && !userData.baiguullagiinNer) {
      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(userData.baiguullagiinId);
        if (baiguullaga && baiguullaga.ner) {
          userData.baiguullagiinNer = baiguullaga.ner;
        }
      } catch (err) {
        console.error("Error fetching baiguullaga name:", err.message);
      }
    }

    // Handle barilgiinId - check both barilgiinId and bairId (frontend might send either)
    const barilgiinIdToSave = req.body.barilgiinId || req.body.bairId;
    
    // Check if this is an OWN_ORG address login (user is explicitly selecting a building)
    const isOwnOrgAddressLoginCheck = req.body.baiguullagiinId && req.body.doorNo && (req.body.barilgiinId || req.body.bairId);
    
    // Validate: User can only register with ONE building
    // ONLY validate if user is explicitly trying to login with OWN_ORG address AND a different building
    // If user is just logging in normally (without providing barilgiinId), allow it
    if (isOwnOrgAddressLoginCheck && orshinSuugch && orshinSuugch.barilgiinId && barilgiinIdToSave) {
      const existingBarilgiinId = String(orshinSuugch.barilgiinId);
      const newBarilgiinId = String(barilgiinIdToSave);
      
      console.log("🔍 [LOGIN] Checking building validation...");
      console.log("🔍 [LOGIN] Existing barilgiinId:", existingBarilgiinId);
      console.log("🔍 [LOGIN] New barilgiinId:", newBarilgiinId);
      console.log("🔍 [LOGIN] isOwnOrgAddressLoginCheck:", isOwnOrgAddressLoginCheck);
      
      if (existingBarilgiinId !== newBarilgiinId) {
        // Get building names for better error message
        let existingBuildingName = "";
        let newBuildingName = "";
        
        try {
          if (userData.baiguullagiinId || orshinSuugch.baiguullagiinId) {
            const baiguullagaId = userData.baiguullagiinId || orshinSuugch.baiguullagiinId;
            const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagaId);
            
            if (baiguullaga) {
              const existingBarilga = baiguullaga.barilguud?.find(
                (b) => String(b._id) === existingBarilgiinId
              );
              const newBarilga = baiguullaga.barilguud?.find(
                (b) => String(b._id) === newBarilgiinId
              );
              
              existingBuildingName = existingBarilga?.ner || existingBarilgiinId;
              newBuildingName = newBarilga?.ner || newBarilgiinId;
            }
          }
        } catch (err) {
          console.error("Error fetching building names:", err.message);
        }
        
        console.error("❌ [LOGIN] User trying to login with different building!");
        console.error("❌ [LOGIN] Existing:", existingBuildingName, "New:", newBuildingName);
        
        return res.status(400).json({
          success: false,
          message: `Та аль хэдийн "${existingBuildingName}" барилгад бүртгэгдсэн байна. Өөр барилгад нэвтрэх боломжгүй.`,
        });
      }
    } else {
      console.log("✅ [LOGIN] Building validation skipped (not OWN_ORG login or no barilgiinId provided)");
      console.log("✅ [LOGIN] isOwnOrgAddressLoginCheck:", isOwnOrgAddressLoginCheck);
      console.log("✅ [LOGIN] orshinSuugch.barilgiinId:", orshinSuugch?.barilgiinId);
      console.log("✅ [LOGIN] barilgiinIdToSave:", barilgiinIdToSave);
    }
    
    // 3. Preserve existing primary building - STRIKTLY IMMUTABLE
    if (orshinSuugch && orshinSuugch.barilgiinId) {
      // Use existing building, ignore barilgiinIdToSave for primary document
      userData.barilgiinId = orshinSuugch.barilgiinId;
      console.log(`ℹ️ [LOGIN] Locked primary building: ${orshinSuugch.barilgiinId}`);
    } else if (barilgiinIdToSave) {
      // First time setting a building
      userData.barilgiinId = barilgiinIdToSave;
    }

    // Validate OWN_ORG bair toot/doorNo if provided
    // Check for OWN_ORG: baiguullagiinId is required, and either barilgiinId OR bairId (frontend might send bairId)
    const isOwnOrgAddressLogin = req.body.baiguullagiinId && req.body.doorNo && (req.body.barilgiinId || req.body.bairId);
    const ownOrgBarilgiinIdLogin = req.body.barilgiinId || req.body.bairId; // Use barilgiinId if provided, otherwise bairId
    
    if (isOwnOrgAddressLogin) {
      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(req.body.baiguullagiinId);
        if (!baiguullaga) {
          throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
        }

        const targetBarilga = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(ownOrgBarilgiinIdLogin)
        );

        if (!targetBarilga) {
          throw new aldaa("Барилгын мэдээлэл олдсонгүй!");
        }

        const tootToValidate = req.body.doorNo.trim();
        const davkharToValidate = (req.body.davkhar || "").trim();
        const ortsToValidate = (req.body.orts || "1").trim();
        
        // Check if toot exists in davkhariinToonuud (available toots)
        // Automatically determine orts and davkhar from toot
        const davkhariinToonuud = targetBarilga.tokhirgoo?.davkhariinToonuud || {};
        let tootFound = false;
        let foundDavkhar = null;
        let foundOrts = null;

        if (davkharToValidate) {
          // If davkhar is provided, check specific floor
          const floorKey = `${ortsToValidate}::${davkharToValidate}`;
          const tootArray = davkhariinToonuud[floorKey];
          
          if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
            let tootList = [];
            if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
              tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
            } else {
              tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
            }
            
            if (tootList.includes(tootToValidate)) {
              tootFound = true;
              foundDavkhar = davkharToValidate;
              foundOrts = ortsToValidate;
            }
          }
        } else {
          // If davkhar not provided, search all floors
          for (const [floorKey, tootArray] of Object.entries(davkhariinToonuud)) {
            // Skip invalid entries that don't have :: separator
            if (!floorKey.includes("::")) {
              continue;
            }
            
            if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
              let tootList = [];
              if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
                tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
              } else {
                tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
              }
              
              if (tootList.includes(tootToValidate)) {
                tootFound = true;
                // Extract orts and davkhar from floorKey (format: "orts::davkhar")
                const parts = floorKey.split("::");
                if (parts.length === 2) {
                  foundOrts = parts[0].trim(); // orts (entrance)
                  foundDavkhar = parts[1].trim(); // davkhar (floor)
                }
                break;
              }
            }
          }
        }

        if (!tootFound) {
          throw new aldaa(`(${tootToValidate}) тоот энэ барилгад бүртгэлгүй байна`);
        }

        // Use found values, fallback to request values if not found
        const finalDavkhar = foundDavkhar || davkharToValidate || "";
        const finalOrts = foundOrts || ortsToValidate || "1";

        // Validation passes - toot will be added to toots array
        // Multiple users can have the same toot, so no unique check needed
        console.log(`✅ [WALLET LOGIN] OWN_ORG toot validated: ${tootToValidate}, auto-determined davkhar=${finalDavkhar}, orts=${finalOrts}`);
        
        // Prepare toot entry for toots array
        userData.newTootEntry = {
          toot: tootToValidate,
          source: "OWN_ORG",
          baiguullagiinId: req.body.baiguullagiinId,
          barilgiinId: ownOrgBarilgiinIdLogin, // Use the resolved barilgiinId (from barilgiinId or bairId)
          davkhar: finalDavkhar, // Auto-determined from toot
          orts: finalOrts, // Auto-determined from toot
          duureg: targetBarilga.tokhirgoo?.duuregNer || "",
          horoo: targetBarilga.tokhirgoo?.horoo || {},
          soh: targetBarilga.tokhirgoo?.sohNer || "",
          bairniiNer: targetBarilga.ner || ""
        };
      } catch (error) {
        console.error("❌ [WALLET LOGIN] OWN_ORG toot validation error:", error.message);
        throw error;
      }
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
      // Initialize toots array if it doesn't exist
      if (!orshinSuugch.toots) {
        orshinSuugch.toots = [];
      }
    } else {
      console.log("➕ [WALLET LOGIN] Creating new user");
      orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
      // Initialize toots array if it doesn't exist
      if (!orshinSuugch.toots) {
        orshinSuugch.toots = [];
      }
    }

    // Handle multiple toots - add new toot to array if provided
    if (userData.newTootEntry) {
      // Check if this toot already exists in user's toots array
      const existingTootIndex = orshinSuugch.toots?.findIndex(
        t => t.toot === userData.newTootEntry.toot && 
             t.barilgiinId === userData.newTootEntry.barilgiinId
      );
      
      if (existingTootIndex >= 0) {
        // Update existing toot entry
        orshinSuugch.toots[existingTootIndex] = userData.newTootEntry;
        console.log(`🔄 [WALLET LOGIN] Updated existing toot in array: ${userData.newTootEntry.toot}`);
      } else {
        // Add new toot to array
        orshinSuugch.toots.push(userData.newTootEntry);
        console.log(`➕ [WALLET LOGIN] Added new toot to array: ${userData.newTootEntry.toot}`);
      }
      
      // Also set as primary toot ONLY if user doesn't have one (first registration)
      if (!orshinSuugch.baiguullagiinId) {
        orshinSuugch.toot = userData.newTootEntry.toot;
        orshinSuugch.baiguullagiinId = userData.newTootEntry.baiguullagiinId;
        orshinSuugch.barilgiinId = userData.newTootEntry.barilgiinId;
        orshinSuugch.davkhar = userData.newTootEntry.davkhar;
        orshinSuugch.orts = userData.newTootEntry.orts;
        orshinSuugch.duureg = userData.newTootEntry.duureg;
        orshinSuugch.horoo = userData.newTootEntry.horoo;
        orshinSuugch.soh = userData.newTootEntry.soh;
      }
    } else if (req.body.baiguullagiinId && (req.body.barilgiinId || req.body.bairId)) {
      // OWN_ORG address selected but no doorNo/toot provided
      // Only set primary fields if user doesn't have them yet
      if (!orshinSuugch.baiguullagiinId) {
        if (userData.baiguullagiinId) {
          orshinSuugch.baiguullagiinId = userData.baiguullagiinId;
          if (userData.baiguullagiinNer) {
            orshinSuugch.baiguullagiinNer = userData.baiguullagiinNer;
          }
        }
        if (userData.barilgiinId) {
          orshinSuugch.barilgiinId = userData.barilgiinId;
        }
        console.log(`✅ [WALLET LOGIN] OWN_ORG primary address set for NEW user: baiguullagiinId=${userData.baiguullagiinId}`);
      } else {
        console.log(`ℹ️ [WALLET LOGIN] OWN_ORG address selection ignored for existing primary user (will wait for toot to add to array)`);
      }
    } else if (bairIdToUse && doorNoToUse && !req.body.baiguullagiinId) {
      // Handle Wallet API address - add to toots array
      // Only treat as WALLET_API if baiguullagiinId is NOT provided (ensures OWN_ORG takes priority)
      const walletTootEntry = {
        toot: doorNoToUse,
        source: "WALLET_API",
        walletBairId: bairIdToUse,
        walletDoorNo: doorNoToUse,
        createdAt: new Date()
      };
      
      const existingWalletTootIndex = orshinSuugch.toots?.findIndex(
        t => t.source === "WALLET_API" && 
             t.walletBairId === bairIdToUse &&
             t.walletDoorNo === doorNoToUse
      );
      
      if (existingWalletTootIndex >= 0) {
        orshinSuugch.toots[existingWalletTootIndex] = walletTootEntry;
        console.log(`🔄 [WALLET LOGIN] Updated existing Wallet API toot in array`);
      } else {
        orshinSuugch.toots.push(walletTootEntry);
        console.log(`➕ [WALLET LOGIN] Added new Wallet API toot to array`);
      }
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
        
        // getBillingByAddress requires phoneNumber, not walletUserId
        console.log("🔍 [WALLET LOGIN] Using phoneNumber for getBillingByAddress:", phoneNumber);
        
        console.log("🔍 [WALLET LOGIN] About to call getBillingByAddress...");
        const billingResponse = await walletApiService.getBillingByAddress(
          phoneNumber,
          bairIdToUse,
          doorNoToUse
        );
        console.log("🔍 [WALLET LOGIN] getBillingByAddress returned:", JSON.stringify(billingResponse));

        if (billingResponse && Array.isArray(billingResponse) && billingResponse.length > 0) {
          billingInfo = billingResponse[0];
          console.log("✅ [WALLET LOGIN] Billing info found:", billingInfo.customerName);
          
          // If billingId is not in the response, try to get it using customerId
          if (!billingInfo.billingId && billingInfo.customerId) {
            try {
              console.log("🔍 [WALLET LOGIN] Billing ID not found, fetching by customer ID...");
              console.log("🔍 [WALLET LOGIN] Customer ID:", billingInfo.customerId);
              // Wallet API userId means phoneNumber
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
                  // Wallet API userId means phoneNumber
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
                // Wallet API userId means phoneNumber
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
          if (billingInfo.billingId || billingInfo.customerId) {
            try {
              console.log("🔗 [WALLET LOGIN] Auto-connecting billing to Wallet API account...");
              if (billingInfo.billingId) {
                console.log("🔗 [WALLET LOGIN] Billing ID found:", billingInfo.billingId);
              }
              // Wallet API doesn't allow billingId in body - use only customerId
              const billingData = {
                customerId: billingInfo.customerId,
              };

              // saveBilling requires phoneNumber, not walletUserId
              console.log("🔍 [WALLET LOGIN] Using phoneNumber for saveBilling:", phoneNumber);
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
            // Try to connect billing without billingId using customerId
            if (billingInfo.customerId) {
              try {
                console.log("🔗 [WALLET LOGIN] Attempting to connect billing without billingId...");
                console.log("🔗 [WALLET LOGIN] Using customerId:", billingInfo.customerId);
                
                // Send only customerId - Wallet API will return full billing info including billingId
                const billingData = {
                  customerId: billingInfo.customerId,
                };

                // Try to save without billingId - Wallet API might create it
                // saveBilling requires phoneNumber, not walletUserId
                console.log("🔍 [WALLET LOGIN] Using phoneNumber for saveBilling:", phoneNumber);
                const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
                console.log("✅ [WALLET LOGIN] Billing connected without billingId");
                console.log("✅ [WALLET LOGIN] Connection result:", JSON.stringify(connectResult));
                
                // If successful, update billingInfo with returned billingId
                if (connectResult && connectResult.billingId) {
                  billingInfo.billingId = connectResult.billingId;
                  console.log("✅ [WALLET LOGIN] Got billingId from save response:", billingInfo.billingId);
                }
              } catch (connectError) {
                console.error("❌ [WALLET LOGIN] Error connecting billing without billingId:", connectError.message);
                if (connectError.response) {
                  console.error("❌ [WALLET LOGIN] Error response status:", connectError.response.status);
                  console.error("❌ [WALLET LOGIN] Error response data:", JSON.stringify(connectError.response.data));
                }
              }
            } else {
              console.warn("⚠️ [WALLET LOGIN] Billing ID not found - cannot connect to Wallet API");
              console.warn("⚠️ [WALLET LOGIN] Customer ID:", billingInfo.customerId);
              console.warn("⚠️ [WALLET LOGIN] Customer Code:", billingInfo.customerCode);
            }
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
          console.log("⚠️ [WALLET LOGIN] billingResponse:", JSON.stringify(billingResponse));
          console.log("⚠️ [WALLET LOGIN] billingResponse type:", typeof billingResponse);
          console.log("⚠️ [WALLET LOGIN] billingResponse is array:", Array.isArray(billingResponse));
          if (billingResponse) {
            console.log("⚠️ [WALLET LOGIN] billingResponse length:", billingResponse.length);
          }
        }
      } catch (billingError) {
        // Log error but don't fail login
        console.error("⚠️ [WALLET LOGIN] Error auto-fetching billing (continuing anyway):", billingError.message);
        if (billingError.response) {
          console.error("⚠️ [WALLET LOGIN] Error response status:", billingError.response.status);
          console.error("⚠️ [WALLET LOGIN] Error response data:", JSON.stringify(billingError.response.data));
        }
        if (billingError.stack) {
          console.error("⚠️ [WALLET LOGIN] Error stack:", billingError.stack);
        }
      }
    } else {
      console.log("ℹ️ [WALLET LOGIN] No address available for auto-billing fetch");
    }

    // Create gerees for all OWN_ORG toots that don't have gerees yet
    if (orshinSuugch.toots && Array.isArray(orshinSuugch.toots) && orshinSuugch.toots.length > 0) {
      const ownOrgToots = orshinSuugch.toots.filter(t => t.source === "OWN_ORG" && t.baiguullagiinId && t.barilgiinId);
      
      for (const tootEntry of ownOrgToots) {
        try {
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(tootEntry.baiguullagiinId);
          
          if (!baiguullaga) {
            console.log(`orshinSuugch service`);
            continue;
          }
          
          const tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );

          if (!tukhainBaaziinKholbolt) {
            console.log(`orshinSuugch service`);
            continue;
          }
          
          // Check if geree already exists for this specific toot (user + barilgiinId + toot combination)
          const GereeModel = Geree(tukhainBaaziinKholbolt);
          const existingGeree = await GereeModel.findOne({
            orshinSuugchId: orshinSuugch._id.toString(),
            barilgiinId: tootEntry.barilgiinId,
            toot: tootEntry.toot,
            tuluv: { $ne: "Цуцалсан" } // Only check active gerees
          });

          if (existingGeree) {
            console.log(`orshinSuugch service`);
            continue;
          }

          // Check if there's a cancelled geree for this toot that we can reactivate
          const existingCancelledGeree = await GereeModel.findOne({
            barilgiinId: tootEntry.barilgiinId,
            toot: tootEntry.toot,
            tuluv: "Цуцалсан",
            orshinSuugchId: orshinSuugch._id.toString()
          });

          if (existingCancelledGeree) {
            // Reactivate the cancelled geree instead of creating a new one
            const targetBarilga = baiguullaga.barilguud?.find(
              (b) => String(b._id) === String(tootEntry.barilgiinId)
            );

            if (targetBarilga) {
              const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
              const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
              const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

              const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
                ner: zardal.ner,
                turul: zardal.turul,
                zardliinTurul: zardal.zardliinTurul,
                tariff: zardal.tariff,
                tariffUsgeer: zardal.tariffUsgeer || "",
                tulukhDun: 0,
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

              // Extract tailbar from ashiglaltiinZardluud (combine all tailbar values if multiple exist)
              const tailbarFromZardluud = ashiglaltiinZardluudData
                .map((zardal) => zardal.tailbar)
                .filter((tailbar) => tailbar && tailbar.trim())
                .join("; ") || "";

              const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
                const tariff = zardal.tariff || 0;
                const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                if (isLiftItem && tootEntry.davkhar && choloolugdokhDavkhar.includes(tootEntry.davkhar)) {
                  return total;
                }
                return total + tariff;
              }, 0);

              const duuregNer = targetBarilga.tokhirgoo?.duuregNer || tootEntry.duureg || "";
              // Normalize horoo to always be an object format
              let horooData = targetBarilga.tokhirgoo?.horoo || tootEntry.horoo || {};
              if (typeof horooData === 'string') {
                horooData = { ner: horooData, kod: horooData };
              } else if (!horooData || typeof horooData !== 'object') {
                horooData = {};
              }
              const sohNer = targetBarilga.tokhirgoo?.sohNer || tootEntry.soh || "";

              const updateData = {
                tuluv: "Идэвхтэй",
                gereeniiOgnoo: new Date(),
                orshinSuugchId: orshinSuugch._id.toString(),
                barilgiinId: tootEntry.barilgiinId, // Update to new barilgiinId if changed
                bairNer: targetBarilga.ner || existingCancelledGeree.bairNer || "", // Update building name
                sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
                duureg: duuregNer,
                horoo: horooData,
                sohNer: sohNer,
                toot: tootEntry.toot,
                davkhar: tootEntry.davkhar || existingCancelledGeree.davkhar || "",
                orts: tootEntry.orts || existingCancelledGeree.orts || "",
                zardluud: zardluudArray,
                niitTulbur: niitTulbur,
                ashiglaltiinZardal: 0,
                ovog: orshinSuugch.ovog || existingCancelledGeree.ovog,
                ner: orshinSuugch.ner || existingCancelledGeree.ner,
                register: orshinSuugch.register || existingCancelledGeree.register,
                utas: [orshinSuugch.utas],
                mail: orshinSuugch.mail || existingCancelledGeree.mail,
                tailbar: existingCancelledGeree.tailbar || "", // Preserve tailbar if exists
              };

              await GereeModel.findByIdAndUpdate(existingCancelledGeree._id, {
                $set: updateData,
              });
              console.log(`orshinSuugch service`);
              continue; // Skip creating new contract, we reactivated the old one
            }
          }

          // Validate: One toot cannot have different owners
          // Check if this toot already has an active contract with a different orshinSuugchId
          const conflictingGeree = await GereeModel.findOne({
            barilgiinId: tootEntry.barilgiinId,
            toot: tootEntry.toot,
            tuluv: "Идэвхтэй",
            orshinSuugchId: { $ne: orshinSuugch._id.toString() }
          });

          if (conflictingGeree) {
            console.log(`orshinSuugch service`);
            continue; // Skip creating contract - toot already owned by someone else
          }
          
          // Creating new geree for toot
          const targetBarilga = baiguullaga.barilguud?.find(
            (b) => String(b._id) === String(tootEntry.barilgiinId)
          );

          if (targetBarilga) {
            // Get ashiglaltiinZardluud from barilga
            const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
            const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
            const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

            const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
              ner: zardal.ner,
              turul: zardal.turul,
              zardliinTurul: zardal.zardliinTurul,
              tariff: zardal.tariff,
              tariffUsgeer: zardal.tariffUsgeer || "",
              tulukhDun: 0,
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
              const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
              if (isLiftItem && tootEntry.davkhar && choloolugdokhDavkhar.includes(tootEntry.davkhar)) {
                return total;
              }
              return total + tariff;
            }, 0);

            const duuregNer = targetBarilga.tokhirgoo?.duuregNer || tootEntry.duureg || "";
            // Normalize horoo to always be an object format
            let horooData = targetBarilga.tokhirgoo?.horoo || tootEntry.horoo || {};
            if (typeof horooData === 'string') {
              horooData = { ner: horooData, kod: horooData };
            } else if (!horooData || typeof horooData !== 'object') {
              horooData = {};
            }
            const sohNer = targetBarilga.tokhirgoo?.sohNer || tootEntry.soh || "";

            // Create geree (contract) for this specific toot
            const contractData = {
              gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
              gereeniiOgnoo: new Date(),
              turul: "Үндсэн",
              tuluv: "Идэвхтэй",
              ovog: orshinSuugch.ovog || "",
              ner: orshinSuugch.ner || "",
              register: orshinSuugch.register || "",
              utas: [orshinSuugch.utas],
              mail: orshinSuugch.mail || "",
              baiguullagiinId: baiguullaga._id,
              baiguullagiinNer: baiguullaga.ner,
              barilgiinId: tootEntry.barilgiinId,
              tulukhOgnoo: new Date(),
              ashiglaltiinZardal: 0,
              niitTulbur: niitTulbur,
              toot: tootEntry.toot,
              davkhar: tootEntry.davkhar || "",
              orts: tootEntry.orts || "",
              bairNer: targetBarilga.ner || "",
              sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
              duureg: duuregNer,
              horoo: horooData,
              sohNer: sohNer,
              burtgesenAjiltan: orshinSuugch._id,
              orshinSuugchId: orshinSuugch._id.toString(),
              temdeglel: `Wallet API-аас автоматаар үүссэн гэрээ (Тоот: ${tootEntry.toot})`,
              tailbar: "",
              actOgnoo: new Date(),
              baritsaaniiUldegdel: 0,
              ekhniiUldegdel: orshinSuugch.ekhniiUldegdel || 0,
              zardluud: zardluudArray,
              segmentuud: [],
              khungulultuud: [],
            };

            const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
            await geree.save();
            console.log(`orshinSuugch service`);

            // Update davkhar with toot if provided
            if (tootEntry.toot && tootEntry.davkhar) {
              await exports.updateDavkharWithToot(
                baiguullaga,
                tootEntry.barilgiinId,
                tootEntry.davkhar,
                tootEntry.toot,
                tukhainBaaziinKholbolt
              );
            }
          } else {
            console.log(`orshinSuugch service`);
          }
        } catch (tootGereeError) {
          console.log(`orshinSuugch service`);
          // Continue with next toot if this one fails
        }
      }
    } else if (orshinSuugch.baiguullagiinId && orshinSuugch.barilgiinId) {
      // Backward compatibility: if toots array is empty but old fields exist, create geree for primary toot
      try {
        console.log("📋 [WALLET LOGIN] OWN_ORG bair detected (backward compatibility) - checking for geree...");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(orshinSuugch.baiguullagiinId);
        
        if (!baiguullaga) {
          console.log("orshinSuugch service");
        } else {
          const tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );

          if (!tukhainBaaziinKholbolt) {
            console.log("orshinSuugch service");
          } else {
            // Check if geree already exists for this user and toot combination
            const GereeModel = Geree(tukhainBaaziinKholbolt);
            const existingGeree = await GereeModel.findOne({
              orshinSuugchId: orshinSuugch._id.toString(),
              barilgiinId: orshinSuugch.barilgiinId,
              toot: orshinSuugch.toot || "",
              tuluv: { $ne: "Цуцалсан" } // Only check active gerees
            });

            if (existingGeree) {
              console.log("orshinSuugch service");
            } else {
              // Validate: One toot cannot have different owners
              if (orshinSuugch.toot && orshinSuugch.barilgiinId) {
                const conflictingGeree = await GereeModel.findOne({
                  barilgiinId: orshinSuugch.barilgiinId,
                  toot: orshinSuugch.toot,
                  tuluv: "Идэвхтэй",
                  orshinSuugchId: { $ne: orshinSuugch._id.toString() }
                });

                if (conflictingGeree) {
                  console.log("orshinSuugch service");
                  // Skip creating contract - toot already owned by someone else
                } else {
                  const targetBarilga = baiguullaga.barilguud?.find(
                    (b) => String(b._id) === String(orshinSuugch.barilgiinId)
                  );

                  if (targetBarilga) {
                // Get ashiglaltiinZardluud from barilga
                const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
                const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
                const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

                const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
                  ner: zardal.ner,
                  turul: zardal.turul,
                  zardliinTurul: zardal.zardliinTurul,
                  tariff: zardal.tariff,
                  tariffUsgeer: zardal.tariffUsgeer || "",
                  tulukhDun: 0,
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
                  const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                  if (isLiftItem && orshinSuugch.davkhar && choloolugdokhDavkhar.includes(orshinSuugch.davkhar)) {
                    return total;
                  }
                  return total + tariff;
                }, 0);

                const duuregNer = targetBarilga.tokhirgoo?.duuregNer || orshinSuugch.duureg || "";
                // Normalize horoo to always be an object format
                let horooData = targetBarilga.tokhirgoo?.horoo || orshinSuugch.horoo || {};
                if (typeof horooData === 'string') {
                  horooData = { ner: horooData, kod: horooData };
                } else if (!horooData || typeof horooData !== 'object') {
                  horooData = {};
                }
                const sohNer = targetBarilga.tokhirgoo?.sohNer || orshinSuugch.soh || "";

                // Create geree (contract)
                const contractData = {
                  gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
                  gereeniiOgnoo: new Date(),
                  turul: "Үндсэн",
                  tuluv: "Идэвхтэй",
                  ovog: orshinSuugch.ovog || "",
                  ner: orshinSuugch.ner || "",
                  register: orshinSuugch.register || "",
                  utas: [orshinSuugch.utas],
                  mail: orshinSuugch.mail || "",
                  baiguullagiinId: baiguullaga._id,
                  baiguullagiinNer: baiguullaga.ner,
                  barilgiinId: orshinSuugch.barilgiinId,
                  tulukhOgnoo: new Date(),
                  ashiglaltiinZardal: 0,
                  niitTulbur: niitTulbur,
                  toot: orshinSuugch.toot || "",
                  davkhar: orshinSuugch.davkhar || "",
                  bairNer: targetBarilga.ner || "",
                  sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
                  duureg: duuregNer,
                  horoo: horooData,
                  sohNer: sohNer,
                  burtgesenAjiltan: orshinSuugch._id,
                  orshinSuugchId: orshinSuugch._id.toString(),
                  temdeglel: "Wallet API-аас автоматаар үүссэн гэрээ",
                  tailbar: tailbarFromZardluud || "",
                  actOgnoo: new Date(),
                  baritsaaniiUldegdel: 0,
                  ekhniiUldegdel: orshinSuugch.ekhniiUldegdel || 0,
                      zardluud: zardluudArray,
                      segmentuud: [],
                      khungulultuud: [],
                    };

                    const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
                    await geree.save();
                    console.log("orshinSuugch service");

                    // Update davkhar with toot if provided
                    if (orshinSuugch.toot && orshinSuugch.davkhar) {
                      await exports.updateDavkharWithToot(
                        baiguullaga,
                        orshinSuugch.barilgiinId,
                        orshinSuugch.davkhar,
                        orshinSuugch.toot,
                        tukhainBaaziinKholbolt
                      );
                    }
                  }
                }
              }
            }
          }
        }
      } catch (gereeError) {
        console.log("orshinSuugch service");
        // Don't fail login if geree creation fails
      }
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

    // Email is optional - only register with Wallet API if email is provided
    const email = req.body.mail ? String(req.body.mail).trim() : null;

    const { db } = require("zevbackv2");
    const phoneNumber = String(req.body.utas).trim();

    let walletUserInfo = null;

    if (email) {
      console.log("📞 [WALLET REGISTER] Registering user in Wallet API...");
      walletUserInfo = await walletApiService.registerUser(phoneNumber, email);

      if (!walletUserInfo || !walletUserInfo.userId) {
        throw new aldaa("Хэтэвчний системд бүртгүүлэхэд алдаа гарлаа.");
      }

      console.log("✅ [WALLET REGISTER] User registered in Wallet API:", walletUserInfo.userId);
    } else {
      console.log("ℹ️ [WALLET REGISTER] Email not provided, skipping Wallet API registration");
    }

    let orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({
      $or: [
        { utas: phoneNumber },
        ...(walletUserInfo?.userId ? [{ walletUserId: walletUserInfo.userId }] : [])
      ]
    });

    const userData = {
      utas: phoneNumber,
      mail: walletUserInfo?.email || email || "",
      ...(walletUserInfo?.userId ? { walletUserId: walletUserInfo.userId } : {}),
      erkh: "OrshinSuugch",
      nevtrekhNer: phoneNumber,
    };

    // Save password locally if provided (password is NOT sent to Wallet API, only stored in our DB)
    if (req.body.nuutsUg) {
      userData.nuutsUg = req.body.nuutsUg;
      console.log("🔐 [WALLET REGISTER] Password will be saved locally (not sent to Wallet API)");
    }

    // Preserve existing baiguullagiinId if user already has one
    if (orshinSuugch && orshinSuugch.baiguullagiinId) {
      userData.baiguullagiinId = orshinSuugch.baiguullagiinId;
      userData.baiguullagiinNer = orshinSuugch.baiguullagiinNer;
    }

    // Save baiguullagiinId if provided (from OWN_ORG bair selection or WALLET_API)
    if (req.body.baiguullagiinId) {
      userData.baiguullagiinId = req.body.baiguullagiinId;
      // Try to get baiguullagiinNer if baiguullagiinId is provided
      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(req.body.baiguullagiinId);
        if (baiguullaga) {
          userData.baiguullagiinNer = baiguullaga.ner;
        }
      } catch (error) {
        console.warn("⚠️ [WALLET REGISTER] Could not fetch baiguullagiinNer:", error.message);
      }
    }

    // Handle barilgiinId - check both barilgiinId and bairId (frontend might send either)
    const barilgiinIdToSave = req.body.barilgiinId || req.body.bairId;
    
    // Validate: User can only register with ONE building
    // If user already has a barilgiinId, they cannot register with a different one
    if (orshinSuugch && orshinSuugch.barilgiinId && barilgiinIdToSave) {
      const existingBarilgiinId = String(orshinSuugch.barilgiinId);
      const newBarilgiinId = String(barilgiinIdToSave);
      
      if (existingBarilgiinId !== newBarilgiinId) {
        // Get building names for better error message
        let existingBuildingName = "";
        let newBuildingName = "";
        
        try {
          if (userData.baiguullagiinId || orshinSuugch.baiguullagiinId) {
            const baiguullagaId = userData.baiguullagiinId || orshinSuugch.baiguullagiinId;
            const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagaId);
            
            if (baiguullaga) {
              const existingBarilga = baiguullaga.barilguud?.find(
                (b) => String(b._id) === existingBarilgiinId
              );
              const newBarilga = baiguullaga.barilguud?.find(
                (b) => String(b._id) === newBarilgiinId
              );
              
              existingBuildingName = existingBarilga?.ner || existingBarilgiinId;
              newBuildingName = newBarilga?.ner || newBarilgiinId;
            }
          }
        } catch (err) {
          console.error("Error fetching building names:", err.message);
        }
        
        return res.status(400).json({
          success: false,
          message: `Та аль хэдийн "${existingBuildingName}" барилгад бүртгэгдсэн байна. Өөр барилгад бүртгүүлэх боломжгүй.`,
        });
      }
    }
    
    if (barilgiinIdToSave) {
      userData.barilgiinId = barilgiinIdToSave;
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

    // Save address if provided
    if (req.body.bairId) {
      userData.walletBairId = req.body.bairId;
    }
    if (req.body.doorNo) {
      userData.walletDoorNo = req.body.doorNo;
    }

    // Validate OWN_ORG bair toot/doorNo if provided
    // Check for OWN_ORG: baiguullagiinId is required, and either barilgiinId OR bairId (frontend might send bairId)
    const isOwnOrgAddress = req.body.baiguullagiinId && req.body.doorNo && (req.body.barilgiinId || req.body.bairId);
    const ownOrgBarilgiinId = req.body.barilgiinId || req.body.bairId; // Use barilgiinId if provided, otherwise bairId
    
    if (isOwnOrgAddress) {
      try {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(req.body.baiguullagiinId);
        if (!baiguullaga) {
          throw new aldaa("Байгууллагын мэдээлэл олдсонгүй!");
        }

        const targetBarilga = baiguullaga.barilguud?.find(
          (b) => String(b._id) === String(ownOrgBarilgiinId)
        );

        if (!targetBarilga) {
          throw new aldaa("Барилгын мэдээлэл олдсонгүй!");
        }

        const tootToValidate = req.body.doorNo.trim();
        const davkharFromRequest = (req.body.davkhar || "").trim();
        const ortsFromRequest = (req.body.orts || "1").trim();
        
        // Check if toot exists in davkhariinToonuud (available toots)
        // Automatically determine orts and davkhar from toot (same as website registration)
        const davkhariinToonuud = targetBarilga.tokhirgoo?.davkhariinToonuud || {};
        let tootFound = false;
        let foundDavkhar = null;
        let foundOrts = null;
        let matchedFloorKey = null;

        if (davkharFromRequest) {
          // If davkhar is provided, check specific floor first
          const floorKey = `${ortsFromRequest}::${davkharFromRequest}`;
          const tootArray = davkhariinToonuud[floorKey];
          
          if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
            let tootList = [];
            if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
              tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
            } else {
              tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
            }
            
            if (tootList.includes(tootToValidate)) {
              tootFound = true;
              matchedFloorKey = floorKey;
              foundDavkhar = davkharFromRequest;
              foundOrts = ortsFromRequest;
            }
          }
        }
        
        // If not found with provided davkhar/orts, or davkhar not provided, search all floors
        if (!tootFound) {
          for (const [floorKey, tootArray] of Object.entries(davkhariinToonuud)) {
            // Skip invalid entries that don't have :: separator
            if (!floorKey.includes("::")) {
              continue;
            }
            
            if (tootArray && Array.isArray(tootArray) && tootArray.length > 0) {
              let tootList = [];
              if (typeof tootArray[0] === "string" && tootArray[0].includes(",")) {
                tootList = tootArray[0].split(",").map((t) => t.trim()).filter((t) => t);
              } else {
                tootList = tootArray.map((t) => String(t).trim()).filter((t) => t);
              }
              
              if (tootList.includes(tootToValidate)) {
                tootFound = true;
                matchedFloorKey = floorKey;
                
                // Extract orts and davkhar from floorKey (format: "orts::davkhar")
                const parts = floorKey.split("::");
                if (parts.length === 2) {
                  foundOrts = parts[0].trim(); // orts (entrance)
                  foundDavkhar = parts[1].trim(); // davkhar (floor)
                }
                break;
              }
            }
          }
        }

        if (!tootFound) {
          throw new aldaa(`(${tootToValidate}) тоот энэ барилгад бүртгэлгүй байна`);
        }

        // Use found values, fallback to request values if not found
        const finalDavkhar = foundDavkhar || davkharFromRequest || "";
        const finalOrts = foundOrts || ortsFromRequest || "1";

        // Validation passes - toot will be added to toots array
        // Multiple users can have the same toot, so no unique check needed
        console.log(`✅ [WALLET REGISTER] OWN_ORG toot validated: ${tootToValidate}, auto-determined davkhar=${finalDavkhar}, orts=${finalOrts}`);
        
        // Set auto-determined values in userData for backward compatibility
        // This ensures davkhar and orts are available even if not provided in request
        if (finalDavkhar) {
          userData.davkhar = finalDavkhar;
        }
        if (finalOrts) {
          userData.orts = finalOrts;
        }
        // Also set toot in userData for backward compatibility
        userData.toot = tootToValidate;
        
        // Prepare toot entry for toots array
        userData.newTootEntry = {
          toot: tootToValidate,
          source: "OWN_ORG",
          baiguullagiinId: req.body.baiguullagiinId,
          barilgiinId: ownOrgBarilgiinId, // Use the resolved barilgiinId (from barilgiinId or bairId)
          davkhar: finalDavkhar, // Auto-determined from toot
          orts: finalOrts, // Auto-determined from toot
          duureg: targetBarilga.tokhirgoo?.duuregNer || "",
          horoo: targetBarilga.tokhirgoo?.horoo || {},
          soh: targetBarilga.tokhirgoo?.sohNer || "",
          bairniiNer: targetBarilga.ner || ""
        };
      } catch (error) {
        console.error("❌ [WALLET REGISTER] OWN_ORG toot validation error:", error.message);
        throw error;
      }
    }

    if (orshinSuugch) {
      console.log("🔄 [WALLET REGISTER] Updating existing user:", orshinSuugch._id);
      Object.assign(orshinSuugch, userData);
    } else {
      console.log("➕ [WALLET REGISTER] Creating new user");
      orshinSuugch = new OrshinSuugch(db.erunkhiiKholbolt)(userData);
      // Initialize toots array if it doesn't exist
      if (!orshinSuugch.toots) {
        orshinSuugch.toots = [];
      }
    }

    // Handle multiple toots - add new toot to array if provided
    if (userData.newTootEntry) {
      // Check if this toot already exists in user's toots array
      const existingTootIndex = orshinSuugch.toots?.findIndex(
        t => t.toot === userData.newTootEntry.toot && 
             t.barilgiinId === userData.newTootEntry.barilgiinId
      );
      
      if (existingTootIndex >= 0) {
        // Update existing toot entry
        orshinSuugch.toots[existingTootIndex] = userData.newTootEntry;
        console.log(`🔄 [WALLET REGISTER] Updated existing toot in array: ${userData.newTootEntry.toot}`);
      } else {
        // Add new toot to array
        if (!orshinSuugch.toots) {
          orshinSuugch.toots = [];
        }
        orshinSuugch.toots.push(userData.newTootEntry);
        console.log(`➕ [WALLET REGISTER] Added new toot to array: ${userData.newTootEntry.toot}`);
      }
      
      // Also set as primary toot for backward compatibility
      orshinSuugch.toot = userData.newTootEntry.toot;
      orshinSuugch.baiguullagiinId = userData.newTootEntry.baiguullagiinId;
      orshinSuugch.barilgiinId = userData.newTootEntry.barilgiinId;
      orshinSuugch.davkhar = userData.newTootEntry.davkhar; // Auto-determined from toot
      orshinSuugch.orts = userData.newTootEntry.orts; // Auto-determined from toot
      orshinSuugch.duureg = userData.newTootEntry.duureg;
      orshinSuugch.horoo = userData.newTootEntry.horoo;
      orshinSuugch.soh = userData.newTootEntry.soh;
    } else if (req.body.bairId && req.body.doorNo && !req.body.baiguullagiinId) {
      // Handle Wallet API address - add to toots array
      // Only treat as WALLET_API if baiguullagiinId is NOT provided (ensures OWN_ORG takes priority)
      const walletTootEntry = {
        toot: req.body.doorNo,
        source: "WALLET_API",
        walletBairId: req.body.bairId,
        walletDoorNo: req.body.doorNo,
        createdAt: new Date()
      };
      
      const existingWalletTootIndex = orshinSuugch.toots?.findIndex(
        t => t.source === "WALLET_API" && 
             t.walletBairId === req.body.bairId &&
             t.walletDoorNo === req.body.doorNo
      );
      
      if (existingWalletTootIndex >= 0) {
        orshinSuugch.toots[existingWalletTootIndex] = walletTootEntry;
        console.log(`🔄 [WALLET REGISTER] Updated existing Wallet API toot in array`);
      } else {
        if (!orshinSuugch.toots) {
          orshinSuugch.toots = [];
        }
        orshinSuugch.toots.push(walletTootEntry);
        console.log(`➕ [WALLET REGISTER] Added new Wallet API toot to array`);
      }
    }

    if (req.body.firebaseToken) {
      orshinSuugch.firebaseToken = req.body.firebaseToken;
      console.log("📱 [WALLET REGISTER] Updating Firebase token");
    }

    await orshinSuugch.save();
    console.log("✅ [WALLET REGISTER] User saved to database:", orshinSuugch._id);

    // Create gerees for all OWN_ORG toots that don't have gerees yet
    if (orshinSuugch.toots && Array.isArray(orshinSuugch.toots) && orshinSuugch.toots.length > 0) {
      const ownOrgToots = orshinSuugch.toots.filter(t => t.source === "OWN_ORG" && t.baiguullagiinId && t.barilgiinId);
      
      for (const tootEntry of ownOrgToots) {
        try {
          console.log(`📋 [WALLET REGISTER] Processing OWN_ORG toot: ${tootEntry.toot} for geree creation...`);
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(tootEntry.baiguullagiinId);
          
          if (!baiguullaga) {
            console.error(`❌ [WALLET REGISTER] Baiguullaga not found for toot ${tootEntry.toot}`);
            continue;
          }
          
          const tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );

          if (!tukhainBaaziinKholbolt) {
            console.error(`❌ [WALLET REGISTER] Kholbolt not found for toot ${tootEntry.toot}`);
            continue;
          }
          
          // Check if geree already exists for this specific toot (user + barilgiinId + toot combination)
          const GereeModel = Geree(tukhainBaaziinKholbolt);
          const existingGeree = await GereeModel.findOne({
            orshinSuugchId: orshinSuugch._id.toString(),
            barilgiinId: tootEntry.barilgiinId,
            toot: tootEntry.toot,
            tuluv: { $ne: "Цуцалсан" } // Only check active gerees
          });

          if (existingGeree) {
            console.log(`orshinSuugch service`);
            continue;
          }

          // Check if there's a cancelled geree for this toot that we can reactivate
          const existingCancelledGeree = await GereeModel.findOne({
            barilgiinId: tootEntry.barilgiinId,
            toot: tootEntry.toot,
            tuluv: "Цуцалсан",
            orshinSuugchId: orshinSuugch._id.toString()
          });

          if (existingCancelledGeree) {
            // Reactivate the cancelled geree instead of creating a new one
            const targetBarilga = baiguullaga.barilguud?.find(
              (b) => String(b._id) === String(tootEntry.barilgiinId)
            );

            if (targetBarilga) {
              const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
              const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
              const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

              const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
                ner: zardal.ner,
                turul: zardal.turul,
                zardliinTurul: zardal.zardliinTurul,
                tariff: zardal.tariff,
                tariffUsgeer: zardal.tariffUsgeer || "",
                tulukhDun: 0,
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

              // Extract tailbar from ashiglaltiinZardluud (combine all tailbar values if multiple exist)
              const tailbarFromZardluud = ashiglaltiinZardluudData
                .map((zardal) => zardal.tailbar)
                .filter((tailbar) => tailbar && tailbar.trim())
                .join("; ") || "";

              const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
                const tariff = zardal.tariff || 0;
                const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                if (isLiftItem && tootEntry.davkhar && choloolugdokhDavkhar.includes(tootEntry.davkhar)) {
                  return total;
                }
                return total + tariff;
              }, 0);

              const duuregNer = targetBarilga.tokhirgoo?.duuregNer || tootEntry.duureg || "";
              // Normalize horoo to always be an object format
              let horooData = targetBarilga.tokhirgoo?.horoo || tootEntry.horoo || {};
              if (typeof horooData === 'string') {
                horooData = { ner: horooData, kod: horooData };
              } else if (!horooData || typeof horooData !== 'object') {
                horooData = {};
              }
              const sohNer = targetBarilga.tokhirgoo?.sohNer || tootEntry.soh || "";

              const updateData = {
                tuluv: "Идэвхтэй",
                gereeniiOgnoo: new Date(),
                orshinSuugchId: orshinSuugch._id.toString(),
                barilgiinId: tootEntry.barilgiinId, // Update to new barilgiinId if changed
                bairNer: targetBarilga.ner || existingCancelledGeree.bairNer || "", // Update building name
                sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
                duureg: duuregNer,
                horoo: horooData,
                sohNer: sohNer,
                toot: tootEntry.toot,
                davkhar: tootEntry.davkhar || existingCancelledGeree.davkhar || "",
                orts: tootEntry.orts || existingCancelledGeree.orts || "",
                zardluud: zardluudArray,
                niitTulbur: niitTulbur,
                ashiglaltiinZardal: 0,
                ovog: orshinSuugch.ovog || existingCancelledGeree.ovog,
                ner: orshinSuugch.ner || existingCancelledGeree.ner,
                register: orshinSuugch.register || existingCancelledGeree.register,
                utas: [orshinSuugch.utas],
                mail: orshinSuugch.mail || existingCancelledGeree.mail,
                tailbar: existingCancelledGeree.tailbar || "", // Preserve tailbar if exists
              };

              await GereeModel.findByIdAndUpdate(existingCancelledGeree._id, {
                $set: updateData,
              });
              console.log(`orshinSuugch service`);
              continue; // Skip creating new contract, we reactivated the old one
            }
          }
          const targetBarilga = baiguullaga.barilguud?.find(
            (b) => String(b._id) === String(tootEntry.barilgiinId)
          );

          if (targetBarilga) {
            // Get ashiglaltiinZardluud from barilga
            const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
            const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
            const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

            const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
              ner: zardal.ner,
              turul: zardal.turul,
              zardliinTurul: zardal.zardliinTurul,
              tariff: zardal.tariff,
              tariffUsgeer: zardal.tariffUsgeer || "",
              tulukhDun: 0,
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
              const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
              if (isLiftItem && tootEntry.davkhar && choloolugdokhDavkhar.includes(tootEntry.davkhar)) {
                return total;
              }
              return total + tariff;
            }, 0);

            const duuregNer = targetBarilga.tokhirgoo?.duuregNer || tootEntry.duureg || "";
            // Normalize horoo to always be an object format
            let horooData = targetBarilga.tokhirgoo?.horoo || tootEntry.horoo || {};
            if (typeof horooData === 'string') {
              horooData = { ner: horooData, kod: horooData };
            } else if (!horooData || typeof horooData !== 'object') {
              horooData = {};
            }
            const sohNer = targetBarilga.tokhirgoo?.sohNer || tootEntry.soh || "";

            // Create geree (contract) for this specific toot
            const contractData = {
              gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
              gereeniiOgnoo: new Date(),
              turul: "Үндсэн",
              tuluv: "Идэвхтэй",
              ovog: orshinSuugch.ovog || "",
              ner: orshinSuugch.ner || "",
              register: orshinSuugch.register || "",
              utas: [orshinSuugch.utas],
              mail: orshinSuugch.mail || "",
              baiguullagiinId: baiguullaga._id,
              baiguullagiinNer: baiguullaga.ner,
              barilgiinId: tootEntry.barilgiinId,
              tulukhOgnoo: new Date(),
              ashiglaltiinZardal: 0,
              niitTulbur: niitTulbur,
              toot: tootEntry.toot,
              davkhar: tootEntry.davkhar || "",
              bairNer: targetBarilga.ner || "",
              sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
              duureg: duuregNer,
              horoo: horooData,
              sohNer: sohNer,
              burtgesenAjiltan: orshinSuugch._id,
              orshinSuugchId: orshinSuugch._id.toString(),
              temdeglel: `Wallet API-аас автоматаар үүссэн гэрээ (Тоот: ${tootEntry.toot})`,
              tailbar: "",
              actOgnoo: new Date(),
              baritsaaniiUldegdel: 0,
              ekhniiUldegdel: orshinSuugch.ekhniiUldegdel || 0,
              zardluud: zardluudArray,
              segmentuud: [],
              khungulultuud: [],
            };

            const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
            await geree.save();
            console.log(`✅ [WALLET REGISTER] Geree created for toot ${tootEntry.toot}:`, geree._id);

            // Update davkhar with toot if provided
            if (tootEntry.toot && tootEntry.davkhar) {
              await exports.updateDavkharWithToot(
                baiguullaga,
                tootEntry.barilgiinId,
                tootEntry.davkhar,
                tootEntry.toot,
                tukhainBaaziinKholbolt
              );
              console.log(`✅ [WALLET REGISTER] Davkhar updated with toot ${tootEntry.toot}`);
            }

            // Invoice will be created by cron job on scheduled date
            console.log(`ℹ️ [WALLET REGISTER] Invoice will be created by cron job for toot ${tootEntry.toot}`);
          } else {
            console.error(`❌ [WALLET REGISTER] Target barilga not found for toot ${tootEntry.toot}`);
          }
        } catch (tootGereeError) {
          console.error(`❌ [WALLET REGISTER] Error creating geree for toot ${tootEntry.toot}:`, tootGereeError.message);
          // Continue with next toot if this one fails
        }
      }
    } else if (orshinSuugch.baiguullagiinId && orshinSuugch.barilgiinId) {
      // Backward compatibility: if toots array is empty but old fields exist, create geree for primary toot
      try {
        console.log("📋 [WALLET REGISTER] OWN_ORG bair detected (backward compatibility) - checking for geree...");
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(orshinSuugch.baiguullagiinId);
        
        if (!baiguullaga) {
          console.error("❌ [WALLET REGISTER] Baiguullaga not found for geree creation");
        } else {
          const tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );

          if (!tukhainBaaziinKholbolt) {
            console.error("❌ [WALLET REGISTER] Kholbolt not found for geree creation");
          } else {
            // Check if geree already exists for this user and toot combination
            const GereeModel = Geree(tukhainBaaziinKholbolt);
            const existingGeree = await GereeModel.findOne({
              orshinSuugchId: orshinSuugch._id.toString(),
              barilgiinId: orshinSuugch.barilgiinId,
              toot: orshinSuugch.toot || "",
              tuluv: { $ne: "Цуцалсан" } // Only check active gerees
            });

            if (existingGeree) {
              console.log("ℹ️ [WALLET REGISTER] Geree already exists for this user and toot:", existingGeree._id);
            } else {
              console.log("📋 [WALLET REGISTER] No active geree found - creating new geree...");
              const targetBarilga = baiguullaga.barilguud?.find(
                (b) => String(b._id) === String(orshinSuugch.barilgiinId)
              );

              if (targetBarilga) {
                // Get ashiglaltiinZardluud from barilga
                const ashiglaltiinZardluudData = targetBarilga.tokhirgoo?.ashiglaltiinZardluud || [];
                const liftShalgayaData = targetBarilga.tokhirgoo?.liftShalgaya;
                const choloolugdokhDavkhar = liftShalgayaData?.choloolugdokhDavkhar || [];

                const zardluudArray = ashiglaltiinZardluudData.map((zardal) => ({
                  ner: zardal.ner,
                  turul: zardal.turul,
                  zardliinTurul: zardal.zardliinTurul,
                  tariff: zardal.tariff,
                  tariffUsgeer: zardal.tariffUsgeer || "",
                  tulukhDun: 0,
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
                  const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                  if (isLiftItem && orshinSuugch.davkhar && choloolugdokhDavkhar.includes(orshinSuugch.davkhar)) {
                    return total;
                  }
                  return total + tariff;
                }, 0);

                const duuregNer = targetBarilga.tokhirgoo?.duuregNer || orshinSuugch.duureg || "";
                // Normalize horoo to always be an object format
                let horooData = targetBarilga.tokhirgoo?.horoo || orshinSuugch.horoo || {};
                if (typeof horooData === 'string') {
                  horooData = { ner: horooData, kod: horooData };
                } else if (!horooData || typeof horooData !== 'object') {
                  horooData = {};
                }
                const sohNer = targetBarilga.tokhirgoo?.sohNer || orshinSuugch.soh || "";

                // Create geree (contract)
                const contractData = {
                  gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
                  gereeniiOgnoo: new Date(),
                  turul: "Үндсэн",
                  tuluv: "Идэвхтэй",
                  ovog: orshinSuugch.ovog || "",
                  ner: orshinSuugch.ner || "",
                  register: orshinSuugch.register || "",
                  utas: [orshinSuugch.utas],
                  mail: orshinSuugch.mail || "",
                  baiguullagiinId: baiguullaga._id,
                  baiguullagiinNer: baiguullaga.ner,
                  barilgiinId: orshinSuugch.barilgiinId,
                  tulukhOgnoo: new Date(),
                  ashiglaltiinZardal: 0,
                  niitTulbur: niitTulbur,
                  toot: orshinSuugch.toot || "",
                  davkhar: orshinSuugch.davkhar || "",
                  bairNer: targetBarilga.ner || "",
                  sukhBairshil: `${duuregNer}, ${horooData.ner || ""}, ${sohNer}`,
                  duureg: duuregNer,
                  horoo: horooData,
                  sohNer: sohNer,
                  burtgesenAjiltan: orshinSuugch._id,
                  orshinSuugchId: orshinSuugch._id.toString(),
                  temdeglel: "Wallet API-аас автоматаар үүссэн гэрээ",
                  actOgnoo: new Date(),
                  baritsaaniiUldegdel: 0,
                  ekhniiUldegdel: orshinSuugch.ekhniiUldegdel || 0,
                  zardluud: zardluudArray,
                  segmentuud: [],
                  khungulultuud: [],
                };

                const geree = new Geree(tukhainBaaziinKholbolt)(contractData);
                await geree.save();
                console.log("✅ [WALLET REGISTER] Geree created:", geree._id);

                // Update davkhar with toot if provided
                if (orshinSuugch.toot && orshinSuugch.davkhar) {
                  await exports.updateDavkharWithToot(
                    baiguullaga,
                    orshinSuugch.barilgiinId,
                    orshinSuugch.davkhar,
                    orshinSuugch.toot,
                    tukhainBaaziinKholbolt
                  );
                  console.log("✅ [WALLET REGISTER] Davkhar updated with toot");
                }

                // Invoice will be created by cron job on scheduled date
                console.log("ℹ️ [WALLET REGISTER] Invoice will be created by cron job on scheduled date");
              }
            }
          }
        }
      } catch (gereeError) {
        console.error("❌ [WALLET REGISTER] Error creating geree:", gereeError.message);
        // Don't fail registration if geree creation fails
      }
    }

    // Automatically fetch and connect billing if address is provided
    let billingInfo = null;
    if (req.body.bairId && req.body.doorNo) {
      try {
        console.log("🏠 [WALLET REGISTER] Auto-fetching billing with provided address...");
        console.log("🏠 [WALLET REGISTER] bairId:", req.body.bairId, "doorNo:", req.body.doorNo);
        
        // getBillingByAddress requires phoneNumber, not walletUserId
        console.log("🔍 [WALLET REGISTER] Using phoneNumber for getBillingByAddress:", phoneNumber);
        const billingResponse = await walletApiService.getBillingByAddress(
          phoneNumber,
          req.body.bairId,
          req.body.doorNo
        );

        if (billingResponse && Array.isArray(billingResponse) && billingResponse.length > 0) {
          billingInfo = billingResponse[0];
          console.log("✅ [WALLET REGISTER] Billing info found:", billingInfo.customerName);
          
          // If billingId is not in the response, try to get it using customerId
          if (!billingInfo.billingId && billingInfo.customerId) {
            try {
              console.log("🔍 [WALLET REGISTER] Billing ID not found, fetching by customer ID...");
              console.log("🔍 [WALLET REGISTER] Customer ID:", billingInfo.customerId);
              // Wallet API userId means phoneNumber
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
                  // Wallet API userId means phoneNumber
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
                // Wallet API userId means phoneNumber
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
          if (billingInfo.billingId || billingInfo.customerId) {
            try {
              console.log("🔗 [WALLET REGISTER] Auto-connecting billing to Wallet API account...");
              if (billingInfo.billingId) {
                console.log("🔗 [WALLET REGISTER] Billing ID found:", billingInfo.billingId);
              }
              // Wallet API doesn't allow billingId in body - use only customerId
              const billingData = {
                customerId: billingInfo.customerId,
              };

              const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
            } catch (connectError) {
              if (connectError.response) {
              }
            }
          } else {
            // Try to connect billing without billingId using customerId
            if (billingInfo.customerId) {
              try {
                
                // Send only customerId - Wallet API will return full billing info including billingId
                const billingData = {
                  customerId: billingInfo.customerId,
                };

                // Try to save without billingId - Wallet API might create it
                // saveBilling requires phoneNumber, not walletUserId
                const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
                
                // If successful, update billingInfo with returned billingId
                if (connectResult && connectResult.billingId) {
                  billingInfo.billingId = connectResult.billingId;
                }
              } catch (connectError) {
                if (connectError.response) {
                }
              }
            } else {
              console.warn("⚠️ [WALLET REGISTER] Customer Code:", billingInfo.customerCode);
            }
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

    // Wallet API uses phone number as userId in header, not walletUserId UUID
    const phoneNumber = orshinSuugch.utas;
    const bairId = req.body.bairId;
    const doorNo = req.body.doorNo;

    console.log("🏠 [WALLET BILLING] Fetching billing info from Wallet API...");
    console.log("🏠 [WALLET BILLING] User (phoneNumber):", phoneNumber);
    console.log("🏠 [WALLET BILLING] User (walletUserId):", orshinSuugch.walletUserId || "N/A");
    console.log("🏠 [WALLET BILLING] Using phoneNumber as userId for Wallet API:", phoneNumber);
    console.log("🏠 [WALLET BILLING] bairId:", bairId, "doorNo:", doorNo);

    let billingInfo = null;
    try {
      // Wallet API requires phone number as userId in header, not walletUserId UUID
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
            // Wallet API requires phone number as userId in header
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
                // Wallet API requires phone number as userId in header
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
                // Wallet API requires phone number as userId in header
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
        
        // Try to get billing list to see if user has any billing registered
        let hasAnyBilling = false;
        try {
          console.log("🔍 [WALLET BILLING] Checking if user has any billing registered...");
          const billingList = await walletApiService.getBillingList(phoneNumber);
          if (billingList && billingList.length > 0) {
            hasAnyBilling = true;
            console.log(`✅ [WALLET BILLING] User has ${billingList.length} billing(s) registered, but not for this address`);
          }
        } catch (listError) {
          console.error("⚠️ [WALLET BILLING] Error checking billing list:", listError.message);
        }
        
        return res.status(404).json({
          success: false,
          message: hasAnyBilling 
            ? "Энэ хаягийн биллингийн мэдээлэл олдсонгүй. Энэ хаягийг Wallet API-д бүртгүүлэх шаардлагатай."
            : "Энэ хаягийн биллингийн мэдээлэл олдсонгүй. Wallet API-д биллингийн мэдээлэл бүртгэгдээгүй байна.",
          hasAnyBilling: hasAnyBilling,
          suggestion: "Энэ хаягийг Wallet API-д бүртгүүлэх эсвэл бусад хаягаа шалгана уу."
        });
      }
    } catch (billingError) {
      console.error("❌ [WALLET BILLING] Error fetching billing info:", billingError.message);
      throw new aldaa(`Биллингийн мэдээлэл авахад алдаа гарлаа: ${billingError.message}`);
    }

    // Automatically connect billing to Wallet API account if customerId is available
    let billingConnected = false;
    let connectionError = null;
    
    if (billingInfo.billingId || billingInfo.customerId) {
      try {
        console.log("🔗 [WALLET BILLING] Connecting billing to Wallet API account...");
        if (billingInfo.billingId) {
          console.log("🔗 [WALLET BILLING] Billing ID found:", billingInfo.billingId);
        }
        // Wallet API doesn't allow billingId in body - use only customerId
        const billingData = {
          customerId: billingInfo.customerId,
        };

        // saveBilling requires phoneNumber, not walletUserId
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
      // Try to connect billing without billingId using customerId
      if (billingInfo.customerId) {
        try {
          console.log("🔗 [WALLET BILLING] Attempting to connect billing without billingId...");
          console.log("🔗 [WALLET BILLING] Using customerId:", billingInfo.customerId);
          
          // Send only customerId - Wallet API doesn't allow customerCode in body
          const billingData = {
            customerId: billingInfo.customerId,
          };

          // Try to save with just customerId - Wallet API will return billingId
          // saveBilling requires phoneNumber, not walletUserId
          const connectResult = await walletApiService.saveBilling(phoneNumber, billingData);
          console.log("✅ [WALLET BILLING] Billing connected without billingId");
          console.log("✅ [WALLET BILLING] Connection result:", JSON.stringify(connectResult));
          
          // If successful, update billingInfo with returned billingId
          if (connectResult && connectResult.billingId) {
            billingInfo.billingId = connectResult.billingId;
            billingInfo.billingName = connectResult.billingName || billingInfo.billingName;
            billingInfo.customerName = connectResult.customerName || billingInfo.customerName;
            billingInfo.customerAddress = connectResult.customerAddress || billingInfo.customerAddress;
            console.log("✅ [WALLET BILLING] Got billingId from save response:", billingInfo.billingId);
            billingConnected = true;
          }
        } catch (connectError) {
          console.error("❌ [WALLET BILLING] Error connecting billing without billingId:", connectError.message);
          if (connectError.response) {
            console.error("❌ [WALLET BILLING] Error response status:", connectError.response.status);
            console.error("❌ [WALLET BILLING] Error response data:", JSON.stringify(connectError.response.data));
          }
          connectionError = connectError.message;
        }
      } else {
        console.warn("⚠️ [WALLET BILLING] Billing ID not found and no customerId available");
        console.warn("⚠️ [WALLET BILLING] Customer ID:", billingInfo.customerId);
        console.warn("⚠️ [WALLET BILLING] Customer Code:", billingInfo.customerCode);
        connectionError = "Биллингийн ID болон Customer ID олдсонгүй";
      }
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
    console.log("🏙️ [ADDRESS] Fetching cities from all sources...");
    const result = await addressService.getCities();
    
    res.status(200).json({
      success: true,
      data: result.data,
      sources: result.sources,
      message: `Found ${result.sources.total} cities (Wallet API: ${result.sources.walletApi}, Own Org: ${result.sources.ownOrg})`
    });
  } catch (err) {
    console.error("❌ [ADDRESS] Error getting cities:", err.message);
    next(err);
  }
});

exports.walletAddressDistricts = asyncHandler(async (req, res, next) => {
  try {
    const { cityId } = req.params;
    if (!cityId) {
      throw new aldaa("Хотын ID заавал бөглөх шаардлагатай!");
    }
    
    console.log("🏘️ [ADDRESS] Fetching districts for cityId:", cityId);
    const result = await addressService.getDistricts(cityId);
    
    res.status(200).json({
      success: true,
      data: result.data,
      sources: result.sources,
      message: `Found ${result.sources.total} districts (Wallet API: ${result.sources.walletApi}, Own Org: ${result.sources.ownOrg})`
    });
  } catch (err) {
    console.error("❌ [ADDRESS] Error getting districts:", err.message);
    next(err);
  }
});

exports.walletAddressKhoroo = asyncHandler(async (req, res, next) => {
  try {
    const { districtId } = req.params;
    if (!districtId) {
      throw new aldaa("Дүүргийн ID заавал бөглөх шаардлагатай!");
    }
    
    console.log("🏘️ [ADDRESS] Fetching khoroos for districtId:", districtId);
    const result = await addressService.getKhoroo(districtId);
    
    res.status(200).json({
      success: true,
      data: result.data,
      sources: result.sources,
      message: `Found ${result.sources.total} khoroos (Wallet API: ${result.sources.walletApi}, Own Org: ${result.sources.ownOrg})`
    });
  } catch (err) {
    console.error("❌ [ADDRESS] Error getting khoroo:", err.message);
    next(err);
  }
});

exports.walletAddressBair = asyncHandler(async (req, res, next) => {
  try {
    const { khorooId } = req.params;
    if (!khorooId) {
      throw new aldaa("Хорооны ID заавал бөглөх шаардлагатай!");
    }
    
    console.log("🏢 [ADDRESS] Fetching bair for khorooId:", khorooId);
    const result = await addressService.getBair(khorooId);
    
    res.status(200).json({
      success: true,
      data: result.data,
      sources: result.sources,
      message: `Found ${result.sources.total} bair (Wallet API: ${result.sources.walletApi}, Own Org: ${result.sources.ownOrg})`
    });
  } catch (err) {
    console.error("❌ [ADDRESS] Error getting bair:", err.message);
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

// Verify login code for first-time login
exports.utasBatalgaajuulakhLogin = asyncHandler(async (req, res, next) => {
  try {
    const { baiguullagiinId, utas, code } = req.body;

    // TEMPORARILY DISABLED: SMS verification for login
    const ENABLE_LOGIN_SMS = false; // Set to true to re-enable SMS verification on login
    
    // If SMS is disabled, automatically verify without checking code
    if (!ENABLE_LOGIN_SMS) {
      console.log("⚠️ [LOGIN VERIFY] SMS verification DISABLED - auto-approving verification");
      
      const { db } = require("zevbackv2");
      const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({ utas });
      
      if (!orshinSuugch) {
        return res.status(404).json({
          success: false,
          message: "Хэрэглэгч олдсонгүй!",
        });
      }

      console.log("✅ [LOGIN VERIFY] Auto-approved verification for user:", orshinSuugch._id);

      return res.json({
        success: true,
        message: "Баталгаажуулалт амжилттай (SMS идэвхгүй)",
        // Frontend should save verification status to local storage
      });
    }

    // If baiguullagiinId is not provided, skip OTP verification and proceed
    // This allows wallet-only registrations (without organization) to proceed
    if (!baiguullagiinId) {
      console.log("ℹ️ [LOGIN VERIFY] No baiguullagiinId provided, skipping OTP verification");
      
      const { db } = require("zevbackv2");
      const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({ utas });
      
      if (!orshinSuugch) {
        return res.status(404).json({
          success: false,
          message: "Хэрэглэгч олдсонгүй!",
        });
      }

      console.log("✅ [LOGIN VERIFY] Skipped OTP verification for wallet-only user:", orshinSuugch._id);

      return res.json({
        success: true,
        message: "Баталгаажуулалт алгассан (байгууллагын ID байхгүй)",
        // Frontend should save verification status to local storage
      });
    }

    // If baiguullagiinId is provided, proceed with normal OTP verification
    if (!utas || !code) {
      return res.status(400).json({
        success: false,
        message: "Утас, код заавал бөглөх шаардлагатай!",
      });
    }

    const { db } = require("zevbackv2");
    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
    if (!baiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Байгууллагын мэдээлэл олдсонгүй!",
      });
    }

    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
    );
    if (!tukhainBaaziinKholbolt) {
      return res.status(404).json({
        success: false,
        message: "Холболт олдсонгүй!",
      });
    }

    // Verify code
    const verificationResult = await validateCodeOnly(
      baiguullagiinId,
      utas,
      code,
      "login" // Purpose: login verification
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    // Verify code - frontend handles local storage
    const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findOne({ utas });
    if (!orshinSuugch) {
      return res.status(404).json({
        success: false,
        message: "Хэрэглэгч олдсонгүй!",
      });
    }

    console.log("✅ [LOGIN VERIFY] Code verified for user:", orshinSuugch._id);

    res.json({
      success: true,
      message: "Код амжилттай баталгаажлаа",
      // Frontend should save verification status to local storage
    });
  } catch (error) {
    console.error("❌ [LOGIN VERIFY] Error:", error.message);
    next(error);
  }
});

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
        // Mark all gerees as "Цуцалсан" (Cancelled) - update ONLY tuluv field
        // IMPORTANT: Do NOT update barilgiinId or any other fields - preserve all original data
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
        // Mark all gerees as "Цуцалсан" (Cancelled) - update ONLY tuluv field
        // IMPORTANT: Do NOT update barilgiinId or any other fields - preserve all original data
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