const asyncHandler = require("express-async-handler");
const Geree = require("../models/geree");
const BankniiGuilgee = require("../models/bankniiGuilgee");
const QpayObject = require("../models/qpayObject");
const { QuickQpayObject } = require("quickqpaypackv2");
const Baiguullaga = require("../models/baiguullaga");
const Talbai = require("../models/talbai");
const AshiglaltiinZardluud = require("../models/ashiglaltiinZardluud");
const { UstsanBarimt, Dans } = require("zevbackv2");
const lodash = require("lodash");
const moment = require("moment");
const mongoose = require("mongoose");
const KhungulultiinTuukh = require("../models/khungulultiinTuukh");
const TogloomiinTuv = require("../models/togloomiinTuv");
const AldangiinTuukh = require("../models/aldangiinTuukh");

exports.tulultOlnoorKhadgalya = asyncHandler(async (req, res, next) => {
  var guilgeenuud = req.body.guilgeenuud;
  const session = await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
  session.startTransaction();
  try {
    var aldaaniiMsg;
    for await (const tulbur of guilgeenuud) {
      tulbur.guilgeeKhiisenOgnoo = new Date();
      var dun = await tooZasya(
        (tulbur.tulsunDun ? tulbur.tulsunDun : 0) +
          (tulbur.tulsunAldangi ? tulbur.tulsunAldangi : 0)
      );
      if (req.body.nevtersenAjiltniiToken) {
        tulbur.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
        tulbur.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
      }
      var inc = {
        uldegdel: -(tulbur?.tulsunDun || 0),
      };
      if (tulbur.tulsunAldangi && tulbur.tulsunAldangi > 0) {
        inc["aldangiinUldegdel"] = -tulbur.tulsunAldangi;
        inc["niitTulsunAldangi"] = +tulbur.tulsunAldangi;
      }
      var tempGeree = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .findById(tulbur.gereeniiId)
        .select("avlaga");
      var updatedGeree = await Geree(req.body.tukhainBaaziinKholbolt)
        .findByIdAndUpdate(
          { _id: tulbur.gereeniiId },
          {
            $push: {
              [`avlaga.guilgeenuud`]: tulbur,
            },
            $inc: inc,
          }
        )
        .catch((err) => {
          next(err);
        });
      await daraagiinTulukhOgnooZasya(
        tulbur.gereeniiId,
        req.body.tukhainBaaziinKholbolt
      );
      if (tulbur.guilgeeniiId) {
        var filteredBaritsaa = tempGeree?.avlaga?.baritsaa?.filter(
          (a) => a.guilgeeniiId === tulbur.guilgeeniiId
        );
        var filteredGuilgee = tempGeree?.avlaga?.guilgeenuud?.filter(
          (a) => a.guilgeeniiId === tulbur.guilgeeniiId
        );
        if (filteredBaritsaa?.length === 0 && filteredGuilgee?.length === 0)
          await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
            .updateOne(
              { _id: tulbur.guilgeeniiId },
              {
                $push: {
                  kholbosonGereeniiId: tulbur.gereeniiId,
                  kholbosonTalbainId: updatedGeree.talbainDugaar,
                },
              }
            )
            .catch((err) => {
              next(err);
            });
        await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
          .updateOne({ _id: tulbur.guilgeeniiId }, [
            {
              $set: {
                kholbosonDun: {
                  $add: [{ $ifNull: ["$kholbosonDun", 0] }, dun],
                },
              },
            },
          ])
          .catch((err) => {
            next(err);
          });
      }
    }
    if (!aldaaniiMsg) {
      await session.commitTransaction();
    } else {
      await session.abortTransaction();
    }
    session.endSession();
    res.send("Amjilttai");
  } catch (err1) {
    await session.abortTransaction();
    next(err1);
  }
});

exports.baritsaaniiGuilgeeKhiie = asyncHandler(async (req, res, next) => {
  var guilgee = req.body;
  const session = await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
  session.startTransaction();
  try {
    var aldaaniiMsg;
    var id = new mongoose.Types.ObjectId();
    guilgee._id = id;
    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }
    var updatequery = {
      $push: {
        [`avlaga.baritsaa`]: guilgee,
      },
    };
    if (guilgee.zarlaga > 0) {
      var tulbur = guilgee;
      tulbur.tulsunDun = guilgee.zarlaga;
      tulbur.turul = "baritsaa";
      updatequery["$push"]["avlaga.guilgeenuud"] = tulbur;
    }
    await Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate({ _id: guilgee.gereeniiId }, updatequery)
      .then((result) => {})
      .catch((err) => {
        aldaaniiMsg = aldaaniiMsg + err.message;
        next(err);
      });
    var updatedGeree = await Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate({ _id: guilgee.gereeniiId }, [
        {
          $set: {
            baritsaaniiUldegdel: {
              $add: [
                { $ifNull: ["$baritsaaniiUldegdel", 0] },
                guilgee.orlogo - guilgee.zarlaga,
              ],
            },
          },
        },
      ])
      .catch((err) => {
        aldaaniiMsg = aldaaniiMsg + err.message;
        next(err);
      });
    if (guilgee.guilgeeniiId) {
      var tempGeree = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .findById(guilgee.gereeniiId)
        .select("avlaga");
      var filteredGuilgee = tempGeree?.avlaga?.guilgeenuud?.filter(
        (a) => a.guilgeeniiId === guilgee.guilgeeniiId
      );
      if (filteredGuilgee?.length === 0)
        await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
          .updateOne(
            { _id: guilgee.guilgeeniiId },
            {
              $push: {
                kholbosonGereeniiId: guilgee.gereeniiId,
                kholbosonTalbainId: updatedGeree.talbainDugaar,
              },
            }
          )
          .catch((err) => {
            aldaaniiMsg = aldaaniiMsg + err.message;
            next(err);
          });
      await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
        .updateOne({ _id: guilgee.guilgeeniiId }, [
          {
            $set: {
              kholbosonDun: {
                $add: [
                  { $ifNull: ["$kholbosonDun", 0] },
                  guilgee.orlogo - guilgee.zarlaga,
                ],
              },
            },
          },
        ])
        .catch((err) => {
          aldaaniiMsg = aldaaniiMsg + err.message;
          next(err);
        });
    }
    daraagiinTulukhOgnooZasya(
      guilgee.gereeniiId,
      req.body.tukhainBaaziinKholbolt
    );
    if (!aldaaniiMsg) {
      await session.commitTransaction();
    } else {
      await session.abortTransaction();
    }
    session.endSession();
    res.send("Amjilttai");
  } catch (err1) {
    await session.abortTransaction();
    next(err1);
  }
});

exports.gereeniiGuilgeeKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    var guilgee = req.body.guilgee;
    if (guilgee.guilgeeniiId) {
      var shalguur = await BankniiGuilgee(
        req.body.tukhainBaaziinKholbolt, true
      ).findOne({
        "guilgee.guilgeeniiId": guilgee.guilgeeniiId,
        kholbosonGereeniiId: guilgee.gereeniiId,
      });
      if (shalguur)
        throw new Error("Тухайн гүйлгээ тухайн гэрээнд холбогдсон байна!");
    }
    if (
      (guilgee.turul == "barter" ||
        guilgee.turul == "avlaga" ||
        guilgee.turul == "aldangi") &&
      !guilgee.tailbar
    ) {
      throw new Error("Тайлбар заавал оруулна уу?");
    }
    guilgee.guilgeeKhiisenOgnoo = new Date();
    if (req.body.nevtersenAjiltniiToken) {
      guilgee.guilgeeKhiisenAjiltniiNer = req.body.nevtersenAjiltniiToken.ner;
      guilgee.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken.id;
    }
    var inc = {
      uldegdel: -(guilgee?.tulsunDun || 0),
    };
    if (guilgee.turul == "aldangi") {
      inc["aldangiinUldegdel"] = -guilgee.tulsunAldangi;
      inc["niitTulsunAldangi"] = +guilgee.tulsunAldangi;
    }
    Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: guilgee.gereeniiId },
        {
          $push: {
            [`avlaga.guilgeenuud`]: guilgee,
          },
          $inc: inc,
        }
      )
      .then((result) => {
        daraagiinTulukhOgnooZasya(
          guilgee.gereeniiId,
          req.body.tukhainBaaziinKholbolt
        );
        if (guilgee.guilgeeniiId) {
          BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
            .updateOne(
              { _id: guilgee.guilgeeniiId },
              {
                $set: {
                  kholbosonGereeniiId: guilgee.gereeniiId,
                  kholbosonTalbainId: result.talbainDugaar,
                },
              }
            )
            .then((result1) => {
              res.send(result1);
            })
            .catch((err) => {
              next(err);
            });
        } else res.send(result);
      });
  } catch (aldaa) {
    next(aldaa);
  }
});

