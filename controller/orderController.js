import Order from "../models/order.js";

import Product from "../models/product.js";

import { isAdmin } from "./userController.js";

// =====================================================
// CREATE ORDER
// =====================================================

export async function createOrder(req, res) {
  try {
    // =================================================
    // CHECK USER
    // =================================================

    const user = req.user;

    if (user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =================================================
    // CUSTOMER EMAIL
    // =================================================

    const customerEmail = user.email?.toString().trim().toLowerCase();

    if (!customerEmail) {
      res.status(400).json({
        message: "User email not found",
      });

      return;
    }

    // =================================================
    // GET LAST ORDER
    // =================================================

    const lastOrder = await Order.findOne().sort({
      createdAt: -1,
    });

    // =================================================
    // CREATE NEW ORDER ID
    // =================================================

    let newOrderId = "NC000000001";

    if (lastOrder && lastOrder.orderId) {
      const lastOrderIdInString = lastOrder.orderId;

      const lastOrderNumberInString = lastOrderIdInString.replace("NC", "");

      const lastOrderNumber = parseInt(lastOrderNumberInString, 10);

      if (Number.isFinite(lastOrderNumber)) {
        const newOrderNumber = lastOrderNumber + 1;

        const newOrderNumberInString = newOrderNumber
          .toString()
          .padStart(9, "0");

        newOrderId = "NC" + newOrderNumberInString;
      }
    }

    // =================================================
    // CUSTOMER NAME
    // =================================================

    let customerName = req.body.fullName;

    if (customerName == null || customerName.toString().trim() === "") {
      customerName = user.fullName || user.firstName || "";
    }

    customerName = customerName.toString().trim();

    // =================================================
    // CUSTOMER PHONE
    //
    // Current User model uses telephone.
    // phone fallback kept for older accounts.
    // =================================================

    let customerPhone = req.body.phone;

    if (customerPhone == null || customerPhone.toString().trim() === "") {
      customerPhone = user.telephone || user.phone || "";
    }

    customerPhone = customerPhone.toString().trim();

    // =================================================
    // DELIVERY DETAILS
    // =================================================

    const address = req.body.address?.toString().trim() || "";

    const city = req.body.city?.toString().trim() || "";

    const district = req.body.district?.toString().trim() || "";

    const notes = req.body.notes?.toString().trim() || "";

    // =================================================
    // VALIDATE CUSTOMER DETAILS
    // =================================================

    if (
      customerName === "" ||
      customerPhone === "" ||
      address === "" ||
      city === "" ||
      district === ""
    ) {
      res.status(400).json({
        message: "Customer and delivery details are required",
      });

      return;
    }

    // =================================================
    // GET PRODUCTS FROM REQUEST
    // =================================================

    const itemsInRequest = req.body.products;

    if (itemsInRequest == null) {
      res.status(400).json({
        message: "Products are required",
      });

      return;
    }

    if (!Array.isArray(itemsInRequest) || itemsInRequest.length === 0) {
      res.status(400).json({
        message: "Products must be a non-empty array",
      });

      return;
    }

    // =================================================
    // PREPARE PRODUCTS
    // =================================================

    const productsToBeAdded = [];

    let total = 0;

    for (let i = 0; i < itemsInRequest.length; i++) {
      const item = itemsInRequest[i];

      // ===============================================
      // PRODUCT ID
      // ===============================================

      const productId = item.productId?.toString().trim();

      if (!productId) {
        res.status(400).json({
          message: "Product ID is required",
        });

        return;
      }

      // ===============================================
      // VALIDATE QUANTITY
      // ===============================================

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({
          message: "Product quantity must be at least 1",

          productId: productId,
        });

        return;
      }

      // ===============================================
      // FIND PRODUCT
      // ===============================================

      const product = await Product.findOne({
        productId: productId,
      });

      if (product == null) {
        res.status(400).json({
          code: "NOT_FOUND",

          message: "Product not found",

          productId: productId,
        });

        return;
      }

      // ===============================================
      // CHECK PRODUCT PRICE
      // ===============================================

      const productPrice = Number(product.price);

      if (!Number.isFinite(productPrice) || productPrice < 0) {
        res.status(400).json({
          message: "Invalid product price",

          productId: productId,
        });

        return;
      }

      // ===============================================
      // CHECK STOCK
      //
      // labelNo = stock quantity
      // ===============================================

      const availableStock = Number(product.labelNo);

      if (!Number.isFinite(availableStock) || availableStock < quantity) {
        res.status(400).json({
          code: "STOCK",

          message: "Product does not have enough stock",

          productId: productId,

          availableStock: Number.isFinite(availableStock) ? availableStock : 0,
        });

        return;
      }

      // ===============================================
      // ADD PRODUCT TO ORDER
      // ===============================================

      productsToBeAdded.push({
        productId: product.productId,

        name: product.name,

        price: productPrice,

        quantity: quantity,

        image: product.images?.[0] || "",
      });

      // ===============================================
      // CALCULATE TOTAL
      //
      // IMPORTANT:
      // Real price is always calculated from DB.
      // Frontend total is NOT trusted.
      // ===============================================

      total += quantity * productPrice;
    }

    // =================================================
    // MONEY ROUNDING
    // =================================================

    total = Math.round(total * 100) / 100;

    // =================================================
    // VALIDATE TOTAL
    // =================================================

    if (!Number.isFinite(total) || total <= 0) {
      res.status(400).json({
        message: "Invalid order total",
      });

      return;
    }

    // =================================================
    // CREATE ORDER
    // =================================================

    const newOrder = new Order({
      orderId: newOrderId,

      fullName: customerName,

      phone: customerPhone,

      email: customerEmail,

      address: address,

      city: city,

      district: district,

      notes: notes,

      products: productsToBeAdded,

      totalPrice: total,

      status: "Pending",

      // =============================================
      // PAYMENT DEFAULTS
      // =============================================

      paymentPlan: null,

      paymentStatus: "Payment Pending",

      paidAmount: 0,

      // FIX:
      // This was incorrectly `totalPrice`.
      // Current calculated variable is `total`.
      remainingAmount: total,

      balanceStatus: "Not Applicable",

      payherePaymentId: "",

      onlinePaymentAt: null,

      paymentCompletedAt: null,
    });

    // =================================================
    // SAVE ORDER
    // =================================================

    const savedOrder = await newOrder.save();

    // =================================================
    // RESPONSE
    // =================================================

    res.status(201).json({
      message: "Order created successfully",

      order: savedOrder,
    });
  } catch (err) {
    console.error("Create Order Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// GET ORDERS
//
// Admin    -> all orders
// Customer -> own orders only
// =====================================================

export async function getOrders(req, res) {
  try {
    const user = req.user;

    // =================================================
    // CHECK LOGIN
    // =================================================

    if (user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =================================================
    // ADMIN
    // =================================================

    if (user.role?.toLowerCase() === "admin") {
      const allOrders = await Order.find().sort({
        date: -1,
      });

      res.status(200).json(allOrders);

      return;
    }

    // =================================================
    // CUSTOMER EMAIL
    // =================================================

    const customerEmail = user.email?.toString().trim().toLowerCase();

    if (!customerEmail) {
      res.status(400).json({
        message: "User email not found",
      });

      return;
    }

    // =================================================
    // CUSTOMER OWN ORDERS
    // =================================================

    const orders = await Order.find({
      email: customerEmail,
    }).sort({
      date: -1,
    });

    // =================================================
    // RESPONSE
    // =================================================

    res.status(200).json(orders);
  } catch (err) {
    console.error("Get Orders Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// UPDATE ORDER STATUS
// ADMIN ONLY
// =====================================================

export async function updateOrderStatus(req, res) {
  // ===================================================
  // ADMIN CHECK
  // ===================================================

  if (!isAdmin(req)) {
    res.status(403).json({
      message: "Forbidden",
    });

    return;
  }

  // ===================================================
  // ORDER ID
  // ===================================================

  const orderId = req.params.orderId?.toString().trim();

  if (!orderId) {
    res.status(400).json({
      message: "Order ID is required",
    });

    return;
  }

  // ===================================================
  // NEW STATUS
  // ===================================================

  const newStatus = req.body.status;

  // ===================================================
  // ALLOWED STATUSES
  // ===================================================

  const allowedStatuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];

  // ===================================================
  // VALIDATE STATUS
  // ===================================================

  if (!allowedStatuses.includes(newStatus)) {
    res.status(400).json({
      message: "Invalid order status",
    });

    return;
  }

  try {
    // =================================================
    // UPDATE ORDER
    // =================================================

    const updatedOrder = await Order.findOneAndUpdate(
      {
        orderId: orderId,
      },

      {
        $set: {
          status: newStatus,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    // =================================================
    // NOT FOUND
    // =================================================

    if (updatedOrder == null) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    // =================================================
    // RESPONSE
    // =================================================

    res.status(200).json({
      message: "Order updated successfully",

      order: updatedOrder,
    });
  } catch (err) {
    console.error("Update Order Status Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}
