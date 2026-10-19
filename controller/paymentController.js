import crypto from "crypto";
import { PaymentsLk } from "@payments-lk/node";

import Order from "../models/order.js";
import Payment from "../models/payment.js";
import User from "../models/user.js";
import CustomOrder from "../models/customOrder.js";

// =====================================================
// HELPERS
// =====================================================

function md5(value) {
  return crypto
    .createHash("md5")
    .update(String(value), "utf8")
    .digest("hex")
    .toUpperCase();
}

function safeCompare(valueA, valueB) {
  const a = Buffer.from(String(valueA || ""));

  const b = Buffer.from(String(valueB || ""));

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

function getPayHereActionUrl() {
  return process.env.PAYHERE_MODE?.toLowerCase() === "live"
    ? "https://www.payhere.lk/pay/checkout"
    : "https://sandbox.payhere.lk/pay/checkout";
}

function paymentConfigIsReady() {
  return Boolean(
    process.env.PAYHERE_MERCHANT_ID &&
    process.env.PAYHERE_MERCHANT_SECRET &&
    process.env.FRONTEND_URL &&
    process.env.BACKEND_PUBLIC_URL,
  );
}

function splitCustomerName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "NariCraft",
      lastName: "Customer",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  const lastName = parts.pop();

  return {
    firstName: parts.join(" "),

    lastName,
  };
}

// =====================================================
// PAYHERE PAYMENT HASH
// =====================================================

function generatePaymentHash({
  merchantId,
  orderId,
  amount,
  currency,
  merchantSecret,
}) {
  const formattedAmount = Number(amount).toFixed(2);

  const hashedSecret = md5(merchantSecret);

  return md5(merchantId + orderId + formattedAmount + currency + hashedSecret);
}

// =====================================================
// PAYHERE NOTIFICATION SIGNATURE
// =====================================================

function generateNotificationSignature({
  merchantId,
  orderId,
  amount,
  currency,
  statusCode,
  merchantSecret,
}) {
  const hashedSecret = md5(merchantSecret);

  return md5(
    merchantId + orderId + amount + currency + statusCode + hashedSecret,
  );
}

// =====================================================
// PAYMENT REFERENCE
// =====================================================

function generatePaymentReference(orderId) {
  const random = crypto.randomBytes(8).toString("hex").toUpperCase();

  return `NCR-${orderId}-${random}`;
}

// =====================================================
// NORMALIZE EMAIL
// =====================================================

function normalizeEmail(value) {
  return value?.toString().trim().toLowerCase() || "";
}

// =====================================================
// FIND ORDER USING PAYMENT TYPE
// =====================================================

async function findOrderForPayment(payment) {
  if (payment.orderType === "custom") {
    return CustomOrder.findOne({
      customOrderId: payment.orderId,
    });
  }

  return Order.findOne({
    orderId: payment.orderId,
  });
}

// =====================================================
// UPDATE ORDER USING PAYMENT TYPE
// =====================================================

async function updateOrderForPayment(payment, updateData) {
  if (payment.orderType === "custom") {
    return CustomOrder.findOneAndUpdate(
      {
        customOrderId: payment.orderId,
      },

      {
        $set: updateData,
      },

      {
        new: true,
        runValidators: true,
      },
    );
  }

  return Order.findOneAndUpdate(
    {
      orderId: payment.orderId,
    },

    {
      $set: updateData,
    },

    {
      new: true,
      runValidators: true,
    },
  );
}

// =====================================================
// GET REAL ORDER TOTAL
// =====================================================

function getOrderTotal(payment, order) {
  if (payment.orderType === "custom") {
    return Number(order.price);
  }

  return Number(order.totalPrice);
}

// =====================================================
// PRODUCT ORDER PAYMENT
//
// POST:
// /api/payments/product/initiate
// =====================================================

