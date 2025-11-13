const asyncHandler = require("express-async-handler");

// Өр, авлагын тайлан (оршин суугчдийн) - Байр, орц, давхар, тоогоор хайж хэн төлбөрөө төлсөн, хэн төлөөгүйг хянах
exports.tailanOrlogoAvlaga = asyncHandler(async (req, res, next) => {
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
      bairNer, // Байр
      orts, // Орц
      davkhar, // Давхар
      toot, // Тоот
      ekhlekhOgnoo,
      duusakhOgnoo,
    } = source || {};

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

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    // Build match filter
    const match = { baiguullagiinId: String(baiguullagiinId) };

    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    if (bairNer) match.bairNer = bairNer;
    if (orts) match.orts = orts;
    if (davkhar) match.davkhar = String(davkhar);
    if (toot) match.toot = String(toot);

    // Date range filter
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      match.ognoo = { $gte: start, $lte: end };
    }

    const docs = await NekhemjlekhiinTuukh(kholbolt)
      .find(match)
      .lean()
      .sort({ ognoo: -1 });

    const paid = [];
    const unpaid = [];
    let paidSum = 0;
    let unpaidSum = 0;

    for (const d of docs) {
      // Extract supplementary information from medeelel
      const nememjlekh = {
        zardluud: d.medeelel?.zardluud || [],
        guilgeenuud: d.medeelel?.guilgeenuud || [],
        segmentuud: d.medeelel?.segmentuud || [],
        khungulultuud: d.medeelel?.khungulultuud || [],
        toot: d.medeelel?.toot || d.toot || "",
        temdeglel: d.medeelel?.temdeglel || d.medeelel?.tailbar || "",
        uusgegsenEsekh: d.medeelel?.uusgegsenEsekh || "",
        uusgegsenOgnoo: d.medeelel?.uusgegsenOgnoo || null,
      };

      const row = {
        gereeniiDugaar: d.gereeniiDugaar || "",
        ovog: d.ovog || "",
        ner: d.ner || "",
        utas: Array.isArray(d.utas) ? d.utas : d.utas || [],
        toot: d.toot || "",
        davkhar: d.davkhar || "",
        bairNer: d.bairNer || "",
        orts: d.orts || "",
        ognoo: d.ognoo || null,
        tulukhOgnoo: d.tulukhOgnoo || null,
        niitTulbur: d.niitTulbur || 0,
        tuluv: d.tuluv || "Төлөөгүй",
        dugaalaltDugaar: d.dugaalaltDugaar || null,
        gereeniiId: d.gereeniiId || "",
        // Нэмэмжлэлийн тайлан (Supplementary report)
        nememjlekh: nememjlekh,
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
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        bairNer: bairNer || null,
        orts: orts || null,
        davkhar: davkhar || null,
        toot: toot || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
      },
      total: docs.length,
      paid: {
        count: paid.length,
        sum: paidSum,
        list: paid,
      },
      unpaid: {
        count: unpaid.length,
        sum: unpaidSum,
        list: unpaid,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Сарын төлбөр тайлан (сар сараар нэмээд улиралаар шүүж харах боломжтой, хураангуй дэлгэрэнгүй)
exports.tailanSariinTulbur = asyncHandler(async (req, res, next) => {
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
      turul = "sar", // "sar" (month) or "uliral" (quarter)
      view = "huraangui", // "huraangui" (summary) or "delgerengui" (detailed)
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 20,
    } = source || {};

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

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    // Build base match filter
    const match = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) match.barilgiinId = String(barilgiinId);

    // Date range filter
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      match.ognoo = { $gte: start, $lte: end };
    }

    // Group by month or quarter
    const groupStage = {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$niitTulbur", 0] } },
        count: { $sum: 1 },
        tulsenTotal: {
          $sum: {
            $cond: [
              { $eq: ["$tuluv", "Төлсөн"] },
              { $ifNull: ["$niitTulbur", 0] },
              0,
            ],
          },
        },
        tulsenCount: {
          $sum: {
            $cond: [{ $eq: ["$tuluv", "Төлсөн"] }, 1, 0],
          },
        },
        tuluuguiTotal: {
          $sum: {
            $cond: [
              { $ne: ["$tuluv", "Төлсөн"] },
              { $ifNull: ["$niitTulbur", 0] },
              0,
            ],
          },
        },
        tuluuguiCount: {
          $sum: {
            $cond: [{ $ne: ["$tuluv", "Төлсөн"] }, 1, 0],
          },
        },
      },
    };

    if (turul === "uliral") {
      // Group by quarter
      groupStage.$group._id = {
        year: { $year: "$ognoo" },
        quarter: { $ceil: { $divide: [{ $month: "$ognoo" }, 3] } },
      };
    } else {
      // Group by month
      groupStage.$group._id = {
        year: { $year: "$ognoo" },
        month: { $month: "$ognoo" },
      };
    }

    const aggregatePipeline = [
      { $match: match },
      groupStage,
      {
        $sort: {
          "_id.year": 1,
          ...(turul === "uliral"
            ? { "_id.quarter": 1 }
            : { "_id.month": 1 }),
        },
      },
    ];

    const summaryData = await NekhemjlekhiinTuukh(kholbolt).aggregate(
      aggregatePipeline
    );

    // Format summary data
    const formattedSummary = summaryData.map((item) => {
      const period = turul === "uliral"
        ? `${item._id.year}-Q${item._id.quarter}`
        : `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;

      return {
        period,
        year: item._id.year,
        ...(turul === "uliral"
          ? { quarter: item._id.quarter }
          : { month: item._id.month }),
        total: item.total || 0,
        count: item.count || 0,
        tulsen: {
          total: item.tulsenTotal || 0,
          count: item.tulsenCount || 0,
        },
        tuluugui: {
          total: item.tuluuguiTotal || 0,
          count: item.tuluuguiCount || 0,
        },
      };
    });

    let detailedList = [];
    let totalDetailed = 0;

    // If detailed view is requested, get the actual invoice list
    if (view === "delgerengui") {
      const skip = (Number(khuudasniiDugaar) - 1) * Number(khuudasniiKhemjee);

      // Get detailed invoices grouped by period
      const detailedMatch = { ...match };
      const detailedDocs = await NekhemjlekhiinTuukh(kholbolt)
        .find(detailedMatch)
        .sort({ ognoo: -1 })
        .skip(skip)
        .limit(Number(khuudasniiKhemjee))
        .lean();

      totalDetailed = await NekhemjlekhiinTuukh(kholbolt).countDocuments(
        detailedMatch
      );

      detailedList = detailedDocs.map((d) => {
        const invoiceDate = new Date(d.ognoo);
        const period = turul === "uliral"
          ? `${invoiceDate.getFullYear()}-Q${Math.ceil((invoiceDate.getMonth() + 1) / 3)}`
          : `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, "0")}`;

        return {
          period,
          gereeniiDugaar: d.gereeniiDugaar || "",
          ovog: d.ovog || "",
          ner: d.ner || "",
          utas: Array.isArray(d.utas) ? d.utas : d.utas || [],
          toot: d.toot || "",
          davkhar: d.davkhar || "",
          bairNer: d.bairNer || "",
          ognoo: d.ognoo || null,
          tulukhOgnoo: d.tulukhOgnoo || null,
          niitTulbur: d.niitTulbur || 0,
          tuluv: d.tuluv || "Төлөөгүй",
          dugaalaltDugaar: d.dugaalaltDugaar || null,
        };
      });
    }

    res.json({
      success: true,
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
        turul, // "sar" or "uliral"
        view, // "huraangui" or "delgerengui"
      },
      summary: formattedSummary,
      ...(view === "delgerengui"
        ? {
            detailed: {
              khuudasniiDugaar: Number(khuudasniiDugaar),
              khuudasniiKhemjee: Number(khuudasniiKhemjee),
              niitMur: totalDetailed,
              niitKhuudas: Math.ceil(
                totalDetailed / Number(khuudasniiKhemjee)
              ),
              list: detailedList,
            },
          }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

// Нэхэмжлэлийн түүх (Бүх үүссэн нэхэмжлэлийн жагсаалтыг хянах)
exports.tailanNekhemjlekhiinTuukh = asyncHandler(async (req, res, next) => {
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
      tuluv, // Төлөв: "Төлсөн", "Төлөөгүй", "Хугацаа хэтэрсэн"
      gereeniiDugaar,
      bairNer,
      davkhar,
      toot,
      ovog,
      ner,
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 20,
    } = source || {};

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

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    // Build match filter
    const match = { baiguullagiinId: String(baiguullagiinId) };

    if (barilgiinId) match.barilgiinId = String(barilgiinId);
    if (tuluv) match.tuluv = tuluv;
    if (gereeniiDugaar) match.gereeniiDugaar = gereeniiDugaar;
    if (bairNer) match.bairNer = bairNer;
    if (davkhar) match.davkhar = String(davkhar);
    if (toot) match.toot = String(toot);
    if (ovog) match.ovog = { $regex: ovog, $options: "i" };
    if (ner) match.ner = { $regex: ner, $options: "i" };

    // Date range filter
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      match.ognoo = { $gte: start, $lte: end };
    }

    const skip = (Number(khuudasniiDugaar) - 1) * Number(khuudasniiKhemjee);

    // Get invoices with pagination
    const [list, niitMur] = await Promise.all([
      NekhemjlekhiinTuukh(kholbolt)
        .find(match)
        .sort({ ognoo: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(khuudasniiKhemjee))
        .lean(),
      NekhemjlekhiinTuukh(kholbolt).countDocuments(match),
    ]);

    const niitKhuudas = Math.ceil(niitMur / Number(khuudasniiKhemjee));

    // Calculate totals and statistics
    const totals = await NekhemjlekhiinTuukh(kholbolt).aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          niitTulbur: { $sum: { $ifNull: ["$niitTulbur", 0] } },
          tulsenTulbur: {
            $sum: {
              $cond: [
                { $eq: ["$tuluv", "Төлсөн"] },
                { $ifNull: ["$niitTulbur", 0] },
                0,
              ],
            },
          },
          tulsenCount: {
            $sum: {
              $cond: [{ $eq: ["$tuluv", "Төлсөн"] }, 1, 0],
            },
          },
          tuluuguiTulbur: {
            $sum: {
              $cond: [
                { $ne: ["$tuluv", "Төлсөн"] },
                { $ifNull: ["$niitTulbur", 0] },
                0,
              ],
            },
          },
          tuluuguiCount: {
            $sum: {
              $cond: [{ $ne: ["$tuluv", "Төлсөн"] }, 1, 0],
            },
          },
          khugatsaaKhetersenTulbur: {
            $sum: {
              $cond: [
                { $eq: ["$tuluv", "Хугацаа хэтэрсэн"] },
                { $ifNull: ["$niitTulbur", 0] },
                0,
              ],
            },
          },
          khugatsaaKhetersenCount: {
            $sum: {
              $cond: [{ $eq: ["$tuluv", "Хугацаа хэтэрсэн"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stats = totals[0] || {
      niitTulbur: 0,
      tulsenTulbur: 0,
      tulsenCount: 0,
      tuluuguiTulbur: 0,
      tuluuguiCount: 0,
      khugatsaaKhetersenTulbur: 0,
      khugatsaaKhetersenCount: 0,
    };

    // Format invoice list
    const formattedList = list.map((invoice) => {
      // Extract supplementary information from medeelel
      const nememjlekh = {
        zardluud: invoice.medeelel?.zardluud || [],
        guilgeenuud: invoice.medeelel?.guilgeenuud || [],
        segmentuud: invoice.medeelel?.segmentuud || [],
        khungulultuud: invoice.medeelel?.khungulultuud || [],
      };

      return {
        _id: invoice._id,
        gereeniiDugaar: invoice.gereeniiDugaar || "",
        gereeniiId: invoice.gereeniiId || "",
        ovog: invoice.ovog || "",
        ner: invoice.ner || "",
        utas: Array.isArray(invoice.utas) ? invoice.utas : invoice.utas || [],
        toot: invoice.toot || "",
        davkhar: invoice.davkhar || "",
        bairNer: invoice.bairNer || "",
        orts: invoice.orts || "",
        ognoo: invoice.ognoo || null,
        tulukhOgnoo: invoice.tulukhOgnoo || null,
        tulsunOgnoo: invoice.tulsunOgnoo || null,
        niitTulbur: invoice.niitTulbur || 0,
        tuluv: invoice.tuluv || "Төлөөгүй",
        dugaalaltDugaar: invoice.dugaalaltDugaar || null,
        zagvariinNer: invoice.zagvariinNer || "",
        nekhemjlekh: invoice.nekhemjlekh || "",
        paymentHistory: invoice.paymentHistory || [],
        qpayInvoiceId: invoice.qpayInvoiceId || null,
        qpayUrl: invoice.qpayUrl || null,
        nememjlekh: nememjlekh,
        createdAt: invoice.createdAt || null,
        updatedAt: invoice.updatedAt || null,
      };
    });

    res.json({
      success: true,
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
        tuluv: tuluv || null,
        gereeniiDugaar: gereeniiDugaar || null,
        bairNer: bairNer || null,
        davkhar: davkhar || null,
        toot: toot || null,
        ovog: ovog || null,
        ner: ner || null,
      },
      pagination: {
        khuudasniiDugaar: Number(khuudasniiDugaar),
        khuudasniiKhemjee: Number(khuudasniiKhemjee),
        niitMur,
        niitKhuudas,
      },
      stats: {
        niitTulbur: stats.niitTulbur || 0,
        tulsen: {
          total: stats.tulsenTulbur || 0,
          count: stats.tulsenCount || 0,
        },
        tuluugui: {
          total: stats.tuluuguiTulbur || 0,
          count: stats.tuluuguiCount || 0,
        },
        khugatsaaKhetersen: {
          total: stats.khugatsaaKhetersenTulbur || 0,
          count: stats.khugatsaaKhetersenCount || 0,
        },
      },
      list: formattedList,
    });
  } catch (error) {
    next(error);
  }
});

// Авлагын насжилтийн тайлан (Төлөгдөөгүй төлбөрийн насжилтыг тодорхойлох)
exports.tailanAvlagiinNasjilt = asyncHandler(async (req, res, next) => {
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
      view = "huraangui", // "huraangui" (summary) or "delgerengui" (detailed)
      khuudasniiDugaar = 1,
      khuudasniiKhemjee = 20,
    } = source || {};

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

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    // Build match filter - only unpaid invoices
    const match = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: { $ne: "Төлсөн" }, // Not paid
    };

    if (barilgiinId) match.barilgiinId = String(barilgiinId);

    // Date range filter (based on invoice date or due date)
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      match.$or = [
        { ognoo: { $gte: start, $lte: end } },
        { tulukhOgnoo: { $gte: start, $lte: end } },
      ];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all unpaid invoices
    const allInvoices = await NekhemjlekhiinTuukh(kholbolt)
      .find(match)
      .lean()
      .sort({ tulukhOgnoo: 1 }); // Sort by due date, oldest first

    // Age buckets: 0-30 days, 31-60 days, 61-90 days, 91-180 days, 180+ days
    const ageBuckets = {
      "0-30": { min: 0, max: 30, total: 0, count: 0, list: [] },
      "31-60": { min: 31, max: 60, total: 0, count: 0, list: [] },
      "61-90": { min: 61, max: 90, total: 0, count: 0, list: [] },
      "91-180": { min: 91, max: 180, total: 0, count: 0, list: [] },
      "180+": { min: 181, max: Infinity, total: 0, count: 0, list: [] },
    };

    let totalSum = 0;
    let totalCount = 0;

    for (const invoice of allInvoices) {
      const dueDate = invoice.tulukhOgnoo
        ? new Date(invoice.tulukhOgnoo)
        : invoice.ognoo
        ? new Date(invoice.ognoo)
        : null;

      if (!dueDate) continue;

      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      const monthsOverdue = Math.floor(daysOverdue / 30);

      // Determine age bucket
      let bucketKey = "180+";
      if (daysOverdue <= 30) bucketKey = "0-30";
      else if (daysOverdue <= 60) bucketKey = "31-60";
      else if (daysOverdue <= 90) bucketKey = "61-90";
      else if (daysOverdue <= 180) bucketKey = "91-180";

      const amount = invoice.niitTulbur || 0;
      ageBuckets[bucketKey].total += amount;
      ageBuckets[bucketKey].count += 1;
      totalSum += amount;
      totalCount += 1;

      // Add to detailed list if detailed view is requested
      if (view === "delgerengui") {
        const row = {
          gereeniiDugaar: invoice.gereeniiDugaar || "",
          gereeniiId: invoice.gereeniiId || "",
          ovog: invoice.ovog || "",
          ner: invoice.ner || "",
          utas: Array.isArray(invoice.utas)
            ? invoice.utas
            : invoice.utas || [],
          toot: invoice.toot || "",
          davkhar: invoice.davkhar || "",
          bairNer: invoice.bairNer || "",
          orts: invoice.orts || "",
          ognoo: invoice.ognoo || null,
          tulukhOgnoo: invoice.tulukhOgnoo || null,
          niitTulbur: amount,
          tuluv: invoice.tuluv || "Төлөөгүй",
          dugaalaltDugaar: invoice.dugaalaltDugaar || null,
          daysOverdue: daysOverdue,
          monthsOverdue: monthsOverdue,
          ageBucket: bucketKey,
        };
        ageBuckets[bucketKey].list.push(row);
      }
    }

    // Format summary by age buckets
    const summary = Object.keys(ageBuckets).map((key) => {
      const bucket = ageBuckets[key];
      return {
        ageRange: key,
        ageRangeMn:
          key === "0-30"
            ? "0-30 хоног"
            : key === "31-60"
            ? "31-60 хоног"
            : key === "61-90"
            ? "61-90 хоног"
            : key === "91-180"
            ? "91-180 хоног"
            : "180+ хоног",
        total: bucket.total,
        count: bucket.count,
        percentage:
          totalSum > 0 ? ((bucket.total / totalSum) * 100).toFixed(2) : 0,
      };
    });

    let detailedList = [];
    let paginatedList = [];
    let totalDetailed = 0;

    if (view === "delgerengui") {
      // Flatten all invoices from all buckets
      detailedList = Object.values(ageBuckets)
        .flatMap((bucket) => bucket.list)
        .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0)); // Sort by days overdue, highest first

      totalDetailed = detailedList.length;
      const skip = (Number(khuudasniiDugaar) - 1) * Number(khuudasniiKhemjee);
      paginatedList = detailedList.slice(
        skip,
        skip + Number(khuudasniiKhemjee)
      );
    }

    res.json({
      success: true,
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
        view, // "huraangui" or "delgerengui"
      },
      summary: {
        total: totalSum,
        count: totalCount,
        ageBuckets: summary,
      },
      ...(view === "delgerengui"
        ? {
            detailed: {
              khuudasniiDugaar: Number(khuudasniiDugaar),
              khuudasniiKhemjee: Number(khuudasniiKhemjee),
              niitMur: totalDetailed,
              niitKhuudas: Math.ceil(
                totalDetailed / Number(khuudasniiKhemjee)
              ),
              list: paginatedList,
            },
          }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

// Тайланг excel/pdf-р татаж авах боломж
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
    const {
      baiguullagiinId,
      report, // "orlogo-avlaga", "sariin-tulbur", "nekhemjlekhiin-tuukh", "avlagiin-nasjilt", "udsan-avlaga", "tsutslasan-gereenii-avlaga"
      type = "excel", // "excel" or "pdf"
      ...reportParams
    } = source || {};

    if (!baiguullagiinId) {
      return res
        .status(400)
        .json({ success: false, message: "baiguullagiinId is required" });
    }

    if (!report) {
      return res
        .status(400)
        .json({ success: false, message: "report is required" });
    }

    // Map report names to functions
    const reportMap = {
      "orlogo-avlaga": exports.tailanOrlogoAvlaga,
      "sariin-tulbur": exports.tailanSariinTulbur,
      "nekhemjlekhiin-tuukh": exports.tailanNekhemjlekhiinTuukh,
      "avlagiin-nasjilt": exports.tailanAvlagiinNasjilt,
      "guitsegtgel": exports.tailanGuitsegtgel,
      "udsan-avlaga": exports.tailanUdsanAvlaga,
      "tsutslasan-gereenii-avlaga": exports.tailanTsutslasanGereeniiAvlaga,
    };

    const reportFunction = reportMap[report];
    if (!reportFunction) {
      return res.status(400).json({
        success: false,
        message: `Тайлан олдсонгүй: ${report}`,
      });
    }

    // Get data from report function by intercepting the response
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;
    let data;
    let responseSent = false;

    res.json = (payload) => {
      if (!responseSent) {
        data = payload;
        responseSent = true;
      }
      return res;
    };

    res.send = (payload) => {
      if (!responseSent) {
        try {
          data = JSON.parse(payload);
        } catch (e) {
          // Not JSON, ignore
        }
        responseSent = true;
      }
      return res;
    };

    res.status = (code) => {
      return res;
    };

    // For certain reports, ensure we get detailed data
    if (report === "avlagiin-nasjilt" && !reportParams.view) {
      reportParams.view = "delgerengui";
      reportParams.khuudasniiKhemjee = 10000; // Get all records for export
    }
    // For sariin-tulbur, we can export summary (default) or detailed
    // Summary is better for export, so we keep default

    // Create a mock request with report parameters
    const mockReq = {
      ...req,
      method: "POST",
      body: { baiguullagiinId, ...reportParams },
      query: { baiguullagiinId, ...reportParams },
      params: {},
    };

    try {
      await reportFunction(mockReq, res, next);
    } catch (error) {
      // Restore original functions
      res.json = originalJson;
      res.send = originalSend;
      res.status = originalStatus;
      throw error;
    }

    // Restore original functions
    res.json = originalJson;
    res.send = originalSend;
    res.status = originalStatus;

    if (!data?.success) {
      return res.status(400).json({
        success: false,
        message: data?.message || "Тайлан авахад алдаа гарлаа",
      });
    }

    const XLSX = require("xlsx");
    let rows = [];
    let headers = [];
    let fileName = report;

    // Format data based on report type
    if (report === "orlogo-avlaga") {
      const list = [...(data.paid?.list || []), ...(data.unpaid?.list || [])];
      headers = [
        "Гэрээний дугаар",
        "Овог",
        "Нэр",
        "Утас",
        "Тоот",
        "Давхар",
        "Байр",
        "Орц",
        "Огноо",
        "Төлөх огноо",
        "Нийт төлбөр",
        "Төлөв",
      ];
      rows = list.map((r) => [
        r.gereeniiDugaar || "",
        r.ovog || "",
        r.ner || "",
        Array.isArray(r.utas) ? r.utas.join(", ") : r.utas || "",
        r.toot || "",
        r.davkhar || "",
        r.bairNer || "",
        r.orts || "",
        r.ognoo ? new Date(r.ognoo).toLocaleDateString("mn-MN") : "",
        r.tulukhOgnoo
          ? new Date(r.tulukhOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.niitTulbur || 0,
        r.tuluv || "",
      ]);
      fileName = "orlogo_avlaga";
    } else if (report === "sariin-tulbur") {
      headers = ["Улирал/Сар", "Нийт дүн", "Тоо", "Төлсөн дүн", "Төлсөн тоо", "Төлөөгүй дүн", "Төлөөгүй тоо"];
      rows = (data.summary || []).map((item) => [
        item.period || "",
        item.total || 0,
        item.count || 0,
        item.tulsen?.total || 0,
        item.tulsen?.count || 0,
        item.tuluugui?.total || 0,
        item.tuluugui?.count || 0,
      ]);
      fileName = "sariin_tulbur";
    } else if (report === "nekhemjlekhiin-tuukh") {
      headers = [
        "Гэрээний дугаар",
        "Овог",
        "Нэр",
        "Утас",
        "Тоот",
        "Давхар",
        "Байр",
        "Орц",
        "Огноо",
        "Төлөх огноо",
        "Төлсөн огноо",
        "Нийт төлбөр",
        "Төлөв",
        "Дугааллын дугаар",
      ];
      rows = (data.list || []).map((r) => [
        r.gereeniiDugaar || "",
        r.ovog || "",
        r.ner || "",
        Array.isArray(r.utas) ? r.utas.join(", ") : r.utas || "",
        r.toot || "",
        r.davkhar || "",
        r.bairNer || "",
        r.orts || "",
        r.ognoo ? new Date(r.ognoo).toLocaleDateString("mn-MN") : "",
        r.tulukhOgnoo
          ? new Date(r.tulukhOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.tulsunOgnoo
          ? new Date(r.tulsunOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.niitTulbur || 0,
        r.tuluv || "",
        r.dugaalaltDugaar || "",
      ]);
      fileName = "nekhemjlekhiin_tuukh";
    } else if (report === "avlagiin-nasjilt") {
      headers = [
        "Гэрээний дугаар",
        "Овог",
        "Нэр",
        "Утас",
        "Тоот",
        "Давхар",
        "Байр",
        "Орц",
        "Огноо",
        "Төлөх огноо",
        "Нийт төлбөр",
        "Төлөв",
        "Хугацаа хэтэрсэн хоног",
        "Хугацаа хэтэрсэн сар",
        "Насжилтын ангилал",
      ];
      rows = (data.detailed?.list || []).map((r) => [
        r.gereeniiDugaar || "",
        r.ovog || "",
        r.ner || "",
        Array.isArray(r.utas) ? r.utas.join(", ") : r.utas || "",
        r.toot || "",
        r.davkhar || "",
        r.bairNer || "",
        r.orts || "",
        r.ognoo ? new Date(r.ognoo).toLocaleDateString("mn-MN") : "",
        r.tulukhOgnoo
          ? new Date(r.tulukhOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.niitTulbur || 0,
        r.tuluv || "",
        r.daysOverdue || 0,
        r.monthsOverdue || 0,
        r.ageBucket || "",
      ]);
      fileName = "avlagiin_nasjilt";
    } else if (report === "udsan-avlaga") {
      headers = [
        "Гэрээний дугаар",
        "Овог",
        "Нэр",
        "Утас",
        "Тоот",
        "Давхар",
        "Байр",
        "Огноо",
        "Төлөх огноо",
        "Нийт төлбөр",
        "Төлөв",
        "Хугацаа хэтэрсэн сар",
        "Дугааллын дугаар",
      ];
      rows = (data.list || []).map((r) => [
        r.gereeniiDugaar || "",
        r.ovog || "",
        r.ner || "",
        Array.isArray(r.utas) ? r.utas.join(", ") : r.utas || "",
        r.toot || "",
        r.davkhar || "",
        r.bairNer || "",
        r.ognoo ? new Date(r.ognoo).toLocaleDateString("mn-MN") : "",
        r.tulukhOgnoo
          ? new Date(r.tulukhOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.niitTulbur || 0,
        r.tuluv || "",
        r.monthsOverdue || 0,
        r.dugaalaltDugaar || "",
      ]);
      fileName = "udsan_avlaga";
    } else if (report === "tsutslasan-gereenii-avlaga") {
      headers = [
        "Гэрээний дугаар",
        "Овог",
        "Нэр",
        "Утас",
        "Тоот",
        "Давхар",
        "Байр",
        "Огноо",
        "Төлөх огноо",
        "Нийт төлбөр",
        "Төлөв",
        "Гэрээний төлөв",
        "Дугааллын дугаар",
      ];
      rows = (data.list || []).map((r) => [
        r.gereeniiDugaar || "",
        r.ovog || "",
        r.ner || "",
        Array.isArray(r.utas) ? r.utas.join(", ") : r.utas || "",
        r.toot || "",
        r.davkhar || "",
        r.bairNer || "",
        r.ognoo ? new Date(r.ognoo).toLocaleDateString("mn-MN") : "",
        r.tulukhOgnoo
          ? new Date(r.tulukhOgnoo).toLocaleDateString("mn-MN")
          : "",
        r.niitTulbur || 0,
        r.tuluv || "",
        r.gereeniiTuluv || "",
        r.dugaalaltDugaar || "",
      ]);
      fileName = "tsutslasan_gereenii_avlaga";
    } else if (report === "guitsegtgel") {
      headers = [
        "Улирал/Сар",
        "Төлөвлөгөөт орлого",
        "Бодит орлого",
        "Орлогын зөрүү",
        "Орлогын зөрүү %",
        "Төлөвлөгөөт зардал",
        "Бодит зардал",
        "Зардлын зөрүү",
        "Зардлын зөрүү %",
        "Цэвэр орлого (төлөвлөгөө)",
        "Цэвэр орлого (бодит)",
      ];
      rows = (data.summary || []).map((item) => [
        item.period || "",
        item.plannedIncome || 0,
        item.actualIncome || 0,
        item.incomeVariance || 0,
        `${item.incomeVariancePercent || "0.00"}%`,
        item.plannedExpenses || 0,
        item.actualExpenses || 0,
        item.expensesVariance || 0,
        `${item.expensesVariancePercent || "0.00"}%`,
        (item.plannedIncome || 0) - (item.plannedExpenses || 0),
        (item.actualIncome || 0) - (item.actualExpenses || 0),
      ]);
      fileName = "guitsegtgel";
    } else {
      return res.status(400).json({
        success: false,
        message: "Энэ тайланг экспортлох боломжгүй",
      });
    }

    // Export based on type
    if (type.toLowerCase() === "excel" || type.toLowerCase() === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Set column widths
      const colWidths = headers.map(() => ({ wch: 15 }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Тайлан");

      const excelBuffer = XLSX.write(wb, {
        type: "buffer",
        bookType: "xlsx",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}_${Date.now()}.xlsx"`
      );
      res.send(excelBuffer);
    } else if (type.toLowerCase() === "csv") {
      const csv = [headers, ...rows]
        .map((r) =>
          r
            .map((c) => (c == null ? "" : String(c).replace(/"/g, '""')))
            .map((c) => `"${c}"`)
            .join(",")
        )
        .join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}_${Date.now()}.csv"`
      );
      res.send(csv);
    } else if (type.toLowerCase() === "pdf") {
      // For PDF, we'll return a message that PDF export will be added later
      // or you can integrate a PDF library like pdfkit, puppeteer, etc.
      return res.status(400).json({
        success: false,
        message: "PDF экспорт удахгүй нэмэгдэнэ. Одоогоор зөвхөн Excel дэмжинэ.",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Энэ төрлийн экспорт одоогоор дэмжигдээгүй",
      });
    }
  } catch (error) {
    next(error);
  }
});

