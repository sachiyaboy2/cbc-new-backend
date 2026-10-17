import express from "express";

import {
  createCustomOrder,
  getCustomOrders,
  getCustomOrderById,
  updateCustomOrderPrice,
  updateCustomOrderStatus,
  updateCustomOrderPaymentStatus,
  collectCustomOrderBalance,
} from "../controller/customOrderController.js";

const customOrderRouter = express.Router();

// =====================================================
// CREATE CUSTOM ORDER
// =====================================================

customOrderRouter.post("/", createCustomOrder);

// =====================================================
// CUSTOMER OWN ORDERS / ADMIN ALL ORDERS
// =====================================================

customOrderRouter.get("/", getCustomOrders);

// =====================================================
// ADMIN SET / UPDATE PRICE
// =====================================================

customOrderRouter.put("/price/:customOrderId", updateCustomOrderPrice);

// =====================================================
// ADMIN UPDATE ORDER STATUS
// =====================================================

customOrderRouter.put("/status/:customOrderId", updateCustomOrderStatus);

// =====================================================
// ADMIN UPDATE MANUAL PAYMENT STATUS
// =====================================================

customOrderRouter.put(
  "/payment/:customOrderId",
  updateCustomOrderPaymentStatus,
);

// =====================================================
// ADMIN COLLECT REMAINING 50% BALANCE
// =====================================================

customOrderRouter.put("/balance/:customOrderId", collectCustomOrderBalance);

// =====================================================
// GET ONE CUSTOM ORDER
//
// Keep this dynamic route at the end.
// =====================================================

customOrderRouter.get("/:customOrderId", getCustomOrderById);

export default customOrderRouter;
