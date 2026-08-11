const Fragrance = require("../models/fragrance");
const { EMBEDDING_DIMENSIONS, createEmbedding } = require("./embeddingService");

const VECTOR_SEARCH_INDEX = "fragrance_embedding_index";
const DEFAULT_LIMIT = 12;
const DEFAULT_NUM_CANDIDATES = 200;
const DEFAULT_SEARCH_LIMIT = 100;

async function getSemanticRecommendations(query, options = {}) {
  const normalizedQuery = validateRecommendationQuery(query);
  const queryEmbedding = await createEmbedding(normalizedQuery);

  if (queryEmbedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Query embedding has ${queryEmbedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`
    );
  }

  const limit = options.limit || DEFAULT_LIMIT;
  const excludeIds = normalizeExcludeIds(options.excludeIds);
  const searchLimit = Math.max(
    options.searchLimit || DEFAULT_SEARCH_LIMIT,
    limit + excludeIds.size + limit
  );
  const numCandidates = Math.max(
    options.numCandidates || DEFAULT_NUM_CANDIDATES,
    searchLimit
  );

  let results;

  try {
    results = await Fragrance.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_SEARCH_INDEX,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates,
          limit: searchLimit,
        },
      },
      {
        $match: {
          name: { $type: "string", $ne: "" },
          brand: { $type: "string", $ne: "" },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          brand: 1,
          gender: 1,
          year: 1,
          ratingValue: 1,
          ratingCount: 1,
          notes: 1,
          accords: 1,
          image: 1,
          imageUrl: 1,
          transparentImage: 1,
          transparentImageUrl: 1,
          similarityScore: { $meta: "vectorSearchScore" },
        },
      },
    ]);
  } catch (error) {
    throw createVectorSearchError(error);
  }

  return selectRecommendationResults(rankRecommendationResults(results), excludeIds, limit);
}

function validateRecommendationQuery(query) {
  if (typeof query !== "string") {
    const error = new Error("Query must be a string.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedQuery = query.trim().replace(/\s+/g, " ");

  if (!normalizedQuery) {
    const error = new Error("Query is required.");
    error.statusCode = 400;
    throw error;
  }

  if (normalizedQuery.length > 500) {
    const error = new Error("Query must be 500 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedQuery;
}

function normalizeExcludeIds(excludeIds) {
  if (!Array.isArray(excludeIds)) {
    return new Set();
  }

  return new Set(
    excludeIds
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
}

function selectRecommendationResults(results, excludeIds, limit) {
  const seenIds = new Set();
  const uniqueResults = [];

  for (const fragrance of results) {
    const fragranceId = String(fragrance._id);

    if (seenIds.has(fragranceId)) {
      continue;
    }

    seenIds.add(fragranceId);
    uniqueResults.push(fragrance);
  }

  const unseenResults = uniqueResults.filter(
    (fragrance) => !excludeIds.has(String(fragrance._id))
  );

  if (unseenResults.length >= limit) {
    return unseenResults.slice(0, limit);
  }

  const selectedIds = new Set(
    unseenResults.map((fragrance) => String(fragrance._id))
  );
  const fallbackResults = uniqueResults.filter(
    (fragrance) => !selectedIds.has(String(fragrance._id))
  );

  return unseenResults.concat(fallbackResults).slice(0, limit);
}

function rankRecommendationResults(results) {
  return results
    .map((fragrance) => {
      const similarityScore = normalizeNumber(fragrance.similarityScore);
      const ratingConfidence = getRatingConfidence(fragrance);
      const finalScore = similarityScore * 0.9 + ratingConfidence * 0.1;

      return {
        _id: fragrance._id,
        name: fragrance.name,
        brand: fragrance.brand,
        image:
          fragrance.transparentImageUrl ||
          fragrance.transparentImage ||
          fragrance.imageUrl ||
          fragrance.image ||
          "",
        imageUrl: fragrance.imageUrl || "",
        transparentImageUrl: fragrance.transparentImageUrl || "",
        gender: fragrance.gender,
        year: fragrance.year,
        ratingValue: fragrance.ratingValue,
        ratingCount: fragrance.ratingCount,
        notes: fragrance.notes,
        accords: fragrance.accords,
        similarityScore: roundScore(similarityScore),
        rankingScore: roundScore(finalScore),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}

function getRatingConfidence(fragrance) {
  const ratingValue = Number(fragrance.ratingValue);
  const ratingCount = Number(fragrance.ratingCount);

  if (!Number.isFinite(ratingValue) || ratingValue <= 0) {
    return 0;
  }

  const normalizedRating = Math.min(Math.max(ratingValue / 5, 0), 1);
  const normalizedCount =
    Number.isFinite(ratingCount) && ratingCount > 0
      ? Math.min(Math.log10(ratingCount + 1) / 4, 1)
      : 0;

  return normalizedRating * normalizedCount;
}

function normalizeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundScore(value) {
  return Math.round(value * 10000) / 10000;
}

function createVectorSearchError(error) {
  const vectorError = new Error(
    `MongoDB Vector Search failed. Confirm the Atlas Vector Search index fragrance_embedding_index exists on WaterScent.fragrances with path embedding, ${EMBEDDING_DIMENSIONS} dimensions, and cosine similarity.`
  );
  vectorError.statusCode = isMissingVectorIndexError(error) ? 503 : 500;
  vectorError.cause = error;
  return vectorError;
}

function isMissingVectorIndexError(error) {
  const message = String(error && error.message ? error.message : "").toLowerCase();
  return (
    message.includes("vector search") ||
    message.includes("$vectorsearch") ||
    message.includes("index") ||
    message.includes("search index")
  );
}

module.exports = {
  DEFAULT_LIMIT,
  VECTOR_SEARCH_INDEX,
  getSemanticRecommendations,
  validateRecommendationQuery,
};
