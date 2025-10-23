const express = require("express");
const { tokenShalgakh } = require("zevbackv2");
const router = express.Router();
const {
  createTestInvoice,
  checkTestPaymentStatus,
  getTestPayments,
  testPaymentCallback
} = require("../controller/qpayTestController");

// Create test invoice for QPay testing
router.post("/createTestInvoice", tokenShalgakh, createTestInvoice);

// Check test payment status
router.post("/checkTestPaymentStatus", tokenShalgakh, checkTestPaymentStatus);

// Get all test payments with pagination
router.get("/getTestPayments", tokenShalgakh, getTestPayments);

// QPay test callback (no auth required)
router.post("/testCallback/:baiguullagiinId", testPaymentCallback);

module.exports = router;
