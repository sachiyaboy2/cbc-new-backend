import crypto from "crypto";
import { PaymentsLk } from "@payments-lk/node";

import Order from "../models/order.js";
import Payment from "../models/payment.js";
import User from "../models/user.js";
import CustomOrder from "../models/customOrder.js";

// =====================================================
// CONFIG
// =====================================================

const PAYMENTS_LK_MIN_CENTS = 1000; // LKR 10.00
const PAYMENTS_LK_MAX_CENTS = 100000000; // LKR 1,000,000.00

// Reuse a pending checkout only while it is fresh.
// Payments.lk checkouts expire after 30 minutes.
const PENDING_ATTEMPT_REUSE_MS = 25 * 60 * 1000;

// =====================================================
// HELPERS
// =====================================================

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSriLankanMobile(value) {
  const raw = String(value || "").trim();

  // Keep digits and optional leading +
  const compact = raw.replace(/[\s()-]/g, "");

  if (/^07\d{8}$/.test(compact)) {
    return compact;
  }

  if (/^\+947\d{8}$/.test(compact)) {
    return "0" + compact.slice(3);
  }

  if (/^947\d{8}$/.test(compact)) {
    return "0" + compact.slice(2);
  }

  return null;
}

function generatePaymentReference(orderId) {
  const random = crypto.randomBytes(8).toString("hex").toUpperCase();

  return `NCR-${orderId}-${random}`;
}

function paymentsLkConfigIsReady() {
  return Boolean(
    process.env.PAYMENTS_LK_SECRET_KEY &&
      process.env.FRONTEND_URL,
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

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || "").replace(/\/+$/, "");
}

function validateAmountForPaymentsLk(amountToPay) {
  const amountCents = moneyToCents(amountToPay);

  if (!Number.isInteger(amountCents)) {
    return {
      ok: false,
      message: "Invalid payment amount",
    };
  }

  if (amountCents < PAYMENTS_LK_MIN_CENTS) {
    return {
      ok: false,
      message: "Payments.lk requires a minimum payment of LKR 10.00",
    };
  }

  if (amountCents > PAYMENTS_LK_MAX_CENTS) {
    return {
      ok: false,
      message: "Payment amount exceeds the Payments.lk checkout limit",
    };
  }

  return {
    ok: true,
    amountCents,
  };
}

function getPaymentCreatedAt(payment) {
  if (payment?.createdAt) {
    const value = new Date(payment.createdAt);

    if (!Number.isNaN(value.getTime())) {
      return value;
    }
  }

  if (payment?._id && typeof payment._id.getTimestamp === "function") {
    return payment._id.getTimestamp();
  }

  return null;
}

function isFreshPendingAttempt(payment) {
  const createdAt = getPaymentCreatedAt(payment);

  if (!createdAt) {
    return false;
  }

  return Date.now() - createdAt.getTime() < PENDING_ATTEMPT_REUSE_MS;
}

async function getOrCreatePendingPayment({
  orderId,
  orderType,
  paymentPlan,
  requestedAmount,
}) {
  const existing = await Payment.findOne({
    orderId,
    orderType,
    paymentPlan,
    requestedAmount,
    currency: "LKR",
    status: "Pending",
  }).sort({
    _id: -1,
  });

  if (existing && isFreshPendingAttempt(existing)) {
    return existing;
  }

  // If an old local attempt is still marked Pending,
  // stop reusing it before creating a fresh checkout.
  if (existing) {
    await Payment.findOneAndUpdate(
      {
        _id: existing._id,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          processedAt: new Date(),
        },
      },
    );
  }

  return Payment.create({
    paymentReference: generatePaymentReference(orderId),

    orderId,

    orderType,

    paymentPlan,

    requestedAmount,

    currency: "LKR",

    status: "Pending",
  });
}

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

function getOrderTotal(payment, order) {
  if (payment.orderType === "custom") {
    return Number(order.price);
  }

  return Number(order.totalPrice);
}

function paymentStateBlocksNewPayment(order) {
  return (
    order.paymentStatus === "Paid" ||
    order.paymentStatus === "Partially Paid" ||
    order.paymentStatus === "Chargedback"
  );
}

function calculateAmountToPay(totalPrice, paymentPlan) {
  if (paymentPlan === "Half Payment") {
    return Math.round((totalPrice / 2) * 100) / 100;
  }

  return totalPrice;
}

// =====================================================
// PRODUCT ORDER PAYMENT
//
// POST /api/payments/product/initiate
// Legacy alias also remains available:
// POST /api/payments/payments-lk/product/initiate
// =====================================================

