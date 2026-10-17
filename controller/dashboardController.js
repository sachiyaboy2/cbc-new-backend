import Order from "../models/order.js";
import CustomOrder from "../models/customOrder.js";
import User from "../models/user.js";
import Product from "../models/product.js";

import { isAdmin } from "./userController.js";

// =====================================================
// HELPER - NUMBER
// =====================================================

function safeNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

// =====================================================
// HELPER - ORDER DATE
// =====================================================

function getOrderDate(order) {
  return order.createdAt || order.date || null;
}

// =====================================================
// HELPER - PRODUCT STOCK
//
// Latest project field = labelNo
// Old schema support = lableNumber / labelNumber
// =====================================================

function getProductStock(product) {
  return safeNumber(
    product.labelNo ?? product.lableNumber ?? product.labelNumber ?? 0,
  );
}

// =====================================================
// HELPER - LAST 6 MONTHS
// =====================================================

function buildLastSixMonths() {
  const months = [];

  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

    months.push({
      year: date.getFullYear(),

      month: date.getMonth(),

      key: `${date.getFullYear()}-${date.getMonth()}`,

      label: date.toLocaleString("en-US", {
        month: "short",
      }),

      revenue: 0,

      productRevenue: 0,

      customRevenue: 0,
    });
  }

  return months;
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================

