const express = require("express");
const router = express.Router();
const { tokenShalgakh, crud, UstsanBarimt } = require("zevbackv2");
const mongoose = require("mongoose");
const ashiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
const Baiguullaga = require("../models/baiguullaga");
const OrshinSuugch = require("../models/orshinSuugch");
const Geree = require("../models/geree");

// CRUD routes
crud(router, "ashiglaltiinZardluud", ashiglaltiinZardluud, UstsanBarimt);

// GET route with turul filter
router.get("/ashiglaltiinZardluudAvya", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, barilgiinId, turul } = req.query;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    // Get database connection for this organization
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).send({
        success: false,
        message: "Organization connection not found",
      });
    }

    // Build query filter
    const filter = { baiguullagiinId: baiguullagiinId };

    if (barilgiinId) {
      filter.barilgiinId = barilgiinId;
    }

    // Filter by turul if provided (Дурын or Тогтмол)
    if (turul) {
      filter.turul = turul;
    }

    const zardluud = await ashiglaltiinZardluud(tukhainBaaziinKholbolt).find(
      filter
    );

    res.send({
      success: true,
      data: zardluud,
    });
  } catch (err) {
    next(err);
  }
});

// POST route to create new ashiglaltiinZardluud
router.post("/ashiglaltiinZardluudNemekh", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { baiguullagiinId, ner, turul } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    if (!ner || !turul) {
      return res.status(400).send({
        success: false,
        message: "ner and turul are required",
      });
    }

    // Get database connection for this organization
    const tukhainBaaziinKholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!tukhainBaaziinKholbolt) {
      return res.status(404).send({
        success: false,
        message: "Organization connection not found",
      });
    }

    // Create new ashiglaltiinZardluud
    const newZardal = new (ashiglaltiinZardluud(tukhainBaaziinKholbolt))(
      req.body
    );

    await newZardal.save();

    res.send({
      success: true,
      message: "Ашиглалтын зардал амжилттай нэмэгдлээ",
      data: newZardal,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tsakhilgaanTootsool – calculate electricity (цахилгаан) amount from meter readings.
 * Formula: usageDun = zoruuDun * guidliinKoeff; niitDun = usageDun [+ suuriKhuraamj if includeSuuriKhuraamj].
 * Body: baiguullagiinId, barilgiinId (optional), umnukhZaalt, suuliinZaalt, guidliinKoeff, includeSuuriKhuraamj (optional boolean).
 */
router.post("/tsakhilgaanTootsool", tokenShalgakh, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const baiguullagiinId = req.body.baiguullagiinId;
    const barilgiinId = req.body.barilgiinId;
    const residentId = req.body.residentId;
    const gereeniiId = req.body.gereeniiId;
    // Support both camelCase and snake_case; accept number or string
    const umnukhZaaltRaw =
      req.body.umnukhZaalt ??
      req.body.umnukh_zaalt ??
      req.body.omnohZaalt;
    const suuliinZaaltRaw =
      req.body.suuliinZaalt ??
      req.body.suuliin_zaalt;
    const guidliinKoeffRaw =
      req.body.guidliinKoeff ??
      req.body.guidliin_koeff;
    const includeSuuriKhuraamj = req.body.includeSuuriKhuraamj === true ||
      req.body.includeSuuriKhuraamj === "true" ||
      req.body.includeSuuriKhuraamj === 1 ||
      req.body.includeSuuriKhuraamj === "1" ||
      req.body.includeSuuriKhuraamj === undefined;

    if (!baiguullagiinId) {
      return res.status(400).send({
        success: false,
        message: "baiguullagiinId is required",
      });
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      baiguullagiinId
    );
    if (!baiguullaga || !baiguullaga.barilguud || !baiguullaga.barilguud.length) {
      return res.status(404).send({
        success: false,
        message: "Baiguullaga or barilguud not found",
      });
    }

    const targetBarilga = barilgiinId
      ? baiguullaga.barilguud.find(
        (b) => String(b._id) === String(barilgiinId)
      )
      : baiguullaga.barilguud[0];
    if (!targetBarilga || !targetBarilga.tokhirgoo) {
      return res.status(404).send({
        success: false,
        message: "Barilga or tokhirgoo not found",
      });
    }

    const zardluud = targetBarilga.tokhirgoo.ashiglaltiinZardluud || [];
    const isTsakhilgaan = (z) => {
      const name = (z.ner || "").trim().toLowerCase();
      // Must contain "цахилгаан" and NOT "шат"
      const hasElec = name.includes("цахилгаан");
      const isNotElevator = !name.includes("шат");

      // Exclude shared/common area terms
      const isNotShared = !name.includes("дундын") &&
        !name.includes("нийтийн") &&
        !name.includes("ерөнхий") &&
        !name.includes("гадна") &&
        !name.includes("гэрэлтүүлэг");

      return hasElec && isNotElevator && isNotShared;
    };
    const candidates = zardluud.filter(isTsakhilgaan);
    if (candidates.length === 0) {
      console.warn(`[CALC] No electricity candidate found for organization ${baiguullagiinId}`);
      return res.status(400).send({
        success: false,
        message: "Цахилгаан (кВт) ашиглалтын зардал олдсонгүй",
      });
    }

    // Aggregate values across ALL valid candidates
    let maxTariff = 0;
    let maxSuuriKhuraamj = 0;
    let selectedChargeName = "";
    let bestScore = -Infinity;

    console.log(`[CALC] Aggregating from ${candidates.length} candidates:`);
    candidates.forEach(c => {
      const tariffVal = Number(c.tariff) || Number(c.zaaltTariff) || 0;
      const suuriVal = Number(c.suuriKhuraamj) || 0;

      if (tariffVal > maxTariff) maxTariff = tariffVal;
      if (suuriVal > maxSuuriKhuraamj) maxSuuriKhuraamj = suuriVal;

      // Determine "selectedChargeName" based on the highest quality candidate
      const name = (c.ner || "").trim().toLowerCase();
      const isMeter = c.zaalt ? 10000000 : 0;
      const isExact = (name === "цахилгаан" || name === "цахилгаан квт" || name === "цахилгаан кв") ? 1000000 : 0;
      const hasValue = (tariffVal > 0 || suuriVal > 0) ? 2000000 : -5000000;
      const currentScore = isMeter + isExact + hasValue;

      if (currentScore > bestScore) {
        bestScore = currentScore;
        selectedChargeName = c.ner;
      }
      console.log(`  - Option "${c.ner}": tariff=${tariffVal}, suuri=${suuriVal}, score=${currentScore}`);
    });

    console.log(`[CALC] Aggregated Results: tariff=${maxTariff}, suuri=${maxSuuriKhuraamj}, selected=${selectedChargeName}`);

    // Check for Resident or Contract-specific tariff
    let finalTariff = maxTariff;
    let residentSpecificUsed = false;
    let tariffSource = "Global";
    let debugInfo = {
      residentIdPassed: residentId,
      gereeniiIdPassed: gereeniiId,
      maxTariffAggregated: maxTariff
    };

    if (residentId || gereeniiId) {
      const tukhainBaaziinKholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
      );

      if (tukhainBaaziinKholbolt) {
        debugInfo.orgKholboltFound = true;
        debugInfo.orgDbBaiguullagiinId = tukhainBaaziinKholbolt.baiguullagiinId;

        let actualResidentId = residentId;
        let contractObj = null;

        // 1. If we have gereeniiId but no residentId, find the residentId from the contract
        if (!actualResidentId && gereeniiId) {
          try {
            contractObj = await Geree(tukhainBaaziinKholbolt).findById(gereeniiId);
            if (contractObj) {
              debugInfo.contractFound = true;
              debugInfo.contractGereeniiDugaar = contractObj.gereeniiDugaar;
              debugInfo.contractOrshinSuugchId = contractObj.orshinSuugchId;

              if (contractObj.orshinSuugchId) {
                actualResidentId = contractObj.orshinSuugchId;
                console.log(`[CALC] Found residentId "${actualResidentId}" from contract "${contractObj.gereeniiDugaar}"`);
              } else {
                // Secondary fallback: Match by Toot
                console.log(`[CALC] No orshinSuugchId on contract. Searching by toot "${contractObj.toot}"`);
                const potentialRes = await OrshinSuugch(tukhainBaaziinKholbolt).findOne({
                  toot: contractObj.toot,
                  baiguullagiinId: baiguullagiinId
                });
                if (potentialRes) {
                  actualResidentId = potentialRes._id;
                  debugInfo.residentFoundByToot = true;
                  console.log(`[CALC] Reverse lookup SUCCESS: Found resident "${potentialRes.ner}" (ID: ${actualResidentId})`);
                }
              }
            }
          } catch (e) {
            console.error("[CALC] Contract lookup/reverse error:", e.message);
          }
        }

        // 2. Lookup Resident and their tsahilgaaniiZaalt (Highest Priority)
        // CRITICAL: Residents are stored in central erunkhiiKholbolt, not tenant DB
        if (actualResidentId) {
          try {
            const OrshinSuugchModel = OrshinSuugch(db.erunkhiiKholbolt);
            let resident = null;

            // Try findById first (casting to ObjectId if possible)
            try {
              if (mongoose.Types.ObjectId.isValid(actualResidentId)) {
                resident = await OrshinSuugchModel.findById(new mongoose.Types.ObjectId(actualResidentId));
              }
              if (!resident) {
                resident = await OrshinSuugchModel.findById(actualResidentId);
              }
            } catch (oidErr) {
              console.log("[CALC] findById failed, trying findOne string ID");
            }

            // Fallback to findOne by _id or id string
            if (!resident) {
              resident = await OrshinSuugchModel.findOne({
                $or: [{ _id: actualResidentId }, { id: actualResidentId }]
              });
            }

            if (resident) {
              debugInfo.residentFound = true;
              debugInfo.residentNer = resident.ner;
              debugInfo.residentTsahilgaaniiZaalt = resident.tsahilgaaniiZaalt;

              console.log(`[CALC] Checking resident "${resident.ner}" (ID: ${resident._id}) for tariff...`);
              const resTariff = Number(resident.tsahilgaaniiZaalt);
              if (resTariff > 0 && resTariff < 1000) {
                finalTariff = resTariff;
                residentSpecificUsed = true;
                tariffSource = "Resident (tsahilgaaniiZaalt)";
                console.log(`[CALC] SUCCESS: Using ${tariffSource}: ${finalTariff}`);
              } else {
                console.log(`[CALC] Resident found but tsahilgaaniiZaalt is ${resTariff} (invalid)`);
              }
            } else {
              console.warn(`[CALC] Resident not found for ID: ${actualResidentId} in central DB`);
              debugInfo.residentNotFound = true;

              // Verify connection by finding ANY resident in this org (in central DB)
              const anyResident = await OrshinSuugchModel.findOne({ baiguullagiinId: baiguullagiinId });
              if (anyResident) {
                debugInfo.anyResidentFoundInCentralOrg = anyResident.ner;
              } else {
                debugInfo.noResidentsFoundInCentralOrgAtAll = true;
              }
            }
          } catch (e) {
            console.error("[CALC] Resident lookup error:", e.message);
            debugInfo.lookupError = e.message;
          }
        }

        // 3. Fallback: Check Contract's specific zardluud if resident tariff still not found
        if (!residentSpecificUsed) {
          const geree = contractObj || (gereeniiId ? await Geree(tukhainBaaziinKholbolt).findById(gereeniiId).catch(() => null) : null);
          if (geree) {
            const contractElec = (geree.zardluud || []).find(z => {
              const name = (z.ner || "").trim().toLowerCase();
              return name.includes("цахилгаан") && !name.includes("шат");
            });
            if (contractElec && contractElec.tariff > 0) {
              finalTariff = contractElec.tariff;
              tariffSource = "Contract (Zardluud)";
              console.log(`[CALC] FALLBACK: Using ${tariffSource}: ${finalTariff}`);
            } else {
              debugInfo.contractElecNotFound = true;
            }
          }
        }
      }
    }

    const umnukhZaaltNum =
      typeof umnukhZaaltRaw === "number"
        ? umnukhZaaltRaw
        : parseFloat(String(umnukhZaaltRaw || "").replace(/,/g, "").trim()) || 0;

    // Split readings: Odor (Day) and Shono (Night)
    const odorZaaltRaw = req.body.odorZaalt ?? req.body.odor_zaalt;
    const shonoZaaltRaw = req.body.shonoZaalt ?? req.body.shono_zaalt;

    const odorZaaltNum =
      typeof odorZaaltRaw === "number"
        ? odorZaaltRaw
        : parseFloat(String(odorZaaltRaw || "").replace(/,/g, "").trim()) || 0;
    const shonoZaaltNum =
      typeof shonoZaaltRaw === "number"
        ? shonoZaaltRaw
        : parseFloat(String(shonoZaaltRaw || "").replace(/,/g, "").trim()) || 0;

    // If both Odor and Shono are provided, suuliinZaalt is their sum
    const suuliinZaaltNum = (odorZaaltRaw != null || shonoZaaltRaw != null)
      ? odorZaaltNum + shonoZaaltNum
      : (typeof suuliinZaaltRaw === "number"
        ? suuliinZaaltRaw
        : parseFloat(String(suuliinZaaltRaw || "").replace(/,/g, "").trim()) || 0);

    const guidliinKoeffNum =
      typeof guidliinKoeffRaw === "number"
        ? guidliinKoeffRaw
        : parseFloat(String(guidliinKoeffRaw || "").replace(/,/g, "").trim()) || 1;

    // Use aggregated/resident values
    const targetTariff = finalTariff;
    const zoruu = Math.abs(suuliinZaaltNum - umnukhZaaltNum);
    const usageAmount = zoruu * targetTariff * guidliinKoeffNum;
    const suuriKhuraamj = maxSuuriKhuraamj;
    const niitDun = includeSuuriKhuraamj ? usageAmount + suuriKhuraamj : usageAmount;

    console.log(`[CALC] Final calculation results:`, {
      umnukh: umnukhZaaltNum,
      suuliin: suuliinZaaltNum,
      zoruu,
      tariff: targetTariff,
      coeff: guidliinKoeffNum,
      usage: usageAmount,
      suuri: includeSuuriKhuraamj ? suuriKhuraamj : 0,
      total: niitDun
    });

    res.send({
      success: true,
      niitDun: Math.round(niitDun * 100) / 100,
      usageAmount: Math.round(usageAmount * 100) / 100,
      suuriKhuraamj,
      zoruu: Math.round(zoruu * 100) / 100,
      odorZaaltNum,
      shonoZaaltNum,
      suuliinZaaltNum,
      tariff: targetTariff,
      tariffSource,
      isResidentTariff: residentSpecificUsed,
      selectedCharge: selectedChargeName || "None",
      _received: { umnukhZaaltNum, odorZaaltNum, shonoZaaltNum, suuliinZaaltNum, guidliinKoeffNum, includeSuuriKhuraamj },
      _debug: debugInfo
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
