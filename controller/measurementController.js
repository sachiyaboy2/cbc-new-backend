import MeasurementProfile from "../models/measurementProfile.js";

// =====================================================
// GET SAVED MEASUREMENTS
// =====================================================

export async function getMyMeasurements(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    const profile = await MeasurementProfile.findOne({
      email: req.user.email,
    });

    if (profile == null) {
      res.status(200).json({
        hasSavedMeasurements: false,
      });

      return;
    }

    res.status(200).json({
      hasSavedMeasurements: true,

      profile: profile,
    });
  } catch (err) {
    console.error("Get Measurements Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}

// =====================================================
// SAVE / UPDATE MEASUREMENTS
// =====================================================

export async function saveMyMeasurements(req, res) {
  try {
    if (req.user == null) {
      res.status(401).json({
        message: "Unauthorized",
      });

      return;
    }

    const { measurementUnit, measurements } = req.body;

    if (measurementUnit !== "in" && measurementUnit !== "cm") {
      res.status(400).json({
        message: "Invalid measurement unit",
      });

      return;
    }

    const requiredFields = [
      "bust",
      "underBust",
      "waist",
      "shoulder",
      "sleeveLength",
      "sleeveCircumference",
      "frontNeck",
      "backNeck",
      "jacketLength",
    ];

    const cleanedMeasurements = {};

    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i];

      const value = Number(measurements?.[field]);

      if (!Number.isFinite(value) || value <= 0) {
        res.status(400).json({
          message: `Invalid ${field} measurement`,
        });

        return;
      }

      cleanedMeasurements[field] = value;
    }

    const profile = await MeasurementProfile.findOneAndUpdate(
      {
        email: req.user.email,
      },

      {
        email: req.user.email,

        measurementUnit: measurementUnit,

        measurements: cleanedMeasurements,
      },

      {
        upsert: true,

        new: true,

        runValidators: true,
      },
    );

    res.status(200).json({
      message: "Measurements saved successfully",

      profile: profile,
    });
  } catch (err) {
    console.error("Save Measurements Error:", err);

    res.status(500).json({
      message: "Internal server error",

      error: err.message,
    });
  }
}
