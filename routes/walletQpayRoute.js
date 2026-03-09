const express = require("express");
const router = express.Router();
const { tokenShalgakh } = require("zevbackv2");
const walletQpayController = require("../controller/walletQpayController");

/**
 * @route POST /api/walletQpay/create
 * @desc  Create QPay invoice for a Wallet API payment
 *        Same QPay process as original, source = WALLET_QPAY
 * @access Private (requires auth token)
 *
 * Body: { baiguullagiinId, barilgiinId?, billingId, billIds[],
 *         vatReceiveType?, dun? }
 *
 * Returns: QPay QR data (same shape as /qpayGargaya)
 *        + walletPaymentId, walletInvoiceId
 */
router.post("/walletQpay/create", tokenShalgakh, walletQpayController.createWalletQpayInvoice);

/**
 * @route GET /api/walletQpay/callback/:baiguullagiinId/:walletPaymentId
 * @desc  QPay payment callback — marks paid + calls Wallet paidByQpay
 * @access Public (called by QPay server)
 */
router.get(
  "/walletQpay/callback/:baiguullagiinId/:walletPaymentId",
  walletQpayController.walletQpayCallback
);

/**
 * @route GET /api/walletQpay/check/:baiguullagiinId/:walletPaymentId
 * @desc  Check QPay payment status (frontend polling)
 * @access Private
 */
router.get(
  "/walletQpay/check/:baiguullagiinId/:walletPaymentId",
  tokenShalgakh,
  walletQpayController.walletQpayCheck
);

module.exports = router;
