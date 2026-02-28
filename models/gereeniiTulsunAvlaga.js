const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

// Энэ модель нь гэрээгээр ТӨЛСӨН (paid) авлагын мөрүүдийг хадгална.
// Гол санаа: нэг төлбөр (bankniit guilgee, wallet, бэлэн гэх мэт) олон
// gereeniiTulukhAvlaga мөрийг хааж чадна.
const gereeniiTulsunAvlagaSchema = new Schema(
  {
    // Relation fields
    baiguullagiinId: { type: String, required: true },
    baiguullagiinNer: String,
    barilgiinId: String,
    gereeniiId: { type: String, required: true },
    gereeniiDugaar: String,
    orshinSuugchId: String,
    nekhemjlekhId: String, // Аль нэхэмжлэхийг хааж буй төлбөр

    // Link to payment / transaction
    bankniiGuilgeeId: String,
    tulburGuilgeeId: String,
    dansniiDugaar: String,
    tulsunDans: String,

    // Paid amounts
    ognoo: { type: Date, required: true }, // Төлсөн огноо
    tulsunDun: { type: Number, default: 0 },
    tulsunAldangi: { type: Number, default: 0 },

    // Classification
    turul: String, // жишээ нь: "tulbur", "aldangi", "nuat" гэх мэт
    zardliinTurul: String,
    zardliinId: String,
    zardliinNer: String,

    // Descriptions
    tailbar: String,
    nemeltTailbar: String,

    // Book-keeping
    source: {
      type: String,
      enum: ["geree", "nekhemjlekh", "bank", "avlaga", "zardal", "wallet", "gar", "busad"],
      default: "bank",
    },
    guilgeeKhiisenAjiltniiNer: String,
    guilgeeKhiisenAjiltniiId: String,
  },
  {
    timestamps: true,
  }
);

// After deleting a payment record, recalculate globalUldegdel on the geree
gereeniiTulsunAvlagaSchema.post(
  ["findOneAndDelete", "deleteOne"],
  async function (doc) {
    try {
      if (!doc || !doc.gereeniiId || !doc.baiguullagiinId) return;

      const { db } = require("zevbackv2");
      const Geree = require("./geree");
      const NekhemjlekhiinTuukh = require("./nekhemjlekhiinTuukh");
      const GereeniiTulukhAvlaga = require("./gereeniiTulukhAvlaga");

      const kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == doc.baiguullagiinId
      );
      if (!kholbolt) return;

      const GereeModel = Geree(kholbolt, true);
      const geree = await GereeModel.findById(doc.gereeniiId);
      if (!geree) return;

      // Reverse the payment: add paid amount back to positiveBalance reduction
      // (the payment record is gone, so positiveBalance may need adjusting)
      // Re-add the deleted payment amount to avlaga records is too complex;
      // instead, just recalculate globalUldegdel from current state.

      // Sum remaining unpaid invoices
      const invs = await NekhemjlekhiinTuukh(kholbolt)
        .find({
          baiguullagiinId: String(doc.baiguullagiinId),
          gereeniiId: String(doc.gereeniiId),
          tuluv: { $ne: "Төлсөн" },
        })
        .select("niitTulbur uldegdel")
        .lean();

      let totalUnpaid = 0;
      invs.forEach((inv) => {
        totalUnpaid +=
          typeof inv.uldegdel === "number" && !isNaN(inv.uldegdel)
            ? inv.uldegdel
            : inv.niitTulbur || 0;
      });

      // Sum remaining avlaga records
      const tulukhRows = await GereeniiTulukhAvlaga(kholbolt)
        .find({
          baiguullagiinId: String(doc.baiguullagiinId),
          gereeniiId: String(doc.gereeniiId),
        })
        .select("uldegdel")
        .lean();
      tulukhRows.forEach((row) => {
        totalUnpaid +=
          typeof row.uldegdel === "number" && !isNaN(row.uldegdel)
            ? row.uldegdel
            : 0;
      });

      const positive = geree.positiveBalance || 0;
      geree.globalUldegdel = totalUnpaid - positive;
      await geree.save();
    } catch (err) {
      console.error(
        "❌ [gereeniiTulsunAvlaga] Error recalculating globalUldegdel after delete:",
        err.message
      );
    }
  }
);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("gereeniiTulsunAvlaga", gereeniiTulsunAvlagaSchema);
};

