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
    gereeniiOgnoo: Date,
    turul: String,
    gereeniiId: String,
    gereeniiDugaar: String,
    davkhar: String,
    uldegdel: Number,
    daraagiinTulukhOgnoo: Date,
    dansniiDugaar: String,
    gereeniiZagvariinId: String,
    tulukhUdur: [String],
    ognoo: Date,
    mailKhayagTo: String,
    maililgeesenAjiltniiNer: String,
    maililgeesenAjiltniiId: String,
    nekhemjlekhiinZagvarId: String,
    medeelel: mongoose.Schema.Types.Mixed,
    nekhemjlekh: String,
    zagvariinNer: String,
    content: String,
    nekhemjlekhiinDans: String,
    nekhemjlekhiinDansniiNer: String,
    nekhemjlekhiinBank: String,
    nekhemjlekhiinIbanDugaar: String,
    nekhemjlekhiinOgnoo: Date,
    dugaalaltDugaar: Number,
    niitTulbur: Number,
    // Payment status fields
    tuluv: {
      type: String,
      enum: ["Төлөөгүй", "Төлсөн", "Хугацаа хэтэрсэн"],
      default: "Төлөөгүй"
    },
    qpayPaymentId: String,
    qpayInvoiceId: String,
    qpayUrl: String,
    tulukhOgnoo: Date,
    tulsunOgnoo: Date,
    paymentHistory: [{
      ognoo: Date,
      dun: Number,
      turul: String, // "qpay", "bank", "cash"
      guilgeeniiId: String,
      tailbar: String
    }]
  },
  {
    timestamps: true,
  }
);


// Virtual field for payment capability
nekhemjlekhiinTuukhSchema.virtual('canPay').get(function() {
  return this.tuluv !== "Төлсөн";
});

// Method to check and update overdue status
nekhemjlekhiinTuukhSchema.methods.checkOverdue = function() {
  const today = new Date();
  if (this.tulukhOgnoo && today > this.tulukhOgnoo && this.tuluv !== "Төлсөн") {
    this.tuluv = "Хугацаа хэтэрсэн";
    return true; // Status was updated
  }
  return false; // No update needed
};

// Ensure virtual fields are included in JSON output
nekhemjlekhiinTuukhSchema.set('toJSON', { virtuals: true });

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("nekhemjlekhiinTuukh", nekhemjlekhiinTuukhSchema);
};
