const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const NevtreltiinTuukh = require("../models/nevtreltiinTuukh");
const BackTuukh = require("../models/backTuukh");
const Baiguullaga = require("../models/baiguullaga");
const request = require("request");
const { crudWithFile, crud, UstsanBarimt } = require("zevbackv2");
const { ajiltanNevtrey } = require("../controller/ajiltan");

console.log("=== AJILTAN ROUTE MODULE LOADED ===");

console.log("=== CALLING crudWithFile ===");
console.log("Router:", !!router);
console.log("Ajiltan model:", !!Ajiltan);
console.log("UstsanBarimt:", !!UstsanBarimt);

console.log("=== BEFORE crudWithFile CALL ===");
console.log("Router stack before:", router.stack.length);

crudWithFile(
  router,
  "ajiltan",
  Ajiltan,
  {
    fileZam: "./zurag/ajiltan",
    fileName: "zurag",
  },
  UstsanBarimt,
  async (req, res, next) => {
    try {
      console.log("=== AJILTAN MIDDLEWARE START ===");
      console.log("Request Method:", req.method);
      console.log("Request URL:", req.url);
      console.log("Request Params:", JSON.stringify(req.params));
      console.log("Request Query:", JSON.stringify(req.query));
      console.log("Request Body:", JSON.stringify(req.body));
      console.log("Request Body Type:", typeof req.body);
      console.log("Request Body is null:", req.body === null);
      console.log("Request Body is undefined:", req.body === undefined);
      
      const { db } = require("zevbackv2");
      console.log("Database connection:", !!db);
      console.log("Database erunkhiiKholbolt:", !!db.erunkhiiKholbolt);
      
      var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
      console.log("Ajiltan model created:", !!ajiltanModel);
      console.log("req.params.id:", JSON.stringify(req.params.id));
      
      if (req.params.id) {
        console.log("=== UPDATE MODE (has params.id) ===");
        var ObjectId = require("mongodb").ObjectId;
        console.log("Looking for ajiltan with nevtrekhNer:", req.body?.nevtrekhNer);
        var ajiltan = await ajiltanModel.findOne({
          nevtrekhNer: req.body?.nevtrekhNer,
          _id: { $ne: ObjectId(req.params.id) },
        });
        console.log("Found existing ajiltan:", JSON.stringify(ajiltan));
        if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
      } else {
        console.log("=== CREATE MODE (no params.id) ===");
        console.log("req.body?.nevtrekhNer:", JSON.stringify(req.body?.nevtrekhNer));
        console.log("req.body?.nevtrekhNer exists:", !!req.body?.nevtrekhNer);
        
        if (req.body?.nevtrekhNer) {
          console.log("Checking for duplicate nevtrekhNer:", req.body.nevtrekhNer);
          var ajiltan = await ajiltanModel.findOne({
            nevtrekhNer: req.body.nevtrekhNer,
          });
          console.log("Found duplicate ajiltan:", JSON.stringify(ajiltan));
          if (ajiltan) throw new Error("Нэвтрэх нэр давхардаж байна!");
        } else {
          console.log("No nevtrekhNer provided, skipping duplicate check");
        }
      }
      console.log("=== AJILTAN MIDDLEWARE SUCCESS - CALLING NEXT ===");
      next();
    } catch (error) {
      console.log("=== AJILTAN MIDDLEWARE ERROR ===");
      console.log("Error message:", error.message);
      console.log("Error stack:", error.stack);
      console.log("Full error object:", JSON.stringify(error, null, 2));
      next(error);
    }
  }
);

console.log("=== AFTER crudWithFile CALL ===");
console.log("Router stack after:", router.stack.length);
console.log("Router stack details:");
router.stack.forEach((layer, index) => {
  console.log(`Layer ${index}:`, {
    name: layer.name,
    regexp: layer.regexp ? layer.regexp.toString() : 'undefined',
    path: layer.path,
    methods: layer.methods,
    route: layer.route ? {
      path: layer.route.path,
      methods: layer.route.methods
    } : 'no route'
  });
  
  // Check if this layer has a route and if it matches /ajiltan
  if (layer.route && layer.route.path) {
    console.log(`  -> Route path: ${layer.route.path}`);
    if (layer.route.path.includes('ajiltan')) {
      console.log(`  -> *** FOUND AJILTAN ROUTE ***`);
    }
  }
});

crud(router, "nevtreltiinTuukh", NevtreltiinTuukh, UstsanBarimt);

// Custom GET route for debugging - this should work
router.get("/ajiltan", async (req, res, next) => {
  try {
    console.log("=== CUSTOM GET /ajiltan ROUTE HIT ===");
    console.log("Request Method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request Params:", JSON.stringify(req.params));
    console.log("Request Query:", JSON.stringify(req.query));
    console.log("Request Body:", JSON.stringify(req.body));
    console.log("Request Body Type:", typeof req.body);
    console.log("Request Headers:", JSON.stringify(req.headers));
    
    const { db } = require("zevbackv2");
    console.log("Database connection:", !!db);
    console.log("Database erunkhiiKholbolt:", !!db.erunkhiiKholbolt);
    
    var ajiltanModel = Ajiltan(db.erunkhiiKholbolt);
    console.log("Ajiltan model created:", !!ajiltanModel);
    
    // Get all ajiltan records
    const allAjiltan = await ajiltanModel.find({});
    console.log("Found ajiltan records count:", allAjiltan.length);
    console.log("First few records:", JSON.stringify(allAjiltan.slice(0, 3), null, 2));
    
    res.json({
      success: true,
      data: allAjiltan,
      count: allAjiltan.length,
      message: "Custom GET route working"
    });
  } catch (error) {
    console.log("=== CUSTOM GET /ajiltan ERROR ===");
    console.log("Error message:", error.message);
    console.log("Error stack:", error.stack);
    console.log("Full error object:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

router.route("/ajiltanNevtrey").post(ajiltanNevtrey);

// Debug route to test if ajiltanRoute is working
router.get("/debug", (req, res) => {
  console.log("=== DEBUG ROUTE HIT ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  res.json({ message: "Debug route working", method: req.method, url: req.url });
});

// Add a simple catch-all middleware to see what requests are hitting this router
router.use((req, res, next) => {
  console.log("=== AJILTAN ROUTER MIDDLEWARE HIT ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Path:", req.path);
  console.log("Original URL:", req.originalUrl);
  next();
});

console.log("=== AJILTAN ROUTE MODULE EXPORTED ===");
module.exports = router;
