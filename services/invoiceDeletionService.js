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

  return {
    success: true,
    deletedCount,
    message: `${deletedCount} нэхэмжлэх устгагдлаа`,
  };
}

/**
 * Runs side effects when an invoice (nekhemjlekh) is deleted: update geree globalUldegdel
 * and cascade-delete related gereeniiTulsunAvlaga and gereeniiTulukhAvlaga records.
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

    if (!kholbolt) {
      return;
    }

    const unpaidAmount =
      typeof doc.uldegdel === "number"
        ? Math.max(0, doc.uldegdel)
        : doc.tuluv === "Төлсөн"
          ? 0
          : doc.niitTulbur;

    if (unpaidAmount > 0) {
      await Geree(kholbolt).findByIdAndUpdate(doc.gereeniiId, {
        $inc: { globalUldegdel: -unpaidAmount },
      });
      console.log(
        `📉 [Middleware] Decremented globalUldegdel by ${unpaidAmount} (unpaid) for invoice ${doc.nekhemjlekhiinDugaar || doc._id}`,
      );
    } else {
      console.log(
        `ℹ️ [Middleware] No globalUldegdel decrement needed for ${doc.tuluv} invoice ${doc.nekhemjlekhiinDugaar || doc._id}`,
      );
    }

    try {
      const tulsunDeleteResult = await GereeniiTulsunAvlaga(
        kholbolt,
      ).deleteMany({
        baiguullagiinId: String(doc.baiguullagiinId),
        $or: [{ nekhemjlekhId: String(doc._id) }, { nekhemjlekhId: doc._id }],
      });
      if (tulsunDeleteResult.deletedCount > 0) {
        console.log(
          `🗑️ [Middleware] Cascade deleted ${tulsunDeleteResult.deletedCount} gereeniiTulsunAvlaga records for nekhemjlekh ${doc._id}`,
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
        baiguullagiinId: String(doc.baiguullagiinId),
        $or: [{ nekhemjlekhId: String(doc._id) }, { nekhemjlekhId: doc._id }],
      });
      if (tulukhDeleteResult.deletedCount > 0) {
        console.log(
          `🗑️ [Middleware] Cascade deleted ${tulukhDeleteResult.deletedCount} gereeniiTulukhAvlaga records for nekhemjlekh ${doc._id}`,
        );
      }
    } catch (tulukhError) {
      console.error(
        "Error cascade deleting gereeniiTulukhAvlaga:",
        tulukhError.message,
      );
    }
  } catch (error) {
    console.error("Error in handleBalanceOnDelete middleware:", error);
  }
}

module.exports = {
  runDeleteSideEffects,
  deleteInvoice,
  deleteAllInvoicesForOrg,
};
