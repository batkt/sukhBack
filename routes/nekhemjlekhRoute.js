const express = require("express");
const router = express.Router();
//const { crud } = require('../components/crud');
//const UstsanBarimt = require("../models/ustsanBarimt");
const { crud, UstsanBarimt } = require("zevbackv2");
const nekhemjlekhiinTuukh = require("../models/nekhemjlekhiinTuukh.js");

crud(router, "nekhemjlekhiinTuukh", nekhemjlekhiinTuukh, UstsanBarimt);



module.exports = router;
