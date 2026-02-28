const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");
const Geree = require("../models/geree");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");

function getNekhemjlekhiinTuukhModel(kholbolt) {
  const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
  const conn = kholbolt && kholbolt.kholbolt ? kholbolt : { kholbolt };
  return nekhemjlekhiinTuukh(conn);
}

/**
 * Recalculate and set geree.globalUldegdel from raw amounts (totalCharges - totalPayments).
 * totalCharges = geree.ekhniiUldegdel + SUM(invoice originals excl. ekhnii) + SUM(avlaga originals)
 * totalPayments = SUM(tulsunAvlaga.tulsunDun)
 * @param {string} gereeniiId - Contract ID
 * @param {string} baiguullagiinId - Org ID
 * @param {object} kholbolt - DB connection
 * @param {{ excludeInvoiceId?: string }} [opts] - If set, exclude this invoice (e.g. when it is about to be deleted)
 */
async function recalculateGereeGlobalUldegdel(
  gereeniiId,
  baiguullagiinId,
  kholbolt,
  opts = {},
) {
  const NekhemjlekhiinTuukh = getNekhemjlekhiinTuukhModel(kholbolt);
  const gid = String(gereeniiId);
  const oid = String(baiguullagiinId);

  const geree = await Geree(kholbolt)
    .findById(gereeniiId)
    .select("ekhniiUldegdel")
    .lean();
  if (!geree) return;

  // Start with geree-level ekhniiUldegdel
  let totalCharges = geree.ekhniiUldegdel || 0;

  // Sum ALL invoice original totals (excluding ekhniiUldegdel portion)
  const invoiceQuery = { baiguullagiinId: oid, gereeniiId: gid };
  if (opts.excludeInvoiceId) {
    invoiceQuery._id = { $ne: opts.excludeInvoiceId };
  }
  const allInvoices = await NekhemjlekhiinTuukh.find(invoiceQuery)
    .select("niitTulburOriginal niitTulbur ekhniiUldegdel")
    .lean();
  allInvoices.forEach((inv) => {
    const original = inv.niitTulburOriginal || inv.niitTulbur || 0;
    totalCharges += original - (inv.ekhniiUldegdel || 0);
  });

  // Sum ALL avlaga original amounts
  const allAvlaga = await GereeniiTulukhAvlaga(kholbolt)
    .find({ baiguullagiinId: oid, gereeniiId: gid })
    .select("undsenDun tulukhDun")
    .lean();
  allAvlaga.forEach((a) => {
    totalCharges += a.undsenDun || a.tulukhDun || 0;
  });

  // Sum ALL payments
  const allPayments = await GereeniiTulsunAvlaga(kholbolt)
    .find({ baiguullagiinId: oid, gereeniiId: gid })
    .select("tulsunDun")
    .lean();
  let totalPayments = 0;
  allPayments.forEach((p) => {
    totalPayments += p.tulsunDun || 0;
  });

  const newGlobal = totalCharges - totalPayments;
  const newPositive = Math.max(0, -newGlobal);

  await Geree(kholbolt).findByIdAndUpdate(gereeniiId, {
    $set: { globalUldegdel: newGlobal, positiveBalance: newPositive },
  });
}

/**
 * Delete an invoice and all connected data for a specific org only.
 * 1. Decrements Geree.globalUldegdel by unpaid amount
 * 2. Deletes GereeniiTulsunAvlaga records for this invoice (org-scoped)
 * 3. Deletes GereeniiTulukhAvlaga records for this invoice (org-scoped)
 * 4. Deletes the nekhemjlekhiinTuukh document
 * Call with (invoiceId, baiguullagiinId). Returns { success, error? }.
 */
async function deleteInvoice(invoiceId, baiguullagiinId) {
  if (!invoiceId || !baiguullagiinId) {
    return {
      success: false,
      statusCode: 400,
      error: "invoiceId and baiguullagiinId are required",
    };
  }

  const kholbolt = getKholboltByBaiguullagiinId(baiguullagiinId);
  if (!kholbolt) {
    return {
      success: false,
      statusCode: 404,
      error: "Холболтын мэдээлэл олдсонгүй (baiguullagiinId)",
    };
  }

  const Model = getNekhemjlekhiinTuukhModel(kholbolt);
  const invoiceDoc = await Model.findOne({
    _id: invoiceId,
    baiguullagiinId: String(baiguullagiinId),
  });
  if (!invoiceDoc) {
    return {
      success: false,
      statusCode: 404,
      error: "Нэхэмжлэх олдсонгүй",
    };
  }

  await invoiceDoc.deleteOne();
  return {
    success: true,
    message: "Нэхэмжлэх болон холбоотой бүртгэл устгагдлаа",
  };
}

/**
 * Delete all invoices (nekhemjlekhiinTuukh) for a given organization.
 * Each document is deleted individually so pre-delete hooks run and cascade
 * (Geree globalUldegdel, GereeniiTulsunAvlaga, GereeniiTulukhAvlaga) is applied.
 * Body: { baiguullagiinId }. Returns { success, deletedCount, message }.
 */
