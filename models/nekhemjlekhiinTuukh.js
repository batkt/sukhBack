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
    tuluv: {
      type: String,
      enum: ["Төлөөгүй", "Төлсөн", "Хугацаа хэтэрсэн"],
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
  }
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
  { unique: true, sparse: true }
);

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
        (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
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
      (k) => String(k.baiguullagiinId) === String(doc.baiguullagiinId)
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
const handleBalanceOnDelete = async function (doc) {
  if (doc && doc.gereeniiId && doc.baiguullagiinId) {
    try {
      const { db } = require("zevbackv2");
      const Geree = require("./geree");
      const GereeniiTulsunAvlaga = require("./gereeniiTulsunAvlaga");
      const GereeniiTulukhAvlaga = require("./gereeniiTulukhAvlaga");

      const kholbolt = db.kholboltuud.find(
        (k) => String(k.baiguullagiinId) === String(doc.baiguullagiinId)
      );

      if (kholbolt) {
        // Update globalUldegdel only by the UNPAID amount (uldegdel)
        // This prevents double-deduction when a paid/partially paid invoice is deleted
        const unpaidAmount = typeof doc.uldegdel === "number" ? Math.max(0, doc.uldegdel) : (doc.tuluv === "Төлсөн" ? 0 : doc.niitTulbur);

        if (unpaidAmount > 0) {
          await Geree(kholbolt).findByIdAndUpdate(doc.gereeniiId, {
            $inc: { globalUldegdel: -unpaidAmount },
          });
          console.log(`📉 [Middleware] Decremented globalUldegdel by ${unpaidAmount} (unpaid) for invoice ${doc.nekhemjlekhiinDugaar || doc._id}`);
        } else {
          console.log(`ℹ️ [Middleware] No globalUldegdel decrement needed for ${doc.tuluv} invoice ${doc.nekhemjlekhiinDugaar || doc._id}`);
        }

        // Cascade delete related records from gereeniiTulsunAvlaga
        try {
          const tulsunDeleteResult = await GereeniiTulsunAvlaga(kholbolt).deleteMany({
            $or: [
              { nekhemjlekhId: String(doc._id) },
              { nekhemjlekhId: doc._id }
            ]
          });
          if (tulsunDeleteResult.deletedCount > 0) {
            console.log(`🗑️ [Middleware] Cascade deleted ${tulsunDeleteResult.deletedCount} gereeniiTulsunAvlaga records for nekhemjlekh ${doc._id}`);
          }
        } catch (tulsunError) {
          console.error("Error cascade deleting gereeniiTulsunAvlaga:", tulsunError.message);
        }

        // Cascade delete related records from gereeniiTulukhAvlaga
        try {
          const tulukhDeleteResult = await GereeniiTulukhAvlaga(kholbolt).deleteMany({
            $or: [
              { nekhemjlekhId: String(doc._id) },
              { nekhemjlekhId: doc._id }
            ]
          });
          if (tulukhDeleteResult.deletedCount > 0) {
            console.log(`🗑️ [Middleware] Cascade deleted ${tulukhDeleteResult.deletedCount} gereeniiTulukhAvlaga records for nekhemjlekh ${doc._id}`);
          }
        } catch (tulukhError) {
          console.error("Error cascade deleting gereeniiTulukhAvlaga:", tulukhError.message);
        }
      }
    } catch (error) {
      console.error("Error in handleBalanceOnDelete middleware:", error);
    }
  }
};

nekhemjlekhiinTuukhSchema.pre("deleteOne", { document: true, query: true }, async function () {
  if (this instanceof mongoose.Document) {
    await handleBalanceOnDelete(this);
  } else {
    const doc = await this.model.findOne(this.getQuery());
    await handleBalanceOnDelete(doc);
  }
});

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
