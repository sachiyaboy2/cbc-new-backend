import express from "express";

import {
  initiateProductPayment,
  initiateCustomPayment,
  getPaymentStatus,
} from "../controller/paymentController.js";

const paymentRouter = express.Router();

// =====================================================
// PRODUCT ORDER PAYMENT
// =====================================================

paymentRouter.post("/product/initiate", initiateProductPayment);

// =====================================================
// CUSTOM ORDER PAYMENT
// =====================================================

paymentRouter.post("/custom/initiate", initiateCustomPayment);

// =====================================================
// TEMPORARY BACKWARD-COMPATIBILITY ALIASES
//
// These can be removed later after every deployed
// frontend is using the generic routes above.
// =====================================================

paymentRouter.post("/payments-lk/product/initiate", initiateProductPayment);

paymentRouter.post("/payments-lk/custom/initiate", initiateCustomPayment);

// =====================================================
// PAYMENT STATUS
// =====================================================

paymentRouter.get("/status/:paymentReference", getPaymentStatus);

export default paymentRouter;
