const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
var avlagiinTurul = new Schema({
  guilgeenuud: [
    {
      ognoo: Date,
      undsenDun: Number,
      tulukhDun: Number,
      tulukhAldangi: Number,
      tulsunDun: Number,
      tulsunAldangi: Number,
      uldegdel: Number,
      tariff: Number,
      tailbar: String,
      nemeltTailbar: String,
      turul: String,
      aldangiinTurul: String,
      nekhemjlekhDeerKharagdakh: Boolean,
      nuatBodokhEsekh: Boolean,
      ekhniiUldegdelEsekh: Boolean,
      zardliinTurul: String,
      zardliinId: String,
      zardliinNer: String,
      gereeniiId: String,
      guilgeeniiId: String,
      dansniiDugaar: String,
      tulsunDans: String,
      guilgeeKhiisenOgnoo: Date,
      guilgeeKhiisenAjiltniiNer: String,
      guilgeeKhiisenAjiltniiId: String,
      zaaltTog: Number,
      zaaltUs: Number,
      suuliinZaalt: Number,
      umnukhZaalt: Number,
      bokhirUsDun: Number,
      tseverUsDun: Number,
      usKhalaasanDun: Number,
      suuriKhuraamj: Number,
      tsakhilgaanUrjver: Number, //tsakhilgaanii coefficent
      tsakhilgaanKBTST: Number,
      guidliinKoep: Number,
      bichiltKhonog: Number,
      tsekhDun: Number,
      chadalDun: Number,
      sekhDemjikhTulburDun: Number,
      khonogTootsokhEsekh: Boolean,
      togtmolUtga: Number,
      tooluuriinDugaar: String,
      tulukhNUAT: Number,
      tulukhNuatgui: Number,
    },
  ],
  baritsaa: [
    {
      ognoo: Date,
      orlogo: Number,
      zarlaga: Number,
      tailbar: String,
      guilgeeniiId: String,
      guilgeeKhiisenOgnoo: Date,
      guilgeeKhiisenAjiltniiNer: String,
      guilgeeKhiisenAjiltniiId: String,
    },
  ],
});
const gereeSchema = new Schema(
  {
    id: String,
    gereeniiDugaar: String,
    gereeniiOgnoo: Date,
    turul: String,
    ovog: String,
    ner: String,
    suhNer: String,
    suhRegister: String,
    suhUtas: [String],
    suhMail: String,
    suhGariinUseg: String,
    suhTamga: String,
    register: String,
    aimag : String,
    utas: [String],
    mail: String,
    baingiinKhayag: String,
    khugatsaa: Number,
    ekhlekhOgnoo: Date,
    duusakhOgnoo: Date,
    tulukhOgnoo: Date,
    tsutsalsanOgnoo: Date,
    nekhemjlekhiinOgnoo: Date,
    khungulukhKhugatsaa: Number,
    suhTulbur: String,
    suhTulburUsgeer: String,
    suhKhugatsaa: Number,
    sukhKhungulult: Number,
    ashiglaltiinZardal: Number,
    ashiglaltiinZardalUsgeer: String,
    niitTulbur: Number,
    niitTulburUsgeer: String,
    bairNer: String,
    sukhBairshil: String,
    duureg: String,
    horoo: Schema.Types.Mixed,
    sohNer: String,
    toot: String,
    davkhar: String,
    burtgesenAjiltan: String,
    orshinSuugchId: String, 
    baiguullagiinId: String,
    baiguullagiinNer: String,
    barilgiinId: String,
    temdeglel: String,
    baritsaaniiUldegdel: {
      type: Number,
      default: 0,
    },
    zardluud: [
      {
        ner: String,
        turul: String,
        tariff: Number,
        tariffUsgeer: String,
        zardliinTurul: String,
        barilgiinId: String, // Барилгын ID - аль барилгаас ирсэн zardal болохыг тодорхойлох
        tulukhDun: Number, // Менежментийн зардал
        dun: Number, //dung n zuwxun munguur tootsoj awax togtmol ued buglunu
        bodokhArga: String, //togtmol tomyotoi baidag arguud
        tseverUsDun: Number, // xaluun xuiten ustei ued xatuu bodno
        bokhirUsDun: Number, // xaluun xuiten ustei ued xatuu bodno
        usKhalaasniiDun: Number, // xaluun us ued xatuu bodno
        tsakhilgaanUrjver: Number, //tsakhilgaanii coefficent
        tsakhilgaanChadal: Number,
        tsakhilgaanDemjikh: Number,
        suuriKhuraamj: String,
        nuatNemekhEsekh: Boolean,
        ognoonuud: [Date],
      },
    ],
    segmentuud: [
      {
        ner: String,
        utga: String,
      },
    ],
    gereeniiTuukhuud: {
      type: [Schema.Types.Mixed],
      select: false,
    },
    khungulultuud: [
      {
        ognoonuud: [Date],
        turul: String,
        zardliinId: String,
        khungulukhTurul: String,
        khungulukhKhuvi: Number,
        tulukhDun: Number,
        khungulultiinDun: Number,
        key: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = function a(conn, read = false) {
  if (!conn || !conn.kholbolt)
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  conn = read && !!conn.kholboltRead ? conn.kholboltRead : conn.kholbolt;
  return conn.model("geree", gereeSchema);
};
// mongoose.model("geree", gereeSchema);
