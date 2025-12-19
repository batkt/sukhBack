const express = require("express");
const router = express.Router();
const request = require("request");
const {
  tokenShalgakh,
  db,
  crud,
  khuudaslalt,
  UstsanBarimt,
} = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");
const EbarimtShine = require("../models/ebarimtShine");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh");
const { downloadEbarimtExcel } = require("../controller/excelImportController");

function nuatBodyo(bodokhDun) {
  var nuatguiDun = bodokhDun / 1.1;
  return (bodokhDun - nuatguiDun).toFixed(2).toString();
}
crud(router, "ebarimtShine", EbarimtShine, UstsanBarimt);

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
    console.log("Энэ рүү орлоо: nekhemjlekheesEbarimtShineUusgye");

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
    if (customerTin) ebarimt.customerTin = customerTin;
    ebarimt.createdAt = new Date();

    const taxType = nuatTulukhEsekh ? "VAT_ABLE" : "VAT_FREE";
    const item = {
      name: "СӨХИЙН ТӨЛБӨР",
      barCodeType: "UNDEFINED",
      classificationCode: "7211200",
      measureUnit: "шир",
      qty: "1.00",
      unitPrice: dun.toFixed(2),
      totalVat: !!nuatTulukhEsekh ? nuatBodyo(dun) : 0,
      totalCityTax: "0.00",
      totalAmount: dun.toFixed(2),
    };

    if (
      taxType === "VAT_FREE" ||
      taxType === "VAT_ZERO" ||
      taxType === "NOT_VAT"
    ) {
      item.taxProductCode = "401";
    }

    ebarimt.receipts = [
      {
        totalAmount: dun.toFixed(2),
        totalVAT: !!nuatTulukhEsekh ? nuatBodyo(dun) : 0,
        totalCityTax: "0.00",
        taxType: taxType,
        merchantTin: merchantTin,
        items: [item],
      },
    ];

    ebarimt.payments = [
      {
        code: "PAYMENT_CARD",
        paidAmount: dun.toFixed(2),
        status: "PAID",
      },
    ];

    return ebarimt;
  } catch (error) {
    console.error("Create ebarimt error:", error);
    throw error;
  }
}

async function ebarimtDuudya(ugugdul, onFinish, next, shine = false, baiguullagiinId = null) {
  try {
    if (!!shine) {
      // Check if this baiguullaga should use TEST endpoint
      // baiguullagiinId "69159a06dd2ba5c30308b90f" uses TEST, others use IP
      // Get baiguullagiinId from parameter or from ugugdul if not provided
      const orgId = baiguullagiinId || ugugdul?.baiguullagiinId;
      const shouldUseTest = orgId && String(orgId) === "69159a06dd2ba5c30308b90f";
      
      const baseUrl = shouldUseTest 
        ? process.env.EBARIMTSHINE_TEST 
        : process.env.EBARIMTSHINE_IP;
      
      var url = baseUrl + "rest/receipt";
      console.log(`📧 Sending ebarimt to ${shouldUseTest ? 'TEST' : 'PRODUCTION'} endpoint for baiguullaga: ${orgId}`);
      
      request.post(url, { json: true, body: ugugdul }, (err, res1, body) => {
        if (err) {
          console.error("❌ [EBARIMT] Request error:", err.message);
          if (next) next(err);
          return;
        }
        
        console.log("📧 [EBARIMT] API Response status code:", res1?.statusCode);
        console.log("📧 [EBARIMT] API Response body:", JSON.stringify(body, null, 2));
        
        if (body && (body.error || body.message)) {
          console.error("❌ [EBARIMT] API returned error:", body.message || body.error);
          if (next)
            next(new Error(body.message || body.error || "E-barimt API error"));
          return;
        }
        
        console.log("✅ [EBARIMT] Calling onFinish callback with response");
        onFinish(body, ugugdul);
      });
    } else if (!!next) next(new Error("ИБаримт dll холболт хийгдээгүй байна!"));
  } catch (aldaa) {
    console.error("EbarimtDuudya error:", aldaa.message);
    if (!!next) next(new Error("ИБаримт dll холболт хийгдээгүй байна!"));
  }
}