async function deleteAllInvoicesForOrg(baiguullagiinId) {
  if (!baiguullagiinId) {
    return {
      success: false,
      statusCode: 400,
      error: "baiguullagiinId is required",
    };
  }

  const kholbolt = getKholboltByBaiguullagiinId(baiguullagiinId);
  if (!kholbolt) {
    return {
      success: false,
      statusCode: 404,
      error: "Холболтын мэдээлэл олдсонгүй (baiguullagiinId)",
    };
  }

  const Model = getNekhemjlekhiinTuukhModel(kholbolt);
  const docs = await Model.find({
    baiguullagiinId: String(baiguullagiinId),
  }).lean();

  let deletedCount = 0;
  for (const doc of docs) {
    const fullDoc = await Model.findById(doc._id);
    if (fullDoc) {
      await fullDoc.deleteOne();
      deletedCount++;
    }
  }

  const orgId = String(baiguullagiinId);
  let tulsunDeleted = 0;
  let tulukhDeleted = 0;
  try {
    const tulsunResult = await GereeniiTulsunAvlaga(kholbolt).deleteMany({
      baiguullagiinId: orgId,
    });
    tulsunDeleted = tulsunResult.deletedCount ?? 0;
  } catch (e) {
    console.error(
      "[NEKHEMJLEKH] deleteAllInvoicesForOrg GereeniiTulsunAvlaga deleteMany error:",
      e.message,
    );
  }
  try {
    const tulukhResult = await GereeniiTulukhAvlaga(kholbolt).deleteMany({
      baiguullagiinId: orgId,
    });
    tulukhDeleted = tulukhResult.deletedCount ?? 0;
  } catch (e) {
    console.error(
      "[NEKHEMJLEKH] deleteAllInvoicesForOrg GereeniiTulukhAvlaga deleteMany error:",
      e.message,
    );
  }

  const GereeModel = Geree(kholbolt);
  const gereesInOrg = await GereeModel.find({ baiguullagiinId: orgId })
    .select("_id positiveBalance")
    .lean();
  for (const g of gereesInOrg) {
    const positive =
      typeof g.positiveBalance === "number" ? g.positiveBalance : 0;
    await GereeModel.findByIdAndUpdate(g._id, {
      $set: {
        globalUldegdel: -positive,
        guilgeenuudForNekhemjlekh: [],
      },
    });
  }
  if (gereesInOrg.length > 0) {
    console.log(
      `📉 [deleteAllInvoicesForOrg] Reset globalUldegdel and cleared guilgeenuudForNekhemjlekh for ${gereesInOrg.length} geree(s) in org ${orgId}`,
    );
  }

  return {
    success: true,
    deletedCount,
    deletedTulsunAvlaga: tulsunDeleted,
    deletedTulukhAvlaga: tulukhDeleted,
    gereeUpdatedCount: gereesInOrg.length,
    message: `${deletedCount} нэхэмжлэх, ${tulsunDeleted} түлсүн авлага, ${tulukhDeleted} төлөх авлага устгагдлаа; ${gereesInOrg.length} гэрээний үлдэгдэл шинэчлэгдлээ`,
  };
}

/**
 * Runs side effects when an invoice (nekhemjlekh) is deleted: cascade-delete related
 * gereeniiTulsunAvlaga and gereeniiTulukhAvlaga, then recalculate geree.globalUldegdel.
 * Called from nekhemjlekhiinTuukh model pre-delete hooks only.
 * @param {Object} doc - The invoice document being deleted (must have gereeniiId, baiguullagiinId)
 */
async function runDeleteSideEffects(doc) {
  console.log(
    "[NEKHEMJLEKH] runDeleteSideEffects entry",
    doc?._id?.toString(),
    doc?.gereeniiId?.toString(),
  );
  if (!doc || !doc.gereeniiId || !doc.baiguullagiinId) {
    return;
  }

  try {
    const kholbolt = getKholboltByBaiguullagiinId(doc.baiguullagiinId);
    if (!kholbolt) return;

    const oid = String(doc.baiguullagiinId);
    const invId = doc._id;

    try {
      const tulsunDeleteResult = await GereeniiTulsunAvlaga(
        kholbolt,
      ).deleteMany({
        baiguullagiinId: oid,
        $or: [{ nekhemjlekhId: String(invId) }, { nekhemjlekhId: invId }],
      });
      if (tulsunDeleteResult.deletedCount > 0) {
        console.log(
          `🗑️ [Middleware] Cascade deleted ${tulsunDeleteResult.deletedCount} gereeniiTulsunAvlaga for nekhemjlekh ${invId}`,
        );
      }
    } catch (tulsunError) {
      console.error(
        "Error cascade deleting gereeniiTulsunAvlaga:",
        tulsunError.message,
      );
    }

    try {
      const tulukhDeleteResult = await GereeniiTulukhAvlaga(
        kholbolt,
      ).deleteMany({
        baiguullagiinId: oid,
        $or: [{ nekhemjlekhId: String(invId) }, { nekhemjlekhId: invId }],
      });
      if (tulukhDeleteResult.deletedCount > 0) {
        console.log(
          `🗑️ [Middleware] Cascade deleted ${tulukhDeleteResult.deletedCount} gereeniiTulukhAvlaga for nekhemjlekh ${invId}`,
        );
      }
    } catch (tulukhError) {
      console.error(
        "Error cascade deleting gereeniiTulukhAvlaga:",
        tulukhError.message,
      );
    }

    await recalculateGereeGlobalUldegdel(doc.gereeniiId, oid, kholbolt, {
      excludeInvoiceId: invId,
    });
    console.log(
      `📉 [Middleware] Recalculated geree.globalUldegdel for contract ${doc.gereeniiId} after invoice delete`,
    );
  } catch (error) {
    console.error("Error in runDeleteSideEffects:", error);
  }
}

module.exports = {
  runDeleteSideEffects,
  deleteInvoice,
  deleteAllInvoicesForOrg,
};
