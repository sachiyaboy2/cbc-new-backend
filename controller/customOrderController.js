import CustomOrder from "../models/customOrder.js";
import MeasurementProfile from "../models/measurementProfile.js";
import User from "../models/user.js";
import { isAdmin } from "./userController.js";

// =====================================================
// GARMENT CONFIG
// =====================================================

const garmentConfig = {
  "saree-jacket": {
    label: "Saree Jacket",

    profileKey: "sareeJacket",

    requiredFields: [
      "height",
      "shoulder",
      "bust",
      "abdomen",
      "frontNeckDepth",
      "backNeckDepth",
      "topToBustPoint",
      "sideToBustPoint",
      "sleeveLength",
      "sleeveCircumference",
      "armhole",
    ],
  },

  frock: {
    label: "Frock",

    profileKey: "frock",

    requiredFields: [
      "shoulder",
      "waistLength",
      "bust",
      "waist",
      "sleeveCircumference",
      "armhole",
      "skirtLength",
      "frontNeckDepth",
    ],
  },

  "crop-top": {
    label: "Crop Top",

    profileKey: "cropTop",

    requiredFields: [
      "height",
      "shoulder",
      "waistLength",
      "bust",
      "waist",
      "sleeveCircumference",
      "armhole",
      "frontNeckDepth",
    ],
  },
};

// =====================================================
// MEASUREMENT LABELS
// =====================================================

const measurementLabels = {
  height: "Height",
  shoulder: "Shoulder",
  bust: "Bust",
  abdomen: "Abdomen",
  waist: "Waist",
  waistLength: "Waist Length",
  frontNeckDepth: "Front Neck Depth",
  backNeckDepth: "Back Neck Depth",
  topToBustPoint: "Top to Bust Point",
  sideToBustPoint: "Side to Bust Point",
  sleeveLength: "Sleeve Length",
  sleeveCircumference: "Sleeve Circumference",
  armhole: "Armhole",
  skirtLength: "Skirt Length",
};

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

    // Legacy fields
    underBust: null,
    frontNeck: null,
    backNeck: null,
    jacketLength: null,
  };
}

// =====================================================
// CREATE CUSTOM ORDER
// =====================================================

