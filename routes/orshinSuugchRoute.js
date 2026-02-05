const express = require("express");
const router = express.Router();
const OrshinSuugch = require("../models/orshinSuugch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const request = require("request");
const {
  tokenShalgakh,
  crudWithFile,
  crud,
  UstsanBarimt,
  db,
} = require("zevbackv2");
const {
  orshinSuugchNevtrey,
  orshinSuugchBurtgey,
  walletBurtgey,
  walletBillingHavakh,
  walletAddressCities,
  walletAddressDistricts,
  walletAddressKhoroo,
  walletAddressBair,
  tokenoorOrshinSuugchAvya,
  nuutsUgShalgakhOrshinSuugch,
  khayagaarBaiguullagaAvya,
  dugaarBatalgaajuulya,
  dugaarBatalgaajuulakh,
  orshinSuugchBatalgaajuulya,
  nuutsUgSergeeye,
  davhardsanOrshinSuugchShalgayy,
  orshinSuugchiinNuutsUgSoliyo,
  orshinSuugchOorooUstgakh,
  orshinSuugchUstgakh,
  tootShalgaya,
  validateOwnOrgToot,
  utasBatalgaajuulakhLogin,
} = require("../controller/orshinSuugch");
const aldaa = require("../components/aldaa");
const session = require("../models/session");
const multer = require("multer");
const {
  generateExcelTemplate,
  importUsersFromExcel,
  downloadExcelList,
  downloadOrshinSuugchExcel,
} = require("../controller/excelImportController");
const { gereeNeesNekhemjlekhUusgekh } = require("../controller/nekhemjlekhController");

// Configure multer for memory storage (Excel files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Зөвхөн Excel файл (.xlsx, .xls) оруулах боломжтой!"),
        false
      );
    }
  },
});

// Custom DELETE handler for orshinSuugch - marks gerees as "Цуцалсан" before deleting
router.delete("/orshinSuugch/:id", tokenShalgakh, orshinSuugchUstgakh);

