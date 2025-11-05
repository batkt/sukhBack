const asyncHandler = require("express-async-handler");

exports.tailanSummary = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { baiguullagiinId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } =
      source || {};

    if (!baiguullagiinId) {
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    }

    const OrshinSuugch = require("../models/orshinSuugch");
    const Geree = require("../models/geree");
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const BankniiGuilgee = require("../models/bankniiGuilgee");
    const EbarimtShine = require("../models/ebarimtShine");

    const dateFilter = {};
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      dateFilter.$gte = start;
      dateFilter.$lte = end;
    }

    const baseFilter = { baiguullagiinId: String(baiguullagiinId) };
    const baseFilterWithBuilding = barilgiinId
      ? { ...baseFilter, barilgiinId: String(barilgiinId) }
      : baseFilter;

    const [numResidents, numContracts, numInvoices, numEbarimt] =
      await Promise.all([
        OrshinSuugch(db.erunkhiiKholbolt).countDocuments(baseFilter),
        Geree(kholbolt).countDocuments(baseFilterWithBuilding),
        NekhemjlekhiinTuukh(kholbolt).countDocuments(baseFilterWithBuilding),
        EbarimtShine(kholbolt).countDocuments(baseFilterWithBuilding),
      ]);

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
        acc.byBank[r._id || "unknown"] = {
          count: r.count,
          totalAmount: r.totalAmount,
        };
        acc.totalCount += r.count;
        acc.totalAmount += r.totalAmount;
        return acc;
      },
      { byBank: {}, totalCount: 0, totalAmount: 0 }
    );

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
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
      },
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

function buildDateRange(ekhlekhOgnoo, duusakhOgnoo) {
  if (!ekhlekhOgnoo && !duusakhOgnoo) return null;
  const start = ekhlekhOgnoo ? new Date(ekhlekhOgnoo) : new Date("1970-01-01");
  const end = duusakhOgnoo ? new Date(duusakhOgnoo) : new Date("2999-12-31");
  return { $gte: start, $lte: end };
}

exports.tailanAvlaga = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const {
      baiguullagiinId,
      barilgiinId,
      bairNer,
      davkhar,
      toot,
      ekhlekhOgnoo,
      duusakhOgnoo,
    } = source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt) {
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    }

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    if (bairNer) match.bairNer = bairNer;
    if (davkhar) match.davkhar = String(davkhar);
    if (toot) match.toot = String(toot);
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.ognoo = dr;

    const docs = await NekhemjlekhiinTuukh(kholbolt).find(match).lean();
    const paid = [];
    const unpaid = [];
    let paidSum = 0;
    let unpaidSum = 0;
    for (const d of docs) {
      const row = {
        gereeniiDugaar: d.gereeniiDugaar,
        ovog: d.ovog,
        ner: d.ner,
        utas: d.utas,
        toot: d.toot,
        davkhar: d.davkhar,
        bairNer: d.bairNer,
        ognoo: d.ognoo,
        niitTulbur: d.niitTulbur || 0,
        tuluv: d.tuluv,
      };
      if (d.tuluv === "Төлсөн") {
        paid.push(row);
        paidSum += d.niitTulbur || 0;
      } else {
        unpaid.push(row);
        unpaidSum += d.niitTulbur || 0;
      }
    }
    res.json({
      success: true,
      total: docs.length,
      paid: { count: paid.length, sum: paidSum, list: paid },
      unpaid: { count: unpaid.length, sum: unpaidSum, list: unpaid },
    });
  } catch (error) {
    next(error);
  }
});

exports.tailanGuilgee = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const {
      baiguullagiinId,
      barilgiinId,
      ekhlekhOgnoo,
      duusakhOgnoo,
      turul, // orlogo | zarlaga
      bank,
      dansniiDugaar,
      tuluv, // tuluv optional
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 20,
    } = source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });

    const BankniiGuilgee = require("../models/bankniiGuilgee");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    if (bank) match.bank = bank;
    if (dansniiDugaar) match.dansniiDugaar = dansniiDugaar;
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.tranDate = dr;
    if (turul === "orlogo") {
      match.$or = [{ drOrCr: "CR" }, { income: { $gt: 0 } }];
    } else if (turul === "zarlaga") {
      match.$or = [{ drOrCr: "DR" }, { outcome: { $gt: 0 } }];
    }
    if (tuluv != null) match.tuluv = tuluv;

    const skip = (Number(khuudasniiDugaar) - 1) * Number(khuudasniiKhemjee);
    const [list, niitMur] = await Promise.all([
      BankniiGuilgee(kholbolt, false)
        .find(match)
        .sort({ tranDate: -1 })
        .skip(skip)
        .limit(Number(khuudasniiKhemjee))
        .lean(),
      BankniiGuilgee(kholbolt, false).countDocuments(match),
    ]);
    const niitKhuudas = Math.ceil(niitMur / Number(khuudasniiKhemjee));
    res.json({
      success: true,
      khuudasniiDugaar: Number(khuudasniiDugaar),
      khuudasniiKhemjee: Number(khuudasniiKhemjee),
      niitMur,
      niitKhuudas,
      list,
    });
  } catch (error) {
    next(error);
  }
});

