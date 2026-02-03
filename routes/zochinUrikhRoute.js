const express = require("express");
const moment = require("moment");
const { Mashin, Uilchluulegch, EzenUrisanMashin } = require("sukhParking-v1");
const OrshinSuugch = require("../models/orshinSuugch");
const Geree = require("../models/geree");
const router = express.Router();
const { tokenShalgakh, crud, UstsanBarimt } = require("zevbackv2");

crud(router, "ezenUrisanMashin", EzenUrisanMashin, UstsanBarimt);

// Харилцагчийн мэдээллийг шинээр хадгалах буюу засварлах функц
async function orshinSuugchKhadgalya(
  orshinSuugchMedeelel,
  utas,
  tukhainBaaziinKholbolt
) {
  if (!orshinSuugchMedeelel) return null;
  // Remove silent try-catch to properly handle errors
  
  // ID байгаа эсэхийг шалгана
  const orshinSuugchId = orshinSuugchMedeelel._id;
  if (orshinSuugchId) {
    // ID байгаа бол засварлах - зөвхөн өөрчлөгдсөн талбарууд л шинэчлэгдэнэ
    const existingOrshinSuugch = await OrshinSuugch(
      tukhainBaaziinKholbolt
    ).findById(orshinSuugchId);
    if (existingOrshinSuugch) {
      // Өөрчлөгдсөн талбарууд л шинэчлэх
      const updateFields = {};
      // Талбарууд бүрийг шалгаж, өөрчлөгдсөн эсэхийг тодорхойлно
      Object.keys(orshinSuugchMedeelel).forEach((key) => {
        if (key !== "_id" && key !== "createdAt" && key !== "__v") {
          const newValue = orshinSuugchMedeelel[key];
          const oldValue = existingOrshinSuugch[key];
          // Өөрчлөгдсөн талбаруудыг л нэмнэ
          if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
            updateFields[key] = newValue;
          }
        }
      });
      // Өөрчлөлт байгаа бол л шинэчилнэ
      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        return await OrshinSuugch(tukhainBaaziinKholbolt).findByIdAndUpdate(
          orshinSuugchId,
          { $set: updateFields },
          { new: true }
        );
      }
      return existingOrshinSuugch;
    } else {
      throw new Error(`ID: ${orshinSuugchId} харилцагч олдсонгүй`);
    }
  } else {
    // ID байхгүй бол шинээр хадгална (save ашиглана)
    const { _id, ...orshinSuugchData } = orshinSuugchMedeelel;
    // Утасны дугаараар давхцах эсэхийг шалгана
    const existingByUtas = await OrshinSuugch(tukhainBaaziinKholbolt).findOne(
      {
        utas: { $in: [utas] },
        barilgiinId: orshinSuugchMedeelel.barilgiinId,
      }
    );
    if (existingByUtas) {
      // If user exists, return them instead of erroring
      console.log(`ℹ️ [ZOCHIN_URI] User exists with phone ${utas}, using existing record.`);
      return existingByUtas;
    }
    const newOrshinSuugch = new OrshinSuugch(tukhainBaaziinKholbolt)({
      ...orshinSuugchData,
      utas: orshinSuugchData.utas || [utas],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await newOrshinSuugch.save();
  }
}

// Машины мэдээллийг шинээр хадгалах буюу засварлах функц
async function mashinHadgalya(mashinMedeelel, tukhainBaaziinKholbolt) {
  if (!mashinMedeelel) return null;
  try {
    const mashinId = mashinMedeelel._id;
    if (mashinId) {
      // ID байгаа бол засварлах - зөвхөн өөрчлөгдсөн талбарууд л шинэчлэгдэнэ
      const existingMashin = await Mashin(tukhainBaaziinKholbolt).findById(
        mashinId
      );
      if (existingMashin) {
        const updateFields = {};
        Object.keys(mashinMedeelel).forEach((key) => {
          if (key !== "_id" && key !== "createdAt" && key !== "__v") {
            const newValue = mashinMedeelel[key];
            const oldValue = existingMashin[key];
            if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
              updateFields[key] = newValue;
            }
          }
        });
        if (Object.keys(updateFields).length > 0) {
          updateFields.updatedAt = new Date();
          return await Mashin(tukhainBaaziinKholbolt).findByIdAndUpdate(
            mashinId,
            { $set: updateFields },
            { new: true }
          );
        }
        return existingMashin;
      } else {
        throw new Error(`ID: ${mashinId} машин олдсонгүй`);
      }
    } else {
      // ID байхгүй бол шинээр хадгална (save ашиглана)
      const { _id, ...mashinData } = mashinMedeelel;
      // Давхцах эсэхийг шалгана
      const existingMashin = await Mashin(tukhainBaaziinKholbolt).findOne({
        dugaar: mashinData.dugaar,
        barilgiinId: mashinData.barilgiinId,
        baiguullagiinId: mashinData.baiguullagiinId,
      });
      if (existingMashin) {
        throw new Error("Энэ дугаартай машин аль хэдийн бүртгэгдсэн байна");
      }
      const newMashin = new Mashin(tukhainBaaziinKholbolt)({
        ...mashinData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return await newMashin.save();
    }
  } catch (error) {}
}

/**
 * GET Guest Settings for the current resident
 */
router.get("/zochinSettings", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
    const residentId = req.body.nevtersenAjiltniiToken?.id;

    if (!residentId) return res.status(401).send("Нэвтрэх шаардлагатай");

    const settings = await OrshinSuugchMashin(db.erunkhiiKholbolt).findOne({
      orshinSuugchiinId: residentId,
      zochinTurul: "Оршин суугч"
    });

    res.send(settings || {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET Quota Status for the current resident
 */
router.get("/zochinQuotaStatus", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
    const residentId = req.body.nevtersenAjiltniiToken?.id;

    if (!residentId) return res.status(401).send("Нэвтрэх шаардлагатай");

    const masterSetting = await OrshinSuugchMashin(db.erunkhiiKholbolt).findOne({
      orshinSuugchiinId: residentId,
      zochinTurul: "Оршин суугч"
    });

    if (!masterSetting) return res.send({ total: 0, used: 0, remaining: 0 });

    const period = masterSetting.davtamjiinTurul === "saraar" ? "month" : "day";
    const startOfPeriod = moment().startOf(period).toDate();

    const usedCount = await EzenUrisanMashin(req.body.tukhainBaaziinKholbolt).countDocuments({
      ezenId: residentId,
      createdAt: { $gte: startOfPeriod }
    });

    res.send({
      total: masterSetting.zochinErkhiinToo || 0,
      used: usedCount,
      remaining: Math.max(0, (masterSetting.zochinErkhiinToo || 0) - usedCount),
      period: masterSetting.davtamjiinTurul,
      freeMinutesPerGuest: masterSetting.zochinTusBurUneguiMinut || 0
    });
  } catch (error) {
    next(error);
  }
});

// Үндсэн route функц
router.post("/zochinHadgalya", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    let {
      mashiniiDugaar,
      baiguullagiinId,
      barilgiinId,
      ezemshigchiinUtas,
      tukhainBaaziinKholbolt,
      orshinSuugchMedeelel,
      khariltsagchMedeelel,
      mashinMedeelel,
    } = req.body;

    // Fix: Map khariltsagchMedeelel to orshinSuugchMedeelel if implicit
    if (!orshinSuugchMedeelel && khariltsagchMedeelel) {
      orshinSuugchMedeelel = khariltsagchMedeelel;
    }

    if (!mashiniiDugaar || !baiguullagiinId || !ezemshigchiinUtas) {
      return res.status(400).json({
        success: false,
        message: "Шаардлагатай талбарууд дутуу байна",
      });
    }

    let inviterSettings = null;
    const inviterId = req.body.nevtersenAjiltniiToken?.id;
    const requesterRole = req.body.nevtersenAjiltniiToken?.erkh;

    // 1. PLATE CHANGE RESTRICTION: Resident primary car
    if (inviterId && orshinSuugchMedeelel?.zochinTurul === "Оршин суугч") {
        const OrshinSuugchMashinModel = require("../models/orshinSuugchMashin");
        const existingPrimary = await OrshinSuugchMashinModel(db.erunkhiiKholbolt).findOne({
            orshinSuugchiinId: inviterId,
            zochinTurul: "Оршин суугч"
        });

        if (existingPrimary && existingPrimary.mashiniiDugaar !== mashiniiDugaar) {
            // App side restriction
            if (requesterRole === "OrshinSuugch") {
                const oneMonthAgo = moment().subtract(1, 'month');
                if (existingPrimary.dugaarUurchilsunOgnoo && moment(existingPrimary.dugaarUurchilsunOgnoo).isAfter(oneMonthAgo)) {
                    return res.status(403).json({ success: false, message: "Машины дугаарыг сард нэг удаа өөрчлөх боломжтой" });
                }
                // Mark update time for resident-side change
                orshinSuugchMedeelel.dugaarUurchilsunOgnoo = new Date();
            }
        }
    }

    // 2. QUOTA CHECK: If we are inviting a guest car
    if (inviterId && orshinSuugchMedeelel?.zochinTurul !== "Оршин суугч") {
        const OrshinSuugchMashinModel = require("../models/orshinSuugchMashin");
        inviterSettings = await OrshinSuugchMashinModel(db.erunkhiiKholbolt).findOne({
            orshinSuugchiinId: inviterId,
            zochinTurul: "Оршин суугч"
        });

        if (inviterSettings) {
            if (!inviterSettings.zochinUrikhEsekh) {
                return res.status(403).json({ success: false, message: "Танд зочин урих эрх байхгүй байна" });
            }

            const period = inviterSettings.davtamjiinTurul === "saraar" ? "month" : "day";
            const startOfPeriod = moment().startOf(period).toDate();
            const usedCount = await EzenUrisanMashin(tukhainBaaziinKholbolt).countDocuments({
                ezenId: inviterId,
                createdAt: { $gte: startOfPeriod }
            });

            if (usedCount >= (inviterSettings.zochinErkhiinToo || 0)) {
                return res.status(403).json({ success: false, message: "Таны зочин урих лимит дууссан байна" });
            }

            // AFFECT MINUTE: Inherit free minutes from inviter to guest car
            if (inviterSettings.zochinTusBurUneguiMinut) {
                orshinSuugchMedeelel.zochinTusBurUneguiMinut = inviterSettings.zochinTusBurUneguiMinut;
            }
        }
    }

    let orshinSuugchResult = null;
    let mashinResult = null;

    // Харилцагчийн мэдээллийг хадгална/засварлана
    if (orshinSuugchMedeelel) {
      try {
        const residentData = { ...orshinSuugchMedeelel };
        delete residentData.zochinUrikhEsekh;
        delete residentData.zochinTurul;
        delete residentData.davtamjiinTurul;
        delete residentData.mashiniiDugaar;
        delete residentData.dugaarUurchilsunOgnoo;
        delete residentData.ezenToot;
        delete residentData.zochinTailbar;
        delete residentData.zochinErkhiinToo;
        delete residentData.zochinTusBurUneguiMinut;
        delete residentData.zochinNiitUneguiMinut;

        orshinSuugchResult = await orshinSuugchKhadgalya(
          residentData,
          ezemshigchiinUtas,
          db.erunkhiiKholbolt
        );

        // Also save to OrshinSuugchMashin (Visitor Vehicle History)
        if (orshinSuugchResult) {
          const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
          
          let filter = { 
            orshinSuugchiinId: orshinSuugchResult._id,
            mashiniiDugaar: orshinSuugchMedeelel.mashiniiDugaar 
          };

          // If updating primary resident car, match by ID and Type to allow number change
          if (orshinSuugchMedeelel.zochinTurul === "Оршин суугч") {
            filter = {
              orshinSuugchiinId: orshinSuugchResult._id,
              zochinTurul: "Оршин суугч"
            };
          }

          await OrshinSuugchMashin(db.erunkhiiKholbolt).findOneAndUpdate(
            filter,
            {
               $set: {
                mashiniiDugaar: orshinSuugchMedeelel.mashiniiDugaar,
                zochinUrikhEsekh: orshinSuugchMedeelel.zochinUrikhEsekh,
                zochinTurul: orshinSuugchMedeelel.zochinTurul,
                davtamjiinTurul: orshinSuugchMedeelel.davtamjiinTurul,
                dugaarUurchilsunOgnoo: orshinSuugchMedeelel.dugaarUurchilsunOgnoo,
                ezenToot: orshinSuugchMedeelel.ezenToot,
                zochinTailbar: orshinSuugchMedeelel.zochinTailbar,
                zochinErkhiinToo: orshinSuugchMedeelel.zochinErkhiinToo,
                zochinTusBurUneguiMinut: orshinSuugchMedeelel.zochinTusBurUneguiMinut,
                zochinNiitUneguiMinut: orshinSuugchMedeelel.zochinNiitUneguiMinut,
               }
            },
            { upsert: true, new: true }
          );

          // TRACK USAGE: Create EzenUrisanMashin record if it was an invitation
          if (inviterId && inviterSettings) {
             const newInvitation = new EzenUrisanMashin(tukhainBaaziinKholbolt)({
                baiguullagiinId: baiguullagiinId,
                ezenId: inviterId,
                urisanMashiniiDugaar: mashiniiDugaar,
                tuluv: 0,
                ognoo: new Date()
             });
             await newInvitation.save();
             console.log("✅ [QUOTA] Invitation recorded for", inviterId);
          }

          console.log("✅ [ZOCHIN_URI] Success. OrshinSuugchMashin saved/updated.");
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Харилцагч хадгалахад алдаа: ${error.message}`,
        });
      }
    }

    // Машины мэдээллийг хадгална/засварлана
    if (mashinMedeelel) {
      try {
        mashinResult = await mashinHadgalya(
          mashinMedeelel,
          tukhainBaaziinKholbolt
        );
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Машин хадгалахад алдаа: ${error.message}`,
        });
      }
    } else {
      // Машины мэдээлэл байхгүй бол анхны логикоор шинээр үүсгэнэ
      var existingMashin = await Mashin(tukhainBaaziinKholbolt).findOne({
        dugaar: mashiniiDugaar,
        baiguullagiinId: baiguullagiinId,
        ezemshigchiinUtas: ezemshigchiinUtas,
      });

      if (existingMashin) {
        return res.status(409).json({
          success: false,
          message: "Энэ машин аль хэдийн бүртгэгдсэн байна",
        });
      }

      const newVehicleData = {
        baiguullagiinId: baiguullagiinId,
        barilgiinId: barilgiinId,
        dugaar: mashiniiDugaar,
        ezemshigchiinUtas: ezemshigchiinUtas,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      var gereeObject = await Geree(tukhainBaaziinKholbolt, true).findOne({
        baiguullagiinId: baiguullagiinId,
        utas: ezemshigchiinUtas,
        tuluv: { $ne: -1 },
      });
      if (gereeObject) {
        newVehicleData.ezemshigchiinRegister = gereeObject.register;
        newVehicleData.ezemshigchiinTalbainDugaar =
          gereeObject.ezemshigchiinTalbainDugaar || "";
        newVehicleData.gereeniiDugaar = gereeObject.gereeniiDugaar || "";
      }

      const newMashin = new Mashin(tukhainBaaziinKholbolt)(newVehicleData);
      mashinResult = await newMashin.save();
    }

    // Машины жагсаалт боловсруулах
    const mashiniiJagsaalt = [mashinResult];

    console.log("✅ [ZOCHIN_URI] Success. OrshinSuugch:", orshinSuugchResult ? orshinSuugchResult._id : "NULL");
    console.log("✅ [ZOCHIN_URI] Success. Mashin:", mashinResult ? mashinResult._id : "NULL");

    res.status(201).json({
      success: true,
      message: "Мэдээлэл амжилттай хадгалагдлаа",
      data: {
        orshinSuugch: orshinSuugchResult,
        mashin: mashinResult,
        jagsaalt: mashiniiJagsaalt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Серверийн алдаа гарлаа",
    });
    if (next) next(error);
  }
});

router.post("/ezenUrisanTuukh", tokenShalgakh, async (req, res, next) => {
  try {
    var ezenJagsaalt = await EzenUrisanMashin(
      req.body.tukhainBaaziinKholbolt
    ).find({
      baiguullagiinId: req.body.baiguullagiinId,
      ezenId: req.body.ezenId,
    });
    var jagsaalt = [];
    if (ezenJagsaalt?.length > 0) {
      jagsaalt = await Uilchluulegch(
        req.body.tukhainBaaziinKholbolt,
        true
      ).find({
        mashiniiDugaar: {
          $in: ezenJagsaalt?.map((e) => e.urisanMashiniiDugaar),
        },
      });
    }
    var ezenList = ezenJagsaalt?.filter((a) => a.tuluv == 0);
    res.send({ ezenList, jagsaalt });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "ezenUrisanTuukh алдаа гарлаа",
    });
    if (next) next(error);
  }
});

