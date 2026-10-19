import User from "../models/user.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

import crypto from "crypto";

import { OAuth2Client } from "google-auth-library";

import dotenv from "dotenv";
import nodemailer from "nodemailer";
import OTP from "../models/otpModel.js";
import dns from "node:dns"; 

dns.setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.APP_PASSWORD,
  },
});
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
// =====================================================

export async function sendOTP(req, res) {
  try {
    // =========================================
    // GET EMAIL
    // =========================================

    const email = req.body.email?.toString().trim().toLowerCase();

    if (!email) {
      res.status(400).json({
        message: "Email address is required",
      });

      return;
    }

    // =========================================
    // CHECK USER
    // =========================================

    const user = await User.findOne({
      email: email,
    });

    /*
      Security:
      account එක නැති email එකක් දැම්මත්
      "user not found" කියලා expose කරන්නේ නැහැ.
    */

    if (user == null) {
      res.status(200).json({
        message: "If an account exists with this email, an OTP has been sent.",
      });

      return;
    }

    // =========================================
    // BLOCKED USER
    // =========================================

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "This account has been blocked",
      });

      return;
    }

    // =========================================
    // GENERATE SECURE 6 DIGIT OTP
    // =========================================

    const otp = crypto.randomInt(100000, 1000000).toString();

    // =========================================
    // HASH OTP
    // =========================================

    const hashedOTP = await bcrypt.hash(otp, 10);

    // =========================================
    // DELETE OLD OTP
    // =========================================

    await OTP.deleteMany({
      email: email,
    });

    // =========================================
    // OTP EXPIRY - 10 MINUTES
    // =========================================

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // =========================================
    // SAVE OTP
    // =========================================

    const newOTP = new OTP({
      email: email,

      otp: hashedOTP,

      expiresAt: expiresAt,
    });

    await newOTP.save();

    // =========================================
    // SEND EMAIL
    // =========================================

    await transporter.sendMail({
      from: `"NariCraft" <${process.env.EMAIL_USER}>`,

      to: email,

      subject: "NariCraft Password Reset OTP",

      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 520px;
            margin: auto;
            padding: 30px;
            background: #f6ede2;
            border-radius: 20px;
            border: 1px solid #ead8c2;
          "
        >

          <h2
            style="
              color: #5b1a2b;
              margin-bottom: 10px;
            "
          >
            NariCraft Password Reset
          </h2>

          <p
            style="
              color: #765f52;
              line-height: 1.7;
            "
          >
            We received a request to reset your
            NariCraft account password.
          </p>

          <p
            style="
              color: #765f52;
            "
          >
            Your verification code is:
          </p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              text-align: center;
              color: #d99b21;
              background: white;
              padding: 20px;
              border-radius: 14px;
              margin: 20px 0;
            "
          >
            ${otp}
          </div>

          <p
            style="
              color: #765f52;
              line-height: 1.7;
            "
          >
            This OTP will expire in
            <strong>10 minutes</strong>.
          </p>

          <p
            style="
              color: #9b8374;
              font-size: 12px;
            "
          >
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

        </div>
      `,
    });

    // =========================================
    // SUCCESS
    // =========================================

    res.status(200).json({
      message: "OTP sent successfully. Please check your email.",
    });
  } catch (err) {
    console.error("Send OTP Error:", err);

    res.status(500).json({
      message: "Unable to send OTP. Please try again.",

      error: err.message,
    });
  }
}

// =====================================================
// FORGOT PASSWORD - RESET PASSWORD
// =====================================================

export async function changePasswordOTP(req, res) {
  try {
    // =========================================
    // GET DATA
    // =========================================

    const email = req.body.email?.toString().trim().toLowerCase();

    const otp = req.body.otp?.toString().trim();

    const newPassword = req.body.newPassword;

    // =========================================
    // VALIDATION
    // =========================================

    if (!email || !otp || !newPassword) {
      res.status(400).json({
        message: "Email, OTP and new password are required",
      });

      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({
        message: "OTP must contain 6 digits",
      });

      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        message: "Password must be at least 6 characters",
      });

      return;
    }

    // =========================================
    // CHECK USER
    // =========================================

    const user = await User.findOne({
      email: email,
    });

    if (user == null) {
      res.status(404).json({
        message: "Unable to reset password",
      });

      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        message: "This account has been blocked",
      });

      return;
    }

    // =========================================
    // FIND OTP RECORD
    // =========================================

    const otpRecord = await OTP.findOne({
      email: email,
    });

    if (otpRecord == null) {
      res.status(400).json({
        message: "OTP is invalid or has expired",
      });

      return;
    }

    // =========================================
    // CHECK EXPIRY
    // =========================================

    if (new Date() > new Date(otpRecord.expiresAt)) {
      await OTP.deleteMany({
        email: email,
      });

      res.status(400).json({
        message: "OTP has expired. Please request a new OTP.",
      });

      return;
    }

    // =========================================
    // VERIFY HASHED OTP
    // =========================================

    const otpIsValid = await bcrypt.compare(otp, otpRecord.otp);

    if (!otpIsValid) {
      res.status(400).json({
        message: "Invalid OTP",
      });

      return;
    }

    // =========================================
    // HASH NEW PASSWORD
    // =========================================

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // =========================================
    // UPDATE USER PASSWORD
    // =========================================

    user.password = hashedPassword;

    await user.save();

    // =========================================
    // DELETE OTP AFTER SUCCESS
    // =========================================

    await OTP.deleteMany({
      email: email,
    });

    // =========================================
    // SUCCESS
    // =========================================

    res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (err) {
    console.error("Password Reset Error:", err);

    res.status(500).json({
      message: "Error resetting password",

      error: err.message,
    });
  }
}
