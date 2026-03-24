const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const {
  downloadNekhemjlekhiinTuukhExcel,
} = require("../controller/excelImportController");
const {
  previewInvoice,
  manualSendInvoice,
  manualSendMassInvoices,
  manualSendSelectedInvoices,
  deleteInvoiceZardal,
  recalculateGereeBalance,
  deleteInvoice,
} = require("../controller/nekhemjlekhController");
const { markInvoicesAsPaid } = require("../services/invoicePaymentService");
const Geree = require("../models/geree");
const Baiguullaga = require("../models/baiguullaga");
const { db } = require("zevbackv2");

router.post(
  "/nekhemjlekhiinTuukhExcelDownload",
  tokenShalgakh,
  downloadNekhemjlekhiinTuukhExcel,
);

// Emit tulburUpdated on delete of invoices so web clients refresh
router.use((req, res, next) => {
  const isInvoiceDelete =
    (req.method === "DELETE" ||
      (req.method === "POST" && req.path?.includes("delete"))) &&
    req.path?.includes("nekhemjlekhiinTuukh");
  if (!isInvoiceDelete) return next();
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const baiguullagiinId =
      req.query?.baiguullagiinId || req.body?.baiguullagiinId;
    if (baiguullagiinId && req.app) {
      try {
        req.app.get("socketio").emit(`tulburUpdated:${baiguullagiinId}`, {});
      } catch (e) {}
    }
    return originalJson(data);
  };
  next();
});

// For invoice list responses: set uldegdel = geree.globalUldegdel so "Үлдэгдэл" shows contract balance (including credit)
router.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const jagsaalt = data?.jagsaalt;
    if (!Array.isArray(jagsaalt) || jagsaalt.length === 0) {
      return originalJson(data);
    }
    const baiguullagiinId =
      req.body?.baiguullagiinId || req.query?.baiguullagiinId;
    if (!baiguullagiinId || !db?.kholboltuud) {
      return originalJson(data);
    }
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
    );
    if (!kholbolt) {
      return originalJson(data);
    }
    const gereeIds = [
      ...new Set(
        jagsaalt
          .map((inv) => inv?.gereeniiId)
          .filter((id) => id != null && String(id).length > 0),
      ),
    ];
    if (gereeIds.length === 0) {
      return originalJson(data);
    }
    const GereeModel = Geree(kholbolt);
    GereeModel.find({ _id: { $in: gereeIds } })
      .select("globalUldegdel")
      .lean()
      .then((gerees) => {
        const byId = {};
        gerees.forEach((g) => {
          byId[String(g._id)] =
            typeof g.globalUldegdel === "number"
              ? g.globalUldegdel
              : (g.globalUldegdel ?? 0);
        });
        jagsaalt.forEach((inv) => {
          const gid = inv?.gereeniiId != null ? String(inv.gereeniiId) : null;
          if (gid && byId[gid] !== undefined) {
            inv.uldegdel = byId[gid];
          }
        });
        originalJson(data);
      })
      .catch(() => originalJson(data));
  };
  next();
});

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);

