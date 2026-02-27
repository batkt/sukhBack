const { getKholboltByBaiguullagiinId } = require("../utils/dbConnection");
const Geree = require("../models/geree");
const GereeniiTulsunAvlaga = require("../models/gereeniiTulsunAvlaga");
const GereeniiTulukhAvlaga = require("../models/gereeniiTulukhAvlaga");

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

module.exports = { runDeleteSideEffects };
