import mongoose from "mongoose";

// =====================================================
// MEASUREMENT SCHEMA
// =====================================================

const measurementSchema = new mongoose.Schema(
  {
    bust: {
      type: Number,
      default: null,
    },

    underBust: {
      type: Number,
      default: null,
    },

    waist: {
      type: Number,
      default: null,
    },

    shoulder: {
      type: Number,
      default: null,
    },

    sleeveLength: {
      type: Number,
      default: null,
    },

    sleeveCircumference: {
      type: Number,
      default: null,
    },

    frontNeck: {
      type: Number,
      default: null,
    },

    backNeck: {
      type: Number,
      default: null,
    },

    jacketLength: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  },
);

// =====================================================
// CUSTOM ORDER SCHEMA
// =====================================================

const customOrderSchema = new mongoose.Schema(
  {
    // =================================================
    // ORDER ID
    // =================================================

    customOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // =================================================
    // CUSTOMER DETAILS
    // =================================================

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    telephone: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // DESIGN PHOTO
    // =================================================

    designImage: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // MEASUREMENT TYPE
    // =================================================

    measurementType: {
      type: String,
      enum: ["standard", "custom"],
      required: true,
    },

    // =================================================
    // STANDARD SIZE
    // =================================================

    standardSize: {
      type: String,
      enum: ["S", "M", "L", "XL", "2XL", null],
      default: null,
    },

    // =================================================
    // MEASUREMENT UNIT
    // =================================================

    measurementUnit: {
      type: String,
      enum: ["in", "cm"],
      default: "in",
    },

    // =================================================
    // CUSTOM MEASUREMENTS
    // =================================================

    measurements: {
      type: measurementSchema,
      default: () => ({
        bust: null,
        underBust: null,
        waist: null,
        shoulder: null,
        sleeveLength: null,
        sleeveCircumference: null,
        frontNeck: null,
        backNeck: null,
        jacketLength: null,
      }),
    },

    // =================================================
    // FABRIC
    // =================================================

    customerProvidesFabric: {
      type: Boolean,
      default: false,
    },

    // =================================================
    // CUSTOMER NOTES
    // =================================================

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // =================================================
    // PRICE SET BY ADMIN
    // =================================================

    price: {
      type: Number,
      default: null,
      min: 0,
    },

    // =================================================
    // DELIVERY DETAILS
    // Filled when customer starts payment.
    // =================================================

    deliveryAddress: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    district: {
      type: String,
      default: "",
      trim: true,
    },

    // =================================================
    // PAYMENT PLAN
    // =================================================

    paymentPlan: {
      type: String,
      enum: ["Full Payment", "Half Payment"],
      default: null,
    },

    // =================================================
    // PAYMENT STATUS
    // =================================================

    paymentStatus: {
      type: String,
      enum: [
        "Price Pending",
        "Payment Pending",
        "Partially Paid",
        "Paid",
        "Failed",
        "Chargedback",
      ],
      default: "Price Pending",
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceStatus: {
      type: String,
      enum: ["Not Applicable", "Pending", "Collected"],
      default: "Not Applicable",
    },

    // We store only the gateway payment reference/id.
    // Card number, CVV and card expiry are never stored here.
    payherePaymentId: {
      type: String,
      default: "",
      trim: true,
    },

    onlinePaymentAt: {
      type: Date,
      default: null,
    },

    paymentCompletedAt: {
      type: Date,
      default: null,
    },

    // =================================================
    // ORDER STATUS
    // =================================================

    status: {
      type: String,
      enum: [
        "Pending",
        "Reviewed",
        "Accepted",
        "In Progress",
        "Ready",
        "Completed",
        "Cancelled",
      ],
      default: "Pending",
    },

    // =================================================
    // CANCELLATION DETAILS
    // =================================================

    cancelReason: {
      type: String,
      default: "",
      trim: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // =================================================
    // ORDER DATE
    // =================================================

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// =====================================================
// MODEL
// =====================================================

const CustomOrder = mongoose.model("CustomOrder", customOrderSchema);

export default CustomOrder;
