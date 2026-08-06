const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/authenticateToken");
const newUserModel = require("../models/userModel");

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await newUserModel
      .findById(req.userId)
      .select("_id username email createdAt updatedAt");

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Error trying to load user profile" });
  }
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).send({ message: "Username is required" });
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).send({ message: "Please input a valid email" });
    }

    const usernameExists = await newUserModel.findOne({
      username,
      _id: { $ne: req.userId },
    });

    if (usernameExists) {
      return res.status(409).send({ message: "Username is taken, pick another" });
    }

    const emailExists = await newUserModel.findOne({
      email,
      _id: { $ne: req.userId },
    });

    if (emailExists) {
      return res.status(409).send({ message: "Email is already registered" });
    }

    const user = await newUserModel
      .findByIdAndUpdate(
        req.userId,
        { username, email },
        { new: true, runValidators: true }
      )
      .select("_id username email createdAt updatedAt");

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Error trying to update user profile" });
  }
});

router.put("/profile/password", authenticateToken, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).send({ message: "All password fields are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).send({ message: "Password must be 8 or more characters" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).send({ message: "New passwords do not match" });
    }

    const user = await newUserModel.findById(req.userId).select("password");

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const currentPasswordIsValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!currentPasswordIsValid) {
      return res.status(401).send({ message: "Current password is incorrect" });
    }

    const generateHash = await bcrypt.genSalt(Number(10));
    user.password = await bcrypt.hash(newPassword, generateHash);
    await user.save();

    res.send({ message: "Password updated." });
  } catch (error) {
    res.status(500).send({ message: "Error trying to update password" });
  }
});

module.exports = router;
