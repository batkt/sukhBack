const express = require("express");
const { Mashin, Uilchluulegch, EzenUrisanMashin } = require("parking-v2");
const Khariltsagch = require("../models/khariltsagch");
const Geree = require("../models/geree");
const router = express.Router();
const { tokenShalgakh, crud, UstsanBarimt } = require("zevbackv2");

crud(router, "ezenUrisanMashin", EzenUrisanMashin, UstsanBarimt);

// Харилцагчийн мэдээллийг шинээр хадгалах буюу засварлах функц
async function khariltsagchKhadgalya(
  khariltsagchMedeelel,
  utas,
  tukhainBaaziinKholbolt
) {
  if (!khariltsagchMedeelel) return null;
  try {
    // ID байгаа эсэхийг шалгана
    const khariltsagchId = khariltsagchMedeelel._id;
    if (khariltsagchId) {
      // ID байгаа бол засварлах - зөвхөн өөрчлөгдсөн талбарууд л шинэчлэгдэнэ
      const existingKhariltsagch = await Khariltsagch(
        tukhainBaaziinKholbolt
      ).findById(khariltsagchId);
      if (existingKhariltsagch) {
        // Өөрчлөгдсөн талбарууд л шинэчлэх
        const updateFields = {};
        // Талбарууд бүрийг шалгаж, өөрчлөгдсөн эсэхийг тодорхойлно
        Object.keys(khariltsagchMedeelel).forEach((key) => {
          if (key !== "_id" && key !== "createdAt" && key !== "__v") {
            const newValue = khariltsagchMedeelel[key];
            const oldValue = existingKhariltsagch[key];
            // Өөрчлөгдсөн талбаруудыг л нэмнэ
            if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
              updateFields[key] = newValue;
            }
          }
        });
        // Өөрчлөлт байгаа бол л шинэчилнэ
        if (Object.keys(updateFields).length > 0) {
          updateFields.updatedAt = new Date();
          return await Khariltsagch(tukhainBaaziinKholbolt).findByIdAndUpdate(
            khariltsagchId,
            { $set: updateFields },
            { new: true }
          );
        }
        return existingKhariltsagch;
      } else {
        throw new Error(`ID: ${khariltsagchId} харилцагч олдсонгүй`);
      }
    } else {
      // ID байхгүй бол шинээр хадгална (save ашиглана)
      const { _id, ...khariltsagchData } = khariltsagchMedeelel;
      // Утасны дугаараар давхцах эсэхийг шалгана
      const existingByUtas = await Khariltsagch(tukhainBaaziinKholbolt).findOne(
        {
          utas: { $in: [utas] },
          barilgiinId: khariltsagchMedeelel.barilgiinId,
        }
      );
      if (existingByUtas) {
        throw new Error(
          "Энэ утасны дугаартай харилцагч аль хэдийн бүртгэгдсэн байна"
        );
      }
      const newKhariltsagch = new Khariltsagch(tukhainBaaziinKholbolt)({
        ...khariltsagchData,
        utas: khariltsagchData.utas || [utas],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return await newKhariltsagch.save();
    }
  } catch (error) {}
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
    const {
      mashiniiDugaar,
      baiguullagiinId,
      barilgiinId,
      ezemshigchiinUtas,
      tukhainBaaziinKholbolt,
      khariltsagchMedeelel,
      mashinMedeelel,
    } = req.body;

    if (!mashiniiDugaar || !baiguullagiinId || !ezemshigchiinUtas) {
      return res.status(400).json({
        success: false,
        message: "Шаардлагатай талбарууд дутуу байна",
      });
    }

    let khariltsagchResult = null;
    let mashinResult = null;

    // Харилцагчийн мэдээллийг хадгална/засварлана
    if (khariltsagchMedeelel) {
      try {
        khariltsagchResult = await khariltsagchKhadgalya(
          khariltsagchMedeelel,
          ezemshigchiinUtas,
          db.erunkhiiKholbolt
        );
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

    res.status(201).json({
      success: true,
      message: "Мэдээлэл амжилттай хадгалагдлаа",
      data: {
        khariltsagch: khariltsagchResult,
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
