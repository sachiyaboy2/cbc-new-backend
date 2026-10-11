import User from "../models/user.js";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

import crypto from "crypto";

import { OAuth2Client } from "google-auth-library";

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
