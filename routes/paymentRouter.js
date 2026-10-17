import express from "express";

import {
  initiateProductPayment,
  initiateCustomPayment,
  payHereNotify,
  getPaymentStatus,
} from "../controller/paymentController.js";

const paymentRouter = express.Router();

// =====================================================
// PRODUCT ORDER PAYMENT
// POST /api/payments/product/initiate
// =====================================================

paymentRouter.post("/product/initiate", initiateProductPayment);

// =====================================================
// CUSTOM ORDER PAYMENT
// POST /api/payments/custom/initiate
// =====================================================

paymentRouter.post("/custom/initiate", initiateCustomPayment);

// =====================================================
// PAYHERE CALLBACK
//
// POST /api/payments/payhere/notify
//
// PayHere calls this route directly.
// No customer JWT is required.
//
// Body:
// application/x-www-form-urlencoded
//
// express.urlencoded() is already configured
// globally inside index.js.
// =====================================================

paymentRouter.post("/payhere/notify", payHereNotify);

// =====================================================
// PAYMENT STATUS
//
// GET /api/payments/status/:paymentReference
//
// Used by PaymentSuccessPage.jsx
// to verify the real backend payment state.
// =====================================================

paymentRouter.get("/status/:paymentReference", getPaymentStatus);

export default paymentRouter;