router.get(
  "/nekhemjlekhiinTuukh/:id",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Нэхэмжлэхийн ID буруу байна!",
        });
      }

      const nekhemjlekh = await nekhemjlekhiinTuukh(
        req.body.tukhainBaaziinKholbolt,
      ).findById(id);
      if (!nekhemjlekh) {
        return res.status(404).json({
          success: false,
          message: "Нэхэмжлэх олдсонгүй!",
        });
      }

      const wasUpdated = nekhemjlekh.checkOverdue();
      if (wasUpdated) {
        await nekhemjlekh.save();
      }

      res.json({
        success: true,
        data: nekhemjlekh,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Delete invoice(s): body { baiguullagiinId } = delete ALL invoices for org; { invoiceId, baiguullagiinId } = delete one
router.post("/deleteInvoice", tokenShalgakh, deleteInvoice);

// Mark invoices as paid
router.post("/markInvoicesAsPaid", tokenShalgakh, async (req, res, next) => {
  try {
    // Extract barilgiinId from body
    const { barilgiinId } = req.body || {};

    const result = await markInvoicesAsPaid({
      ...req.body,
      barilgiinId: barilgiinId, // Pass barilgiinId to service
    });
    const baiguullagiinId = req.body?.baiguullagiinId;
    if (baiguullagiinId) {
      const io = req.app.get("socketio");
      if (io) io.emit(`tulburUpdated:${baiguullagiinId}`, {});
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Preview invoice before sending
// GET /nekhemjlekh/preview?gereeId=xxx&baiguullagiinId=xxx&barilgiinId=xxx&targetMonth=1&targetYear=2026
router.get("/preview", tokenShalgakh, async (req, res, next) => {
  try {
    // Handle duplicate query parameters (Express converts them to arrays)
    const gereeId = Array.isArray(req.query.gereeId)
      ? req.query.gereeId[0]
      : req.query.gereeId;
    const baiguullagiinId = Array.isArray(req.query.baiguullagiinId)
      ? req.query.baiguullagiinId[0]
      : req.query.baiguullagiinId;
    const barilgiinId = Array.isArray(req.query.barilgiinId)
      ? req.query.barilgiinId[0]
      : req.query.barilgiinId;
    const targetMonth = Array.isArray(req.query.targetMonth)
      ? req.query.targetMonth[0]
      : req.query.targetMonth;
    const targetYear = Array.isArray(req.query.targetYear)
      ? req.query.targetYear[0]
      : req.query.targetYear;

    if (!gereeId || !baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "gereeId болон baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await previewInvoice(
      gereeId,
      baiguullagiinId,
      barilgiinId || null,
      month,
      year,
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Manual invoice creation – one or more contracts.
 * POST /nekhemjlekh/manualSend
 * Headers: Authorization (token)
 * Body (JSON):
 *   - gereeIds (required): string[] – contract IDs, e.g. ["507f1f77bcf86cd799439011"]
 *   - baiguullagiinId (required): string – organization ID
 *   - gereeId (optional): string – single contract ID (alternative to gereeIds)
 *   - override (optional): boolean – if true, delete existing invoices for the month before creating (default: false)
 *   - targetMonth (optional): number – month 1–12 (default: current month)
 *   - targetYear (optional): number – year (default: current year)
 */
router.post("/manualSend", tokenShalgakh, async (req, res, next) => {
  try {
    const {
      gereeIds,
      gereeId,
      baiguullagiinId,
      override = false,
      targetMonth,
      targetYear,
    } = req.body;

    // Support both new format (gereeIds array) and old format (single gereeId) for backward compatibility
    let contractIds = gereeIds;
    if (!contractIds && gereeId) {
      // Backward compatibility: if gereeId is provided, convert to array
      contractIds = [gereeId];
    }

    if (
      !contractIds ||
      !Array.isArray(contractIds) ||
      contractIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "gereeIds (массив) болон baiguullagiinId шаардлагатай",
      });
    }

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await manualSendSelectedInvoices(
      contractIds,
      baiguullagiinId,
      override === true || override === "true",
      month,
      year,
      req.app,
    );

    if (result.success) {
      const baiguullagiinId = req.body?.baiguullagiinId;
      if (baiguullagiinId) {
        const io = req.app.get("socketio");
        if (io) io.emit(`tulburUpdated:${baiguullagiinId}`, {});
      }
      const message =
        result.created === 1
          ? "Нэхэмжлэх амжилттай үүсгэгдлээ"
          : `${result.created} нэхэмжлэх амжилттай үүсгэгдлээ`;

      res.json({
        success: true,
        message: message,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || "Нэхэмжлэхүүд үүсгэхэд алдаа гарлаа",
        error: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Manual invoice creation – all active contracts in org (optionally filtered by building).
 * POST /nekhemjlekh/manualSendMass
 * Headers: Authorization (token)
 * Body (JSON):
 *   - baiguullagiinId (required): string – organization ID
 *   - barilgiinId (optional): string – limit to contracts in this building
 *   - override (optional): boolean – if true, delete existing invoices for the month before creating (default: false)
 *   - targetMonth (optional): number – month 1–12 (default: current month)
 *   - targetYear (optional): number – year (default: current year)
 */
router.post("/manualSendMass", tokenShalgakh, async (req, res, next) => {
  try {
    const {
      baiguullagiinId,
      barilgiinId,
      override = false,
      targetMonth,
      targetYear,
    } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        success: false,
        message: "baiguullagiinId шаардлагатай",
      });
    }

    const month = targetMonth ? parseInt(targetMonth) : null;
    const year = targetYear ? parseInt(targetYear) : null;

    const result = await manualSendMassInvoices(
      baiguullagiinId,
      barilgiinId || null,
      override === true || override === "true",
      month,
      year,
      req.app,
    );

    if (result.success) {
      const baiguullagiinId = req.body?.baiguullagiinId;
      if (baiguullagiinId) {
        const io = req.app.get("socketio");
        if (io) io.emit(`tulburUpdated:${baiguullagiinId}`, {});
      }
      res.json({
        success: true,
        message: `${result.created} нэхэмжлэх амжилттай үүсгэгдлээ`,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || "Нэхэмжлэхүүд үүсгэхэд алдаа гарлаа",
        error: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// Recalculate and re-sync contract balance
router.post("/recalculate-balance", tokenShalgakh, recalculateGereeBalance);



// Delete a specific zardal from an invoice
router.post(
  "/nekhemjlekhiinTuukh/deleteZardal",
  tokenShalgakh,
  deleteInvoiceZardal,
);

/**
 * POST /nekhemjlekh/sync-all-from-ledger
 * 
 * Uses the history ledger as the single source of truth to sync:
 *   1. Each invoice's niitTulbur, uldegdel, tuluv  (from niitTulburOriginal - paymentHistory)
 *   2. Each geree's globalUldegdel, positiveBalance (from ledger final balance)
 * 
 * Processes ALL contracts for the given baiguullaga.
 * 
 * Body: { baiguullagiinId, dryRun?: boolean }
 *   dryRun = true  → only report what would change, don't write to DB
 *   dryRun = false → apply all changes (default)
 */
router.post("/sync-all-from-ledger", tokenShalgakh, async (req, res, next) => {
  try {
    const { baiguullagiinId, dryRun = false, minOgnoo, dugaarPrefix } = req.body;
    if (!baiguullagiinId) {
      return res.status(400).json({ success: false, message: "baiguullagiinId шаардлагатай" });
    }

    const kholbolt = db.kholboltuud?.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res.status(404).json({ success: false, message: "Холболт олдсонгүй" });
    }

    const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
    const GereeniiTulsunAvlaga  = require("../models/gereeniiTulsunAvlaga");
    const NekhemjlekhModel      = nekhemjlekhiinTuukh(kholbolt);
    const GereeModel            = Geree(kholbolt);
    const { recalcGlobalUldegdel } = require("../utils/recalcGlobalUldegdel");

    // 1. Get all distinct gereeniiIds for this baiguullaga
    const gereeList = await GereeModel
      .find({ baiguullagiinId: String(baiguullagiinId) })
      .select("_id globalUldegdel positiveBalance")
      .lean();

    const summary = {
      totalGeree: gereeList.length,
      fixedInvoices: 0,
      fixedGeree: 0,
      errors: [],
      details: [],
    };

    for (const geree of gereeList) {
      const gereeniiId = String(geree._id);
      try {
        // ── STEP 1: Restore each invoice from its own original data ──────────
        const query = { gereeniiId };
        if (minOgnoo) {
          query.ognoo = { $gte: new Date(minOgnoo) };
        }
        if (dugaarPrefix) {
          query.nekhemjlekhiinDugaar = { $regex: `^${dugaarPrefix}` };
        }
        
        const allInvoices = await NekhemjlekhModel
          .find(query)
          .sort({ ognoo: 1, createdAt: 1 });

        const invoiceChanges = [];
        for (const inv of allInvoices) {
          // niitTulburOriginal is the charge before any payments.
          // If missing or 0 but niitTulbur exists, rebuild from zardluud.
          let originalTotal = typeof inv.niitTulburOriginal === "number" && inv.niitTulburOriginal > 0
            ? inv.niitTulburOriginal
            : null;

          // Fallback: sum medeelel.zardluud (excluding ekhniiUldegdel items)
          if (!originalTotal && Array.isArray(inv.medeelel?.zardluud)) {
            const zardalTotal = inv.medeelel.zardluud
              .filter(z => !z.isEkhniiUldegdel)
              .reduce((s, z) => s + (Number(z.dun) || Number(z.tariff) || 0), 0);
            originalTotal = Math.round(zardalTotal * 100) / 100;
          }

          originalTotal = Math.round((originalTotal || 0) * 100) / 100;

          const totalPaid = Math.round(
            (inv.paymentHistory || []).reduce((s, p) => s + (Number(p.dun) || 0), 0) * 100
          ) / 100;

          const correctUldegdel   = Math.round(Math.max(0, originalTotal - totalPaid) * 100) / 100;
          const correctNiitTulbur = correctUldegdel;
          const correctTuluv      = correctUldegdel <= 0.01 ? "Төлсөн" : "Төлөөгүй";

          const oldUldegdel   = typeof inv.uldegdel   === "number" ? inv.uldegdel   : null;
          const oldNiitTulbur = typeof inv.niitTulbur === "number" ? inv.niitTulbur : null;

          const needsFix =
            Math.abs((oldUldegdel ?? 0)   - correctUldegdel)   > 0.01 ||
            Math.abs((oldNiitTulbur ?? 0) - correctNiitTulbur) > 0.01 ||
            inv.tuluv !== correctTuluv ||
            (inv.niitTulburOriginal !== originalTotal && originalTotal > 0);

          if (needsFix) {
            invoiceChanges.push({
              _id: inv._id,
              nekhemjlekhiinDugaar: inv.nekhemjlekhiinDugaar,
              oldUldegdel, oldNiitTulbur, oldTuluv: inv.tuluv,
              newUldegdel: correctUldegdel, newNiitTulbur: correctNiitTulbur, newTuluv: correctTuluv,
              niitTulburOriginal: originalTotal,
              totalPaid,
            });

            if (!dryRun) {
              inv._skipTuluvRecalc = true;
              inv.niitTulburOriginal = originalTotal;
              inv.niitTulbur  = correctNiitTulbur;
              inv.uldegdel    = correctUldegdel;
              inv.tuluv       = correctTuluv;
              await inv.save();
            }
          }
        }

        summary.fixedInvoices += invoiceChanges.length;

        // ── STEP 2: Recalc geree balance from ledger (source of truth) ───────
        let newGeree = null;
        if (!dryRun) {
          newGeree = await recalcGlobalUldegdel({
            gereeId: gereeniiId,
            baiguullagiinId,
            GereeModel,
            NekhemjlekhiinTuukhModel: NekhemjlekhModel,
            GereeniiTulukhAvlagaModel: GereeniiTulukhAvlaga(kholbolt),
            GereeniiTulsunAvlagaModel: GereeniiTulsunAvlaga(kholbolt),
          });
        }

        if (invoiceChanges.length > 0 || 
            Math.abs((geree.globalUldegdel || 0) - (newGeree?.globalUldegdel ?? geree.globalUldegdel)) > 0.01) {
          summary.fixedGeree++;
        }

        if (invoiceChanges.length > 0) {
          summary.details.push({
            gereeniiId,
            invoiceChanges,
            oldGlobalUldegdel: geree.globalUldegdel,
            newGlobalUldegdel: newGeree?.globalUldegdel ?? "(dryRun)",
          });
        }

      } catch (gErr) {
        summary.errors.push({ gereeniiId, error: gErr.message });
      }
    }

    // Emit socket update
    try { req.app.get("socketio")?.emit(`tulburUpdated:${baiguullagiinId}`, {}); } catch (_) {}

    res.json({
      success: true,
      dryRun,
      message: dryRun
        ? `DryRun: ${summary.fixedInvoices} нэхэмжлэх өөрчлөгдөх байсан (бичигдсэнгүй)`
        : `${summary.fixedInvoices} нэхэмжлэх, ${summary.fixedGeree} гэрээний үлдэгдэл синхрончлогдлоо`,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