// Use crud for other operations (GET, POST, PUT) but not DELETE
router.get("/orshinSuugch", tokenShalgakh, async (req, res, next) => {
  try {
    const body = req.query;
    
    // Extract baiguullagiinId and barilgiinId from query params
    const baiguullagiinId = body.baiguullagiinId;
    const barilgiinId = body.barilgiinId;
    
    // baiguullagiinId is required for filtering
    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "Байгууллагын ID заавал бөглөх шаардлагатай!",
        aldaa: "Байгууллагын ID заавал бөглөх шаардлагатай!",
      });
    }
    
    // Initialize body.query if it doesn't exist
    if (!body.query) {
      body.query = {};
    } else if (typeof body.query === 'string') {
      body.query = JSON.parse(body.query);
    }
    
    // Parse other query parameters
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.select) body.select = JSON.parse(body.select);
    if (!!body?.collation) body.collation = JSON.parse(body.collation);
    
    // Set default values and parse pagination parameters
    const khuudasniiDugaar = body.khuudasniiDugaar 
      ? Number(body.khuudasniiDugaar) 
      : 1;
    const khuudasniiKhemjee = body.khuudasniiKhemjee 
      ? Number(body.khuudasniiKhemjee) 
      : 1000;
    
    // Create filters for baiguullagiinId and barilgiinId
    // We must check BOTH top-level fields AND the toots array (nested objects)
    // This ensures we find residents even if they are primarily associated with another organization
    
    const filters = [];
    
    // 1. BaiguullagiinId filter (Required)
    const baiguullagiinIdString = String(baiguullagiinId);
    filters.push({
      $or: [
        { baiguullagiinId: baiguullagiinIdString },
        { "toots.baiguullagiinId": baiguullagiinIdString }
      ]
    });
    
    // 2. BarilgiinId filter (Optional)
    if (barilgiinId) {
      const barilgiinIdString = String(barilgiinId);
      filters.push({
        $or: [
          { barilgiinId: barilgiinIdString },
          { "toots.barilgiinId": barilgiinIdString }
        ]
      });
    }

    // 3. Combine with existing query params (search, etc.)
    // If body.query is not empty, we need to preserve existing filters
    if (Object.keys(body.query).length > 0) {
      // Use $and to combine existing query with our new structural filters
      body.query = {
        $and: [
          body.query, // Existing filters (e.g. from search inputs)
          ...filters
        ]
      };
    } else {
      // If no existing query, just combine our filters
      if (filters.length === 1) {
        body.query = filters[0];
      } else {
        body.query = { $and: filters };
      }
    }
    
    // Residents MUST be in erunkhiiKholbolt
    const kholbolt = db.erunkhiiKholbolt;
    
    // Fetch residents from erunkhiiKholbolt
    let jagsaalt = await OrshinSuugch(kholbolt)
      .find(body.query)
      .sort(body.order)
      .collation(body.collation ? body.collation : {})
      .select(body.select)
      .skip((khuudasniiDugaar - 1) * khuudasniiKhemjee)
      .limit(khuudasniiKhemjee);
    let niitMur = await OrshinSuugch(kholbolt).countDocuments(
      body.query
    );
    
    let niitKhuudas =
      niitMur % khuudasniiKhemjee == 0
        ? Math.floor(niitMur / khuudasniiKhemjee)
        : Math.floor(niitMur / khuudasniiKhemjee) + 1;
    if (jagsaalt != null) {
      // Map tenant-specific data to top-level fields if found in toots array
      const targetBaiguullagiinId = String(body.query.baiguullagiinId || baiguullagiinId);
      
      jagsaalt.forEach((mur) => {
        mur.key = mur._id;
        
        // If query has baiguullagiinId, ensure the returned object reflects that organization's data
        if (targetBaiguullagiinId && Array.isArray(mur.toots)) {
          // Find the specific toot entry for this organization
          let matchingToot = null;
          
          if (mur.toots && mur.toots.length > 0) {
            matchingToot = mur.toots.find(t => 
              String(t.baiguullagiinId) === targetBaiguullagiinId
            );
          }
          
          // If found and it's different from the main record (or if main record is just different org)
          if (matchingToot) {
            // We found a specific entry for this org.
            // Check if we need to project it to top level (if top level is different org)
            if (String(mur.baiguullagiinId) !== targetBaiguullagiinId) {
              // Overwrite top-level fields with specific tenant data for display consistency
              if (matchingToot.toot) mur.toot = matchingToot.toot;
              if (matchingToot.davkhar) mur.davkhar = matchingToot.davkhar;
              if (matchingToot.orts) mur.orts = matchingToot.orts;
              if (matchingToot.duureg) mur.duureg = matchingToot.duureg;
              if (matchingToot.horoo) mur.horoo = matchingToot.horoo;
              if (matchingToot.soh) mur.soh = matchingToot.soh;
              if (matchingToot.bairniiNer) mur.bairniiNer = matchingToot.bairniiNer;
              // Also map IDs so deletions/updates work on the right context if relying on these
              mur.baiguullagiinId = matchingToot.baiguullagiinId;
              mur.barilgiinId = matchingToot.barilgiinId;
              
              // Add a flag to indicate this is a projected view from secondary record
              mur._isSecondaryView = true;
            }
          }
        }
      });
    }
    res.send({
      khuudasniiDugaar,
      khuudasniiKhemjee,
      jagsaalt,
      niitMur,
      niitKhuudas,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/orshinSuugch/:id", tokenShalgakh, async (req, res, next) => {
  try {
    // Residents MUST be in erunkhiiKholbolt
    let kholbolt = db.erunkhiiKholbolt;
    
    const result = await OrshinSuugch(kholbolt).findById(req.params.id);
    if (result != null) result.key = result._id;
    res.send(result);
  } catch (error) {
    next(error);
  }
});

