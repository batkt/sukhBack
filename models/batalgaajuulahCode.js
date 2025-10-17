const mongoose = require("mongoose");

const batalgaajuulkhCodeSchema = new mongoose.Schema(
  {
    utas: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ["password_reset", "registration", "login"],
      default: "password_reset",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
    khereglesenEsekh: {
      type: Boolean,
      default: false,
    },
    khereglesenOgnoo: {
      type: Date,
      default: null,
    },
    oroldlogo: {
      type: Number,
      default: 0,
    },
    niitOroldokhErkh: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  }
);

batalgaajuulkhCodeSchema.index({ utas: 1, purpose: 1, khereglesenEsekh: 1 });
batalgaajuulkhCodeSchema.index({ expiresAt: 1 });

batalgaajuulkhCodeSchema.statics.batalgaajuulkhCodeUusgeye = function (
  utas,
  purpose = "password_reset",
  expirationMinutes = 10
) {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  return this.create({
    utas,
    code,
    purpose,
    expiresAt,
  });
};

// Alias for the controller
batalgaajuulkhCodeSchema.statics.createVerificationCode =
  batalgaajuulkhCodeSchema.statics.batalgaajuulkhCodeUusgeye;

batalgaajuulkhCodeSchema.statics.verifyCode = async function (
  utas,
  code,
  purpose = "password_reset"
) {
  const verificationCode = await this.findOne({
    utas,
    code,
    purpose,
    khereglesenEsekh: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verificationCode) {
    return { success: false, message: "Хүчингүй код байна!" };
  }

  if (verificationCode.oroldlogo >= verificationCode.niitOroldokhErkh) {
    return { success: false, message: "Хэт их оролдлого хийгдсэн байна!" };
  }

  verificationCode.khereglesenEsekh = true;
  verificationCode.khereglesenOgnoo = new Date();
  await verificationCode.save();

  return { success: true, message: "Амжилттай баталгаажлаа" };
};

batalgaajuulkhCodeSchema.statics.incrementAttempts = async function (
  utas,
  code,
  purpose = "password_reset"
) {
  const verificationCode = await this.findOne({
    utas,
    code,
    purpose,
    khereglesenEsekh: false,
  });

  if (verificationCode) {
    verificationCode.oroldlogo += 1;
    await verificationCode.save();
  }
};

batalgaajuulkhCodeSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

// Create and export the model
const BatalgaajuulahCode = mongoose.model(
  "BatalgaajuulahCode",
  batalgaajuulkhCodeSchema
);
module.exports = BatalgaajuulahCode;
