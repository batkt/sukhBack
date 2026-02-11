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
 * Same formula as gereeRoute zaaltOlnoorOruulya / turees: zoruu * urjver * guidliinKoeff, chadal, tsekh, sekhDemjikh.
 * Body: baiguullagiinId, barilgiinId (optional), umnukhZaalt, suuliinZaalt, guidliinKoeff.
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
    const isTsakhilgaan = (z) =>
      z.zaalt === true ||
      z.turul === "кВт" ||
      (z.turul && String(z.turul).trim().toLowerCase() === "квт") ||
      (z.ner && String(z.ner).toLowerCase().includes("цахилгаан"));
    const candidates = zardluud.filter(isTsakhilgaan);
    // Prefer zaalt:true; then prefer the one with suuriKhuraamj or tariff so we get a non-zero amount when applicable
    const ashiglaltiinZardal = candidates.length === 0
      ? null
      : candidates.sort((a, b) => {
          const score = (z) => (z.zaalt ? 1000 : 0) + (Number(z.suuriKhuraamj) || 0) + (Number(z.tariff) || 0) * 10;
          return score(b) - score(a);
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
    const suuliinZaaltNum =
      typeof suuliinZaaltRaw === "number"
        ? suuliinZaaltRaw
        : parseFloat(String(suuliinZaaltRaw || "").replace(/,/g, "").trim()) || 0;
    const guidliinKoeffNum =
      typeof guidliinKoeffRaw === "number"
        ? guidliinKoeffRaw
        : parseFloat(String(guidliinKoeffRaw || "").replace(/,/g, "").trim()) || 1;

    const zoruuDun = suuliinZaaltNum - umnukhZaaltNum;
    let tsakhilgaanDun = 0;
    let tsakhilgaanKBTST = 0;
    let chadalDun = 0;
    let tsekhDun = 0;
    let sekhDemjikhTulburDun = 0;
    const tokhirgoo = baiguullaga.tokhirgoo || {};
    const guidelBuchiltKhonogEsekh = tokhirgoo.guidelBuchiltKhonogEsekh === true;
    const bichiltKhonog = tokhirgoo.bichiltKhonog || 0;
    const sekhDemjikhTulburAvakhEsekh = tokhirgoo.sekhDemjikhTulburAvakhEsekh === true;

    if (guidelBuchiltKhonogEsekh) {
      tsakhilgaanKBTST =
        zoruuDun *
        (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
        guidliinKoeffNum;
      chadalDun =
        bichiltKhonog > 0 && tsakhilgaanKBTST > 0
          ? (tsakhilgaanKBTST / bichiltKhonog / 12) *
            (String(baiguullagiinId) === "679aea9032299b7ba8462a77" ? 11520 : 15500)
          : 0;
      tsekhDun = (ashiglaltiinZardal.tariff || 0) * tsakhilgaanKBTST;
      if (sekhDemjikhTulburAvakhEsekh) {
        sekhDemjikhTulburDun =
          zoruuDun * (ashiglaltiinZardal.tsakhilgaanUrjver || 1) * 23.79;
        tsakhilgaanDun = chadalDun + tsekhDun + sekhDemjikhTulburDun;
      } else {
        tsakhilgaanDun = chadalDun + tsekhDun;
      }
    } else {
      tsakhilgaanDun =
        (ashiglaltiinZardal.tariff || 0) *
        (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
        (zoruuDun || 0);
    }

    const suuriKhuraamj = Number(ashiglaltiinZardal.suuriKhuraamj) || 0;
    const niitDun = suuriKhuraamj + tsakhilgaanDun;

    res.send({
      success: true,
      niitDun: Math.round(niitDun),
      suuriKhuraamj,
      tsakhilgaanKBTST,
      chadalDun,
      tsekhDun,
      sekhDemjikhTulburDun,
      zoruuDun,
      tailbar: ashiglaltiinZardal.ner || "Цахилгаан",
      _received: { umnukhZaaltNum, suuliinZaaltNum, guidliinKoeffNum },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