router.post("/orshinSuugch", tokenShalgakh, async (req, res, next) => {
  try {
    const OrshinSuugchModel = OrshinSuugch(db.erunkhiiKholbolt);
    const result = new OrshinSuugchModel(req.body);
    await result.save();
    if (result != null) result.key = result._id;

    // --- AUTO CREATE CONTRACT & INVOICE (Like Excel Import) ---
    try {
      const { baiguullagiinId, barilgiinId } = req.body;
      if (baiguullagiinId && barilgiinId && db.kholboltuud) {
        const tukhainBaaziinKholbolt = db.kholboltuud.find(
          (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
        );

        if (tukhainBaaziinKholbolt) {
          const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(baiguullagiinId);
          const targetBarilga = baiguullaga?.barilguud?.find(b => String(b._id) === String(barilgiinId));

          if (baiguullaga && targetBarilga) {
            const GereeModel = Geree(tukhainBaaziinKholbolt);
            
            // Check if active contract already exists for this unit/resident
            let geree = await GereeModel.findOne({
              orshinSuugchId: result._id.toString(),
              barilgiinId: String(barilgiinId),
              toot: result.toot || req.body.toot,
              tuluv: { $ne: "Цуцалсан" }
            });

            if (!geree) {
              console.log(`📋 [AUTO-GEREE] Creating contract for ${result.ner} (Toot: ${result.toot || req.body.toot})`);
              
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
                barilgiinId: zardal.barilgiinId || String(barilgiinId) || "",
              }));

              const niitTulbur = ashiglaltiinZardluudData.reduce((total, zardal) => {
                const tariff = zardal.tariff || 0;
                const isLiftItem = zardal.zardliinTurul && zardal.zardliinTurul === "Лифт";
                if (isLiftItem && result.davkhar && choloolugdokhDavkhar.includes(result.davkhar)) {
                  return total;
                }
                return total + tariff;
              }, 0);

              const contractData = {
                gereeniiDugaar: `ГД-${Date.now().toString().slice(-8)}`,
                gereeniiOgnoo: new Date(),
                turul: "Үндсэн",
                tuluv: "Идэвхтэй",
                ovog: result.ovog || "",
                ner: result.ner,
                utas: Array.isArray(result.utas) ? result.utas : [result.utas],
                mail: result.mail || "",
                baiguullagiinId: baiguullaga._id,
                baiguullagiinNer: baiguullaga.ner,
                barilgiinId: String(barilgiinId),
                tulukhOgnoo: new Date(),
                ashiglaltiinZardal: niitTulbur,
                niitTulbur: niitTulbur,
                toot: result.toot || req.body.toot || "",
                davkhar: result.davkhar || "",
                bairNer: targetBarilga.ner || "",
                sukhBairshil: `${targetBarilga.tokhirgoo?.duuregNer || ""}, ${targetBarilga.tokhirgoo?.horoo?.ner || ""}, ${targetBarilga.tokhirgoo?.sohNer || ""}`,
                duureg: targetBarilga.tokhirgoo?.duuregNer || "",
                horoo: targetBarilga.tokhirgoo?.horoo || {},
                sohNer: targetBarilga.tokhirgoo?.sohNer || "",
                orts: result.orts || "",
                burtgesenAjiltan: req.body.nevtersenAjiltniiToken?.id,
                orshinSuugchId: result._id.toString(),
                temdeglel: "Вэбээс гар аргаар үүссэн гэрээ",
                actOgnoo: new Date(),
                baritsaaniiUldegdel: 0,
                ekhniiUldegdel: result.ekhniiUldegdel || 0,
                umnukhZaalt: result.tsahilgaaniiZaalt || 0,
                suuliinZaalt: result.tsahilgaaniiZaalt || 0,
                zardluud: zardluudArray,
                segmentuud: [],
                khungulultuud: [],
              };

              geree = new GereeModel(contractData);
              await geree.save();
              console.log(`✅ [AUTO-GEREE] Contract created: ${geree.gereeniiDugaar}`);

              // Update davkhar with toot if provided (sync building config)
              if (result.toot && result.davkhar) {
                const { updateDavkharWithToot } = require("../controller/orshinSuugch");
                await updateDavkharWithToot(
                  baiguullaga,
                  barilgiinId,
                  result.davkhar,
                  result.toot,
                  tukhainBaaziinKholbolt
                );
              }
              
            }

            // --- AUTO CREATE GUEST SETTINGS (OrshinSuugchMashin) ---
            // Moved OUTSIDE if(!geree) to ensure all new residents get settings
            try {
              const buildingSettings = targetBarilga?.tokhirgoo?.zochinTokhirgoo;
              const orgSettings = baiguullaga?.tokhirgoo?.zochinTokhirgoo;
              
              const defaultSettings = buildingSettings && buildingSettings.zochinUrikhEsekh !== undefined
                 ? buildingSettings 
                 : orgSettings;

              console.log("🔍 [AUTO-ZOCHIN] Checking defaults for:", result.ner);
              console.log("🔍 [AUTO-ZOCHIN] Final Defaults Found:", !!defaultSettings);

              if (defaultSettings) {
                 const OrshinSuugchMashin = require("../models/orshinSuugchMashin");
                 
                 // Check if settings already exist in central database
                 const existingSettings = await OrshinSuugchMashin(db.erunkhiiKholbolt).findOne({
                    orshinSuugchiinId: result._id.toString(),
                    zochinTurul: "Оршин суугч"
                 });
                 
                 if (!existingSettings) {
                    console.log(`📋 [AUTO-ZOCHIN] Creating settings for ${result.ner}. Quota: ${defaultSettings.zochinErkhiinToo}`);
                    
                    const OrshinSuugchMashinModel = OrshinSuugchMashin(db.erunkhiiKholbolt);
                    const newSettings = new OrshinSuugchMashinModel({
                        orshinSuugchiinId: result._id.toString(),
                        ezenToot: result.toot || req.body.toot || "",
                        zochinUrikhEsekh: defaultSettings.zochinUrikhEsekh !== false, 
                        zochinTurul: "Оршин суугч", 
                        zochinErkhiinToo: defaultSettings.zochinErkhiinToo || 0,
                        zochinTusBurUneguiMinut: defaultSettings.zochinTusBurUneguiMinut || 0,
                        zochinNiitUneguiMinut: defaultSettings.zochinNiitUneguiMinut || 0,
                        zochinTailbar: defaultSettings.zochinTailbar || "",
                        davtamjiinTurul: defaultSettings.davtamjiinTurul || "saraar",
                        davtamjUtga: defaultSettings.davtamjUtga
                    });
                    
                    await newSettings.save();
                    console.log(`✅ [AUTO-ZOCHIN] Settings created.`);
                 }
              }
            } catch (zochinErr) {
              console.error("❌ [AUTO-ZOCHIN] Error:", zochinErr.message);
            }

            // Always attempt to create initial invoice
            if (geree) {
              const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
                geree,
                baiguullaga,
                tukhainBaaziinKholbolt,
                "automataar"
              );
              if (invoiceResult.success) {
                console.log(`✅ [AUTO-INVOICE] Initial invoice created for ${result.ner}`);
              }
            }
          }
        }
      }
    } catch (autoErr) {
      console.error("❌ [AUTO-CONTRACT] Error:", autoErr.message);
      // Don't fail the main request if auto-contract fails
    }

    res.send(result);
  } catch (error) {
    next(error);
  }
});