export async function initiateProductPayment(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    if (!paymentsLkConfigIsReady()) {
      res.status(500).json({
        message: "Payments.lk is not configured",
      });

      return;
    }

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

    const order = await Order.findOne({
      orderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this order",
      });

      return;
    }

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled orders cannot be paid",
      });

      return;
    }

    if (paymentStateBlocksNewPayment(order)) {
      res.status(400).json({
        message: "This order cannot start another payment",
      });

      return;
    }

    const totalPrice = Number(order.totalPrice);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Invalid order total",
      });

      return;
    }

    const amountToPay = calculateAmountToPay(totalPrice, paymentPlan);

    const amountCheck = validateAmountForPaymentsLk(amountToPay);

    if (!amountCheck.ok) {
      res.status(400).json({
        message: amountCheck.message,
      });

      return;
    }

    const phone = normalizeSriLankanMobile(
      order.phone ||
        user.telephone ||
        user.phone,
    );

    if (!phone) {
      res.status(400).json({
        message:
          "Enter a valid Sri Lankan mobile number such as 0771234567",
      });

      return;
    }

    // Create/reuse the local attempt BEFORE calling the gateway.
    // A retry reuses the same reference + idempotency key.
    const payment = await getOrCreatePendingPayment({
      orderId: order.orderId,

      orderType: "product",

      paymentPlan,

      requestedAmount: amountToPay,
    });

    const paymentReference = payment.paymentReference;

    const frontendUrl = getFrontendUrl();

    const customerName =
      order.fullName ||
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      "NariCraft Customer";

    const checkout = await getPaymentsLkClient().checkouts.create(
      {
        amountCents: amountCheck.amountCents,

        description: `NariCraft Order ${order.orderId} - ${paymentPlan}`,

        reference: paymentReference,

        customer: {
          name: customerName,

          email: customerEmail,

          phone,
        },

        successUrl: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,

        cancelUrl: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,
      },

      {
        idempotencyKey: paymentReference,
      },
    );

    if (!checkout?.url) {
      res.status(502).json({
        message: "Payments.lk checkout URL was not returned",
      });

      return;
    }

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

    res.status(200).json({
      message: "Payments.lk checkout created",

      provider: "payments.lk",

      paymentReference,

      orderType: "product",

      orderId: order.orderId,

      paymentPlan,

      amountToPay,

      checkoutId: checkout.id || null,

      checkoutUrl: checkout.url,
    });
  } catch (err) {
    console.error(
      "Initiate Payments.lk Product Payment Error:",
      err.message,
    );

    res.status(500).json({
      message:
        err?.message ||
        "Failed to create Payments.lk checkout",
    });
  }
}

// =====================================================
// CUSTOM ORDER PAYMENT
//
// POST /api/payments/custom/initiate
// Legacy alias also remains available:
// POST /api/payments/payments-lk/custom/initiate
// =====================================================