router.get("/zochinJagsaalt", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
    
    const page = parseInt(req.query.khuudasniiDugaar) || 1;
    const limit = parseInt(req.query.khuudasniiKhemjee) || 10;
    const skip = (page - 1) * limit;
    const baiguullagiinId = req.query.baiguullagiinId;

    if (!baiguullagiinId) {
        return res.status(400).send("baiguullagiinId required");
    }

    // Aggregation pipeline
    const pipeline = [
      // 1. Convert string ID to ObjectId for lookup if necessary
      {
        $addFields: {
           orshinSuugchObjId: { $toObjectId: "$orshinSuugchiinId" }
        }
      },
      // 2. Lookup OrshinSuugch
      {
        $lookup: {
          from: "orshinSuugch", 
          localField: "orshinSuugchObjId",
          foreignField: "_id",
          as: "resident"
        }
      },
      // 3. Unwind
      { $unwind: "$resident" },
      // 4. Match by baiguullagiinId (from resident)
      {
        $match: {
          "resident.baiguullagiinId": baiguullagiinId
        }
      }
    ];

    // Add search if provided
    if (req.query.search) {
       const regex = new RegExp(req.query.search, 'i');
       pipeline.push({
           $match: {
               $or: [
                   { "resident.ner": regex },
                   // Handle utas array or string
                   { "resident.utas": regex }, 
                   { "mashiniiDugaar": regex },
                   { "resident.toot": regex },
                   { "ezenToot": regex }
               ]
           }
       });
    }

    // Sort by most recent
    pipeline.push({ $sort: { createdAt: -1 } });

    // Facet for pagination
    pipeline.push({
        $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: limit }]
        }
    });

    const result = await OrshinSuugchMashin(db.erunkhiiKholbolt).aggregate(pipeline);
    
    const data = result[0].data;
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

    // Reshape data for table
    const formattedData = data.map(item => ({
        _id: item._id,
        createdAt: item.createdAt,
        ner: item.resident.ner,
        utas: item.resident.utas,
        mashiniiDugaar: item.mashiniiDugaar,
        zochinTurul: item.zochinTurul,
        zochinTailbar: item.zochinTailbar,
        ezenToot: item.ezenToot || item.resident.toot, // Use visitor's ezenToot or resident's toot
        davtamjiinTurul: item.davtamjiinTurul
    }));

     res.send({
      jagsaalt: formattedData,
      niitMur: total,
      niitKhuudas: Math.ceil(total / limit),
      khuudasniiDugaar: page,
      khuudasniiKhemjee: limit
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
