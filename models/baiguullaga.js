const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const baiguullagaSchema = new Schema(
  {
    id: String,
    ner: String,
    dotoodNer: String,
    khayag: String,
    mail: [String],
    register: String,
    utas: [String],
    zurgiinNer: String,
    dans: String,
    bankniiNer: String,
    barilguud: [
      {
        bairshil: {
          type: {
            type: String,
            enum: ["Point"],
          },
          coordinates: {
            type: [Number],
          },
        },
        ner: String,
        khayag: String,
        register: String,
        niitTalbai: Number,
        tokhirgoo: {
          /**Хоногт бодох алдангийн хувь дээд тал 0.5 байна */
          aldangiinKhuvi: Number,
          /**Алданги авалгүйгээр хүлээх хоног */
          aldangiChuluulukhKhonog: Number,
          /**Алданги бодож эхлэх огноо */
          aldangiBodojEkhlekhOgnoo: Date,
          eBarimtAshiglakhEsekh: Boolean,
          eBarimtShine: Boolean,
          eBarimtAutomataarIlgeekh: Boolean,
          eBarimtBugdShivikh: Boolean, //Bux barimtand ebarimt shiwix odoogoor zuwxun zogsool deer xiilee
          eBarimtMessageIlgeekhEsekh: Boolean,
          merchantTin: String,
          EbarimtDuuregNer: String,
          EbarimtDistrictCode: String,
          EbarimtDHoroo: {
            ner: String,
            kod: String,
          },
          duuregNer: String,
          districtCode: String,
          horoo: {
            ner: String,
            kod: String,
          },
          sohNer: String,
          orts: String,
          davkhar: [String],
          davkhariinToonuud: Schema.Types.Mixed,
          nuatTulukhEsekh: Boolean,
          zogsoolMsgIlgeekh: Boolean,
          tooluurAutomatTatakhToken: String,
          /**Сар бүрийн тогтмол өдөр хөнгөлөлт боломж олгоно */
          sarBurAutoKhungulultOruulakhEsekh: Boolean,
          khungulukhSarBuriinShalguurDun: Number,
          khungulukhSarBuriinTurul: String,
          khungulukhSarBuriinUtga: Number,
          khungulukhSarBuriinTulburEkhlekhUdur: Number,
          khungulukhSarBuriinTulburDuusakhUdur: Number,
          tureesiinDungeesKhungulukhEsekh: Boolean,
          ashiglaltDungeesKhungulukhEsekh: Boolean,
          jilBurTalbaiTulburNemekhEsekh:
            Boolean /** жил бүр талбайн төлбөр нэмэх эсэх */,
          jilBurTulbur: Number,
          gereeDuusakhTalbaiTulburNemekhEsekh:
            Boolean /** гэрээ дуусах үед талбайн төлбөр нэмэх эсэх */,
          gereeDuusakhTulbur: Number,
          zochinUrikhUneguiMinut: Number,
          /** Ашиглалтын зардлууд - барилга тус бүрт тусдаа */
          ashiglaltiinZardluud: [
            {
              ner: String,
              turul: String,
              bodokhArga: String,
              tseverUsDun: Number,
              bokhirUsDun: Number,
              usKhalaasniiDun: Number,
              tsakhilgaanUrjver: Number,
              tsakhilgaanChadal: Number,
              tsakhilgaanDemjikh: Number,
              tailbar: String,
              tariff: Number,
              tariffUsgeer: String,
              suuriKhuraamj: Number,
              nuatNemekhEsekh: Boolean,
              togtmolUtga: Number,
              choloolugdsonDavkhar: Boolean,
              zardliinTurul: String,
              dun: Number,
              ognoonuud: [Date],
              nuatBodokhEsekh: Boolean,
              zaalt: Boolean, // Electricity (цахилгаан) flag
              zaaltTariff: Number, // кВт tariff for electricity (legacy - use zaaltTariffTiers if available)
              zaaltDefaultDun: Number, // Default amount for electricity calculation
              // Tiered pricing: zaaltTariffTiers = [{ threshold: 175, tariff: 175 }, { threshold: 256, tariff: 256 }, { threshold: Infinity, tariff: 285 }]
              zaaltTariffTiers: [
                {
                  threshold: Number, // Usage threshold (кВт)
                  tariff: Number, // Tariff rate for this tier (Төг/кВт.цаг)
                },
              ],
            },
          ],
          /** Лифт шалгая - хөлөгдсөн давхрууд */
          liftShalgaya: {
            choloolugdokhDavkhar: [String],
          },
          /** Дансны мэдээлэл - барилга тус бүрт тусдаа */
          dans: {
            dugaar: String, // Дансны дугаар
            dansniiNer: String, // Дансны нэр
            bank: String, // Банкны нэр
            ibanDugaar: String, // IBAN дугаар
          },
        },
        davkharuud: [
          {
            davkhar: String,
            talbai: Number,
            tariff: Number,
            planZurag: String,
          },
        ],
      },
    ],
    talbai: Number,
    tokhirgoo: {
      /**Хоногт бодох алдангийн хувь дээд тал 0.5 байна */
      aldangiinKhuvi: Number,

      /**Алданги авалгүйгээр хүлээх хоног */
      aldangiChuluulukhKhonog: Number,

      /**Алданги бодож эхлэх огноо */
      aldangiBodojEkhlekhOgnoo: Date,

      /**Жилийн эцэсээр гэрээ хаах бол 12 гэж байна ИХ Наяд дээр бүх гэрээ жилийн эцэст хаагддаг учир ийл тохиргоо авлаа */
      gereeDuusgakhSar: Number,

      /**Хэдэн сараар барьцаа авах вэ */
      baritsaaAvakhSar: Number,

      /**Хөнгөлөлт ажилтан харгалзахгүй өгөх боломж олгоно */
      bukhAjiltanKhungulultOruulakhEsekh: Boolean,

      /**Хоногоор хөнгөлөлт боломж олгоно */
      khonogKhungulultOruulakhEsekh: Boolean,

      /**Тухайн байгууллагын хөнгөлж болох дээд хувь байна */
      deedKhungulultiinKhuvi: Number,

      /**Гэрээний хугацаа дуусах үед автоматаар сунгах эсэх */
      gereeAvtomataarSungakhEsekh: Boolean,

      /**Гэрээ засах эрх бүх ажилтанд олгох эсэх */
      bukhAjiltanGereendZasvarOruulakhEsekh: Boolean,
      /**Системд И Баримт ашиглах эсэх */
      eBarimtAshiglakhEsekh: Boolean,
      eBarimtAutomataarShivikh: Boolean,
      eBarimtAutomataarIlgeekh: Boolean,
      msgIlgeekhKey: String,
      msgIlgeekhDugaar: String,
      msgAvakhTurul: String,
      msgAvakhDugaar: [String],
      msgAvakhTsag: String,
      zogsoolMsgZagvar: String,
      mailNevtrekhNer: String,
      mailPassword: String,
      mailHost: String,
      mailPort: String,
      khereglegchEkhlekhOgnoo: Date,
      zogsooliinMinut: Number,
      zogsooliinKhungulukhMinut: Number,
      zogsooliinDun: Number,
      apiAvlagaDans: String,
      apiOrlogoDans: String,
      apiNuatDans: String,
      apiZogsoolDans: String,
      apiTogloomiinTuvDans: String,
      aktAshiglakhEsekh: Boolean,
      guidelBuchiltKhonogEsekh: Boolean,
      sekhDemjikhTulburAvakhEsekh: Boolean,
      bichiltKhonog: Number,
      udruurBodokhEsekh: Boolean,
      baritsaaUneAdiltgakhEsekh: Boolean,
      zogsoolNer: String,
      davkharsanMDTSDavtamjSecond: Number,
      zurchulMsgeerSanuulakh:
        Boolean /** Зогсоолын зөрчил сануулах жагсаалт харуулах тохируулах */,
      guidliinKoepEsekh: Boolean,
      msgNegjUne: Number /** мессеж нэгж үнэ тохируулах */,
      gadaaStickerAshiglakhEsekh: Boolean /** gadaa sticker ashiglakh esekh */,
      togloomiinTuvDavkhardsanShalgakh: Boolean,
      dotorGadnaTsagEsekh: Boolean,
    },
    erkhuud: [
      {
        zam: String,
        ner: String,
        tailbar: String,
        tokhirgoo: [
          {
            utga: String,
            ner: String,
            tailbar: String,
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Post-save hook to update geree.zardluud when baiguullaga.barilguud[].tokhirgoo.ashiglaltiinZardluud changes
baiguullagaSchema.post("save", async function (doc) {
  try {
    if (!doc || !doc.barilguud || !Array.isArray(doc.barilguud)) {
      return;
    }

    const { db } = require("zevbackv2");
    const Geree = require("./geree");

    const kholbolt = db.kholboltuud.find(
      (a) => String(a.baiguullagiinId) === String(doc._id)
    );

    if (!kholbolt) {
      return;
    }

    // Process each barilga's ashiglaltiinZardluud
    for (const barilga of doc.barilguud) {
      if (
        !barilga._id ||
        !barilga.tokhirgoo ||
        !barilga.tokhirgoo.ashiglaltiinZardluud ||
        !Array.isArray(barilga.tokhirgoo.ashiglaltiinZardluud)
      ) {
        continue;
      }

      const barilgiinId = barilga._id.toString();
      const ashiglaltiinZardluud = barilga.tokhirgoo.ashiglaltiinZardluud;

      // Find all active geree documents for this baiguullaga and barilga
      const gereenuud = await Geree(kholbolt, true).find({
        baiguullagiinId: doc._id.toString(),
        barilgiinId: barilgiinId,
        tuluv: "Идэвхтэй", // Only update active contracts
      });

      for (const geree of gereenuud) {
        if (!geree.zardluud) {
          geree.zardluud = [];
        }

        // Get current zardluud from building config
        const buildingZardluudMap = new Map();
        for (const zardal of ashiglaltiinZardluud) {
          const key = `${zardal.ner || ""}_${zardal.turul || ""}_${zardal.zardliinTurul || ""}`;
          buildingZardluudMap.set(key, zardal);
        }

        // Remove zardluud that no longer exist in building config (matching by barilgiinId)
        geree.zardluud = geree.zardluud.filter((z) => {
          // Keep zardluud from other barilgas
          if (z.barilgiinId && String(z.barilgiinId) !== barilgiinId) {
            return true;
          }
          // Keep zardluud that don't have barilgiinId (backward compatibility)
          if (!z.barilgiinId) {
            // Only remove if it matches a building zardal (to avoid removing unrelated zardluud)
            const key = `${z.ner || ""}_${z.turul || ""}_${z.zardliinTurul || ""}`;
            return !buildingZardluudMap.has(key);
          }
          // For zardluud from this barilga, check if it still exists in building config
          const key = `${z.ner || ""}_${z.turul || ""}_${z.zardliinTurul || ""}`;
          return buildingZardluudMap.has(key);
        });

        // Update or add zardluud from building config
        for (const buildingZardal of ashiglaltiinZardluud) {
          const key = `${buildingZardal.ner || ""}_${buildingZardal.turul || ""}_${buildingZardal.zardliinTurul || ""}`;
          
          // Find existing zardal in geree
          const existingIndex = geree.zardluud.findIndex((z) => {
            const matchesNer = z.ner === buildingZardal.ner;
            const matchesTurul = z.turul === buildingZardal.turul;
            const matchesZardliinTurul = z.zardliinTurul === buildingZardal.zardliinTurul;
            const matchesBarilgiinId =
              (!buildingZardal.barilgiinId && !z.barilgiinId) ||
              (z.barilgiinId && String(z.barilgiinId) === barilgiinId);
            
            return matchesNer && matchesTurul && matchesZardliinTurul && matchesBarilgiinId;
          });

          const newZardal = {
            ner: buildingZardal.ner,
            turul: buildingZardal.turul,
            tariff: buildingZardal.tariff,
            tariffUsgeer: buildingZardal.tariffUsgeer,
            zardliinTurul: buildingZardal.zardliinTurul,
            barilgiinId: barilgiinId,
            tulukhDun: 0,
            dun: buildingZardal.dun || 0,
            bodokhArga: buildingZardal.bodokhArga || "",
            tseverUsDun: buildingZardal.tseverUsDun || 0,
            bokhirUsDun: buildingZardal.bokhirUsDun || 0,
            usKhalaasniiDun: buildingZardal.usKhalaasniiDun || 0,
            tsakhilgaanUrjver: buildingZardal.tsakhilgaanUrjver || 1,
            tsakhilgaanChadal: buildingZardal.tsakhilgaanChadal || 0,
            tsakhilgaanDemjikh: buildingZardal.tsakhilgaanDemjikh || 0,
            suuriKhuraamj: buildingZardal.suuriKhuraamj || 0,
            nuatNemekhEsekh: buildingZardal.nuatNemekhEsekh || false,
            ognoonuud: buildingZardal.ognoonuud || [],
            zaalt: buildingZardal.zaalt || false,
            zaaltTariff: buildingZardal.zaaltTariff || 0,
            zaaltDefaultDun: buildingZardal.zaaltDefaultDun || 0,
            zaaltTariffTiers: buildingZardal.zaaltTariffTiers || [],
          };

          if (existingIndex !== -1) {
            // Update existing zardal
            geree.zardluud[existingIndex] = {
              ...geree.zardluud[existingIndex].toObject(),
              ...newZardal,
            };
          } else {
            // Add new zardal
            geree.zardluud.push(newZardal);
          }
        }

        // Recalculate niitTulbur
        const niitTulbur = geree.zardluud.reduce((sum, zardal) => {
          return sum + (zardal.tariff || 0);
        }, 0);

        geree.niitTulbur = niitTulbur;

        // Save the updated geree
        await geree.save();

        // NOTE: Do NOT update existing nekhemjlekhiinTuukh (invoice) records
        // Once an invoice is created, it should NEVER be modified
        // This ensures historical accuracy - invoices represent what was billed at a specific point in time
      }
    }
  } catch (error) {
    console.error(
      "Error updating geree.zardluud after baiguullaga.ashiglaltiinZardluud update:",
      error
    );
  }
});

//const BaiguullagaModel = mongoose.model("baiguullaga", baiguullagaSchema);

module.exports = function a(conn) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = conn.kholbolt;
  return conn.model("baiguullaga", baiguullagaSchema);
};

/*var newId = new mongoose.mongo.ObjectId('62bbb00140b7dd4f39c99e64');
BaiguullagaModel.estimatedDocumentCount().then((count) => {
  if (count == 0) {
    BaiguullagaModel.create(
      new BaiguullagaModel({
        _id: newId,
        ner: "E-Mart",
        utas: "80994111",
        register: "5811651",
      })
    );
  }
});
*/
//module.exports = BaiguullagaModel;
