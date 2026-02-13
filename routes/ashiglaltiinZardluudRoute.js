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
    const includeSuuriKhuraamj = req.body.includeSuuriKhuraamj === true || req.body.includeSuuriKhuraamj === "true";

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
      const name = (z.ner || "").trim();
      const isElecName = name === "Цахилгаан" || name === "Цахилгаан кВт";
      const isNotElevator = !name.toLowerCase().includes("шат");
      return isElecName && isNotElevator;
    };
    const candidates = zardluud.filter(isTsakhilgaan);
    // Prefer zaalt:true; then prefer the one with suuriKhuraamj or tariff so we get a non-zero amount when applicable
    const ashiglaltiinZardal = candidates.length === 0
      ? null
      : candidates.sort((a, b) => {
        // Prioritize zaalt:true (meter-based) heavily, then specific name match, then exclude "шат" (elevator)
        const isMeter = a.zaalt ? 1000000 : 0;
        const isMeterB = b.zaalt ? 1000000 : 0;
        const isExact = (a.ner && a.ner.trim() === "Цахилгаан") ? 100000 : 0;
        const isExactB = (b.ner && b.ner.trim() === "Цахилгаан") ? 100000 : 0;
        const isShat = (a.ner && a.ner.toLowerCase().includes("шат")) ? -500000 : 0;
        const isShatB = (b.ner && b.ner.toLowerCase().includes("шат")) ? -500000 : 0;

        const scoreA = isMeter + isExact + isShat + (Number(a.tariff) || 0);
        const scoreB = isMeterB + isExactB + isShatB + (Number(b.tariff) || 0);
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

    res.send({
      success: true,
      niitDun: Math.round(niitDun * 100) / 100,
      usageAmount: Math.round(usageAmount * 100) / 100,
      suuriKhuraamj,
      zoruu: Math.round(zoruu * 100) / 100,
      odorZaaltNum,
      shonoZaaltNum,
      suuliinZaaltNum,
      tariff: ashiglaltiinZardal.tariff || ashiglaltiinZardal.zaaltTariff || 0,
      tailbar: ashiglaltiinZardal.ner || "Цахилгаан",
      _received: { umnukhZaaltNum, odorZaaltNum, shonoZaaltNum, suuliinZaaltNum, guidliinKoeffNum, includeSuuriKhuraamj },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
