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
  "perfumers",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchQuery(query) {
  return String(query || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeSearchQuery(query) {
  return normalizeSearchQuery(query).split(" ").filter(Boolean);
}

function buildOrderedCharacterRegex(token) {
  return token
    .split("")
    .map((character) => escapeRegex(character))
    .join(".*");
}

function buildTokenFieldQueries(token) {
  const patterns = [{ $regex: escapeRegex(token), $options: "i" }];

  if (token.length >= 4) {
    patterns.push({ $regex: `^${escapeRegex(token.slice(0, 3))}`, $options: "i" });
  }

  if (token.length >= 5) {
    patterns.push({
      $regex: buildOrderedCharacterRegex(token),
      $options: "i",
    });

    for (let index = 0; index < token.length; index += 1) {
      const deletionVariant = token.slice(0, index) + token.slice(index + 1);
      if (deletionVariant.length >= 4) {
        patterns.push({
          $regex: buildOrderedCharacterRegex(deletionVariant),
          $options: "i",
        });
      }
    }
  }

  return patterns.flatMap((pattern) =>
    fragranceSearchFields.map((field) => ({
      [field]: pattern,
    }))
  );
}

function buildFragranceSearchQuery(query) {
  const tokens = tokenizeSearchQuery(query);

  return {
    $and: tokens.map((token) => ({
      $or: buildTokenFieldQueries(token),
    })),
  };
}

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function collectSearchValues(fragrance) {
  return {
    name: [fragrance.name],
    brand: [fragrance.brand],
    secondary: [
      ...(fragrance.accords || []),
      ...(fragrance.notes?.top || []),
      ...(fragrance.notes?.middle || []),
      ...(fragrance.notes?.base || []),
      ...(fragrance.perfumers || []),
    ],
  };
}

function getWords(values) {
  return values
    .map(normalizeSearchValue)
    .join(" ")
    .split(" ")
    .filter(Boolean);
}

function levenshteinDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let lastDiagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const oldDiagonal = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        lastDiagonal + cost
      );
      lastDiagonal = oldDiagonal;
    }
  }

  return previous[b.length];
}

function tokenMatchesValues(token, values) {
  const normalizedValues = values.map(normalizeSearchValue).filter(Boolean);

  if (normalizedValues.some((value) => value.includes(token))) {
    return true;
  }

  if (token.length < 5) {
    return false;
  }

  const threshold = token.length >= 7 ? 2 : 1;
  return getWords(values).some(
    (word) => word.length >= 4 && levenshteinDistance(token, word) <= threshold
  );
}

function allTokensMatch(tokens, values) {
  return tokens.every((token) => tokenMatchesValues(token, values));
}

function rankFragrance(fragrance, query) {
  const normalizedQuery = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(query);
  const values = collectSearchValues(fragrance);
  const name = normalizeSearchValue(fragrance.name);
  const brand = normalizeSearchValue(fragrance.brand);
  const brandName = normalizeSearchValue(`${fragrance.brand || ""} ${fragrance.name || ""}`);
  const nameBrand = normalizeSearchValue(`${fragrance.name || ""} ${fragrance.brand || ""}`);
  const secondaryValues = values.secondary.map(normalizeSearchValue).filter(Boolean);
  const allValues = [...values.name, ...values.brand, ...values.secondary];

  if (!tokens.length || !allTokensMatch(tokens, allValues)) {
    return null;
  }

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 10;
  if (brandName.startsWith(normalizedQuery) || nameBrand.startsWith(normalizedQuery)) return 15;
  if (name.includes(normalizedQuery) || tokens.every((token) => name.includes(token))) {
    return 20;
  }
  if (brand === normalizedQuery) return 30;
  if (brand.startsWith(normalizedQuery) || tokens.every((token) => brand.includes(token))) {
    return 35;
  }
  if (secondaryValues.some((value) => tokens.some((token) => value.includes(token)))) {
    return 50;
  }

  const fuzzyPenalty = tokens.reduce((sum, token) => {
    const distances = getWords(allValues).map((word) => levenshteinDistance(token, word));
    return sum + Math.min(...distances);
  }, 0);

  return 80 + fuzzyPenalty;
}

function sortFragranceResults(fragrances, query) {
  return fragrances
    .map((fragrance) => ({
      fragrance,
      rank: rankFragrance(fragrance, query),
    }))
    .filter((result) => result.rank !== null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return (b.fragrance.ratingCount || 0) - (a.fragrance.ratingCount || 0);
    })
    .slice(0, 12)
    .map((result) => result.fragrance);
}

// SEARCH fragrances
router.get("/search", async (req, res) => {
  try {
    const query = normalizeSearchQuery(req.query.q || "");

    if (!query) {
      return res.status(200).json([]);
    }

    const candidates = await Fragrance.find(buildFragranceSearchQuery(query))
      .limit(5000)
      .lean();

    res.status(200).json(sortFragranceResults(candidates, query));
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