export async function initiateProductPayment(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    // =========================================
    // PAYHERE CONFIG
    // =========================================

    if (!paymentConfigIsReady()) {
      res.status(500).json({
        message: "Payment gateway is not configured",
      });

      return;
    }

    // =========================================
    // USER
    // =========================================

    const customerEmail = normalizeEmail(req.user.email);

    if (!customerEmail) {
      res.status(401).json({
        message: "Invalid user session",
      });

      return;
    }

    const user = await User.findOne({
      email: customerEmail,
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // REQUEST DATA
    // =========================================

    const orderId = req.body.orderId?.toString().trim();

    const paymentPlan = req.body.paymentPlan;

    if (!orderId) {
      res.status(400).json({
        message: "Order ID is required",
      });

      return;
    }

    if (paymentPlan !== "Full Payment" && paymentPlan !== "Half Payment") {
      res.status(400).json({
        message: "Invalid payment plan",
      });

      return;
    }

    // =========================================
    // ORDER
    // =========================================

    const order = await Order.findOne({
      orderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    // =========================================
    // OWNER CHECK
    // =========================================

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this order",
      });

      return;
    }

    // =========================================
    // CANCELLED
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled orders cannot be paid",
      });

      return;
    }

    // =========================================
    // ALREADY PAID
    // =========================================

    if (
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Partially Paid"
    ) {
      res.status(400).json({
        message: "This order already has a successful payment",
      });

      return;
    }

    // =========================================
    // REAL TOTAL
    //
    // NEVER TRUST FRONTEND AMOUNT
    // =========================================

    const totalPrice = Number(order.totalPrice);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Invalid order total",
      });

      return;
    }

    // =========================================
    // PAYMENT AMOUNT
    // =========================================

    const amountToPay =
      paymentPlan === "Half Payment"
        ? Math.round((totalPrice / 2) * 100) / 100
        : totalPrice;

    // =========================================
    // PAYMENT REFERENCE
    // =========================================

    const paymentReference = generatePaymentReference(order.orderId);

    // =========================================
    // PAYMENT ATTEMPT
    // =========================================

    await Payment.create({
      paymentReference,

      orderId: order.orderId,

      orderType: "product",

      paymentPlan,

      requestedAmount: amountToPay,

      currency: "LKR",

      status: "Pending",
    });

    // =========================================
    // UPDATE ORDER PAYMENT STATE
    // =========================================

    await Order.findOneAndUpdate(
      {
        orderId: order.orderId,
      },

      {
        $set: {
          paymentPlan,

          paymentStatus: "Payment Pending",

          paidAmount: 0,

          remainingAmount: totalPrice,

          balanceStatus:
            paymentPlan === "Half Payment" ? "Pending" : "Not Applicable",
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    // =========================================
    // CUSTOMER NAME
    // =========================================

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const { firstName, lastName } = splitCustomerName(
      order.fullName || user.fullName || userName,
    );

    // =========================================
    // PAYHERE DATA
    // =========================================

    const merchantId = process.env.PAYHERE_MERCHANT_ID;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    const currency = "LKR";

    const formattedAmount = amountToPay.toFixed(2);

    const hash = generatePaymentHash({
      merchantId,

      orderId: paymentReference,

      amount: amountToPay,

      currency,

      merchantSecret,
    });

    const frontendUrl = process.env.FRONTEND_URL.replace(/\/+$/, "");

    const backendUrl = process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");

    const paymentData = {
      merchant_id: merchantId,

      return_url: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
        paymentReference,
      )}`,

      cancel_url: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
        paymentReference,
      )}`,

      notify_url: `${backendUrl}/api/payments/payhere/notify`,

      first_name: firstName,

      last_name: lastName,

      email: customerEmail,

      phone: order.phone || user.telephone || user.phone || "",

      address: order.address || "",

      city: order.city || "",

      country: "Sri Lanka",

      order_id: paymentReference,

      items: `NariCraft Order ${order.orderId}`,

      currency,

      amount: formattedAmount,

      hash,
    };

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Payment request created",

      paymentReference,

      paymentPlan,

      amountToPay,

      actionUrl: getPayHereActionUrl(),

      paymentData,
    });
  } catch (err) {
    console.error("Initiate Product Payment Error:", err.message);

    res.status(500).json({
      message: "Failed to create payment request",
    });
  }
}

// =====================================================
// CUSTOM ORDER PAYMENT
//
// POST:
// /api/payments/custom/initiate
// =====================================================