export async function createCustomOrder(req, res) {
  try {
    // =========================================
    // LOGIN CHECK
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =========================================
    // GET LATEST USER DATA
    // =========================================

    const user = await User.findOne({
      email: req.user.email,
    });

    if (user == null) {
      res.status(404).json({
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
    // CUSTOMER FULL NAME
    // =========================================

    const customerFullName = (
      user.fullName ||
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      req.user?.fullName ||
      ""
    )
      .toString()
      .trim();

    if (customerFullName === "") {
      res.status(400).json({
        message:
          "Your account does not have a full name. Please update your profile first.",
      });

      return;
    }

    // =========================================
    // CUSTOMER EMAIL
    // =========================================

    const customerEmail = (user.email || req.user.email)
      .toString()
      .trim()
      .toLowerCase();

    // =========================================
    // REQUEST DATA
    // =========================================

    const {
      telephone,

      designImage,

      garmentType,

      measurementType,

      standardSize,

      measurementUnit,

      measurements,

      customerProvidesFabric,

      notes,

      saveMeasurements,
    } = req.body;

    // =========================================
    // PHONE NUMBER
    // =========================================

    const orderTelephone = (
      telephone ||
      user.telephone ||
      user.phone ||
      req.user?.telephone ||
      ""
    )
      .toString()
      .trim();

    if (orderTelephone === "") {
      res.status(400).json({
        message: "Phone number is required",
      });

      return;
    }

    // =========================================
    // DESIGN IMAGE
    // =========================================

    if (
      !designImage ||
      typeof designImage !== "string" ||
      designImage.trim() === ""
    ) {
      res.status(400).json({
        message: "Design image is required",
      });

      return;
    }

    // =========================================
    // GARMENT TYPE
    // =========================================

    const config = garmentConfig[garmentType];

    if (!config) {
      res.status(400).json({
        message: "Please select a valid garment type",
      });

      return;
    }

    // =========================================
    // MEASUREMENT TYPE
    // =========================================

    if (measurementType !== "standard" && measurementType !== "custom") {
      res.status(400).json({
        message: "Invalid measurement type",
      });

      return;
    }

    // =========================================
    // STANDARD SIZE
    // =========================================

    const allowedSizes = ["S", "M", "L", "XL", "2XL"];

    if (measurementType === "standard") {
      if (!allowedSizes.includes(standardSize)) {
        res.status(400).json({
          message: "Please select a valid standard size",
        });

        return;
      }
    }

    // =========================================
    // DEFAULT MEASUREMENTS
    // =========================================

    let finalMeasurements = createEmptyMeasurements();

    let finalUnit = "in";

    // =========================================
    // CUSTOM MEASUREMENTS
    // =========================================

    if (measurementType === "custom") {
      // ===============================
      // UNIT CHECK
      // ===============================

      if (measurementUnit !== "in" && measurementUnit !== "cm") {
        res.status(400).json({
          message: "Please select inches or centimeters",
        });

        return;
      }

      // ===============================
      // VALIDATE ONLY SELECTED GARMENT
      // FIELDS
      // ===============================

      for (let i = 0; i < config.requiredFields.length; i++) {
        const field = config.requiredFields[i];

        const value = Number(measurements?.[field]);

        if (!Number.isFinite(value) || value <= 0) {
          res.status(400).json({
            message: `Please enter a valid ${
              measurementLabels[field] || field
            } measurement`,
          });

          return;
        }

        finalMeasurements[field] = value;
      }

      finalUnit = measurementUnit;
    }

    // =========================================
    // CREATE CUSTOM ORDER ID
    // =========================================

    const lastOrder = await CustomOrder.findOne().sort({
      createdAt: -1,
    });

    let nextNumber = 1;

    if (lastOrder && lastOrder.customOrderId) {
      const oldNumber = parseInt(lastOrder.customOrderId.replace("CD", ""));

      if (!isNaN(oldNumber)) {
        nextNumber = oldNumber + 1;
      }
    }

    const customOrderId = "CD" + String(nextNumber).padStart(9, "0");

    // =========================================
    // CREATE CUSTOM ORDER
    // =========================================

    const customOrder = new CustomOrder({
      customOrderId: customOrderId,

      // CUSTOMER

      email: customerEmail,

      fullName: customerFullName,

      telephone: orderTelephone,

      // DESIGN

      designImage: designImage.trim(),

      // GARMENT

      garmentType: garmentType,

      // SIZE

      measurementType: measurementType,

      standardSize: measurementType === "standard" ? standardSize : null,

      measurementUnit: finalUnit,

      measurements: finalMeasurements,

      // FABRIC

      customerProvidesFabric: customerProvidesFabric === true,

      // NOTES

      notes: typeof notes === "string" ? notes.trim() : "",

      // PRICE

      price: null,

      // PAYMENT

      paymentStatus: "Price Pending",

      paymentPlan: null,

      paidAmount: 0,

      remainingAmount: 0,

      balanceStatus: "Not Applicable",

      payherePaymentId: "",

      onlinePaymentAt: null,

      paymentCompletedAt: null,

      // DELIVERY

      deliveryAddress: "",

      city: "",

      district: "",

      // STATUS

      status: "Pending",

      // CANCELLATION

      cancelReason: "",

      cancelledAt: null,
    });

    // =========================================
    // SAVE ORDER
    // =========================================

    await customOrder.save();

    // =========================================
    // SAVE GARMENT-SPECIFIC MEASUREMENTS
    // =========================================

    if (measurementType === "custom" && saveMeasurements === true) {
      const profilePath = `garmentProfiles.${config.profileKey}`;

      await MeasurementProfile.findOneAndUpdate(
        {
          email: customerEmail,
        },

        {
          $set: {
            email: customerEmail,

            [profilePath]: {
              measurementUnit: finalUnit,

              measurements: finalMeasurements,
            },
          },
        },

        {
          upsert: true,

          new: true,

          runValidators: true,

          setDefaultsOnInsert: true,
        },
      );
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(201).json({
      message: "Custom design order submitted successfully",

      order: customOrder,
    });
  } catch (err) {
    console.error("Create Custom Order Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// GET CUSTOM ORDERS
//
// Customer -> Own orders
// Admin    -> All orders
// =====================================================

export async function getCustomOrders(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =========================================
    // ADMIN
    // =========================================

    if (req.user.role?.toLowerCase() === "admin") {
      const orders = await CustomOrder.find().sort({
        createdAt: -1,
      });

      res.status(200).json(orders);

      return;
    }

    // =========================================
    // CUSTOMER EMAIL
    // =========================================

    const customerEmail = req.user.email?.toString().trim().toLowerCase();

    if (!customerEmail) {
      res.status(400).json({
        message: "User email not found",
      });

      return;
    }

    // =========================================
    // OWN ORDERS ONLY
    // =========================================

    const orders = await CustomOrder.find({
      email: customerEmail,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(orders);
  } catch (err) {
    console.error("Get Custom Orders Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// GET ONE CUSTOM ORDER
// =====================================================

export async function getCustomOrderById(req, res) {
  try {
    // =========================================
    // LOGIN
    // =========================================

    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    // =========================================
    // ORDER ID
    // =========================================

    const customOrderId = req.params.customOrderId?.toString().trim();

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    // =========================================
    // FIND ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId: customOrderId,
    });

    if (!order) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // OWNER OR ADMIN
    // =========================================

    const loggedUserEmail = req.user.email?.toString().trim().toLowerCase();

    const orderEmail = order.email?.toString().trim().toLowerCase();

    if (
      req.user.role?.toLowerCase() !== "admin" &&
      orderEmail !== loggedUserEmail
    ) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json(order);
  } catch (err) {
    console.error("Get Custom Order Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// ADMIN SET / UPDATE PRICE
// =====================================================

export async function updateCustomOrderPrice(req, res) {
  try {
    // =========================================
    // ADMIN
    // =========================================

    if (!isAdmin(req)) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // ORDER ID
    // =========================================

    const customOrderId = req.params.customOrderId?.toString().trim();

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    // =========================================
    // PRICE
    // =========================================

    const price = Number(req.body.price);

    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({
        message: "Please enter a valid price",
      });

      return;
    }

    // =========================================
    // FIND ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId: customOrderId,
    });

    if (order == null) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // CANCELLED
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Price cannot be changed for a cancelled order",
      });

      return;
    }

    // =========================================
    // PAYMENT SAFETY
    // =========================================

    if (
      order.paymentStatus === "Partially Paid" ||
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Chargedback"
    ) {
      res.status(400).json({
        message: "Price cannot be changed after payment has been processed",
      });

      return;
    }

    // =========================================
    // ACTIVE PAYMENT ATTEMPT
    // =========================================

    if (
      order.paymentStatus === "Payment Pending" &&
      order.paymentPlan != null
    ) {
      res.status(400).json({
        message:
          "Price cannot be changed while a customer payment attempt is pending",
      });

      return;
    }

    // =========================================
    // UPDATE PRICE
    // =========================================

    const updatedOrder = await CustomOrder.findOneAndUpdate(
      {
        customOrderId: customOrderId,
      },

      {
        $set: {
          price: price,

          paymentStatus: "Payment Pending",

          paymentPlan: null,

          paidAmount: 0,

          remainingAmount: price,

          balanceStatus: "Not Applicable",

          payherePaymentId: "",

          onlinePaymentAt: null,

          paymentCompletedAt: null,
        },
      },

      {
        new: true,

        runValidators: true,
      },
    );

    if (updatedOrder == null) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Custom order price updated successfully",

      order: updatedOrder,
    });
  } catch (err) {
    console.error("Update Custom Order Price Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// ADMIN UPDATE ORDER STATUS
// =====================================================

export async function updateCustomOrderStatus(req, res) {
  try {
    // =========================================
    // ADMIN
    // =========================================

    if (!isAdmin(req)) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // DATA
    // =========================================

    const customOrderId = req.params.customOrderId?.toString().trim();

    const newStatus = req.body.status;

    const cancelReason =
      typeof req.body.cancelReason === "string"
        ? req.body.cancelReason.trim()
        : "";

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    // =========================================
    // ALLOWED STATUS
    // =========================================

    const allowedStatuses = [
      "Pending",
      "Reviewed",
      "Accepted",
      "In Progress",
      "Ready",
      "Completed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(newStatus)) {
      res.status(400).json({
        message: "Invalid custom order status",
      });

      return;
    }

    // =========================================
    // CANCEL REASON
    // =========================================

    if (newStatus === "Cancelled" && cancelReason === "") {
      res.status(400).json({
        message: "Please provide a cancellation reason",
      });

      return;
    }

    // =========================================
    // FIND ORDER
    // =========================================

    const currentOrder = await CustomOrder.findOne({
      customOrderId: customOrderId,
    });

    if (!currentOrder) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // COMPLETED SAFETY
    // =========================================

    if (
      newStatus === "Completed" &&
      currentOrder.paymentStatus === "Partially Paid"
    ) {
      res.status(400).json({
        message: "Collect the remaining payment before completing the order",
      });

      return;
    }

    // =========================================
    // UPDATE DATA
    // =========================================

    const updateData = {
      status: newStatus,
    };

    if (newStatus === "Cancelled") {
      updateData.cancelReason = cancelReason;

      updateData.cancelledAt = new Date();
    } else {
      updateData.cancelReason = "";

      updateData.cancelledAt = null;
    }

    // =========================================
    // UPDATE
    // =========================================

    const updatedOrder = await CustomOrder.findOneAndUpdate(
      {
        customOrderId: customOrderId,
      },

      {
        $set: updateData,
      },

      {
        new: true,

        runValidators: true,
      },
    );

    if (updatedOrder == null) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    res.status(200).json({
      message:
        newStatus === "Cancelled"
          ? "Custom order cancelled successfully"
          : "Custom order status updated successfully",

      order: updatedOrder,
    });
  } catch (err) {
    console.error("Update Custom Order Status Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// ADMIN UPDATE PAYMENT STATUS
//
// Successful online payment states are controlled
// by verified payment callback.
// =====================================================

export async function updateCustomOrderPaymentStatus(req, res) {
  try {
    // =========================================
    // ADMIN
    // =========================================

    if (!isAdmin(req)) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // DATA
    // =========================================

    const customOrderId = req.params.customOrderId?.toString().trim();

    const paymentStatus = req.body.paymentStatus;

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    // =========================================
    // MANUAL STATUS SAFETY
    // =========================================

    const allowedManualStatuses = ["Price Pending", "Payment Pending"];

    if (!allowedManualStatuses.includes(paymentStatus)) {
      res.status(400).json({
        message: "Paid and Partially Paid are controlled by the payment system",
      });

      return;
    }

    // =========================================
    // FIND ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId: customOrderId,
    });

    if (order == null) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // DO NOT OVERWRITE VERIFIED PAYMENT
    // =========================================

    if (
      order.paymentStatus === "Partially Paid" ||
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "Chargedback"
    ) {
      res.status(400).json({
        message: "Verified payment status cannot be changed manually",
      });

      return;
    }

    // =========================================
    // PAYMENT PENDING REQUIRES PRICE
    // =========================================

    if (
      paymentStatus === "Payment Pending" &&
      (order.price == null || Number(order.price) <= 0)
    ) {
      res.status(400).json({
        message: "Please set the custom order price first",
      });

      return;
    }

    // =========================================
    // PRICE PENDING VALIDATION
    // =========================================

    if (
      paymentStatus === "Price Pending" &&
      order.price != null &&
      Number(order.price) > 0
    ) {
      res.status(400).json({
        message: "This order already has a price",
      });

      return;
    }

    // =========================================
    // UPDATE
    // =========================================

    const updatedOrder = await CustomOrder.findOneAndUpdate(
      {
        customOrderId: customOrderId,
      },

      {
        $set: {
          paymentStatus: paymentStatus,
        },
      },

      {
        new: true,

        runValidators: true,
      },
    );

    if (!updatedOrder) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    res.status(200).json({
      message: "Payment status updated successfully",

      order: updatedOrder,
    });
  } catch (err) {
    console.error("Update Payment Status Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// ADMIN COLLECT HALF PAYMENT BALANCE
// =====================================================

export async function collectCustomOrderBalance(req, res) {
  try {
    // =========================================
    // ADMIN
    // =========================================

    if (!isAdmin(req)) {
      res.status(403).json({
        message: "Forbidden",
      });

      return;
    }

    // =========================================
    // ORDER ID
    // =========================================

    const customOrderId = req.params.customOrderId?.toString().trim();

    if (!customOrderId) {
      res.status(400).json({
        message: "Custom order ID is required",
      });

      return;
    }

    // =========================================
    // FIND ORDER
    // =========================================

    const order = await CustomOrder.findOne({
      customOrderId: customOrderId,
    });

    if (order == null) {
      res.status(404).json({
        message: "Custom order not found",
      });

      return;
    }

    // =========================================
    // CANCELLED
    // =========================================

    if (order.status === "Cancelled") {
      res.status(400).json({
        message: "Cannot collect balance for a cancelled order",
      });

      return;
    }

    // =========================================
    // HALF PAYMENT ONLY
    // =========================================

    if (order.paymentPlan !== "Half Payment") {
      res.status(400).json({
        message: "This order is not using the 50% payment plan",
      });

      return;
    }

    // =========================================
    // MUST BE PARTIALLY PAID
    // =========================================

    if (
      order.paymentStatus !== "Partially Paid" ||
      order.balanceStatus !== "Pending"
    ) {
      res.status(400).json({
        message: "There is no pending delivery balance for this order",
      });

      return;
    }

    // =========================================
    // AMOUNTS
    // =========================================

    const totalPrice = Number(order.price);

    const remainingAmount = Number(order.remainingAmount);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        message: "Invalid custom order price",
      });

      return;
    }

    if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
      res.status(400).json({
        message: "No remaining balance to collect",
      });

      return;
    }

    // =========================================
    // MARK BALANCE COLLECTED
    // =========================================

    const updatedOrder = await CustomOrder.findOneAndUpdate(
      {
        customOrderId: customOrderId,

        paymentStatus: "Partially Paid",

        balanceStatus: "Pending",
      },

      {
        $set: {
          paidAmount: totalPrice,

          remainingAmount: 0,

          balanceStatus: "Collected",

          paymentStatus: "Paid",

          paymentCompletedAt: new Date(),
        },
      },

      {
        new: true,

        runValidators: true,
      },
    );

    if (updatedOrder == null) {
      res.status(409).json({
        message:
          "Order payment state changed before the balance could be collected",
      });

      return;
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Remaining balance marked as collected",

      order: updatedOrder,
    });
  } catch (err) {
    console.error("Collect Custom Order Balance Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}
