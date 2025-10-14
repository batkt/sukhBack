const asyncHandler = require("express-async-handler");
const GereeniiZaalt = require("../models/gereeniiZaalt");
const GereeniiZagvar = require("../models/gereeniiZagvar");
// const Khariltsagch = require("../models/khariltsagch");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
// const Talbai = require("../models/talbai");
// const Mashin = require("../models/mashin");
// const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
// const AshiglaltiinExcel = require("../models/ashiglaltiinExcel");
// const EkhniiUldegdelExcel = require("../models/ekhniiUldegdelExcel");
// const { Dans, Segment } = require("zevbackv2");
const aldaa = require("../components/aldaa");
const xlsx = require("xlsx");
// const moment = require("moment");
const lodash = require("lodash");
const excel = require("exceljs");
// const mongoose = require("mongoose");
// const {
//   Parking,
//   Mashin,
//   BlockMashin,
//   Uilchluulegch,
//   ZogsooliinTulbur,
//   uilchluulegchdiinToo,
//   sdkData,
// } = require("parking-v1");

function formatNumber(num, fixed = 2) {
  if (num === undefined || num === null || num === "")
    return formatNumber("0.00", fixed);
  var fixedNum = parseFloat(num).toFixed(fixed).toString();
  var numSplit = fixedNum.split(".");
  if (numSplit === null || numSplit.length === 0) {
    return formatNumber("0.00", fixed);
  }
  var firstFormatNum = numSplit[0]
    .toString()
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  if (lodash.isNaN(firstFormatNum)) firstFormatNum = "0";
  if (fixed === 0) return firstFormatNum;
  return firstFormatNum + "." + numSplit[1];
}

function usegTooruuKhurvuulekh(useg) {
  if (!!useg) return useg.charCodeAt() - 65;
  else return 0;
}

function toogUsegruuKhurvuulekh(too) {
  if (!!too) {
    if (too < 26) return String.fromCharCode(too + 65);
    else {
      var orongiinToo = Math.floor(too / 26);
      var uldegdel = too % 26;
      return (
        String.fromCharCode(orongiinToo + 64) +
        String.fromCharCode(uldegdel + 65)
      );
    }
  } else return 0;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

async function gereeBaivalBugluy(
  mashiniiJagsaalt,
  baiguullagiinId,
  tukhainBaaziinKholbolt
) {
  var match = {
    utas: { $in: utasnuud },
    baiguullagiinId: baiguullagiinId,
  };

  var utasnuud = [];
  mashiniiJagsaalt.forEach((a) => {
    utasnuud.push(a.ezemshigchiinUtas);
  });
  var gereeniiJagsaalt = await Geree(tukhainBaaziinKholbolt).find(match);
  if (gereeniiJagsaalt.length !== 0) {
    var tukhainMashin;
    gereeniiJagsaalt.forEach((x) => {
      tukhainMashin = mashiniiJagsaalt.find((a) =>
        x.utas.includes(a.ezemshigchiinUtas)
      );
      if (tukhainMashin) {
        tukhainMashin.ezemshigchiinRegister = x.register;
        tukhainMashin.ezemshigchiinTalbainDugaar = x.talbainDugaar;
        tukhainMashin.ezemshigchiinNer = x.ner;
        tukhainMashin.gereeniiDugaar = x.gereeniiDugaar;
      }
    });
  }
  return mashiniiJagsaalt;
}

async function gereeBaigaaEskhiigShalgaya(
  gereenuud,
  aldaaniiMsg,
  baiguullagiinId,
  tukhainBaaziinKholbolt
) {
  var jagsaalt = [];
  var shineAldaaniiMsg = "";
  gereenuud.forEach((a) => {
    jagsaalt.push(a.gereeniiDugaar);
  });
  var gereeniiJagsaalt = await Geree(tukhainBaaziinKholbolt).find({
    gereeniiDugaar: { $in: jagsaalt },
    baiguullagiinId: baiguullagiinId,
  });
  if (gereeniiJagsaalt.length !== 0) {
    gereeniiDugaaruud = [];
    gereeniiJagsaalt.forEach((x) => {
      gereeniiDugaaruud.push(x.gereeniiDugaar);
    });
    shineAldaaniiMsg =
      aldaaniiMsg +
      "Гэрээний дугаар давхардаж байна! : " +
      gereeniiDugaaruud +
      "<br/>";
  }
  if (shineAldaaniiMsg) aldaaniiMsg = shineAldaaniiMsg;
  return aldaaniiMsg;
}

// async function khariltsagchBaigaaEskhiigShalgaya(
//   gereenuud,
//   aldaaniiMsg,
//   baiguullagiinId,
//   barilgiinId,
//   tukhainBaaziinKholbolt
// ) {
//   var jagsaalt = [];
//   var shineAldaaniiMsg = "";
//   if (gereenuud)
//     gereenuud.forEach((a) => {
//       jagsaalt.push(a.register);
//     });
//   var tempJagsaalt;
//   var khariltsagchiinJagsaalt = await Khariltsagch(tukhainBaaziinKholbolt).find(
//     {
//       register: { $in: jagsaalt },
//       baiguullagiinId: baiguullagiinId,
//       barilgiinId: barilgiinId,
//     }
//   );
//   if (khariltsagchiinJagsaalt.length !== 0) {
//     oldooguiJagsaalt = [];
//     jagsaalt.forEach((x) => {
//       if (khariltsagchiinJagsaalt.find((a) => a.register == x) == null)
//         oldooguiJagsaalt.push(x);
//     });
//     if (oldooguiJagsaalt.length !== 0)
//       shineAldaaniiMsg =
//         aldaaniiMsg +
//         "Дараах бүртгэлийн дугаартай харилцагчид олдсонгүй! : " +
//         oldooguiJagsaalt +
//         "<br/>";
//   } else {
//     tempJagsaalt = await Khariltsagch(tukhainBaaziinKholbolt).find({
//       baiguullagiinId: baiguullagiinId,
//       barilgiinId: barilgiinId,
//       customerTin: { $in: jagsaalt },
//     });
//     if (!!tempJagsaalt && tempJagsaalt.length > 0) {
//       oldooguiJagsaalt = [];
//       jagsaalt.forEach((x) => {
//         if (tempJagsaalt.find((a) => a.customerTin == x) == null)
//           oldooguiJagsaalt.push(x);
//       });
//       if (oldooguiJagsaalt.length !== 0)
//         shineAldaaniiMsg =
//           aldaaniiMsg +
//           "Дараах бүртгэлийн дугаартай харилцагчид олдсонгүй! : " +
//           oldooguiJagsaalt +
//           "<br/>";
//     } else
//       shineAldaaniiMsg =
//         aldaaniiMsg +
//         "Дараах бүртгэлийн дугаартай харилцагчид олдсонгүй! : " +
//         jagsaalt +
//         "<br/>";
//   }
//   if (shineAldaaniiMsg) aldaaniiMsg = shineAldaaniiMsg;
//   else {
//     var tukhainKhariltsagch;
//     if (gereenuud)
//       gereenuud.forEach((x) => {
//         if (!!khariltsagchiinJagsaalt && khariltsagchiinJagsaalt.length > 0) {
//           tukhainKhariltsagch = khariltsagchiinJagsaalt.find(
//             (a) => a.register == x.register
//           );
//           x.ovog = tukhainKhariltsagch.ovog;
//           x.ner = tukhainKhariltsagch.ner;
//           x.turul = tukhainKhariltsagch.turul;
//           x.zakhirliinOvog = tukhainKhariltsagch.zakhirliinOvog;
//           x.zakhirliinNer = tukhainKhariltsagch.zakhirliinNer;
//           x.utas = tukhainKhariltsagch.utas;
//           x.mail = tukhainKhariltsagch.mail;
//           x.khayag = tukhainKhariltsagch.khayag;
//         } else if (!!tempJagsaalt && tempJagsaalt.length > 0) {
//           tukhainKhariltsagch = tempJagsaalt.find(
//             (a) => a.customerTin == x.register
//           );
//           x.ovog = tukhainKhariltsagch.ovog;
//           x.ner = tukhainKhariltsagch.ner;
//           x.turul = tukhainKhariltsagch.turul;
//           x.zakhirliinOvog = tukhainKhariltsagch.zakhirliinOvog;
//           x.zakhirliinNer = tukhainKhariltsagch.zakhirliinNer;
//           x.utas = tukhainKhariltsagch.utas;
//           x.mail = tukhainKhariltsagch.mail;
//           x.khayag = tukhainKhariltsagch.khayag;
//           x.customerTin = tukhainKhariltsagch.customerTin;
//         }
//       });
//   }
//   return aldaaniiMsg;
// }

// async function khariltsagchBaikhguigShalgaya(
//   khariltsagchid,
//   aldaaniiMsg,
//   baiguullagiinId,
//   barilgiinId,
//   tukhainBaaziinKholbolt
// ) {
//   var jagsaalt = [];
//   var utasniiJagsaalt = [];
//   var customTimJagsaalt = [];
//   var shineAldaaniiMsg = "";
//   if (khariltsagchid) {
//     khariltsagchid.forEach((a) => {
//       if (!!a.register) jagsaalt.push(a.register);
//       if (!!a.customerTin) customTimJagsaalt.push(a.customerTin);
//       if (a.utas && a.utas.length > 0) utasniiJagsaalt.push(a.utas[0]);
//     });
//   }

//   const toFindDuplicates = (arry) =>
//     arry.filter((item, index) => arry.indexOf(item) !== index);
//   var davkhardsanKod = toFindDuplicates(utasniiJagsaalt);
//   if (davkhardsanKod && davkhardsanKod.length > 0)
//     shineAldaaniiMsg =
//       aldaaniiMsg +
//       "Дараах утасны дугаартай харилцагчид давхардаж байна! : " +
//       davkhardsanKod +
//       "<br/>";

//   var khariltsagchiinJagsaalt = await Khariltsagch(tukhainBaaziinKholbolt).find(
//     {
//       register: { $in: jagsaalt },
//       baiguullagiinId: baiguullagiinId,
//       barilgiinId: barilgiinId,
//     }
//   );
//   if (khariltsagchiinJagsaalt.length > 0) {
//     var davkhardsanRegisteruud = [];
//     khariltsagchiinJagsaalt.forEach((a) => {
//       davkhardsanRegisteruud.push(a.register);
//     });
//     shineAldaaniiMsg =
//       aldaaniiMsg +
//       "Дараах бүртгэлийн дугаартай харилцагчид бүртгэлтэй байна! : " +
//       davkhardsanRegisteruud +
//       "<br/>";
//   }
//   var khariltsagchiinUtasniiJagsaalt = await Khariltsagch(
//     tukhainBaaziinKholbolt
//   ).find({
//     utas: { $in: utasniiJagsaalt },
//     baiguullagiinId: baiguullagiinId,
//     barilgiinId: barilgiinId,
//   });
//   if (khariltsagchiinUtasniiJagsaalt.length > 0) {
//     var davkhardsanUtasnuud = [];
//     khariltsagchiinUtasniiJagsaalt.forEach((a) => {
//       davkhardsanUtasnuud.push(...a.utas);
//     });
//     davkhardsanUtasnuud = davkhardsanUtasnuud.filter((x) =>
//       utasniiJagsaalt.includes(x)
//     );
//     shineAldaaniiMsg =
//       aldaaniiMsg +
//       "Дараах утасны дугаартай харилцагчид бүртгэлтэй байна! : " +
//       davkhardsanUtasnuud +
//       "<br/>";
//   }
//   var khariltsagchiinCustomerTinJagsaalt = await Khariltsagch(
//     tukhainBaaziinKholbolt
//   ).find({
//     customerTin: { $in: customTimJagsaalt },
//     baiguullagiinId: baiguullagiinId,
//     barilgiinId: barilgiinId,
//   });
//   if (khariltsagchiinCustomerTinJagsaalt.length > 0) {
//     var davkhardsanCustomerTinuud = [];
//     khariltsagchiinCustomerTinJagsaalt.forEach((a) => {
//       davkhardsanCustomerTinuud.push(...a.customerTin);
//     });
//     davkhardsanCustomerTinuud = davkhardsanCustomerTinuud.filter((x) =>
//       customTimJagsaalt.includes(x)
//     );
//     shineAldaaniiMsg =
//       aldaaniiMsg +
//       "Дараах бүртгэлийн дугаартай харилцагчид бүртгэлтэй байна! : " +
//       davkhardsanCustomerTinuud +
//       "<br/>";
//   }
//   if (shineAldaaniiMsg) aldaaniiMsg = shineAldaaniiMsg;
//   return aldaaniiMsg;
// }

// async function talbaiBaigaaEskhiigShalgaya(
//   gereenuud,
//   aldaaniiMsg,
//   baiguullagiinId,
//   barilgiinId,
//   tukhainBaaziinKholbolt
// ) {
//   var jagsaalt = [];
//   var shineAldaaniiMsg = "";
//   gereenuud.forEach((a) => {
//     if (a.talbainDugaar.includes(",")) {
//       jagsaalt = [...jagsaalt, ...a.talbainDugaar.split(",")];
//     } else jagsaalt.push(a.talbainDugaar);
//   });
//   var talbainJagsaalt = await Talbai(tukhainBaaziinKholbolt).find({
//     kod: { $in: jagsaalt },
//     baiguullagiinId: baiguullagiinId,
//     barilgiinId: barilgiinId,
//   });
//   var gereeJagsaalt = await Geree(tukhainBaaziinKholbolt).find({
//     talbainDugaar: { $in: jagsaalt },
//     baiguullagiinId: baiguullagiinId,
//     barilgiinId: barilgiinId,
//     tuluv: { $ne: -1 },
//   });
//   if (talbainJagsaalt.length !== 0) {
//     oldooguiJagsaalt = [];
//     jagsaalt.forEach((x) => {
//       if (talbainJagsaalt.find((a) => a.kod == x) == null)
//         oldooguiJagsaalt.push(x);
//     });
//     if (oldooguiJagsaalt.length !== 0)
//       shineAldaaniiMsg =
//         aldaaniiMsg +
//         "Дараах дугаартай талбайнуудын мэдээлэл олдсонгүй! : " +
//         oldooguiJagsaalt +
//         "<br/>";
//   } else
//     shineAldaaniiMsg =
//       aldaaniiMsg +
//       "Дараах дугаартай талбайнуудын мэдээлэл олдсонгүй! : " +
//       jagsaalt +
//       "<br/>";
//   if (gereeJagsaalt?.length > 0) {
//     gereeJagsaalt.forEach((x) => {
//       shineAldaaniiMsg +=
//         aldaaniiMsg +
//         x.talbainDugaar +
//         " гэсэн талбай дээр гэрээ байгуулагдсан байна! Гэрээний дугаар: " +
//         x.gereeniiDugaar +
//         "<br/>";
//     });
//   }

//   if (shineAldaaniiMsg) aldaaniiMsg = shineAldaaniiMsg;
//   else {
//     gereenuud.forEach((x) => {
//       if (x.talbainDugaar.includes(",")) {
//         var tukhainTalbainuud = talbainJagsaalt.filter((a) =>
//           x.talbainDugaar.split(",").includes(a.kod)
//         );
//         tukhainTalbainuud.forEach((mur) => {
//           x.davkhar = mur.davkhar;
//           x.talbainNegjUne = mur.talbainNegjUne;
//           x.talbainNiitUne =
//             (x.talbainNiitUne != null ? x.talbainNiitUne : 0) +
//             mur.talbainNiitUne;
//           x.talbainKhemjee =
//             (x.talbainKhemjee != null ? x.talbainKhemjee : 0) +
//             mur.talbainKhemjee;
//           x.sariinTurees = x.talbainNiitUne;
//           x.talbainIdnuud.push(mur._id);
//           x.baritsaaAvakhDun =
//             x.baritsaaAwakhKhugatsaa * mur.talbainNiitUne +
//             (x.baritsaaAvakhDun != null ? x.baritsaaAvakhDun : 0);
//         });
//       } else {
//         var tukhainTalbai = talbainJagsaalt.find(
//           (a) => a.kod == x.talbainDugaar
//         );
//         x.davkhar = tukhainTalbai.davkhar;
//         x.talbainNegjUne = tukhainTalbai.talbainNegjUne;
//         x.talbainNiitUne = tukhainTalbai.talbainNiitUne;
//         x.talbainKhemjee = tukhainTalbai.talbainKhemjee;
//         x.talbainKhemjeeMetrKube = tukhainTalbai.talbainKhemjeeMetrKube;
//         x.sariinTurees = tukhainTalbai.talbainNiitUne;
//         x.talbainIdnuud = [tukhainTalbai._id];
//         x.baritsaaAvakhDun =
//           x.baritsaaAwakhKhugatsaa * tukhainTalbai.talbainNiitUne;
//       }
//     });
//   }
//   return aldaaniiMsg;
// }

exports.gereeniiZaaltTatya = asyncHandler(async (req, res, next) => {
  try {
    const workbook = xlsx.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jagsaalt = [];
    var tolgoinObject = {};
    for (let cell in worksheet) {
      var cellAsString = cell.toString();
      if (
        cellAsString[1] === "1" &&
        cellAsString.length == 2 &&
        !!worksheet[cellAsString].v
      ) {
        if (worksheet[cellAsString].v.includes("Харагдах дугаар"))
          tolgoinObject.kharagdakhDugaar = cellAsString[0];
        else if (worksheet[cellAsString].v.includes("Заалт"))
          tolgoinObject.zaalt = cellAsString[0];
        else if (worksheet[cellAsString].v.includes("Хамаарах хэсэг"))
          tolgoinObject.khamaarakh = cellAsString[0];
      }
    }
    var data = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 1,
    });
    data.forEach((mur) => {
      let object = new GereeniiZaalt(req.body.tukhainBaaziinKholbolt)();
      object.kharagdakhDugaar =
        mur[usegTooruuKhurvuulekh(tolgoinObject.kharagdakhDugaar)];
      object.zaalt = mur[usegTooruuKhurvuulekh(tolgoinObject.zaalt)];
      object.khamaarakh = mur[usegTooruuKhurvuulekh(tolgoinObject.khamaarakh)];
      object.baiguullagiinId = req.body.baiguullagiinId;
      object.barilgiinId = req.body.barilgiinId;
      jagsaalt.push(object);
    });
    var aldaaniiMsg = "";
    if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
    GereeniiZaalt(req.body.tukhainBaaziinKholbolt).insertMany(
      jagsaalt,
      function (err) {
        if (err) {
          next(err);
        }
        res.status(200).send("Amjilttai");
      }
    );
  } catch (error) {
    next(error);
  }
});

