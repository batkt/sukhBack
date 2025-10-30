const asyncHandler = require("express-async-handler");

// POST /tailan/summary
// Body: { baiguullagiinId, barilgiinId?, ekhlekhOgnoo?, duusakhOgnoo? }
exports.tailanSummary = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const {
      baiguullagiinId,
      barilgiinId,
      ekhlekhOgnoo,
      duusakhOgnoo,
    } = req.body || {};

    if (!baiguullagiinId) {
      return res.status(400).json({ success: false, message: "baiguullagiinId is required" });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => k.baiguullagiinId === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res.status(404).json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });

    const OrshinSuugch = require("../models/orshinSuugch");
    const Geree = require("../models/geree");
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const BankniiGuilgee = require("../models/bankniiGuilgee");
    const EbarimtShine = require("../models/ebarimtShine");

    const dateFilter = {};
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo ? new Date(ekhlekhOgnoo) : new Date("1970-01-01");
      const end = duusakhOgnoo ? new Date(duusakhOgnoo) : new Date("2999-12-31");
      dateFilter.$gte = start;
      dateFilter.$lte = end;
    }

    // Filters
    const baseFilter = { baiguullagiinId: String(baiguullagiinId) };
    const baseFilterWithBuilding = barilgiinId
      ? { ...baseFilter, barilgiinId: String(barilgiinId) }
      : baseFilter;

    // Counts
    const [
      numResidents,
      numContracts,
      numInvoices,
      numEbarimt,
    ] = await Promise.all([
      OrshinSuugch(db.erunkhiiKholbolt).countDocuments(baseFilter),
      Geree(kholbolt).countDocuments(baseFilterWithBuilding),
      NekhemjlekhiinTuukh(kholbolt).countDocuments(baseFilterWithBuilding),
      EbarimtShine(kholbolt).countDocuments(baseFilterWithBuilding),
    ]);

    // Invoice status breakdown and sums in range
    const matchInvoices = { ...baseFilterWithBuilding };
    if (dateFilter.$gte) matchInvoices.ognoo = dateFilter;

    const invoiceAgg = await NekhemjlekhiinTuukh(kholbolt).aggregate([
      { $match: matchInvoices },
      {
        $group: {
          _id: "$tuluv",
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ["$niitTulbur", 0] } },
        },
      },
    ]);
    const invoiceStats = invoiceAgg.reduce(
      (acc, r) => {
        acc.byStatus[r._id || "unknown"] = { count: r.count, total: r.total };
        acc.totalCount += r.count;
        acc.totalAmount += r.total;
        return acc;
      },
      { byStatus: {}, totalCount: 0, totalAmount: 0 }
    );

    // Payments from bank transactions in range
    const matchTx = { ...baseFilterWithBuilding };
    if (dateFilter.$gte) matchTx.tranDate = dateFilter;
    const bankAgg = await BankniiGuilgee(kholbolt, false).aggregate([
      { $match: matchTx },
      {
        $group: {
          _id: "$bank",
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]);
    const bankStats = bankAgg.reduce(
      (acc, r) => {
        acc.byBank[r._id || "unknown"] = { count: r.count, totalAmount: r.totalAmount };
        acc.totalCount += r.count;
        acc.totalAmount += r.totalAmount;
        return acc;
      },
      { byBank: {}, totalCount: 0, totalAmount: 0 }
    );

    // Ebarimt totals in range
    const matchEb = { ...baseFilterWithBuilding };
    if (dateFilter.$gte) matchEb.dateOgnoo = dateFilter;
    const ebarimtAgg = await EbarimtShine(kholbolt).aggregate([
      { $match: matchEb },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          totalVAT: { $sum: { $ifNull: ["$totalVAT", 0] } },
          totalCityTax: { $sum: { $ifNull: ["$totalCityTax", 0] } },
        },
      },
    ]);
    const ebarimtStats = ebarimtAgg[0] || {
      count: 0,
      totalAmount: 0,
      totalVAT: 0,
      totalCityTax: 0,
    };

    res.json({
      success: true,
      filter: { baiguullagiinId, barilgiinId: barilgiinId || null, ekhlekhOgnoo: ekhlekhOgnoo || null, duusakhOgnoo: duusakhOgnoo || null },
      summary: {
        numResidents,
        numContracts,
        invoices: {
          total: numInvoices,
          stats: invoiceStats,
        },
        payments: bankStats,
        ebarimt: ebarimtStats,
      },
    });
  } catch (error) {
    next(error);
  }
});


