import mongoose from "mongoose";

// =====================================================
// MEASUREMENT SCHEMA
// =====================================================

const measurementSchema = new mongoose.Schema(
  {
    // =================================================
    // NEW COMMON / GARMENT-SPECIFIC MEASUREMENTS
    // =================================================

    // උස
    height: {
      type: Number,
      default: null,
    },

    // උරහිස / උරපතු මිනුම
    shoulder: {
      type: Number,
      default: null,
    },

    // පපුව වට
    bust: {
      type: Number,
      default: null,
    },

    // උදරයේ ප්‍රදේශ මිම්ම
    abdomen: {
      type: Number,
      default: null,
    },

    // ඉන
    waist: {
      type: Number,
      default: null,
    },

    // උරහිස / ඉහළ සිට ඉන දක්වා
    waistLength: {
      type: Number,
      default: null,
    },

    // ඉදිරි කර ගැඹුර
    frontNeckDepth: {
      type: Number,
      default: null,
    },

    // පිටුපස කර ගැඹුර
    backNeckDepth: {
      type: Number,
      default: null,
    },

    // ඉහළ සිට Bra මධ්‍ය ලක්ෂ්‍යය දක්වා
    topToBustPoint: {
      type: Number,
      default: null,
    },

    // පැත්තෙන් සිට Bra මධ්‍ය ලක්ෂ්‍යය දක්වා
    sideToBustPoint: {
      type: Number,
      default: null,
    },

    // අත දිග
    sleeveLength: {
      type: Number,
      default: null,
    },

    // අත වට
    sleeveCircumference: {
      type: Number,
      default: null,
    },

    // අත් කැපුම / Armhole
    armhole: {
      type: Number,
      default: null,
    },

    // සාය උස
    skirtLength: {
      type: Number,
      default: null,
    },

    // =================================================
    // LEGACY MEASUREMENTS
    //
    // පරණ custom orders break නොවෙන්න
    // මේ fields තියාගන්නවා.
    // =================================================

    underBust: {
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
// EMPTY MEASUREMENTS
// =====================================================

function createEmptyMeasurements() {
  return {
    height: null,
    shoulder: null,
    bust: null,
    abdomen: null,
    waist: null,
    waistLength: null,
    frontNeckDepth: null,
    backNeckDepth: null,
    topToBustPoint: null,
    sideToBustPoint: null,
    sleeveLength: null,
    sleeveCircumference: null,
    armhole: null,
    skirtLength: null,

    // Legacy
    underBust: null,
    frontNeck: null,
    backNeck: null,
    jacketLength: null,
  };
}

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
    // GARMENT TYPE
    //
    // null allowed only for older existing orders.
    // Controller එකෙන් new orders වලදී required කරනවා.
    // =================================================

    garmentType: {
      type: String,
      enum: ["saree-jacket", "frock", "crop-top", null],
      default: null,
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
      default: createEmptyMeasurements,
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

    // Gateway payment reference only.
    // Card number / CVV / expiry NEVER stored.
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
