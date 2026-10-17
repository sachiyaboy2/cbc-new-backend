import User from "../models/user.js";
import bcrypt from "bcrypt";

// =====================================================
// CHECK CURRENT ADMIN FROM DATABASE
// =====================================================

async function getCurrentAdmin(req) {
  if (req.user == null || !req.user.email) {
    return null;
  }

  const admin = await User.findOne({
    email: req.user.email,
  });

  if (admin == null || admin.role !== "admin" || admin.isBlocked === true) {
    return null;
  }

  return admin;
}

// =====================================================
// GET ALL USERS
// =====================================================

export async function getAllUsersAdmin(req, res) {
  try {
    const admin = await getCurrentAdmin(req);

    if (admin == null) {
      res.status(403).json({
        message: "Admin access required",
      });

      return;
    }

    const users = await User.find().select("-password").sort({
      createdAt: -1,
      _id: -1,
    });

    res.status(200).json(users);
  } catch (err) {
    console.error("Admin Get Users Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// GET ONE USER
// =====================================================

export async function getUserByIdAdmin(req, res) {
  try {
    const admin = await getCurrentAdmin(req);

    if (admin == null) {
      res.status(403).json({
        message: "Admin access required",
      });

      return;
    }

    const user = await User.findById(req.params.userId).select("-password");

    if (user == null) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Admin Get User Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// UPDATE USER
// =====================================================

export async function updateUserAdmin(req, res) {
  try {
    const admin = await getCurrentAdmin(req);

    if (admin == null) {
      res.status(403).json({
        message: "Admin access required",
      });

      return;
    }

    // =========================================
    // FIND USER
    // =========================================

    const user = await User.findById(req.params.userId);

    if (user == null) {
      res.status(404).json({
        message: "User not found",
      });

      return;
    }

    // =========================================
    // REQUEST DATA
    // =========================================

    const fullName = req.body.fullName?.toString().trim();

    const telephone = req.body.telephone?.toString().trim() || "";

    const role = req.body.role;

    const isBlocked = req.body.isBlocked;

    const isEmailVerified = req.body.isEmailVerified;

    // =========================================
    // FULL NAME VALIDATION
    // =========================================

    if (fullName == null || fullName === "") {
      res.status(400).json({
        message: "Full name is required",
      });

      return;
    }

    // =========================================
    // ROLE VALIDATION
    // =========================================

    const allowedRoles = ["user", "admin"];

    if (!allowedRoles.includes(role)) {
      res.status(400).json({
        message: "Invalid user role",
      });

      return;
    }

    // =========================================
    // BOOLEAN VALIDATION
    // =========================================

    if (typeof isBlocked !== "boolean") {
      res.status(400).json({
        message: "Invalid blocked status",
      });

      return;
    }

    if (typeof isEmailVerified !== "boolean") {
      res.status(400).json({
        message: "Invalid email verification status",
      });

      return;
    }

    // =========================================
    // PREVENT ADMIN FROM BLOCKING / DEMOTING SELF
    // =========================================

    const editingSelf = user.email.toLowerCase() === admin.email.toLowerCase();

    if (editingSelf && isBlocked === true) {
      res.status(400).json({
        message: "You cannot block your own admin account",
      });

      return;
    }

    if (editingSelf && role !== "admin") {
      res.status(400).json({
        message: "You cannot remove your own admin role",
      });

      return;
    }

    // =========================================
    // UPDATE
    // =========================================

    user.fullName = fullName;

    user.telephone = telephone;

    user.role = role;

    user.isBlocked = isBlocked;

    user.isEmailVerified = isEmailVerified;

    await user.save();

    // =========================================
    // SAFE RESPONSE WITHOUT PASSWORD
    // =========================================

    const updatedUser = await User.findById(user._id).select("-password");

    res.status(200).json({
      message: "User updated successfully",

      user: updatedUser,
    });
  } catch (err) {
    console.error("Admin Update User Error:", err);

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

// =====================================================
// ADMIN CREATE USER
// =====================================================

export async function createUserAdmin(req, res) {
  try {
    const admin = await getCurrentAdmin(req);

    if (admin == null) {
      res.status(403).json({
        message: "Admin access required",
      });

      return;
    }

    // =========================================
    // GET DATA
    // =========================================

    const email = req.body.email?.toString().trim().toLowerCase();

    const fullName = req.body.fullName?.toString().trim();

    const telephone = req.body.telephone?.toString().trim() || "";

    const password = req.body.password;

    const role = req.body.role || "user";

    const isEmailVerified = req.body.isEmailVerified === true;

    // =========================================
    // VALIDATION
    // =========================================

    if (!email || !fullName || !password) {
      res.status(400).json({
        message: "Full name, email and password are required",
      });

      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        message: "Password must be at least 6 characters",
      });

      return;
    }

    if (role !== "user" && role !== "admin") {
      res.status(400).json({
        message: "Invalid user role",
      });

      return;
    }

    // =========================================
    // CHECK EMAIL
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

      role: role,

      isBlocked: false,

      isEmailVerified: isEmailVerified,
    });

    await user.save();

    // =========================================
    // SAFE USER RESPONSE
    // =========================================

    const createdUser = await User.findById(user._id).select("-password");

    res.status(201).json({
      message: "User created successfully",

      user: createdUser,
    });
  } catch (err) {
    console.error("Admin Create User Error:", err);

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
