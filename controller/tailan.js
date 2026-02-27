const asyncHandler = require("express-async-handler");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Зогсоолын тайлан - Оршин суугчдын урьсан зочдын машин бүртгэл
exports.tailanZogsool = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const { Uilchluulegch } = require("sukhParking-v1");
    const OrshinSuugchMashin = require("../models/orshinSuugchMashin");

    const source = req.method === "GET" ? req.query : req.body;
    const {
      baiguullagiinId,
      barilgiinId,
      ekhlekhOgnoo,
      duusakhOgnoo,
      orshinSuugch,
      toot,
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

    const startDate = ekhlekhOgnoo
      ? new Date(ekhlekhOgnoo)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = duusakhOgnoo
      ? new Date(duusakhOgnoo)
      : new Date(new Date().setHours(23, 59, 59, 999));

    // 1. Get guest car registrations (OrshinSuugchMashin) - zochinTurul != "Оршин суугч"
    const osmPipeline = [
      { $match: { orshinSuugchiinId: { $exists: true, $ne: "" } } },
      { $addFields: { orshinSuugchObjId: { $toObjectId: "$orshinSuugchiinId" } } },
      {
        $lookup: {
          from: "orshinSuugch",
          localField: "orshinSuugchObjId",
          foreignField: "_id",
          as: "resident",
        },
      },
      { $unwind: "$resident" },
      {
        $match: {
          zochinTurul: { $ne: "Оршин суугч" },
          $or: [
            { "resident.baiguullagiinId": String(baiguullagiinId) },
            { "resident.baiguullagiinId": baiguullagiinId },
          ],
        },
      },
    ];
    const lastMatch = osmPipeline[osmPipeline.length - 1].$match;
    if (barilgiinId) lastMatch["resident.barilgiinId"] = String(barilgiinId);
    if (orshinSuugch) {
      const re = new RegExp(escapeRegex(String(orshinSuugch).trim()), "i");
      osmPipeline.push({
        $match: {
          $or: [
            { "resident.ner": re },
            { "resident.ovog": re },
          ],
        },
      });
    }
    if (toot) {
      const tootRe = new RegExp(escapeRegex(String(toot).trim()), "i");
      osmPipeline.push({
        $match: {
          $or: [
            { "resident.toot": tootRe },
            { ezenToot: tootRe },
          ],
        },
      });
    }

    const guestRegistrations = await OrshinSuugchMashin(db.erunkhiiKholbolt).aggregate(osmPipeline);

    // Build plate -> resident map
    const plateToResident = {};
    for (const r of guestRegistrations) {
      const plate = (r.mashiniiDugaar || "").trim().toUpperCase();
      if (!plate) continue;
      const residentId = String(r.orshinSuugchiinId || r.resident?._id);
      if (!plateToResident[plate]) {
        plateToResident[plate] = {
          orshinSuugchiinId: residentId,
          ner: r.resident?.ner || "",
          ovog: r.resident?.ovog || "",
          toot: r.resident?.toot || r.ezenToot || "",
          davkhar: r.resident?.davkhar || "",
          utas: Array.isArray(r.resident?.utas) ? (r.resident.utas[0] || "") : (r.resident?.utas || ""),
        };
      }
    }

    // 2. Get Uilchluulegch (parking records) for date range
    const ulMatch = {
      baiguullagiinId: String(baiguullagiinId),
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (barilgiinId) ulMatch.barilgiinId = String(barilgiinId);

    const uilchluulegchuud = await Uilchluulegch(kholbolt, true)
      .find(ulMatch)
      .lean();

    // 3. Aggregate by resident
    const residentMap = {};
    const guestCarList = [];
    const guestCarSeen = new Set();

    for (const u of uilchluulegchuud) {
      const plate = (u.mashiniiDugaar || "").trim().toUpperCase();
      const resident = plateToResident[plate];
      if (!resident) continue; // Not a guest car, skip

      const mur = u.tuukh?.[0];
      const tsag = mur?.tsagiinTuukh?.[0];
      const orsonTsag = tsag?.orsonTsag ? new Date(tsag.orsonTsag) : null;
      const garsanTsag = tsag?.garsanTsag ? new Date(tsag.garsanTsag) : null;
      const zogssonMinut = orsonTsag && garsanTsag
        ? Math.round((garsanTsag - orsonTsag) / 60000)
        : orsonTsag
        ? Math.round((new Date() - orsonTsag) / 60000)
        : 0;
      const khungulsunMinut = Number(mur?.khungulult || 0) || 0;
      const tulbur = Number(u.niitDun || 0) || 0;
      const tulsunDun = mur?.tulbur?.reduce((s, t) => s + (Number(t?.dun) || 0), 0) || 0;
      const tuluv = mur?.tuluv;
      const tuluvLabel = tuluv === 1 || tuluv === 2 ? "Төлбөртэй" : tulbur <= 0 ? "Үнэгүй" : "Төлөөгүй";

      const detailRow = {
        mashiniiDugaar: u.mashiniiDugaar,
        zogssonMinut,
        khungulsunMinut,
        tulbur,
        tuluv: tuluvLabel,
        orshinSuugchiinId: resident.orshinSuugchiinId,
        ner: resident.ner,
        toot: resident.toot,
        davkhar: resident.davkhar,
        utas: resident.utas,
      };
      const rid = resident.orshinSuugchiinId;
      if (!residentMap[rid]) {
        residentMap[rid] = {
          ner: resident.ner,
          toot: resident.toot,
          davkhar: resident.davkhar,
          utas: resident.utas,
          urisanMachinToo: 0,
          uniquePlates: new Set(),
          niitTulbur: 0,
          khungulultMinut: 0,
          tulsunDun: 0,
          uldegdelTulbur: 0,
          details: [],
        };
      }
      residentMap[rid].uniquePlates.add(plate);
      residentMap[rid].urisanMachinToo = residentMap[rid].uniquePlates.size;
      residentMap[rid].niitTulbur += tulbur;
      residentMap[rid].khungulultMinut += khungulsunMinut;
      residentMap[rid].tulsunDun += tulsunDun;
      residentMap[rid].details.push(detailRow);

      const carKey = `${plate}|${resident.orshinSuugchiinId}`;
      if (!guestCarSeen.has(carKey)) {
        guestCarSeen.add(carKey);
        guestCarList.push({
          mashiniiDugaar: u.mashiniiDugaar,
          orshinSuugchiinNer: resident.ner,
          davkhar: resident.davkhar,
          toot: resident.toot,
          utas: typeof resident.utas === "string" ? resident.utas : (Array.isArray(resident.utas) ? resident.utas[0] : resident.utas) || "",
        });
      }
    }

    // Calculate uldegdel per resident
    for (const rid of Object.keys(residentMap)) {
      const r = residentMap[rid];
      r.uldegdelTulbur = Math.max(0, r.niitTulbur - r.tulsunDun);
    }

    const residentSummary = Object.entries(residentMap).map(([id, r]) => ({
      orshinSuugchiinId: id,
      ner: r.ner,
      toot: r.toot,
      urisanMachinToo: r.urisanMachinToo,
      niitTulbur: r.niitTulbur,
      khungulultMinut: r.khungulultMinut,
      tulsunDun: r.tulsunDun,
      uldegdelTulbur: r.uldegdelTulbur,
    }));

    const niit = Object.values(residentMap).reduce(
      (a, r) => ({
        urisanMachinToo: a.urisanMachinToo + (r.urisanMachinToo || 0),
        niitTulbur: a.niitTulbur + (r.niitTulbur || 0),
        khungulultMinut: a.khungulultMinut + (r.khungulultMinut || 0),
        tulsunDun: a.tulsunDun + (r.tulsunDun || 0),
        uldegdelTulbur: a.uldegdelTulbur + (r.uldegdelTulbur || 0),
      }),
      { urisanMachinToo: 0, niitTulbur: 0, khungulultMinut: 0, tulsunDun: 0, uldegdelTulbur: 0 }
    );

    let selectedDetail = null;
    if (orshinSuugch || toot) {
      const matchResident = residentSummary.find(
        (r) =>
          (orshinSuugch && (r.ner || "").toLowerCase().includes(String(orshinSuugch).toLowerCase())) ||
          (toot && String(r.toot || "").includes(String(toot)))
      );
      if (matchResident) {
        selectedDetail = residentMap[matchResident.orshinSuugchiinId]?.details || [];
      }
    }

    res.json({
      success: true,
      filter: {
        baiguullagiinId,
        barilgiinId: barilgiinId || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
        orshinSuugch: orshinSuugch || null,
        toot: toot || null,
      },
      residentSummary,
      niit,
      guestCarList,
      selectedDetail,
    });
  } catch (error) {
    next(error);
  }
});

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
      gereeniiDugaar, // Гэрээний дугаар
      ovog,
      ner,
      orshinSuugch, // Оршин суугч - searches ovog or ner
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
    const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
    const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
    const Geree = require("../models/geree");

    // Build common filters for Geree metadata
    const metadataMatch = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) metadataMatch.barilgiinId = String(barilgiinId);
    if (bairNer) metadataMatch.bairNer = bairNer;
    if (orts) metadataMatch.orts = orts;
    if (davkhar) {
      const v = String(davkhar).trim();
      if (v) metadataMatch.davkhar = { $regex: escapeRegex(v), $options: "i" };
    }
    if (toot) {
      const tootVal = String(toot).trim();
      if (tootVal) {
        const re = escapeRegex(tootVal);
        metadataMatch.$and = metadataMatch.$and || [];
        metadataMatch.$and.push({
          $or: [
            { toot: { $regex: re, $options: "i" } },
            { "toots.toot": { $regex: re, $options: "i" } }, // Check in toots array if applicable
            { "medeelel.toot": { $regex: re, $options: "i" } },
          ],
        });
      }
    }
    if (gereeniiDugaar) {
      const v = String(gereeniiDugaar).trim();
      if (v)
        metadataMatch.gereeniiDugaar = {
          $regex: escapeRegex(v),
          $options: "i",
        };
    }
    if (orshinSuugch) {
      const val = String(orshinSuugch).trim();
      if (val) {
        const re = escapeRegex(val);
        metadataMatch.$or = [
          { ovog: { $regex: re, $options: "i" } },
          { ner: { $regex: re, $options: "i" } },
        ];
      }
    } else {
      if (ovog) {
        const v = String(ovog).trim();
        if (v) metadataMatch.ovog = { $regex: escapeRegex(v), $options: "i" };
      }
      if (ner) {
        const v = String(ner).trim();
        if (v) metadataMatch.ner = { $regex: escapeRegex(v), $options: "i" };
      }
    }

    // Date range filter
    let dateFilter = {};
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      if (ekhlekhOgnoo) start.setHours(0, 0, 0, 0);

      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      if (duusakhOgnoo) end.setHours(23, 59, 59, 999);

      dateFilter = { $gte: start, $lte: end };
    }

    // 1. Get Invoices (NekhemjlekhiinTuukh)
    const invoiceMatch = { ...metadataMatch };
    if (dateFilter.$gte) invoiceMatch.ognoo = dateFilter;

    // 2. Get Standalone Tulukh (Receivables)
    const tulukhMatch = {
      baiguullagiinId: String(baiguullagiinId),
      nekhemjlekhId: { $in: [null, ""] },
    };
    if (barilgiinId) tulukhMatch.barilgiinId = String(barilgiinId);
    if (dateFilter.$gte) tulukhMatch.ognoo = dateFilter;
    if (gereeniiDugaar) {
      tulukhMatch.gereeniiDugaar = {
        $regex: escapeRegex(gereeniiDugaar),
        $options: "i",
      };
    }

    // 3. Get Standalone Tulsun (Payments/Income)
    const tulsunMatch = {
      baiguullagiinId: String(baiguullagiinId),
      nekhemjlekhId: { $in: [null, ""] },
    };
    if (barilgiinId) tulsunMatch.barilgiinId = String(barilgiinId);
    if (dateFilter.$gte) tulsunMatch.ognoo = dateFilter;
    if (gereeniiDugaar) {
      tulsunMatch.gereeniiDugaar = {
        $regex: escapeRegex(gereeniiDugaar),
        $options: "i",
      };
    }

    const [invoices, standaloneTulukh, standaloneTulsun] = await Promise.all([
      NekhemjlekhiinTuukh(kholbolt).find(invoiceMatch).lean().sort({ ognoo: -1 }),
      GereeniiTulukhAvlaga(kholbolt).find(tulukhMatch).lean(),
      GereeniiTulsunAvlaga(kholbolt).find(tulsunMatch).lean(),
    ]);

    // Gather all gereeIds from standalone records to fetch their metadata if metadata filters are used
    const standaloneGereeniiIds = new Set([
      ...standaloneTulukh.map((s) => String(s.gereeniiId)),
      ...standaloneTulsun.map((s) => String(s.gereeniiId)),
    ]);

    // Fetch contracts for standalone records to filter and get metadata
    const standaloneGereeMetadata = await Geree(kholbolt)
      .find({
        _id: { $in: Array.from(standaloneGereeniiIds) },
        ...metadataMatch,
      })
      .lean();

    const gereeMap = {};
    standaloneGereeMetadata.forEach((g) => {
      gereeMap[String(g._id)] = g;
    });

    const paid = [];
    const unpaid = [];
    let paidSum = 0;
    let unpaidSum = 0;

    // Process Invoices
    for (const d of invoices) {
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
        toot: d.medeelel?.toot || d.toot || "",
        davkhar: d.davkhar || "",
        bairNer: d.bairNer || "",
        orts: d.orts || "",
        ognoo: d.ognoo || null,
        tulukhOgnoo: d.tulukhOgnoo || null,
        niitTulbur: d.niitTulbur || 0,
        tuluv: d.tuluv || "Төлөөгүй",
        dugaalaltDugaar: d.dugaalaltDugaar || null,
        gereeniiId: d.gereeniiId || "",
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

    // Process Standalone Receivables (e.g., Initial Balance)
    for (const s of standaloneTulukh) {
      const g = gereeMap[String(s.gereeniiId)];
      if (!g) continue; // Filtered out by metadataMatch

      const row = {
        gereeniiDugaar: s.gereeniiDugaar || g.gereeniiDugaar || "",
        ovog: g.ovog || "",
        ner: g.ner || "",
        utas: g.utas || [],
        toot: g.toot || "",
        davkhar: g.davkhar || "",
        bairNer: g.bairNer || "",
        orts: g.orts || "1",
        ognoo: s.ognoo || s.createdAt || null,
        tulukhOgnoo: s.ognoo || s.createdAt || null,
        niitTulbur: s.tulukhDun || s.undsenDun || 0,
        uldegdel: s.uldegdel || 0,
        tuluv: "Төлөөгүй",
        gereeniiId: String(s.gereeniiId),
        nememjlekh: {
          zardluud: [
            {
              ner: s.zardliinNer || "Авлага",
              dun: s.undsenDun || 0,
              tulukhDun: s.tulukhDun || 0,
              tailbar: s.tailbar || "",
              isEkhniiUldegdel: s.ekhniiUldegdelEsekh,
            },
          ],
          guilgeenuud: [],
        },
      };
      unpaid.push(row);
      unpaidSum += row.niitTulbur;
    }

    // Process Standalone Payments (Income)
    for (const p of standaloneTulsun) {
      const g = gereeMap[String(p.gereeniiId)];
      if (!g) continue;

      const row = {
        gereeniiDugaar: p.gereeniiDugaar || g.gereeniiDugaar || "",
        ovog: g.ovog || "",
        ner: g.ner || "",
        utas: g.utas || [],
        toot: g.toot || "",
        davkhar: g.davkhar || "",
        bairNer: g.bairNer || "",
        orts: g.orts || "1",
        ognoo: p.ognoo || p.tulsunOgnoo || p.createdAt || null,
        tulukhOgnoo: p.ognoo || null,
        niitTulbur: p.tulsunDun || 0,
        tuluv: "Төлсөн",
        gereeniiId: String(p.gereeniiId),
        nememjlekh: {
          zardluud: [],
          guilgeenuud: [
            {
              tailbar: p.tailbar || "Төлөлт (Нэхэмжлэхгүй)",
              tulsunDun: p.tulsunDun || 0,
              ognoo: p.ognoo || p.createdAt,
            },
          ],
        },
      };
      paid.push(row);
      paidSum += row.niitTulbur;
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
        gereeniiDugaar: gereeniiDugaar || null,
        orshinSuugch: orshinSuugch || null,
        ekhlekhOgnoo: ekhlekhOgnoo || null,
        duusakhOgnoo: duusakhOgnoo || null,
      },
      total: paid.length + unpaid.length,
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
      orshinSuugch,
      toot,
      davkhar,
      gereeniiDugaar,
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

    if (davkhar) {
      const v = String(davkhar).trim();
      if (v) match.davkhar = { $regex: escapeRegex(v), $options: "i" };
    }
    if (toot) {
      const tootVal = String(toot).trim();
      if (tootVal) {
        const re = escapeRegex(tootVal);
        match.$and = match.$and || [];
        match.$and.push({
          $or: [
            { toot: { $regex: re, $options: "i" } },
            { "medeelel.toot": { $regex: re, $options: "i" } },
          ],
        });
      }
    }
    if (gereeniiDugaar) {
      const v = String(gereeniiDugaar).trim();
      if (v) match.gereeniiDugaar = { $regex: escapeRegex(v), $options: "i" };
    }
    if (orshinSuugch) {
      const val = String(orshinSuugch).trim();
      if (val) {
        const re = escapeRegex(val);
        match.$or = [
          { ovog: { $regex: re, $options: "i" } },
          { ner: { $regex: re, $options: "i" } },
        ];
      }
    }

    // Date range filter
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      if (ekhlekhOgnoo) start.setHours(0, 0, 0, 0);

      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      if (duusakhOgnoo) end.setHours(23, 59, 59, 999);

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
    const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");
    const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
    const Geree = require("../models/geree");

    // 1. Build Metadata Match
    const metadataMatch = { baiguullagiinId: String(baiguullagiinId) };
    if (barilgiinId) metadataMatch.barilgiinId = String(barilgiinId);
    if (bairNer) metadataMatch.bairNer = bairNer;
    if (toot) {
      const re = escapeRegex(String(toot).trim());
      metadataMatch.$and = metadataMatch.$and || [];
      metadataMatch.$and.push({
        $or: [
          { toot: { $regex: re, $options: "i" } },
          { "toots.toot": { $regex: re, $options: "i" } },
          { "medeelel.toot": { $regex: re, $options: "i" } },
        ],
      });
    }
    if (davkhar) {
      metadataMatch.davkhar = {
        $regex: escapeRegex(String(davkhar).trim()),
        $options: "i",
      };
    }
    if (gereeniiDugaar) {
      metadataMatch.gereeniiDugaar = {
        $regex: escapeRegex(String(gereeniiDugaar).trim()),
        $options: "i",
      };
    }
    if (ovog) metadataMatch.ovog = { $regex: escapeRegex(ovog), $options: "i" };
    if (ner) metadataMatch.ner = { $regex: escapeRegex(ner), $options: "i" };

    // 2. Build Date Filter
    let dateFilter = {};
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      if (ekhlekhOgnoo) start.setHours(0, 0, 0, 0);

      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      if (duusakhOgnoo) end.setHours(23, 59, 59, 999);

      dateFilter = { $gte: start, $lte: end };
    }

    // 3. Find matching contracts to handle standalone records metadata
    const matchingGerees = await Geree(kholbolt)
      .find(metadataMatch)
      .select("_id gereeniiDugaar ovog ner utas toot davkhar bairNer orts")
      .lean();

    const gereeIds = matchingGerees.map((g) => String(g._id));
    const gereeMap = {};
    matchingGerees.forEach((g) => (gereeMap[String(g._id)] = g));

    // 4. Construct Queries
    const invoiceMatch = { ...metadataMatch };
    if (dateFilter.$gte) invoiceMatch.ognoo = dateFilter;
    if (tuluv) invoiceMatch.tuluv = tuluv;

    const tulukhMatch = {
      baiguullagiinId: String(baiguullagiinId),
      gereeniiId: { $in: gereeIds },
      nekhemjlekhId: { $in: [null, ""] },
    };
    if (dateFilter.$gte) tulukhMatch.ognoo = dateFilter;
    if (tuluv && tuluv !== "Төлөөгүй") {
      // Standalone Tulukh is always "Төлөөгүй"
      tulukhMatch._id = null; // Forces empty result if searching specifically for paid
    }

    const tulsunMatch = {
      baiguullagiinId: String(baiguullagiinId),
      gereeniiId: { $in: gereeIds },
      nekhemjlekhId: { $in: [null, ""] },
    };
    if (dateFilter.$gte) tulsunMatch.ognoo = dateFilter;
    if (tuluv && tuluv !== "Төлсөн") {
      tulsunMatch._id = null; // Forces empty result if searching specifically for unpaid
    }

    // 5. Execute Queries (For history, we fetch all and then paginate manually to handle merging)
    // Alternatively, we could query just the invoices if stats are the main concern, 
    // but for "Tuukh" users expect to see everything.
    const [invoices, standaloneTulukh, standaloneTulsun] = await Promise.all([
      NekhemjlekhiinTuukh(kholbolt).find(invoiceMatch).lean().sort({ ognoo: -1 }),
      GereeniiTulukhAvlaga(kholbolt).find(tulukhMatch).lean().sort({ ognoo: -1 }),
      GereeniiTulsunAvlaga(kholbolt).find(tulsunMatch).lean().sort({ ognoo: -1 }),
    ]);

    // Merge and format
    const combinedList = [];

    // Add Invoices
    for (const d of invoices) {
      combinedList.push({
        _id: d._id,
        gereeniiDugaar: d.gereeniiDugaar || "",
        gereeniiId: d.gereeniiId || "",
        ovog: d.ovog || "",
        ner: d.ner || "",
        utas: d.utas || [],
        toot: d.medeelel?.toot || d.toot || "",
        davkhar: d.davkhar || "",
        bairNer: d.bairNer || "",
        orts: d.orts || "",
        ognoo: d.ognoo || null,
        tulukhOgnoo: d.tulukhOgnoo || null,
        tulsunOgnoo: d.tulsunOgnoo || null,
        niitTulbur: d.niitTulbur || 0,
        ekhniiUldegdel: d.ekhniiUldegdel,
        tuluv: d.tuluv || "Төлөөгүй",
        nememjlekh: {
          zardluud: d.medeelel?.zardluud || [],
          guilgeenuud: d.medeelel?.guilgeenuud || [],
        },
        type: "invoice",
      });
    }

    // Add Standalone Receivables
    for (const s of standaloneTulukh) {
      const g = gereeMap[String(s.gereeniiId)];
      if (!g) continue;
      combinedList.push({
        _id: s._id,
        gereeniiDugaar: s.gereeniiDugaar || g.gereeniiDugaar || "",
        gereeniiId: String(s.gereeniiId),
        ovog: g.ovog || "",
        ner: g.ner || "",
        utas: g.utas || [],
        toot: g.toot || "",
        davkhar: g.davkhar || "",
        bairNer: g.bairNer || "",
        orts: g.orts || "1",
        ognoo: s.ognoo || s.createdAt || null,
        tulukhOgnoo: s.ognoo || null,
        niitTulbur: s.undsenDun || 0,
        uldegdel: s.uldegdel || 0,
        tuluv: "Төлөөгүй",
        nememjlekh: {
          zardluud: [
            {
              ner: s.zardliinNer || "Авлага",
              dun: s.undsenDun || 0,
              tulukhDun: s.tulukhDun || 0,
              tailbar: s.tailbar || "",
              isEkhniiUldegdel: s.ekhniiUldegdelEsekh,
            },
          ],
          guilgeenuud: [],
        },
        type: "receivable",
      });
    }

    // Add Standalone Payments
    for (const p of standaloneTulsun) {
      const g = gereeMap[String(p.gereeniiId)];
      if (!g) continue;
      combinedList.push({
        _id: p._id,
        gereeniiDugaar: p.gereeniiDugaar || g.gereeniiDugaar || "",
        gereeniiId: String(p.gereeniiId),
        ovog: g.ovog || "",
        ner: g.ner || "",
        utas: g.utas || [],
        toot: g.toot || "",
        davkhar: g.davkhar || "",
        bairNer: g.bairNer || "",
        orts: g.orts || "1",
        ognoo: p.ognoo || p.tulsunOgnoo || p.createdAt || null,
        tulsunOgnoo: p.tulsunOgnoo || p.createdAt || null,
        niitTulbur: p.tulsunDun || 0,
        tuluv: "Төлсөн",
        nememjlekh: {
          zardluud: [],
          guilgeenuud: [
            {
              tailbar: p.tailbar || "Төлөлт (Нэхэмжлэхгүй)",
              tulsunDun: p.tulsunDun || 0,
              ognoo: p.ognoo || p.createdAt,
            },
          ],
        },
        type: "payment",
      });
    }

    // Sort combined list
    combinedList.sort((a, b) => {
      const da = a.ognoo ? new Date(a.ognoo).getTime() : 0;
      const db = b.ognoo ? new Date(b.ognoo).getTime() : 0;
      return db - da;
    });

    // Calculate total sums for stats
    let totalTulbur = 0;
    let totalTulsen = 0;
    let countTulsen = 0;
    let totalTuluugui = 0;
    let countTuluugui = 0;

    combinedList.forEach((item) => {
      const amt = Number(item.niitTulbur) || 0;
      totalTulbur += amt;
      if (item.tuluv === "Төлсөн") {
        totalTulsen += amt;
        countTulsen++;
      } else {
        totalTuluugui += amt;
        countTuluugui++;
      }
    });

    // Paginate
    const skip = (Number(khuudasniiDugaar) - 1) * Number(khuudasniiKhemjee);
    const paginatedList = combinedList.slice(
      skip,
      skip + Number(khuudasniiKhemjee),
    );

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
        niitMur: combinedList.length,
        niitKhuudas: Math.ceil(combinedList.length / Number(khuudasniiKhemjee)),
      },
      stats: {
        niitTulbur: totalTulbur,
        tulsen: {
          total: totalTulsen,
          count: countTulsen,
        },
        tuluugui: {
          total: totalTuluugui,
          count: countTuluugui,
        },
      },
      list: paginatedList,
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
      orshinSuugch,
      toot,
      davkhar,
      gereeniiDugaar,
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

    if (davkhar) {
      const v = String(davkhar).trim();
      if (v) match.davkhar = { $regex: escapeRegex(v), $options: "i" };
    }
    if (toot) {
      const tootVal = String(toot).trim();
      if (tootVal) {
        const re = escapeRegex(tootVal);
        match.$and = match.$and || [];
        match.$and.push({
          $or: [
            { toot: { $regex: re, $options: "i" } },
            { "medeelel.toot": { $regex: re, $options: "i" } },
          ],
        });
      }
    }
    if (gereeniiDugaar) {
      const v = String(gereeniiDugaar).trim();
      if (v) match.gereeniiDugaar = { $regex: escapeRegex(v), $options: "i" };
    }
    if (orshinSuugch) {
      const val = String(orshinSuugch).trim();
      if (val) {
        const re = escapeRegex(val);
        match.$and = match.$and || [];
        match.$and.push({
          $or: [
            { ovog: { $regex: re, $options: "i" } },
            { ner: { $regex: re, $options: "i" } },
          ],
        });
      }
    }

    // Date range filter (based on invoice date or due date)
    if (ekhlekhOgnoo || duusakhOgnoo) {
      const start = ekhlekhOgnoo
        ? new Date(ekhlekhOgnoo)
        : new Date("1970-01-01");
      const end = duusakhOgnoo
        ? new Date(duusakhOgnoo)
        : new Date("2999-12-31");
      const dateOr = [
        { ognoo: { $gte: start, $lte: end } },
        { tulukhOgnoo: { $gte: start, $lte: end } },
      ];
      match.$and = match.$and || [];
      match.$and.push({ $or: dateOr });
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
      "guitsetgel": exports.tailanGuitsetgel,
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
    } else if (report === "guitsetgel") {
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
      fileName = "guitsetgel";
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
exports.tailanGuitsetgel = asyncHandler(async (req, res, next) => {
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
