const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const liftShalgayaSchema = new Schema(
  {
    choloolugdokhDavkhar: [Schema.Types.Mixed],

  },
  { timestamps: true }
);

module.exports = function a(conn, read = false) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = read && !!conn.kholboltRead ? conn.kholboltRead : conn.kholbolt;
  return conn.model("liftShalgaya", liftShalgayaSchema);
};
//module.exports = mongoose.model("license", licenseSchema);