// Гүйцэтгэлийн тайлан (Сарын төлөвлөгөөт орлого vs бодит орлого г.м ба Зардлын төсөв vs бодит зардал г.м)
exports.tailanGuitsegtgel = asyncHandler(async (req, res, next) => {
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
      turul = "sar", // "sar" (month) or "uliral" (quarter)
    } = source || {};

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

    const Geree = require("../models/geree");
    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
    const BankniiGuilgee = require("../models/bankniiGuilgee");

    // Date range
    const startDate = ekhlekhOgnoo
      ? new Date(ekhlekhOgnoo)
      : new Date(new Date().getFullYear(), 0, 1); // Start of year
    const endDate = duusakhOgnoo
      ? new Date(duusakhOgnoo)
      : new Date(); // Today

    // Get all active contracts
    const gereeMatch = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: "Идэвхтэй",
    };
    if (barilgiinId) gereeMatch.barilgiinId = String(barilgiinId);

    const activeGerees = await Geree(kholbolt).find(gereeMatch).lean();

    // Calculate planned monthly income from active contracts
    // For each contract, use niitTulbur as monthly expected income
    const plannedMonthlyIncome = activeGerees.reduce((sum, g) => {
      return sum + (g.niitTulbur || 0);
    }, 0);

    // Group by month or quarter
    const periods = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      let periodKey;

      if (turul === "uliral") {
        const quarter = Math.ceil(month / 3);
        periodKey = `${year}-Q${quarter}`;
        // Move to next quarter
        currentDate.setMonth(currentDate.getMonth() + 3);
      } else {
        periodKey = `${year}-${String(month).padStart(2, "0")}`;
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      if (!periods[periodKey]) {
        periods[periodKey] = {
          period: periodKey,
          year,
          month: turul === "sar" ? month : null,
          quarter: turul === "uliral" ? Math.ceil(month / 3) : null,
          plannedIncome: plannedMonthlyIncome,
          actualIncome: 0,
          incomeVariance: 0,
          incomeVariancePercent: 0,
          plannedExpenses: 0, // Will be calculated or configured
          actualExpenses: 0,
          expensesVariance: 0,
          expensesVariancePercent: 0,
        };
      }
    }

    // Calculate actual income from paid invoices
    const invoiceMatch = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: "Төлсөн",
    };
    if (barilgiinId) invoiceMatch.barilgiinId = String(barilgiinId);
    if (ekhlekhOgnoo || duusakhOgnoo) {
      invoiceMatch.tulsunOgnoo = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const paidInvoices = await NekhemjlekhiinTuukh(kholbolt)
      .find(invoiceMatch)
      .lean();

    // Group actual income by period
    paidInvoices.forEach((inv) => {
      if (!inv.tulsunOgnoo) return;
      const payDate = new Date(inv.tulsunOgnoo);
      const year = payDate.getFullYear();
      const month = payDate.getMonth() + 1;
      let periodKey;

      if (turul === "uliral") {
        const quarter = Math.ceil(month / 3);
        periodKey = `${year}-Q${quarter}`;
      } else {
        periodKey = `${year}-${String(month).padStart(2, "0")}`;
      }

      if (periods[periodKey]) {
        periods[periodKey].actualIncome += inv.niitTulbur || 0;
      }
    });

    // Calculate actual expenses from bank transactions
    const bankMatch = {
      baiguullagiinId: String(baiguullagiinId),
    };
    if (barilgiinId) bankMatch.barilgiinId = String(barilgiinId);
    if (ekhlekhOgnoo || duusakhOgnoo) {
      bankMatch.tranDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const bankTransactions = await BankniiGuilgee(kholbolt)
      .find(bankMatch)
      .lean();

    // Group actual expenses by period
    bankTransactions.forEach((trans) => {
      if (!trans.tranDate) return;
      const transDate = new Date(trans.tranDate);
      const year = transDate.getFullYear();
      const month = transDate.getMonth() + 1;
      let periodKey;

      if (turul === "uliral") {
        const quarter = Math.ceil(month / 3);
        periodKey = `${year}-Q${quarter}`;
      } else {
        periodKey = `${year}-${String(month).padStart(2, "0")}`;
      }

      if (periods[periodKey]) {
        // Expenses: negative amount or outcome field
        const expenseAmount =
          trans.outcome ||
          (trans.amount && trans.amount < 0 ? Math.abs(trans.amount) : 0);
        periods[periodKey].actualExpenses += expenseAmount;
      }
    });

    // Calculate variances and percentages
    const summary = Object.values(periods).map((period) => {
      period.incomeVariance = period.actualIncome - period.plannedIncome;
      period.incomeVariancePercent =
        period.plannedIncome > 0
          ? ((period.incomeVariance / period.plannedIncome) * 100).toFixed(2)
          : "0.00";

      period.expensesVariance = period.actualExpenses - period.plannedExpenses;
      period.expensesVariancePercent =
        period.plannedExpenses > 0
          ? ((period.expensesVariance / period.plannedExpenses) * 100).toFixed(2)
          : "0.00";

      return period;
    });

    // Sort by period
    summary.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (turul === "uliral") {
        return (a.quarter || 0) - (b.quarter || 0);
      }
      return (a.month || 0) - (b.month || 0);
    });

    // Calculate totals
    const totals = {
      plannedIncome: summary.reduce((sum, p) => sum + p.plannedIncome, 0),
      actualIncome: summary.reduce((sum, p) => sum + p.actualIncome, 0),
      plannedExpenses: summary.reduce((sum, p) => sum + p.plannedExpenses, 0),
      actualExpenses: summary.reduce((sum, p) => sum + p.actualExpenses, 0),
    };
    totals.incomeVariance = totals.actualIncome - totals.plannedIncome;
    totals.incomeVariancePercent =
      totals.plannedIncome > 0
        ? ((totals.incomeVariance / totals.plannedIncome) * 100).toFixed(2)
        : "0.00";
    totals.expensesVariance = totals.actualExpenses - totals.plannedExpenses;
    totals.expensesVariancePercent =
      totals.plannedExpenses > 0
        ? ((totals.expensesVariance / totals.plannedExpenses) * 100).toFixed(2)
        : "0.00";
    totals.netIncome = totals.actualIncome - totals.actualExpenses;
    totals.plannedNetIncome = totals.plannedIncome - totals.plannedExpenses;

    res.json({
      success: true,
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
        turul,
      },
      summary,
      totals,
      activeContractsCount: activeGerees.length,
    });
  } catch (error) {
    next(error);
  }
});

