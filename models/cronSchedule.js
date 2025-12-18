const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const nekhemjlekhCronSchema = new Schema({
  baiguullagiinId: {
    type: String,
    required: true,
  },
  barilgiinId: {
    type: String,
    default: null, // null means organization-level, otherwise building-level
  },
  nekhemjlekhUusgekhOgnoo: {
    type: Number,
    required: true,
    min: 1,
    max: 31,
    default: 1,
  },
  idevkhitei: {
    type: Boolean,
    default: true,
  },
  suuldAjillasanOgnoo: {
    type: Date,
    default: null,
  },
  daraagiinAjillakhOgnoo: {
    type: Date,
    default: null,
  },
  uussenOgnoo: {
    type: Date,
    default: Date.now,
  },
  shinechilsenOgnoo: {
    type: Date,
    default: Date.now,
  },
});

// Unique constraint: one schedule per baiguullaga OR per baiguullaga+barilga combination
nekhemjlekhCronSchema.index(
  { baiguullagiinId: 1, barilgiinId: 1 },
  { unique: true, sparse: true }
);

nekhemjlekhCronSchema.pre("save", function (next) {
  this.shinechilsenOgnoo = new Date();
  next();
});

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("nekhemjlekhCron", nekhemjlekhCronSchema);
};