exports.khuvaariUusgey = asyncHandler(async (req, res, next) => {
  try {
    var body = req.body;
    var dun = body.dun;
    var zardluud = body.zardluud;
    var khungulultuud = body.khungulultuud;
    var khugatsaa = Number(body.khugatsaa) + 1;
    if (body.turGereeEsekh) khugatsaa = 1;
    var tulukhUdruud = body.tulukhUdruud;
    var ekhlekhOgnoo;
    if (body.baiguullagiinId === "63c0f31efe522048bf02086d") {
      var foodcityEkhlekhOgnoo = new Date(
        moment("2024-09-30").format("YYYY-MM-DD 00:00:00")
      );
      var tempEkhlekhOgnoo = new Date(
        moment(
          body.shineGereeEsekh ||
            moment(body.ekhlekhOgnoo) > moment().startOf("month")
            ? body.ekhlekhOgnoo
            : moment().startOf("month")
        ).format("YYYY-MM-DD 00:00:00")
      );
      ekhlekhOgnoo = new Date(
        foodcityEkhlekhOgnoo > tempEkhlekhOgnoo
          ? foodcityEkhlekhOgnoo
          : tempEkhlekhOgnoo
      ); // body.ekhlekhOgnoo
    } else
      ekhlekhOgnoo = new Date(
        body.shineGereeEsekh ||
        moment(body.ekhlekhOgnoo) > moment().startOf("month")
          ? body.ekhlekhOgnoo
          : moment().startOf("month")
      );
    var duusakhOgnoo = new Date(body.duusakhOgnoo);
    if (body.turGereeEsekh) tulukhUdruud = [ekhlekhOgnoo.getDate()];
    var butsaakhJagsaalt = [];
    var ognoo = new Date(ekhlekhOgnoo);
    var turOgnoo;
    var tukhainSar = new Date(moment(ognoo).set("date", 1));
    var suuliinUdur;
    var duussanEsekh = false;
    if (tulukhUdruud && tulukhUdruud.length > 1)
      tulukhUdruud.sort(function (a, b) {
        return a - b;
      });
    await new Array(khugatsaa).fill("").map((mur, index) => {
      tulukhUdruud?.forEach((udur) => {
        if (!duussanEsekh) {
          suuliinUdur = moment(tukhainSar).endOf("month").date();
          if (suuliinUdur < udur) {
            turOgnoo = new Date(moment(tukhainSar).set("date", suuliinUdur));
          } else {
            turOgnoo = new Date(moment(tukhainSar).set("date", udur));
          }
          if (turOgnoo >= ekhlekhOgnoo) {
            if (
              turOgnoo.getMonth() == duusakhOgnoo.getMonth() &&
              turOgnoo.getFullYear() == duusakhOgnoo.getFullYear()
            )
              duussanEsekh = true;
            dun = ekhniiSariinDunZasyaSync(
              body,
              turOgnoo,
              ekhlekhOgnoo,
              body.dun
            ); // Ekhnii sariin dun bodokh
            if (dun > 0)
              butsaakhJagsaalt.push({
                turul: "khuvaari",
                ognoo: turOgnoo,
                tulukhDun: dun,
                undsenDun: dun,
              });
            if (zardluud && zardluud.length > 0) {
              zardluud.forEach((zardal) => {
                if (
                  zardal.ognoonuud?.length > 0 &&
                  moment(turOgnoo).format("MM") >
                    moment(zardal.ognoonuud[0]).format("MM") &&
                  moment(turOgnoo).format("MM") <
                    moment(zardal.ognoonuud[1]).format("MM")
                )
                  return;
                if (
                  zardal &&
                  (!zardal.ner?.includes("Цахилгаан") ||
                    (zardal.ner?.includes("Цахилгаан") &&
                      zardal.turul == "Тогтмол"))
                ) {
                  if (zardal.turul == "1м2")
                    zardal.dun = tooZasyaSync(zardal.tariff * body.mk);
                  if (zardal.turul == "1м3/талбай")
                    zardal.dun = tooZasyaSync(zardal.tariff * body.metrKube);
                  if (zardal.turul == "Тогтмол") zardal.dun = zardal.tariff;
                  var zardalDun = ekhniiSariinDunZasyaSync(
                    body,
                    turOgnoo,
                    ekhlekhOgnoo,
                    zardal.dun
                  );
                  if (
                    zardal.ognoonuud?.length > 0 &&
                    moment(zardal.ognoonuud[0]).format("MM") ==
                      moment(turOgnoo).format("MM")
                  ) {
                    var khonog = parseFloat(
                      moment(zardal.ognoonuud[0]).format("DD")
                    );
                    var niitKhonog = parseFloat(
                      moment(zardal.ognoonuud[0]).endOf("month").format("DD")
                    );
                    zardalDun = (zardalDun * khonog) / (niitKhonog || 1);
                  }
                  if (
                    zardal.ognoonuud?.length > 0 &&
                    moment(zardal.ognoonuud[0]).format("MM") !=
                      moment(zardal.ognoonuud[1]).format("MM") &&
                    moment(zardal.ognoonuud[1]).format("MM") ==
                      moment(turOgnoo).format("MM")
                  ) {
                    var niitKhonog = parseFloat(
                      moment(zardal.ognoonuud[1]).endOf("month").format("DD")
                    );
                    var khonog =
                      niitKhonog -
                      parseFloat(moment(zardal.ognoonuud[1]).format("DD"));
                    zardalDun = (zardalDun * khonog) / (niitKhonog || 1);
                  }
                  if (zardalDun > 0)
                    butsaakhJagsaalt.push({
                      turul: "avlaga",
                      tailbar: zardal.ner,
                      ognoo: turOgnoo,
                      tulukhDun: zardalDun,
                    });
                }
              });
            }
            if (khungulultuud?.length > 0) {
              khungulultuud.forEach((data) => {
                if (
                  moment(turOgnoo) >=
                    moment(
                      moment(data.ognoonuud[0]).format("YYYY-MM-DD 00:00:00")
                    ) &&
                  moment(turOgnoo) <=
                    moment(
                      moment(data.ognoonuud[1]).format("YYYY-MM-DD 23:59:59")
                    )
                ) {
                  butsaakhJagsaalt.push({
                    tulukhDun: 0,
                    ognoo: turOgnoo,
                    turul: "khungulult",
                    khyamdral: data.khungulultiinDun,
                    nemeltTailbar: "Гэрээ",
                    tailbar: "Хөнгөлөлт",
                  });
                }
              });
            }
          }
          ognoo = new Date(turOgnoo);
        }
      });
      tukhainSar = new Date(moment(tukhainSar).add(1, "month"));
    });
    res.send(butsaakhJagsaalt);
  } catch (aldaa) {
    next(aldaa);
  }
});

function ekhniiSariinDunZasyaSync(body, turOgnoo, ekhlekhOgnoo, dun) {
  if (
    turOgnoo.getMonth() == ekhlekhOgnoo.getMonth() &&
    turOgnoo.getFullYear() == ekhlekhOgnoo.getFullYear()
  ) {
    var sariinNiitKhonog = body.guchKhonogOruulakhEsekh
      ? 30
      : parseFloat(moment(ekhlekhOgnoo).endOf("month").format("DD"));
    var ashiglakhKhonog = body.garaasKhonogOruulakhEsekh
      ? body.ekhniiSariinKhonog
      : moment(ekhlekhOgnoo).endOf("month").diff(body.gereeniiOgnoo, "d") + 1;
    ashiglakhKhonog =
      sariinNiitKhonog < ashiglakhKhonog ? sariinNiitKhonog : ashiglakhKhonog; // 28 < 30
    dun = (dun * ashiglakhKhonog) / (sariinNiitKhonog || 1);
  }
  return dun;
}

module.exports.tulultTaniya = async function tulultTaniya() {
  try {
    const { db } = require("zevbackv2");
    var kholboltuud = db.kholboltuud;
    if (kholboltuud) {
      for await (const kholbolt of kholboltuud) {
        var dansnuud = await Dans(kholbolt).find({
          corporateAshiglakhEsekh: true,
          oirkhonTatakhEsekh: { $exists: false },
        });
        for await (const dans of dansnuud) {
          if (!!dans.bank) {
            var match = {
              createdAt: {
                $gt: new Date(new Date().getTime() - 60000),
                $lt: new Date(),
              },
              dansniiDugaar: dans.dugaar,
              baiguullagiinId: dans.baiguullagiinId,
              barilgiinId: dans.barilgiinId,
              bank: dans.bank,
              kholbosonTalbainId: { $size: 0 },
              magadlaltaiGereenuud: { $exists: false },
            };
            var match1 = match;
            if (dans.bank == "golomt") {
              match1["tranDesc"] = { $regex: "qpay", $options: "i" };
              match1["drOrCr"] = "Credit";
              match1["recNum"] = "1";
              match1["tranAmount"] = { $gt: 0 };
            } else if (dans.bank == "tdb") {
              match1["Amt"] = { $gt: 0 };
              match1["TxAddInf"] = { $regex: "qpay", $options: "i" };
            } else {
              match1["description"] = { $regex: "qpay", $options: "i" };
              match1["amount"] = { $gt: 0 };
            }
            var guilgeenuud = [];
            var guilgeenuudQpay = await BankniiGuilgee(kholbolt, true).find(match1);
            guilgeenuud.push(...guilgeenuudQpay);
            var match2 = match;
            if (dans.bank == "golomt") {
              match2["tranDesc"] = { $regex: "QPAY", $options: "i" };
              match2["drOrCr"] = "Credit";
              match2["recNum"] = "1";
              match2["tranAmount"] = { $gt: 0 };
            } else if (dans.bank == "tdb") {
              match2["TxAddInf"] = { $regex: "QPAY", $options: "i" };
              match2["Amt"] = { $gt: 0 };
            } else {
              match2["description"] = { $regex: "QPAY", $options: "i" };
              match2["amount"] = { $gt: 0 };
            }
            var guilgeenuudQPAY = await BankniiGuilgee(kholbolt, true).find(match2);
            guilgeenuud.push(...guilgeenuudQPAY);
            var match3 = match;
            if (dans.bank == "golomt") {
              match3["tranDesc"] = { $not: { $regex: "qpay" } };
              match3["drOrCr"] = "Credit";
              match3["recNum"] = "1";
              match3["tranAmount"] = { $gt: 0 };
            } else if (dans.bank == "tdb") {
              match3["TxAddInf"] = { $not: { $regex: "qpay" } };
              match3["Amt"] = { $gt: 0 };
            } else {
              match3["description"] = { $not: { $regex: "qpay" } };
              match3["amount"] = { $gt: 0 };
            }
            var guilgeenuudBish = await BankniiGuilgee(kholbolt, true).find(match3);
            guilgeenuud.push(...guilgeenuudBish);
            var match4 = match;
            if (dans.bank == "golomt") {
              match4["tranDesc"] = { $not: { $regex: "QPAY" } };
              match4["drOrCr"] = "Credit";
              match4["recNum"] = "1";
              match4["tranAmount"] = { $gt: 0 };
            } else if (dans.bank == "tdb") {
              match4["TxAddInf"] = { $not: { $regex: "QPAY" } };
              match4["Amt"] = { $gt: 0 };
            } else {
              match4["description"] = { $not: { $regex: "QPAY" } };
              match4["amount"] = { $gt: 0 };
            }
            var guilgeenuudQPAYBish = await BankniiGuilgee(kholbolt, true).find(
              match4
            );
            guilgeenuud.push(...guilgeenuudQPAYBish);
            var khaikhNukhtsul;
            var tailbar = [];
            if (guilgeenuud?.length > 0) {
              guilgeenuud.forEach(async (x) => {
                if (
                  (x.description &&
                    x.description.toLowerCase().includes("qpay")) ||
                  (x.TxAddInf && x.TxAddInf.toLowerCase().includes("qpay")) ||
                  (x.tranDesc && x.tranDesc.toLowerCase().includes("qpay"))
                ) {
                  if (x.description) tailbar = x.description.split(/,| /);
                  else if (x.TxAddInf) tailbar = x.TxAddInf.split(/,| /);
                  else if (x.tranDesc) tailbar = x.tranDesc.split(/,| /);
                  var oldsonGereenuud = await Geree(kholbolt, true).find({
                    gereeniiDugaar: { $in: tailbar },
                    tuluv: 1,
                    barilgiinId: x.barilgiinId,
                  });
                  if (oldsonGereenuud != null && oldsonGereenuud.length == 1) {
                    var jagsaalt = [];
                    var dugaar = oldsonGereenuud[0].talbainDugaar;
                    if (dugaar.includes(",")) {
                      jagsaalt = [...jagsaalt, ...dugaar.split(",")];
                    } else jagsaalt.push(dugaar);
                    x.kholbosonGereeniiId = [oldsonGereenuud[0]._id];
                    x.kholbosonTalbainId = jagsaalt;
                    x.kholbosonDun = x.amount || x.Amt || x.tranAmount;
                    x.isNew = false;
                    x.save();
                  }
                } else {
                  khaikhNukhtsul = [];
                  if (x.description) tailbar = x.description.split(" ");
                  else if (x.TxAddInf) tailbar = x.TxAddInf.split(" ");
                  else if (x.tranDesc) tailbar = x.tranDesc.split(" ");
                  var oldsonGereenuud = [];
                  if (x.relatedAccount != null) {
                    var oldsonGereenuudRelatedAccount = await Geree(
                      kholbolt,
                      true
                    ).find({
                      "avlaga.guilgeenuud.dansniiDugaar": x.relatedAccount,
                      tuluv: 1,
                      barilgiinId: x.barilgiinId,
                    });
                    if (oldsonGereenuudRelatedAccount?.length > 0)
                      oldsonGereenuud.push(...oldsonGereenuudRelatedAccount);
                  } else if (x.CtAcntOrg != null) {
                    var oldsonGereenuudCtAcntOrg = await Geree(
                      kholbolt,
                      true
                    ).find({
                      "avlaga.guilgeenuud.dansniiDugaar": x.CtAcntOrg,
                      tuluv: 1,
                      barilgiinId: x.barilgiinId,
                    });
                    if (oldsonGereenuudCtAcntOrg?.length > 0)
                      oldsonGereenuud.push(...oldsonGereenuudCtAcntOrg);
                  }
                  var oldsonGereenuudUtas = await Geree(kholbolt, true).find({
                    utas: { $in: tailbar },
                    tuluv: 1,
                    barilgiinId: x.barilgiinId,
                  });
                  if (oldsonGereenuudUtas)
                    oldsonGereenuud.push(...oldsonGereenuudUtas);
                  var oldsonGereenuudRegister = await Geree(
                    kholbolt,
                    true
                  ).find({
                    register: { $in: tailbar },
                    tuluv: 1,
                    barilgiinId: x.barilgiinId,
                  });
                  if (oldsonGereenuudRegister)
                    oldsonGereenuud.push(...oldsonGereenuudRegister);

                  tailbar.forEach((y) => {
                    y = y.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, "");
                    khaikhNukhtsul.push({
                      talbainDugaar: { $regex: ".*" + y + ".*" },
                    });
                  });

                  var oldsonGereenuud = await Geree(kholbolt, true).find({
                    $or: khaikhNukhtsul,
                    tuluv: 1,
                    barilgiinId: x.barilgiinId,
                  });
                  if (oldsonGereenuud != null && oldsonGereenuud.length > 0) {
                    oldsonGereenuud.forEach((a) => {
                      if (
                        x.magadlaltaiGereenuud != null &&
                        !x.magadlaltaiGereenuud.includes(a._id)
                      )
                        x.magadlaltaiGereenuud.push(a._id);
                      else x.magadlaltaiGereenuud = [a._id];
                    });
                    x.isNew = false;
                    x.save();
                  }
                }
              });
            }
          }
        }
      }
    }
  } catch (e) {}
};

