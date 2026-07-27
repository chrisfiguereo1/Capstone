const net = require("net");

const DEFAULT_HOST = "fragrancefinder-api.p.rapidapi.com";
const DEFAULT_SEARCH_PATH = "/perfumes/search";
const DEFAULT_QUERY_PARAM = "q";
const DEFAULT_ALLOWED_IMAGE_HOSTS = ["fimgs.net"];
const DEFAULT_TIMEOUT_MS = 8000;
const GENERIC_TOKENS = new Set([
  "the",
  "for",
  "men",
  "women",
  "and",
  "perfume",
  "perfumes",
  "cologne",
  "colognes",
  "unisex",
]);

function normalizeText(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return stripGenericPhrases(normalized);
}

function stripGenericPhrases(value) {
  return String(value || "")
    .replace(/\bperfumes?\s+and\s+colognes?\b/g, " ")
    .replace(/\bperfume\s+and\s+cologne\b/g, " ")
    .replace(/\bfor\s+women\s+and\s+men\b/g, " ")
    .replace(/\bfor\s+men\s+and\s+women\b/g, " ")
    .replace(/\bfor\s+women\b/g, " ")
    .replace(/\bfor\s+men\b/g, " ")
    .replace(/\bunisex\b/g, " ")
    .replace(/\beau\s+de\s+parfum\b/g, " ")
    .replace(/\beau\s+de\s+toilette\b/g, " ")
    .replace(/\bparfum$/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function getSignificantTokens(value) {
  return tokenize(value).filter((token) => !GENERIC_TOKENS.has(token));
}

function includesAllTokens(haystack, tokens) {
  const haystackTokens = new Set(tokenize(haystack));
  return tokens.length > 0 && tokens.every((token) => haystackTokens.has(token));
}

function containsNormalizedPhrase(haystack, needle) {
  const normalizedHaystack = ` ${normalizeText(haystack)} `;
  const normalizedNeedle = normalizeText(needle);
  return normalizedNeedle.length > 0 && normalizedHaystack.includes(` ${normalizedNeedle} `);
}

function removeBrandFromName(name, brand) {
  const brandTokens = new Set(getSignificantTokens(brand));

  if (!brandTokens.size) {
    return normalizeText(name);
  }

  const nameTokens = tokenize(name);
  const filteredTokens = nameTokens.filter((token) => !brandTokens.has(token));

  return filteredTokens.join(" ") || normalizeText(name);
}

function getTokenOverlapScore(sourceTokens, candidateTokens) {
  if (!sourceTokens.length || !candidateTokens.length) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  const shared = sourceTokens.filter((token) => candidateSet.has(token)).length;

  return shared / sourceTokens.length;
}

function getRapidApiConfig() {
  const host = process.env.RAPIDAPI_HOST || DEFAULT_HOST;
  const rawSearchUrl =
    process.env.RAPIDAPI_SEARCH_URL || `https://${host}${DEFAULT_SEARCH_PATH}`;

  return {
    apiKey: process.env.RAPIDAPI_KEY || "",
    host,
    searchUrl: rawSearchUrl,
    queryParam: process.env.RAPIDAPI_SEARCH_QUERY_PARAM || DEFAULT_QUERY_PARAM,
    allowedImageHosts: (process.env.RAPIDAPI_ALLOWED_IMAGE_HOSTS || "")
      .split(",")
      .map((hostValue) => hostValue.trim().toLowerCase())
      .filter(Boolean),
  };
}

function getAllowedImageHosts(config) {
  return config.allowedImageHosts.length
    ? config.allowedImageHosts
    : DEFAULT_ALLOWED_IMAGE_HOSTS;
}

function getSearchUrl(config, query) {
  const url = new URL(config.searchUrl);
  url.searchParams.set(config.queryParam, query);

  if (!url.searchParams.has("perPage")) {
    url.searchParams.set("perPage", "10");
  }

  if (!url.searchParams.has("page")) {
    url.searchParams.set("page", "1");
  }

  return url;
}

function isPrivateIpAddress(hostname) {
  if (net.isIP(hostname) === 0) {
    return false;
  }

  if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return true;
  }

  const parts = hostname.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function validateImageUrl(imageUrl, allowedHosts) {
  if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
    return { valid: false, reason: "No image URL was returned." };
  }

  let parsed;

  try {
    parsed = new URL(imageUrl.trim());
  } catch (error) {
    return { valid: false, reason: "Image URL is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Image URL must use HTTPS." };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "Image URL must not contain credentials." };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateIpAddress(hostname)
  ) {
    return { valid: false, reason: "Image URL points to a local or private host." };
  }

  if (!allowedHosts.includes(hostname)) {
    return {
      valid: false,
      reason: `Image host "${hostname}" is not in the allowed host list.`,
    };
  }

  return { valid: true, url: parsed.toString() };
}