router.get("/ebarimtJagsaaltAvya", tokenShalgakh, async (req, res, next) => {
  try {
    const body = req.query;
    if (!!body?.query) body.query = JSON.parse(body.query);
    if (!!body?.order) body.order = JSON.parse(body.order);
    if (!!body?.khuudasniiDugaar)
      body.khuudasniiDugaar = Number(body.khuudasniiDugaar);
    if (!!body?.khuudasniiKhemjee)
      body.khuudasniiKhemjee = Number(body.khuudasniiKhemjee);
    if (!!body?.search) body.search = String(body.search);
    body.query && (body.query["baiguullagiinId"] = req.body.baiguullagiinId);

    const shine = true;

    khuudaslalt(EbarimtShine(req.body.tukhainBaaziinKholbolt), body)
      .then((result) => {
        res.send(result);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

router.post("/ebarimtToololtAvya", tokenShalgakh, async (req, res, next) => {
  try {
    var ebarimtShine = true;
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );
    var tuxainSalbar = baiguullaga?.barilguud?.find(
      (e) => e._id.toString() == req.body?.barilgiinId
    )?.tokhirgoo;

    var match = {
      baiguullagiinId: req.body.baiguullagiinId,
      barilgiinId: req.body.barilgiinId,
    };

    if (!!ebarimtShine) {
      match.createdAt = {
        $gte: new Date(req.body.ekhlekhOgnoo),
        $lte: new Date(req.body.duusakhOgnoo),
      };
    }

    if (req.body.barimtTurul === "nekhemjlekhiinId")
      match.nekhemjlekhiinId = { $exists: true };

    var query = [
      {
        $match: match,
      },
      {
        $facet: {
          butsaasan: [
            {
              $match: {
                ustgasanOgnoo: {
                  $exists: true,
                },
              },
            },
            {
              $group: {
                _id: "butsaasan",
                too: {
                  $sum: 1,
                },
                dun: {
                  $sum: {
                    $toDecimal: { $ifNull: ["$totalAmount", 0] },
                  },
                },
              },
            },
          ],
          ilgeesen: [
            {
              $match: {
                ustgasanOgnoo: {
                  $exists: false,
                },
              },
            },
            {
              $group: {
                _id: "ilgeesen",
                too: {
                  $sum: 1,
                },
                dun: {
                  $sum: {
                    $toDecimal: { $ifNull: ["$totalAmount", 0] },
                  },
                },
              },
            },
          ],
        },
      },
    ];

    var result = await EbarimtShine(req.body.tukhainBaaziinKholbolt)
      .aggregate(query)
      .catch((err) => {
        next(err);
      });

    var khariu = {
      ilgeesenDun: 0,
      ilgeesenToo: 0,
      butsaasanDun: 0,
      butsaasanToo: 0,
    };

    if (result[0]) {
      if (result[0].butsaasan[0]) {
        khariu.butsaasanDun = parseFloat(result[0].butsaasan[0].dun);
        khariu.butsaasanToo = result[0].butsaasan[0].too;
      }
      if (result[0].ilgeesen[0]) {
        khariu.ilgeesenDun = parseFloat(result[0].ilgeesen[0].dun);
        khariu.ilgeesenToo = result[0].ilgeesen[0].too;
      }
    }

    res.send(khariu);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/nekhemjlekhEbarimtShivye",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      console.log("Энэ рүү орлоо: nekhemjlekhEbarimtShivye");
      const nekhemjlekh = await nekhemjlekhiinTuukh(
        req.body.tukhainBaaziinKholbolt
      ).findById(req.body.nekhemjlekhiinId);

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

          var shineBarimt = new EbarimtShine(req.body.tukhainBaaziinKholbolt)(
            d
          );
          shineBarimt.nekhemjlekhiinId = khariuObject.nekhemjlekhiinId;
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

      ebarimtDuudya(ebarimt, butsaakhMethod, next, true, req.body.baiguullagiinId);
    } catch (error) {
      console.error("Error creating ebarimt:", error);
      next(error);
    }
  }
);

// Excel download route
router.post(
  "/ebarimtExcelDownload",
  tokenShalgakh,
  downloadEbarimtExcel
);

module.exports = router;
module.exports.nekhemjlekheesEbarimtShineUusgye =
  nekhemjlekheesEbarimtShineUusgye;
module.exports.ebarimtDuudya = ebarimtDuudya;