// Төлөгдөөгүй удсан авлага 2+ сар
exports.tailanUdsanAvlaga = asyncHandler(async (req, res, next) => {
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
    const { baiguullagiinId, barilgiinId } = source || {};

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

    const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

    // Calculate date 2 months ago
    const today = new Date();
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    twoMonthsAgo.setHours(0, 0, 0, 0);

    // Find unpaid invoices where payment due date (tulukhOgnoo) is more than 2 months ago
    const match = {
      baiguullagiinId: String(baiguullagiinId),
      tuluv: { $ne: "Төлсөн" }, // Not paid
      tulukhOgnoo: { $lt: twoMonthsAgo }, // Due date is more than 2 months ago
    };

    if (barilgiinId) match.barilgiinId = String(barilgiinId);

    const docs = await NekhemjlekhiinTuukh(kholbolt)
      .find(match)
      .lean()
      .sort({ tulukhOgnoo: 1 }); // Sort by due date, oldest first

    const result = [];
    let totalSum = 0;

    for (const d of docs) {
      // Calculate months overdue
      const dueDate = new Date(d.tulukhOgnoo);
      const monthsOverdue = Math.floor(
        (today - dueDate) / (1000 * 60 * 60 * 24 * 30)
      );

      const row = {
        gereeniiDugaar: d.gereeniiDugaar || "",
        ovog: d.ovog || "",
        ner: d.ner || "",
        utas: Array.isArray(d.utas) ? d.utas.join(", ") : d.utas || "",
        toot: d.toot || "",
        davkhar: d.davkhar || "",
        bairNer: d.bairNer || "",
        ognoo: d.ognoo || null,
        tulukhOgnoo: d.tulukhOgnoo || null,
        niitTulbur: d.niitTulbur || 0,
        tuluv: d.tuluv || "Төлөөгүй",
        monthsOverdue: monthsOverdue,
        dugaalaltDugaar: d.dugaalaltDugaar || null,
      };

      result.push(row);
      totalSum += d.niitTulbur || 0;
    }

    res.json({
      success: true,
      total: result.length,
      sum: totalSum,
      list: result,
      filterDate: twoMonthsAgo,
      currentDate: today,
    });
  } catch (error) {
    next(error);
  }
});

