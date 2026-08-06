const express = require("express");
const mongoose = require("mongoose");

const authenticateToken = require("../middleware/authenticateToken");
const Fragrance = require("../models/fragrance");
const User = require("../models/userModel");

const router = express.Router();

const savedFragranceFields =
  "name brand country gender year ratingValue ratingCount notes perfumers accords image imageUrl source";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get("/saved-fragrances", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "savedFragrances",
      select: savedFragranceFields,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user.savedFragrances || []);
  } catch (error) {
    res.status(500).json({ message: "Unable to load saved fragrances." });
  }
});

router.get("/saved-fragrances/ids", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("savedFragrances");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      savedFragranceIds: (user.savedFragrances || []).map((id) => String(id)),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load saved fragrances." });
  }
});

router.post("/saved-fragrances/:fragranceId", authenticateToken, async (req, res) => {
  try {
    const { fragranceId } = req.params;

    if (!isValidObjectId(fragranceId)) {
      return res.status(400).json({ message: "Invalid fragrance ID." });
    }

    const fragranceExists = await Fragrance.exists({ _id: fragranceId });
    if (!fragranceExists) {
      return res.status(404).json({ message: "Fragrance not found." });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $addToSet: { savedFragrances: fragranceId } },
      { new: true }
    ).select("savedFragrances");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      saved: true,
      savedFragranceIds: (user.savedFragrances || []).map((id) => String(id)),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to save fragrance." });
  }
});

router.delete("/saved-fragrances/:fragranceId", authenticateToken, async (req, res) => {
  try {
    const { fragranceId } = req.params;

    if (!isValidObjectId(fragranceId)) {
      return res.status(400).json({ message: "Invalid fragrance ID." });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $pull: { savedFragrances: fragranceId } },
      { new: true }
    ).select("savedFragrances");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      saved: false,
      savedFragranceIds: (user.savedFragrances || []).map((id) => String(id)),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to unsave fragrance." });
  }
});

module.exports = router;
