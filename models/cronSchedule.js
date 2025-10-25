const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const nekhemjlekhCronSchema = new Schema({
  baiguullagiinId: {
    type: String,
    required: true,
    unique: true,
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
