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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.route("/medegdelIlgeeye").post(tokenShalgakh, upload.single("zurag"), medegdelIlgeeye);

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

// Route matching the URL structure user provided: /medegdel/:baiguullagiinId/:filename
router.get("/medegdel/:baiguullagiinId/:ner", (req, res, next) => {
  const fileName = req.params.ner;
  // Use __dirname to find public folder relative to routes folder
  const directoryPath = path.join(__dirname, "../public", "medegdel", req.params.baiguullagiinId);
  const filePath = path.join(directoryPath, fileName);
  
  console.log(`🔍 [IMAGE DEBUG] Request: ${req.originalUrl}`);
  console.log(`🔍 [IMAGE DEBUG] Params: ID=${req.params.baiguullagiinId}, File=${fileName}`);
  console.log(`🔍 [IMAGE DEBUG] Trying path: ${filePath}`);
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

router.get("/medegdel", tokenShalgakh, medegdelAvya);
router.get("/medegdel/:id", tokenShalgakh, medegdelNegAvya);
router.put("/medegdel/:id", tokenShalgakh, medegdelZasah);
router.delete("/medegdel/:id", tokenShalgakh, medegdelUstgakh);

module.exports = router;
