import User from "../models/user.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

import crypto from "crypto";

import { OAuth2Client } from "google-auth-library";

import { Resend } from "resend";

import OTP from "../models/otpModel.js";

import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]); 

// =====================================================
// RESEND EMAIL CLIENT
// =====================================================

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "NariCraft <onboarding@resend.dev>";
}
// =====================================================
// GOOGLE CLIENT
// =====================================================

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// =====================================================
// CREATE NORMAL USER
// =====================================================

export async function createUser(req, res) {
  try {
    // =========================================
    // GET DATA
    // =========================================

    const email = req.body.email?.trim().toLowerCase();

    const fullName = req.body.fullName?.trim();

    const telephone = req.body.telephone?.trim() || "";

    const password = req.body.password;

    // =========================================
    // VALIDATE
    // =========================================

    if (!email || !fullName || !password) {
      res.status(400).json({
        message: "Email, full name and password are required",
      });

      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        message: "Password must be at least 6 characters",
      });

      return;
    }

    // =========================================
    // CHECK EXISTING USER
    // =========================================

    const existingUser = await User.findOne({
      email: email,
    });

    if (existingUser) {
      res.status(409).json({
        message: "An account already exists with this email",
      });

      return;
    }

    // =========================================
    // HASH PASSWORD
    // =========================================

    const hashedPassword = bcrypt.hashSync(password, 10);

    // =========================================
    // CREATE USER
    // =========================================

    const user = new User({
      email: email,

      fullName: fullName,

      telephone: telephone,

      password: hashedPassword,

      role: "user",

      isEmailVerified: false,
    });

    await user.save();

    // =========================================
    // RESPONSE
    // =========================================

    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (err) {
    console.error("Create User Error:", err);

    // duplicate email safeguard
    if (err.code === 11000) {
      res.status(409).json({
        message: "An account already exists with this email",
      });

      return;
    }

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// NORMAL LOGIN
// =====================================================

export async function loginUser(req, res) {
  try {
    const email = req.body.email?.trim().toLowerCase();

    const password = req.body.password;

    if (!email || !password) {
      res.status(400).json({
        message: "Email and password are required",
      });

      return;
    }

    // =========================================
    // FIND USER
    // =========================================

    const user = await User.findOne({
      email: email,
    });

    if (user == null) {
      res.status(401).json({
        message: "User not found",
      });

      return;
    }

    // =========================================
    // BLOCKED USER CHECK
    // =========================================

    if (user.isBlocked) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // PASSWORD CHECK
    // =========================================

    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid password",
      });

      return;
    }

    // =========================================
    // CREATE JWT
    // =========================================

    const token = jwt.sign(
      {
        email: user.email,

        fullName: user.fullName,

        telephone: user.telephone,

        role: user.role,

        isEmailVerified: user.isEmailVerified,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      },
    );

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Login successful",

      token: token,

      user: {
        email: user.email,

        fullName: user.fullName,

        telephone: user.telephone,

        role: user.role,

        isEmailVerified: user.isEmailVerified,

        Image: user.Image,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// GOOGLE LOGIN / REGISTER
// =====================================================

export async function googleLogin(req, res) {
  try {
    const credential = req.body.credential;

    if (!credential) {
      res.status(400).json({
        message: "Google credential is required",
      });

      return;
    }

    // =========================================
    // VERIFY GOOGLE TOKEN
    // =========================================

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,

      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleUser = ticket.getPayload();

    if (!googleUser || !googleUser.email) {
      res.status(401).json({
        message: "Invalid Google account",
      });

      return;
    }

    if (googleUser.email_verified !== true) {
      res.status(401).json({
        message: "Google email is not verified",
      });

      return;
    }

    const email = googleUser.email.trim().toLowerCase();

    // =========================================
    // CHECK USER
    // =========================================

    let user = await User.findOne({
      email: email,
    });

    // =========================================
    // CREATE GOOGLE USER
    // =========================================

    if (user == null) {
      // password field required නිසා
      // random password එකක් හදනවා
      const randomPassword = crypto.randomUUID();

      const hashedPassword = bcrypt.hashSync(randomPassword, 10);

      user = new User({
        email: email,

        fullName: googleUser.name || "Google User",

        password: hashedPassword,

        telephone: "",

        role: "user",

        isBlocked: false,

        isEmailVerified: true,
      });

      await user.save();
    }

    // =========================================
    // BLOCK CHECK
    // =========================================

    if (user.isBlocked) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    // =========================================
    // IF GOOGLE EMAIL VERIFIED
    // =========================================

    if (user.isEmailVerified === false) {
      user.isEmailVerified = true;

      await user.save();
    }

    // =========================================
    // CREATE OUR JWT
    // =========================================

    const token = jwt.sign(
      {
        email: user.email,

        fullName: user.fullName,

        telephone: user.telephone,

        role: user.role,

        isEmailVerified: user.isEmailVerified,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      },
    );

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Google login successful",

      token: token,

      user: {
        email: user.email,

        fullName: user.fullName,

        telephone: user.telephone,

        role: user.role,

        isEmailVerified: user.isEmailVerified,

        Image: user.Image,
      },
    });
  } catch (err) {
    console.error("Google Login Error:", err);

    res.status(401).json({
      message: "Google login failed",

      error: err.message,
    });
  }
}

