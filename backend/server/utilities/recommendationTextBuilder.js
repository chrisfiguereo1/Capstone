function buildRecommendationText(fragrance) {
  if (!fragrance || typeof fragrance !== "object") {
    return "";
  }

  const sentences = [];
  const brandName = cleanText([fragrance.brand, fragrance.name].filter(Boolean).join(" "));
  const gender = cleanText(fragrance.gender);
  const year = getValidYear(fragrance.year);
  const accords = cleanArray(fragrance.accords);
  const topNotes = cleanArray(fragrance.notes?.top);
  const middleNotes = cleanArray(fragrance.notes?.middle);
  const baseNotes = cleanArray(fragrance.notes?.base);
  const perfumers = cleanArray(fragrance.perfumers);
  const rating = getValidRating(fragrance.ratingValue);

  if (brandName) {
    sentences.push(`${brandName}.`);
  }

  if (gender && !isUnknownValue(gender)) {
    sentences.push(`Fragrance for ${gender}.`);
  }

  if (year) {
    sentences.push(`Released in ${year}.`);
  }

  if (accords.length > 0) {
    sentences.push(`Main accords: ${joinValues(accords)}.`);
  }

  if (topNotes.length > 0) {
    sentences.push(`Top notes: ${joinValues(topNotes)}.`);
  }

  if (middleNotes.length > 0) {
    sentences.push(`Middle notes: ${joinValues(middleNotes)}.`);
  }

  if (baseNotes.length > 0) {
    sentences.push(`Base notes: ${joinValues(baseNotes)}.`);
  }

  if (perfumers.length === 1) {
    sentences.push(`Perfumer: ${perfumers[0]}.`);
  } else if (perfumers.length > 1) {
    sentences.push(`Perfumers: ${joinValues(perfumers)}.`);
  }

  if (rating) {
    sentences.push(`Rating: ${rating}.`);
  }

  return sentences.join(" ");
}

function cleanArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const cleaned = [];

  for (const value of values) {
    const text = cleanText(value);
    const key = text.toLowerCase();

    if (!text || isUnknownValue(text) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(text);
  }

  return cleaned;
}

function cleanText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value).trim().replace(/\s+/g, " ");
}

function getValidYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year > 0 ? year : null;
}

function getValidRating(value) {
  const rating = Number(value);

  if (!Number.isFinite(rating) || rating <= 0) {
    return null;
  }

  return Number.isInteger(rating) ? String(rating) : String(Number(rating.toFixed(2)));
}

function isUnknownValue(value) {
  return ["unknown", "n/a", "na", "none", "null", "undefined"].includes(
    value.toLowerCase()
  );
}

function joinValues(values) {
  return values.join(", ");
}

module.exports = {
  buildRecommendationText,
  cleanArray,
};