export async function initiateCustomPayment(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    // =========================================
    // PAYHERE CONFIG
    // =========================================

    if (!paymentConfigIsReady()) {
      res.status(500).json({
        message: "Payment gateway is not configured",
      });

      return;
    }

    // =========================================
    // USER
    // =========================================

    const customerEmail = normalizeEmail(req.user.email);

    if (!customerEmail) {
      res.status(401).json({
        message: "Invalid user session",
      });

      return;
    }

    const user = await User.findOne({
      email: customerEmail,
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // REQUEST
    // =========================================

    const customOrderId = req.body.customOrderId?.toString().trim();

    const paymentPlan = req.body.paymentPlan;

    const deliveryAddress = req.body.deliveryAddress?.toString().trim();

    const city = req.body.city?.toString().trim();

    const district = req.body.district?.toString().trim();

    // =========================================
    // VALIDATION
    // =========================================

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    if (paymentPlan !== "Full Payment" && paymentPlan !== "Half Payment") {
      res.status(400).json({
        message: "Invalid payment plan",
      });

      return;
    }

    if (!deliveryAddress || !city || !district) {
      res.status(400).json({
        message: "Delivery address, city and district are required",
      });

      return;
    }

    // =========================================
    // FIND CUSTOM ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // OWNER CHECK
    // =========================================

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this custom order",
      });

      return;
    }

    // =========================================
    // CANCELLED
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled custom orders cannot be paid",
      });

      return;
    }

    // =========================================
    // PRICE
    // =========================================

    const totalPrice = Number(order.price);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Custom order price has not been set yet",
      });

      return;
    }

    // =========================================
    // ALREADY PAID
    // =========================================

    if (
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Partially Paid"
    ) {
      res.status(400).json({
        message: "This custom order already has a successful payment",
      });

      return;
    }

    // =========================================
    // AMOUNT
    // =========================================

    const amountToPay =
      paymentPlan === "Half Payment"
        ? Math.round((totalPrice / 2) * 100) / 100
        : totalPrice;

    // =========================================
    // PAYMENT REFERENCE
    // =========================================

    const paymentReference = generatePaymentReference(order.customOrderId);

    // =========================================
    // PAYMENT ATTEMPT
    // =========================================

    await Payment.create({
      paymentReference,

      orderId: order.customOrderId,

      orderType: "custom",

      paymentPlan,

      requestedAmount: amountToPay,

      currency: "LKR",

      status: "Pending",
    });

    // =========================================
    // SAVE CUSTOM ORDER PAYMENT DATA
    // =========================================

    await CustomOrder.findOneAndUpdate(
      {
        customOrderId: order.customOrderId,
      },

      {
        $set: {
          paymentPlan,

          paymentStatus: "Payment Pending",

          paidAmount: 0,

          remainingAmount: totalPrice,

          balanceStatus:
            paymentPlan === "Half Payment" ? "Pending" : "Not Applicable",

          deliveryAddress,

          city,

          district,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    // =========================================
    // CUSTOMER NAME
    // =========================================

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const { firstName, lastName } = splitCustomerName(
      order.fullName || user.fullName || userName,
    );

    // =========================================
    // PAYHERE
    // =========================================

    const merchantId = process.env.PAYHERE_MERCHANT_ID;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    const currency = "LKR";

    const formattedAmount = amountToPay.toFixed(2);

    const hash = generatePaymentHash({
      merchantId,

      orderId: paymentReference,

      amount: amountToPay,

      currency,

      merchantSecret,
    });

    const frontendUrl = process.env.FRONTEND_URL.replace(/\/+$/, "");

    const backendUrl = process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");

    const paymentData = {
      merchant_id: merchantId,

      return_url: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
        paymentReference,
      )}`,

      cancel_url: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
        paymentReference,
      )}`,

      notify_url: `${backendUrl}/api/payments/payhere/notify`,

      order_id: paymentReference,

      items: `NariCraft Custom Order ${order.customOrderId}`,

      currency,

      amount: formattedAmount,

      first_name: firstName,

      last_name: lastName,

      email: customerEmail,

      phone:
        order.telephone || order.phone || user.telephone || user.phone || "",

      address: deliveryAddress,

      city,

      country: "Sri Lanka",

      hash,
    };

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Custom order payment request created",

      paymentReference,

      customOrderId: order.customOrderId,

      paymentPlan,

      amountToPay,

      actionUrl: getPayHereActionUrl(),

      paymentData,
    });
  } catch (err) {
    console.error("Initiate Custom Payment Error:", err.message);

    res.status(500).json({
      message: "Failed to create custom payment request",
    });
  }
}

// =====================================================
// PAYHERE CALLBACK
//
// POST:
// /api/payments/payhere/notify
// =====================================================