module.exports.aldangiBodyo = async function aldangiBodyo(
  baiguullagiinId = null
) {
  try {
    const { db } = require("zevbackv2");
    var kholboltuud = db.kholboltuud;
    if (kholboltuud) {
      var query = {
        "barilguud.tokhirgoo.aldangiinKhuvi": { $gt: 0 },
      };
      if (!!baiguullagiinId) {
        var ObjectId = require("mongodb").ObjectId;
        query["_id"] = new ObjectId(baiguullagiinId);
      }
      var baiguullaguud = await Baiguullaga(db.erunkhiiKholbolt)
        .find(query)
        .lean();
      if (baiguullaguud && baiguullaguud.length > 0) {
        for await (const baiguullaga of baiguullaguud) {
          var kholbolt = kholboltuud.find(
            (a) => a.baiguullagiinId == baiguullaga._id.toString()
          );
          var bulkOps = [];
          var aldangiinTuukh = [];
          for await (const barilga of baiguullaga.barilguud) {
            if (
              barilga.tokhirgoo &&
              barilga.tokhirgoo.aldangiinKhuvi &&
              barilga.tokhirgoo.aldangiBodojEkhlekhOgnoo &&
              barilga.tokhirgoo.aldangiBodojEkhlekhOgnoo < new Date()
            ) {
              var ognoo = new Date();
              var aldagiinKhuvi =
                barilga.tokhirgoo && barilga.tokhirgoo.aldangiinKhuvi
                  ? barilga.tokhirgoo.aldangiinKhuvi
                  : 0.5;
              var aldangiChuluulukhKhonog =
                barilga.tokhirgoo && barilga.tokhirgoo.aldangiChuluulukhKhonog
                  ? barilga.tokhirgoo.aldangiChuluulukhKhonog
                  : 0;
              var match = {
                "avlaga.guilgeenuud.ognoo": { $lte: new Date() },
                $or: [
                  {
                    "avlaga.guilgeenuud.turul": {
                      $nin: ["aldangi", "baritsaa"],
                    },
                  },
                  {
                    $and: [
                      {
                        "avlaga.guilgeenuud.turul": {
                          $in: ["baritsaa"],
                        },
                      },
                      {
                        "avlaga.guilgeenuud.tulsunDun": {
                          $gt: 0,
                        },
                      },
                    ],
                  },
                ],
              };
              var query = [
                {
                  $match: {
                    baiguullagiinId: baiguullaga._id.toString(),
                    barilgiinId: barilga._id.toString(),
                    tuluv: { $nin: [-1] },
                  },
                },
                {
                  $unwind: {
                    path: "$avlaga.guilgeenuud",
                  },
                },
                {
                  $match: match,
                },
                {
                  $group: {
                    _id: {
                      id: "$_id",
                      gereeniiDugaar: "$gereeniiDugaar",
                      tulukhUdur: "$tulukhUdur",
                    },
                    tulukh: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.tulukhDun", 0],
                      },
                    },
                    khyamdral: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.khyamdral", 0],
                      },
                    },
                    tulsun: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.tulsunDun", 0],
                      },
                    },
                  },
                },
                {
                  $project: {
                    uldegdel: {
                      $subtract: [
                        "$tulukh",
                        {
                          $sum: ["$tulsun", "$khyamdral"],
                        },
                      ],
                    },
                  },
                },
                {
                  $match: {
                    uldegdel: { $gt: 0 },
                  },
                },
              ];
              var gereenuud = await Geree(kholbolt, true).aggregate(query);
              if (gereenuud && gereenuud.length > 0) {
                for (const geree of gereenuud) {
                  var uusgexOgnoo = moment(ognoo).set(
                    "date",
                    geree._id.tulukhUdur[0]
                  );
                  if (
                    geree.uldegdel > 0 &&
                    new Date() >
                      new Date(
                        moment(new Date(uusgexOgnoo)).add(
                          aldangiChuluulukhKhonog,
                          "days"
                        )
                      )
                  ) {
                    var bodogdsonKhuu = tooZasyaSync(
                      (geree.uldegdel * aldagiinKhuvi) / 100
                    );
                    let upsertDoc = {
                      updateOne: {
                        filter: { _id: geree._id.id },
                        update: [
                          {
                            $set: {
                              aldangiinUldegdel: {
                                $add: [
                                  { $ifNull: ["$aldangiinUldegdel", 0] },
                                  bodogdsonKhuu,
                                ],
                              },
                            },
                          },
                        ],
                      },
                    };
                    bulkOps.push(upsertDoc);
                    var data = await Geree(kholbolt, true).findById(
                      geree._id.id
                    );
                    var mur = {
                      baiguullagiinId: baiguullaga._id.toString(),
                      barilgiinId: barilga._id.toString(),
                      turul: "qpay",
                      gereeniiId: geree._id.id,
                      gereeniiDugaar: geree._id.gereeniiDugaar,
                      ognoo: uusgexOgnoo,
                      uldegdel: geree.uldegdel,
                      aldangiChuluulukhOgnoo: new Date(
                        moment(new Date(uusgexOgnoo)).add(
                          aldangiChuluulukhKhonog,
                          "days"
                        )
                      ),
                      aldangiBodsonOgnoo: ognoo,
                      aldangiinKhuvi: aldagiinKhuvi,
                      aldangiChuluulukhKhonog: aldangiChuluulukhKhonog,
                      aldangi: bodogdsonKhuu,
                      umnukhAldangi: data.aldangiinUldegdel || 0,
                      niitAldangi:
                        (data.aldangiinUldegdel || 0) + bodogdsonKhuu,
                      tulukhUdur: geree._id.tulukhUdur[0],
                    };
                    aldangiinTuukh.push(new AldangiinTuukh(kholbolt)(mur));
                  } else continue;
                }
              }
            }
          }
          if (bulkOps && bulkOps.length > 0)
            await Geree(kholbolt).bulkWrite(bulkOps);
          if (aldangiinTuukh?.length > 0)
            await AldangiinTuukh(kholbolt).insertMany(aldangiinTuukh);
        }
      }
    }
  } catch (error) {}
};

async function tooZasya(too) {
  var zassanToo = (await Math.round((too + Number.EPSILON) * 100)) / 100;
  return +zassanToo.toFixed(2);
}

function tooZasyaSync(too) {
  var zassanToo = Math.round((too + Number.EPSILON) * 100) / 100;
  return +zassanToo.toFixed(2);
}

exports.tulultUstgaya = asyncHandler(async (req, res, next) => {
  if (!req.body.tailbar) throw new Error("Тайлбар заавал оруулна уу?");
  if (req.body.guilgeeniiId) {
    var bankGuilgee = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt, true
    ).findOne({
      _id: req.body.guilgeeniiId,
    });
    if (bankGuilgee && bankGuilgee.ebarimtAvsanEsekh)
      throw new Error(
        "ИБаримт авсан гүйлгээг устгах боломжгүй! ИБаримтын гүйлгээг устгасны дараа устгах боломжтой!"
      );
  }
  const session = await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
  session.startTransaction();
  try {
    var ObjectId = require("mongodb").ObjectId;
    var ustgaxObject = await Geree(
      req.body.tukhainBaaziinKholbolt,
      true
    ).aggregate([
      {
        $unwind: "$avlaga.guilgeenuud",
      },
      {
        $match: {
          _id: new ObjectId(req.body.gereeniiId),
          "avlaga.guilgeenuud._id": new ObjectId(req.body.objectiinId),
        },
      },
    ]);
    var tuxainGuilgee = ustgaxObject[0].avlaga.guilgeenuud;
    var inc = {
      uldegdel: tuxainGuilgee?.tulsunDun || 0,
    };
    if (tuxainGuilgee.tulsunAldangi && tuxainGuilgee.tulsunAldangi > 0)
      inc["aldangiinUldegdel"] = tuxainGuilgee.tulsunAldangi;

    await Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: req.body.gereeniiId },
        {
          $pull: {
            [`avlaga.guilgeenuud`]: {
              _id: req.body.objectiinId,
            },
          },
          $inc: inc,
        }
      )
      .catch((err) => {
        next(err);
      });

    if (tuxainGuilgee) {
      tuxainGuilgee.gereeniiDugaar = req.body.gereeniiDugaar;
      var ustsanBarimt = new UstsanBarimt(req.body.tukhainBaaziinKholbolt)();
      ustsanBarimt.class = "gereeniiGuilgee";
      ustsanBarimt.tailbar = req.body.tailbar;
      ustsanBarimt.object = tuxainGuilgee;
      if (req.body.nevtersenAjiltniiToken) {
        ustsanBarimt.ajiltniiNer = req.body.nevtersenAjiltniiToken.ner;
        ustsanBarimt.ajiltniiId = req.body.nevtersenAjiltniiToken.id;
      }
      ustsanBarimt.baiguullagiinId = req.body.baiguullagiinId;
      await ustsanBarimt.save();
    }
    if (req.body.guilgeeniiId) {
      var dun = await tooZasya(
        (tuxainGuilgee.tulsunDun ? tuxainGuilgee.tulsunDun : 0) +
          (tuxainGuilgee.tulsunAldangi ? tuxainGuilgee.tulsunAldangi : 0)
      );
      await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
        .updateOne({ _id: req.body.guilgeeniiId }, [
          {
            $set: {
              kholbosonDun: {
                $add: [{ $ifNull: ["$kholbosonDun", 0] }, dun * -1],
              },
            },
          },
        ])
        .catch((err) => {
          next(err);
        });
      var tempGeree = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .findById(req.body.gereeniiId)
        .select("avlaga");
      var filteredBaritsaa = tempGeree?.avlaga?.baritsaa?.filter(
        (a) => a.guilgeeniiId === req.body.guilgeeniiId
      );
      var filteredGuilgee = tempGeree?.avlaga?.guilgeenuud?.filter(
        (a) => a.guilgeeniiId === req.body.guilgeeniiId
      );
      if (filteredBaritsaa?.length === 0 && filteredGuilgee?.length === 0)
        await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
          .updateOne(
            { _id: req.body.guilgeeniiId },
            {
              $pull: {
                kholbosonGereeniiId: req.body.gereeniiId,
                kholbosonTalbainId: req.body.talbainDugaar,
              },
            }
          )
          .catch((err) => {
            next(err);
          });
    }
    await session.commitTransaction();
    session.endSession();
    daraagiinTulukhOgnooZasya(
      req.body.gereeniiId,
      req.body.tukhainBaaziinKholbolt
    );
    res.send("Amjilttai");
  } catch (err) {
    await session.abortTransaction();
    next(err);
  }
});