// exports.talbaiTatya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//     const jagsaalt = [];
//     var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//       baiguullagiinId: req.body.baiguullagiinId,
//       turul: "talbai",
//     });
//     var ObjectId = require("mongodb").ObjectId;

//     const { db } = require("zevbackv2");
//     var barilga = await Baiguullaga(db.erunkhiiKholbolt).aggregate([
//       {
//         $match: {
//           _id: new ObjectId(req.body.baiguullagiinId),
//         },
//       },
//       {
//         $unwind: {
//           path: "$barilguud",
//         },
//       },
//       {
//         $match: {
//           "barilguud._id": new ObjectId(req.body.barilgiinId),
//         },
//       },
//       {
//         $project: {
//           davkhar: "$barilguud.davkharuud.davkhar",
//         },
//       },
//     ]);
//     var tolgoinObject = {};
//     var muriinDugaar = 1;
//     if (
//       !worksheet["A1"].v.includes("Давхар") ||
//       !worksheet["B1"].v.includes("Талбайн №") ||
//       !worksheet["C1"].v.includes("Талбайн хэмжээ") ||
//       !worksheet["D1"].v.includes("Талбайн метркуб") ||
//       !worksheet["E1"].v.includes("Талбайн нэгж үнэ") ||
//       !worksheet["F1"].v.includes("Талбайн нийт үнэ") ||
//       !worksheet["G1"].v.includes("Тайлбар") ||
//       !worksheet["H1"].v.includes("Нийтийн талбай эсэх")
//     ) {
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     }
//     for (let cell in worksheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!worksheet[cellAsString].v
//       ) {
//         if (worksheet[cellAsString].v.includes("Давхар"))
//           tolgoinObject.davkhar = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Талбайн хэмжээ"))
//           tolgoinObject.talbainKhemjee = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Талбайн метркуб"))
//           tolgoinObject.talbainKhemjeeMetrKube = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Талбайн №"))
//           tolgoinObject.kod = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Талбайн нэгж үнэ"))
//           tolgoinObject.talbainNegjUne = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Талбайн нийт үнэ"))
//           tolgoinObject.talbainNiitUne = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject.tailbar = cellAsString[0];
//         else if (worksheet[cellAsString].v.includes("Нийтийн талбай эсэх"))
//           tolgoinObject.niitiinTalbai = cellAsString[0];
//         else if (segmentuud && segmentuud.length > 0) {
//           var segment = segmentuud.find(
//             (element) => element.ner === worksheet[cellAsString].v
//           );
//           if (segment) tolgoinObject[segment.ner] = cellAsString[0];
//         }
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(worksheet, {
//       header: 1,
//       range: 1,
//     });
//     var kodnuud = [];
//     var aldaaniiMsg = "";
//     for await (const mur of data) {
//       muriinDugaar++;
//       let object = new Talbai(req.body.tukhainBaaziinKholbolt)();
//       object.davkhar = mur[usegTooruuKhurvuulekh(tolgoinObject.davkhar)];
//       object.talbainKhemjee =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainKhemjee)];
//       object.talbainKhemjeeMetrKube =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainKhemjeeMetrKube)];

//       object.kod = mur[usegTooruuKhurvuulekh(tolgoinObject.kod)];
//       object.talbainNegjUne =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainNegjUne)];
//       object.talbainNiitUne =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainNiitUne)];
//       object.tailbar = mur[usegTooruuKhurvuulekh(tolgoinObject.tailbar)];
//       object.niitiinTalbaiEsekh =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.niitiinTalbai)] == "Тийм";
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       object.tureesiinTulbur = object.talbainNiitUne;
//       if (segmentuud && segmentuud.length > 0) {
//         segmentuud.forEach((segment) => {
//           if (tolgoinObject.hasOwnProperty(segment.ner)) {
//             if (object.segmentuud && object.segmentuud.length > 0) {
//               object.segmentuud.push({
//                 ner: segment.ner,
//                 utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//               });
//             } else {
//               object.segmentuud = [
//                 {
//                   ner: segment.ner,
//                   utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//                 },
//               ];
//             }
//           }
//         });
//       }
//       if (
//         object.davkhar ||
//         object.talbainKhemjee ||
//         object.kod ||
//         object.talbainNegjUne ||
//         object.talbainNiitUne ||
//         object.tailbar
//       ) {
//         if (
//           !object.davkhar ||
//           !barilga[0].davkhar.includes(object.davkhar) ||
//           !object.talbainKhemjee ||
//           !object.kod ||
//           !object.talbainNegjUne ||
//           !object.talbainNiitUne
//         ) {
//           aldaaniiMsg = aldaaniiMsg + muriinDugaar + " дугаар мөрөнд ";
//           if (!object.davkhar) aldaaniiMsg = aldaaniiMsg + "Давхар ";
//           if (!object.talbainKhemjee)
//             aldaaniiMsg = aldaaniiMsg + "Талбайн хэмжээ ";
//           if (!object.kod) aldaaniiMsg = aldaaniiMsg + "Талбайн № ";
//           if (!object.talbainNegjUne)
//             aldaaniiMsg = aldaaniiMsg + "Талбайн нэгж үнэ ";
//           if (!object.talbainNiitUne)
//             aldaaniiMsg = aldaaniiMsg + "Талбайн нийт үнэ ";
//           if (
//             !object.davkhar ||
//             !object.talbainKhemjee ||
//             !object.kod ||
//             !object.talbainNegjUne ||
//             !object.talbainNiitUne
//           )
//             aldaaniiMsg = aldaaniiMsg + "талбар хоосон ,<br/>";
//           if (!barilga[0].davkhar.includes(object.davkhar)) {
//             aldaaniiMsg = aldaaniiMsg + "давхарын утгыг буруу оруулсан ! <br/>";
//           }

//           aldaaniiMsg = aldaaniiMsg + "байна! <br/>";
//         } else {
//           jagsaalt.push(object);
//           kodnuud.push(object.kod);
//         }
//       }
//     }
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     const toFindDuplicates = (arry) =>
//       arry.filter((item, index) => arry.indexOf(item) !== index);
//     var davkhardsanKod = toFindDuplicates(kodnuud);
//     if (davkhardsanKod && davkhardsanKod.length > 0)
//       throw new aldaa(
//         "Дараах дугаартай талбайнууд давхардаж байна! " +
//           davkhardsanKod.toString()
//       );
//     var talbainuud = await Talbai(req.body.tukhainBaaziinKholbolt).find({
//       kod: { $in: kodnuud },
//       baiguullagiinId: req.body.baiguullagiinId,
//       barilgiinId: req.body.barilgiinId,
//     });
//     if (talbainuud && talbainuud.length > 0) {
//       var talbainDugaaruud = [];
//       for await (const talbai of talbainuud) {
//         talbainDugaaruud.push(talbai.kod);
//       }
//       throw new aldaa(
//         "Дараах дугаартай талбайнууд бүртгэлтэй байна! " +
//           talbainDugaaruud.toString()
//       );
//     } else
//       Talbai(req.body.tukhainBaaziinKholbolt).insertMany(
//         jagsaalt,
//         function (err) {
//           if (err) {
//             throw new Error(err);
//           }
//           res.status(200).send("Amjilttai");
//         }
//       );
//   } catch (error) {
//     next(error);
//   }
// });

exports.gereeniiZagvarTatya = asyncHandler(async (req, res, next) => {
  try {
    const workbook = xlsx.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jagsaalt = [];
    var tolgoinObject = {};
    var data = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 1,
    });
    if (!worksheet["Гэрээ"]) throw new Error("Буруу файл байна!");
    var zagvariinNer = worksheet["Гэрээ"].v;
    const zagvar = new GereeniiZagvar(req.body.tukhainBaaziinKholbolt)();
    zagvar.ner = zagvariinNer;
    data.forEach((mur) => {
      let object = new GereeniiZaalt(req.body.tukhainBaaziinKholbolt)();
      object.kharagdakhDugaar = mur[0];
      object.zaalt = mur[1];
      object.khamaarakhKheseg = mur[2];
      if (!object.kharagdakhDugaar) object.kharagdakhDugaar = "";
      jagsaalt.push(object);
    });
    zagvar.dedKhesguud = jagsaalt;
    zagvar.baiguullagiinId = req.body.baiguullagiinId;
    zagvar.barilgiinId = req.body.barilgiinId;
    var aldaaniiMsg = "";
    if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
    zagvar
      .save()
      .then((result) => {
        res.status(200).send("Amjilttai");
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.gereeniiZagvarAvya = asyncHandler(async (req, res, next) => {
  let workbook = new excel.Workbook();
  let worksheet = workbook.addWorksheet("Гэрээ");
  worksheet.columns = [
    {
      header: "Загварын нэр",
      width: 20,
    },
    {
      header: "",
      key: "",
      width: 30,
    },
    {
      header: "Хамаарагдах алхам",
      key: "Хамаарагдах алхам",
      width: 20,
    },
  ];
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "attachment; filename=" + "Гэрээний загвар"
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

// exports.talbainZagvarAvya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheet = workbook.addWorksheet("Талбай");
//   var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//     baiguullagiinId: req.body.baiguullagiinId,
//     turul: "talbai",
//   });
//   var baganuud = [
//     {
//       header: "Давхар",
//       key: "Давхар",
//       width: 20,
//     },
//     {
//       header: "Талбайн №",
//       key: "Талбайн №",
//       width: 30,
//     },
//     {
//       header: "Талбайн хэмжээ",
//       key: "Талбайн хэмжээ",
//       width: 30,
//     },
//     {
//       header: "Талбайн метркуб",
//       key: "Талбайн метркуб",
//       width: 30,
//     },
//     {
//       header: "Талбайн нэгж үнэ",
//       key: "Талбайн нэгж үнэ",
//       width: 20,
//     },
//     {
//       header: "Талбайн нийт үнэ",
//       key: "Талбайн нийт үнэ",
//       width: 20,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       width: 20,
//     },
//     {
//       header: "Нийтийн талбай эсэх",
//       key: "Нийтийн талбай эсэх",
//       width: 20,
//     },
//   ];
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       baganuud.push({
//         header: x.ner,
//         key: x.ner,
//         width: 20,
//       });
//     });
//   }
//   worksheet.columns = baganuud;
//   if (segmentuud && segmentuud.length > 0) {
//     var baganiiToo = 7;
//     segmentuud.forEach((x) => {
//       var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//       var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//       worksheet.dataValidations.add(bagana, {
//         type: "list",
//         allowBlank: false,
//         formulae: [`"${x.utguud.join(",")}"`],
//         showErrorMessage: true,
//         errorStyle: "error",
//         error: "Тохирох утгыг сонгоно уу!",
//       });
//       baganiiToo = baganiiToo + 1;
//     });
//   }
//   worksheet.dataValidations.add("H2:H9999", {
//     type: "list",
//     allowBlank: false,
//     formulae: ['"Тийм,Үгүй"'],
//     showErrorMessage: true,
//     errorStyle: "error",
//     error: "Тохирох утгыг сонгоно уу!",
//   });
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );

//   return workbook.xlsx.write(res).then(function () {
//     res.status(200).end();
//   });
// });

// exports.khariltsagchZagvarAvya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheet = workbook.addWorksheet("Иргэн");
//   var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//     baiguullagiinId: req.body.baiguullagiinId,
//     turul: "khariltsagch",
//   });
//   var baganuud = [
//     {
//       header: "Код",
//       key: "Код",
//       width: 30,
//     },
//     {
//       header: "Овог",
//       key: "Овог",
//       width: 30,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       width: 20,
//     },
//     {
//       header: "Регистр",
//       key: "Регистр",
//       width: 20,
//     },
//     {
//       header: "Бүртгэлийн дугаар",
//       key: "Бүртгэлийн дугаар",
//       width: 20,
//     },
//     {
//       header: "Утас",
//       key: "Утас",
//       width: 20,
//     },
//     {
//       header: "Мэйл",
//       key: "Мэйл",
//       width: 20,
//     },
//     {
//       header: "Хаяг",
//       key: "Хаяг",
//       width: 20,
//     },
//   ];
//   var baganiiToo = baganuud.length;
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       baganuud.push({
//         header: x.ner,
//         key: x.ner,
//         width: 20,
//       });
//     });
//   }
//   worksheet.columns = baganuud;
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//       var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//       worksheet.dataValidations.add(bagana, {
//         type: "list",
//         allowBlank: false,
//         formulae: [`"${x.utguud.join(",")}"`],
//         showErrorMessage: true,
//         errorStyle: "error",
//         error: "Тохирох утгыг сонгоно уу!",
//       });
//       baganiiToo = baganiiToo + 1;
//     });
//   }

//   let worksheet1 = workbook.addWorksheet("ААН");
//   var baganuud = [
//     {
//       header: "Код",
//       key: "Код",
//       width: 30,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       width: 20,
//     },
//     {
//       header: "Улсын бүртгэлийн дугаар",
//       key: "Улсын бүртгэлийн дугаар",
//       width: 20,
//     },
//     {
//       header: "Захирлын овог",
//       key: "Захирлын овог",
//       width: 20,
//     },
//     {
//       header: "Захирлын нэр",
//       key: "Захирлын нэр",
//       width: 20,
//     },
//     {
//       header: "Мэйл",
//       key: "Мэйл",
//       width: 20,
//     },
//     {
//       header: "Утас",
//       key: "Утас",
//       width: 20,
//     },
//     {
//       header: "Хаяг",
//       key: "Хаяг",
//       width: 20,
//     },
//   ];
//   baganiiToo = baganuud.length;
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       baganuud.push({
//         header: x.ner,
//         key: x.ner,
//         width: 20,
//       });
//     });
//   }
//   worksheet1.columns = baganuud;
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//       var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//       worksheet1.dataValidations.add(bagana, {
//         type: "list",
//         allowBlank: false,
//         formulae: [`"${x.utguud.join(",")}"`],
//         showErrorMessage: true,
//         errorStyle: "error",
//         error: "Тохирох утгыг сонгоно уу!",
//       });
//       baganiiToo = baganiiToo + 1;
//     });
//   }
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     "attachment; filename=" + encodeURI("Харилцагч.xlsx")
//   );
//   workbook.xlsx.write(res).then(function () {
//     res.end();
//   });
// });

// exports.gereeniiExcelAvya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheet = workbook.addWorksheet("365 хоног");
//   let worksheet30 = workbook.addWorksheet("30 хоног");
//   var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//     baiguullagiinId: req.body.baiguullagiinId,
//     turul: "geree",
//   });
//   var zardluud = await AshiglaltiinZardluud(
//     req.body.tukhainBaaziinKholbolt
//   ).find({
//     baiguullagiinId: req.body.baiguullagiinId,
//     barilgiinId: req.params.barilgiinId,
//   });
//   var dansnuud = await Dans(req.body.tukhainBaaziinKholbolt).find({
//     baiguullagiinId: req.body.baiguullagiinId,
//     barilgiinId: req.params.barilgiinId,
//   });
//   var baganuud = [
//     {
//       header: "Гэрээний дугаар",
//       key: "Гэрээний дугаар",
//       width: 30,
//     },
//     {
//       header: "Регистр/Бүртгэлийн дугаар",
//       key: "Регистр/Бүртгэлийн дугаар",
//       width: 30,
//     },
//     {
//       header: "Эхлэх огноо",
//       key: "Эхлэх огноо",
//       width: 20,
//     },
//     {
//       header: "Хугацаа(Сараар)",
//       key: "Хугацаа(Сараар)",
//       width: 20,
//     },
//     {
//       header: "Авлага үүсэх өдөр",
//       key: "Авлага үүсэх өдөр",
//       width: 20,
//     },
//     {
//       header: "Талбайн код",
//       key: "Талбайн код",
//       width: 20,
//     },
//     {
//       header: "Барьцаа авах хугацаа",
//       key: "Барьцаа авах хугацаа",
//       width: 20,
//     },
//     {
//       header: "Барьцаа байршуулах хугацаа",
//       key: "Барьцаа байршуулах хугацаа",
//       width: 20,
//     },
//     {
//       header: "Авлага",
//       key: "Авлага",
//       width: 20,
//     },
//     {
//       header: "Эхний сарын ашиглах хоног",
//       key: "Эхний сарын ашиглах хоног",
//       width: 20,
//     },
//   ];

//   var baganiiToo = baganuud.length;
//   if (dansnuud?.length > 0) {
//     baganuud.push({
//       header: "Данс",
//       key: "Данс",
//       width: 20,
//     });
//     var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//     var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//     worksheet.dataValidations.add(bagana, {
//       type: "list",
//       allowBlank: false,
//       formulae: [`"${dansnuud?.map((a) => a.dugaar).join(",")}"`],
//       showErrorMessage: true,
//       errorStyle: "error",
//       error: "Данс сонгоно уу!",
//     });
//     worksheet30.dataValidations.add(bagana, {
//       type: "list",
//       allowBlank: false,
//       formulae: [`"${dansnuud?.map((a) => a.dugaar).join(",")}"`],
//       showErrorMessage: true,
//       errorStyle: "error",
//       error: "Данс сонгоно уу!",
//     });
//     baganiiToo = baganiiToo + 1;
//   }
//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       baganuud.push({
//         header: x.ner,
//         key: x.ner,
//         width: 20,
//       });
//     });
//   }
//   if (zardluud && zardluud.length > 0) {
//     zardluud.forEach((x) => {
//       baganuud.push({
//         header: x.ner,
//         key: x.ner,
//         width: 20,
//       });
//       if (x.turul === "Дурын") {
//         baganuud.push({
//           header: x.ner + " дүн",
//           key: x.ner + " дүн",
//           width: 20,
//         });
//       }
//     });
//   }
//   worksheet.columns = baganuud;
//   worksheet30.columns = baganuud;

//   if (segmentuud && segmentuud.length > 0) {
//     segmentuud.forEach((x) => {
//       if (x.utguud) {
//         var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//         var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//         worksheet.dataValidations.add(bagana, {
//           type: "list",
//           allowBlank: false,
//           formulae: [`"${x.utguud.join(",")}"`],
//           showErrorMessage: true,
//           errorStyle: "error",
//           error: "Тохирох утгыг сонгоно уу!",
//         });
//         worksheet30.dataValidations.add(bagana, {
//           type: "list",
//           allowBlank: false,
//           formulae: [`"${x.utguud.join(",")}"`],
//           showErrorMessage: true,
//           errorStyle: "error",
//           error: "Тохирох утгыг сонгоно уу!",
//         });
//       }
//       baganiiToo = baganiiToo + 1;
//     });
//   }
//   if (zardluud && zardluud.length > 0) {
//     zardluud.forEach((x) => {
//       if (x.turul != "төг") {
//         var baganiiUseg = toogUsegruuKhurvuulekh(baganiiToo);
//         var bagana = baganiiUseg + "2:" + baganiiUseg + "9999";
//         worksheet.dataValidations.add(bagana, {
//           type: "list",
//           allowBlank: false,
//           formulae: ['"Авна,Авахгүй"'],
//           showErrorMessage: true,
//           errorStyle: "error",
//           error: "Тохирох утгыг сонгоно уу!",
//         });
//         worksheet30.dataValidations.add(bagana, {
//           type: "list",
//           allowBlank: false,
//           formulae: ['"Авна,Авахгүй"'],
//           showErrorMessage: true,
//           errorStyle: "error",
//           error: "Тохирох утгыг сонгоно уу!",
//         });
//       }
//       baganiiToo = baganiiToo + (x.turul === "Дурын" ? 2 : 1);
//     });
//   }
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     "attachment; filename=" + encodeURI("Гэрээ.xlsx")
//   );
//   workbook.xlsx.write(res).then(function () {
//     res.end();
//   });
// });

// exports.gereeniiExcelTatya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     var zagvariinId;
//     if (req.body.zagvariinId) zagvariinId = req.body.zagvariinId;
//     else throw new aldaa("Загвараа сонгоно уу!");
//     var ognoo;
//     var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//       baiguullagiinId: req.body.baiguullagiinId,
//       turul: "geree",
//     });
//     var zardluud = await AshiglaltiinZardluud(
//       req.body.tukhainBaaziinKholbolt
//     ).find({
//       baiguullagiinId: req.body.baiguullagiinId,
//       barilgiinId: req.body.barilgiinId,
//     });
//     const { db } = require("zevbackv2");
//     if (req.body.ognoo) ognoo = req.body.ognoo;
//     else throw new aldaa("Огноо сонгоно уу!");
//     if (!req.body.barilgiinId) throw new aldaa("Барилгаа сонгоно уу!");
//     const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//     const worksheet30 = workbook.Sheets[workbook.SheetNames[1]];
//     const jagsaalt = [];
//     var tolgoinObject = {};
//     var tolgoinObject30 = {};
//     var baritsaaAvakhSar = await Baiguullaga(req.body.tukhainBaaziinKholbolt)
//       .findById({
//         _id: req.body.baiguullagiinId,
//       })
//       .select({ "tokhirgoo.baritsaaAvakhSar": 1 });
//     if (
//       baritsaaAvakhSar &&
//       baritsaaAvakhSar.tokhirgoo &&
//       baritsaaAvakhSar.tokhirgoo.baritsaaAvakhSar
//     )
//       baritsaaAvakhSar = baritsaaAvakhSar.tokhirgoo.baritsaaAvakhSar;
//     else baritsaaAvakhSar = 0;
//     for (let cell in worksheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!worksheet[cellAsString].v
//       ) {
//         try {
//           if (worksheet[cellAsString].v.includes("Гэрээний дугаар"))
//             tolgoinObject.gereeniiDugaar = cellAsString[0];
//           else if (
//             worksheet[cellAsString].v.includes("Регистр/Бүртгэлийн дугаар")
//           )
//             tolgoinObject.register = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Эхлэх огноо"))
//             tolgoinObject.gereeniiOgnoo = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Хугацаа(Сараар)"))
//             tolgoinObject.khugatsaa = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Авлага үүсэх өдөр"))
//             tolgoinObject.tulukhUdur = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Талбайн код"))
//             tolgoinObject.talbainDugaar = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Барьцаа авах хугацаа"))
//             tolgoinObject.baritsaaAwakhKhugatsaa = cellAsString[0];
//           else if (
//             worksheet[cellAsString].v.includes("Барьцаа байршуулах хугацаа")
//           )
//             tolgoinObject.baritsaaBairshuulakhKhugatsaa = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Авлага"))
//             tolgoinObject.avlaga = cellAsString[0];
//           else if (worksheet[cellAsString].v.includes("Данс"))
//             tolgoinObject.dans = cellAsString[0];
//           else if (
//             worksheet[cellAsString].v.includes("Эхний сарын ашиглах хоног")
//           )
//             tolgoinObject.ekhniiSariinKhonog = cellAsString[0];
//           else if (
//             (segmentuud && segmentuud.length > 0) ||
//             (zardluud && zardluud.length > 0)
//           ) {
//             if (segmentuud && segmentuud.length > 0) {
//               var segment = segmentuud.find(
//                 (element) => element.ner === worksheet[cellAsString].v
//               );
//               if (segment) tolgoinObject[segment.ner] = cellAsString[0];
//             }
//             if (zardluud && zardluud.length > 0) {
//               var zardal = zardluud.find(
//                 (element) => element.ner === worksheet[cellAsString].v
//               );
//               if (zardal) {
//                 tolgoinObject[zardal.ner] = cellAsString[0];
//                 if (zardal.turul === "Дурын") {
//                   for (const key in worksheet) {
//                     if (
//                       key[1] === "1" &&
//                       key.length == 2 &&
//                       !!worksheet[cellAsString].v &&
//                       worksheet[key].v === zardal.ner + " дүн"
//                     ) {
//                       tolgoinObject[zardal.ner + " дүн"] = key[0];
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         } catch (err) {
//           throw new aldaa("Буруу файл байна! " + err);
//         }
//       }
//     }
//     for (let cell in worksheet30) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!worksheet30[cellAsString].v
//       ) {
//         try {
//           if (worksheet30[cellAsString].v.includes("Гэрээний дугаар"))
//             tolgoinObject30.gereeniiDugaar = cellAsString[0];
//           else if (
//             worksheet30[cellAsString].v.includes("Регистр/Бүртгэлийн дугаар")
//           )
//             tolgoinObject30.register = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Эхлэх огноо"))
//             tolgoinObject30.gereeniiOgnoo = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Хугацаа(Сараар)"))
//             tolgoinObject30.khugatsaa = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Авлага үүсэх өдөр"))
//             tolgoinObject30.tulukhUdur = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Талбайн код"))
//             tolgoinObject30.talbainDugaar = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Барьцаа авах хугацаа"))
//             tolgoinObject30.baritsaaAwakhKhugatsaa = cellAsString[0];
//           else if (
//             worksheet30[cellAsString].v.includes("Барьцаа байршуулах хугацаа")
//           )
//             tolgoinObject30.baritsaaBairshuulakhKhugatsaa = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Авлага"))
//             tolgoinObject30.avlaga = cellAsString[0];
//           else if (worksheet30[cellAsString].v.includes("Данс"))
//             tolgoinObject30.dans = cellAsString[0];
//           else if (
//             worksheet30[cellAsString].v.includes("Эхний сарын ашиглах хоног")
//           )
//             tolgoinObject30.ekhniiSariinKhonog = cellAsString[0];
//           else if (
//             (segmentuud && segmentuud.length > 0) ||
//             (zardluud && zardluud.length > 0)
//           ) {
//             if (segmentuud && segmentuud.length > 0) {
//               var segment = segmentuud.find(
//                 (element) => element.ner === worksheet30[cellAsString].v
//               );
//               if (segment) tolgoinObject30[segment.ner] = cellAsString[0];
//             }
//             if (zardluud && zardluud.length > 0) {
//               var zardal = zardluud.find(
//                 (element) => element.ner === worksheet30[cellAsString].v
//               );
//               if (zardal) {
//                 tolgoinObject30[zardal.ner] = cellAsString[0];
//                 if (zardal.turul === "Дурын") {
//                   for (const key in worksheet30) {
//                     if (
//                       key[1] === "1" &&
//                       key.length == 2 &&
//                       !!worksheet30[key].v &&
//                       worksheet30[key].v === zardal.ner + " дүн"
//                     ) {
//                       tolgoinObject30[zardal.ner + " дүн"] = key[0];
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         } catch (err) {
//           throw new aldaa("Буруу файл байна! " + err);
//         }
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(worksheet, {
//       header: 1,
//       range: 1,
//     });
//     var data30 = xlsx.utils.sheet_to_json(worksheet30, {
//       header: 1,
//       range: 1,
//     });
//     var aldaaniiMsg = "";
//     var muriinDugaar = 1;
//     try {
//       data.forEach((mur) => {
//         muriinDugaar++;
//         let object = new Geree(req.body.tukhainBaaziinKholbolt)();
//         object.tuluv = 1;
//         object.gereeniiDugaar =
//           mur[usegTooruuKhurvuulekh(tolgoinObject.gereeniiDugaar)];
//         object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
//         object.gereeniiOgnoo = new ExcelDateToJSDate(
//           mur[usegTooruuKhurvuulekh(tolgoinObject.gereeniiOgnoo)]
//         );
//         object.khugatsaa = mur[usegTooruuKhurvuulekh(tolgoinObject.khugatsaa)];
//         var ekhlekhOgnoo = new Date(object.gereeniiOgnoo);
//         object.duusakhOgnoo = new Date(
//           ekhlekhOgnoo.setMonth(ekhlekhOgnoo.getMonth() + object.khugatsaa)
//         );
//         object.tulukhUdur = [
//           mur[usegTooruuKhurvuulekh(tolgoinObject.tulukhUdur)],
//         ];
//         object.talbainDugaar =
//           mur[usegTooruuKhurvuulekh(tolgoinObject.talbainDugaar)];
//         object.baritsaaAwakhKhugatsaa =
//           mur[usegTooruuKhurvuulekh(tolgoinObject.baritsaaAwakhKhugatsaa)];
//         if (!object.baritsaaAwakhKhugatsaa) object.baritsaaAwakhKhugatsaa = 0;
//         object.baritsaaBairshuulakhKhugatsaa =
//           mur[
//             usegTooruuKhurvuulekh(tolgoinObject.baritsaaBairshuulakhKhugatsaa)
//           ];
//         object.uldegdel = mur[usegTooruuKhurvuulekh(tolgoinObject.avlaga)];
//         object.dans = mur[usegTooruuKhurvuulekh(tolgoinObject.dans)];
//         object.ekhniiSariinKhonog =
//           mur[usegTooruuKhurvuulekh(tolgoinObject.ekhniiSariinKhonog)];
//         object.guchKhonogOruulakhEsekh = false;
//         object.garaasKhonogOruulakhEsekh = !!object.ekhniiSariinKhonog;
//         object.daraagiinTulukhOgnoo = moment(ognoo)
//           .add(1, "month")
//           .set("date", object.tulukhUdur);
//         object.baritsaaAvakhKhugatsaa =
//           baritsaaAvakhSar === 0
//             ? mur[usegTooruuKhurvuulekh(tolgoinObject.baritsaaAwakhKhugatsaa)]
//             : baritsaaAvakhSar;
//         object.baritsaaAvakhEsekh = object.baritsaaAvakhKhugatsaa > 0;
//         object.avlaga = { guilgeenuud: [] };
//         if (!!object.uldegdel)
//           object.avlaga.guilgeenuud.push({
//             ognoo,
//             tulukhDun: object.uldegdel,
//             undsenDun: object.uldegdel,
//           });
//         object.gereeniiZagvariinId = zagvariinId;
//         object.baiguullagiinId = req.body.baiguullagiinId;
//         object.barilgiinId = req.body.barilgiinId;
//         if (segmentuud && segmentuud.length > 0) {
//           segmentuud.forEach((segment) => {
//             if (tolgoinObject.hasOwnProperty(segment.ner)) {
//               if (object.segmentuud && object.segmentuud.length > 0) {
//                 object.segmentuud.push({
//                   ner: segment.ner,
//                   utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//                 });
//               } else {
//                 object.segmentuud = [
//                   {
//                     ner: segment.ner,
//                     utga: mur[
//                       usegTooruuKhurvuulekh(tolgoinObject[segment.ner])
//                     ],
//                   },
//                 ];
//               }
//             }
//           });
//         }

//         if (zardluud && zardluud.length > 0) {
//           zardluud.forEach((zardal) => {
//             if (zardal.turul == "Дурын")
//               zardal.dun =
//                 mur[usegTooruuKhurvuulekh(tolgoinObject[zardal.ner + " дүн"])];
//             if (tolgoinObject.hasOwnProperty(zardal.ner)) {
//               if (
//                 mur[usegTooruuKhurvuulekh(tolgoinObject[zardal.ner])] !=
//                   "Авахгүй" &&
//                 mur[usegTooruuKhurvuulekh(tolgoinObject[zardal.ner])] !=
//                   undefined
//               ) {
//                 if (object.zardluud && object.zardluud.length > 0) {
//                   object.zardluud.push(zardal);
//                 } else {
//                   object.zardluud = [zardal];
//                 }
//               }
//             }
//           });
//         }
//         if (
//           !object.register ||
//           !object.gereeniiOgnoo ||
//           !object.khugatsaa ||
//           !object.talbainDugaar ||
//           object.gereeniiOgnoo < Date.parse("2010-01-01") ||
//           !object.tulukhUdur ||
//           !isNumeric(object.tulukhUdur[0])
//         ) {
//           aldaaniiMsg = aldaaniiMsg + muriinDugaar + " дугаар мөрөнд ";
//           if (!object.register) aldaaniiMsg = aldaaniiMsg + "Регистр ";
//           if (!object.gereeniiOgnoo)
//             aldaaniiMsg = aldaaniiMsg + "Гэрээний огноо ";
//           if (!object.khugatsaa) aldaaniiMsg = aldaaniiMsg + "Хугацаа ";
//           if (!object.talbainDugaar) aldaaniiMsg = aldaaniiMsg + "Талбайн код ";
//           if (
//             !object.register ||
//             !object.gereeniiOgnoo ||
//             !object.khugatsaa ||
//             !object.talbainDugaar
//           )
//             aldaaniiMsg = aldaaniiMsg + "талбар хоосон ";
//           if (object.gereeniiOgnoo < Date.parse("2010-01-01"))
//             aldaaniiMsg = aldaaniiMsg + "Гэрээний огноо буруу ";
//           if (!object.tulukhUdur || !isNumeric(object.tulukhUdur[0]))
//             aldaaniiMsg = aldaaniiMsg + "Төлөх өдөр буруу ";
//           aldaaniiMsg = aldaaniiMsg + "байна! <br/>";
//         } else jagsaalt.push(object);
//       });
//     } catch (err) {
//       throw new aldaa(
//         aldaaniiMsg + muriinDugaar + " дугаар мөрөнд алдаа гарлаа" + err
//       );
//     }
//     muriinDugaar = 1;
//     try {
//       data30.forEach((mur) => {
//         muriinDugaar++;
//         let object = new Geree(req.body.tukhainBaaziinKholbolt)();
//         object.tuluv = 1;
//         object.gereeniiDugaar =
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.gereeniiDugaar)];
//         object.register = mur[usegTooruuKhurvuulekh(tolgoinObject30.register)];
//         object.gereeniiOgnoo = new ExcelDateToJSDate(
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.gereeniiOgnoo)]
//         );
//         object.khugatsaa =
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.khugatsaa)];
//         var ekhlekhOgnoo = new Date(object.gereeniiOgnoo);
//         object.duusakhOgnoo = new Date(
//           ekhlekhOgnoo.setMonth(ekhlekhOgnoo.getMonth() + object.khugatsaa)
//         );
//         object.tulukhUdur = [
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.tulukhUdur)],
//         ];
//         object.talbainDugaar =
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.talbainDugaar)];
//         object.baritsaaAwakhKhugatsaa =
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.baritsaaAwakhKhugatsaa)];
//         if (!object.baritsaaAwakhKhugatsaa) object.baritsaaAwakhKhugatsaa = 0;
//         object.baritsaaBairshuulakhKhugatsaa =
//           mur[
//             usegTooruuKhurvuulekh(tolgoinObject30.baritsaaBairshuulakhKhugatsaa)
//           ];
//         object.uldegdel = mur[usegTooruuKhurvuulekh(tolgoinObject30.avlaga)];
//         object.dans = mur[usegTooruuKhurvuulekh(tolgoinObject30.dans)];
//         object.ekhniiSariinKhonog =
//           mur[usegTooruuKhurvuulekh(tolgoinObject30.ekhniiSariinKhonog)];
//         object.guchKhonogOruulakhEsekh = true;
//         object.garaasKhonogOruulakhEsekh = !!object.ekhniiSariinKhonog;
//         object.daraagiinTulukhOgnoo = moment(ognoo)
//           .add(1, "month")
//           .set("date", object.tulukhUdur);
//         object.baritsaaAvakhKhugatsaa =
//           baritsaaAvakhSar === 0
//             ? mur[usegTooruuKhurvuulekh(tolgoinObject30.baritsaaAwakhKhugatsaa)]
//             : baritsaaAvakhSar;
//         object.baritsaaAvakhEsekh = object.baritsaaAvakhKhugatsaa > 0;
//         object.avlaga = { guilgeenuud: [] };
//         if (!!object.uldegdel)
//           object.avlaga.guilgeenuud.push({
//             ognoo,
//             tulukhDun: object.uldegdel,
//             undsenDun: object.uldegdel,
//           });
//         object.gereeniiZagvariinId = zagvariinId;
//         object.baiguullagiinId = req.body.baiguullagiinId;
//         object.barilgiinId = req.body.barilgiinId;
//         if (segmentuud && segmentuud.length > 0) {
//           segmentuud.forEach((segment) => {
//             if (tolgoinObject30.hasOwnProperty(segment.ner)) {
//               if (object.segmentuud && object.segmentuud.length > 0) {
//                 object.segmentuud.push({
//                   ner: segment.ner,
//                   utga: mur[
//                     usegTooruuKhurvuulekh(tolgoinObject30[segment.ner])
//                   ],
//                 });
//               } else {
//                 object.segmentuud = [
//                   {
//                     ner: segment.ner,
//                     utga: mur[
//                       usegTooruuKhurvuulekh(tolgoinObject30[segment.ner])
//                     ],
//                   },
//                 ];
//               }
//             }
//           });
//         }

//         if (zardluud && zardluud.length > 0) {
//           zardluud.forEach((zardal) => {
//             if (zardal.turul === "Дурын")
//               zardal.dun =
//                 mur[
//                   usegTooruuKhurvuulekh(tolgoinObject30[zardal.ner + " дүн"])
//                 ];
//             if (tolgoinObject30.hasOwnProperty(zardal.ner)) {
//               if (
//                 mur[usegTooruuKhurvuulekh(tolgoinObject30[zardal.ner])] !=
//                   "Авахгүй" &&
//                 mur[usegTooruuKhurvuulekh(tolgoinObject30[zardal.ner])] !=
//                   undefined
//               ) {
//                 if (object.zardluud && object.zardluud.length > 0) {
//                   object.zardluud.push(zardal);
//                 } else {
//                   object.zardluud = [zardal];
//                 }
//               }
//             }
//           });
//         }
//         if (
//           !object.register ||
//           !object.gereeniiOgnoo ||
//           !object.khugatsaa ||
//           !object.talbainDugaar ||
//           object.gereeniiOgnoo < Date.parse("2010-01-01") ||
//           !object.tulukhUdur ||
//           !isNumeric(object.tulukhUdur[0])
//         ) {
//           aldaaniiMsg = aldaaniiMsg + muriinDugaar + " дугаар мөрөнд ";
//           if (!object.register) aldaaniiMsg = aldaaniiMsg + "Регистр ";
//           if (!object.gereeniiOgnoo)
//             aldaaniiMsg = aldaaniiMsg + "Гэрээний огноо ";
//           if (!object.khugatsaa) aldaaniiMsg = aldaaniiMsg + "Хугацаа ";
//           if (!object.talbainDugaar) aldaaniiMsg = aldaaniiMsg + "Талбайн код ";
//           if (
//             !object.register ||
//             !object.gereeniiOgnoo ||
//             !object.khugatsaa ||
//             !object.talbainDugaar
//           )
//             aldaaniiMsg = aldaaniiMsg + "талбар хоосон ";
//           if (object.gereeniiOgnoo < Date.parse("2010-01-01"))
//             aldaaniiMsg = aldaaniiMsg + "Гэрээний огноо буруу ";
//           if (!object.tulukhUdur || !isNumeric(object.tulukhUdur[0]))
//             aldaaniiMsg = aldaaniiMsg + "Төлөх өдөр буруу ";
//           aldaaniiMsg = aldaaniiMsg + "байна! <br/>";
//         } else jagsaalt.push(object);
//       });
//     } catch (err) {
//       throw new aldaa(
//         aldaaniiMsg + muriinDugaar + " дугаар мөрөнд алдаа гарлаа" + err
//       );
//     }
//     if (jagsaalt.length == 0) throw new Error("Хоосон файл байна!");
//     aldaaniiMsg = await gereeBaigaaEskhiigShalgaya(
//       jagsaalt,
//       aldaaniiMsg,
//       req.body.baiguullagiinId,
//       req.body.tukhainBaaziinKholbolt
//     );
//     aldaaniiMsg = await khariltsagchBaigaaEskhiigShalgaya(
//       jagsaalt,
//       aldaaniiMsg,
//       req.body.baiguullagiinId,
//       req.body.barilgiinId,
//       db.erunkhiiKholbolt
//     );
//     aldaaniiMsg = await talbaiBaigaaEskhiigShalgaya(
//       jagsaalt,
//       aldaaniiMsg,
//       req.body.baiguullagiinId,
//       req.body.barilgiinId,
//       req.body.tukhainBaaziinKholbolt
//     );
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     jagsaalt.forEach((x) => {
//       var data = [];
//       new Array(x.khugatsaa || 0).fill("").map((mur, index) => {
//         x.tulukhUdur.forEach((udur) => {
//           if (
//             moment(ognoo).add(index, "month").set("date", udur) <=
//             moment(x.duusakhOgnoo)
//           ) {
//             var dun = ekhniiSariinDunZasyaSync(
//               x,
//               moment(ognoo).add(index, "month").set("date", udur),
//               moment(x.gereeniiOgnoo).startOf("month"),
//               x.talbainNiitUne
//             ); // Ekhnii sariin dun bodokh
//             data.push({
//               ognoo: moment(ognoo).add(index, "month").set("date", udur),
//               undsenDun: dun,
//               tulukhDun: dun,
//               turul: "khuvaari",
//             });
//             if (x.zardluud && x.zardluud.length > 0)
//               x.zardluud.forEach((zardal) => {
//                 if (zardal && !zardal.ner?.includes("Цахилгаан")) {
//                   if (zardal.turul == "1м2")
//                     zardal.dun = tooZasyaSync(
//                       zardal.tariff * (x.talbainKhemjee || 0)
//                     );
//                   if (zardal.turul == "1м3/талбай")
//                     zardal.dun = tooZasyaSync(
//                       zardal.tariff * (x.talbainKhemjeeMetrKube || 0)
//                     );
//                   if (zardal.turul == "Тогтмол") zardal.dun = zardal.tariff;
//                   if (!!zardal.dun) {
//                     var zardalDun = ekhniiSariinDunZasyaSync(
//                       x,
//                       moment(ognoo).add(index, "month").set("date", udur),
//                       moment(x.gereeniiOgnoo).startOf("month"),
//                       zardal.dun
//                     ); // Ekhnii sariin dun bodokh
//                     data.push({
//                       turul: "avlaga",
//                       tailbar: zardal.ner,
//                       ognoo: moment(ognoo)
//                         .add(index, "month")
//                         .set("date", udur),
//                       tulukhDun: zardalDun,
//                     });
//                   }
//                 }
//               });
//           }
//         });
//       });
//       x.avlaga.guilgeenuud = [...x.avlaga.guilgeenuud, ...data];
//       if (baritsaaAvakhSar > 0) {
//         x.avlaga.guilgeenuud = [
//           ...x.avlaga.guilgeenuud,
//           {
//             turul: "baritsaa",
//             ognoo: x.gereeniiOgnoo,
//             khyamdral: 0,
//             undsenDun: x.talbainNiitUne * baritsaaAvakhSar,
//             tulukhDun: x.talbainNiitUne * baritsaaAvakhSar,
//           },
//         ];
//       }
//     });
//     Geree(req.body.tukhainBaaziinKholbolt).insertMany(jagsaalt);
//     var talbainBulk = [];
//     var khariltsagchBulk = [];
//     jagsaalt.forEach((a) => {
//       a.talbainIdnuud.forEach((b) => {
//         let upsertTalbai = {
//           updateOne: {
//             filter: {
//               _id: b,
//               baiguullagiinId: req.body.baiguullagiinId,
//               barilgiinId: req.body.barilgiinId,
//             },
//             update: {
//               idevkhiteiEsekh: true,
//             },
//           },
//         };
//         talbainBulk.push(upsertTalbai);
//       });
//       let upsertKhariltsagcj = {
//         updateOne: {
//           filter: {
//             register: a.register,
//             baiguullagiinId: req.body.baiguullagiinId,
//             barilgiinId: req.body.barilgiinId,
//           },
//           update: {
//             idevkhiteiEsekh: true,
//           },
//         },
//       };
//       khariltsagchBulk.push(upsertKhariltsagcj);
//       let upsertTinKhariltsagcj = {
//         updateOne: {
//           filter: {
//             customerTin: a.register,
//             baiguullagiinId: req.body.baiguullagiinId,
//             barilgiinId: req.body.barilgiinId,
//           },
//           update: {
//             idevkhiteiEsekh: true,
//           },
//         },
//       };
//       khariltsagchBulk.push(upsertTinKhariltsagcj);
//     });
//     if (talbainBulk)
//       Talbai(req.body.tukhainBaaziinKholbolt)
//         .bulkWrite(talbainBulk)
//         .then((bulkWriteOpResult) => {})
//         .catch((err) => {
//           next(err);
//         });
//     if (khariltsagchBulk)
//       Khariltsagch(db.erunkhiiKholbolt)
//         .bulkWrite(khariltsagchBulk)
//         .then((bulkWriteOpResult) => {})
//         .catch((err) => {
//           next(err);
//         });
//     res.status(200).send("Amjilttai");
//   } catch (error) {
//     next(error);
//   }
// });

// function ekhniiSariinDunZasyaSync(body, turOgnoo, ekhlekhOgnoo, dun) {
//   if (
//     moment(turOgnoo).format("YYYY/MM") ===
//     moment(ekhlekhOgnoo).format("YYYY/MM")
//   ) {
//     var sariinNiitKhonog = body.guchKhonogOruulakhEsekh
//       ? 30
//       : parseFloat(moment(ekhlekhOgnoo).endOf("month").format("DD"));
//     var ashiglakhKhonog = body.garaasKhonogOruulakhEsekh
//       ? body.ekhniiSariinKhonog
//       : moment(ekhlekhOgnoo).endOf("month").diff(body.gereeniiOgnoo, "d") + 1;
//     ashiglakhKhonog =
//       sariinNiitKhonog < ashiglakhKhonog ? sariinNiitKhonog : ashiglakhKhonog; // 28 < 30
//     dun = (dun * ashiglakhKhonog) / (sariinNiitKhonog || 1);
//   }
//   return dun;
// }

// function tooZasyaSync(too) {
//   var zassanToo = Math.round((too + Number.EPSILON) * 100) / 100;
//   return +zassanToo.toFixed(2);
// }

// function ExcelDateToJSDate(date) {
//   return new Date(Math.round((date - 25569) * 86400 * 1000));
// }

// exports.mashiniiExcelAvya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheetGereet = workbook.addWorksheet("Гэрээт");
//   let worksheetDotood = workbook.addWorksheet("Дотоод");
//   let worksheetDuriin = workbook.addWorksheet("Дурын");
//   let worksheetSOKH = workbook.addWorksheet("СӨХ");
//   let worksheetTureeslegch = workbook.addWorksheet("Түрээслэгч");
//   let worksheetBaiguullaga = workbook.addWorksheet("Байгууллага");
//   worksheetGereet.columns = [
//     {
//       header: "Утас",
//       key: "Утас",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Эхлэх огноо",
//       key: "Эхлэх огноо",
//       headerRow: true,
//       style: { numFmt: "yyyy/mm/dd" },
//       width: 20,
//     },
//     {
//       header: "Дуусах огноо",
//       key: "Дуусах огноо",
//       headerRow: true,
//       style: { numFmt: "yyyy/mm/dd" },
//       width: 20,
//     },
//   ];
//   worksheetDotood.columns = [
//     {
//       header: "Утас",
//       key: "Утас",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//   ];
//   worksheetDuriin.columns = [
//     {
//       header: "Утас",
//       key: "Утас",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Цэнэглэх дүн",
//       key: "Цэнэглэх дүн",
//       headerRow: true,
//       width: 30,
//     },
//   ];
//   worksheetSOKH.columns = [
//     {
//       header: "Утас",
//       key: "Утас",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Төлөв",
//       key: "Төлөв",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Камерын IP",
//       key: "Камерын IP",
//       headerRow: true,
//       width: 30,
//     },
//   ];
//   worksheetTureeslegch.columns = [
//     {
//       header: "Утас",
//       key: "Утас",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//   ];
//   worksheetBaiguullaga.columns = [
//     {
//       header: "Хөнгөлөлт төрөл",
//       key: "Хөнгөлөлт төрөл",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Хугацаа/мин",
//       key: "Хугацаа/мин",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Нэр",
//       key: "Нэр",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Тайлбар",
//       key: "Тайлбар",
//       headerRow: true,
//       width: 30,
//     },
//     {
//       header: "Машины дугаар",
//       key: "Машины дугаар",
//       headerRow: true,
//       width: 20,
//     },
//   ];

//   worksheetSOKH.dataValidations.add("E2:E9999", {
//     type: "list",
//     allowBlank: false,
//     formulae: ['"Дотор, Гадна"'],
//     showErrorMessage: true,
//     errorStyle: "error",
//     error: "Тохирох утгыг сонгоно уу!",
//   });
//   worksheetBaiguullaga.dataValidations.add("A2:A9999", {
//     type: "list",
//     allowBlank: false,
//     formulae: ['"Сараар, Долоо хоног"'],
//     showErrorMessage: true,
//     errorStyle: "error",
//     error: "Тохирох утгыг сонгоно уу!",
//   });
//   worksheetGereet.dataValidations.add("E2:E9999", {
//     type: "date",
//     operator: "between",
//     allowBlank: true,
//     formulae: ["2024-01-01", "2030-12-31"],
//     showErrorMessage: true,
//     errorTitle: "Буруу огноо",
//     error: "Огноо оруулна уу!",
//     promptTitle: "Огноо оруулах",
//     prompt: "Дуусах огноог оруулна уу!",
//   });
//   worksheetGereet.dataValidations.add("F2:F9999", {
//     type: "date",
//     operator: "between",
//     allowBlank: true,
//     formulae: ["2024-01-01", "2030-12-31"],
//     showErrorMessage: true,
//     errorTitle: "Буруу огноо",
//     error: "Огноо оруулна уу!",
//     promptTitle: "Огноо оруулах",
//     prompt: "Дуусах огноог оруулна уу!",
//   });

//   function styleHeaderRow(ws) {
//     ws.getRow(1).eachCell((cell) => {
//       cell.fill = {
//         type: "pattern",
//         pattern: "solid",
//         fgColor: { argb: "4ca64c" },
//       };
//       cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
//       cell.alignment = { horizontal: "center", vertical: "middle" };
//     });
//   }

//   styleHeaderRow(worksheetBaiguullaga);
//   styleHeaderRow(worksheetGereet);
//   styleHeaderRow(worksheetDotood);
//   styleHeaderRow(worksheetTureeslegch);
//   styleHeaderRow(worksheetSOKH);
//   styleHeaderRow(worksheetDuriin);
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     "attachment; filename=" + encodeURI("Машины мэдээлэл.xlsx")
//   );
//   workbook.xlsx.write(res).then(function () {
//     res.end();
//   });
// });

// exports.mashiniiExcelTatya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     if (
//       workbook.SheetNames[0] !== "Гэрээт" ||
//       workbook.SheetNames[1] !== "Дотоод" ||
//       workbook.SheetNames[2] !== "Дурын" ||
//       workbook.SheetNames[3] !== "СӨХ" ||
//       workbook.SheetNames[4] !== "Түрээслэгч" ||
//       workbook.SheetNames[5] !== "Байгууллага"
//     )
//       throw new aldaa("Та загварын workbook дагуу бөглөөгүй байна!");
//     const mashinSheetGereet = workbook.Sheets[workbook.SheetNames[0]];
//     const mashinSheetDotood = workbook.Sheets[workbook.SheetNames[1]];
//     const mashinSheetDuriin = workbook.Sheets[workbook.SheetNames[2]];
//     const mashinSheetSOKH = workbook.Sheets[workbook.SheetNames[3]];
//     const mashinSheetTureeslegch = workbook.Sheets[workbook.SheetNames[4]];
//     const mashinSheetBaiguullaga = workbook.Sheets[workbook.SheetNames[5]];
//     var jagsaalt = [];
//     var tolgoinObject = {};
//     var tolgoinObject1 = {};
//     var tolgoinObject2 = {};
//     var tolgoinObject3 = {};
//     var tolgoinObject4 = {};
//     var tolgoinObject5 = {};
//     if (
//       !mashinSheetGereet["A1"].v.includes("Утас") ||
//       !mashinSheetGereet["B1"].v.includes("Машины дугаар") ||
//       !mashinSheetGereet["C1"].v.includes("Нэр") ||
//       !mashinSheetGereet["D1"].v.includes("Тайлбар") ||
//       !mashinSheetGereet["E1"].v.includes("Эхлэх огноо") ||
//       !mashinSheetGereet["F1"].v.includes("Дуусах огноо")
//     ) {
//       throw new aldaa("Та загварын gereet дагуу бөглөөгүй байна!");
//     }
//     if (
//       !mashinSheetDuriin["A1"].v.includes("Утас") ||
//       !mashinSheetDuriin["B1"].v.includes("Машины дугаар") ||
//       !mashinSheetDuriin["C1"].v.includes("Нэр") ||
//       !mashinSheetDuriin["D1"].v.includes("Тайлбар") ||
//       !mashinSheetDuriin["E1"].v.includes("Цэнэглэх дүн")
//     ) {
//       throw new aldaa("Та загварын duriin дагуу бөглөөгүй байна!");
//     }
//     if (
//       !mashinSheetDotood["A1"].v.includes("Утас") ||
//       !mashinSheetDotood["B1"].v.includes("Машины дугаар") ||
//       !mashinSheetDotood["C1"].v.includes("Нэр") ||
//       !mashinSheetDotood["D1"].v.includes("Тайлбар")
//     ) {
//       throw new aldaa("Та загварын dotood дагуу бөглөөгүй байна!");
//     }
//     if (
//       !mashinSheetSOKH["A1"].v.includes("Утас") ||
//       !mashinSheetSOKH["B1"].v.includes("Машины дугаар") ||
//       !mashinSheetSOKH["C1"].v.includes("Нэр") ||
//       !mashinSheetSOKH["D1"].v.includes("Тайлбар") ||
//       !mashinSheetSOKH["E1"].v.includes("Төлөв") ||
//       !mashinSheetSOKH["F1"].v.includes("Камерын IP")
//     ) {
//       throw new aldaa("Та загварын sokh дагуу бөглөөгүй байна!");
//     }
//     if (
//       !mashinSheetTureeslegch["A1"].v.includes("Утас") ||
//       !mashinSheetTureeslegch["B1"].v.includes("Машины дугаар") ||
//       !mashinSheetTureeslegch["C1"].v.includes("Нэр") ||
//       !mashinSheetTureeslegch["D1"].v.includes("Тайлбар")
//     ) {
//       throw new aldaa("Та загварын tureeslegch дагуу бөглөөгүй байна!");
//     }
//     if (
//       !mashinSheetBaiguullaga["A1"].v.includes("Хөнгөлөлт төрөл") ||
//       !mashinSheetBaiguullaga["B1"].v.includes("Хугацаа/мин") ||
//       !mashinSheetBaiguullaga["C1"].v.includes("Нэр") ||
//       !mashinSheetBaiguullaga["D1"].v.includes("Тайлбар") ||
//       !mashinSheetBaiguullaga["E1"].v.includes("Машины дугаар")
//     ) {
//       throw new aldaa("Та загварын baiguullaga дагуу бөглөөгүй байна!");
//     }
//     for (let cell in mashinSheetDuriin) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetDuriin[cellAsString].v
//       ) {
//         if (mashinSheetDuriin[cellAsString].v.includes("Утас"))
//           tolgoinObject.utas = cellAsString[0];
//         else if (mashinSheetDuriin[cellAsString].v.includes("Машины дугаар"))
//           tolgoinObject.dugaar = cellAsString[0];
//         else if (mashinSheetDuriin[cellAsString].v.includes("Нэр"))
//           tolgoinObject.ner = cellAsString[0];
//         else if (mashinSheetDuriin[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject.temdeglel = cellAsString[0];
//         else if (mashinSheetDuriin[cellAsString].v.includes("Цэнэглэх дүн"))
//           tolgoinObject.tsenegDun = cellAsString[0];
//       }
//     }
//     for (let cell in mashinSheetDotood) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetDotood[cellAsString].v
//       ) {
//         if (mashinSheetDotood[cellAsString].v.includes("Утас"))
//           tolgoinObject1.utas = cellAsString[0];
//         else if (mashinSheetDotood[cellAsString].v.includes("Машины дугаар"))
//           tolgoinObject1.dugaar = cellAsString[0];
//         else if (mashinSheetDotood[cellAsString].v.includes("Нэр"))
//           tolgoinObject1.ner = cellAsString[0];
//         else if (mashinSheetDotood[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject1.temdeglel = cellAsString[0];
//       }
//     }
//     for (let cell in mashinSheetGereet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetGereet[cellAsString].v
//       ) {
//         if (mashinSheetGereet[cellAsString].v.includes("Утас"))
//           tolgoinObject2.utas = cellAsString[0];
//         else if (mashinSheetGereet[cellAsString].v.includes("Машины дугаар"))
//           tolgoinObject2.dugaar = cellAsString[0];
//         else if (mashinSheetGereet[cellAsString].v.includes("Нэр"))
//           tolgoinObject2.ner = cellAsString[0];
//         else if (mashinSheetGereet[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject2.temdeglel = cellAsString[0];
//         else if (mashinSheetGereet[cellAsString].v.includes("Эхлэх огноо"))
//           tolgoinObject2.ekhlekhOgnoo = cellAsString[0];
//         else if (mashinSheetGereet[cellAsString].v.includes("Дуусах огноо"));
//         tolgoinObject2.duusakhOgnoo = cellAsString[0];
//       }
//     }
//     for (let cell in mashinSheetSOKH) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetSOKH[cellAsString].v
//       ) {
//         if (mashinSheetSOKH[cellAsString].v.includes("Утас"))
//           tolgoinObject3.utas = cellAsString[0];
//         else if (mashinSheetSOKH[cellAsString].v.includes("Машины дугаар"))
//           tolgoinObject3.dugaar = cellAsString[0];
//         else if (mashinSheetSOKH[cellAsString].v.includes("Нэр"))
//           tolgoinObject3.ner = cellAsString[0];
//         else if (mashinSheetSOKH[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject3.temdeglel = cellAsString[0];
//         else if (mashinSheetSOKH[cellAsString].v.includes("Төлөв"))
//           tolgoinObject3.tuluv = cellAsString[0];
//         else if (mashinSheetSOKH[cellAsString].v.includes("Камерын IP"))
//           tolgoinObject3.cameraIP = cellAsString[0];
//       }
//     }
//     for (let cell in mashinSheetTureeslegch) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetTureeslegch[cellAsString].v
//       ) {
//         if (mashinSheetTureeslegch[cellAsString].v.includes("Утас"))
//           tolgoinObject4.ezemshigchiinUtas = cellAsString[0];
//         else if (
//           mashinSheetTureeslegch[cellAsString].v.includes("Машины дугаар")
//         )
//           tolgoinObject4.dugaar = cellAsString[0];
//         else if (mashinSheetTureeslegch[cellAsString].v.includes("Нэр"))
//           tolgoinObject4.ner = cellAsString[0];
//         else if (mashinSheetTureeslegch[cellAsString].v.includes("Тайлбар"));
//         tolgoinObject4.temdeglel = cellAsString[0];
//       }
//     }
//     for (let cell in mashinSheetBaiguullaga) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheetBaiguullaga[cellAsString].v
//       ) {
//         if (mashinSheetBaiguullaga[cellAsString].v.includes("Хөнгөлөлт төрөл"))
//           tolgoinObject5.khungulultTurul = cellAsString[0];
//         else if (mashinSheetBaiguullaga[cellAsString].v.includes("Хугацаа/мин"))
//           tolgoinObject5.khungulukhKhugatsaa = cellAsString[0];
//         else if (mashinSheetBaiguullaga[cellAsString].v.includes("Нэр"))
//           tolgoinObject5.ner = cellAsString[0];
//         else if (mashinSheetBaiguullaga[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject5.tailbar = cellAsString[0];
//         else if (
//           mashinSheetBaiguullaga[cellAsString].v.includes("Машины дугаар")
//         )
//           tolgoinObject5.mashiniiDugaar = cellAsString[0];
//       }
//     }
//     var dataDuriin = xlsx.utils.sheet_to_json(mashinSheetDuriin, {
//       header: 1,
//       range: 1,
//     });
//     var dataGereet = xlsx.utils.sheet_to_json(mashinSheetGereet, {
//       header: 1,
//       range: 1,
//     });
//     var dataDotood = xlsx.utils.sheet_to_json(mashinSheetDotood, {
//       header: 1,
//       range: 1,
//     });
//     var dataSOKH = xlsx.utils.sheet_to_json(mashinSheetSOKH, {
//       header: 1,
//       range: 1,
//     });
//     var dataTureeslegch = xlsx.utils.sheet_to_json(mashinSheetTureeslegch, {
//       header: 1,
//       range: 1,
//     });
//     var dataBaiguullaga = xlsx.utils.sheet_to_json(mashinSheetBaiguullaga, {
//       header: 1,
//       range: 1,
//     });
//     // end ywsan
//     var aldaaniiMsg = "";
//     var muriinDugaarDuriin = 1;
//     var muriinDugaarDotood = 1;
//     var muriinDugaarGereet = 1;
//     var muriinDugaarSOKH = 1;
//     var muriinDugaarTureeslegch = 1;
//     var muriinDugaarBaiguullaga = 1;
//     dataDuriin.forEach((mur) => {
//       muriinDugaarDuriin++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar =
//         mur[
//           usegTooruuKhurvuulekh(tolgoinObject.dugaar.trim().replace(/\s/g, ""))
//         ];
//       object.ezemshigchiinNer = mur[usegTooruuKhurvuulekh(tolgoinObject.ner)];
//       object.ezemshigchiinUtas = mur[usegTooruuKhurvuulekh(tolgoinObject.utas)];
//       object.turul = "Дурын";
//       object.tsenegDun = Number(
//         mur[usegTooruuKhurvuulekh(tolgoinObject.tsenegDun)]
//       )?.toLocaleString("en-US");
//       object.temdeglel = mur[usegTooruuKhurvuulekh(tolgoinObject.temdeglel)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (!object.dugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           `(${workbook.SheetNames[2]})` +
//           " sheet-ны " +
//           muriinDugaarDuriin +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//       }
//     });
//     dataGereet.forEach((mur) => {
//       muriinDugaarGereet++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar =
//         mur[
//           usegTooruuKhurvuulekh(tolgoinObject.dugaar.trim().replace(/\s/g, ""))
//         ];
//       object.ezemshigchiinNer = mur[usegTooruuKhurvuulekh(tolgoinObject2.ner)];
//       object.ezemshigchiinUtas =
//         mur[usegTooruuKhurvuulekh(tolgoinObject2.utas)];
//       object.turul = "Гэрээт";
//       object.ekhlekhOgnoo = new ExcelDateToJSDate(
//         mur[usegTooruuKhurvuulekh(tolgoinObject2.ekhlekhOgnoo)]
//       );
//       object.duusakhOgnoo = new ExcelDateToJSDate(
//         mur[usegTooruuKhurvuulekh(tolgoinObject2.duusakhOgnoo)]
//       );
//       object.temdeglel = mur[usegTooruuKhurvuulekh(tolgoinObject2.temdeglel)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (
//         !object.dugaar ||
//         !object.ezemshigchiinNer ||
//         !object.ezemshigchiinUtas ||
//         !object.ekhlekhOgnoo ||
//         !object.duusakhOgnoo
//       ) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[0] +
//           " sheet-ны " +
//           muriinDugaarGereet +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         if (!object.ezemshigchiinNer)
//           aldaaniiMsg = aldaaniiMsg + "'Эзэмшигчийн нэр', ";
//         if (!object.ezemshigchiinUtas) aldaaniiMsg = aldaaniiMsg + "'Утас', ";
//         if (!object.ekhlekhOgnoo || !object.duusakhOgnoo)
//           aldaaniiMsg = aldaaniiMsg + "'Огноо', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else if (!/[0-9]{4}[А-Я|а-я|ө|Ө|ү|Ү]{3}/.test(object.dugaar)) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[0] +
//           " sheet-ны " +
//           muriinDugaarGereet +
//           " дугаар мөрөнд ";
//         aldaaniiMsg =
//           aldaaniiMsg + "машины дугаар буруу бичигдсэн байна! <br/>";
//       } else if (!/[0-9]{8}/.test(object.ezemshigchiinUtas)) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[0] +
//           " sheet-ны " +
//           muriinDugaarGereet +
//           " дугаар мөрөнд ";
//         aldaaniiMsg =
//           aldaaniiMsg + "Утасны дугаар буруу бичигдсэн байна! <br/>";
//       } else if (
//         Number(moment(object.duusakhOgnoo).diff(object.ekhlekhOgnoo, "d")) < 1
//       ) {
//         aldaaniiMsg =
//           "Алдаа! " +
//           workbook.SheetNames[1] +
//           " sheet-ны " +
//           muriinDugaarGereet +
//           " дугаар мөрөнд байгаа ";
//         aldaaniiMsg = aldaaniiMsg + "дуусах огноог шалгана уу, ";
//       } else if (
//         Number(moment(new Date()).diff(object.ekhlekhOgnoo, "month")) > 12
//       ) {
//         aldaaniiMsg =
//           "Алдаа! " +
//           workbook.SheetNames[1] +
//           " sheet-ны " +
//           muriinDugaarGereet +
//           " дугаар мөрөнд байгаа ";
//         aldaaniiMsg = aldaaniiMsg + "эхлэх огноог шалгана уу, ";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//       }
//     });
//     // Dotood
//     var gereeniiDugaaruud = [];
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     dataDotood.forEach((mur) => {
//       muriinDugaarDotood++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar =
//         mur[
//           usegTooruuKhurvuulekh(tolgoinObject.dugaar.trim().replace(/\s/g, ""))
//         ];
//       object.ezemshigchiinNer = mur[usegTooruuKhurvuulekh(tolgoinObject1.ner)];
//       object.ezemshigchiinUtas =
//         mur[usegTooruuKhurvuulekh(tolgoinObject1.utas)];
//       object.turul = "Дотоод";
//       object.temdeglel = mur[usegTooruuKhurvuulekh(tolgoinObject1.temdeglel)];
//       object.gereeniiDugaar =
//         mur[usegTooruuKhurvuulekh(tolgoinObject1.gereeniiDugaar)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (!object.dugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[1] +
//           " sheet-ны " +
//           muriinDugaarDotood +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//         if (!!object.gereeniiDugaar)
//           gereeniiDugaaruud.push(object.gereeniiDugaar);
//       }
//     });
//     // СӨХ
//     dataSOKH.forEach((mur) => {
//       muriinDugaarSOKH++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar =
//         mur[
//           usegTooruuKhurvuulekh(tolgoinObject.dugaar.trim().replace(/\s/g, ""))
//         ];
//       object.ezemshigchiinNer = mur[usegTooruuKhurvuulekh(tolgoinObject3.ner)];
//       object.ezemshigchiinUtas =
//         mur[usegTooruuKhurvuulekh(tolgoinObject3.utas)];
//       object.turul = "СӨХ";
//       object.temdeglel = mur[usegTooruuKhurvuulekh(tolgoinObject3.temdeglel)];
//       object.tuluv = mur[usegTooruuKhurvuulekh(tolgoinObject3.tuluv)];
//       object.cameraIP = mur[usegTooruuKhurvuulekh(tolgoinObject3.cameraIP)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (!object.dugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[3] +
//           " sheet-ны " +
//           muriinDugaarSOKH +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//         if (!!object.gereeniiDugaar)
//           gereeniiDugaaruud.push(object.gereeniiDugaar);
//       }
//     });
//     //  Tureeslegch
//     dataTureeslegch.forEach((mur) => {
//       muriinDugaarTureeslegch++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar =
//         mur[
//           usegTooruuKhurvuulekh(tolgoinObject.dugaar.trim().replace(/\s/g, ""))
//         ];
//       object.ezemshigchiinNer = mur[usegTooruuKhurvuulekh(tolgoinObject4.ner)];
//       object.ezemshigchiinUtas =
//         mur[usegTooruuKhurvuulekh(tolgoinObject4.utas)];
//       object.turul = "Түрээслэгч";
//       object.temdeglel = mur[usegTooruuKhurvuulekh(tolgoinObject4.temdeglel)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (!object.dugaar || !object.turul || !object.ezemshigchiinUtas) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[4] +
//           " sheet-ны " +
//           muriinDugaarTureeslegch +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         if (!object.gereeniiDugaar)
//           aldaaniiMsg = aldaaniiMsg + "'Гэрээний дугаар', ";
//         if (!object.ezemshigchiinUtas) aldaaniiMsg = aldaaniiMsg + "'Утас', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else if (!/[0-9]{4}[А-Я|а-я|ө|Ө|ү|Ү]{3}/.test(object.dugaar)) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[4] +
//           " sheet-ны " +
//           muriinDugaarTureeslegch +
//           " дугаар мөрөнд ";
//         aldaaniiMsg =
//           aldaaniiMsg + "машины дугаар буруу бичигдсэн байна! <br/>";
//       } else if (!/[0-9]{8}/.test(object.ezemshigchiinUtas)) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[4] +
//           " sheet-ны " +
//           muriinDugaarTureeslegch +
//           " дугаар мөрөнд ";
//         aldaaniiMsg =
//           aldaaniiMsg + "Утасны дугаар буруу бичигдсэн байна! <br/>";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//         if (!!object.gereeniiDugaar)
//           gereeniiDugaaruud.push(object.gereeniiDugaar);
//       }
//     });
//     // baiguullaga

//     const groupMap = new Map();
//     function createGroupKey(khungulultTurul, khungulukhKhugatsaa, ner) {
//       return `${khungulultTurul || ""}_${khungulukhKhugatsaa || ""}_${
//         ner || ""
//       }`;
//     }
//     dataBaiguullaga.forEach((mur) => {
//       const khungulultTurul = mur[0];
//       const khungulukhKhugatsaa = mur[1];
//       const ner = mur[2];
//       const tailbar = mur[3];
//       const mashiniiDugaar = mur[4];
//       const groupKey = createGroupKey(
//         khungulultTurul,
//         khungulukhKhugatsaa,
//         ner
//       );

//       if (!groupMap.has(groupKey)) {
//         groupMap.set(groupKey, {
//           khungulultTurul: khungulultTurul,
//           khungulukhKhugatsaa: khungulukhKhugatsaa,
//           uldegdelKhungulukhKhugatsaa: khungulukhKhugatsaa,
//           ner: ner,
//           tailbar: tailbar,
//           mashinuud: [],
//         });
//       }

//       if (mashiniiDugaar) {
//         groupMap.get(groupKey).mashinuud.push(mashiniiDugaar);
//       }
//     });
//     groupMap.forEach((groupData, groupKey) => {
//       muriinDugaarBaiguullaga++;
//       let object = new Mashin(req.body.tukhainBaaziinKholbolt)();

//       object.turul = "Байгууллага";
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       object.khungulultTurul = groupData.khungulultTurul;
//       object.khungulukhKhugatsaa = groupData.khungulukhKhugatsaa;
//       object.uldegdelKhungulukhKhugatsaa =
//         groupData.uldegdelKhungulukhKhugatsaa;
//       object.ner = groupData.ner;
//       object.tailbar = groupData.tailbar;
//       object.mashinuud = groupData.mashinuud;
//       jagsaalt.push(object);
//     });
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     if (gereeniiDugaaruud?.length > 0) {
//       var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt).find({
//         gereeniiDugaaruud: { $in: gereeniiDugaaruud },
//       });
//       var oldooguiGeree = [];
//       jagsaalt.forEach((a) => {
//         if (!!a?.gereeniiDugaar) {
//           var oldsonGeree = gereenuud.find(
//             (b) => b.gereeniiDugaar === a.gereeniiDugaar
//           );
//           if (!!oldsonGeree) {
//             a.gereeniiId = oldsonGeree?._id;
//             a.khariltsagchiinNer = oldsonGeree?.ner;
//           } else oldooguiGeree.push(a.gereeniiDugaar);
//         }
//       });
//     }
//     // if (oldooguiGeree?.length > 0) {
//     //   throw new aldaa(
//     //     `${oldooguiGeree.map((a, i) => {
//     //       return `${a}${oldooguiGeree.length - 1 > i ? ", " : ""}`;
//     //     })} дугаартай ${
//     //       oldooguiGeree.length > 1 ? "гэрээнүүд" : "гэрээ"
//     //     } олдсонгүй`
//     //   );
//     // }

//     const allMachineNumbers = [];
//     jagsaalt.forEach((item) => {
//       if (item.mashinuud && Array.isArray(item.mashinuud)) {
//         allMachineNumbers.push(...item.mashinuud);
//       }
//     });
//     const uniqueMachineNumbers = [...new Set(allMachineNumbers)];

//     let query;
//     if (uniqueMachineNumbers.length > 0) {
//       query = { mashinuud: { $in: uniqueMachineNumbers } };
//     } else {
//       query = { dugaar: { $in: jagsaalt.map((a) => a.dugaar) } };
//     }

//     var oldsonMashin = await Mashin(req.body.tukhainBaaziinKholbolt).find(
//       query
//     );

//     if (!!oldsonMashin && oldsonMashin.length > 0) {
//       const matchingVehicles = [];

//       oldsonMashin.forEach((record) => {
//         if (record.dugaar && allMachineNumbers.includes(record.dugaar)) {
//           matchingVehicles.push(record.dugaar);
//         }

//         if (record.mashinuud && record.mashinuud.length > 0) {
//           const matchingFromArray = record.mashinuud.filter((vehicle) =>
//             allMachineNumbers.includes(vehicle)
//           );
//           matchingVehicles.push(...matchingFromArray);
//         }
//       });

//       throw new aldaa(
//         `${matchingVehicles.join(", ")} дугаартай машин бүртгэлтэй байна!`
//       );
//     }
//     if (jagsaalt)
//       jagsaalt = await gereeBaivalBugluy(
//         jagsaalt,
//         req.body.baiguullagiinId,
//         req.body.tukhainBaaziinKholbolt
//       );
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     await Mashin(req.body.tukhainBaaziinKholbolt).insertMany(
//       jagsaalt,
//       function (err) {
//         if (err) {
//           next(err);
//         }
//         res.status(200).send("Amjilttai");
//       }
//     );
//   } catch (error) {
//     next(error);
//   }
// });

// exports.khariltsagchTatya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     if (workbook.SheetNames[0] !== "Иргэн" || workbook.SheetNames[1] !== "ААН")
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     const irgenSheet = workbook.Sheets[workbook.SheetNames[0]];
//     const aanSheet = workbook.Sheets[workbook.SheetNames[1]];
//     const { db } = require("zevbackv2");
//     var segmentuud = await Segment(req.body.tukhainBaaziinKholbolt).find({
//       baiguullagiinId: req.body.baiguullagiinId,
//       turul: "khariltsagch",
//     });
//     const jagsaalt = [];
//     var tolgoinObject = {};
//     var muriinDugaar = 1;
//     if (
//       !irgenSheet["A1"].v.includes("Код") ||
//       !irgenSheet["C1"].v.includes("Нэр") ||
//       !irgenSheet["B1"].v.includes("Овог") ||
//       !irgenSheet["D1"].v.includes("Регистр") ||
//       !irgenSheet["E1"].v.includes("Бүртгэлийн дугаар") ||
//       !irgenSheet["F1"].v.includes("Утас") ||
//       !irgenSheet["G1"].v.includes("Мэйл") ||
//       !irgenSheet["H1"].v.includes("Хаяг")
//     ) {
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     }
//     if (
//       !aanSheet["A1"].v.includes("Код") ||
//       !aanSheet["C1"].v.includes("Улсын бүртгэлийн дугаар") ||
//       !aanSheet["B1"].v.includes("Нэр") ||
//       !aanSheet["D1"].v.includes("Захирлын овог") ||
//       !aanSheet["E1"].v.includes("Захирлын нэр") ||
//       !aanSheet["F1"].v.includes("Мэйл") ||
//       !aanSheet["G1"].v.includes("Утас") ||
//       !aanSheet["H1"].v.includes("Хаяг")
//     ) {
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     }
//     for (let cell in irgenSheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!irgenSheet[cellAsString].v
//       ) {
//         if (irgenSheet[cellAsString].v.includes("Код"))
//           tolgoinObject.id = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Нэр"))
//           tolgoinObject.ner = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Овог"))
//           tolgoinObject.ovog = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Регистр"))
//           tolgoinObject.register = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Бүртгэлийн дугаар"))
//           tolgoinObject.customerTin = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Утас"))
//           tolgoinObject.utas = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Мэйл"))
//           tolgoinObject.mail = cellAsString[0];
//         else if (irgenSheet[cellAsString].v.includes("Хаяг"))
//           tolgoinObject.khayag = cellAsString[0];
//         else if (segmentuud && segmentuud.length > 0) {
//           var segment = segmentuud.find(
//             (element) => element.ner === irgenSheet[cellAsString].v
//           );
//           if (segment) tolgoinObject[segment.ner] = cellAsString[0];
//         }
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(irgenSheet, {
//       header: 1,
//       range: 1,
//     });
//     var aldaaniiMsg = "";
//     data.forEach((mur) => {
//       muriinDugaar++;
//       let object = new Khariltsagch(db.erunkhiiKholbolt)();
//       object.id = mur[usegTooruuKhurvuulekh(tolgoinObject.id)];
//       object.ner = mur[usegTooruuKhurvuulekh(tolgoinObject.ner)];
//       object.ovog = mur[usegTooruuKhurvuulekh(tolgoinObject.ovog)];
//       object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
//       object.customerTin =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.customerTin)];
//       object.utas = [mur[usegTooruuKhurvuulekh(tolgoinObject.utas)]];
//       object.mail = mur[usegTooruuKhurvuulekh(tolgoinObject.mail)];
//       object.khayag = mur[usegTooruuKhurvuulekh(tolgoinObject.khayag)];
//       object.turul = "Иргэн";
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (segmentuud && segmentuud.length > 0) {
//         segmentuud.forEach((segment) => {
//           if (tolgoinObject.hasOwnProperty(segment.ner)) {
//             if (object.segmentuud && object.segmentuud.length > 0) {
//               object.segmentuud.push({
//                 ner: segment.ner,
//                 utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//               });
//             } else {
//               object.segmentuud = [
//                 {
//                   ner: segment.ner,
//                   utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//                 },
//               ];
//             }
//           }
//         });
//       }
//       if (
//         object.id ||
//         object.ner ||
//         (object.register && object.customerTin) ||
//         object.ovog ||
//         object.utas ||
//         object.mail ||
//         object.khayag ||
//         object.mail
//       ) {
//         if (
//           !object.id ||
//           !object.ner ||
//           (!object.register && !object.customerTin) ||
//           !object.utas
//         ) {
//           aldaaniiMsg =
//             aldaaniiMsg + "Иргэн sheet-ны " + muriinDugaar + " дугаар мөрөнд ";
//           if (!object.id) aldaaniiMsg = aldaaniiMsg + "'Код', ";
//           if (!object.ner) aldaaniiMsg = aldaaniiMsg + "'Нэр', ";
//           if (!object.register && !object.customerTin)
//             aldaaniiMsg = aldaaniiMsg + "'Регистр', 'Бүртгэлийн дугаар',";
//           if (!object.utas || !object.utas[0])
//             aldaaniiMsg = aldaaniiMsg + "'Утас', ";
//           aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//           aldaaniiMsg = aldaaniiMsg + " ";
//           aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//         } else jagsaalt.push(object);
//       }
//     });

//     muriinDugaar = 1;
//     tolgoinObject = {};
//     for (let cell in aanSheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!aanSheet[cellAsString].v
//       ) {
//         if (aanSheet[cellAsString].v.includes("Код"))
//           tolgoinObject.id = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Нэр"))
//           tolgoinObject.ner = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Улсын бүртгэлийн дугаар"))
//           tolgoinObject.register = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Захирлын овог"))
//           tolgoinObject.zakhirliinOvog = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Захирлын нэр"))
//           tolgoinObject.zakhirliinNer = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Утас"))
//           tolgoinObject.utas = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Мэйл"))
//           tolgoinObject.mail = cellAsString[0];
//         else if (aanSheet[cellAsString].v.includes("Хаяг"))
//           tolgoinObject.khayag = cellAsString[0];
//         else if (segmentuud && segmentuud.length > 0) {
//           var segment = segmentuud.find(
//             (element) => element.ner === aanSheet[cellAsString].v
//           );
//           if (segment) tolgoinObject[segment.ner] = cellAsString[0];
//         }
//       }
//     }
//     data = xlsx.utils.sheet_to_json(aanSheet, {
//       header: 1,
//       range: 1,
//     });
//     data.forEach((mur) => {
//       muriinDugaar++;
//       let object = new Khariltsagch(db.erunkhiiKholbolt)();
//       object.id = mur[usegTooruuKhurvuulekh(tolgoinObject.id)];
//       object.ner = mur[usegTooruuKhurvuulekh(tolgoinObject.ner)];
//       object.ovog = mur[usegTooruuKhurvuulekh(tolgoinObject.ovog)];
//       object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
//       object.zakhirliinOvog =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.zakhirliinOvog)];
//       object.zakhirliinNer =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.zakhirliinNer)];
//       object.utas = [mur[usegTooruuKhurvuulekh(tolgoinObject.utas)]];
//       object.mail = mur[usegTooruuKhurvuulekh(tolgoinObject.mail)];
//       object.khayag = mur[usegTooruuKhurvuulekh(tolgoinObject.khayag)];
//       object.turul = "ААН";
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       if (segmentuud && segmentuud.length > 0) {
//         segmentuud.forEach((segment) => {
//           if (tolgoinObject.hasOwnProperty(segment.ner)) {
//             if (object.segmentuud && object.segmentuud.length > 0) {
//               object.segmentuud.push({
//                 ner: segment.ner,
//                 utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//               });
//             } else {
//               object.segmentuud = [
//                 {
//                   ner: segment.ner,
//                   utga: mur[usegTooruuKhurvuulekh(tolgoinObject[segment.ner])],
//                 },
//               ];
//             }
//           }
//         });
//       }
//       if (
//         object.id ||
//         object.ner ||
//         object.register ||
//         object.zakhirliinOvog ||
//         object.utas ||
//         object.zakhirliinNer ||
//         object.khayag ||
//         object.mail
//       ) {
//         if (!object.id || !object.ner || !object.register || !object.utas) {
//           aldaaniiMsg =
//             aldaaniiMsg + "ААН sheet-ны " + muriinDugaar + " дугаар мөрөнд ";
//           if (!object.id) aldaaniiMsg = aldaaniiMsg + "'Код', ";
//           if (!object.ner) aldaaniiMsg = aldaaniiMsg + "'Нэр', ";
//           if (!object.register)
//             aldaaniiMsg = aldaaniiMsg + "'Улсын бүртгэлийн дугаар', ";
//           if (!object.utas || !object.utas[0])
//             aldaaniiMsg = aldaaniiMsg + "'Утас', ";
//           aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//           aldaaniiMsg = aldaaniiMsg + " ";
//           aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//         } else jagsaalt.push(object);
//       }
//     });
//     aldaaniiMsg = await khariltsagchBaikhguigShalgaya(
//       jagsaalt,
//       aldaaniiMsg,
//       req.body.baiguullagiinId,
//       req.body.barilgiinId,
//       db.erunkhiiKholbolt
//     );
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     Khariltsagch(db.erunkhiiKholbolt).insertMany(jagsaalt, function (err) {
//       if (err) {
//         next(err);
//       }
//       res.status(200).send("Amjilttai");
//     });
//   } catch (error) {
//     next(error);
//   }
// });

// exports.tooluurZaaltOruulya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     if (workbook.SheetNames[0] !== "Тоолуур")
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const { db } = require("zevbackv2");
//     var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
//       req.body.baiguullagiinId
//     );
//     var ashiglaltiinZardal = await AshiglaltiinZardluud(
//       req.body.tukhainBaaziinKholbolt
//     ).findById(req.body.ashiglaltiinId);
//     const jagsaalt = [];
//     var tolgoinObject = {};
//     var muriinDugaar = 1;
//     if (
//       !sheet["A1"].v.includes("Регистр") ||
//       !sheet["B1"].v.includes("Гэрээний дугаар") ||
//       !sheet["C1"].v.includes("Талбайн дугаар") ||
//       !sheet["D1"].v.includes("Өмнөх заалт") ||
//       !sheet["E1"].v.includes("Одоогийн заалт")
//     ) {
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     }
//     for (let cell in sheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!sheet[cellAsString].v
//       ) {
//         if (sheet[cellAsString].v.includes("Регистр"))
//           tolgoinObject.register = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Гэрээний дугаар"))
//           tolgoinObject.gereeniiDugaar = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Талбайн дугаар"))
//           tolgoinObject.talbainDugaar = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Өмнөх заалт"))
//           tolgoinObject.umnukhZaalt = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Одоогийн заалт"))
//           tolgoinObject.suuliinZaalt = cellAsString[0];

//         if (baiguullaga?.tokhirgoo?.guidelBuchiltKhonogEsekh) {
//           if (sheet[cellAsString].v.includes("Гүйдлийн коэффициент"))
//             tolgoinObject.guidliinKoep = cellAsString[0];
//         }
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(sheet, {
//       header: 1,
//       range: 1,
//     });
//     var aldaaniiMsg = "";
//     data.forEach((mur) => {
//       muriinDugaar++;
//       let object = new AshiglaltiinExcel(req.body.tukhainBaaziinKholbolt)();
//       object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
//       object.gereeniiDugaar =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.gereeniiDugaar)];
//       object.talbainDugaar =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainDugaar)];
//       object.umnukhZaalt =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.umnukhZaalt)];
//       object.suuliinZaalt =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.suuliinZaalt)];
//       if (baiguullaga?.tokhirgoo?.guidelBuchiltKhonogEsekh)
//         object.guidliinKoep =
//           mur[usegTooruuKhurvuulekh(tolgoinObject.guidliinKoep)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       object.ognoo = new Date(req.body.ognoo);
//       object.zardliinId = ashiglaltiinZardal._id;
//       object.zardliinNer = ashiglaltiinZardal.ner;
//       object.tariff = ashiglaltiinZardal.tariff;
//       if (!object.register && !object.gereeniiDugaar && !object.talbainDugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           muriinDugaar +
//           " дугаар мөрөнд регистр, гэрээний дугаар, талбайн дугаар талбарын аль нэгийг бөглөнө үү! ";
//       } else jagsaalt.push(object);
//     });
//     var registeruud = [];
//     var talbainDugaaruud = [];
//     var gereeniiDugaaruud = [];
//     for await (const mur of jagsaalt) {
//       if (!!mur.register) {
//         registeruud.push(mur.register);
//       } else if (!!mur.talbainDugaar) {
//         talbainDugaaruud.push(mur.talbainDugaar);
//       } else if (!!mur.gereeniiDugaar) {
//         gereeniiDugaaruud.push(mur.gereeniiDugaar);
//       }
//     }
//     var niitGereenuud = [];
//     var oldooguiGeree = [];
//     if (registeruud.length > 0) {
//       var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           register: { $in: registeruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         registeruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.register === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах регистрын дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     if (talbainDugaaruud.length > 0) {
//       gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           talbainDugaar: { $in: talbainDugaaruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         oldooguiGeree = [];
//         talbainDugaaruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.talbainDugaar === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах талбайн дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     if (gereeniiDugaaruud.length > 0) {
//       gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           gereeniiDugaar: { $in: gereeniiDugaaruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         oldooguiGeree = [];
//         gereeniiDugaaruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.gereeniiDugaar === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах гэрээний дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     var bulkOps = [];
//     var updateObject;
//     if (niitGereenuud.length > 0) {
//       for await (const geree of niitGereenuud) {
//         updateObject = {};
//         if (
//           ashiglaltiinZardal.turul == "кВт" ||
//           ashiglaltiinZardal.turul == "1м3" ||
//           ashiglaltiinZardal.turul === "кг"
//         ) {
//           var umnukhZaalt = 0;
//           var suuliinGuilgee = geree.avlaga.guilgeenuud.filter((x) => {
//             return (
//               x.khemjikhNegj == ashiglaltiinZardal.turul &&
//               x.tailbar == ashiglaltiinZardal.ner
//             );
//           });
//           if (!!suuliinGuilgee && suuliinGuilgee.length > 0) {
//             suuliinGuilgee = lodash.orderBy(suuliinGuilgee, ["ognoo"], ["asc"]);
//             suuliinGuilgee = suuliinGuilgee[suuliinGuilgee.length - 1];
//           }
//           if (!!suuliinGuilgee?.suuliinZaalt) {
//             umnukhZaalt = suuliinGuilgee.suuliinZaalt;
//           }
//         }
//         var tukhainZardal;
//         if (!!geree.register) {
//           tukhainZardal = jagsaalt.find((x) => {
//             return (
//               x.register === geree.register ||
//               x.talbainDugaar === geree.talbainDugaar ||
//               x.gereeniiDugaar === geree.gereeniiDugaar
//             );
//           });
//         } else if (!!geree.customerTin) {
//           tukhainZardal = jagsaalt.find((x) => {
//             return (
//               x.register === geree.customerTin ||
//               x.talbainDugaar === geree.talbainDugaar ||
//               x.gereeniiDugaar === geree.gereeniiDugaar
//             );
//           });
//         }
//         if (
//           umnukhZaalt > 0 &&
//           tukhainZardal.umnukhZaalt > 0 &&
//           parseFloat(formatNumber(umnukhZaalt, 4)) !==
//             parseFloat(formatNumber(tukhainZardal.umnukhZaalt, 4))
//         ) {
//           if (!!tukhainZardal.register) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.register +
//               " регистртэй гэрээний өмнөх заалт зөрүүтэй байна! ";
//           }
//           if (!!tukhainZardal.talbainDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.talbainDugaar +
//               " талбайн дугаартай гэрээний өмнөх заалт зөрүүтэй байна! ";
//           }
//           if (!!tukhainZardal.gereeniiDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.gereeniiDugaar +
//               " дугаартай гэрээний өмнөх заалт зөрүүтэй байна! ";
//           }
//         }
//         if (
//           umnukhZaalt > 0 &&
//           (umnukhZaalt - tukhainZardal.umnukhZaalt > 0.1 ||
//             umnukhZaalt - tukhainZardal.umnukhZaalt > 0.1)
//         ) {
//           if (!!tukhainZardal.register) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.register +
//               " регистртэй гэрээний өмнөх заалт буруу байна! ";
//           }
//           if (!!tukhainZardal.talbainDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.talbainDugaar +
//               " талбайн дугаартай гэрээний өмнөх заалт буруу байна! ";
//           }
//           if (!!tukhainZardal.gereeniiDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.gereeniiDugaar +
//               " дугаартай гэрээний өмнөх заалт буруу байна! ";
//           }
//         } else if (umnukhZaalt == 0 && tukhainZardal.umnukhZaalt > 0) {
//           umnukhZaalt = tukhainZardal.umnukhZaalt;
//         }
//         if (
//           tukhainZardal.suuliinZaalt < umnukhZaalt ||
//           tukhainZardal.suuliinZaalt < tukhainZardal.umnukhZaalt
//         ) {
//           if (!!tukhainZardal.register) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.register +
//               " регистртэй гэрээний сүүлийн заалт өмнөх заалтаас бага байж болохгүй! ";
//           }
//           if (!!tukhainZardal.talbainDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.talbainDugaar +
//               " талбайн дугаартай гэрээний сүүлийн заалт өмнөх заалтаас бага байж болохгүй! ";
//           }
//           if (!!tukhainZardal.gereeniiDugaar) {
//             aldaaniiMsg =
//               aldaaniiMsg +
//               tukhainZardal.gereeniiDugaar +
//               " дугаартай гэрээний сүүлийн заалт өмнөх заалтаас бага байж болохгүй! ";
//           }
//         }
//         var zoruuDun = (tukhainZardal.suuliinZaalt || 0) - (umnukhZaalt || 0);
//         var tsakhilgaanDun = 0;
//         var tsakhilgaanKBTST = 0;
//         var chadalDun = 0;
//         var tsekhDun = 0;
//         var sekhDemjikhTulburDun = 0;
//         if (
//           ashiglaltiinZardal.ner?.includes("Цахилгаан") &&
//           baiguullaga?.tokhirgoo?.guidelBuchiltKhonogEsekh
//         ) {
//           tsakhilgaanKBTST =
//             zoruuDun *
//             (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
//             (tukhainZardal.guidliinKoep || 1);
//           chadalDun =
//             baiguullaga?.tokhirgoo?.bichiltKhonog > 0 && tsakhilgaanKBTST > 0
//               ? (tsakhilgaanKBTST /
//                   baiguullaga?.tokhirgoo?.bichiltKhonog /
//                   12) *
//                 (req.body.baiguullagiinId === "679aea9032299b7ba8462a77"
//                   ? 11520
//                   : 15500)
//               : 0;
//           tsekhDun = ashiglaltiinZardal.tariff * tsakhilgaanKBTST;
//           if (baiguullaga?.tokhirgoo?.sekhDemjikhTulburAvakhEsekh) {
//             // URANGAN Ikhnayd
//             if (baiguullaga?.tokhirgoo?.guidliinKoepEsekh)
//               // kaidu
//               sekhDemjikhTulburDun =
//                 zoruuDun *
//                 (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
//                 (tukhainZardal.guidliinKoep || 1) *
//                 23.79;
//             else
//               sekhDemjikhTulburDun =
//                 zoruuDun * (ashiglaltiinZardal.tsakhilgaanUrjver || 1) * 23.79;
//             tsakhilgaanDun = chadalDun + tsekhDun + sekhDemjikhTulburDun;
//           } else tsakhilgaanDun = chadalDun + tsekhDun;
//         } else
//           tsakhilgaanDun =
//             ashiglaltiinZardal.tariff *
//             (ashiglaltiinZardal.tsakhilgaanUrjver || 1) *
//             (zoruuDun || 0);
//         var tempDun =
//           (ashiglaltiinZardal.ner?.includes("Хүйтэн ус") ||
//             ashiglaltiinZardal.ner?.includes("Халуун ус")) &&
//           ashiglaltiinZardal.bodokhArga === "Khatuu"
//             ? ashiglaltiinZardal.tseverUsDun * zoruuDun +
//               ashiglaltiinZardal.bokhirUsDun * zoruuDun +
//               (ashiglaltiinZardal.ner?.includes("Халуун ус")
//                 ? (ashiglaltiinZardal.usKhalaasniiDun || 0) * zoruuDun
//                 : 0)
//             : ashiglaltiinZardal.turul === "кг"
//             ? (zoruuDun || 0) *
//               ashiglaltiinZardal.togtmolUtga *
//               ashiglaltiinZardal.tariff
//             : tsakhilgaanDun;
//         if (tempDun === 0)
//           aldaaniiMsg =
//             aldaaniiMsg +
//             (tukhainZardal.register || "") +
//             " " +
//             (tukhainZardal.talbainDugaar || "") +
//             " " +
//             (tukhainZardal.gereeniiDugaar || "") +
//             " " +
//             " гэрээний төлөх дүн тэг байна! ";
//         updateObject = {
//           turul: "avlaga",
//           tulsunDun: 0,
//           tulukhDun: !!req.body.nuatBodokhEsekh
//             ? ((ashiglaltiinZardal.suuriKhuraamj || 0) + (tempDun || 0)) * 1.1
//             : (ashiglaltiinZardal.suuriKhuraamj || 0) + (tempDun || 0),
//           negj: zoruuDun || 0,
//           khemjikhNegj: ashiglaltiinZardal.turul,
//           tariff: ashiglaltiinZardal.tariff,
//           tseverUsDun: ashiglaltiinZardal.tseverUsDun * zoruuDun || 0,
//           bokhirUsDun: ashiglaltiinZardal.bokhirUsDun * zoruuDun || 0,
//           usKhalaasanDun: ashiglaltiinZardal.ner?.includes("Халуун ус")
//             ? (ashiglaltiinZardal.usKhalaasniiDun || 0) * (zoruuDun || 0)
//             : 0,
//           suuriKhuraamj: ashiglaltiinZardal.suuriKhuraamj || 0,
//           tsakhilgaanUrjver: ashiglaltiinZardal.tsakhilgaanUrjver || 1,
//           tsakhilgaanKBTST: tsakhilgaanKBTST || 0,
//           guidliinKoep: ashiglaltiinZardal.ner?.includes("Цахилгаан")
//             ? tukhainZardal.guidliinKoep || 0
//             : 0,
//           bichiltKhonog: ashiglaltiinZardal.ner?.includes("Цахилгаан")
//             ? baiguullaga?.tokhirgoo?.bichiltKhonog || 0
//             : 0,
//           chadalDun: ashiglaltiinZardal.ner?.includes("Цахилгаан")
//             ? chadalDun || 0
//             : 0,
//           tsekhDun: ashiglaltiinZardal.ner?.includes("Цахилгаан")
//             ? tsekhDun || 0
//             : 0,
//           sekhDemjikhTulburDun: ashiglaltiinZardal.ner?.includes("Цахилгаан")
//             ? sekhDemjikhTulburDun || 0
//             : 0,
//           ognoo: tukhainZardal.ognoo,
//           gereeniiId: geree._id,
//           tailbar: ashiglaltiinZardal.ner,
//           nuatBodokhEsekh: req.body.nuatBodokhEsekh,
//           togtmolUtga:
//             ashiglaltiinZardal.turul === "кг"
//               ? ashiglaltiinZardal.togtmolUtga || 0
//               : 0,
//         };
//         if (
//           ashiglaltiinZardal.turul === "кВт" ||
//           ashiglaltiinZardal.turul === "1м3" ||
//           ashiglaltiinZardal.turul === "кг"
//         ) {
//           updateObject["suuliinZaalt"] = tukhainZardal.suuliinZaalt;
//           updateObject["umnukhZaalt"] = umnukhZaalt;
//         }
//         updateObject["guilgeeKhiisenOgnoo"] = new Date();
//         if (req.body.nevtersenAjiltniiToken) {
//           updateObject["guilgeeKhiisenAjiltniiNer"] =
//             req.body.nevtersenAjiltniiToken.ner;
//           updateObject["guilgeeKhiisenAjiltniiId"] =
//             req.body.nevtersenAjiltniiToken.id;
//         }
//         tukhainZardal.gereeniiId = geree._id;
//         tukhainZardal.zoruu = ashiglaltiinZardal.zoruuDun;
//         tukhainZardal.niitDun = tempDun;
//         let upsertDoc = {
//           updateOne: {
//             filter: { _id: geree._id },
//             update: {
//               $push: {
//                 "avlaga.guilgeenuud": updateObject,
//               },
//             },
//           },
//         };
//         bulkOps.push(upsertDoc);
//       }
//     }
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     if (bulkOps && bulkOps.length > 0)
//       await Geree(req.body.tukhainBaaziinKholbolt)
//         .bulkWrite(bulkOps)
//         .then((bulkWriteOpResult) => {
//           AshiglaltiinExcel(req.body.tukhainBaaziinKholbolt).insertMany(
//             jagsaalt
//           );
//           res.status(200).send("Amjilttai");
//         })
//         .catch((err) => {
//           next(err);
//         });
//   } catch (error) {
//     next(error);
//   }
// });

// exports.tooluurZaaltZagvarAvya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheet = workbook.addWorksheet("Тоолуур");
//   var addCol = [
//     {
//       header: "Регистр",
//       key: "Регистр",
//       width: 20,
//     },
//     {
//       header: "Гэрээний дугаар",
//       key: "Гэрээний дугаар",
//       width: 20,
//     },
//     {
//       header: "Талбайн дугаар",
//       key: "Талбайн дугаар",
//       width: 30,
//     },
//     {
//       header: "Өмнөх заалт",
//       key: "Өмнөх заалт",
//       width: 30,
//     },
//     {
//       header: "Одоогийн заалт",
//       key: "Одоогийн заалт",
//       width: 30,
//     },
//   ];

//   const { db } = require("zevbackv2");
//   var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
//     req.body.baiguullagiinId
//   );
//   if (baiguullaga?.tokhirgoo?.guidelBuchiltKhonogEsekh) {
//     var temp = [
//       {
//         header: "Гүйдлийн коэффициент",
//         key: "Гүйдлийн коэффициент",
//         width: 30,
//       },
//     ];
//     addCol.push(...temp);
//   }
//   worksheet.columns = addCol;

//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     "attachment; filename=" + "Тоолуурын заалт"
//   );

//   return workbook.xlsx.write(res).then(function () {
//     res.status(200).end();
//   });
// });

// exports.ekhniiUldegdelZagvarOruulya = asyncHandler(async (req, res, next) => {
//   let workbook = new excel.Workbook();
//   let worksheet = workbook.addWorksheet("Эхний үлдэгдэл");
//   var addCol = [
//     {
//       header: "Регистр",
//       key: "Регистр",
//       width: 20,
//     },
//     {
//       header: "Гэрээний дугаар",
//       key: "Гэрээний дугаар",
//       width: 20,
//     },
//     {
//       header: "Талбайн дугаар",
//       key: "Талбайн дугаар",
//       width: 30,
//     },
//     {
//       header: "Үлдэгдэл",
//       key: "Үлдэгдэл",
//       width: 30,
//     },
//   ];
//   worksheet.columns = addCol;

//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     "attachment; filename=" + "Эхний үлдэгдэл"
//   );

//   return workbook.xlsx.write(res).then(function () {
//     res.status(200).end();
//   });
// });

// exports.ekhniiUldegdelOruulya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     if (workbook.SheetNames[0] !== "Эхний үлдэгдэл")
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     var ashiglaltiinZardal = {};
//     if (
//       req.body.tureesEkhniiUldegdelEsekh === "false" &&
//       req.body.ashiglaltiinId
//     ) {
//       ashiglaltiinZardal = await AshiglaltiinZardluud(
//         req.body.tukhainBaaziinKholbolt
//       ).findById(req.body.ashiglaltiinId);
//     }

//     const jagsaalt = [];
//     var tolgoinObject = {};
//     var muriinDugaar = 1;
//     if (
//       !sheet["A1"].v.includes("Регистр") ||
//       !sheet["B1"].v.includes("Гэрээний дугаар") ||
//       !sheet["C1"].v.includes("Талбайн дугаар") ||
//       !sheet["D1"].v.includes("Үлдэгдэл")
//     ) {
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     }
//     for (let cell in sheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!sheet[cellAsString].v
//       ) {
//         if (sheet[cellAsString].v.includes("Регистр"))
//           tolgoinObject.register = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Гэрээний дугаар"))
//           tolgoinObject.gereeniiDugaar = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Талбайн дугаар"))
//           tolgoinObject.talbainDugaar = cellAsString[0];
//         else if (sheet[cellAsString].v.includes("Үлдэгдэл"))
//           tolgoinObject.ekhniiUldegdel = cellAsString[0];
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(sheet, {
//       header: 1,
//       range: 1,
//     });
//     var aldaaniiMsg = "";
//     data.forEach((mur) => {
//       muriinDugaar++;
//       let object = new EkhniiUldegdelExcel(req.body.tukhainBaaziinKholbolt)();
//       object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
//       object.gereeniiDugaar =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.gereeniiDugaar)];
//       object.talbainDugaar =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.talbainDugaar)];
//       object.ekhniiUldegdel =
//         mur[usegTooruuKhurvuulekh(tolgoinObject.ekhniiUldegdel)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       object.ognoo = new Date(req.body.ognoo);
//       object.tureesEkhniiUldegdelEsekh = req.body.tureesEkhniiUldegdelEsekh;
//       if (
//         req.body.tureesEkhniiUldegdelEsekh === "false" &&
//         !!ashiglaltiinZardal?._id
//       ) {
//         object.zardliinId = ashiglaltiinZardal?._id;
//         object.zardliinNer = ashiglaltiinZardal?.ner;
//         object.tariff = ashiglaltiinZardal?.tariff;
//       }
//       if (!object.register && !object.gereeniiDugaar && !object.talbainDugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           muriinDugaar +
//           " дугаар мөрөнд регистр, гэрээний дугаар, талбайн дугаар талбарын аль нэгийг бөглөнө үү! ";
//       } else jagsaalt.push(object);
//     });
//     var registeruud = [];
//     var talbainDugaaruud = [];
//     var gereeniiDugaaruud = [];
//     for await (const mur of jagsaalt) {
//       if (!!mur.register) {
//         registeruud.push(mur.register);
//       } else if (!!mur.talbainDugaar) {
//         talbainDugaaruud.push(mur.talbainDugaar);
//       } else if (!!mur.gereeniiDugaar) {
//         gereeniiDugaaruud.push(mur.gereeniiDugaar);
//       }
//     }
//     var niitGereenuud = [];
//     var oldooguiGeree = [];
//     if (registeruud.length > 0) {
//       var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           register: { $in: registeruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         registeruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.register === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах регистрын дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     if (talbainDugaaruud.length > 0) {
//       gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           talbainDugaar: { $in: talbainDugaaruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         oldooguiGeree = [];
//         talbainDugaaruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.talbainDugaar === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах талбайн дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     if (gereeniiDugaaruud.length > 0) {
//       gereenuud = await Geree(req.body.tukhainBaaziinKholbolt)
//         .find({
//           gereeniiDugaar: { $in: gereeniiDugaaruud },
//           barilgiinId: req.body.barilgiinId,
//           tuluv: 1,
//         })
//         .select("+avlaga");
//       if (!!gereenuud) {
//         oldooguiGeree = [];
//         gereeniiDugaaruud.forEach((a) => {
//           var oldsonGeree = gereenuud.find((b) => b.gereeniiDugaar === a);
//           if (!oldsonGeree) oldooguiGeree.push(a);
//         });
//         if (oldooguiGeree.length > 0) {
//           aldaaniiMsg =
//             aldaaniiMsg +
//             " Дараах гэрээний дугаартай гэрээнүүд олдсонгүй! " +
//             oldooguiGeree.toString();
//         } else niitGereenuud.push(...gereenuud);
//       }
//     }
//     var bulkOps = [];
//     var updateObject;
//     if (niitGereenuud.length > 0) {
//       for await (const geree of niitGereenuud) {
//         updateObject = {};
//         var tukhainZardal;
//         if (!!geree.register) {
//           tukhainZardal = jagsaalt.find((x) => {
//             return (
//               x.register === geree.register ||
//               x.talbainDugaar === geree.talbainDugaar ||
//               x.gereeniiDugaar === geree.gereeniiDugaar
//             );
//           });
//         } else if (!!geree.customerTin) {
//           tukhainZardal = jagsaalt.find((x) => {
//             return (
//               x.register === geree.customerTin ||
//               x.talbainDugaar === geree.talbainDugaar ||
//               x.gereeniiDugaar === geree.gereeniiDugaar
//             );
//           });
//         }
//         if (tukhainZardal?.ekhniiUldegdel != 0) {
//           var tempTurul =
//             tukhainZardal?.zardliinNer?.includes("Менежментийн төлбөр") ||
//             tukhainZardal?.zardliinNer === "Хөрөнгийн менежмент" ||
//             tukhainZardal?.zardliinNer === "Худалдааны менежмент"
//               ? "management"
//               : tukhainZardal?.zardliinNer === "Дулаан"
//               ? "dulaan"
//               : tukhainZardal?.zardliinNer?.includes("Цахилгаан")
//               ? "tsakhilgaan"
//               : tukhainZardal?.zardliinNer?.includes("Халуун ус")
//               ? "khulaanUs"
//               : tukhainZardal?.zardliinNer === "Ус"
//               ? "us"
//               : tukhainZardal?.zardliinNer?.includes("Хүйтэн ус")
//               ? "khuitenUs"
//               : "busad";
//           updateObject = {
//             turul: tukhainZardal?.tureesEkhniiUldegdelEsekh
//               ? "khuvaari"
//               : "avlaga",
//             tulukhDun: tukhainZardal?.ekhniiUldegdel,
//             ognoo: tukhainZardal.ognoo,
//             gereeniiId: geree._id,
//             tailbar: tukhainZardal?.tureesEkhniiUldegdelEsekh
//               ? "Түрээс"
//               : tukhainZardal?.zardliinNer,
//             nekhemjlekhDeerKharagdakh: false,
//             ekhniiUldegdelEsekh: true,
//             zardliinTurul: tukhainZardal?.tureesEkhniiUldegdelEsekh
//               ? "turees"
//               : tempTurul,
//           };
//           if (tukhainZardal?.tureesEkhniiUldegdelEsekh) {
//             updateObject["undsenDun"] = tukhainZardal?.ekhniiUldegdel;
//             updateObject["khyamdral"] = 0;
//           } else updateObject["tulsunDun"] = 0;
//           tukhainZardal.gereeniiId = geree._id;
//           let upsertDoc = {
//             updateOne: {
//               filter: { _id: geree._id },
//               update: {
//                 $push: {
//                   "avlaga.guilgeenuud": updateObject,
//                 },
//               },
//             },
//           };
//           bulkOps.push(upsertDoc);
//         }
//       }
//     }
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     if (bulkOps && bulkOps.length > 0)
//       await Geree(req.body.tukhainBaaziinKholbolt)
//         .bulkWrite(bulkOps)
//         .then((bulkWriteOpResult) => {
//           EkhniiUldegdelExcel(req.body.tukhainBaaziinKholbolt).insertMany(
//             jagsaalt
//           );
//           res.status(200).send("Amjilttai");
//         })
//         .catch((err) => {
//           next(err);
//         });
//     else res.status(200).send("Amjilttai");
//   } catch (error) {
//     next(error);
//   }
// });

// exports.blockMashiniiExcelAvya = asyncHandler(async (req, res, next) => {
//   try {
//     let workbook = new excel.Workbook();
//     let worksheet = workbook.addWorksheet("Блок машин");
//     worksheet.columns = [
//       {
//         header: "Машины дугаар",
//         key: "Машины дугаар",
//         headerRow: true,
//         width: 30,
//       },
//       {
//         header: "Тайлбар",
//         key: "Тайлбар",
//         headerRow: true,
//         width: 30,
//       },
//     ];
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       "attachment; filename=" + encodeURI("Машины мэдээлэл.xlsx")
//     );
//     workbook.xlsx.write(res).then(function () {
//       res.end();
//     });
//   } catch (error) {
//     next(error);
//   }
// });

// exports.blockMashiniiExcelTatya = asyncHandler(async (req, res, next) => {
//   try {
//     const workbook = xlsx.read(req.file.buffer);
//     if (workbook.SheetNames[0] !== "Блок машин")
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     const mashinSheet = workbook.Sheets[workbook.SheetNames[0]];
//     if (
//       !mashinSheet["A1"].v.includes("Машины дугаар") ||
//       !mashinSheet["B1"].v.includes("Тайлбар")
//     )
//       throw new aldaa("Та загварын дагуу бөглөөгүй байна!");
//     var jagsaalt = [];
//     var tolgoinObject = {};
//     for (let cell in mashinSheet) {
//       var cellAsString = cell.toString();
//       if (
//         cellAsString[1] === "1" &&
//         cellAsString.length == 2 &&
//         !!mashinSheet[cellAsString].v
//       ) {
//         if (mashinSheet[cellAsString].v.includes("Машины дугаар"))
//           tolgoinObject.dugaar = cellAsString[0];
//         else if (mashinSheet[cellAsString].v.includes("Тайлбар"))
//           tolgoinObject.tailbar = cellAsString[0];
//       }
//     }
//     var data = xlsx.utils.sheet_to_json(mashinSheet, {
//       header: 1,
//       range: 1,
//     });
//     var aldaaniiMsg = "";
//     var muriinDugaar = 1;
//     data.forEach((mur) => {
//       muriinDugaar++;
//       let object = new BlockMashin(req.body.tukhainBaaziinKholbolt)();
//       object.dugaar = mur[usegTooruuKhurvuulekh(tolgoinObject.dugaar)];
//       object.tailbar = mur[usegTooruuKhurvuulekh(tolgoinObject.tailbar)];
//       object.baiguullagiinId = req.body.baiguullagiinId;
//       object.barilgiinId = req.body.barilgiinId;
//       object.burtgesenAjiltaniiId = req.body.nevtersenAjiltniiToken.id;
//       object.burtgesenAjiltaniiNer = req.body.nevtersenAjiltniiToken.ner;
//       if (!object.dugaar) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           `(${workbook.SheetNames[0]})` +
//           " sheet-ны " +
//           muriinDugaar +
//           " дугаар мөрөнд ";
//         if (!object.dugaar) aldaaniiMsg = aldaaniiMsg + "'Машины дугаар', ";
//         aldaaniiMsg = aldaaniiMsg.slice(0, -2);
//         aldaaniiMsg = aldaaniiMsg + " ";
//         aldaaniiMsg = aldaaniiMsg + "талбар хоосон байна! <br/>";
//       } else if (!/[0-9]{4}[А-Я|а-я|ө|Ө|ү|Ү]{3}/.test(object.dugaar)) {
//         aldaaniiMsg =
//           aldaaniiMsg +
//           "Алдаа! " +
//           workbook.SheetNames[0] +
//           " sheet-ны " +
//           muriinDugaar +
//           " дугаар мөрөнд ";
//         aldaaniiMsg =
//           aldaaniiMsg + "машины дугаар буруу бичигдсэн байна! <br/>";
//       } else {
//         object.dugaar = String(object.dugaar).toUpperCase();
//         jagsaalt.push(object);
//       }
//     });
//     if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
//     await BlockMashin(req.body.tukhainBaaziinKholbolt).insertMany(
//       jagsaalt,
//       function (err) {
//         if (err) {
//           next(err);
//         }
//         res.status(200).send("Amjilttai");
//       }
//     );
//   } catch (error) {
//     next(error);
//   }
// });