export async function payHereNotify(req, res) {
  try {
    const merchantId = req.body.merchant_id?.toString();

    const paymentReference = req.body.order_id?.toString();

    const paymentId = req.body.payment_id?.toString() || "";

    const payhereAmount = req.body.payhere_amount?.toString();

    const currency = req.body.payhere_currency?.toString();

    const statusCode = req.body.status_code?.toString();

    const receivedSignature = req.body.md5sig?.toString();

    // =========================================
    // REQUIRED VALUES
    // =========================================

    if (
      !merchantId ||
      !paymentReference ||
      !payhereAmount ||
      !currency ||
      !statusCode ||
      !receivedSignature
    ) {
      res.status(400).send("Invalid notification");

      return;
    }

    // =========================================
    // MERCHANT
    // =========================================

    if (merchantId !== process.env.PAYHERE_MERCHANT_ID) {
      res.status(400).send("Invalid merchant");

      return;
    }

    if (!process.env.PAYHERE_MERCHANT_SECRET) {
      res.status(500).send("Payment gateway is not configured");

      return;
    }

    // =========================================
    // VERIFY SIGNATURE
    // =========================================

    const localSignature = generateNotificationSignature({
      merchantId,

      orderId: paymentReference,

      amount: payhereAmount,

      currency,

      statusCode,

      merchantSecret: process.env.PAYHERE_MERCHANT_SECRET,
    });

    if (!safeCompare(localSignature, receivedSignature.toUpperCase())) {
      res.status(400).send("Invalid signature");

      return;
    }

    // =========================================
    // PAYMENT RECORD
    // =========================================

    const payment = await Payment.findOne({
      paymentReference,
    });

    if (!payment) {
      res.status(404).send("Payment not found");

      return;
    }

    // =========================================
    // CURRENCY
    // =========================================

    if (currency !== payment.currency) {
      res.status(400).send("Currency mismatch");

      return;
    }

    // =========================================
    // AMOUNT
    // =========================================

    if (moneyToCents(payhereAmount) !== moneyToCents(payment.requestedAmount)) {
      res.status(400).send("Amount mismatch");

      return;
    }

    // =========================================
    // FIND PRODUCT / CUSTOM ORDER
    // =========================================

    const order = await findOrderForPayment(payment);

    if (!order) {
      res.status(404).send("Order not found");

      return;
    }

    // =================================================
    // SUCCESS
    // PayHere status_code = 2
    // =================================================

    if (statusCode === "2") {
      // Duplicate callback protection

      if (payment.status === "Success") {
        res.status(200).send("OK");

        return;
      }

      // =========================================
      // REAL TOTAL
      // =========================================

      const totalPrice = getOrderTotal(payment, order);

      const onlinePaidAmount = Number(payment.requestedAmount);

      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        res.status(400).send("Invalid order total");

        return;
      }

      let paidAmount;

      let remainingAmount;

      let paymentStatus;

      let balanceStatus;

      let paymentCompletedAt = null;

      // =========================================
      // FULL PAYMENT
      // =========================================

      if (payment.paymentPlan === "Full Payment") {
        paidAmount = totalPrice;

        remainingAmount = 0;

        paymentStatus = "Paid";

        balanceStatus = "Not Applicable";

        paymentCompletedAt = new Date();
      }

      // =========================================
      // HALF PAYMENT
      // =========================================
      else {
        paidAmount = onlinePaidAmount;

        remainingAmount = Math.max(
          0,

          Math.round((totalPrice - onlinePaidAmount) * 100) / 100,
        );

        paymentStatus = "Partially Paid";

        balanceStatus = "Pending";
      }

      // =========================================
      // UPDATE PRODUCT / CUSTOM ORDER
      // =========================================

      await updateOrderForPayment(payment, {
        paymentPlan: payment.paymentPlan,

        paymentStatus,

        paidAmount,

        remainingAmount,

        balanceStatus,

        payherePaymentId: paymentId,

        onlinePaymentAt: new Date(),

        paymentCompletedAt,
      });

      // =========================================
      // UPDATE PAYMENT ATTEMPT
      // =========================================

      await Payment.findOneAndUpdate(
        {
          paymentReference,
        },

        {
          $set: {
            status: "Success",

            payherePaymentId: paymentId,

            processedAt: new Date(),
          },
        },
      );

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // PENDING
    // status_code = 0
    // =================================================

    if (statusCode === "0") {
      if (payment.status !== "Success") {
        await Payment.findOneAndUpdate(
          {
            paymentReference,
          },

          {
            $set: {
              status: "Pending",

              payherePaymentId: paymentId,
            },
          },
        );
      }

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // CANCELLED
    // status_code = -1
    // =================================================

    if (statusCode === "-1") {
      if (payment.status !== "Success") {
        await Payment.findOneAndUpdate(
          {
            paymentReference,
          },

          {
            $set: {
              status: "Cancelled",

              payherePaymentId: paymentId,

              processedAt: new Date(),
            },
          },
        );
      }

      // Important:
      // We do NOT mark the main order as Paid.
      // User can retry payment.

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // FAILED
    // status_code = -2
    // =================================================

    if (statusCode === "-2") {
      if (payment.status !== "Success") {
        await Payment.findOneAndUpdate(
          {
            paymentReference,
          },

          {
            $set: {
              status: "Failed",

              payherePaymentId: paymentId,

              processedAt: new Date(),
            },
          },
        );

        if (
          order.paymentStatus !== "Paid" &&
          order.paymentStatus !== "Partially Paid"
        ) {
          await updateOrderForPayment(payment, {
            paymentStatus: "Failed",
          });
        }
      }

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // CHARGEBACK
    // status_code = -3
    // =================================================

    if (statusCode === "-3") {
      await Payment.findOneAndUpdate(
        {
          paymentReference,
        },

        {
          $set: {
            status: "Chargedback",

            payherePaymentId: paymentId,

            processedAt: new Date(),
          },
        },
      );

      await updateOrderForPayment(payment, {
        paymentStatus: "Chargedback",
      });

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // UNKNOWN STATUS
    // =================================================

    res.status(200).send("OK");
  } catch (err) {
    // Never log complete callback body.

    console.error("PayHere Notification Error:", err.message);

    res.status(500).send("Server error");
  }
}

// =====================================================
// PAYMENT STATUS
//
// GET:
// /api/payments/status/:paymentReference
// =====================================================

export async function getPaymentStatus(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    // =========================================
    // REFERENCE
    // =========================================

    const paymentReference = req.params.paymentReference?.toString().trim();

    if (!paymentReference) {
      res.status(400).json({
        message: "Payment reference is required",
      });

      return;
    }

    // =========================================
    // PAYMENT
    // =========================================

    const payment = await Payment.findOne({
      paymentReference,
    });

    if (!payment) {
      res.status(404).json({
        message: "Payment not found",
      });

      return;
    }

    // =========================================
    // PRODUCT / CUSTOM ORDER
    // =========================================

    const order = await findOrderForPayment(payment);

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    // =========================================
    // SECURITY
    // =========================================

    const loggedEmail = normalizeEmail(req.user.email);

    const orderEmail = normalizeEmail(order.email);

    if (req.user.role !== "admin" && orderEmail !== loggedEmail) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      paymentReference: payment.paymentReference,

      orderType: payment.orderType,

      orderId: payment.orderId,

      paymentPlan: payment.paymentPlan,

      requestedAmount: payment.requestedAmount,

      paymentAttemptStatus: payment.status,

      paymentStatus: order.paymentStatus,

      paidAmount: order.paidAmount,

      remainingAmount: order.remainingAmount,

      balanceStatus: order.balanceStatus,

      onlinePaymentAt: order.onlinePaymentAt,

      paymentCompletedAt: order.paymentCompletedAt,
    });
  } catch (err) {
    console.error("Get Payment Status Error:", err.message);

    res.status(500).json({
      message: "Failed to get payment status",
    });
  }
}

// =====================================================
// PAYMENTS.LK HELPERS
// =====================================================

function paymentsLkConfigIsReady() {
  return Boolean(
    process.env.PAYMENTS_LK_SECRET_KEY && process.env.FRONTEND_URL,
  );
}

function paymentsLkWebhookConfigIsReady() {
  return Boolean(
    process.env.PAYMENTS_LK_SECRET_KEY &&
    process.env.PAYMENTS_LK_WEBHOOK_SECRET,
  );
}

function getPaymentsLkClient() {
  if (!process.env.PAYMENTS_LK_SECRET_KEY) {
    throw new Error("PAYMENTS_LK_SECRET_KEY is missing");
  }

  return new PaymentsLk(process.env.PAYMENTS_LK_SECRET_KEY);
}

function getPaymentsLkFrontendUrl() {
  return process.env.FRONTEND_URL.replace(/\/+$/, "");
}

// =====================================================
// PAYMENTS.LK PRODUCT ORDER PAYMENT
//
// POST:
// /api/payments/payments-lk/product/initiate
// =====================================================

export async function initiatePaymentsLkProductPayment(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    // =========================================
    // CONFIG
    // =========================================

    if (!paymentsLkConfigIsReady()) {
      res.status(500).json({
        message: "Payments.lk is not configured",
      });

      return;
    }

    // =========================================
    // USER
    // =========================================

    const customerEmail = normalizeEmail(req.user.email);

    if (!customerEmail) {
      res.status(401).json({
        message: "Invalid user session",
      });

      return;
    }

    const user = await User.findOne({
      email: customerEmail,
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // REQUEST
    // =========================================

    const orderId = req.body.orderId?.toString().trim();

    const paymentPlan = req.body.paymentPlan;

    if (!orderId) {
      res.status(400).json({
        message: "Order ID is required",
      });

      return;
    }

    if (paymentPlan !== "Full Payment" && paymentPlan !== "Half Payment") {
      res.status(400).json({
        message: "Invalid payment plan",
      });

      return;
    }

    // =========================================
    // ORDER
    // =========================================

    const order = await Order.findOne({
      orderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    // =========================================
    // OWNER
    // =========================================

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this order",
      });

      return;
    }

    // =========================================
    // CANCELLED / PAID
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled orders cannot be paid",
      });

      return;
    }

    if (
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Partially Paid"
    ) {
      res.status(400).json({
        message: "This order already has a successful payment",
      });

      return;
    }

    // =========================================
    // REAL TOTAL FROM DATABASE
    // =========================================

    const totalPrice = Number(order.totalPrice);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Invalid order total",
      });

      return;
    }

    const amountToPay =
      paymentPlan === "Half Payment"
        ? Math.round((totalPrice / 2) * 100) / 100
        : totalPrice;

    const amountCents = moneyToCents(amountToPay);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      res.status(400).json({
        message: "Invalid payment amount",
      });

      return;
    }

    // =========================================
    // PAYMENT REFERENCE
    // =========================================

    const paymentReference = generatePaymentReference(order.orderId);

    // =========================================
    // PAYMENTS.LK CHECKOUT
    // =========================================

    const frontendUrl = getPaymentsLkFrontendUrl();

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const customerName =
      order.fullName || user.fullName || userName || "NariCraft Customer";

    const checkout = await getPaymentsLkClient().checkouts.create(
      {
        amountCents,
        description: `NariCraft Order ${order.orderId} - ${paymentPlan}`,
        reference: paymentReference,

        customer: {
          name: customerName,
          email: customerEmail,
          phone: order.phone || user.telephone || user.phone || "",
        },

        successUrl: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,

        cancelUrl: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,
      },

      {
        idempotencyKey: `naricraft-${paymentReference}`,
      },
    );

    if (!checkout?.url) {
      res.status(502).json({
        message: "Payments.lk checkout URL was not returned",
      });

      return;
    }

    // =========================================
    // LOCAL PAYMENT ATTEMPT
    // =========================================

    await Payment.create({
      paymentReference,

      orderId: order.orderId,

      orderType: "product",

      paymentPlan,

      requestedAmount: amountToPay,

      currency: "LKR",

      status: "Pending",
    });

    // =========================================
    // ORDER PAYMENT STATE
    // =========================================

    await Order.findOneAndUpdate(
      {
        orderId: order.orderId,
      },

      {
        $set: {
          paymentPlan,

          paymentStatus: "Payment Pending",

          paidAmount: 0,

          remainingAmount: totalPrice,

          balanceStatus:
            paymentPlan === "Half Payment" ? "Pending" : "Not Applicable",

          // This field belongs to the old PayHere integration.
          // Keep it empty for Payments.lk transactions.
          payherePaymentId: "",
        },
      },

      {
        new: true,

        runValidators: true,
      },
    );

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Payments.lk checkout created",

      provider: "payments.lk",

      paymentReference,

      paymentPlan,

      amountToPay,

      checkoutId: checkout.id || null,

      checkoutUrl: checkout.url,
    });
  } catch (err) {
    console.error("Initiate Payments.lk Product Payment Error:", err.message);

    res.status(500).json({
      message: err?.message || "Failed to create Payments.lk checkout",
    });
  }
}

