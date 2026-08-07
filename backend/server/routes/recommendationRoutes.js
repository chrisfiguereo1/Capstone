const express = require("express");
const router = express.Router();

const {
  getSemanticRecommendations,
} = require("../services/recommendationService");
const authenticateToken = require("../middleware/authenticateToken");

router.post("/recommendations", authenticateToken, async (req, res) => {
  try {
    const query = req.body?.query;
    const recommendations = await getSemanticRecommendations(query);
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    res.status(200).json({
      query: normalizedQuery,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500
        ? "Unable to generate recommendations right now."
        : error.message;

    res.status(statusCode).json({ message });
  }
});

module.exports = router;
