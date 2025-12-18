const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const orshinSuugchSchema = new Schema(
  {
    id: String,
    ner: String,
    toot: String, // Keep for backward compatibility
    toots: [
      {
        toot: String, // Door number
        source: {
          type: String,
          enum: ["WALLET_API", "OWN_ORG"],
          default: "OWN_ORG"
        },
        baiguullagiinId: String, // Required for OWN_ORG
        barilgiinId: String, // Required for OWN_ORG
        davkhar: String,
        orts: String,
        duureg: String,
        horoo: Schema.Types.Mixed,
        soh: String,
        bairniiNer: String,
        walletBairId: String, // For WALLET_API source
        walletDoorNo: String, // For WALLET_API source
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    ovog: String,
    utas: String,
    mail: String,
    tuluv: String,
    davkhar: String, // Keep for backward compatibility
    bairniiNer: String, // Keep for backward compatibility
    tailbar : String,
    taniltsuulgaKharakhEsekh: {
      type: Boolean,
      default: true,
    },
    nuutsUg: {
      type: String,
      select: false,
    },
    baiguullagiinId: String, // Keep for backward compatibility (primary/default)
    baiguullagiinNer: String,
    barilgiinId: String, // Keep for backward compatibility (primary/default)
    erkh: String,
    firebaseToken: String,
    zurgiinId: String,
    nevtrekhNer: String,
    duureg: String, // Keep for backward compatibility
    horoo: String, // Keep for backward compatibility
    soh: String, // Keep for backward compatibility
    orts: String, // Web only field, keep for backward compatibility
    tailbar: String,
    ekhniiUldegdel : Number,
    ekhniiUldegdelUsgeer: String,
    tsahilgaaniiZaalt: Number, // Initial electricity reading (кВт) - defaults to 200 if not provided
    walletUserId: String,
    walletCustomerId: String,
    walletCustomerCode: String,
    walletBairId: String, // Keep for backward compatibility
    walletDoorNo: String, // Keep for backward compatibility
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
