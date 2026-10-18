import mongoose from "mongoose";

// =====================================================
// MEASUREMENT VALUES SCHEMA
// =====================================================

const measurementValuesSchema = new mongoose.Schema(
  {
    height: {
      type: Number,
      default: null,
    },

    shoulder: {
      type: Number,
      default: null,
    },

    bust: {
      type: Number,
      default: null,
    },

    abdomen: {
      type: Number,
      default: null,
    },

    waist: {
      type: Number,
      default: null,
    },

    waistLength: {
      type: Number,
      default: null,
    },

    frontNeckDepth: {
      type: Number,
      default: null,
    },

    backNeckDepth: {
      type: Number,
      default: null,
    },

    topToBustPoint: {
      type: Number,
      default: null,
    },

    sideToBustPoint: {
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

    armhole: {
      type: Number,
      default: null,
    },

    skirtLength: {
      type: Number,
      default: null,
    },

    // =================================================
    // LEGACY FIELDS
    // Old saved measurements compatibility
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
// GARMENT PROFILE SCHEMA
// =====================================================

const garmentMeasurementSchema = new mongoose.Schema(
  {
    measurementUnit: {
      type: String,
      enum: ["in", "cm"],
      default: "in",
    },

    measurements: {
      type: measurementValuesSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
  },
);

// =====================================================
// MEASUREMENT PROFILE SCHEMA
// =====================================================

const measurementProfileSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // =================================================
    // GARMENT-SPECIFIC SAVED MEASUREMENTS
    // =================================================

    garmentProfiles: {
      sareeJacket: {
        type: garmentMeasurementSchema,
        default: null,
      },

      frock: {
        type: garmentMeasurementSchema,
        default: null,
      },

      cropTop: {
        type: garmentMeasurementSchema,
        default: null,
      },
    },

    // =================================================
    // LEGACY PROFILE
    //
    // පරණ user measurements database එකේ තිබුණොත්
    // ඒවා break නොවෙන්න තියාගන්නවා.
    // =================================================

    measurementUnit: {
      type: String,
      enum: ["in", "cm"],
      default: "in",
    },

    measurements: {
      type: measurementValuesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

// =====================================================
// MODEL
// =====================================================

const MeasurementProfile = mongoose.model(
  "MeasurementProfile",
  measurementProfileSchema,
);

export default MeasurementProfile;