exports.tailanOrlogoZarlaga = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { baiguullagiinId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } =
      source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    const BankniiGuilgee = require("../models/bankniiGuilgee");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.tranDate = dr;

    const agg = await BankniiGuilgee(kholbolt, false).aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orlogo: {
            $sum: {
              $ifNull: [
                "$income",
                { $cond: [{ $eq: ["$drOrCr", "CR"] }, "$amount", 0] },
              ],
            },
          },
          zarlaga: {
            $sum: {
              $ifNull: [
                "$outcome",
                { $cond: [{ $eq: ["$drOrCr", "DR"] }, "$amount", 0] },
              ],
            },
          },
        },
      },
    ]);
    const row = agg[0] || { orlogo: 0, zarlaga: 0 };
    res.json({
      success: true,
      orlogo: row.orlogo || 0,
      zarlaga: row.zarlaga || 0,
    });
  } catch (error) {
    next(error);
  }
});

exports.tailanAshigAldagdal = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { baiguullagiinId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } =
      source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    const BankniiGuilgee = require("../models/bankniiGuilgee");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.tranDate = dr;

    const agg = await BankniiGuilgee(kholbolt, false).aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orlogo: {
            $sum: {
              $ifNull: [
                "$income",
                { $cond: [{ $eq: ["$drOrCr", "CR"] }, "$amount", 0] },
              ],
            },
          },
          zarlaga: {
            $sum: {
              $ifNull: [
                "$outcome",
                { $cond: [{ $eq: ["$drOrCr", "DR"] }, "$amount", 0] },
              ],
            },
          },
        },
      },
    ]);
    const row = agg[0] || { orlogo: 0, zarlaga: 0 };
    res.json({
      success: true,
      orlogo: row.orlogo || 0,
      zarlaga: row.zarlaga || 0,
    });
  } catch (error) {
    next(error);
  }
});

exports.tailanSariin = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { baiguullagiinId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } =
      source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.ognoo = dr;
    const agg = await NekhemjlekhiinTuukh(kholbolt).aggregate([
      { $match: match },
      {
        $group: {
          _id: { y: { $year: "$ognoo" }, m: { $month: "$ognoo" } },
          total: { $sum: { $ifNull: ["$niitTulbur", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]);
    res.json({ success: true, months: agg });
  } catch (error) {
    next(error);
  }
});

exports.tailanUliral = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { baiguullagiinId, barilgiinId, ekhlekhOgnoo, duusakhOgnoo } =
      source || {};
    if (!baiguullagiinId)
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );
    if (!kholbolt)
      return res
        .status(404)
        .json({ success: false, message: "Холболтын мэдээлэл олдсонгүй" });
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    const dr = buildDateRange(ekhlekhOgnoo, duusakhOgnoo);
    if (dr) match.ognoo = dr;
    const agg = await NekhemjlekhiinTuukh(kholbolt).aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            y: { $year: "$ognoo" },
            q: { $ceil: { $divide: [{ $month: "$ognoo" }, 3] } },
          },
          total: { $sum: { $ifNull: ["$niitTulbur", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.q": 1 } },
    ]);
    res.json({ success: true, quarters: agg });
  } catch (error) {
    next(error);
  }
});

exports.tailanExport = asyncHandler(async (req, res, next) => {
  try {
    const source = req.params.baiguullagiinId
      ? {
          baiguullagiinId: req.params.baiguullagiinId,
          ...(req.method === "GET" ? req.query : req.body),
        }
      : req.method === "GET"
      ? req.query
      : req.body;
    const { type = "csv", report = "avlaga" } = source || {};
    if (type !== "csv")
      return res
        .status(400)
        .json({ success: false, message: "Зөвхөн CSV дэмжинэ (excel)" });
    let rows = [];
    if (report === "avlaga") {
      const originalJson = res.json;
      let data;
      res.json = (payload) => {
        data = payload;
        return originalJson.call(res, payload);
      };
      await exports.tailanAvlaga(req, res, next);
      res.json = originalJson;
      if (!data?.success) return;
      const list = [...(data.paid?.list || []), ...(data.unpaid?.list || [])];
      rows = [
        [
          "gereeniiDugaar",
          "ovog",
          "ner",
          "utas",
          "toot",
          "davkhar",
          "bairNer",
          "ognoo",
          "niitTulbur",
          "tuluv",
        ],
        ...list.map((r) => [
          r.gereeniiDugaar,
          r.ovog,
          r.ner,
          (r.utas || []).join("/"),
          r.toot,
          r.davkhar,
          r.bairNer,
          r.ognoo,
          r.niitTulbur,
          r.tuluv,
        ]),
      ];
    } else if (report === "guilegee") {
      const originalJson = res.json;
      let data;
      res.json = (payload) => {
        data = payload;
        return originalJson.call(res, payload);
      };
      await exports.tailanGuilgee(req, res, next);
      res.json = originalJson;
      if (!data?.success) return;
      rows = [
        [
          "tranDate",
          "bank",
          "amount",
          "description",
          "dansniiDugaar",
          "accNum",
          "drOrCr",
        ],
        ...data.list.map((t) => [
          t.tranDate,
          t.bank,
          t.amount,
          t.description,
          t.dansniiDugaar,
          t.accNum,
          t.drOrCr,
        ]),
      ];
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Report not supported for export" });
    }
    const csv = rows
      .map((r) =>
        r
          .map((c) => (c == null ? "" : String(c).replace(/"/g, '""')))
          .map((c) => `"${c}"`)
          .join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${report}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});