router.put("/orshinSuugch/:id", tokenShalgakh, async (req, res, next) => {
  try {
    delete req.body.nevtersenAjiltniiToken;
    delete req.body.erunkhiiKholbolt;
    delete req.body.tukhainBaaziinKholbolt;

    const result = await OrshinSuugch(db.erunkhiiKholbolt).findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (result != null) {
      result.key = result._id;
      
      if (result.baiguullagiinId) {
        const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(result.baiguullagiinId);
        
        if (baiguullaga) {
          const tukhainBaaziinKholbolt = db.kholboltuud.find(
            (kholbolt) => kholbolt.baiguullagiinId === baiguullaga._id.toString()
          );
          
          if (tukhainBaaziinKholbolt) {
            const GereeModel = Geree(tukhainBaaziinKholbolt);
            
            const gereeUpdateData = {};
            
            if (req.body.ner !== undefined) gereeUpdateData.ner = req.body.ner;
            if (req.body.ovog !== undefined) gereeUpdateData.ovog = req.body.ovog;
            if (req.body.register !== undefined) gereeUpdateData.register = req.body.register;
            if (req.body.mail !== undefined) gereeUpdateData.mail = req.body.mail;
            
            if (req.body.utas !== undefined) {
              gereeUpdateData.utas = Array.isArray(req.body.utas) 
                ? req.body.utas 
                : [req.body.utas];
            }
            
            if (req.body.toot !== undefined) gereeUpdateData.toot = req.body.toot;
            if (req.body.davkhar !== undefined) gereeUpdateData.davkhar = req.body.davkhar;
            if (req.body.orts !== undefined) gereeUpdateData.orts = req.body.orts;
            
            // Building information
            if (req.body.barilgiinId !== undefined) gereeUpdateData.barilgiinId = req.body.barilgiinId;
            if (req.body.bairniiNer !== undefined) gereeUpdateData.bairNer = req.body.bairniiNer;
            
            // Organization information
            if (req.body.baiguullagiinId !== undefined) {
              gereeUpdateData.baiguullagiinId = req.body.baiguullagiinId;
            }
            if (req.body.baiguullagiinNer !== undefined) {
              gereeUpdateData.baiguullagiinNer = req.body.baiguullagiinNer;
            }
            
            // Address location details
            if (req.body.duureg !== undefined) gereeUpdateData.duureg = req.body.duureg;
            if (req.body.horoo !== undefined) gereeUpdateData.horoo = req.body.horoo;
            if (req.body.soh !== undefined) gereeUpdateData.sohNer = req.body.soh;
            
            // Build full address string (sukhBairshil) if any address component changed
            const addressChanged = req.body.duureg !== undefined || 
                                  req.body.horoo !== undefined || 
                                  req.body.soh !== undefined;
            
            if (addressChanged) {
              const duuregVal = req.body.duureg || result.duureg || "";
              const horooVal = req.body.horoo || result.horoo || "";
              const sohVal = req.body.soh || result.soh || "";
              
              const horooNer = typeof horooVal === 'object' && horooVal.ner 
                ? horooVal.ner 
                : (typeof horooVal === 'string' ? horooVal : "");
              
              gereeUpdateData.sukhBairshil = `${duuregVal}, ${horooNer}, ${sohVal}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim();
            }
            
            if (req.body.ekhniiUldegdel !== undefined) {
              gereeUpdateData.ekhniiUldegdel = parseFloat(req.body.ekhniiUldegdel) || 0;
            }
            
            if (req.body.tsahilgaaniiZaalt !== undefined) {
              const zaalt = parseFloat(req.body.tsahilgaaniiZaalt) || 0;
              gereeUpdateData.suuliinZaalt = zaalt;
              gereeUpdateData.umnukhZaalt = zaalt;
            }
            
            if (Object.keys(gereeUpdateData).length > 0) {
              await GereeModel.updateMany(
                {
                  orshinSuugchId: result._id.toString(),
                  tuluv: "Идэвхтэй"
                },
                { $set: gereeUpdateData }
              );
            }
          }
        }
      }
    }
    
    res.send(result);
  } catch (error) {
    console.error("❌ [UPDATE] Error updating orshinSuugch/geree:", error.message);
    next(error);
  }
});

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);
crud(router, "backTuukh", BackTuukh, UstsanBarimt);
crud(router, "session", session, UstsanBarimt);

router.route("/orshinSuugchNevtrey").post(orshinSuugchNevtrey);
router.route("/orshinSuugchBurtgey").post(orshinSuugchBurtgey);
router.route("/walletBurtgey").post(walletBurtgey);
router.route("/walletBillingHavakh").post(tokenShalgakh, walletBillingHavakh);
router.route("/walletAddress/city").get(walletAddressCities);
router.route("/walletAddress/district/:cityId").get(walletAddressDistricts);
router.route("/walletAddress/khoroo/:districtId").get(walletAddressKhoroo);
router.route("/walletAddress/bair/:khorooId").get(walletAddressBair);
router.route("/tokenoorOrshinSuugchAvya").post(tokenoorOrshinSuugchAvya);
router.route("/nuutsUgShalgakhOrshinSuugch").post(nuutsUgShalgakhOrshinSuugch);
router
  .route("/khayagaarBaiguullagaAvya/:duureg/:horoo/:soh")
  .get(khayagaarBaiguullagaAvya);

// router.post("/dugaarBatalgaajuulya", dugaarBatalgaajuulya); 
// router.post("/dugaarBatalgaajuulakh", dugaarBatalgaajuulakh); 

router.post("/orshinSuugchBatalgaajuulya", orshinSuugchBatalgaajuulya);
router.post("/utasBatalgaajuulakhLogin", utasBatalgaajuulakhLogin);
router.post("/nuutsUgSergeeye", nuutsUgSergeeye);
router.post(
  "/orshinSuugchNuutsUgSoliyo",
  tokenShalgakh,
  orshinSuugchiinNuutsUgSoliyo
);
router.post("/davhardsanOrshinSuugchShalgayy", davhardsanOrshinSuugchShalgayy);
router.post("/tootShalgaya", tootShalgaya);
router.post("/validateOwnOrgToot", validateOwnOrgToot);

// Excel template download
router.get("/orshinSuugchExcelTemplate", tokenShalgakh, generateExcelTemplate);

// Excel import (with file upload)
router.post(
  "/orshinSuugchExcelImport",
  tokenShalgakh,
  upload.single("excelFile"),
  importUsersFromExcel
);

// Excel download service - generic list download
router.post("/downloadExcelList", tokenShalgakh, downloadOrshinSuugchExcel);

router.get("/orshinSuugchiiZuragAvya/:baiguullaga/:ner", (req, res, next) => {
  const fileName = req.params.ner;
  const directoryPath = "zurag/orshinSuugch/" + req.params.baiguullaga + "/";
  res.download(directoryPath + fileName, fileName, (err) => {
    if (err) {
      next(err);
    }
  });
});

router.get("/ustsanBarimt", tokenShalgakh, async (req, res, next) => {
  try {
    const body = req.query;
    const {
      query = {},
      order,
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 10,
      search,
      collation = {},
      select = {},
    } = body;
    if (!!body?.query) body.query = JSON.parse(body.query);
    if (req.body.baiguullagiinId) {
      if (!body.query) body.query = {};
      body.query["baiguullagiinId"] = req.body.baiguullagiinId;
    }
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.select) body.select = JSON.parse(body.select);
    if (!!body?.collation) body.collation = JSON.parse(body.collation);
    if (!!body?.khuudasniiDugaar)
      body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
    if (!!body?.khuudasniiKhemjee)
      body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);
    let jagsaalt = await UstsanBarimt(req.body.tukhainBaaziinKholbolt)
      .find(body.query)
      .sort(body.order)
      .collation(body.collation ? body.collation : {})
      .skip((body.khuudasniiDugaar - 1) * body.khuudasniiKhemjee)
      .limit(body.khuudasniiKhemjee);
    let niitMur = await UstsanBarimt(
      req.body.tukhainBaaziinKholbolt
    ).countDocuments(body.query);
    let niitKhuudas =
      niitMur % khuudasniiKhemjee == 0
        ? Math.floor(niitMur / khuudasniiKhemjee)
        : Math.floor(niitMur / khuudasniiKhemjee) + 1;
    if (jagsaalt != null) jagsaalt.forEach((mur) => (mur.key = mur._id));
    res.send({
      khuudasniiDugaar,
      khuudasniiKhemjee,
      jagsaalt,
      niitMur,
      niitKhuudas,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/orshinSuugchdTokenOnooyo", tokenShalgakh, (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    let filter = {
      _id: req.body.id,
    };
    let update = {
      firebaseToken: req.body.token,
    };
    OrshinSuugch(db.erunkhiiKholbolt)
      .updateOne(filter, update)
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

/**
 * POST /orshinSuugch/oorooUstgakh - Self-delete orshinSuugch and all related data
 * Requires password in request body for verification
 * This endpoint allows an orshinSuugch to delete themselves and removes all traces:
 * - geree (invoices/contracts where orshinSuugchId matches)
 * - nekhemjlekhiinTuukh (invoice history related to deleted gerees)
 * - nevtreltiinTuukh (login history)
 */
router.post(
  "/orshinSuugch/oorooUstgakh",
  tokenShalgakh,
  orshinSuugchOorooUstgakh
);

// Create invoice for specific orshinSuugch
router.post(
  "/orshinSuugch/:orshinSuugchId/nekhemjlekhUusgekh",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      const { db } = require("zevbackv2");
      const Geree = require("../models/geree");
      const Baiguullaga = require("../models/baiguullaga");
      const {
        gereeNeesNekhemjlekhUusgekh,
      } = require("../controller/nekhemjlekhController");

      const { orshinSuugchId } = req.params;
      const { baiguullagiinId } = req.body;

      if (!baiguullagiinId) {
        return res.status(400).json({
          success: false,
          aldaa: "baiguullagiinId шаардлагатай",
        });
      }

      // Find the connection
      const kholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
      );

      if (!kholbolt) {
        return res.status(404).json({
          success: false,
          aldaa: "Холболтын мэдээлэл олдсонгүй!",
        });
      }

      // Find orshinSuugch
      const orshinSuugch = await OrshinSuugch(db.erunkhiiKholbolt).findById(
        orshinSuugchId
      );
      if (!orshinSuugch) {
        return res.status(404).json({
          success: false,
          aldaa: "Оршин суугч олдсонгүй!",
        });
      }

      // Find geree for this orshinSuugch
      const geree = await Geree(kholbolt)
        .findOne({
          orshinSuugchId: orshinSuugchId,
          baiguullagiinId: baiguullagiinId,
          tuluv: "Идэвхтэй", // Only active contracts
        })
        .sort({ createdAt: -1 }); // Get the most recent contract

      if (!geree) {
        return res.status(404).json({
          success: false,
          aldaa: "Идэвхтэй гэрээ олдсонгүй!",
        });
      }

      // Get baiguullaga
      const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
        baiguullagiinId
      );
      if (!baiguullaga) {
        return res.status(404).json({
          success: false,
          aldaa: "Байгууллага олдсонгүй!",
        });
      }

      // Create invoice - force creation by passing skipDuplicateCheck flag
      // This endpoint should always create a new invoice, ignoring duplicate checks
      // NOTE: includeEkhniiUldegdel = false because manual invoice creation should NOT include ekhniiUldegdel
      // ekhniiUldegdel should ONLY come from Excel import or TransactionModal
      const invoiceResult = await gereeNeesNekhemjlekhUusgekh(
        geree,
        baiguullaga,
        kholbolt,
        "garan",
        true,  // skipDuplicateCheck = true
        false  // includeEkhniiUldegdel = false
      );

      if (!invoiceResult.success) {
        return res.status(400).json({
          success: false,
          aldaa: invoiceResult.error || "Нэхэмжлэх үүсгэхэд алдаа гарлаа",
        });
      }

      res.json({
        success: true,
        data: invoiceResult.nekhemjlekh,
        gereeniiId: invoiceResult.gereeniiId,
        gereeniiDugaar: invoiceResult.gereeniiDugaar,
        tulbur: invoiceResult.tulbur,
        alreadyExists: invoiceResult.alreadyExists || false,
      });
    } catch (error) {
      console.error("Error creating invoice for orshinSuugch:", error);
      next(error);
    }
  }
);

module.exports = router;
