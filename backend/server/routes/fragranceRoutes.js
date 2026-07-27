const express = require("express");
const router = express.Router();

const Fragrance = require("../models/fragrance");
const {
  getOrFetchFragranceImage,
} = require("../services/fragranceImageService");

const fragranceSearchFields = [
  "name",
  "brand",
  "accords",
  "notes.top",
  "notes.middle",
  "notes.base",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFragranceSearchQuery(query) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return {
    $and: tokens.map((token) => ({
      $or: fragranceSearchFields.map((field) => ({
        [field]: { $regex: escapeRegex(token), $options: "i" },
      })),
    })),
  };
}

// SEARCH fragrances
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";

    if (!query.trim()) {
      return res.status(200).json([]);
    }

    const fragrances = await Fragrance.find(
      buildFragranceSearchQuery(query)
    ).limit(12);

    res.status(200).json(fragrances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET first 20 fragrances
router.get("/", async (req, res) => {
  try {
    const fragrances = await Fragrance.find().limit(20);
    res.status(200).json(fragrances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET or fetch one fragrance image by ID
router.post("/:id/image", async (req, res) => {
  try {
    const result = await getOrFetchFragranceImage(req.params.id, {
      replaceGenerated: Boolean(req.body && req.body.replaceGenerated),
    });

    if (!result.ok) {
      return res.status(result.httpStatus || 500).json({
        imageUrl: null,
        source: null,
        cached: false,
        apiCalled: Boolean(result.apiCalled),
        status: result.status,
        message: result.message,
      });
    }

    res.status(200).json({
      imageUrl: result.imageUrl,
      source: result.source,
      cached: Boolean(result.cached),
      apiCalled: Boolean(result.apiCalled),
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({
      imageUrl: null,
      source: null,
      cached: false,
      apiCalled: false,
      status: "error",
      message: "Unable to fetch fragrance image.",
    });
  }
});

// GET one fragrance by ID
router.get("/:id", async (req, res) => {
  try {
    const fragrance = await Fragrance.findById(req.params.id);

    if (!fragrance) {
      return res.status(404).json({ message: "Fragrance not found" });
    }

    res.status(200).json(fragrance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE fragrance
router.post("/", async (req, res) => {
  try {
    const fragrance = await Fragrance.create(req.body);
    res.status(201).json(fragrance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE fragrance
router.delete("/:id", async (req, res) => {
  try {
    const fragrance = await Fragrance.findByIdAndDelete(req.params.id);

    if (!fragrance) {
      return res.status(404).json({ message: "Fragrance not found" });
    }

    res.status(200).json({ message: "Fragrance deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