export async function initiateCustomPayment(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    if (!paymentsLkConfigIsReady()) {
      res.status(500).json({
        message: "Payments.lk is not configured",
      });

      return;
    }

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

    const order = await CustomOrder.findOne({
      customOrderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    const orderEmail = normalizeEmail(order.email);

    if (!orderEmail || orderEmail !== customerEmail) {
      res.status(403).json({
        message: "You cannot pay for this custom order",
      });

      return;
    }

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cancelled custom orders cannot be paid",
      });

      return;
    }

    if (paymentStateBlocksNewPayment(order)) {
      res.status(400).json({
        message: "This custom order cannot start another payment",
      });

      return;
    }

    const totalPrice = Number(order.price);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Custom order price has not been set yet",
      });

      return;
    }

    const amountToPay = calculateAmountToPay(totalPrice, paymentPlan);

    const amountCheck = validateAmountForPaymentsLk(amountToPay);

    if (!amountCheck.ok) {
      res.status(400).json({
        message: amountCheck.message,
      });

      return;
    }

    const phone = normalizeSriLankanMobile(
      order.telephone ||
        order.phone ||
        user.telephone ||
        user.phone,
    );

    if (!phone) {
      res.status(400).json({
        message:
          "Your account needs a valid Sri Lankan mobile number such as 0771234567",
      });

      return;
    }

    const payment = await getOrCreatePendingPayment({
      orderId: order.customOrderId,

      orderType: "custom",

      paymentPlan,

      requestedAmount: amountToPay,
    });

    const paymentReference = payment.paymentReference;

    const frontendUrl = getFrontendUrl();

    const customerName =
      order.fullName ||
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      "NariCraft Customer";

    const checkout = await getPaymentsLkClient().checkouts.create(
      {
        amountCents: amountCheck.amountCents,

        description: `NariCraft Custom Order ${order.customOrderId} - ${paymentPlan}`,

        reference: paymentReference,

        customer: {
          name: customerName,

          email: customerEmail,

          phone,
        },

        successUrl: `${frontendUrl}/payment/success?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,

        cancelUrl: `${frontendUrl}/payment/cancelled?payment_ref=${encodeURIComponent(
          paymentReference,
        )}`,
      },

      {
        idempotencyKey: paymentReference,
      },
    );

    if (!checkout?.url) {
      res.status(502).json({
        message: "Payments.lk checkout URL was not returned",
      });

      return;
    }

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

    res.status(200).json({
      message: "Payments.lk custom-order checkout created",

      provider: "payments.lk",

      paymentReference,

      orderType: "custom",

      customOrderId: order.customOrderId,

      paymentPlan,

      amountToPay,

      checkoutId: checkout.id || null,

      checkoutUrl: checkout.url,
    });
  } catch (err) {
    console.error(
      "Initiate Payments.lk Custom Payment Error:",
      err.message,
    );

    res.status(500).json({
      message:
        err?.message ||
        "Failed to create Payments.lk custom-order checkout",
    });
  }
}

// =====================================================
// PAYMENTS.LK SIGNED WEBHOOK
//
// POST /api/payments/payments-lk/webhook
//
// IMPORTANT:
// index.js mounts this route with express.raw()
// BEFORE express.json().
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
      console.error(
        "Payments.lk Webhook Signature Error:",
        err.message,
      );

      res.status(400).send("Invalid signature");

      return;
    }

    // test.ping and unrelated events need no order action.
    if (
      event.type !== "payment.succeeded" &&
      event.type !== "payment.failed"
    ) {
      res.status(200).send("OK");

      return;
    }

    const providerPayment = event.data;

    const paymentReference =
      providerPayment?.reference?.toString().trim();

    if (!paymentReference) {
      res.status(200).send("Ignored");

      return;
    }

    const payment = await Payment.findOne({
      paymentReference,
    });

    if (!payment) {
      // The endpoint can receive events from other account activity.
      res.status(200).send("Ignored");

      return;
    }

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

    const order = await findOrderForPayment(payment);

    if (!order) {
      res.status(404).send("Order not found");

      return;
    }

    // =================================================
    // SUCCESS
    // =================================================

    if (event.type === "payment.succeeded") {
      // Webhook deliveries can repeat.
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

        onlinePaymentAt: new Date(),

        paymentCompletedAt,
      });

      await Payment.findOneAndUpdate(
        {
          _id: payment._id,

          status: {
            $ne: "Success",
          },
        },

        {
          $set: {
            status: "Success",

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
            _id: payment._id,

            status: {
              $ne: "Success",
            },
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
    console.error(
      "Payments.lk Webhook Error:",
      err.message,
    );

    res.status(500).send("Server error");
  }
}

// =====================================================
// PAYMENT STATUS
//
// GET /api/payments/status/:paymentReference
// =====================================================

export async function getPaymentStatus(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Please login first",
      });

      return;
    }

    const paymentReference =
      req.params.paymentReference?.toString().trim();

    if (!paymentReference) {
      res.status(400).json({
        message: "Payment reference is required",
      });

      return;
    }

    const payment = await Payment.findOne({
      paymentReference,
    });

    if (!payment) {
      res.status(404).json({
        message: "Payment not found",
      });

      return;
    }

    const order = await findOrderForPayment(payment);

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });

      return;
    }

    const loggedEmail = normalizeEmail(req.user.email);

    const orderEmail = normalizeEmail(order.email);

    if (
      req.user.role?.toLowerCase() !== "admin" &&
      orderEmail !== loggedEmail
    ) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    res.status(200).json({
      provider: "payments.lk",

      paymentReference: payment.paymentReference,

      orderType: payment.orderType,

      orderId: payment.orderId,

      paymentPlan: payment.paymentPlan,

      requestedAmount: payment.requestedAmount,

      paymentAttemptStatus: payment.status,

      paymentStatus: order.paymentStatus,

      paidAmount: Number(order.paidAmount || 0),

      remainingAmount: Number(order.remainingAmount || 0),

      balanceStatus: order.balanceStatus || "Not Applicable",

      onlinePaymentAt: order.onlinePaymentAt || null,

      paymentCompletedAt: order.paymentCompletedAt || null,
    });
  } catch (err) {
    console.error("Get Payment Status Error:", err.message);

    res.status(500).json({
      message: "Failed to get payment status",
    });
  }
}