exports.baritsaaniiGuilgeeUstgaya = asyncHandler(async (req, res, next) => {
  const session = await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
  session.startTransaction();
  try {
    var ObjectId = require("mongodb").ObjectId;
    var ustgaxObject = await Geree(
      req.body.tukhainBaaziinKholbolt,
      true
    ).aggregate([
      {
        $unwind: "$avlaga.baritsaa",
      },
      {
        $match: {
          _id: new ObjectId(req.body.gereeniiId),
          "avlaga.baritsaa._id": new ObjectId(req.body.objectiinId),
        },
      },
    ]);
    if (ustgaxObject?.length > 0) {
      var tuxainBaritsaa = ustgaxObject[0].avlaga?.baritsaa;
      if (tuxainBaritsaa) {
        tuxainBaritsaa.turul = "baritsaa";
        tuxainBaritsaa.gereeniiDugaar = req.body.gereeniiDugaar;
        var ustsanBarimt = new UstsanBarimt(req.body.tukhainBaaziinKholbolt)();
        ustsanBarimt.class = "baritsaa";
        ustsanBarimt.tailbar = req.body.tailbar;
        ustsanBarimt.object = tuxainBaritsaa;
        if (req.body.nevtersenAjiltniiToken) {
          ustsanBarimt.ajiltniiNer = req.body.nevtersenAjiltniiToken.ner;
          ustsanBarimt.ajiltniiId = req.body.nevtersenAjiltniiToken.id;
        }
        ustsanBarimt.baiguullagiinId = req.body.baiguullagiinId;
        await ustsanBarimt.save();
      }
    }
    var ustgaxObject1 = await Geree(
      req.body.tukhainBaaziinKholbolt,
      true
    ).aggregate([
      {
        $unwind: "$avlaga.guilgeenuud",
      },
      {
        $match: {
          _id: new ObjectId(req.body.gereeniiId),
          "avlaga.guilgeenuud._id": new ObjectId(req.body.objectiinId),
        },
      },
    ]);
    if (ustgaxObject1?.length > 0) {
      var tuxainGuilgee = ustgaxObject1[0].avlaga?.guilgeenuud;
      if (tuxainGuilgee) {
        tuxainGuilgee.gereeniiDugaar = req.body.gereeniiDugaar;
        var ustsanBarimt = new UstsanBarimt(req.body.tukhainBaaziinKholbolt)();
        ustsanBarimt.class = "baritsaaAshiglalt";
        ustsanBarimt.tailbar = req.body.tailbar;
        ustsanBarimt.object = tuxainGuilgee;
        if (req.body.nevtersenAjiltniiToken) {
          ustsanBarimt.ajiltniiNer = req.body.nevtersenAjiltniiToken.ner;
          ustsanBarimt.ajiltniiId = req.body.nevtersenAjiltniiToken.id;
        }
        ustsanBarimt.baiguullagiinId = req.body.baiguullagiinId;
        await ustsanBarimt.save();
      }
    }
    await Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate(
        { _id: req.body.gereeniiId },
        {
          $pull: {
            [`avlaga.guilgeenuud`]: {
              _id: req.body.objectiinId,
            },
            [`avlaga.baritsaa`]: {
              _id: req.body.objectiinId,
            },
          },
        }
      )
      .catch((err) => {
        next(err);
      });

    var updatedGeree = await Geree(req.body.tukhainBaaziinKholbolt)
      .findByIdAndUpdate({ _id: req.body.gereeniiId }, [
        {
          $set: {
            baritsaaniiUldegdel: {
              $add: [
                { $ifNull: ["$baritsaaniiUldegdel", 0] },
                req.body.zarlaga - req.body.orlogo,
              ],
            },
          },
        },
      ])
      .catch((err) => {
        next(err);
      });
    if (req.body.guilgeeniiId) {
      await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
        .updateOne({ _id: req.body.guilgeeniiId }, [
          {
            $set: {
              kholbosonDun: {
                $add: [
                  { $ifNull: ["$kholbosonDun", 0] },
                  req.body.zarlaga - req.body.orlogo,
                ],
              },
            },
          },
        ])
        .catch((err) => {
          next(err);
        });
      var tempGeree = await Geree(req.body.tukhainBaaziinKholbolt)
        .findById(req.body.gereeniiId, true)
        .select("avlaga");
      var filteredGuilgee = tempGeree?.avlaga?.guilgeenuud?.filter(
        (a) => a.guilgeeniiId === req.body.guilgeeniiId
      );
      if (filteredGuilgee?.length === 0)
        await BankniiGuilgee(req.body.tukhainBaaziinKholbolt)
          .updateOne(
            { _id: req.body.guilgeeniiId },
            {
              $pull: {
                kholbosonGereeniiId: req.body.gereeniiId,
                kholbosonTalbainId: updatedGeree.talbainDugaar,
              },
            }
          )
          .catch((err) => {
            next(err);
          });
    }
    await daraagiinTulukhOgnooZasya(
      req.body.gereeniiId,
      req.body.tukhainBaaziinKholbolt
    );
    await session.commitTransaction();
    session.endSession();
    res.send("Amjilttai");
  } catch (err) {
    await session.abortTransaction();
    next(err);
  }
});

exports.uldegdelBodyo = asyncHandler(async (req, res, next) => {
  var match = {
    $or: [
      {
        "avlaga.guilgeenuud.turul": {
          $nin: ["aldangi", "baritsaa"],
        },
      },
      {
        $and: [
          {
            "avlaga.guilgeenuud.turul": {
              $in: ["baritsaa"],
            },
          },
          {
            "avlaga.guilgeenuud.tulsunDun": {
              $gt: 0,
            },
          },
        ],
      },
    ],
  };
  if (!!req.body.ognoo) {
    match["avlaga.guilgeenuud.ognoo"] = {
      $lte: new Date(
        moment(req.body.ognoo && req.body.ognoo[1])
          .endOf("month")
          .format("YYYY-MM-DD 23:59:59")
      ),
    };
  } else match["avlaga.guilgeenuud.ognoo"] = { $lte: new Date() };
  var valTuluv = req.body.tsutsalsanTurul ? { $in: [-1] } : { $nin: [-1] };
  var query = [
    {
      $match: {
        gereeniiDugaar: req.body.gereeniiDugaar,
        baiguullagiinId: req.body.baiguullagiinId,
        barilgiinId: req.body.barilgiinId,
        tuluv: valTuluv,
      },
    },
    {
      $unwind: {
        path: "$avlaga.guilgeenuud",
      },
    },
    {
      $match: match,
    },
    {
      $group: {
        _id: "aaa",
        tulukh: {
          $sum: {
            $ifNull: ["$avlaga.guilgeenuud.tulukhDun", 0],
          },
        },
        khyamdral: {
          $sum: {
            $ifNull: ["$avlaga.guilgeenuud.khyamdral", 0],
          },
        },
        tulsun: {
          $sum: {
            $ifNull: ["$avlaga.guilgeenuud.tulsunDun", 0],
          },
        },
      },
    },
    {
      $project: {
        uldegdel: {
          $subtract: [
            "$tulukh",
            {
              $sum: ["$tulsun", "$khyamdral"],
            },
          ],
        },
      },
    },
  ];
  Geree(req.body.tukhainBaaziinKholbolt, true)
    .aggregate(query)
    .then((result) => {
      res.send({
        uldegdel: (result[0]?.uldegdel || 0).toFixed(2),
      });
    })
    .catch((err) => {
      next(err);
    });
});

exports.khungulultKhadgalya = asyncHandler(async (req, res, next) => {
  try {
    const session =
      await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
    session.startTransaction();
    try {
      var khungulult = new KhungulultiinTuukh(req.body.tukhainBaaziinKholbolt)(
        req.body
      );
      gereeniiDugaaruud = [];
      khungulult.khamaataiGereenuud.forEach((x) => {
        if (typeof x === "object") {
          gereeniiDugaaruud.push(x.gereeniiId);
        } else {
          gereeniiDugaaruud.push(x);
        }
      });
      khungulult.guilgeeKhiisenOgnoo = new Date();
      khungulult.guilgeeKhiisenAjiltniiNer =
        req.body.nevtersenAjiltniiToken?.ner;
      khungulult.guilgeeKhiisenAjiltniiId = req.body.nevtersenAjiltniiToken?.id;
      khariu = await khungulult.save();
      var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .find({
          _id: { $in: gereeniiDugaaruud },
        })
        .select("+avlaga");
      for await (const geree of gereenuud) {
        khyamdraluud = [];
        var khungulultiinDun = khungulult.khamaataiGereenuud?.find(
          (x) => x.gereeniiId == geree._id
        )?.khymdarsanDun;
        if (khungulult.khonogTootsokhEsekh) {
          khyamdral = {
            tulukhDun: 0,
            ognoo: khungulult.ognoonuud[0],
            khungulultDuusakhOgnoo: khungulult.ognoonuud[1],
            khonogTootsokhEsekh: khungulult.khonogTootsokhEsekh,
            khungulultKhonog: khungulult.khungulultKhonog,
            khungulultKhuvi: khungulult.khungulultKhuvi,
            turul: "khungulult",
            khyamdral: khungulultiinDun,
            nemeltTailbar: khungulult.shaltgaan,
            tailbar: req.body.tailbar,
            khyamdraliinId: khariu._id,
            guilgeeKhiisenOgnoo: new Date(),
            guilgeeKhiisenAjiltniiNer: req.body.nevtersenAjiltniiToken?.ner,
            guilgeeKhiisenAjiltniiId: req.body.nevtersenAjiltniiToken?.id,
          };
          khyamdraluud.push(khyamdral);
        } else
          for await (const ognoo of khungulult.ognoonuud) {
            var filterGuilgeenuud = geree.avlaga?.guilgeenuud.filter(
              (a) =>
                (a.turul === "khuvaari" || a.turul === "avlaga") &&
                moment(a.ognoo).format("YYYY/MM") ===
                  moment(ognoo).format("YYYY/MM")
            );
            if (filterGuilgeenuud?.length > 0) {
              khyamdral = {
                tulukhDun: 0,
                ognoo: filterGuilgeenuud[0].ognoo,
                turul: "khungulult",
                khyamdral: khungulultiinDun,
                nemeltTailbar: khungulult.shaltgaan,
                tailbar: req.body.tailbar,
                khyamdraliinId: khariu._id,
                guilgeeKhiisenOgnoo: new Date(),
                guilgeeKhiisenAjiltniiNer: req.body.nevtersenAjiltniiToken?.ner,
                guilgeeKhiisenAjiltniiId: req.body.nevtersenAjiltniiToken?.id,
              };
              khyamdraluud.push(khyamdral);
            }
          }
        await Geree(req.body.tukhainBaaziinKholbolt).updateOne(
          { _id: geree._id },
          { $push: { "avlaga.guilgeenuud": { $each: khyamdraluud } } }
        );
      }
      await session.commitTransaction();
      session.endSession();
      res.send("Amjilttai");
    } catch (err1) {
      await session.abortTransaction();
      next(err1);
    }
  } catch (err) {
    next(err);
  }
});

exports.khungulultUstgaya = asyncHandler(async (req, res, next) => {
  try {
    const session =
      await req.body.tukhainBaaziinKholbolt.kholbolt.startSession();
    session.startTransaction();
    try {
      var khungulult = await KhungulultiinTuukh(
        req.body.tukhainBaaziinKholbolt
      ).findOne({ _id: req.body.id });
      gereeniiDugaaruud = [];
      khungulult.khamaataiGereenuud.forEach((x) => {
        if (typeof x === "object") {
          gereeniiDugaaruud.push(x.gereeniiId);
        } else {
          gereeniiDugaaruud.push(x);
        }
      });
      for await (const gereeniiDugaar of gereeniiDugaaruud) {
        khyamdraluud = [];
        await Geree(req.body.tukhainBaaziinKholbolt).findOneAndUpdate(
          { _id: gereeniiDugaar },
          {
            $pull: { "avlaga.guilgeenuud": { khyamdraliinId: khungulult._id } },
          }
        );
      }
      var ustsanBarimt = new UstsanBarimt(req.body.tukhainBaaziinKholbolt)();
      ustsanBarimt.class = "khungulult";
      ustsanBarimt.tailbar = req.body.tailbar;
      ustsanBarimt.object = khungulult;
      if (req.body.nevtersenAjiltniiToken) {
        ustsanBarimt.ajiltniiNer = req.body.nevtersenAjiltniiToken.ner;
        ustsanBarimt.ajiltniiId = req.body.nevtersenAjiltniiToken.id;
      }
      ustsanBarimt.baiguullagiinId = khungulult.baiguullagiinId;
      await ustsanBarimt.save();
      await KhungulultiinTuukh(req.body.tukhainBaaziinKholbolt).deleteOne({
        _id: khungulult._id,
      });
      await session.commitTransaction();
      session.endSession();
      res.send("Amjilttai");
    } catch (err1) {
      await session.abortTransaction();
      next(err1);
    }
  } catch (err) {
    next(err);
  }
});

exports.tukhainOgnoogoorZardalBodojOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true).find({
        barilgiinId: req.body.barilgiinId,
      });
      var khariu = [];
      if (gereenuud)
        for await (const element of gereenuud) {
          if (element.zardluud && element.zardluud.length > 0) {
            var butsaakhJagsaalt = [];
            element.zardluud.forEach((zardal) => {
              if (zardal) {
                if (zardal.turul == "1м2")
                  zardal.dun = tooZasyaSync(
                    zardal.tariff * geree.talbainKhemjee
                  );
                if (zardal.turul == "1м3/талбай")
                  zardal.dun = tooZasyaSync(
                    zardal.tariff * geree.talbainKhemjeeMetrKube
                  );
                if (zardal.turul == "Тогтмол") zardal.dun = zardal.tariff;
                butsaakhJagsaalt.push({
                  turul: "avlaga",
                  tailbar: zardal.ner,
                  tulukhDun: zardal.dun,
                  ognoo: moment(req.body.duusakhOgnoo).set(
                    "date",
                    element.tulukhUdur[0]
                  ),
                });
              }
            });
            Geree(req.body.tukhainBaaziinKholbolt)
              .updateOne(
                { _id: element._id },
                {
                  $push: {
                    ["avlaga.guilgeenuud"]: {
                      $each: butsaakhJagsaalt,
                    },
                  },
                }
              )
              .then(async (result) => {
                khariu.push(result);
              });
          }
        }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.tukhainOgnoogoorAvlagaBodojOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .find({
          tuluv: 1,
          baiguullagiinId: req.body.baiguullagiinId,
        })
        .select("+avlaga");
      var khariu = [];
      var object;
      if (gereenuud)
        for await (const element of gereenuud) {
          var oruulakhOgnoo = moment(req.body.duusakhOgnoo).set(
            "date",
            element.tulukhUdur[0]
          );
          object = {
            tulukhDun: element.sariinTurees,
            undsenDun: element.sariinTurees,
            turul: "khuvaari",
            ognoo: oruulakhOgnoo,
            khyamdral: 0,
          };
          var baigaa = element?.avlaga?.guilgeenuud?.find((a) => {
            return (
              a.undsenDun == element.sariinTurees &&
              a.tulukhDun == element.sariinTurees &&
              moment(a.ognoo).isSame(oruulakhOgnoo, "day")
            );
          });
          if (!baigaa) {
            var result = await Geree(req.body.tukhainBaaziinKholbolt).updateOne(
              { _id: element._id },
              {
                $push: {
                  ["avlaga.guilgeenuud"]: object,
                },
              }
            );
            khariu.push(result);
          }
        }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.tukhainOgnoogoorAvlagaZasajOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true).find({
        barilgiinId: req.body.barilgiinId,
        "talbainIdnuud.1": { $exists: true },
      });
      var khariu = [];
      if (gereenuud)
        for await (const element of gereenuud) {
          await Geree(req.body.tukhainBaaziinKholbolt).findOneAndUpdate(
            { gereeniiDugaar: element.gereeniiDugaar },
            {
              $set: {
                "avlaga.guilgeenuud.$[t].tulukhDun": element.sariinTurees,
                "avlaga.guilgeenuud.$[t].undsenDun": element.sariinTurees,
              },
            },
            {
              arrayFilters: [
                {
                  "t.turul": "khuvaari",
                  "t.ognoo": {
                    $gte: new Date(req.body.ekhlekhOgnoo),
                    $lte: new Date(req.body.duusakhOgnoo),
                  },
                },
              ],
            }
          );
        }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.talbainIdnuudOruulya = asyncHandler(async (req, res, next) => {
  try {
    var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true).find({
      talbainDugaar: { $exists: true },
      $or: [
        {
          "talbainIdnuud.0": { $exists: false },
        },
        {
          talbainIdnuud: { $exists: false },
        },
      ],
    });
    var bulkOps = [];
    if (gereenuud)
      for await (const element of gereenuud) {
        var dugaaruud = element.talbainDugaar.split(",");
        var talbainuud = await Talbai(req.body.tukhainBaaziinKholbolt)
          .find({
            kod: { $in: dugaaruud },
            barilgiinId: element.barilgiinId,
          })
          .lean();
        if (talbainuud && talbainuud.length > 0) {
          var idnuud = talbainuud.map((a) => a._id);
          let upsertDoc = {
            updateOne: {
              filter: { _id: element._id },
              update: { talbainIdnuud: idnuud },
            },
          };
          bulkOps.push(upsertDoc);
        }
      }
    await Geree(req.body.tukhainBaaziinKholbolt)
      .bulkWrite(bulkOps)
      .then((bulkWriteOpResult) => {})
      .catch((err) => {});
    res.send("zasagdsanToo : " + gereenuud.length);
  } catch (err) {
    next(err);
  }
});

exports.bankniiGuilgeegeerOruulya = asyncHandler(async (req, res, next) => {
  try {
    var ekhlekhOgnoo = new Date(req.body.ekhlekhOgnoo);
    var duusakhOgnoo = new Date(req.body.duusakhOgnoo);
    var guilgeenuud = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt, true
    ).find({
      "kholbosonGereeniiId.0": { $exists: true },
      TxPostDate: { $gte: ekhlekhOgnoo, $lte: duusakhOgnoo },
    });
    var oldooguiGuilgeenuud = [];
    for await (const guilgee of guilgeenuud) {
      var geree = await Geree(req.body.tukhainBaaziinKholbolt, true).findOne({
        $or: [
          { "avlaga.guilgeenuud.guilgeeniiId": guilgee._id },
          { "avlaga.baritsaa.guilgeeniiId": guilgee._id },
        ],
      });
      if (!geree) oldooguiGuilgeenuud.push(guilgee._id);
    }
    res.send(oldooguiGuilgeenuud);
  } catch (err) {
    next(err);
  }
});

exports.aldaataiBankniiGuilgeeZasya = asyncHandler(async (req, res, next) => {
  try {
    var idnuud = req.body.idnuud;
    var ObjectId = require("mongodb").ObjectId;
    var guilgeenuud = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt, true
    ).find({ _id: { $in: idnuud } });
    for await (const guilgee of guilgeenuud) {
      var geree = await Geree(req.body.tukhainBaaziinKholbolt, true).findOne({
        $or: [
          { "avlaga.guilgeenuud.guilgeeniiId": guilgee._id },
          { "avlaga.baritsaa.guilgeeniiId": guilgee._id },
        ],
      });
      if (!geree) {
        var oruulakhObject = {
          turul: "bank",
          ognoo: guilgee.TxPostDate ? guilgee.TxPostDate : guilgee.postDate,
          tulsunDun: guilgee.Amt ? guilgee.Amt : guilgee.amount,
          guilgeeniiId: guilgee._id,
          dansniiDugaar: guilgee.dansniiDugaar,
          tulsunDans: guilgee.CtAcntOrg
            ? guilgee.CtAcntOrg
            : guilgee.relatedAccount,
        };
        await Geree(req.body.tukhainBaaziinKholbolt).updateOne(
          { _id: new ObjectId(guilgee.kholbosonGereeniiId[0]) },
          {
            $push: {
              ["avlaga.guilgeenuud"]: oruulakhObject,
            },
          }
        );
      }
    }
    res.send("Amjilttai");
  } catch (err) {
    next(err);
  }
});

exports.qpayGuilgeeGereeOnooyo = asyncHandler(async (req, res, next) => {
  try {
    var qpayGuilgeenuud = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt, true
    ).find({
      $and: [
        {
          kholbosonGereeniiId: [],
        },
        {
          $or: [
            {
              $and: [
                {
                  TxAddInf: { $regex: "qpay", $options: "i" },
                },
                {
                  TxAddInf: { $regex: "Түрээсийн төлбөр", $options: "i" },
                },
              ],
            },
            {
              $and: [
                {
                  description: { $regex: "qpay", $options: "i" },
                },
                {
                  description: { $regex: "Түрээсийн төлбөр", $options: "i" },
                },
              ],
            },
          ],
        },
      ],
    });
    var khaikhNukhtsul;
    for await (const x of qpayGuilgeenuud) {
      khaikhNukhtsul = [];
      var tailbar;
      if (x.description) tailbar = x.description.split(/,| /);
      else if (x.TxAddInf) tailbar = x.TxAddInf.split(/,| /);
      tailbar.forEach((y) => {
        khaikhNukhtsul.push({ gereeniiDugaar: y });
      });
      var oldsonGereenuud = await Geree(
        req.body.tukhainBaaziinKholbolt,
        true
      ).find({
        $or: khaikhNukhtsul,
        tuluv: 1,
        barilgiinId: x.barilgiinId,
      });
      if (oldsonGereenuud != null && oldsonGereenuud.length == 1) {
        x.kholbosonGereeniiId = [oldsonGereenuud[0]._id];
        x.isNew = false;
        x.save();
      }
    }
    res.send("Amjilttai");
  } catch (err) {
    next(err);
  }
});

exports.qpayGuilgeeTalbainDugaarOnooyo = asyncHandler(
  async (req, res, next) => {
    try {
      var guilgeenuud = await BankniiGuilgee(
        req.body.tukhainBaaziinKholbolt, true
      ).find({
        $and: [
          {
            "kholbosonGereeniiId.0": { $exists: true },
          },
          {
            kholbosonTalbainId: [],
          },
          {
            $or: [
              {
                $and: [
                  {
                    TxAddInf: { $regex: "qpay", $options: "i" },
                  },
                  {
                    TxAddInf: { $regex: "Түрээсийн төлбөр", $options: "i" },
                  },
                ],
              },
              {
                $and: [
                  {
                    description: { $regex: "qpay", $options: "i" },
                  },
                  {
                    description: { $regex: "Түрээсийн төлбөр", $options: "i" },
                  },
                ],
              },
            ],
          },
        ],
      });
      for await (const guilgee of guilgeenuud) {
        var oldsonGeree = await Geree(
          req.body.tukhainBaaziinKholbolt,
          true
        ).findById(guilgee.kholbosonGereeniiId[0]);
        if (oldsonGeree) {
          await BankniiGuilgee(req.body.tukhainBaaziinKholbolt).updateOne(
            { _id: guilgee._id },
            {
              $set: {
                kholbosonTalbainId: [oldsonGeree.talbainDugaar],
              },
            }
          );
        }
      }
      res.send("Amjilttai");
    } catch (err) {
      next(err);
    }
  }
);

