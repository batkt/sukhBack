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
    turul: String, // гомдол, санал, мэдэгдэл, хүсэлт, etc.
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "cancelled"],
      default: "pending"
    },
    tailbar: String, // Reply/notes from web admin
    repliedAt: Date, // When the reply was sent
    repliedBy: String, // Admin/employee ID who replied
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
