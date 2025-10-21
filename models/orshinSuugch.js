const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const orshinSuugchSchema = new Schema(
  {
    id: String,
    ner: String,
    toot : String,
    ovog: String,
    utas: String,
    mail: String,
    tuluv : String,
    davkhar : String,
    bairniiNer : String,
    nuutsUg: {
      type: String,
      select: false,
    },
    register: String,
    baiguullagiinId: String,
    baiguullagiinNer: String,
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
        this.baiguullagiinId == "68e4e2bff3ff09acb5705a93" ? "7d" : "10m",
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
orshinSuugchSchema.pre("save", async function () {
  this.indexTalbar = this.register + this.nevtrekhNer;
  
  if (this.nuutsUg && !this.nuutsUg.startsWith('$2b$')) {
    const salt = await bcrypt.genSalt(12);
    this.nuutsUg = await bcrypt.hash(this.nuutsUg, salt);
  }
});

orshinSuugchSchema.pre("updateOne", async function () {
  this.indexTalbar = this._update.register + this._update.nevtrekhNer;
  
  if (this._update.nuutsUg && !this._update.nuutsUg.startsWith('$2b$')) {
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