// Цуцлагдсан гэрээний авлага
exports.tailanTsutslasanGereeniiAvlaga = asyncHandler(
  async (req, res, next) => {
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
      const { baiguullagiinId, barilgiinId } = source || {};

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

      const Geree = require("../models/geree");
      const NekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

      // Find all cancelled gerees
      const gereeMatch = {
        baiguullagiinId: String(baiguullagiinId),
        tuluv: "Цуцалсан", // Cancelled contracts
      };

      if (barilgiinId) gereeMatch.barilgiinId = String(barilgiinId);

      const cancelledGerees = await Geree(kholbolt)
        .find(gereeMatch)
        .select("_id gereeniiDugaar ovog ner utas toot davkhar bairNer")
        .lean();

      if (cancelledGerees.length === 0) {
        return res.json({
          success: true,
          total: 0,
          sum: 0,
          list: [],
          message: "Цуцлагдсан гэрээ олдсонгүй",
        });
      }

      // Get gereeniiId list
      const gereeniiIdList = cancelledGerees.map((g) => g._id.toString());

      // Find unpaid invoices for these cancelled gerees
      const nekhemjlekhMatch = {
        baiguullagiinId: String(baiguullagiinId),
        gereeniiId: { $in: gereeniiIdList },
        tuluv: { $ne: "Төлсөн" }, // Not paid
      };

      if (barilgiinId) nekhemjlekhMatch.barilgiinId = String(barilgiinId);

      const unpaidInvoices = await NekhemjlekhiinTuukh(kholbolt)
        .find(nekhemjlekhMatch)
        .lean()
        .sort({ ognoo: -1 });

      // Create a map of gereeniiId to geree info
      const gereeMap = {};
      cancelledGerees.forEach((g) => {
        gereeMap[g._id.toString()] = g;
      });

      const result = [];
      let totalSum = 0;

      for (const invoice of unpaidInvoices) {
        const geree = gereeMap[invoice.gereeniiId] || {};

        const row = {
          gereeniiDugaar: invoice.gereeniiDugaar || geree.gereeniiDugaar || "",
          ovog: invoice.ovog || geree.ovog || "",
          ner: invoice.ner || geree.ner || "",
          utas: Array.isArray(invoice.utas)
            ? invoice.utas.join(", ")
            : invoice.utas || Array.isArray(geree.utas)
            ? geree.utas.join(", ")
            : geree.utas || "",
          toot: invoice.toot || geree.toot || "",
          davkhar: invoice.davkhar || geree.davkhar || "",
          bairNer: invoice.bairNer || geree.bairNer || "",
          ognoo: invoice.ognoo || null,
          tulukhOgnoo: invoice.tulukhOgnoo || null,
          niitTulbur: invoice.niitTulbur || 0,
          tuluv: invoice.tuluv || "Төлөөгүй",
          gereeniiTuluv: "Цуцалсан",
          dugaalaltDugaar: invoice.dugaalaltDugaar || null,
          gereeniiId: invoice.gereeniiId || "",
        };

        result.push(row);
        totalSum += invoice.niitTulbur || 0;
      }

      res.json({
        success: true,
        total: result.length,
        sum: totalSum,
        list: result,
        cancelledGereesCount: cancelledGerees.length,
      });
    } catch (error) {
      next(error);
    }
  }
);
