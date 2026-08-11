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
    const { statusCode, message, code } = getRecommendationErrorResponse(error);

    console.error("Recommendation API error:", {
      code,
      message: error.message,
      statusCode,
      cause: error.cause?.message,
    });

    res.status(statusCode).json({ message, code });
  }
});

function getRecommendationErrorResponse(error) {
  const statusCode = error.statusCode || 500;

  if (statusCode !== 500) {
    return {
      statusCode,
      message: error.message,
      code: "RECOMMENDATION_REQUEST_INVALID",
    };
  }

  const errorMessage = String(error?.message || "");

  if (errorMessage.includes("OPENAI_API_KEY is missing")) {
    return {
      statusCode: 503,
      message: "Recommendation service is missing server OpenAI configuration.",
      code: "OPENAI_API_KEY_MISSING",
    };
  }

  if (errorMessage.includes("OpenAI embedding request failed")) {
    return {
      statusCode: 503,
      message: "Recommendation service could not create the query embedding.",
      code: "OPENAI_EMBEDDING_FAILED",
    };
  }

  if (errorMessage.includes("MongoDB Vector Search failed")) {
    return {
      statusCode: 503,
      message: "Recommendation vector search is unavailable.",
      code: "VECTOR_SEARCH_FAILED",
    };
  }

  return {
    statusCode,
    message: "Unable to generate recommendations right now.",
    code: "RECOMMENDATION_FAILED",
  };
}

module.exports = router;
