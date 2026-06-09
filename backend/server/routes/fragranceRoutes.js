const express = require("express");
const router = express.Router();

const Fragrance = require("../models/fragrance");

// GET all fragrances
router.get("/", async (req, res) => {
  try {
    const fragrances = await Fragrance.find();

    res.status(200).json(fragrances);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET fragrance by id
router.get("/:id", async (req, res) => {
  try {
    const fragrance = await Fragrance.findById(req.params.id);

    if (!fragrance) {
      return res.status(404).json({
        message: "Fragrance not found",
      });
    }

    res.status(200).json(fragrance);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// CREATE fragrance
router.post("/", async (req, res) => {
  try {
    const fragrance = await Fragrance.create(req.body);

    res.status(201).json(fragrance);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// DELETE fragrance
router.delete("/:id", async (req, res) => {
  try {
    const fragrance = await Fragrance.findByIdAndDelete(req.params.id);

    if (!fragrance) {
      return res.status(404).json({
        message: "Fragrance not found",
      });
    }

    res.status(200).json({
      message: "Fragrance deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;