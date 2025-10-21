const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const liftShalgayaSchema = new Schema(
  {
    baiguullagiinId: String,
    choloolugdokhDavkhar: [String],
  },
  { timestamps: true }
);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("liftShalgaya", liftShalgayaSchema);
};
//module.exports = mongoose.model("license", licenseSchema);
