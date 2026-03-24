const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const nekhemjlekhiinTuukhSchema = new Schema(
  {
    baiguullagiinNer: String,
    baiguullagiinUtas: String,
    baiguullagiinKhayag: String,
    baiguullagiinId: String,
    barilgiinId: String,
    ovog: String,
    ner: String,
    register: String,
    utas: [String],
    khayag: String,
    gereeniiOgnoo: Date,
    turul: String,
    gereeniiId: String,
    gereeniiDugaar: String,
    ekhniiUldegdel: Number,
    ekhniiUldegdelUsgeer: String,
    davkhar: String,
    uldegdel: Number,
    daraagiinTulukhOgnoo: Date,
    dansniiDugaar: String,
    gereeniiZagvariinId: String,
    tulukhUdur: [String],
    ognoo: Date,
    mailKhayagTo: String,
    maililgeesenAjiltniiNer: String,
    maililgeesenAjiltniiId: String,
    nekhemjlekhiinZagvarId: String,
    medeelel: mongoose.Schema.Types.Mixed,
    nekhemjlekh: String,
    zagvariinNer: String,
    content: String,
    nekhemjlekhiinDans: String,
    nekhemjlekhiinDansniiNer: String,
    nekhemjlekhiinBank: String,
    nekhemjlekhiinIbanDugaar: String,
    nekhemjlekhiinOgnoo: Date,
    nekhemjlekhiinDugaar: String, // Unique invoice number
    dugaalaltDugaar: Number,
    niitTulbur: Number,
    niitTulburOriginal: Number, // Stores the original total before any payments
    tuluv: {
      type: String,
      enum: ["Төлөөгүй", "Төлсөн", "Хугацаа хэтэрсэн", "Хэсэгчлэн төлсөн"],
      default: "Төлөөгүй",
    },
    qpayPaymentId: String,
    qpayInvoiceId: String,
    qpayUrl: String,
    tulukhOgnoo: Date,
    tulsunOgnoo: Date,
    paymentHistory: [
      {
        ognoo: Date,
        dun: Number,
        turul: String, // "qpay", "bank", "cash"
        guilgeeniiId: String,
        tailbar: String,
      },
    ],
    orts: String, // Web only field
    tsahilgaanNekhemjlekh: Number, // Electricity invoice amount (calculated from zaalt readings)
    tailbar: String,
  },
  {
    timestamps: true,
  },
);

nekhemjlekhiinTuukhSchema.virtual("canPay").get(function () {
  return this.tuluv !== "Төлсөн";
});

// Add audit hooks for tracking changes
const { addAuditHooks } = require("../utils/auditHooks");
addAuditHooks(nekhemjlekhiinTuukhSchema, "nekhemjlekhiinTuukh");

nekhemjlekhiinTuukhSchema.methods.checkOverdue = function () {
  const today = new Date();
  if (this.tulukhOgnoo && today > this.tulukhOgnoo && this.tuluv !== "Төлсөн") {
    this.tuluv = "Хугацаа хэтэрсэн";
    return true;
  }
  return false;
};

nekhemjlekhiinTuukhSchema.set("toJSON", { virtuals: true });

// Add unique index on nekhemjlekhiinDugaar
nekhemjlekhiinTuukhSchema.index(
  { nekhemjlekhiinDugaar: 1 },
  { unique: true, sparse: true },
);

// Ensure tuluv and uldegdel always stay consistent with payments
nekhemjlekhiinTuukhSchema.pre("save", function (next) {
  try {
    const invoice = this;

    // If tuluv was explicitly set by manualSendInvoice or payment logic, skip recalculation
    // The caller already set niitTulbur, uldegdel, and tuluv correctly
    if (invoice._skipTuluvRecalc) {
      delete invoice._skipTuluvRecalc;
      return next();
    }

    if (typeof invoice.niitTulbur === "number") {
      // Always round niitTulbur to 2dp to clean up any float arithmetic artifacts
      // e.g. 113284.80000000005 → 113284.80,  5.82e-11 → 0
      invoice.niitTulbur = Math.round(invoice.niitTulbur * 100) / 100;

      // If we don't have original total yet, set it now from initial niitTulbur (already rounded)
      if (typeof invoice.niitTulburOriginal !== "number") {
        invoice.niitTulburOriginal = invoice.niitTulbur;
      } else {
        // Round existing original too (in case it was stored with float artifacts)
        invoice.niitTulburOriginal = Math.round(invoice.niitTulburOriginal * 100) / 100;
      }

      const totalPaid = Math.round(
        (invoice.paymentHistory || []).reduce((sum, p) => sum + (p.dun || 0), 0) * 100
      ) / 100;

      // remaining = originalTotal - paid, rounded to 2dp
      const remaining = Math.round(
        Math.max(0, invoice.niitTulburOriginal - totalPaid) * 100
      ) / 100;

      invoice.uldegdel = remaining;

      if (remaining <= 0.01) {
        invoice.niitTulbur = 0;
        invoice.uldegdel = 0;
        invoice.tuluv = "Төлсөн";
      } else {
        invoice.niitTulbur = remaining;
        if (invoice.tuluv === "Хугацаа хэтэрсэн") {
          invoice.tuluv = "Хугацаа хэтэрсэн";
        } else {
          invoice.tuluv = "Төлөөгүй";
        }
      }
    }


    next();
  } catch (err) {
    next(err);
  }
});

