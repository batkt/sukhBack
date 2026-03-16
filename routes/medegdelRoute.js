const express = require("express");
const router = express.Router();
const { tokenShalgakh, crud, db } = require("zevbackv2");
const Sonorduulga = require("../models/medegdel");
const {
  medegdelIlgeeye,
  medegdelAvya,
  medegdelNegAvya,
  medegdelZasah,
  medegdelUstgakh,
  medegdelUnreadCount,
  medegdelUnreadList,
  medegdelKharsanEsekh,
  medegdelThread,
  medegdelUserReply,
  medegdelAdminReply,
  medegdelUploadChatFile,
} = require("../controller/medegdel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getMedegdelPublicRoot } = require("../config/medegdelPaths");

// Same root as chat uploads so both medegdel- and chat- files are served from one place
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { baiguullagiinId } = req.body;
    const root = getMedegdelPublicRoot();
    const dir = baiguullagiinId ? path.join(root, baiguullagiinId) : root;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "medegdel-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for phone photos (was 5MB - caused 413)
});

// Chat file upload: same root as serve (config/medegdelPaths.js); set MEDEGDEL_UPLOAD_ROOT in production
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baiguullagiinId = req.body.baiguullagiinId;
    const root = getMedegdelPublicRoot();
    const dir = baiguullagiinId ? path.join(root, baiguullagiinId) : root;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || (file.mimetype && file.mimetype.includes("audio") ? ".webm" : ".jpg");
    cb(null, "chat-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});
// 20MB – nginx must have client_max_body_size 20M or uploads get 413 (see nginx.conf.example)
const uploadChatFile = multer({ storage: chatStorage, limits: { fileSize: 20 * 1024 * 1024 } });

router.route("/medegdelIlgeeye").post(tokenShalgakh, upload.array("zurag", 10), medegdelIlgeeye);
router.post("/medegdel/uploadChatFile", tokenShalgakh, uploadChatFile.single("file"), medegdelUploadChatFile);

// Image serving route removed (moved to index.js)


// IMPORTANT: These must be before /medegdel/:baiguullagiinId/:ner so /medegdel/thread/:id is not matched as image
router.get("/medegdel/unreadCount", tokenShalgakh, medegdelUnreadCount);
router.get("/medegdel/unreadList", tokenShalgakh, medegdelUnreadList);
router.get("/medegdel/thread/:id", tokenShalgakh, medegdelThread);
router.post("/medegdel/reply", tokenShalgakh, medegdelUserReply);
router.post("/medegdel/adminReply", tokenShalgakh, medegdelAdminReply);
router.patch("/medegdel/:id/kharsanEsekh", tokenShalgakh, medegdelKharsanEsekh);
router.get("/medegdel", tokenShalgakh, medegdelAvya);
router.get("/medegdel/:id", tokenShalgakh, medegdelNegAvya);
router.put("/medegdel/:id", tokenShalgakh, medegdelZasah);
router.delete("/medegdel/:id", tokenShalgakh, medegdelUstgakh);

// Route for serving images removed (centralized in index.js)


module.exports = router;
