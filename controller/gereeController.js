const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const { daraagiinTulukhOgnooZasya } = require("./tulbur");

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    console.log("gereeniiGuilgeeKhadgalya -----> Ийшээ орлоо");
    const { db } = require("zevbackv2");
    var guilgee = req.body.guilgee;

    if (!guilgee.gereeniiId) {
      throw new Error("Гэрээний ID заавал бөглөх шаардлагатай!");
    }

    // Get baiguullagiinId from request body or from geree document
    let baiguullagiinId = req.body.baiguullagiinId;
    
    // If not provided, get it from the geree document
    if (!baiguullagiinId) {
      // Try to find geree in any connection to get baiguullagiinId
      // We'll need to search through connections or get it from a temporary connection
      // For now, let's require it in the body or get from geree if we can find it
      const allConnections = db.kholboltuud || [];
      let foundGeree = null;
      
      for (const conn of allConnections) {
        try {
          const tempGeree = await Geree(conn, true).findById(guilgee.gereeniiId).select("baiguullagiinId");
          if (tempGeree) {
            foundGeree = tempGeree;
            baiguullagiinId = tempGeree.baiguullagiinId;
            break;
          }
        } catch (err) {
          // Continue searching
        }
      }
      
      if (!baiguullagiinId) {
        throw new Error("Байгууллагын ID олдсонгүй! Гэрээ олдсонгүй эсвэл байгууллагын ID-г body-д оруулна уу.");
      }
    }

    // Get connection from baiguullagiinId
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (kholbolt) => String(kholbolt.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      throw new Error("Холболтын мэдээлэл олдсонгүй!");
    }

    if (guilgee.guilgeeniiId) {
      var shalguur = await BankniiGuilgee(
        tukhainBaaziinKholbolt, true
      ).findOne({
        "guilgee.guilgeeniiId": guilgee.guilgeeniiId,
        kholbosonGereeniiId: guilgee.gereeniiId,
      });
      if (shalguur)
        throw new Error("Тухайн гүйлгээ тухайн гэрээнд холбогдсон байна!");
    }
    
    if (
      (guilgee.turul == "barter" ||
        guilgee.turul == "avlaga" ||
        guilgee.turul == "aldangi") &&
      !guilgee.tailbar
    ) {
      throw new Error("Тайлбар заавал оруулна уу?");
    }
    
    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }

    var inc = {
      uldegdel: -(guilgee?.tulsunDun || 0),
    };
    
    if (guilgee.turul == "aldangi") {
      inc["aldangiinUldegdel"] = -guilgee.tulsunAldangi;
      inc["niitTulsunAldangi"] = +guilgee.tulsunAldangi;
    }

    // Create a copy for guilgeenuudForNekhemjlekh (one-time tracking)
    const guilgeeForNekhemjlekh = { ...guilgee };
    // Get the index where this guilgee will be added
    const geree = await Geree(tukhainBaaziinKholbolt, true)
      .findById(guilgee.gereeniiId)
      .select("+avlaga");
    const currentGuilgeenuudCount = geree?.avlaga?.guilgeenuud?.length || 0;
    guilgeeForNekhemjlekh.avlagaGuilgeeIndex = currentGuilgeenuudCount;

    const result = await Geree(tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: guilgee.gereeniiId },
        {
          $push: {
            [`avlaga.guilgeenuud`]: guilgee,
            guilgeenuudForNekhemjlekh: guilgeeForNekhemjlekh, // Add to tracking array for one-time inclusion in invoice
          },
          $inc: inc,
        }
      );

    await daraagiinTulukhOgnooZasya(
      guilgee.gereeniiId,
      tukhainBaaziinKholbolt
    );

    // If avlaga type, create invoice immediately without month restrictions
    if (guilgee.turul === "avlaga") {
      try {
        const { gereeNeesNekhemjlekhUusgekh } = require("./nekhemjlekhController");
        const Baiguullaga = require("../models/baiguullaga");
        
        // Get fresh geree data with all fields needed for invoice
        const freshGeree = await Geree(tukhainBaaziinKholbolt, true)
          .findById(guilgee.gereeniiId)
          .lean();
        
        if (freshGeree) {
          // Get baiguullaga
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt)
            .findById(baiguullagiinId)
            .lean();
          
          if (baiguullaga) {
            const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
              freshGeree,
              baiguullaga,
              tukhainBaaziinKholbolt,
              "garan",
              true // skipDuplicateCheck = true to bypass month restrictions
            );
            
            // Invoice created successfully (SMS will be sent automatically by gereeNeesNekhemjlekhUusgekh)
          }
        }
      } catch (invoiceError) {
        // Don't fail the guilgee addition if invoice creation fails
      }
    }

    if (guilgee.guilgeeniiId) {
      const result1 = await BankniiGuilgee(tukhainBaaziinKholbolt)
        .updateOne(
          { _id: guilgee.guilgeeniiId },
          {
            $set: {
              kholbosonGereeniiId: guilgee.gereeniiId,
              kholbosonTalbainId: result.talbainDugaar,
            },
          }
        );
      res.send(result1);
    } else {
      res.send(result);
    }
  } catch (aldaa) {
    next(aldaa);
  }
});

