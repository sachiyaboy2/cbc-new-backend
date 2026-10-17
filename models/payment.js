import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // =========================================
    // OUR UNIQUE PAYMENT ATTEMPT ID
    // =========================================

    paymentReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // =========================================
    // NARICRAFT ORDER
    // =========================================

    orderId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    orderType: {
      type: String,
      enum: ["product", "custom"],
      default: "product",
      required: true,
    },

    // =========================================
    // PAYMENT PLAN
    // =========================================

    paymentPlan: {
      type: String,
      enum: ["Full Payment", "Half Payment"],
      required: true,
    },

    // =========================================
    // AMOUNT ACTUALLY SENT TO PAYHERE
    // =========================================

    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "LKR",
      required: true,
    },

    // =========================================
    // PAYMENT ATTEMPT STATUS
    // =========================================

    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Cancelled", "Chargedback"],
      default: "Pending",
    },

    // =========================================
    // PAYHERE REFERENCE
    // No card number / CVV is stored.
    // =========================================

    payherePaymentId: {
      type: String,
      default: "",
      trim: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Payment = mongoose.model("payment", paymentSchema);

export default Payment;
