const express = require("express");
const { tokenShalgakh } = require("zevbackv2");
const router = express.Router();
const {
  createTestInvoice,
  checkTestPaymentStatus,
  getTestPayments,
  testPaymentCallback
} = require("../controller/qpayTestController");

// Create test invoice for QPay testing (no auth for testing)
router.post("/createTestInvoice", createTestInvoice);

// Check test payment status (no auth for testing)
router.post("/checkTestPaymentStatus", checkTestPaymentStatus);

// Get all test payments with pagination (no auth for testing)
router.get("/getTestPayments", getTestPayments);

// QPay test callback (no auth required)
router.post("/testCallback/:baiguullagiinId", testPaymentCallback);

module.exports = router;