export async function getAdminDashboard(req, res) {
  try {
    // =================================================
    // ADMIN CHECK
    // =================================================

    if (!isAdmin(req)) {
      res.status(403).json({
        message: "Admin access required",
      });

      return;
    }

    // =================================================
    // LOAD ALL REQUIRED DATA
    // =================================================

    const [productOrders, customOrders, users, products] = await Promise.all([
      Order.find().lean(),

      CustomOrder.find().lean(),

      User.find().select("role isBlocked createdAt").lean(),

      Product.find().lean(),
    ]);

    // =================================================
    // USERS
    // =================================================

    const customers = users.filter((user) => user.role === "user");

    const blockedUsers = users.filter((user) => user.isBlocked === true);

    // =================================================
    // NORMAL ORDER REVENUE
    //
    // Count as actual revenue when Delivered.
    // =================================================

    const deliveredProductOrders = productOrders.filter(
      (order) => order.status === "Delivered",
    );

    const productRevenue = deliveredProductOrders.reduce((total, order) => {
      return total + safeNumber(order.totalPrice);
    }, 0);

    // =================================================
    // CUSTOM ORDER REVENUE
    //
    // Custom order counts as revenue after Paid.
    // Cancelled orders are excluded.
    // =================================================

    const paidCustomOrders = customOrders.filter(
      (order) => order.paymentStatus === "Paid" && order.status !== "Cancelled",
    );

    const customRevenue = paidCustomOrders.reduce((total, order) => {
      return total + safeNumber(order.price);
    }, 0);

    // =================================================
    // TOTAL REVENUE
    // =================================================

    const totalRevenue = productRevenue + customRevenue;

    // =================================================
    // ORDER COUNTS
    // =================================================

    const totalOrders = productOrders.length + customOrders.length;

    const activeProductOrders = productOrders.filter(
      (order) => order.status !== "Delivered" && order.status !== "Cancelled",
    ).length;

    const activeCustomOrders = customOrders.filter(
      (order) => order.status !== "Completed" && order.status !== "Cancelled",
    ).length;

    const activeOrders = activeProductOrders + activeCustomOrders;

    const completedOrders =
      productOrders.filter((order) => order.status === "Delivered").length +
      customOrders.filter((order) => order.status === "Completed").length;

    // =================================================
    // PRODUCT STOCK
    // =================================================

    const stockProducts = products.map((product) => ({
      _id: product._id,

      productId: product.productId,

      name: product.name,

      image: product.images?.[0] || "",

      price: safeNumber(product.price),

      stock: getProductStock(product),
    }));

    const lowStockProducts = stockProducts
      .filter((product) => product.stock > 0 && product.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    const outOfStockCount = stockProducts.filter(
      (product) => product.stock <= 0,
    ).length;

    const lowStockCount = stockProducts.filter(
      (product) => product.stock > 0 && product.stock <= 5,
    ).length;

    // =================================================
    // MONTHLY REVENUE - LAST 6 MONTHS
    // =================================================

    const monthlyRevenue = buildLastSixMonths();

    // PRODUCT REVENUE

    deliveredProductOrders.forEach((order) => {
      const dateValue = getOrderDate(order);

      if (!dateValue) {
        return;
      }

      const date = new Date(dateValue);

      const key = `${date.getFullYear()}-${date.getMonth()}`;

      const month = monthlyRevenue.find((item) => item.key === key);

      if (!month) {
        return;
      }

      const value = safeNumber(order.totalPrice);

      month.productRevenue += value;

      month.revenue += value;
    });

    // CUSTOM REVENUE

    paidCustomOrders.forEach((order) => {
      const dateValue = getOrderDate(order);

      if (!dateValue) {
        return;
      }

      const date = new Date(dateValue);

      const key = `${date.getFullYear()}-${date.getMonth()}`;

      const month = monthlyRevenue.find((item) => item.key === key);

      if (!month) {
        return;
      }

      const value = safeNumber(order.price);

      month.customRevenue += value;

      month.revenue += value;
    });

    // =================================================
    // COMBINED ORDER STATUS
    // =================================================

    const pendingStatusCount =
      productOrders.filter((order) => order.status === "Pending").length +
      customOrders.filter((order) => order.status === "Pending").length;

    const processingStatusCount =
      productOrders.filter(
        (order) =>
          order.status === "Confirmed" || order.status === "Processing",
      ).length +
      customOrders.filter(
        (order) =>
          order.status === "Reviewed" ||
          order.status === "Accepted" ||
          order.status === "In Progress",
      ).length;

    const shippingStatusCount =
      productOrders.filter((order) => order.status === "Shipped").length +
      customOrders.filter((order) => order.status === "Ready").length;

    const completedStatusCount = completedOrders;

    const cancelledStatusCount =
      productOrders.filter((order) => order.status === "Cancelled").length +
      customOrders.filter((order) => order.status === "Cancelled").length;

    const orderStatus = [
      {
        label: "Pending",

        count: pendingStatusCount,
      },

      {
        label: "Processing",

        count: processingStatusCount,
      },

      {
        label: "Ready / Shipped",

        count: shippingStatusCount,
      },

      {
        label: "Completed",

        count: completedStatusCount,
      },

      {
        label: "Cancelled",

        count: cancelledStatusCount,
      },
    ];

    // =================================================
    // RECENT NORMAL ORDERS
    // =================================================

    const recentProductOrders = productOrders.map((order) => ({
      id: order.orderId,

      _id: order._id,

      type: "Product",

      customer: order.fullName || "Customer",

      phone: order.phone || "",

      amount: safeNumber(order.totalPrice),

      status: order.status,

      paymentStatus: null,

      date: getOrderDate(order),
    }));

    // =================================================
    // RECENT CUSTOM ORDERS
    // =================================================

    const recentCustomOrders = customOrders.map((order) => ({
      id: order.customOrderId,

      _id: order._id,

      type: "Custom",

      customer: order.fullName || "Customer",

      phone: order.telephone || "",

      amount: safeNumber(order.price),

      status: order.status,

      paymentStatus: order.paymentStatus,

      date: getOrderDate(order),
    }));

    // =================================================
    // COMBINE RECENT ORDERS
    // =================================================

    const recentOrders = [...recentProductOrders, ...recentCustomOrders]
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;

        const dateB = b.date ? new Date(b.date).getTime() : 0;

        return dateB - dateA;
      })
      .slice(0, 8);

    // =================================================
    // RESPONSE
    // =================================================

    res.status(200).json({
      summary: {
        totalRevenue: totalRevenue,

        productRevenue: productRevenue,

        customRevenue: customRevenue,

        totalOrders: totalOrders,

        productOrders: productOrders.length,

        customOrders: customOrders.length,

        customers: customers.length,

        activeOrders: activeOrders,

        completedOrders: completedOrders,

        totalProducts: products.length,

        lowStockCount: lowStockCount,

        outOfStockCount: outOfStockCount,

        blockedUsers: blockedUsers.length,
      },

      monthlyRevenue: monthlyRevenue,

      orderStatus: orderStatus,

      recentOrders: recentOrders,

      lowStockProducts: lowStockProducts,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);

    res.status(500).json({
      message: "Failed to load dashboard",

      error: err.message,
    });
  }
}
