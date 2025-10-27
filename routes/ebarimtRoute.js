const express = require("express");
const router = express.Router();
const request = require("request");
const { tokenShalgakh, db, crud } = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");
const EbarimtShine = require("../models/ebarimtShine");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");

crud(router, "ebarimt", EbarimtShine);

function nuatBodyo(bodokhDun) {
  var nuatguiDun = bodokhDun / 1.1;
  return (bodokhDun - nuatguiDun).toFixed(2).toString();
}

async function nekhemjlekheesEbarimtShineUusgye(
  nekhemjlekh,
  customerNo,
  customerTin,
  merchantTin,
  districtCode,
  tukhainBaaziinKholbolt,
  nuatTulukhEsekh = true
) {
  try {

    const dun = nekhemjlekh.niitTulbur || 0;
    var ebarimt = new EbarimtShine(tukhainBaaziinKholbolt)();
    
    if (!!customerTin) {
      ebarimt.type = "B2B_RECEIPT";
      ebarimt.customerTin = customerTin;
    } else {
      ebarimt.type = "B2C_RECEIPT";
    }

    ebarimt.nekhemjlekhiinId = nekhemjlekh._id.toString();
    ebarimt.baiguullagiinId = nekhemjlekh.baiguullagiinId;
    ebarimt.barilgiinId = nekhemjlekh.barilgiinId;
    ebarimt.gereeniiDugaar = nekhemjlekh.gereeniiDugaar;
    ebarimt.utas = nekhemjlekh.utas?.[0] || "";
    
    ebarimt.totalAmount = dun.toFixed(2);
    ebarimt.totalVAT = !!nuatTulukhEsekh ? nuatBodyo(dun) : 0;
    ebarimt.totalCityTax = "0.00";
    ebarimt.branchNo = "001";
    ebarimt.districtCode = districtCode;
    ebarimt.posNo = "0001";
    ebarimt.merchantTin = merchantTin;
    ebarimt.customerNo = customerNo || "";
    ebarimt.createdAt = new Date();

    ebarimt.receipts = [
      {
        totalAmount: dun.toFixed(2),
        totalVAT: !!nuatTulukhEsekh ? nuatBodyo(dun) : 0,
        totalCityTax: "0.00",
        taxType: nuatTulukhEsekh ? "VAT_ABLE" : "VAT_FREE",
        merchantTin: merchantTin,
        items: [
          {
            name: "Үл хөдлөх хөрөнгийг түрээслэх үйлчилгээ",
            barCodeType: "UNDEFINED",
            classificationCode: "7211200",
            measureUnit: "шир",
            qty: "1.00",
            unitPrice: dun.toFixed(2),
            totalVat: !!nuatTulukhEsekh ? nuatBodyo(dun) : 0,
            totalCityTax: "0.00",
            totalAmount: dun.toFixed(2)
          }
        ]
      }
    ];

    ebarimt.payments = [
      {
        code: "PAYMENT_CARD",
        paidAmount: dun.toFixed(2),
        status: "PAID"
      }
    ];

    return ebarimt;

  } catch (error) {
    console.error("❌ Create ebarimt error:", error);
    throw error;
  }
}

async function ebarimtDuudya(ugugdul, onFinish, next, shine = false) {
  try {
    if (!!shine) {
      var url = process.env.EBARIMTSHINE_TEST + "rest/receipt";
      request.post(url, { json: true, body: ugugdul }, (err, res1, body) => {
        if (err) {
          if (!!next) next(err);
        } else {
          onFinish(body, ugugdul);
        }
      });
    } else if (!!next) next(new Error("ИБаримт dll холболт хийгдээгүй байна!"));
  } catch (aldaa) {
    if (!!next) next(new Error("ИБаримт dll холболт хийгдээгүй байна!"));
  }
}

// Create e-barimt for paid invoice
router.post("/nekhemjlekhEbarimtShivye", tokenShalgakh, async (req, res, next) => {
  try {
    const nekhemjlekh = await nekhemjlekhiinTuukh(req.body.tukhainBaaziinKholbolt).findById(req.body.nekhemjlekhiinId);
    
    if (!nekhemjlekh) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (nekhemjlekh.tuluv !== "Төлсөн") {
      throw new Error("Invoice is not paid yet");
    }

    const baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );

    const tuxainSalbar = baiguullaga?.barilguud?.find(
      (e) => e._id.toString() == nekhemjlekh.barilgiinId
    )?.tokhirgoo;

    if (!tuxainSalbar) {
      throw new Error("Building configuration not found");
    }

    const nuatTulukhEsekh = !!tuxainSalbar.nuatTulukhEsekh;
    
    const ebarimt = await nekhemjlekheesEbarimtShineUusgye(
      nekhemjlekh,
      req.body.customerNo || "",
      req.body.customerTin || "",
      tuxainSalbar.merchantTin,
      tuxainSalbar.districtCode,
      req.body.tukhainBaaziinKholbolt,
      nuatTulukhEsekh
    );

    var butsaakhMethod = function (d, khariuObject) {
      try {
        if (d?.status != "SUCCESS" && !d.success) throw new Error(d.message);
        
        var shineBarimt = new EbarimtShine(req.body.tukhainBaaziinKholbolt)(d);
        shineBarimt.nekhemjlekhiinId = khariuObject._id.toString();
        shineBarimt.baiguullagiinId = khariuObject.baiguullagiinId;
        shineBarimt.barilgiinId = khariuObject.barilgiinId;
        shineBarimt.gereeniiDugaar = khariuObject.gereeniiDugaar;
        shineBarimt.utas = khariuObject.utas;
        
        shineBarimt.save().catch((err) => {
          next(err);
        });
        
        res.send(d);
      } catch (err) {
        next(err);
      }
    };

    ebarimtDuudya(ebarimt, butsaakhMethod, next, true);

  } catch (error) {
    console.error("Error creating ebarimt:", error);
    next(error);
  }
});

module.exports = router;
module.exports.nekhemjlekheesEbarimtShineUusgye = nekhemjlekheesEbarimtShineUusgye;
module.exports.ebarimtDuudya = ebarimtDuudya;
