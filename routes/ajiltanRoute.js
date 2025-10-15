const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const Baiguullaga = require("../models/baiguullaga");
const request = require("request");
const { UstsanBarimt } = require("zevbackv2");
const { ajiltanNevtrey } = require("../controller/ajiltan");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "./zurag/ajiltan";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Middleware to check for duplicate nevtrekhNer
const checkDuplicateNevtrekhNer = async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    
    if (req.params.id) {
      // Update mode - check for duplicates excluding current record
      const ObjectId = require("mongodb").ObjectId;
      const existingAjiltan = await ajiltanModel.findOne({
        nevtrekhNer: req.body?.nevtrekhNer,
        _id: { $ne: ObjectId(req.params.id) },
      });
      if (existingAjiltan) {
        return res.status(400).json({
          success: false,
          aldaa: "Нэвтрэх нэр давхардаж байна!"
        });
      }
    } else {
      // Create mode - check for duplicates
      if (req.body?.nevtrekhNer) {
        const existingAjiltan = await ajiltanModel.findOne({
          nevtrekhNer: req.body.nevtrekhNer,
        });
        if (existingAjiltan) {
          return res.status(400).json({
            success: false,
            aldaa: "Нэвтрэх нэр давхардаж байна!"
          });
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

// GET /ajiltan - Get all ajiltan records
router.get("/ajiltan", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    const ajiltanList = await ajiltanModel.find({});
    res.json({
      success: true,
      data: ajiltanList
    });
  } catch (error) {
    next(error);
  }
});

// GET /ajiltan/:id - Get single ajiltan record
router.get("/ajiltan/:id", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    const ajiltan = await ajiltanModel.findById(ObjectId(req.params.id));
    
    if (!ajiltan) {
      return res.status(404).json({
        success: false,
        aldaa: "Ажилтан олдсонгүй!"
      });
    }
    
    res.json({
      success: true,
      data: ajiltan
    });
  } catch (error) {
    next(error);
  }
});

// POST /ajiltan - Create new ajiltan record
router.post("/ajiltan", UstsanBarimt, upload.single("zurag"), checkDuplicateNevtrekhNer, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    
    // Handle file upload
    if (req.file) {
      req.body.zurag = req.file.filename;
    }
    
    const newAjiltan = new ajiltanModel(req.body);
    const savedAjiltan = await newAjiltan.save();
    
    res.status(201).json({
      success: true,
      data: savedAjiltan
    });
  } catch (error) {
    next(error);
  }
});

// PUT /ajiltan/:id - Update ajiltan record
router.put("/ajiltan/:id", UstsanBarimt, upload.single("zurag"), checkDuplicateNevtrekhNer, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    
    // Handle file upload
    if (req.file) {
      req.body.zurag = req.file.filename;
    }
    
    const updatedAjiltan = await ajiltanModel.findByIdAndUpdate(
      ObjectId(req.params.id),
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedAjiltan) {
      return res.status(404).json({
        success: false,
        aldaa: "Ажилтан олдсонгүй!"
      });
    }
    
    res.json({
      success: true,
      data: updatedAjiltan
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /ajiltan/:id - Delete ajiltan record
router.delete("/ajiltan/:id", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    
    const deletedAjiltan = await ajiltanModel.findByIdAndDelete(ObjectId(req.params.id));
    
    if (!deletedAjiltan) {
      return res.status(404).json({
        success: false,
        aldaa: "Ажилтан олдсонгүй!"
      });
    }
    
    res.json({
      success: true,
      data: deletedAjiltan
    });
  } catch (error) {
    next(error);
  }
});

// NevtreltiinTuukh routes
router.get("/nevtreltiinTuukh", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nevtreltiinTuukhModel = NevtreltiinTuukh(db.erunkhiiKholbolt);
    const records = await nevtreltiinTuukhModel.find({});
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.post("/nevtreltiinTuukh", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nevtreltiinTuukhModel = NevtreltiinTuukh(db.erunkhiiKholbolt);
    const newRecord = new nevtreltiinTuukhModel(req.body);
    const savedRecord = await newRecord.save();
    res.status(201).json({ success: true, data: savedRecord });
  } catch (error) {
    next(error);
  }
});

router.get("/nevtreltiinTuukh/:id", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nevtreltiinTuukhModel = NevtreltiinTuukh(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    const record = await nevtreltiinTuukhModel.findById(ObjectId(req.params.id));
    if (!record) {
      return res.status(404).json({ success: false, aldaa: "Бичлэг олдсонгүй!" });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.put("/nevtreltiinTuukh/:id", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nevtreltiinTuukhModel = NevtreltiinTuukh(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    const updatedRecord = await nevtreltiinTuukhModel.findByIdAndUpdate(
      ObjectId(req.params.id),
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedRecord) {
      return res.status(404).json({ success: false, aldaa: "Бичлэг олдсонгүй!" });
    }
    res.json({ success: true, data: updatedRecord });
  } catch (error) {
    next(error);
  }
});

router.delete("/nevtreltiinTuukh/:id", UstsanBarimt, async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const nevtreltiinTuukhModel = NevtreltiinTuukh(db.erunkhiiKholbolt);
    const ObjectId = require("mongodb").ObjectId;
    const deletedRecord = await nevtreltiinTuukhModel.findByIdAndDelete(ObjectId(req.params.id));
    if (!deletedRecord) {
      return res.status(404).json({ success: false, aldaa: "Бичлэг олдсонгүй!" });
    }
    res.json({ success: true, data: deletedRecord });
  } catch (error) {
    next(error);
  }
});

// Custom route for ajiltan login
router.post("/ajiltanNevtrey", ajiltanNevtrey);

module.exports = router;
