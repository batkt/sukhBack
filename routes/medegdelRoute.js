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

// Configure multer for image storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { baiguullagiinId } = req.body;
    const dir = `public/medegdel/${baiguullagiinId}/`;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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

// Chat file upload: same folder, filename chat-* (image or voice)
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baiguullagiinId = req.body.baiguullagiinId;
    const dir = baiguullagiinId ? `public/medegdel/${baiguullagiinId}/` : "public/medegdel/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || (file.mimetype && file.mimetype.includes("audio") ? ".webm" : ".jpg");
    cb(null, "chat-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});
// 10MB – ensure Nginx client_max_body_size is at least 10m (or 20m) or you get 413
const uploadChatFile = multer({ storage: chatStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.route("/medegdelIlgeeye").post(tokenShalgakh, upload.single("zurag"), medegdelIlgeeye);
router.post("/medegdel/uploadChatFile", tokenShalgakh, uploadChatFile.single("file"), medegdelUploadChatFile);

router.get("/medegdelZuragAvya/:baiguullagiinId/:ner", (req, res, next) => {
  const fileName = req.params.ner;
  const directoryPath = path.join(process.cwd(), "public", "medegdel", req.params.baiguullagiinId);
  const filePath = path.join(directoryPath, fileName);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: "Зураг олдсонгүй"
    });
  }
});

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

// Route matching the URL structure user provided: /medegdel/:baiguullagiinId/:ner (must be last so it doesn't catch /medegdel/thread/:id)
router.get("/medegdel/:baiguullagiinId/:ner", (req, res, next) => {
  const fileName = req.params.ner;
  // Use process.cwd() to reliably find the public folder from the project root
  const directoryPath = path.join(process.cwd(), "public", "medegdel", req.params.baiguullagiinId);
  const filePath = path.join(directoryPath, fileName);
  
  console.log(`🔍 [IMAGE DEBUG] URL: ${req.originalUrl}`);
  console.log(`🔍 [IMAGE DEBUG] Params: ID=${req.params.baiguullagiinId}, File=${fileName}`);
  console.log(`🔍 [IMAGE DEBUG] Looking for file at: ${filePath}`);
  console.log(`🔍 [IMAGE DEBUG] Exists: ${fs.existsSync(filePath)}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    // If it's not a file (e.g. API call), pass to next router/middleware
    // This is important because this route pattern might conflict with /medegdel/:id API route
    if (fileName.match(/\.(jpg|jpeg|png|gif|pdf|webp)$/i)) {
       console.log(`❌ [IMAGE DEBUG] File not found, returning 404`);
       res.status(404).json({
        success: false,
        message: "Зураг олдсонгүй"
      });
    } else {
      console.log(`➡️ [IMAGE DEBUG] Not an image, passing to next handler`);
      next();
    }
  }
});

module.exports = router;
