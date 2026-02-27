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

module.exports = router;