// =====================================================
// PAYMENTS.LK CUSTOM ORDER PAYMENT
//
// POST:
// /api/payments/payments-lk/custom/initiate
// =====================================================

export async function initiatePaymentsLkCustomPayment(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    // =========================================
    // CONFIG
    // =========================================

    if (!paymentsLkConfigIsReady()) {
      res.status(500).json({
        message: "Payments.lk is not configured",
      });

      return;
    }

    // =========================================
    // USER
    // =========================================

    const customerEmail = normalizeEmail(req.user.email);

    if (!customerEmail) {
      res.status(401).json({
        message: "Invalid user session",
      });

      return;
    }

    const user = await User.findOne({
      email: customerEmail,
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // REQUEST
    // =========================================

    const customOrderId = req.body.customOrderId?.toString().trim();

    const paymentPlan = req.body.paymentPlan;

    const deliveryAddress = req.body.deliveryAddress?.toString().trim();

    const city = req.body.city?.toString().trim();

    const district = req.body.district?.toString().trim();

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    if (paymentPlan !== "Full Payment" && paymentPlan !== "Half Payment") {
      res.status(400).json({
        message: "Invalid payment plan",
      });

      return;
    }

    if (!deliveryAddress || !city || !district) {
      res.status(400).json({
        message: "Delivery address, city and district are required",
      });

      return;
    }

    // =========================================
    // CUSTOM ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // OWNER
    // =========================================

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this custom order",
      });

      return;
    }

    // =========================================
    // CANCELLED / PAID
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled custom orders cannot be paid",
      });

      return;
    }

    if (
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Partially Paid"
    ) {
      res.status(400).json({
        message: "This custom order already has a successful payment",
      });

      return;
    }

    // =========================================
    // REAL PRICE FROM DATABASE
    // =========================================

    const totalPrice = Number(order.price);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Custom order price has not been set yet",
      });

      return;
    }

    const amountToPay =
      paymentPlan === "Half Payment"
        ? Math.round((totalPrice / 2) * 100) / 100
        : totalPrice;

    const amountCents = moneyToCents(amountToPay);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      res.status(400).json({
        message: "Invalid payment amount",
      });

      return;
    }

    // =========================================
    // PAYMENT REFERENCE
    // =========================================

    const paymentReference = generatePaymentReference(order.customOrderId);

    // =========================================
    // PAYMENTS.LK CHECKOUT
    // =========================================

    const frontendUrl = getPaymentsLkFrontendUrl();

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const customerName =
      order.fullName || user.fullName || userName || "NariCraft Customer";

    const checkout = await getPaymentsLkClient().checkouts.create(
      {
        amountCents,
        description: `NariCraft Custom Order ${order.customOrderId} - ${paymentPlan}`,
        reference: paymentReference,

        customer: {
          name: customerName,
          email: customerEmail,
          phone:
            order.telephone ||
            order.phone ||
            user.telephone ||
            user.phone ||
            "",
        },

        successUrl: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,

        cancelUrl: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,
      },

      {
        idempotencyKey: `naricraft-${paymentReference}`,
      },
    );

    if (!checkout?.url) {
      res.status(502).json({
        message: "Payments.lk checkout URL was not returned",
      });

      return;
    }

    // =========================================
    // LOCAL PAYMENT ATTEMPT
    // =========================================

    await Payment.create({
      paymentReference,

      orderId: order.customOrderId,

      orderType: "custom",

      paymentPlan,

      requestedAmount: amountToPay,

      currency: "LKR",

      status: "Pending",
    });

    // =========================================
    // SAVE CUSTOM ORDER PAYMENT DATA
    // =========================================

    await CustomOrder.findOneAndUpdate(
      {
        customOrderId: order.customOrderId,
      },

      {
        $set: {
          paymentPlan,

          paymentStatus: "Payment Pending",

          paidAmount: 0,

          remainingAmount: totalPrice,

          balanceStatus:
            paymentPlan === "Half Payment" ? "Pending" : "Not Applicable",

          deliveryAddress,

          city,

          district,

          payherePaymentId: "",
        },
      },

      {
        new: true,

        runValidators: true,
      },
    );

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Payments.lk custom-order checkout created",

      provider: "payments.lk",

      paymentReference,

      customOrderId: order.customOrderId,

      paymentPlan,

      amountToPay,

      checkoutId: checkout.id || null,

      checkoutUrl: checkout.url,
    });
  } catch (err) {
    console.error("Initiate Payments.lk Custom Payment Error:", err.message);

    res.status(500).json({
      message:
        err?.message || "Failed to create Payments.lk custom-order checkout",
    });
  }
}

