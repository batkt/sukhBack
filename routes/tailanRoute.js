const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const {
  tailanOrlogoAvlaga,
  tailanSariinTulbur,
  tailanNekhemjlekhiinTuukh,
  tailanAvlagiinNasjilt,
  tailanGuitsegtgel,
  tailanUdsanAvlaga,
  tailanTsutslasanGereeniiAvlaga,
  tailanExport,
} = require("../controller/tailan");

// Өр, авлагын тайлан (оршин суугчдийн) - Байр, орц, давхар, тоогоор хайж хэн төлбөрөө төлсөн, хэн төлөөгүйг хянах
crud(router,"/tailan/orlogo-avlaga", tokenShalgakh, tailanOrlogoAvlaga);

// Сарын төлбөр тайлан (сар сараар нэмээд улиралаар шүүж харах боломжтой, хураангуй дэлгэрэнгүй)
crud(router,"/tailan/sariin-tulbur", tokenShalgakh, tailanSariinTulbur);

// Нэхэмжлэлийн түүх (Бүх үүссэн нэхэмжлэлийн жагсаалтыг хянах)
crud(router,"/tailan/nekhemjlekhiin-tuukh", tokenShalgakh, tailanNekhemjlekhiinTuukh);

// Авлагын насжилтийн тайлан (Төлөгдөөгүй төлбөрийн насжилтыг тодорхойлох)
crud(router,"/tailan/avlagiin-nasjilt", tokenShalgakh, tailanAvlagiinNasjilt);

// Гүйцэтгэлийн тайлан (Сарын төлөвлөгөөт орлого vs бодит орлого г.м ба Зардлын төсөв vs бодит зардал г.м)
crud(router,"/tailan/guitsegtgel", tokenShalgakh, tailanGuitsegtgel);

// Төлөгдөөгүй удсан авлага 2+ сар
crud(router,"/tailan/udsan-avlaga", tokenShalgakh, tailanUdsanAvlaga);

// Цуцлагдсан гэрээний авлага
crud(router,"/tailan/tsutslasan-gereenii-avlaga", tokenShalgakh, tailanTsutslasanGereeniiAvlaga);

// Тайланг excel/pdf-р татаж авах боломж
crud(router,"/tailan/export", tokenShalgakh, tailanExport);

module.exports = router;
