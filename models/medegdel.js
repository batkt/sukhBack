const mongoose = require("mongoose");
const orshinSuugch = require("./orshinSuugch");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const medegdelSchema = new Schema(
  {
    id: String,
    baiguullagiinId: String,
    barilgiinId: String,
    ognoo: Date,
    title: String,
    gereeniiDugaar: String,
    message: String,
    orshinSuugchGereeniiDugaar: String,
    orshinSuugchId: String,
    orshinSuugchNer: String,
    orshinSuugchUtas: String,
    kharsanEsekh: Boolean,
  },
  {
    timestamps: true,
  }
);

module.exports = function (conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("medegdel", medegdelSchema);
};
