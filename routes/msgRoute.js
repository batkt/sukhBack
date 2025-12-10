const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");
const request = require("request");
const { tokenShalgakh, db } = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");
const MsgTuukh = require("../models/msgTuukh");

function msgIlgeeye(
  jagsaalt,
  key,
  dugaar,
  khariu,
  index,
  next,
  req,
  res,
  kholbolt,
  baiguullagiinId,
  barilgiinId
) {
  try {
    const url = encodeURI(
      `${process.env.MSG_SERVER}/send?key=${key}&from=${dugaar}&to=${jagsaalt[index].to}&text=${jagsaalt[index].text}`
    );

    request(url, { json: true }, async (err1, _, body) => {
      if (err1) {
        next(err1);
      } else {
        const MsgTuukhModel = MsgTuukh(kholbolt);
        await MsgTuukhModel.create({
          baiguullagiinId: baiguullagiinId,
          barilgiinId: barilgiinId,
          dugaar: [jagsaalt[index].to],
          gereeniiId: jagsaalt[index].gereeniiId,
          msg: jagsaalt[index].text,
          msgIlgeekhKey: key,
          msgIlgeekhDugaar: dugaar,
        });

        if (jagsaalt.length > index + 1) {
          khariu.push(body[0]);
          msgIlgeeye(
            jagsaalt,
            key,
            dugaar,
            khariu,
            index + 1,
            next,
            req,
            res,
            kholbolt,
            baiguullagiinId,
            barilgiinId
          );
        } else {
          khariu.push(body[0]);
          res.send(khariu);
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

async function msgIlgeeyeUnitel(
  jagsaalt,
  key,
  dugaar,
  khariu,
  _index,
  next,
  _req,
  res,
  kholbolt,
  baiguullagiinId,
  barilgiinId
) {
  try {
    for (const data of jagsaalt) {
      const form = new FormData();
      form.append("token_id", key);
      form.append("extension_number", "11");
      form.append("sms_number", dugaar);
      form.append("to", data.to.toString());
      form.append("body", data.text.toString());

      const resp = await axios.post(
        "https://pbxuc.unitel.mn/hodupbx_api/v1.4/sendSms",
        form,
        { headers: form.getHeaders() }
      );

      if (resp?.data?.status === "SUCCESS") {
        const MsgTuukhModel = MsgTuukh(kholbolt);
        await MsgTuukhModel.create({
          baiguullagiinId: baiguullagiinId,
          barilgiinId: barilgiinId,
          dugaar: [data.to],
          gereeniiId: data.gereeniiId,
          msg: data.text,
          msgIlgeekhKey: key,
          msgIlgeekhDugaar: dugaar,
        });

        khariu.push(resp.data);
      }
    }
    res.send(khariu?.length > 0 ? [khariu[0]] : []);
  } catch (err) {
    next(err);
  }
}

router.route("/msgIlgeeye").post(tokenShalgakh, async (req, res, next) => {
  try {
    const { baiguullagiinId, barilgiinId, msgnuud } = req.body;

    if (!baiguullagiinId) {
      return res.status(400).json({
        message: "baiguullagiinId is required",
      });
    }

    const kholbolt = db.kholboltuud.find(
      (k) => String(k.baiguullagiinId) === String(baiguullagiinId)
    );

    if (!kholbolt) {
      return res.status(400).json({
        message: "Тохиргоо хийгдээгүй байна!",
      });
    }

    const BaiguullagaModel = Baiguullaga(kholbolt);
    const baiguullaga = await BaiguullagaModel.findById(baiguullagiinId);

    const msgIlgeekhKey = "g25dFjT1y1upZLYR";
    const msgIlgeekhDugaar = "72002002";

    if (!msgnuud || msgnuud.length === 0) {
      return res.status(400).json({
        message: "msgnuud is required",
      });
    }

    const khariu = [];

    if (msgIlgeekhKey === "g25dFjT1y1upZLYR") {
      await msgIlgeeyeUnitel(
        msgnuud,
        msgIlgeekhKey,
        msgIlgeekhDugaar,
        khariu,
        0,
        next,
        req,
        res,
        kholbolt,
        baiguullagiinId,
        barilgiinId
      );
    } else {
      msgIlgeeye(
        msgnuud,
        msgIlgeekhKey,
        msgIlgeekhDugaar,
        khariu,
        0,
        next,
        req,
        res,
        kholbolt,
        baiguullagiinId,
        barilgiinId
      );
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