// =====================================================
// ADMIN CHECK
// =====================================================

export function isAdmin(req) {
  if (req.user == null) {
    return false;
  }

  if (req.user.role !== "admin") {
    return false;
  }

  return true;
}

// =====================================================
// CUSTOMER CHECK
// =====================================================

export function isCustomer(req) {
  if (req.user == null) {
    return false;
  }

  if (req.user.role !== "user") {
    return false;
  }

  return true;
}

// =====================================================
// OLD SPELLING SUPPORT
// =====================================================

// orderController.js එකේ දැනට isCustommer use කරනවා නම්
// code එක break නොවෙන්න මේක තියාගන්න පුළුවන්

export const isCustommer = isCustomer;

// =====================================================
// GET LOGGED USER
// =====================================================

export async function getUser(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =========================================
    // GET LATEST USER FROM DATABASE
    // =========================================

    const user = await User.findOne({
      email: req.user.email,
    })

      .select("-password");

    if (user == null) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        message: "Your account has been blocked",
      });

      return;
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Get User Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// UPDATE PROFILE IMAGE
// =====================================================

export async function updateProfileImage(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    const imageUrl = req.body.Image;

    if (imageUrl == null || imageUrl.trim() === "") {
      res.status(400).json({
        message: "Image URL is required",
      });

      return;
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        email: req.user.email,
      },

      {
        Image: imageUrl.trim(),
      },

      {
        new: true,

        runValidators: true,
      },
    )

      .select("-password");

    if (updatedUser == null) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    res.status(200).json({
      message: "Profile image updated successfully",

      user: updatedUser,
    });
  } catch (err) {
    console.error("Update Profile Image Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// UPDATE PROFILE
// =====================================================

export async function updateProfile(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    const fullName = req.body.fullName?.trim();

    const telephone = req.body.telephone?.trim() || "";

    if (fullName == null || fullName === "") {
      res.status(400).json({
        message: "Full name is required",
      });

      return;
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        email: req.user.email,
      },

      {
        fullName: fullName,

        telephone: telephone,
      },

      {
        new: true,

        runValidators: true,
      },
    ).select("-password");

    if (updatedUser == null) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    res.status(200).json({
      message: "Profile updated successfully",

      user: updatedUser,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// FORGOT PASSWORD - SEND OTP
// POST /api/users/forgot-password/send-otp
// Body: { email }
// =====================================================

export async function sendOTP(req, res) {
  const email = req.body.email?.toString().trim().toLowerCase();

  if (!email) {
    res.status(400).json({
      message: "Email is required",
    });

    return;
  }

  try {
    // =========================================
    // CHECK USER
    // =========================================

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      res.status(404).json({
        message: "No account found with this email",
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
    // CREATE CRYPTO-SECURE 6-DIGIT OTP
    // =========================================

    const otp = crypto.randomInt(100000, 1000000);

    // =========================================
    // REPLACE OLD OTP
    // =========================================

    await OTP.deleteMany({
      email: email,
    });

    const newOTP = new OTP({
      email: email,
      otp: otp,
    });

    await newOTP.save();

    // =========================================
    // SEND EMAIL THROUGH RESEND HTTPS API
    // =========================================

    const { data, error } = await getResendClient().emails.send({
      from: getResendFromEmail(),

      to: [email],

      subject: "Your NariCraft password reset code",

      text:
        `Your NariCraft password reset OTP is ${otp}. ` +
        `Do not share this code with anyone.`,

      html: `
        <div style="margin:0;padding:32px 16px;background:#f8f1e8;font-family:Arial,Helvetica,sans-serif;color:#3f2028;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eadbc7;">
            <div style="background:#6b1d2f;padding:28px;text-align:center;">
              <div style="font-size:13px;letter-spacing:3px;color:#e8c34d;font-weight:700;">NARICRAFT</div>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:24px;">Password Reset</h1>
            </div>

            <div style="padding:32px;text-align:center;">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">
                Use this verification code to reset your NariCraft password.
              </p>

              <div style="margin:24px auto;padding:18px 20px;max-width:260px;border-radius:14px;background:#fff8e5;border:1px solid #e2c45d;font-size:34px;letter-spacing:8px;font-weight:800;color:#6b1d2f;">
                ${otp}
              </div>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#826f75;">
                If you did not request a password reset, you can ignore this email.
                Never share this code with anyone.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      // Don't leave a usable OTP in MongoDB if email delivery failed.
      await OTP.deleteMany({
        email: email,
      });

      console.error("Resend OTP Email Error:", error);

      res.status(502).json({
        message: "Unable to send OTP email",
      });

      return;
    }

    console.log("OTP email accepted by Resend:", data?.id || "unknown-id");

    res.status(200).json({
      message: "OTP sent to your email successfully",
    });
  } catch (err) {
    console.error("Send OTP Error:", err);

    // Remove a newly-created OTP after any email/API failure.
    try {
      await OTP.deleteMany({
        email: email,
      });
    } catch (cleanupError) {
      console.error("OTP cleanup error:", cleanupError.message);
    }

    res.status(500).json({
      message: "Unable to send OTP email",
    });
  }
}

// =====================================================
// FORGOT PASSWORD - RESET PASSWORD
// POST /api/users/forgot-password/reset
// Body: { email, otp, newPassword }
// =====================================================

export async function changePasswordOTP(req, res) {
  const email = req.body.email?.toString().trim().toLowerCase();

  const otp = Number(req.body.otp);

  const newPassword = req.body.newPassword;

  if (!email || !Number.isInteger(otp) || !newPassword) {
    res.status(400).json({
      message: "Email, OTP and new password are required",
    });

    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({
      message: "Password must be at least 6 characters",
    });

    return;
  }

  try {
    const otpRecord = await OTP.findOne({
      email: email,
      otp: otp,
    });

    if (!otpRecord) {
      res.status(400).json({
        message: "Invalid or expired OTP",
      });

      return;
    }

    const user = await User.findOne({
      email: email,
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate(
      {
        email: email,
      },
      {
        $set: {
          password: hashedPassword,
        },
      },
      {
        runValidators: true,
      },
    );

    // OTP is one-time use. Delete only after password update succeeds.
    await OTP.deleteMany({
      email: email,
    });

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password OTP Error:", error);

    res.status(500).json({
      message: "Error changing password",
    });
  }
}
