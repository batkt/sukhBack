const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const liftShalgayaSchema = new Schema(
  {
    baiguullagiinId: String,
    barilgiinId: String,
    choloolugdokhDavkhar: [String],
  },
  { timestamps: true }
);

// Post-save hook to sync liftShalgaya back to baiguullaga.barilguud[].tokhirgoo.liftShalgaya
liftShalgayaSchema.post("save", async function (doc) {
  try {
    if (!doc.baiguullagiinId || !doc.barilgiinId) {
      return;
    }

    const { db } = require("zevbackv2");
    const Baiguullaga = require("./baiguullaga");

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      doc.baiguullagiinId
    );

    if (!baiguullaga) {
      console.error("⚠️ [LIFTSHALGAYA HOOK] Baiguullaga not found:", doc.baiguullagiinId);
      return;
    }

    const barilgaIndex = baiguullaga.barilguud.findIndex(
      (b) => String(b._id) === String(doc.barilgiinId)
    );

    if (barilgaIndex >= 0) {
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo = {};
      }
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya = {};
      }
      baiguullaga.barilguud[
        barilgaIndex
      ].tokhirgoo.liftShalgaya.choloolugdokhDavkhar = doc.choloolugdokhDavkhar || [];
      
      await baiguullaga.save();
      console.log(
        `✅ [LIFTSHALGAYA HOOK] Synced liftShalgaya to baiguullaga: ${doc.baiguullagiinId}, barilga: ${doc.barilgiinId}`
      );
    } else {
      console.error("⚠️ [LIFTSHALGAYA HOOK] Barilga not found:", doc.barilgiinId);
    }
  } catch (error) {
    console.error("❌ [LIFTSHALGAYA HOOK] Error syncing to baiguullaga:", error.message);
  }
});

// Post-update hook for findOneAndUpdate
liftShalgayaSchema.post("findOneAndUpdate", async function (result) {
  try {
    if (!result || !result.baiguullagiinId || !result.barilgiinId) {
      return;
    }

    const { db } = require("zevbackv2");
    const Baiguullaga = require("./baiguullaga");

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      result.baiguullagiinId
    );

    if (!baiguullaga) {
      return;
    }

    const barilgaIndex = baiguullaga.barilguud.findIndex(
      (b) => String(b._id) === String(result.barilgiinId)
    );

    if (barilgaIndex >= 0) {
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo = {};
      }
      if (!baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya) {
        baiguullaga.barilguud[barilgaIndex].tokhirgoo.liftShalgaya = {};
      }
      baiguullaga.barilguud[
        barilgaIndex
      ].tokhirgoo.liftShalgaya.choloolugdokhDavkhar = result.choloolugdokhDavkhar || [];
      
      await baiguullaga.save();
      console.log(
        `✅ [LIFTSHALGAYA HOOK] Synced liftShalgaya to baiguullaga after findOneAndUpdate: ${result.baiguullagiinId}, barilga: ${result.barilgiinId}`
      );
    }
  } catch (error) {
    console.error("❌ [LIFTSHALGAYA HOOK] Error syncing to baiguullaga after update:", error.message);
  }
});

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("liftShalgaya", liftShalgayaSchema);
};
//module.exports = mongoose.model("license", licenseSchema);
