const express = require("express");
const router = express.Router();
const { tokenShalgakh, db } = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const EbarimtShine = require("../models/ebarimtShine");
const EbarimtStandard = require("../models/ebarimt");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const OrshinSuugch = require("../models/orshinSuugch");
const Mashin = require("../models/mashin");
const ZaaltUnshlalt = require("../models/zaaltUnshlalt");
const QuickQpayObject = require("../models/qpayObject");
const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
const UilchilgeeniiZardluud = require("../models/uilchilgeeniiZardluud");
const TootBurtgel = require("../models/tootBurtgel");
const MsgTuukh = require("../models/msgTuukh");
const NekhemjlekhCron = require("../models/cronSchedule");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
const GereeniiZaalt = require("../models/gereeniiZaalt");
const GereeniiZagvar = require("../models/gereeniiZagvar");
const NekhemjlekhiinZagvar = require("../models/nekhemjlekhiinZagvar");
const Medegdel = require("../models/medegdel");
const Sonorduulga = require("../models/sonorduulga");
const UneguiMashin = require("../models/uneguiMashin");
const Zogsool = require("../models/zogsool");
const ZogsooliinIp = require("../models/zogsooliinIp");
const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
const KassCameraKhaalt = require("../models/kassCameraKhaalt");

// Hardcoded authorized organization IDs
const AUTHORIZED_ORGS = [
  "698e7fd3b6dd386b6c56a808", // Admin Org 1
];

// router.get("/transformation/organizations", tokenShalgakh, async (req, res, next) => {
//   try {
//     const requestorOrgId = req.body.baiguullagiinId; // From tokenShalgakh

//     // Safety check: Only work if requestor is from an authorized org
//     if (!AUTHORIZED_ORGS.includes(requestorOrgId)) {
//       return res.status(403).json({
//         success: false,
//         message: "Энэ үйлдлийг хийх эрх байхгүй байна! (Authorized org check failed)",
//       });
//     }

//     const organizations = await Baiguullaga(db.erunkhiiKholbolt)
//       .find({}, { ner: 1, barilguud: 1 })
//       .lean();

//     res.json({
//       success: true,
//       result: organizations
//     });
//   } catch (error) {
//     next(error);
//   }
// });

router.post("/transformation/transformBarilga", tokenShalgakh, async (req, res, next) => {
  try {
    const { oldBaiguullagiinId, newBaiguullagiinId, barilgiinId } = req.body;
    const requestorOrgId = req.body.baiguullagiinId; // From tokenShalgakh

    // Safety check: Only work if requestor is from an authorized org
    if (!AUTHORIZED_ORGS.includes(requestorOrgId)) {
      return res.status(403).json({
        success: false,
        message: "Энэ үйлдлийг хийх эрх байхгүй байна! (Authorized org check failed)",
      });
    }

    if (!oldBaiguullagiinId || !newBaiguullagiinId || !barilgiinId) {
      return res.status(400).json({
        success: false,
        message: "oldBaiguullagiinId, newBaiguullagiinId, and barilgiinId are required",
      });
    }

    // 1. Move Building Config in Erunkhii DB
    const oldBaiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(oldBaiguullagiinId);
    const newBaiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(newBaiguullagiinId);

    if (!oldBaiguullaga || !newBaiguullaga) {
      return res.status(404).json({
        success: false,
        message: "Old or New organization not found",
      });
    }

    const barilgaIndex = oldBaiguullaga.barilguud.findIndex(b => String(b._id) === String(barilgiinId));
    if (barilgaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Building not found in old organization",
      });
    }

    // Capture building config
    const barilgaConfig = oldBaiguullaga.barilguud[barilgaIndex].toObject();
    
    // Remove from old
    oldBaiguullaga.barilguud.splice(barilgaIndex, 1);
    await oldBaiguullaga.save();

    // Add to new
    newBaiguullaga.barilguud.push(barilgaConfig);
    await newBaiguullaga.save();

    // 2. Update Data in Tenant DB(s)
    const oldKholbolt = db.kholboltuud.find(k => String(k.baiguullagiinId) === String(oldBaiguullagiinId));
    const newKholbolt = db.kholboltuud.find(k => String(k.baiguullagiinId) === String(newBaiguullagiinId));

    if (!oldKholbolt) {
      return res.status(500).json({ success: false, message: "Old organization connection not found" });
    }

    // Models to update which have baiguullagiinId and barilgiinId
    const models = [
      { name: "geree", factory: Geree },
      { name: "bankniiGuilgee", factory: BankniiGuilgee },
      { name: "ebarimtShine", factory: EbarimtShine },
      { name: "ebarimt", factory: EbarimtStandard },
      { name: "nekhemjlekhiinTuukh", factory: nekhemjlekhiinTuukh },
      { name: "orshinSuugch", factory: OrshinSuugch },
      { name: "mashin", factory: Mashin },
      { name: "zaaltUnshlalt", factory: ZaaltUnshlalt },
      { name: "qpayObject", factory: QuickQpayObject },
      { name: "ashiglaltiinZardluud", factory: AshiglaltiinZardluud },
      { name: "uilchilgeeniiZardluud", factory: UilchilgeeniiZardluud },
      { name: "tootBurtgel", factory: TootBurtgel },
      { name: "msgTuukh", factory: MsgTuukh },
      { name: "nekhemjlekhCron", factory: NekhemjlekhCron },
      { name: "gereeniiTulsunAvlaga", factory: GereeniiTulsunAvlaga },
      { name: "gereeniiTulukhAvlaga", factory: GereeniiTulukhAvlaga },
      { name: "gereeniiZaalt", factory: GereeniiZaalt },
      { name: "gereeniiZagvar", factory: GereeniiZagvar },
      { name: "nekhemjlekhiinZagvar", factory: NekhemjlekhiinZagvar },
      { name: "medegdel", factory: Medegdel },
      { name: "sonorduulga", factory: Sonorduulga },
      { name: "uneguiMashin", factory: UneguiMashin },
      { name: "zogsool", factory: Zogsool },
      { name: "zogsooliinIp", factory: ZogsooliinIp },
      { name: "orshinSuugchMashin", factory: OrshinSuugchMashin },
      { name: "kassCameraKhaalt", factory: KassCameraKhaalt }
    ];

    const results = {};
    const updatePayload = { baiguullagiinId: newBaiguullagiinId };
    if (newBaiguullaga.ner) {
      updatePayload.baiguullagiinNer = newBaiguullaga.ner;
    }

    for (const modelInfo of models) {
      try {
        const Model = modelInfo.factory(oldKholbolt);
        const result = await Model.updateMany(
          { baiguullagiinId: oldBaiguullagiinId, barilgiinId: barilgiinId },
          { $set: updatePayload }
        );
        results[modelInfo.name] = result.modifiedCount;
      } catch (err) {
        // Some models might not have barilgiinId in their schema, or use different field names.
        // If it fails with a specific schema error, we can log it.
        results[modelInfo.name] = "Error: " + err.message;
      }
    }

    res.json({
      success: true,
      message: "Building and its data transported successfully",
      details: results,
      barilgiinId: barilgiinId,
      oldBaiguullagiinId: oldBaiguullagiinId,
      newBaiguullagiinId: newBaiguullagiinId
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
