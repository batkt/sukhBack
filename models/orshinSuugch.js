const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const orshinSuugchSchema = new Schema(
  {
    id: String,
    ner: String,
    toot: String,
    ovog: String,
    utas: String,
    mail: String,
    tuluv: String,
    davkhar: String,
    bairniiNer: String,
    orts: String,
    taniltsuulgaKharakhEsekh: {
      type: Boolean,
      default: true,
    },
    nuutsUg: {
      type: String,
      select: false,
    },
    baiguullagiinId: String,
    baiguullagiinNer: String,
    barilgiinId: String,
    erkh: String,
    firebaseToken: String,
    zurgiinId: String,
    nevtrekhNer: String,
    duureg: String,
    horoo: String,
    soh: String,
  },
  {
    timestamps: true,
  }
);

orshinSuugchSchema.index({
  $nevtrekhNer: "text",
  mail: 1,
});

orshinSuugchSchema.methods.tokenUusgeye = function (
  duusakhOgnoo,
  salbaruud = null
) {
  const token = jwt.sign(
    {
      id: this._id,
      ner: this.ner,
      baiguullagiinId: this.baiguullagiinId,
      salbaruud: salbaruud,
      duusakhOgnoo: duusakhOgnoo,
    },
    process.env.APP_SECRET,
    {
      expiresIn:
        this.baiguullagiinId == "68e4e2bff3ff09acb5705a93" ? "7d" : "12h",
    }
  );
  return token;
};

orshinSuugchSchema.methods.khugatsaaguiTokenUusgeye = function () {
  const token = jwt.sign(
    {
      id: this._id,
      ner: this.ner,
      baiguullagiinId: this.baiguullagiinId,
    },
    process.env.APP_SECRET,
    {}
  );
  return token;
};

orshinSuugchSchema.methods.zochinTokenUusgye = function (
  baiguullagiinId,
  gishuunEsekh
) {
  const token = jwt.sign(
    {
      id: "zochin",
      baiguullagiinId,
    },
    process.env.APP_SECRET,
    gishuunEsekh
      ? {
          expiresIn: "12h",
        }
      : {
          expiresIn: "1h",
        }
  );
  return token;
};

async function cascadeDeleteForResident(doc) {
  try {
    if (!doc) return;
    const { db } = require("zevbackv2");
    const Geree = require("./geree");
    const NekhemjlekhiinTuukh = require("./nekhemjlekhiinTuukh");
    const kholbolt = db.kholboltuud.find(
      (a) => a.baiguullagiinId == doc.baiguullagiinId
    );
    if (!kholbolt) return;
    const gereenuud = await Geree(kholbolt)
      .find({ orshinSuugchId: doc._id.toString() }, { _id: 1 })
      .lean();
    const gereeIds = (gereenuud || [])
      .map((g) => (g && g._id ? String(g._id) : null))
      .filter((id) => !!id);
    if (gereeIds.length > 0) {
      await NekhemjlekhiinTuukh(kholbolt).deleteMany({ gereeniiId: { $in: gereeIds } });
      await Geree(kholbolt).deleteMany({ _id: { $in: gereeIds } });
    }
  } catch (e) {
    console.error("Error cascading delete for geree after orshinSuugch deletion:", e);
  }
}

// Single-document deletes
orshinSuugchSchema.post(["findOneAndDelete", "deleteOne"], async function (doc) {
  await cascadeDeleteForResident(doc);
});

// Bulk deletes: capture targets in pre, then cascade in post
orshinSuugchSchema.pre(["deleteMany"], async function () {
  try {
    const filter = this.getFilter ? this.getFilter() : {};
    this._toDeleteDocs = await this.model.find(filter).lean();
  } catch (e) {
    console.error("Error capturing residents before deleteMany:", e);
  }
});
orshinSuugchSchema.post(["deleteMany"], async function () {
  try {
    const docs = Array.isArray(this._toDeleteDocs) ? this._toDeleteDocs : [];
    for (const doc of docs) {
      await cascadeDeleteForResident(doc);
    }
  } catch (e) {
    console.error("Error cascading after deleteMany for residents:", e);
  }
});
orshinSuugchSchema.pre("save", async function () {
  this.indexTalbar = this.nevtrekhNer;

  if (this.nuutsUg && !this.nuutsUg.startsWith("$2b$")) {
    const salt = await bcrypt.genSalt(12);
    this.nuutsUg = await bcrypt.hash(this.nuutsUg, salt);
  }
});

orshinSuugchSchema.pre("updateOne", async function () {
  this.indexTalbar = this._update.nevtrekhNer;

  if (this._update.nuutsUg && !this._update.nuutsUg.startsWith("$2b$")) {
    const salt = await bcrypt.genSalt(12);
    this._update.nuutsUg = await bcrypt.hash(this._update.nuutsUg, salt);
  }
});

orshinSuugchSchema.methods.passwordShalgaya = async function (pass) {
  return await bcrypt.compare(pass, this.nuutsUg);
};

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("orshinSuugch", orshinSuugchSchema);
};
