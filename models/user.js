import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      required: true,
      default: "user",
      enum: ["user", "admin"],
    },

    // Google login වලින් telephone එන්නේ නැති නිසා
    // optional කරලා String එකක් විදිහට තියාගන්නවා
    telephone: {
      type: String,
      default: "",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    Image: {
      type: String,
      default:
        "https://i.pinimg.com/736x/77/31/84/773184b669036ede8ef4ed37e7bc0fa3.jpg",
    },
  },

  {
    timestamps: true,
  },
);

const User = mongoose.model("user", userSchema);

export default User;