function extractFragranceResults(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.results,
    payload.data,
    payload.data && payload.data.results,
    payload.perfumes,
    payload.fragrances,
    payload.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function scoreResult(result, target) {
  const waterScentBrand = normalizeText(target.brand);
  const waterScentName = removeBrandFromName(target.name, waterScentBrand);
  const waterScentCombined = normalizeText(`${waterScentBrand} ${waterScentName}`);
  const apiPerfume = normalizeText(result.perfume || result.name || "");
  const apiBrand = normalizeText(result.brand || "");
  const apiCombined = normalizeText(`${apiBrand} ${apiPerfume}`);
  const nameTokens = getSignificantTokens(waterScentName);
  const brandTokens = getSignificantTokens(waterScentBrand);
  const combinedTokens = getSignificantTokens(waterScentCombined);
  const apiBrandTokens = getSignificantTokens(apiBrand);
  const apiCombinedTokens = getSignificantTokens(apiCombined);
  const nameMatch =
    containsNormalizedPhrase(apiPerfume, waterScentName) ||
    includesAllTokens(apiPerfume, nameTokens);
  const brandMatch =
    containsNormalizedPhrase(apiBrand, waterScentBrand) ||
    includesAllTokens(apiBrand, brandTokens);
  const brandInPerfume =
    containsNormalizedPhrase(apiPerfume, waterScentBrand) ||
    includesAllTokens(apiPerfume, brandTokens);
  const combinedTokenMatch = includesAllTokens(apiCombined, combinedTokens);
  const tokenOverlap = getTokenOverlapScore(combinedTokens, apiCombinedTokens);
  const strongTokenOverlap = tokenOverlap >= 0.75 && combinedTokens.length > 1;
  const hasImage = typeof result.image === "string" && result.image.trim().length > 0;
  const brandConflict =
    brandTokens.length > 0 &&
    apiBrandTokens.length > 0 &&
    !brandMatch &&
    !brandInPerfume;

  let score = 0;

  if (nameMatch) {
    score += 50;
  }

  if (brandMatch) {
    score += 35;
  }

  if (brandInPerfume) {
    score += 25;
  }

  if (combinedTokenMatch) {
    score += 25;
  }

  if (strongTokenOverlap) {
    score += 15;
  }

  if (brandConflict) {
    score -= 40;
  }

  return {
    score,
    nameMatch,
    brandMatch,
    brandInPerfume,
    combinedTokenMatch,
    strongTokenOverlap,
    brandConflict,
    hasImage,
    accepted:
      hasImage &&
      !brandConflict &&
      (nameMatch || combinedTokenMatch || strongTokenOverlap),
  };
}

function findBestMatch(results, target) {
  const scored = results
    .filter((result) => result && typeof result === "object")
    .map((result) => ({
      result,
      ...scoreResult(result, target),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored.find((candidate) => candidate.accepted);

  if (!best) {
    return null;
  }

  return best.result;
}

function scoreFragranceResults(results, target) {
  return results
    .filter((result) => result && typeof result === "object")
    .map((result, index) => ({
      index,
      ...sanitizeCandidate(result),
      ...scoreResult(result, target),
    }))
    .sort((a, b) => b.score - a.score);
}

async function searchFragranceImage({ name, brand }) {
  const config = getRapidApiConfig();

  if (!config.apiKey || !config.host || !config.searchUrl || !config.queryParam) {
    return {
      ok: false,
      status: "missing_config",
      apiCalled: false,
      endpointPath: null,
      message: "RapidAPI fragrance search is not configured.",
    };
  }

  const query = [brand, name].filter(Boolean).join(" ").trim();

  if (!query) {
    return {
      ok: false,
      status: "missing_query",
      apiCalled: false,
      endpointPath: null,
      message: "Fragrance name or brand is required.",
    };
  }

  const url = getSearchUrl(config, query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": config.apiKey,
        "x-rapidapi-host": config.host,
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;
    const endpointPath = url.pathname;

    if (response.status === 429) {
      return {
        ok: false,
        status: "rate_limited",
        httpStatus: response.status,
        apiCalled: true,
        endpointPath,
        message: "RapidAPI rate limit reached.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: "api_error",
        httpStatus: response.status,
        apiCalled: true,
        endpointPath,
        message: "RapidAPI fragrance search failed.",
      };
    }

    const results = extractFragranceResults(payload);
    const scoredCandidates = scoreFragranceResults(results, { name, brand });
    const match = findBestMatch(results, { name, brand });
    const sanitizedCandidates = results.map((result, index) =>
      sanitizeCandidate(result, index)
    );
    const topCandidates = scoredCandidates.slice(0, 3);

    if (!match) {
      return {
        ok: false,
        status: "no_match",
        httpStatus: response.status,
        apiCalled: true,
        endpointPath,
        resultCount: results.length,
        responseShape: getResponseShape(payload, results),
        candidates: sanitizedCandidates,
        topCandidates,
        message: "No strong matching fragrance image was found.",
      };
    }

    const imageValidation = validateImageUrl(
      match.image,
      getAllowedImageHosts(config)
    );

    if (!imageValidation.valid) {
      return {
        ok: false,
        status: "invalid_image_url",
        httpStatus: response.status,
        apiCalled: true,
        endpointPath,
        resultCount: results.length,
        responseShape: getResponseShape(payload, results),
        candidates: sanitizedCandidates,
        topCandidates,
        match: sanitizeMatch(match),
        message: imageValidation.reason,
      };
    }

    return {
      ok: true,
      status: "matched",
      httpStatus: response.status,
      apiCalled: true,
      endpointPath,
      resultCount: results.length,
      responseShape: getResponseShape(payload, results),
      candidates: sanitizedCandidates,
      topCandidates,
      imageUrl: imageValidation.url,
      match: sanitizeMatch(match),
    };
  } catch (error) {
    const isTimeout = error.name === "AbortError";

    return {
      ok: false,
      status: isTimeout ? "timeout" : "api_error",
      apiCalled: true,
      endpointPath: url.pathname,
      message: isTimeout
        ? "RapidAPI fragrance search timed out."
        : "RapidAPI fragrance search failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getResponseShape(payload, results) {
  return {
    topLevelType: Array.isArray(payload) ? "array" : typeof payload,
    topLevelKeys:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload)
        : [],
    resultCount: results.length,
    firstResultKeys:
      results[0] && typeof results[0] === "object" ? Object.keys(results[0]) : [],
  };
}

function sanitizeMatch(match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  return {
    id: match.id || null,
    objectId: match._id || null,
    perfume: match.perfume || match.name || "",
    brand: match.brand || "",
    image: match.image || "",
    url: match.url || "",
  };
}

function sanitizeCandidate(candidate, index) {
  return {
    index,
    id: candidate.id || null,
    perfume: candidate.perfume || candidate.name || "",
    brand: candidate.brand || "",
    imagePresent:
      typeof candidate.image === "string" && candidate.image.trim().length > 0,
  };
}

module.exports = {
  extractFragranceResults,
  findBestMatch,
  getRapidApiConfig,
  getSearchUrl,
  getSignificantTokens,
  normalizeText,
  removeBrandFromName,
  scoreFragranceResults,
  scoreResult,
  searchFragranceImage,
  validateImageUrl,
};
