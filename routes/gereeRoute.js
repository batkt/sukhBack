const express = require("express");
const router = express.Router();
const Geree = require("../models/geree");
const { crud } = require("zevbackv2");

crud(router, "geree", Geree);

module.exports = router;
