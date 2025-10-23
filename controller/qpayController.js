const asyncHandler = require("express-async-handler");
const { Dugaarlalt, Token, db } = require("zevbackv2");
const { QuickQpayObject } = require("quickqpaypackv2");
const Nekhemjlekh = require("../models/nekhemjlekhiinTuukh");
const Baiguullaga = require("../models/baiguullaga");
const Geree = require("../models/geree");
const got = require("got");
const { URL } = require("url");

const instance = got.extend({
  hooks: {
    beforeRequest: [
      (options) => {
        options.headers["Content-Type"] = "application/json";
        if (options.context && options.context.token) {
          options.headers["Authorization"] = options.context.token;
        }
      },
    ],
  },
});

// Simple QPay token management
async function tokenAvya(username, password, next, baiguullagiinId, tukhainBaaziinKholbolt) {
  try {
    var url = new URL(process.env.QPAY_MERCHANT_SERVER + "v2/auth/token/");
    url.username = username;
    url.password = password;
    const stringBody = JSON.stringify({ terminal_id: "95000059" });
    const response = await instance.post(url, { body: stringBody }).catch((err) => {
      throw err;
    });
    const khariu = JSON.parse(response.body);
    Token(tukhainBaaziinKholbolt)
      .updateOne(
        { turul: "qpay", baiguullagiinId: baiguullagiinId },
        {
          ognoo: new Date(),
          token: khariu.access_token,
          refreshToken: khariu.refresh_token,
        },
        { upsert: true }
      )
      .then((x) => {})
      .catch((e) => {});
    return khariu;
  } catch (error) {
    next(error);
  }
}

// Simple payment status check
async function qpayMedeelelAvya(token, qpayObject, next) {
  try {
    var url = process.env.QPAY_MERCHANT_SERVER + "v2/payment/check/";
    url = new URL(url);
    const context = { token: "Bearer " + token };
    const qpayObjectString = JSON.stringify(qpayObject);
    const response = await instance.post(url, { context, body: qpayObjectString }).catch((err) => {
      throw err;
    });
    if (!response.body) {
      if (next) {
        next(new Error("Алдаа гарлаа!"));
      } else return null;
    }
    return JSON.parse(response.body);
  } catch (error) {
    next(error);
  }
}

// Update payment records - simplified version
exports.qpayGuilgeeUtgaAvya = asyncHandler(async (req, res, next) => {
  try {
    var guilgeenuud = await QuickQpayObject(req.body.tukhainBaaziinKholbolt).find({
      tulsunEsekh: true,
      ognoo: { $gt: new Date("2023-12-02") },
    });
    
    var tokenObject = await Token(req.body.tukhainBaaziinKholbolt).findOne({
      turul: "quickQpay",
      baiguullagiinId: req.body.baiguullagiinId,
      ognoo: { $gte: new Date(new Date().getTime() - 29 * 60000) },
    });
    
    var token;
    if (!tokenObject) {
      tokenObject = await tokenAvya(
        "ZEV_TABS1",
        "PB5RcI2g",
        next,
        req.body.baiguullagiinId,
        req.body.tukhainBaaziinKholbolt
      );
      token = tokenObject.access_token;
    } else {
      token = tokenObject.token;
    }
    
    for await (const guilgee of guilgeenuud) {
      var khariu = await qpayMedeelelAvya(token, { invoice_id: guilgee.invoice_id }, next);
      if (
        !!khariu &&
        !!khariu.payments &&
        !!khariu.payments[0].transactions &&
        !!khariu.payments[0].transactions[0].id
      ) {
        await QuickQpayObject(req.body.tukhainBaaziinKholbolt).updateOne(
          { invoice_id: guilgee.invoice_id },
          { legacy_id: khariu.payments[0].transactions[0].id }
        );
      }
    }
    res.send("Amjilttai");
  } catch (err) {
    next(err);
  }
});

// Simple QPay callback handler for invoices
exports.qpayTulye = asyncHandler(async (req, res, next) => {
  try {
    var kholboltuud = db.kholboltuud;
    var tukhainBaaziinKholbolt = kholboltuud.find(
      (a) => a.baiguullagiinId == req.params.baiguullagiinId
    );
    
    var qpayBarimt = await QuickQpayObject(tukhainBaaziinKholbolt).findOne({
      zakhialgiinDugaar: req.params.dugaar,
      baiguullagiinId: req.params.baiguullagiinId,
      salbariinId: req.params.barilgiinId,
    });
    
    if (qpayBarimt) {
      if (req.query && req.query.qpay_payment_id)
        qpayBarimt.payment_id = req.query.qpay_payment_id;
      qpayBarimt.tulsunEsekh = true;
      qpayBarimt.isNew = false;
      await qpayBarimt.save();
      
      // If it's an invoice payment, update the invoice
      if (qpayBarimt.gereeniiId) {
        const nekhemjlekh = await Nekhemjlekh(tukhainBaaziinKholbolt).findById(qpayBarimt.gereeniiId);
        if (nekhemjlekh && nekhemjlekh.tuluv !== "Төлсөн") {
          nekhemjlekh.tuluv = "Төлсөн";
          nekhemjlekh.tulsunOgnoo = new Date();
          nekhemjlekh.paymentHistory.push({
            ognoo: new Date(),
            dun: qpayBarimt.qpay?.amount || nekhemjlekh.niitTulbur,
            turul: "qpay",
            guilgeeniiId: qpayBarimt._id,
            tailbar: "QPay төлбөр"
          });
          await nekhemjlekh.save();
        }
      }
      
      res.sendStatus(200);
    } else {
      res.status(404).json({ success: false, message: "QPay төлбөрийн мэдээлэл олдсонгүй!" });
    }
  } catch (err) {
    next(err);
  }
});