// =====================================================
// PAYMENTS.LK SIGNED WEBHOOK
//
// POST:
// /api/payments/payments-lk/webhook
//
// IMPORTANT:
// index.js mounts this route with express.raw() BEFORE
// express.json(), because Payments.lk signs the exact raw bytes.
// =====================================================

export async function paymentsLkWebhook(req, res) {
  try {
    if (!paymentsLkWebhookConfigIsReady()) {
      res.status(500).send("Payments.lk webhook is not configured");

      return;
    }

    const signature = req.headers["payments-signature"];

    if (!signature) {
      res.status(400).send("Missing signature");

      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      res.status(400).send("Raw webhook body required");

      return;
    }

    let event;

    try {
      event = getPaymentsLkClient().webhooks.constructEvent(
        req.body,
        signature,
        process.env.PAYMENTS_LK_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Payments.lk Webhook Signature Error:", err.message);

      res.status(400).send("Invalid signature");

      return;
    }

    // =========================================
    // ONLY PAYMENT EVENTS NEEDED HERE
    // =========================================

    if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
      res.status(200).send("OK");

      return;
    }

    const providerPayment = event.data;

    const paymentReference = providerPayment?.reference?.toString().trim();

    if (!paymentReference) {
      // An "All keys" webhook can receive events from
      // unrelated Payments.lk activity.
      res.status(200).send("Ignored");

      return;
    }

    // =========================================
    // LOCAL PAYMENT RECORD
    // =========================================

    const payment = await Payment.findOne({
      paymentReference,
    });

    if (!payment) {
      // Do not make Payments.lk retry forever for an
      // event that does not belong to this application.
      res.status(200).send("Ignored");

      return;
    }

    // =========================================
    // CURRENCY + AMOUNT VERIFICATION
    // =========================================

    if (providerPayment.currency !== payment.currency) {
      res.status(400).send("Currency mismatch");

      return;
    }

    if (
      Number(providerPayment.amountCents) !==
      moneyToCents(payment.requestedAmount)
    ) {
      res.status(400).send("Amount mismatch");

      return;
    }

    // =========================================
    // ORDER
    // =========================================

    const order = await findOrderForPayment(payment);

    if (!order) {
      res.status(404).send("Order not found");

      return;
    }

    // =================================================
    // SUCCESS
    // =================================================

    if (event.type === "payment.succeeded") {
      // Duplicate webhook delivery protection.

      if (payment.status === "Success") {
        res.status(200).send("OK");

        return;
      }

      const totalPrice = getOrderTotal(payment, order);

      const onlinePaidAmount = Number(payment.requestedAmount);

      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        res.status(400).send("Invalid order total");

        return;
      }

      let paidAmount;

      let remainingAmount;

      let paymentStatus;

      let balanceStatus;

      let paymentCompletedAt = null;

      if (payment.paymentPlan === "Full Payment") {
        paidAmount = totalPrice;

        remainingAmount = 0;

        paymentStatus = "Paid";

        balanceStatus = "Not Applicable";

        paymentCompletedAt = new Date();
      } else if (payment.paymentPlan === "Half Payment") {
        paidAmount = onlinePaidAmount;

        remainingAmount = Math.max(
          0,

          Math.round((totalPrice - onlinePaidAmount) * 100) / 100,
        );

        paymentStatus = "Partially Paid";

        balanceStatus = "Pending";
      } else {
        res.status(400).send("Invalid payment plan");

        return;
      }

      await updateOrderForPayment(payment, {
        paymentPlan: payment.paymentPlan,

        paymentStatus,

        paidAmount,

        remainingAmount,

        balanceStatus,

        // Keep the old PayHere-specific ID empty.
        payherePaymentId: "",

        onlinePaymentAt: new Date(),

        paymentCompletedAt,
      });

      await Payment.findOneAndUpdate(
        {
          paymentReference,
        },

        {
          $set: {
            status: "Success",

            // payment.id is intentionally not written into
            // the old payherePaymentId field.
            processedAt: new Date(),
          },
        },
      );

      res.status(200).send("OK");

      return;
    }

    // =================================================
    // FAILED
    // =================================================

    if (event.type === "payment.failed") {
      if (payment.status !== "Success") {
        await Payment.findOneAndUpdate(
          {
            paymentReference,
          },

          {
            $set: {
              status: "Failed",

              processedAt: new Date(),
            },
          },
        );

        if (
          order.paymentStatus !== "Paid" &&
          order.paymentStatus !== "Partially Paid"
        ) {
          await updateOrderForPayment(payment, {
            paymentStatus: "Failed",
          });
        }
      }

      res.status(200).send("OK");

      return;
    }

    res.status(200).send("OK");
  } catch (err) {
    // Never log the complete webhook body.

    console.error("Payments.lk Webhook Error:", err.message);

    res.status(500).send("Server error");
  }
}
