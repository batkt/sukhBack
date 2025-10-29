const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const ajiltanSchema = new Schema(
  {
    id: String,
    ner: String,
    ovog: String,
    utas: String,
    mail: String,
    nuutsUg: {
      type: String,
      select: false,
    },
    register: String,
    tsonkhniiErkhuud: [String],
    barilguud: [String],
    zogsoolKhaalga: [String],
    tuukh: [
      {
        barilgiinId: String,
        ekhelsenOgnoo: Date,
        duussanOgnoo: Date,
      },
    ],
    khayag: String,
    ajildOrsonOgnoo: Date,
    baiguullagiinId: String,
    baiguullagiinNer: String,
    erkh: String,
    firebaseToken: String,
    albanTushaal: String,
    zurgiinId: String,
    nevtrekhNer: String,
    porool: String,
    departmentAssignments: [
      {
        level: Number,
        departmentId: { type: String, default: null },
        departmentName: String,
        departmentValue: String,
      },
    ],

    tokhirgoo: {
      gereeKharakhErkh: [String], //barilgiin id-nuud
      gereeZasakhErkh: [String],
      gereeSungakhErkh: [String],
      gereeSergeekhErkh: [String],
      gereeTsutslakhErkh: [String],
      umkhunSaraarKhungulultEsekh: [String],
      guilgeeUstgakhErkh: [String],
      guilgeeKhiikhEsekh: [String],
      aldangiinUldegdelZasakhEsekh: [String],
    },
  },
  {
    timestamps: true,
  }
);

ajiltanSchema.index({
  $nevtrekhNer: "text",
  mail: 1,
});

ajiltanSchema.methods.tokenUusgeye = function (duusakhOgnoo, salbaruud = null) {
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
        this.baiguullagiinId == "68ecac3c72ca957270336159" ? "7d" : "12h",
    }
  );
  return token;
};

ajiltanSchema.methods.khugatsaaguiTokenUusgeye = function () {
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

ajiltanSchema.methods.zochinTokenUusgye = function (
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
ajiltanSchema.pre("save", async function () {
  this.indexTalbar = this.register + this.nevtrekhNer;
  const salt = await bcrypt.genSalt(12);
  this.nuutsUg = await bcrypt.hash(this.nuutsUg, salt);
});

ajiltanSchema.pre("updateOne", async function () {
  this.indexTalbar = this._update.register + this._update.nevtrekhNer;
  const salt = await bcrypt.genSalt(12);
  if (this._update.nuutsUg)
    this._update.nuutsUg = await bcrypt.hash(this._update.nuutsUg, salt);
});

ajiltanSchema.methods.passwordShalgaya = async function (pass) {
  return await bcrypt.compare(pass, this.nuutsUg);
};

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("ajiltan", ajiltanSchema);
};
