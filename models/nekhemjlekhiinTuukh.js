const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const nekhemjlekhiinTuukhSchema = new Schema(
  {
    baiguullagiinNer: String,
    baiguullagiinId: String,
    barilgiinId: String,
    ovog: String,
    ner: String,
    register: String,
    utas: [String],
    khayag: String,
    khugatsaa: Number,
    duusakhOgnoo: Date,
    gereeniiOgnoo: Date,
    turul: String,
    gereeniiId: String,
    gereeniiDugaar: String,
    talbainIdnuud: [String],
    talbainDugaar: String,
    talbainNegjUne: Number,
    talbainNiitUne: Number,
    talbainKhemjee: Number,
    talbainKhemjeeMetrKube: Number,
    davkhar: String,
    baritsaaAvakhDun: Number,
    baritsaaniiUldegdel: {
      type: Number,
      default: 0,
    },
    uldegdel: Number,
    baritsaaAvakhKhugatsaa: Number,
    daraagiinTulukhOgnoo: Date,
    dansniiDugaar: String,
    gereeniiZagvariinId: String,
    tulukhUdur: [String],
    tuluv: Number,
    ognoo: Date,
    mailKhayagTo: String,
    maililgeesenAjiltniiNer: String,
    maililgeesenAjiltniiId: String,
    nekhemjlekhiinZagvarId: String,
    medeelel: mongoose.Schema.Types.Mixed,
    tsonkhniiNer: String,
    nekhemjlekh: String,
    zagvariinNer: String,
    content: String,
    nekhemjlekhiinDans: String,
    nekhemjlekhiinDansniiNer: String,
    nekhemjlekhiinBank: String,
    nekhemjlekhiinIbanDugaar: String,
    nekhemjlekhiinOgnoo: Date,
    dugaalaltDugaar: Number,
  },
  {
    timestamps: true,
  }
);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("nekhemjlekhiinTuukh", nekhemjlekhiinTuukhSchema);
};
