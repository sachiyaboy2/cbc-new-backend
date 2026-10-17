import mongoose from "mongoose";

const measurementProfileSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    measurementUnit: {
      type: String,

      enum: ["in", "cm"],

      default: "in",
    },

    measurements: {
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
  },

  {
    timestamps: true,
  },
);

const MeasurementProfile = mongoose.model(
  "MeasurementProfile",
  measurementProfileSchema,
);

export default MeasurementProfile;
