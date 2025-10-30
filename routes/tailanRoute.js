const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const { tailanSummary, tailanAvlaga, tailanGuilgee, tailanOrlogoZarlaga, tailanAshigAldagdal, tailanSariin, tailanUliral, tailanExport } = require("../controller/tailan");

router.post("/tailan/summary", tokenShalgakh, tailanSummary);
router.post("/tailan/avlaga", tokenShalgakh, tailanAvlaga);
router.post("/tailan/guilegee", tokenShalgakh, tailanGuilgee);
router.post("/tailan/orlogo-zarlaga", tokenShalgakh, tailanOrlogoZarlaga);
router.post("/tailan/ashig-aldagdal", tokenShalgakh, tailanAshigAldagdal);
router.post("/tailan/sariin", tokenShalgakh, tailanSariin);
router.post("/tailan/uliral", tokenShalgakh, tailanUliral);
router.post("/tailan/export", tokenShalgakh, tailanExport);

module.exports = router;