exports.tukhainOgnoogoorBukhAvlagaBodojOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
        .find({
          barilgiinId: req.body.barilgiinId,
          "avlaga.guilgeenuud.0": {
            $exists: true,
          },
          "tulukhUdur.0": {
            $exists: true,
          },
        })
        .select("+avlaga");
      var ajillakhGereenuud = [];
      for await (const x of gereenuud) {
        var tukhainSariinMur = await x.avlaga.guilgeenuud.find(
          (a) =>
            a.ognoo > new Date(req.body.ekhlekhOgnoo) &&
            a.ognoo < new Date(req.body.duusakhOgnoo) &&
            a.undsenDun > 0
        );
        if (!tukhainSariinMur) ajillakhGereenuud.push(x);
      }
      var khariu = [];
      var object;
      var duusakhOgnoo = new Date(req.body.duusakhOgnoo);
      duusakhOgnoo.setHours(0, 0, 0, 0);
      if (gereenuud)
        for await (const element of ajillakhGereenuud) {
          object = {
            tulukhDun: element.sariinTurees,
            undsenDun: element.sariinTurees,
            ognoo: moment(req.body.duusakhOgnoo).set(
              "date",
              element.tulukhUdur[0]
            ),
            khyamdral: 0,
          };
          await Geree(req.body.tukhainBaaziinKholbolt)
            .updateOne(
              { _id: element._id },
              {
                $push: {
                  ["avlaga.guilgeenuud"]: object,
                },
              }
            )
            .then(async (result) => {
              khariu.push(result);
            });
        }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.gereenuudedZalruulgaOruulya = asyncHandler(async (req, res, next) => {
  try {
    var bodokhOgnoo = new Date(req.body.bodokhOgnoo);
    var oruulakhOgnoo = new Date(req.body.oruulakhOgnoo);
    var baiguullagiinId = req.body.baiguullagiinId;
    var barilgiinId = req.body.barilgiinId;
    var zoruu = 0;
    objectuud = req.body.objectuud;
    var khariu = [];
    var object;
    if (
      !req.body.bodokhOgnoo ||
      !req.body.oruulakhOgnoo ||
      !req.body.barilgiinId ||
      !req.body.oruulakhOgnoo ||
      !req.body.objectuud
    )
      throw new Error("Талбар дутуу!");
    if (objectuud)
      for await (const element of objectuud) {
        var geree = await Geree(
          req.body.tukhainBaaziinKholbolt,
          true
        ).aggregate([
          {
            $unwind: {
              path: "$avlaga.guilgeenuud",
            },
          },
          {
            $match: {
              baiguullagiinId: baiguullagiinId,
              barilgiinId: barilgiinId,
              talbainDugaar: element.gereeniiDugaar,
              tuluv: 1,
              "avlaga.guilgeenuud.ognoo": {
                $lte: bodokhOgnoo,
              },
            },
          },
          {
            $project: {
              gereeniiDugaar: "$gereeniiDugaar",
              tulukhDun: {
                $subtract: [
                  {
                    $ifNull: ["$avlaga.guilgeenuud.tulukhDun", 0],
                  },
                  {
                    $sum: [
                      {
                        $ifNull: ["$avlaga.guilgeenuud.tulsunDun", 0],
                      },
                      {
                        $ifNull: ["$avlaga.guilgeenuud.khyamdral", 0],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$gereeniiDugaar",
              uldegdel: {
                $sum: "$tulukhDun",
              },
            },
          },
        ]);
        if (geree && geree.length > 0 && geree[0].uldegdel !== element.dun) {
          zoruu = element.dun - geree[0].uldegdel;
          if (zoruu !== 0) {
            object = {
              tulukhDun: zoruu > 0 ? zoruu : 0,
              tulsunDun: zoruu < 0 ? zoruu * -1 : 0,
              ognoo: oruulakhOgnoo,
              tailbar: "Залруулга гүйлгээ",
              turul: "System",
              guilgeeKhiisenAjiltniiNer: "System",
              khyamdral: 0,
            };
            await Geree(req.body.tukhainBaaziinKholbolt)
              .updateOne(
                { gereeniiDugaar: geree[0]._id },
                {
                  $push: {
                    ["avlaga.guilgeenuud"]: object,
                  },
                }
              )
              .then(async (result) => {
                khariu.push(result);
              });
          }
        }
      }
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});

exports.tsutsalsanGereenuudedZalruulgaOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var baiguullagiinId = req.body.baiguullagiinId;
      var barilgiinId = req.body.barilgiinId;
      var khariu = [];
      var match = {
        baiguullagiinId: baiguullagiinId,
        barilgiinId: barilgiinId,
        tuluv: { $in: [-1] },
      };
      var match1 = {
        "avlaga.guilgeenuud.ognoo": { $lte: new Date() },
        $or: [
          {
            "avlaga.guilgeenuud.turul": {
              $nin: ["aldangi", "baritsaa"],
            },
          },
          {
            $and: [
              {
                "avlaga.guilgeenuud.turul": {
                  $in: ["baritsaa"],
                },
              },
              {
                "avlaga.guilgeenuud.tulsunDun": {
                  $gt: 0,
                },
              },
            ],
          },
        ],
      };
      if (req.body?.gereeniiDugaar)
        match["gereeniiDugaar"] = req.body?.gereeniiDugaar;
      var gereenuud = await Geree(
        req.body.tukhainBaaziinKholbolt,
        true
      ).aggregate([
        {
          $match: match,
        },
        {
          $unwind: {
            path: "$avlaga.guilgeenuud",
          },
        },
        {
          $match: match1,
        },
        {
          $group: {
            _id: "$_id",
            tulukh: {
              $sum: {
                $ifNull: ["$avlaga.guilgeenuud.tulukhDun", 0],
              },
            },
            khyamdral: {
              $sum: {
                $ifNull: ["$avlaga.guilgeenuud.khyamdral", 0],
              },
            },
            tulsun: {
              $sum: {
                $ifNull: ["$avlaga.guilgeenuud.tulsunDun", 0],
              },
            },
          },
        },
        {
          $project: {
            uldegdel: {
              $subtract: [
                "$tulukh",
                {
                  $sum: ["$tulsun", "$khyamdral"],
                },
              ],
            },
          },
        },
      ]);
      if (gereenuud && gereenuud?.length > 0) {
        for await (const geree of gereenuud) {
          var zoruu = geree.uldegdel || 0;
          var object;
          if (zoruu !== 0) {
            object = {
              tulukhDun: zoruu < 0 ? zoruu * -1 : 0,
              tulsunDun: zoruu > 0 ? zoruu : 0,
              ognoo: new Date(),
              tailbar: "Систем залруулга гүйлгээ",
              turul: "zalruulga",
              guilgeeKhiisenAjiltniiNer: "систем",
              khyamdral: 0,
            };
            await Geree(req.body.tukhainBaaziinKholbolt)
              .findByIdAndUpdate(
                { _id: geree._id },
                {
                  $push: {
                    ["avlaga.guilgeenuud"]: object,
                  },
                }
              )
              .then(async (result) => {
                khariu.push(result);
              });
          }
        }
      }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.tsutsalgdanGuilgeeZasya = asyncHandler(async (req, res, next) => {
  try {
    var query = [
      {
        $unwind: {
          path: "$gereeniiTuukhuud",
        },
      },
      {
        $match: {
          tuluv: -1,
          "gereeniiTuukhuud.turul": "Tsutslakh",
        },
      },
      {
        $group: {
          _id: "$_id",
          ognoo: {
            $max: "$gereeniiTuukhuud.khiisenOgnoo",
          },
        },
      },
    ];
    var jagsaalt = await Geree(req.body.tukhainBaaziinKholbolt, true).aggregate(
      query
    );
    if (jagsaalt && jagsaalt.length > 0) {
      var bulkOps = [];
      for await (const x of jagsaalt) {
        let upsertDoc = {
          updateOne: {
            filter: { _id: x._id },
            update: {
              $pull: {
                "avlaga.guilgeenuud": {
                  ognoo: { $gte: x.ognoo },
                  undsenDun: { $gte: 0 },
                },
              },
            },
            multi: true,
          },
        };
        bulkOps.push(upsertDoc);
      }
      await Geree(req.body.tukhainBaaziinKholbolt)
        .bulkWrite(bulkOps)
        .then((bulkWriteOpResult) => {})
        .catch((err) => {});
      res.send(jagsaalt.length.toString());
    } else res.send("0");
  } catch (err) {
    next(err);
  }
});

exports.tukhainOgnoogoorGuilgeegOruulya = asyncHandler(
  async (req, res, next) => {
    try {
      var guilgeenuud = await BankniiGuilgee(
        req.body.tukhainBaaziinKholbolt, true
      ).find({
        tranDate: {
          $gte: new Date(req.body.ekhlekhOgnoo),
          $lte: new Date(req.body.duusakhOgnoo),
        },
        kholbosonGereeniiId: {
          $exists: true,
          $ne: null,
        },
      });
      var khariu = [];
      if (guilgeenuud) {
        for await (const guilgee of guilgeenuud) {
          var geree = await Geree(
            req.body.tukhainBaaziinKholbolt,
            true
          ).findOne({
            _id: guilgee.kholbosonGereeniiId,
            "avlaga.guilgeenuud.guilgeeniiId": { $nin: [guilgee._id] },
          });
          var oroxGuilgee = {
            dansniiDugaar: guilgee.dansniiDugaar,
            guilgeeniiId: guilgee._id,
            ognoo: guilgee.tranDate,
            tulsunDans: guilgee.relatedAccount,
            tulsunDun: guilgee.amount,
            turul: "bank",
          };
          oroxGuilgee.guilgeeKhiisenOgnoo = new Date();
          if (req.body.nevtersenAjiltniiToken) {
            oroxGuilgee.guilgeeKhiisenAjiltniiNer =
              req.body.nevtersenAjiltniiToken.ner;
            oroxGuilgee.guilgeeKhiisenAjiltniiId =
              req.body.nevtersenAjiltniiToken.id;
          }
          if (geree) {
            await Geree(req.body.tukhainBaaziinKholbolt)
              .findByIdAndUpdate(
                { _id: geree._id },
                {
                  $push: {
                    [`avlaga.guilgeenuud`]: oroxGuilgee,
                  },
                }
              )
              .then((result) => {
                khariu.push(result);
              })
              .catch((err) => {
                next(err);
              });
          }
        }
      }
      res.send(khariu);
    } catch (err) {
      next(err);
    }
  }
);

exports.testiinBankniiGuilgee = asyncHandler(async (req, res, next) => {
  try {
    if (!req.body.dans || !req.body.barilgiinId)
      throw new Error("dans, barilgiinId alga!");
    var guilgeenuud = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt, true
    ).find({
      createdAt: {
        $gte: new Date(req.body.ekhlekhOgnoo),
        $lte: new Date(req.body.duusakhOgnoo),
      },
      dansniiDugaar: req.body.dans,
    });
    if (guilgeenuud) {
      for await (const guilgee of guilgeenuud) {
        guilgee._id = null;
        guilgee.baiguullagiinId = req.body.baiguullagiinId;
        guilgee.barilgiinId = req.body.barilgiinId;
        guilgee.kholbosonGereeniiId = [];
        guilgee.kholbosonDun = 0;
        guilgee.zardliinBulgiinId = null;
        guilgee.zardliinBulgiinNer = null;
        guilgee.kholbosonTalbainId = [];
      }
    }
    var khariu = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt
    ).insertMany(guilgeenuud);
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});

exports.testiinBankniiGuilgeeOruulya = asyncHandler(async (req, res, next) => {
  try {
    if (!req.body.dans || !req.body.barilgiinId)
      throw new Error("dans, barilgiinId alga!");
    var guilgeenuud = [];
    var guilgee = new BankniiGuilgee(req.body.tukhainBaaziinKholbolt)();
    for (let i = 1; i <= 10; i++) {
      guilgee = new BankniiGuilgee(req.body.tukhainBaaziinKholbolt)();
      if (req.body.bank == "tdb") {
        guilgee.TxDt = req.body.ognoo;
        guilgee.TxPostDate = req.body.ognoo;
        guilgee.CtAcct = "5012345678";
        guilgee.CtActnName = "TEST DANS";
        guilgee.Amt = i < 6 ? i * 100000 : i * -100000;
        guilgee.TxAddInf = "Test " + i.toString();
        guilgee.CtAcntOrg = "TEST DANS";
      } else {
        guilgee.tranDate = req.body.ognoo;
        guilgee.postDate = req.body.ognoo;
        guilgee.code = i;
        guilgee.record = i;
        guilgee.amount = i < 6 ? i * 100000 : i * -100000;
        guilgee.balance = i * 100000;
        guilgee.debit = 0;
        guilgee.correction = 0;
        guilgee.description = "Test " + i.toString();
        guilgee.relatedAccount = "5012345678";
      }
      guilgee.baiguullagiinId = req.body.baiguullagiinId;
      guilgee.barilgiinId = req.body.barilgiinId;
      guilgee.kholbosonGereeniiId = [];
      guilgee.kholbosonDun = 0;
      guilgee.zardliinBulgiinId = null;
      guilgee.zardliinBulgiinNer = null;
      guilgee.kholbosonTalbainId = [];
      guilgee.dansniiDugaar = req.body.dans;
      guilgeenuud.push(guilgee);
    }
    var khariu = await BankniiGuilgee(
      req.body.tukhainBaaziinKholbolt
    ).insertMany(guilgeenuud);
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});

exports.gereeAutomataarSungaya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var kholboltuud = db.kholboltuud;
    if (kholboltuud) {
      for await (const kholbolt of kholboltuud) {
        var baiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({
          "tokhirgoo.gereeAvtomataarSungakhEsekh": true,
        });
        var tulultiinJagsaalt = [];
        if (baiguullaguud)
          for await (const baiguullaga of baiguullaguud) {
            var gereenuud = await Geree(kholbolt, true).find({
              tuluv: {
                $ne: -1,
              },
              baiguullagiinId: baiguullaga._id,
              duusakhOgnoo: {
                $lte: new Date(),
              },
            });
            if (gereenuud) {
              for await (const geree of gereenuud) {
                tulultiinJagsaalt = [];
                var shineDuusakhOgnoo = new Date(
                  moment(geree.duusakhOgnoo).add(geree.khugatsaa, "month")
                );
                await new Array(geree.khugatsaa).fill("").map((mur, index) => {
                  geree.tulukhUdur.forEach((udur) => {
                    var ognoo = new Date();
                    var uusgexOgnoo = moment(ognoo)
                      .add(index, "month")
                      .set("date", udur);
                    if (uusgexOgnoo <= moment(geree.duusakhOgnoo))
                      tulultiinJagsaalt.push({
                        ognoo: moment(ognoo)
                          .add(index, "month")
                          .set("date", udur),
                        khyamdral: 0,
                        undsenDun: geree.sariinTurees,
                        tulukhDun: geree.sariinTurees,
                      });
                  });
                });
                var shineDuusakhOgnoo = new Date(
                  moment(geree.duusakhOgnoo).add(geree.khugatsaa, "month")
                );
                if (tulultiinJagsaalt)
                  await Geree(kholbolt)
                    .findByIdAndUpdate(
                      { _id: geree._id },
                      {
                        $push: {
                          [`avlaga.guilgeenuud`]: {
                            $each: tulultiinJagsaalt,
                          },
                          [`gereeniiTuukhuud`]: geree,
                        },
                        $set: {
                          duusakhOgnoo: shineDuusakhOgnoo,
                        },
                      }
                    )
                    .catch((err) => {
                      if (next) next(err);
                    });
              }
            }
          }
      }
    }
    if (res) res.send(khariu);
  } catch (err) {
    if (next) next(err);
  }
});

async function daraagiinTulukhOgnooZasya(gereeniiId, tukhainBaaziinKholbolt) {
  var geree = await Geree(tukhainBaaziinKholbolt, true)
    .findById(gereeniiId)
    .select("avlaga");
  var jagsaalt = [];
  if (lodash.isArray(lodash.get(geree, "avlaga.guilgeenuud"))) {
    jagsaalt = lodash.get(geree, "avlaga.guilgeenuud");
  }
  jagsaalt = lodash.filter(jagsaalt, (a) => a.turul != "baritsaa");
  var niitTulsunDun = lodash.sumBy(jagsaalt, function (object) {
    if (object.ognoo < new Date()) return object.tulsunDun;
    else return 0;
  });
  var niitKhyamdral = lodash.sumBy(jagsaalt, function (object) {
    if (object.ognoo < new Date()) return object.khyamdral;
    else return 0;
  });
  niitTulsunDun = niitTulsunDun + niitKhyamdral;
  jagsaalt = lodash.filter(jagsaalt, (a) => a.tulukhDun != null);
  jagsaalt = lodash.orderBy(jagsaalt, ["ognoo"], ["asc"]);
  var tulukhOgnoo;
  if (jagsaalt && jagsaalt.length > 0) tulukhOgnoo = jagsaalt[0].ognoo;
  jagsaalt.forEach((element) => {
    if (niitTulsunDun >= 0) {
      tulukhOgnoo = element.ognoo;
      niitTulsunDun = niitTulsunDun - element.tulukhDun;
    }
  });
  Geree(tukhainBaaziinKholbolt)
    .findByIdAndUpdate(gereeniiId, {
      $set: { daraagiinTulukhOgnoo: tulukhOgnoo },
    })
    .then((result) => {})
    .catch((err) => {});
}

exports.tulukhOgnooZasya = asyncHandler(async (req, res, next) => {
  try {
    var idnuud = req.body.idnuud;
    for await (const id of idnuud) {
      await daraagiinTulukhOgnooZasya(id, req.body.tukhainBaaziinKholbolt);
    }
    res.send("Amjilttai");
  } catch (err) {
    if (next) next(err);
  }
});

exports.gereenuudedAvlagaOruulya = asyncHandler(async (req, res, next) => {
  try {
    var oruulakhOgnoo = new Date(req.body.oruulakhOgnoo);
    var objectuud = req.body.objectuud;
    var turul = req.body.turul ? req.body.turul : "khuvaari";
    var khariu = [];
    var object;
    if (!req.body.oruulakhOgnoo || !req.body.objectuud)
      throw new Error("Талбар дутуу!");
    if (objectuud)
      for await (const element of objectuud) {
        var geree = await Geree(req.body.tukhainBaaziinKholbolt, true)
          .findOne({
            gereeniiDugaar: element.gereeniiDugaar,
            tuluv: 1,
          })
          .select("+avlaga");
        var baigaa = geree?.avlaga?.guilgeenuud?.find((a) => {
          return (
            a.turul == turul &&
            a.tulukhDun == element.dun &&
            a.ognoo == oruulakhOgnoo
          );
        });
        if (geree && !baigaa) {
          object = {
            tulukhDun: element.dun,
            ognoo: oruulakhOgnoo,
            negj: element.negj,
            khemjikhNegj: element?.khemjikhNegj,
            tariff: element?.tariff,
            suuliinZaalt: element.suuliinZaalt ? element.suuliinZaalt : 0,
            umnukhZaalt: element.umnukhZaalt ? element.umnukhZaalt : 0,
            tailbar: element.tailbar,
            turul,
          };
          await Geree(req.body.tukhainBaaziinKholbolt)
            .updateOne(
              { gereeniiDugaar: geree.gereeniiDugaar, tuluv: 1 },
              {
                $push: {
                  ["avlaga.guilgeenuud"]: object,
                },
              }
            )
            .then(async (result) => {
              khariu.push(result);
            });
        }
      }
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});

exports.khungulultNukhujOruulya = asyncHandler(async (req, res, next) => {
  try {
    var khariu = [];
    var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
      .find({
        tuluv: 1,
        "avlaga.guilgeenuud.khyamdral": { $gt: 0 },
      })
      .select("+avlaga")
      .lean();
    if (gereenuud)
      for await (const geree of gereenuud) {
        if (geree) {
          var objectuud = [];
          if (geree?.avlaga?.guilgeenuud) {
            var guilgeenuud = geree.avlaga.guilgeenuud.filter(
              (x) => x.ognoo < new Date(2024, 0, 2) && x.khyamdral > 0
            );
            if (!!guilgeenuud) {
              for await (const mur of guilgeenuud) {
                objectuud.push({
                  ognoo: new Date(2023, 11, 1),
                  khyamdral: mur.khyamdral,
                  tailbar: mur.tailbar,
                  nemeltTailbar: mur.nemeltTailbar,
                  turul: "khungulult",
                });
              }
            }
          }
          if (objectuud && objectuud.length > 0) {
            await Geree(req.body.tukhainBaaziinKholbolt)
              .updateOne(
                { gereeniiDugaar: geree.gereeniiDugaar, tuluv: 1 },
                {
                  $push: {
                    ["avlaga.guilgeenuud"]: {
                      $each: objectuud,
                    },
                  },
                }
              )
              .then(async (result) => {
                khariu.push(result);
              });
          }
        }
      }
    res.send(khariu);
  } catch (err) {
    next(err);
  }
});

exports.talbainKubeOruulya = asyncHandler(async (req, res, next) => {
  try {
    var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
      .find({
        tuluv: 1,
        "zardluud.turul": "1м3/талбай",
        talbainKhemjeeMetrKube: { $exists: false },
      })
      .lean();
    if (gereenuud)
      for await (const geree of gereenuud) {
        var talbai = await Talbai(req.body.tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: geree.baiguullagiinId,
          kod: geree.talbainDugaar,
        });
        if (!!talbai) {
          await Geree(req.body.tukhainBaaziinKholbolt).updateOne(
            { _id: geree._id },
            { talbainKhemjeeMetrKube: talbai.talbainKhemjeeMetrKube }
          );
        }
      }
    res.send({ too: gereenuud.length });
  } catch (err) {
    next(err);
  }
});

exports.gereenuudZasya = asyncHandler(async (req, res, next) => {
  try {
    var query = { tuluv: { $ne: -1 } };
    if (req.body.gereeniiDugaaruud?.length > 0)
      query["gereeniiDugaar"] = { $in: req.body.gereeniiDugaaruud };
    var gereenuud = await Geree(req.body.tukhainBaaziinKholbolt, true)
      .find(query)
      .select("+avlaga +gereeniiTuukhuud");
    if (gereenuud) {
      var ashiglaltiinZardluud = await AshiglaltiinZardluud(
        req.body.tukhainBaaziinKholbolt
      ).find({
        baiguullagiinId: req.body.baiguullagiinId,
      });
      for await (const geree of gereenuud) {
        var talbai = await Talbai(req.body.tukhainBaaziinKholbolt).findOne({
          baiguullagiinId: geree.baiguullagiinId,
          kod: geree.talbainDugaar,
        });
        if (!!geree.zardluud && !!ashiglaltiinZardluud) {
          for await (const zardal of geree.zardluud) {
            var tukhainZardal = ashiglaltiinZardluud.find(
              (x) => x.ner == zardal.ner
            );
            if (!!tukhainZardal) {
              zardal.turul = tukhainZardal.turul;
              zardal.tariff = tukhainZardal.tariff;
              zardal.suuriKhuraamj = tukhainZardal.suuriKhuraamj;
            }
          }
        }
        var khuvaariud = geree.avlaga.guilgeenuud;
        khuvaariud = khuvaariud.filter(
          (x) =>
            x.ognoo < moment().startOf("month") ||
            x.turul == "khyamdral" ||
            !!x.guilgeeKhiisenAjiltniiId ||
            !!x.guilgeeKhiisenOgnoo
        );
        var today = new Date();
        var unuudur = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0
        );
        new Array((geree.khugatsaa || 0) + 12).fill("").map((mur, index) => {
          geree.tulukhUdur.forEach((udur) => {
            if (
              moment(unuudur).add(index, "month").set("date", udur) <=
                moment(geree.duusakhOgnoo) &&
              moment(unuudur).add(index, "month").set("date", udur) >=
                moment().startOf("month")
            ) {
              var tukhainUdur = moment(unuudur)
                .add(index, "month")
                .set("date", udur);
              //undsen tulultiin xuwaari)
              var baigaa = khuvaariud.find((a) => {
                return (
                  a.turul == "khuvaari" &&
                  a.tulukhDun == talbai.talbainNiitUne &&
                  moment(a.ognoo).isSame(tukhainUdur, "day")
                );
              });
              if (!baigaa && talbai.talbainNiitUne > 0)
                khuvaariud.push({
                  ognoo: tukhainUdur,
                  khyamdral: 0,
                  turul: "khuvaari",
                  undsenDun: talbai.talbainNiitUne,
                  tulukhDun: talbai.talbainNiitUne,
                });
              if (!!geree.zardluud && geree.zardluud.length > 0) {
                geree.zardluud.forEach((zardal) => {
                  if (
                    zardal.turul == "1м3/талбай" &&
                    talbai.talbainKhemjeeMetrKube > 0
                  ) {
                    baigaa = khuvaariud.find((a) => {
                      return (
                        a.turul == "avlaga" &&
                        a.tulukhDun ==
                          tooZasyaSync(
                            zardal.tariff * talbai.talbainKhemjeeMetrKube
                          ) &&
                        moment(a.ognoo).isSame(tukhainUdur, "day") &&
                        a.tailbar == zardal.ner
                      );
                    });
                    if (!baigaa)
                      khuvaariud.push({
                        ognoo: tukhainUdur,
                        khyamdral: 0,
                        turul: "avlaga",
                        tailbar: zardal.ner,
                        tulukhDun: tooZasyaSync(
                          zardal.tariff * talbai.talbainKhemjeeMetrKube
                        ),
                      });
                  } else if (
                    zardal.turul == "1м2" &&
                    talbai.talbainKhemjee > 0
                  ) {
                    baigaa = khuvaariud.find((a) => {
                      return (
                        a.turul == "avlaga" &&
                        a.tulukhDun ==
                          tooZasyaSync(zardal.tariff * talbai.talbainKhemjee) &&
                        moment(a.ognoo).isSame(tukhainUdur, "day") &&
                        a.tailbar == zardal.ner
                      );
                    });
                    if (!baigaa)
                      khuvaariud.push({
                        ognoo: tukhainUdur,
                        khyamdral: 0,
                        turul: "avlaga",
                        tailbar: zardal.ner,
                        tulukhDun: tooZasyaSync(
                          zardal.tariff * talbai.talbainKhemjee
                        ),
                      });
                  } else if (zardal.turul == "Тогтмол") {
                    baigaa = khuvaariud.find((a) => {
                      return (
                        a.turul == "avlaga" &&
                        a.tulukhDun == zardal.tariff &&
                        moment(a.ognoo).isSame(tukhainUdur, "day") &&
                        a.tailbar == zardal.ner
                      );
                    });
                    if (!baigaa)
                      khuvaariud.push({
                        ognoo: tukhainUdur,
                        khyamdral: 0,
                        turul: "avlaga",
                        tailbar: zardal.ner,
                        tulukhDun: zardal.tariff,
                      });
                  }
                });
              }
            }
          });
        });
        await Geree(req.body.tukhainBaaziinKholbolt).findOneAndUpdate(
          { _id: geree._id },
          {
            $set: {
              "avlaga.guilgeenuud": khuvaariud,
              talbainDugaar: talbai.kod,
              talbainNegjUne: talbai.talbainNegjUne,
              talbainNiitUne: talbai.talbainNiitUne,
              sariinTurees: talbai.talbainNiitUne,
              talbainKhemjee: talbai.talbainKhemjee,
              davkhar: talbai.davkhar,
            },
          }
        );
      }
    }
    res.send({ too: gereenuud.length });
  } catch (err) {
    next(err);
  }
});

exports.fcZasvarKhiie = asyncHandler(async (req, res, next) => {
  try {
    var gereenuud = await TogloomiinTuv(req.body.tukhainBaaziinKholbolt)
      .find({
        "niitTulbur.turul": "khunglukh",
      })
      .select("+avlaga");
    var bulkOps = [];
    if (gereenuud)
      for await (const geree of gereenuud) {
        for await (const guilgee of geree?.niitTulbur) {
          if (guilgee.turul == "khunglukh") {
            guilgee.turul = "khungulult";
          }
        }

        let upsertDoc = {
          updateOne: {
            filter: { _id: geree._id },
            update: [
              {
                $set: {
                  niitTulbur: geree.niitTulbur,
                },
              },
            ],
          },
        };
        bulkOps.push(upsertDoc);
      }

    if (bulkOps.length > 0)
      await TogloomiinTuv(req.body.tukhainBaaziinKholbolt)
        .bulkWrite(bulkOps)
        .then((bulkWriteOpResult) => {})
        .catch((err) => {});
    res.send(bulkOps.length.toString());
  } catch (err) {
    next(err);
  }
});

exports.avlagaZasay = asyncHandler(async (req, res, next) => {
  try {
    var ObjectId = require("mongodb").ObjectId;
    var match = {
      baiguullagiinId: req.body.baiguullagiinId,
      barilgiinId: req.body.barilgiinId,
      tranDate: {
        $gte: new Date(req.body.ekhlekhOgnoo),
        $lte: new Date(req.body.duusakhOgnoo),
      },
      description: { $regex: "qpay", $options: "i" },
    };
    var tempData = await BankniiGuilgee(req.body.tukhainBaaziinKholbolt, true).find(
      match
    );
    if (tempData?.length > 0) {
      var bulkAvlaga = [];
      for (const data of tempData) {
        if (data?.kholbosonGereeniiId?.length > 0) {
          var mur = await Geree(req.body.tukhainBaaziinKholbolt, true)
            .find({
              tuluv: 1,
              baiguullagiinId: req.body.baiguullagiinId,
              _id: new ObjectId(data?.kholbosonGereeniiId[0]),
            })
            .select("+avlaga");
          if (mur?.avlaga?.guilgeenuud) {
            var shuugdsenJagsaalt = mur?.avlaga?.guilgeenuud.filter(
              (a) =>
                a.ognoo >= new Date(req.body.ekhlekhOgnoo) && a.turul === "bank"
            );
            shuugdsenJagsaalt = lodash.orderBy(
              shuugdsenJagsaalt,
              ["ognoo"],
              ["desc"]
            );
            if (shuugdsenJagsaalt?.length > 0) {
              var a = shuugdsenJagsaalt[0];
              let avlagabulk = {
                updateOne: {
                  filter: { _id: mur._id },
                  update: {
                    $pull: {
                      [`avlaga.guilgeenuud`]: {
                        _id: a._id,
                      },
                    },
                  },
                },
              };
              bulkAvlaga.push(avlagabulk);
            }
          }
        }
      }
      if (bulkAvlaga?.length > 0) {
        await Geree(req.body.tukhainBaaziinKholbolt)
          .bulkWrite(bulkAvlaga)
          .then((bulkWriteOpResult) => {})
          .catch((err) => {});
      }
      res.send(bulkAvlaga);
    }
  } catch (err) {
    next(err);
  }
});

exports.ashiglakhKhonogTootsoolokh = asyncHandler(async (req, res, next) => {
  try {
    var geree = await Geree(req.body.tukhainBaaziinKholbolt, true)
      .findById(req.body.gereeniiId)
      .select({ avlaga: 1 });
    var filteredGeree = geree.avlaga?.guilgeenuud.filter(
      (a) =>
        a.ognoo >= moment(req.body.ashiglakhEkhlekhOgnoo).startOf("month") &&
        a.ognoo <= moment(req.body.ashiglakhDuuskhOgnoo).endOf("month")
    );
    var filteredAvlagas = filteredGeree?.filter(
      (e) => e.tulukhDun > 0 && (e.turul === "khuvaari" || e.turul === "avlaga")
    );
    var lastDay = moment(req.body.ashiglakhEkhlekhOgnoo)
      .endOf("month")
      .format("DD");
    var changedAvlagas = [];
    for (const temp of filteredAvlagas) {
      temp.tulukhDun = (temp.tulukhDun * req.body.diffDay) / lastDay;
      if (temp.undsenDun > 0)
        temp.undsenDun = (temp.undsenDun * req.body.diffDay) / lastDay;
      changedAvlagas.push(temp);
    }
    var niitTulsunDun = filteredGeree
      ?.filter(
        (e) => (e.tulsunDun > 0 || e.khyamdral) && !!e.guilgeeKhiisenOgnoo
      )
      .reduce((a, b) => a + ((b.tulsunDun || 0) + (b.khyamdral || 0)), 0);
    var niitTulukhDun = changedAvlagas?.reduce(
      (a, b) => a + (b.tulukhDun || 0),
      0
    );
    var niitAvlaga =
      Number(req.body.ekhniiUldegdel || 0) + (niitTulukhDun - niitTulsunDun);
    res.send({ uldegdelAvlaga: niitAvlaga, avlagas: changedAvlagas });
  } catch (err) {
    next(err);
  }
});

module.exports.aldangiTegBolgoy = async function aldangiTegBolgoy(
  baiguullagiinId = null
) {
  try {
    const { db } = require("zevbackv2");
    var kholboltuud = db.kholboltuud;
    if (kholboltuud) {
      var query = {
        "barilguud.tokhirgoo.aldangiinKhuvi": { $gt: 0 },
      };
      if (!!baiguullagiinId) {
        var ObjectId = require("mongodb").ObjectId;
        query["_id"] = new ObjectId(baiguullagiinId);
      }
      var baiguullaguud = await Baiguullaga(db.erunkhiiKholbolt)
        .find(query)
        .lean();
      if (baiguullaguud && baiguullaguud.length > 0) {
        for await (const baiguullaga of baiguullaguud) {
          var kholbolt = kholboltuud.find(
            (a) => a.baiguullagiinId == baiguullaga._id.toString()
          );
          var bulkOps = [];
          for await (const barilga of baiguullaga.barilguud) {
            if (
              barilga.tokhirgoo &&
              barilga.tokhirgoo.aldangiinKhuvi &&
              barilga.tokhirgoo.aldangiBodojEkhlekhOgnoo &&
              barilga.tokhirgoo.aldangiBodojEkhlekhOgnoo < new Date()
            ) {
              var ognoo = new Date();
              var aldagiinKhuvi =
                barilga.tokhirgoo && barilga.tokhirgoo.aldangiinKhuvi
                  ? barilga.tokhirgoo.aldangiinKhuvi
                  : 0.5;
              var aldangiChuluulukhKhonog =
                barilga.tokhirgoo && barilga.tokhirgoo.aldangiChuluulukhKhonog
                  ? barilga.tokhirgoo.aldangiChuluulukhKhonog
                  : 0;
              var match = {
                "avlaga.guilgeenuud.ognoo": { $lte: new Date() },
                $or: [
                  {
                    "avlaga.guilgeenuud.turul": {
                      $nin: ["aldangi", "baritsaa"],
                    },
                  },
                  {
                    $and: [
                      {
                        "avlaga.guilgeenuud.turul": {
                          $in: ["baritsaa"],
                        },
                      },
                      {
                        "avlaga.guilgeenuud.tulsunDun": {
                          $gt: 0,
                        },
                      },
                    ],
                  },
                ],
              };
              var query = [
                {
                  $match: {
                    baiguullagiinId: baiguullaga._id.toString(),
                    barilgiinId: barilga._id.toString(),
                  },
                },
                {
                  $unwind: {
                    path: "$avlaga.guilgeenuud",
                  },
                },
                {
                  $match: match,
                },
                {
                  $group: {
                    _id: {
                      id: "$_id",
                      gereeniiDugaar: "$gereeniiDugaar",
                      tulukhUdur: "$tulukhUdur",
                    },
                    tulukh: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.tulukhDun", 0],
                      },
                    },
                    khyamdral: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.khyamdral", 0],
                      },
                    },
                    tulsun: {
                      $sum: {
                        $ifNull: ["$avlaga.guilgeenuud.tulsunDun", 0],
                      },
                    },
                  },
                },
                {
                  $project: {
                    uldegdel: {
                      $subtract: [
                        "$tulukh",
                        {
                          $sum: ["$tulsun", "$khyamdral"],
                        },
                      ],
                    },
                  },
                },
                {
                  $match: {
                    uldegdel: { $lte: 0 },
                  },
                },
              ];
              var gereenuud = await Geree(kholbolt, true).aggregate(query);
              if (gereenuud && gereenuud.length > 0) {
                for (const geree of gereenuud) {
                  let upsertDoc = {
                    updateOne: {
                      filter: { _id: geree._id.id },
                      update: [
                        {
                          $set: {
                            aldangiinUldegdel: 0,
                          },
                        },
                      ],
                    },
                  };
                  bulkOps.push(upsertDoc);
                }
              }
            }
          }
          if (bulkOps && bulkOps.length > 0)
            await Geree(kholbolt)
              .bulkWrite(bulkOps)
              .then((bulkWriteOpResult) => {})
              .catch((err) => {});
        }
      }
    }
  } catch (error) {}
};

exports.daraagiinTulukhOgnooZasya = async function (
  gereeniiId,
  tukhainBaaziinKholbolt
) {
  await daraagiinTulukhOgnooZasya(gereeniiId, tukhainBaaziinKholbolt);
};
