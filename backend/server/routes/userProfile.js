const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const newUserModel = require("../models/userModel");

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await newUserModel
      .findById(req.userId)
      .select("_id username email bio profileImage createdAt updatedAt");

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Error trying to load user profile" });
  }
});

module.exports = router;
