const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const { tailanSummary, tailanAvlaga, tailanGuilgee, tailanOrlogoZarlaga, tailanAshigAldagdal, tailanSariin, tailanUliral, tailanExport } = require("../controller/tailan");

router.get("/tailan/summary", tokenShalgakh, tailanSummary);
router.post("/tailan/summary", tokenShalgakh, tailanSummary);
router.get("/tailan/avlaga", tokenShalgakh, tailanAvlaga);
router.post("/tailan/avlaga", tokenShalgakh, tailanAvlaga);
router.get("/tailan/guilegee", tokenShalgakh, tailanGuilgee);
router.post("/tailan/guilegee", tokenShalgakh, tailanGuilgee);
router.get("/tailan/orlogo-zarlaga", tokenShalgakh, tailanOrlogoZarlaga);
router.post("/tailan/orlogo-zarlaga", tokenShalgakh, tailanOrlogoZarlaga);
router.get("/tailan/ashig-aldagdal", tokenShalgakh, tailanAshigAldagdal);
router.post("/tailan/ashig-aldagdal", tokenShalgakh, tailanAshigAldagdal);
router.get("/tailan/sariin", tokenShalgakh, tailanSariin);
router.post("/tailan/sariin", tokenShalgakh, tailanSariin);
router.get("/tailan/uliral", tokenShalgakh, tailanUliral);
router.post("/tailan/uliral", tokenShalgakh, tailanUliral);
router.get("/tailan/export", tokenShalgakh, tailanExport);
router.post("/tailan/export", tokenShalgakh, tailanExport);

module.exports = router;

