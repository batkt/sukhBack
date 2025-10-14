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
    register: String,
    customerTin: String,
    albanTushaal: String,
    zakhirliinOvog: String,
    zakhirliinNer: String,
    utas: [String],
    mail: String,
    khayag: String,
    khugatsaa: Number,
    duusakhOgnoo: Date,
    tsutsalsanOgnoo: Date,
    khungulukhKhugatsaa: Number,
    sariinTurees: Number,
    gerchilgeeniiZurag: String,
    unemlekhniiZurag: String,
    zuvshuurliinZurag: String,
    zoriulalt: String,
    tusgaiZoriulalt: String,
    khariltsagchiinNershil: String,
    talbaiNemeltNukhtsul: String,
    talbainDugaar: String,
    talbainIdnuud: [String],
    talbainNegjUne: Number,
    talbainNiitUne: Number,
    talbainKhemjee: Number,
    talbainKhemjeeMetrKube: Number,
    tooluuriinDugaar: String, // odooxondoo gantsaar awchixya tsaashid olshirwol yaaxaa shiidne
    davkhar: String,
    baritsaaAvakhDun: Number,
    baritsaaniiUldegdel: {
      type: Number,
      default: 0,
    },
    baritsaaBairshuulakhKhugatsaa: Number,
    baritsaaAvakhKhugatsaa: Number,
    baritsaaAvakhEsekh: Boolean,
    baiguullagiinId: String,
    baiguullagiinNer: String,
    aktiinZagvariinId: String,
    barilgiinId: String,
    gereeniiZagvariinId: String,
    tulukhUdur: [String],
    tuluv: Number,
    sanuulakhKhonog: Number,
    khuleekhKhonog: Number,
    khungulukhEsekh: Boolean,
    daraagiinTulukhOgnoo: Date,
    daraagiinSanuulakhOgnoo: Date,
    daraagiinKhuleekhOgnoo: Date,
    uldegdel: Number,
    aldangiinUldegdel: Number,
    niitTulsunAldangi: Number,
    avlaga: { type: avlagiinTurul, select: false },
    dans: String,
    turGereeEsekh: Boolean,
    guchKhonogOruulakhEsekh: Boolean,
    garaasKhonogOruulakhEsekh: Boolean,
    ekhniiSariinKhonog: Number,
    nekhemjlekhiinOgnoo: Date,
    zurguud: [String],
    zardluud: [
      {
        ner: String,
        turul: String,
        tariff: Number,
        tariffUsgeer: String,
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
