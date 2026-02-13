const express = require("express");
const router = express.Router();
const { tokenShalgakh, crud, UstsanBarimt } = require("zevbackv2");
const ashiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
const Baiguullaga = require("../models/baiguullaga");

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
    // Priority: 1. Meter-based, 2. Exact name, 3. Non-zero tariff
    const ashiglaltiinZardal = candidates.length === 0
      ? null
      : candidates.sort((a, b) => {
        const nameA = (a.ner || "").trim().toLowerCase();
        const nameB = (b.ner || "").trim().toLowerCase();

        // Meter-based is TOP priority
        const isMeterA = a.zaalt ? 10000000 : 0;
        const isMeterB = b.zaalt ? 10000000 : 0;

        // Exact name match
        const isExactA = (nameA === "цахилгаан" || nameA === "цахилгаан квт" || nameA === "цахилгаан кв") ? 1000000 : 0;
        const isExactB = (nameB === "цахилгаан" || nameB === "цахилгаан квт" || nameB === "цахилгаан кв") ? 1000000 : 0;

        // Value presence check (Tariff OR Base Fee)
        const tariffValA = Number(a.tariff) || Number(a.zaaltTariff) || 0;
        const tariffValB = Number(b.tariff) || Number(b.zaaltTariff) || 0;
        const baseFeeA = Number(a.suuriKhuraamj) || 0;
        const baseFeeB = Number(b.suuriKhuraamj) || 0;

        const hasValueA = (tariffValA > 0 || baseFeeA > 0) ? 2000000 : -5000000;
        const hasValueB = (tariffValB > 0 || baseFeeB > 0) ? 2000000 : -5000000;

        const scoreA = isMeterA + isExactA + hasValueA + tariffValA / 1000 + baseFeeA / 10000;
        const scoreB = isMeterB + isExactB + hasValueB + tariffValB / 1000 + baseFeeB / 10000;

        console.log(`  - Option "${a.ner}": score=${scoreA}, meter=${!!a.zaalt}, tariff=${tariffValA}, baseFee=${baseFeeA}, exact=${isExactA > 0}`);
        return scoreB - scoreA;
      })[0];

    if (!ashiglaltiinZardal) {
      return res.status(400).send({
        success: false,
        message: "Цахилгаан (кВт) ашиглалтын зардал олдсонгүй",
      });
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

    // Use absolute difference to handle prepaid logic or swapped fields
    const targetTariff = ashiglaltiinZardal.zaaltTariff || ashiglaltiinZardal.tariff || 0;
    const zoruu = Math.abs(suuliinZaaltNum - umnukhZaaltNum);
    const usageAmount = zoruu * targetTariff * guidliinKoeffNum;
    const suuriKhuraamj = Number(ashiglaltiinZardal.suuriKhuraamj) || 0;
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
      selectedCharge: ashiglaltiinZardal ? ashiglaltiinZardal.ner : "None",
      _received: { umnukhZaaltNum, odorZaaltNum, shonoZaaltNum, suuliinZaaltNum, guidliinKoeffNum, includeSuuriKhuraamj },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
