const express = require("express");
const router = express.Router();
const request = require("request");
const {
  tokenShalgakh,
  db,
  crud,
  khuudaslalt,
  UstsanBarimt,
  Token,
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
      const shouldUseTest = orgId && String(orgId) === "697723dc3e77b46e52ccf577";
      
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

async function ebarimtTokenAvya(baiguullagiinId, tukhainBaaziinKholbolt) {
  return new Promise((resolve, reject) => {
    const authUrl = process.env.EBARIMTSHINE_AUTH_URL || 'https://st.auth.itc.gov.mn/auth/realms/Staging/protocol/openid-connect/token';
    const clientId = process.env.EBARIMTSHINE_CLIENT_ID || 'vatps';
    const username = process.env.EBARIMTSHINE_USERNAME || 'easy-register-test';
    const password = process.env.EBARIMTSHINE_PASSWORD || '99119911';

    console.log(`🔑 [EBARIMT] Requesting new token from ${authUrl}`);

    request.post({
      url: authUrl,
      form: {
        grant_type: 'password',
        client_id: clientId,
        username: username,
        password: password,
        scope: 'profile email'
      },
      json: true
    }, (err, res, body) => {
      if (err) {
        console.error("❌ [EBARIMT] Auth request error:", err.message);
        return reject(err);
      }

      if (body && (body.error || body.error_description)) {
        console.error("❌ [EBARIMT] Auth API returned error:", body.error_description || body.error);
        return reject(new Error(body.error_description || body.error));
      }

      if (!body.access_token) {
        return reject(new Error("Access token not received from Ebarimt Auth"));
      }

      // Store in database
      Token(tukhainBaaziinKholbolt).updateOne(
        { turul: 'ebarimt', baiguullagiinId: baiguullagiinId },
        {
          ognoo: new Date(),
          token: body.access_token,
          refreshToken: body.refresh_token,
          expires_in: new Date(Date.now() + (body.expires_in || 28800) * 1000)
        },
        { upsert: true }
      ).then(() => {
        console.log("✅ [EBARIMT] New token saved to database");
        resolve(body.access_token);
      }).catch(dbErr => {
        console.error("❌ [EBARIMT] DB save error:", dbErr.message);
        // Still resolve with the token even if DB save fails
        resolve(body.access_token);
      });
    });
  });
}

async function getEbarimtToken(baiguullagiinId, tukhainBaaziinKholbolt) {
  try {
    // Check if token exists and is valid (not expiring in the next 5 minutes)
    const tokenObject = await Token(tukhainBaaziinKholbolt).findOne({
      turul: 'ebarimt',
      baiguullagiinId: baiguullagiinId,
      expires_in: { $gt: new Date(Date.now() + 5 * 60000) }
    }).lean();

    if (tokenObject && tokenObject.token) {
      console.log("✅ [EBARIMT] Using existing valid token from database");
      return tokenObject.token;
    }

    // Otherwise fetch new one
    return await ebarimtTokenAvya(baiguullagiinId, tukhainBaaziinKholbolt);
  } catch (error) {
    console.error("getEbarimtToken error:", error.message);
    throw error;
  }
}

async function easyRegisterDuudya(method, path, body, next, onFinish, baiguullagiinId = null, tukhainBaaziinKholbolt = null) {
  try {
    const orgId = baiguullagiinId;
    const shouldUseTest = orgId && String(orgId) === "697723dc3e77b46e52ccf577";
    
    const authUrl = process.env.EBARIMTSHINE_AUTH_URL || 'https://st.auth.itc.gov.mn/auth/realms/Staging/protocol/openid-connect/token';
    

    
    let baseUrl;
    // Use domain as requested
    if (shouldUseTest) {
      baseUrl = 'https://st.auth.itc.gov.mn';
    } else {
      baseUrl = process.env.EBARIMTSHINE_IP;
    }
    
    // Allow explicit override if needed
    if (process.env.EBARIMTSHINE_EASY_REGISTER_URL) {
      baseUrl = process.env.EBARIMTSHINE_EASY_REGISTER_URL;
    }
    
    // Fetch token from DB or Auth API
    let token;
    if (tukhainBaaziinKholbolt && orgId) {
      token = await getEbarimtToken(orgId, tukhainBaaziinKholbolt);
    } else {
      token = process.env.EBARIMTSHINE_TOKEN;
    }
    
    // Ensure proper slash between base URL and path
    const url = baseUrl + (path.startsWith('/') ? '' : '/') + path;
    console.log(`📧 [EASY-REGISTER] ${method} to ${url} for baiguullaga: ${orgId}`);

    const options = {
      method: method,
      url: url,
      json: true,
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (path.includes('setReturnReceipt')) {
      options.headers['X-API-KEY'] = process.env.EBARIMTSHINE_X_API_KEY || 'eaab09fdb83c4affc210b8fb96f9977db7978e8a';
    }

    if (body) options.body = body;

    request(options, (err, res, resBody) => {
      if (err) {
        console.error("❌ [EASY-REGISTER] Request error:", err.message);
        if (next) next(err);
        return;
      }
      
      console.log("📧 [EASY-REGISTER] API Response status code:", res?.statusCode);
      
      if (resBody && (resBody.error || (res?.statusCode >= 400 && resBody.msg))) {
        console.error("❌ [EASY-REGISTER] API returned error:", resBody.msg || resBody.error);
        if (next)
          next(new Error(resBody.msg || resBody.error || "Easy Register API error"));
        return;
      }
      
      onFinish(resBody);
    });
  } catch (error) {
    console.error("easyRegisterDuudya error:", error.message);
    if (next) next(error);
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

// --- Easy Register API Routes ---

// Get consumer info by identity (regNo or loginName)
router.get("/easyRegister/info/consumer/:identity", tokenShalgakh, async (req, res, next) => {
  const { identity } = req.params;
  const path = `api/easy-register/api/info/consumer/${encodeURIComponent(identity)}`;
  easyRegisterDuudya("GET", path, null, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Get foreigner info by identity (passportNo or F-register)
router.get("/easyRegister/info/foreigner/:identity", tokenShalgakh, async (req, res, next) => {
  const { identity } = req.params;
  const path = `api/easy-register/api/info/foreigner/${encodeURIComponent(identity)}`;
  easyRegisterDuudya("GET", path, null, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Get foreigner info by loginName
router.get("/easyRegister/info/foreigner/customerNo/:loginName", tokenShalgakh, async (req, res, next) => {
  const { loginName } = req.params;
  const path = `api/easy-register/api/info/foreigner/customerNo/${encodeURIComponent(loginName)}`;
  easyRegisterDuudya("GET", path, null, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Register foreigner in e-barimt system
router.post("/easyRegister/info/foreigner/:passportNo", tokenShalgakh, async (req, res, next) => {
  const { passportNo } = req.params;
  const path = `api/easy-register/api/info/foreigner/${encodeURIComponent(passportNo)}`;
  easyRegisterDuudya("POST", path, req.body, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Get profile by phone number or customer number
router.post("/easyRegister/getProfile", tokenShalgakh, async (req, res, next) => {
  const path = "api/easy-register/rest/v1/getProfile";
  easyRegisterDuudya("POST", path, req.body, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Approve QR data directly for a consumer
router.post("/easyRegister/approveQr", tokenShalgakh, async (req, res, next) => {
  const path = "api/easy-register/rest/v1/approveQr";
  easyRegisterDuudya("POST", path, req.body, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

// Set return receipt (validate cancellation)
router.post("/easyRegister/setReturnReceipt", tokenShalgakh, async (req, res, next) => {
  const path = "api/easy-register/rest/v1/setReturnReceipt";
  easyRegisterDuudya("POST", path, req.body, next, (data) => res.send(data), req.body.baiguullagiinId, req.body.tukhainBaaziinKholbolt);
});

module.exports = router;
module.exports.nekhemjlekheesEbarimtShineUusgye =
  nekhemjlekheesEbarimtShineUusgye;
module.exports.ebarimtDuudya = ebarimtDuudya;
