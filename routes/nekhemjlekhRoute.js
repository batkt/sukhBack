const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt, tokenShalgakh } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");
const nekhemjlekhController = require("../controller/nekhemjlekhController");

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);

router.post("/NekhemjlekhAvya", tokenShalgakh, nekhemjlekhController.nekhemjlekhAvya);

module.exports = router;
