import MeasurementProfile from "../models/measurementProfile.js";

// =====================================================
// GARMENT CONFIG
// =====================================================

const garmentConfig = {
  "saree-jacket": {
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
// GET SAVED MEASUREMENTS
// =====================================================

export async function getMyMeasurements(req, res) {
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
    // EMAIL
    // =========================================

    const email = req.user.email?.toString().trim().toLowerCase();

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });

      return;
    }

    // =========================================
    // FIND PROFILE
    // =========================================

    const profile = await MeasurementProfile.findOne({
      email: email,
    });

    // =========================================
    // NO PROFILE
    // =========================================

    if (profile == null) {
      res.status(200).json({
        hasSavedMeasurements: false,

        profile: null,
      });

      return;
    }

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      hasSavedMeasurements: true,

      profile: profile,
    });
  } catch (err) {
    console.error("Get Measurements Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// SAVE / UPDATE GARMENT MEASUREMENTS
// =====================================================

export async function saveMyMeasurements(req, res) {
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
    // EMAIL
    // =========================================

    const email = req.user.email?.toString().trim().toLowerCase();

    if (!email) {
      res.status(400).json({
        message: "User email not found",
      });

      return;
    }

    // =========================================
    // REQUEST DATA
    // =========================================

    const { garmentType, measurementUnit, measurements } = req.body;

    // =========================================
    // GARMENT TYPE
    // =========================================

    const config = garmentConfig[garmentType];

    if (!config) {
      res.status(400).json({
        message: "Invalid garment type",
      });

      return;
    }

    // =========================================
    // UNIT
    // =========================================

    if (measurementUnit !== "in" && measurementUnit !== "cm") {
      res.status(400).json({
        message: "Invalid measurement unit",
      });

      return;
    }

    // =========================================
    // VALIDATE MEASUREMENTS
    // =========================================

    const cleanedMeasurements = {};

    for (let i = 0; i < config.requiredFields.length; i++) {
      const field = config.requiredFields[i];

      const value = Number(measurements?.[field]);

      if (!Number.isFinite(value) || value <= 0) {
        res.status(400).json({
          message: `Invalid ${field} measurement`,
        });

        return;
      }

      cleanedMeasurements[field] = value;
    }

    // =========================================
    // PROFILE PATH
    // =========================================

    const profilePath = `garmentProfiles.${config.profileKey}`;

    // =========================================
    // UPDATE PROFILE
    // =========================================

    const profile = await MeasurementProfile.findOneAndUpdate(
      {
        email: email,
      },

      {
        $set: {
          email: email,

          [profilePath]: {
            measurementUnit: measurementUnit,

            measurements: cleanedMeasurements,
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

    // =========================================
    // RESPONSE
    // =========================================

    res.status(200).json({
      message: "Measurements saved successfully",

      garmentType: garmentType,

      profile: profile,
    });
  } catch (err) {
    console.error("Save Measurements Error:", err.message);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}
