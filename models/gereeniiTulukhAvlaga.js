const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

// Энэ модель нь гэрээнээс үүссэн ТӨЛӨХ авлагын мөрүүдийг хадгална.
// Эх сурвалж нь ихэнхдээ geree.avlaga.guilgeenuud болон/эсвэл nekhemjlekh байх боломжтой.
const gereeniiTulukhAvlagaSchema = new Schema(
  {
    // Relation fields
    baiguullagiinId: { type: String, required: true },
    baiguullagiinNer: String,
    barilgiinId: String,
    gereeniiId: { type: String, required: true }, // Source geree._id
    gereeniiDugaar: String,
    orshinSuugchId: String,
    nekhemjlekhId: String, // Хэрэв тодорхой нэхэмжлэхтэй холбогдож байвал

    // Core avlaga amounts (Төлөх тал)
    ognoo: { type: Date, required: true },
    undsenDun: { type: Number, default: 0 }, // Нийт үндсэн дүн
    tulukhDun: { type: Number, default: 0 }, // Одоогоор төлөх ёстой дүн
    tulukhAldangi: { type: Number, default: 0 },
    uldegdel: { type: Number, default: 0 }, // Үлдэгдэл (payment-уудын дараа)

    // Classification
    turul: String, // жишээ нь: "avlaga", "uilchilgee", "zardal"
    aldangiinTurul: String,
    zardliinTurul: String,
    zardliinId: String,
    zardliinNer: String,

    // Flags
    nekhemjlekhDeerKharagdakh: { type: Boolean, default: true },
    nuatBodokhEsekh: { type: Boolean, default: true },
    ekhniiUldegdelEsekh: { type: Boolean, default: false },

    // Descriptions
    tailbar: String,
    nemeltTailbar: String,

    // Book-keeping
    source: {
      type: String,
      enum: ["geree", "nekhemjlekh", "gar", "busad", "excel_import"],
      default: "geree",
    },
    guilgeeKhiisenAjiltniiNer: String,
    guilgeeKhiisenAjiltniiId: String,
    // Хэрвээ geree.avlaga.guilgeenuud-ээс хөрвүүлсэн бол тухайн индексийг хадгалж болно
    avlagaGuilgeeIndex: Number,
  },
  {
    timestamps: true,
  }
);

// After deleting an avlaga record, recalculate globalUldegdel on the geree
gereeniiTulukhAvlagaSchema.post(
  ["findOneAndDelete", "deleteOne"],
  async function (doc) {
    try {
      if (!doc || !doc.gereeniiId || !doc.baiguullagiinId) return;

      const { db } = require("zevbackv2");
      const Geree = require("./geree");
      const NekhemjlekhiinTuukh = require("./nekhemjlekhiinTuukh");

      const kholbolt = db.kholboltuud.find(
        (a) => a.baiguullagiinId == doc.baiguullagiinId
      );
      if (!kholbolt) return;

      const GereeModel = Geree(kholbolt, true);
      const geree = await GereeModel.findById(doc.gereeniiId);
      if (!geree) return;

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

      // Sum remaining avlaga records (the deleted one is already gone)
      const TulukhModel = db.kholboltuud.find(
        (a) => a.baiguullagiinId == doc.baiguullagiinId
      );
      const tulukhRows = await module
        .exports(TulukhModel)
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
        "❌ [gereeniiTulukhAvlaga] Error recalculating globalUldegdel after delete:",
        err.message
      );
    }
  }
);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("gereeniiTulukhAvlaga", gereeniiTulukhAvlagaSchema);
};

