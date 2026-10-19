import express from "express";

import {
  createUser,
  getUser,
  loginUser,
  googleLogin,
  updateProfileImage,
  updateProfile,
  sendOTP,
  changePasswordOTP,
} from "../controller/userController.js";

const userRouter = express.Router();

// =====================================================
// REGISTER
// =====================================================

userRouter.post("/", createUser);

// =====================================================
// NORMAL LOGIN
// =====================================================

userRouter.post("/login", loginUser);

// =====================================================
// GOOGLE LOGIN / REGISTER
// =====================================================

userRouter.post("/google-login", googleLogin);

// =====================================================
// CURRENT USER
// =====================================================

userRouter.get("/me", getUser);

// =====================================================
// PROFILE IMAGE
// =====================================================

userRouter.put("/profile-image", updateProfileImage);

// =====================================================
// PROFILE UPDATE
// =====================================================

userRouter.put("/profile", updateProfile);

// =====================================================
// FORGOT PASSWORD
// =====================================================

userRouter.post("/forgot-password/send-otp", sendOTP);

userRouter.post("/forgot-password/reset", changePasswordOTP);

export default userRouter;
