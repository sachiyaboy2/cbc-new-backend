import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // =====================================================
    // ORDER ID
    // =====================================================

    orderId: {
      type: String,
      required: true,
      unique: true,
    },

    // =====================================================
    // CUSTOMER DETAILS
    // =====================================================

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // =====================================================
    // DELIVERY DETAILS
    // =====================================================

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    district: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // =====================================================
    // PRODUCTS
    // =====================================================

    products: [
      {
        productId: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        image: {
          type: String,
          default: "",
        },
      },
    ],

    // =====================================================
    // ORDER TOTAL
    // =====================================================

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // ORDER STATUS
    // =====================================================

    status: {
      type: String,

      enum: [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],

      default: "Pending",
    },

    // =====================================================
    // ORDER DATE
    // =====================================================

    date: {
      type: Date,
      default: Date.now,
    },

    // =====================================================
    // PAYMENT PLAN
    //
    // Full Payment
    // Half Payment = 50% online + 50% delivery
    // =====================================================

    paymentPlan: {
      type: String,

      enum: ["Full Payment", "Half Payment"],

      default: null,
    },

    // =====================================================
    // PAYMENT STATUS
    // =====================================================

    paymentStatus: {
      type: String,

      enum: [
        "Payment Pending",
        "Partially Paid",
        "Paid",
        "Failed",
        "Chargedback",
      ],

      default: "Payment Pending",
    },

    // =====================================================
    // PAID AMOUNT
    // =====================================================

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // REMAINING AMOUNT
    // =====================================================

    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // DELIVERY BALANCE STATUS
    // =====================================================

    balanceStatus: {
      type: String,

      enum: ["Not Applicable", "Pending", "Collected"],

      default: "Not Applicable",
    },

    // =====================================================
    // PAYHERE PAYMENT ID
    //
    // We store only payment reference.
    // Card number / CVV are NEVER stored.
    // =====================================================

    payherePaymentId: {
      type: String,
      default: "",
      trim: true,
    },

    // =====================================================
    // ONLINE PAYMENT DATE
    // =====================================================

    onlinePaymentAt: {
      type: Date,
      default: null,
    },

    // =====================================================
    // FULL PAYMENT COMPLETED DATE
    // =====================================================

    paymentCompletedAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
