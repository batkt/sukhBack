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
    orts: String, // Web only field
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
          duuregNer: String,
          districtCode: String,
          horoo : {
            ner: String,
            kod: String,
          },
          sohNer: String, // СӨХ код
          davkhar: [String], // Давхар - array of floor numbers like ["1", "2", "3"]
          davkhariinToonuud: Schema.Types.Mixed, // Давхрын тоонууд - object like {1: ["103,104,105"], 2: ["201,202"]}
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
      qpayShimtgelTusdaa: Boolean,
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
