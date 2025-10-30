const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const { tailanSummary } = require("../controller/tailan");

// Summary report
router.post("/tailan/summary", tokenShalgakh, tailanSummary);

module.exports = router;

