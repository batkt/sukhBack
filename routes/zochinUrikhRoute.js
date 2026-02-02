const express = require("express");
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

    let orshinSuugchResult = null;
    let mashinResult = null;

    // Харилцагчийн мэдээллийг хадгална/засварлана
    if (orshinSuugchMedeelel) {
      try {
        // Create a copy for resident data and remove visitor-specific fields
        // This ensures visitor fields are ONLY saved to OrshinSuugchMashin schema as requested
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
          
          // Check if record exists to update or create new
          // We match by orshinSuugchiinId and mashiniiDugaar to avoid duplicates if preferred, 
          // but strictly following "save into this", we will upsert or save.
          // Given the fields track settings, we probably want to update the existing settings for this user/car.
          
          await OrshinSuugchMashin(db.erunkhiiKholbolt).findOneAndUpdate(
            { 
               orshinSuugchiinId: orshinSuugchResult._id,
               mashiniiDugaar: orshinSuugchMedeelel.mashiniiDugaar 
            },
            {
               $set: {
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

module.exports = router;
