const express = require("express");
const router = express.Router();
const { crud, UstsanBarimt } = require("zevbackv2");
const nekhemjlekhCron = require("../models/cronSchedule.js");

crud(router, "nekhemjlekhCron", nekhemjlekhCron, UstsanBarimt);

module.exports = router;
