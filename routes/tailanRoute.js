const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const {
  tailanSummary,
  tailanAvlaga,
  tailanGuilgee,
  tailanOrlogoZarlaga,
  tailanAshigAldagdal,
  tailanSariin,
  tailanUliral,
  tailanExport,
  tailanUdsanAvlaga,
  tailanTsutslasanGereeniiAvlaga,
} = require("../controller/tailan");

router.get("/tailan/summary/:baiguullagiinId", tokenShalgakh, tailanSummary);
router.post("/tailan/summary/:baiguullagiinId", tokenShalgakh, tailanSummary);
router.get("/tailan/avlaga/:baiguullagiinId", tokenShalgakh, tailanAvlaga);
router.post("/tailan/avlaga/:baiguullagiinId", tokenShalgakh, tailanAvlaga);
router.get("/tailan/guilegee/:baiguullagiinId", tokenShalgakh, tailanGuilgee);
router.post("/tailan/guilegee/:baiguullagiinId", tokenShalgakh, tailanGuilgee);
router.get(
  "/tailan/orlogo-zarlaga/:baiguullagiinId",
  tokenShalgakh,
  tailanOrlogoZarlaga
);
router.post(
  "/tailan/orlogo-zarlaga/:baiguullagiinId",
  tokenShalgakh,
  tailanOrlogoZarlaga
);
router.get(
  "/tailan/ashig-aldagdal/:baiguullagiinId",
  tokenShalgakh,
  tailanAshigAldagdal
);
router.post(
  "/tailan/ashig-aldagdal/:baiguullagiinId",
  tokenShalgakh,
  tailanAshigAldagdal
);
router.get("/tailan/sariin/:baiguullagiinId", tokenShalgakh, tailanSariin);
router.post("/tailan/sariin/:baiguullagiinId", tokenShalgakh, tailanSariin);
router.get("/tailan/uliral/:baiguullagiinId", tokenShalgakh, tailanUliral);
router.post("/tailan/uliral/:baiguullagiinId", tokenShalgakh, tailanUliral);
router.get("/tailan/export/:baiguullagiinId", tokenShalgakh, tailanExport);
router.post("/tailan/export/:baiguullagiinId", tokenShalgakh, tailanExport);

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

// Төлөгдөөгүй удсан авлага 2+ сар
router.get("/tailan/udsan-avlaga/:baiguullagiinId", tokenShalgakh, tailanUdsanAvlaga);
router.post("/tailan/udsan-avlaga/:baiguullagiinId", tokenShalgakh, tailanUdsanAvlaga);
router.get("/tailan/udsan-avlaga", tokenShalgakh, tailanUdsanAvlaga);
router.post("/tailan/udsan-avlaga", tokenShalgakh, tailanUdsanAvlaga);

// Цуцлагдсан гэрээний авлага
router.get("/tailan/tsutslasan-gereenii-avlaga/:baiguullagiinId", tokenShalgakh, tailanTsutslasanGereeniiAvlaga);
router.post("/tailan/tsutslasan-gereenii-avlaga/:baiguullagiinId", tokenShalgakh, tailanTsutslasanGereeniiAvlaga);
router.get("/tailan/tsutslasan-gereenii-avlaga", tokenShalgakh, tailanTsutslasanGereeniiAvlaga);
router.post("/tailan/tsutslasan-gereenii-avlaga", tokenShalgakh, tailanTsutslasanGereeniiAvlaga);

module.exports = router;