// Post-query hooks to populate zardal based on tailbar
nekhemjlekhiinTuukhSchema.post("find", async function (docs) {
  if (!docs || docs.length === 0) return;

  try {
    const { db } = require("zevbackv2");
    const AshiglaltiinZardluud = require("./ashiglaltiinZardluud");

    // Get unique tailbar values and baiguullagiinId from docs
    const tailbarMap = new Map();
    docs.forEach((doc) => {
      if (doc.tailbar && doc.baiguullagiinId) {
        const key = `${doc.baiguullagiinId}|${doc.tailbar}`;
        if (!tailbarMap.has(key)) {
          tailbarMap.set(key, {
            baiguullagiinId: doc.baiguullagiinId,
            tailbar: doc.tailbar,
            barilgiinId: doc.barilgiinId,
          });
        }
      }
    });

    // Fetch all matching zardluud
    for (const [key, { baiguullagiinId, tailbar, barilgiinId }] of tailbarMap) {
      const kholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(baiguullagiinId),
      );

      if (kholbolt) {
        const query = {
          baiguullagiinId: String(baiguullagiinId),
          tailbar: tailbar,
        };

        if (barilgiinId) {
          query.barilgiinId = String(barilgiinId);
        }

        const zardluud = await AshiglaltiinZardluud(kholbolt)
          .find(query)
          .lean();

        // Attach zardluud to matching docs
        docs.forEach((doc) => {
          if (
            doc.tailbar === tailbar &&
            String(doc.baiguullagiinId) === String(baiguullagiinId) &&
            (!barilgiinId || String(doc.barilgiinId) === String(barilgiinId))
          ) {
            doc.zardal = zardluud;
          }
        });
      }
    }
  } catch (error) {
    console.error("Error populating zardal in nekhemjlekhiinTuukh:", error);
  }
});

nekhemjlekhiinTuukhSchema.post("findOne", async function (doc) {
  if (!doc || !doc.tailbar || !doc.baiguullagiinId) return;

  try {
    const { db } = require("zevbackv2");
    const AshiglaltiinZardluud = require("./ashiglaltiinZardluud");

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(doc.baiguullagiinId),
    );

    if (kholbolt) {
      const query = {
        baiguullagiinId: String(doc.baiguullagiinId),
        tailbar: doc.tailbar,
      };

      if (doc.barilgiinId) {
        query.barilgiinId = String(doc.barilgiinId);
      }

      const zardluud = await AshiglaltiinZardluud(kholbolt).find(query).lean();

      doc.zardal = zardluud;
    }
  } catch (error) {
    console.error("Error populating zardal in nekhemjlekhiinTuukh:", error);
  }
});
// Update global balance on deletion and cascade delete related avlaga records
// This covers both doc.deleteOne() and Query.deleteOne() / Query.findOneAndDelete()
const { runDeleteSideEffects } = require("../services/invoiceDeletionService");

const handleBalanceOnDelete = async function (doc) {
  await runDeleteSideEffects(doc);
};

nekhemjlekhiinTuukhSchema.pre(
  "deleteOne",
  { document: true, query: true },
  async function () {
    if (this instanceof mongoose.Document) {
      await handleBalanceOnDelete(this);
    } else {
      const doc = await this.model.findOne(this.getQuery());
      await handleBalanceOnDelete(doc);
    }
  },
);

nekhemjlekhiinTuukhSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getQuery());
  await handleBalanceOnDelete(doc);
});

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("nekhemjlekhiinTuukh", nekhemjlekhiinTuukhSchema);
};
