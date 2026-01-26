const { db } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const Geree = require("../models/geree");

/**
 * Mark invoices as paid
 * @param {Object} options - Payment options
 * @param {String} options.baiguullagiinId - Organization ID (required)
 * @param {String} [options.orshinSuugchId] - User ID (mark all invoices for this user)
 * @param {String} [options.gereeniiId] - Contract ID (mark all invoices for this contract)
 * @param {Array<String>} [options.nekhemjlekhiinIds] - Array of invoice IDs (mark specific invoices)
 * @param {Boolean} [options.markEkhniiUldegdel] - If true, also mark invoices with ekhniiUldegdel (default: false)
 * @param {String} [options.tailbar] - Payment description/notes
 * @returns {Object} - Result with updated invoices count and details
 */
async function markInvoicesAsPaid(options) {
  const {
    baiguullagiinId,
    orshinSuugchId,
    gereeniiId,
    nekhemjlekhiinIds,
    markEkhniiUldegdel = false,
    tailbar = null,
  } = options;

  if (!baiguullagiinId) {
    throw new Error("baiguullagiinId is required");
  }

  // Validate that at least one identifier is provided
  if (!orshinSuugchId && !gereeniiId && (!nekhemjlekhiinIds || nekhemjlekhiinIds.length === 0)) {
    throw new Error("Either orshinSuugchId, gereeniiId, or nekhemjlekhiinIds must be provided");
  }

  // Get database connection
  const kholbolt = db.kholboltuud.find(
    (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
  );

  if (!kholbolt) {
    throw new Error(`Холболт олдсонгүй: ${baiguullagiinId}`);
  }

  const NekhemjlekhiinTuukh = nekhemjlekhiinTuukh(kholbolt);

  // Build query to find invoices
  const query = {
    baiguullagiinId: String(baiguullagiinId),
    tuluv: { $ne: "Төлсөн" }, // Only unpaid invoices
  };

  // If markEkhniiUldegdel is false, exclude invoices with ekhniiUldegdel
  // (focus on regular ashiglaltiinZardluud invoices)
  // If markEkhniiUldegdel is true, include all invoices (both regular and ekhniiUldegdel)
  if (!markEkhniiUldegdel) {
    query.$or = [
      { ekhniiUldegdel: { $exists: false } },
      { ekhniiUldegdel: 0 },
      { ekhniiUldegdel: null },
    ];
  }

  if (nekhemjlekhiinIds && nekhemjlekhiinIds.length > 0) {
    // Mark specific invoices by IDs
    query._id = { $in: nekhemjlekhiinIds };
  } else if (orshinSuugchId) {
    // Mark all invoices for a user
    // First, get all gerees for this user
    const GereeModel = Geree(kholbolt);
    const gerees = await GereeModel.find({
      orshinSuugchId: String(orshinSuugchId),
      baiguullagiinId: String(baiguullagiinId),
      tuluv: { $ne: "Цуцалсан" }, // Only active contracts
    }).select("_id").lean();

    if (gerees.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: "No active contracts found for this user",
        invoices: [],
      };
    }

    const gereeniiIds = gerees.map((g) => g._id.toString());
    query.gereeniiId = { $in: gereeniiIds };
  } else if (gereeniiId) {
    // Mark all invoices for a contract
    query.gereeniiId = String(gereeniiId);
  }

  // Find all unpaid invoices matching the query
  const invoices = await NekhemjlekhiinTuukh.find(query).lean();

  if (invoices.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      message: "No unpaid invoices found",
      invoices: [],
    };
  }

  console.log(`💰 [INVOICE PAYMENT] Found ${invoices.length} unpaid invoice(s) to mark as paid`);

  // Update all invoices
  const updatePromises = invoices.map(async (invoice) => {
    try {
      // Skip if already paid
      if (invoice.tuluv === "Төлсөн") {
        console.log(`ℹ️  [INVOICE PAYMENT] Invoice ${invoice._id} already paid, skipping`);
        return invoice;
      }

      const paymentAmount = invoice.niitTulbur || 0;
      // Use different description for ekhniiUldegdel invoices
      const isEkhniiUldegdelInvoice = invoice.ekhniiUldegdel && invoice.ekhniiUldegdel > 0;
      const paymentDescription = tailbar || (isEkhniiUldegdelInvoice ? "Эхний үлдэгдэл төлбөр хийгдлээ" : "Төлбөр хийгдлээ");

      // Update invoice
      const updatedInvoice = await NekhemjlekhiinTuukh.findByIdAndUpdate(
        invoice._id,
        {
          $set: {
            tuluv: "Төлсөн",
            tulsunOgnoo: new Date(),
          },
          $push: {
            paymentHistory: {
              ognoo: new Date(),
              dun: paymentAmount,
              turul: "manual",
              guilgeeniiId: isEkhniiUldegdelInvoice 
                ? `ekhniiUldegdel_${Date.now()}_${invoice._id}`
                : `manual_${Date.now()}_${invoice._id}`,
              tailbar: paymentDescription,
            },
          },
        },
        { new: true }
      );

      if (!updatedInvoice) {
        console.error(`❌ [INVOICE PAYMENT] Failed to update invoice ${invoice._id}`);
        return null;
      }

      console.log(`✅ [INVOICE PAYMENT] Invoice ${updatedInvoice._id} marked as paid`);

      // Update geree.ekhniiUldegdel to 0 if this invoice used ekhniiUldegdel
      if (updatedInvoice.ekhniiUldegdel && updatedInvoice.ekhniiUldegdel > 0) {
        try {
          const GereeModel = Geree(kholbolt);
          const gereeForUpdate = await GereeModel.findById(updatedInvoice.gereeniiId);
          if (gereeForUpdate) {
            gereeForUpdate.ekhniiUldegdel = 0;
            await gereeForUpdate.save();
            console.log(
              `✅ [INVOICE PAYMENT] Updated geree.ekhniiUldegdel to 0 for geree ${gereeForUpdate._id}`
            );
          }
        } catch (ekhniiUldegdelError) {
          console.error(
            `❌ [INVOICE PAYMENT] Error updating geree.ekhniiUldegdel:`,
            ekhniiUldegdelError.message
          );
        }
      }

      return updatedInvoice;
    } catch (error) {
      console.error(`❌ [INVOICE PAYMENT] Error updating invoice ${invoice._id}:`, error.message);
      return null;
    }
  });

  const updatedInvoices = await Promise.all(updatePromises);
  const successfulUpdates = updatedInvoices.filter((inv) => inv !== null);

  return {
    success: true,
    updatedCount: successfulUpdates.length,
    totalFound: invoices.length,
    message: `Successfully marked ${successfulUpdates.length} invoice(s) as paid`,
    invoices: successfulUpdates.map((inv) => ({
      _id: inv._id,
      nekhemjlekhiinDugaar: inv.nekhemjlekhiinDugaar,
      gereeniiDugaar: inv.gereeniiDugaar,
      niitTulbur: inv.niitTulbur,
      tuluv: inv.tuluv,
      tulsunOgnoo: inv.tulsunOgnoo,
    })),
  };
}

module.exports = {
  markInvoicesAsPaid,
};
