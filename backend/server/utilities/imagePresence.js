function hasImageValue(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return ["url", "secure_url", "secureUrl", "src", "href"].some(
    (key) => typeof value[key] === "string" && value[key].trim().length > 0
  );
}

function hasFragranceImage(fragrance) {
  if (!fragrance) {
    return false;
  }

  return (
    hasImageValue(fragrance.image) ||
    hasImageValue(fragrance.imageUrl) ||
    hasImageValue(fragrance.secureUrl)
  );
}

function getImageValue(value) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const key of ["url", "secure_url", "secureUrl", "src", "href"]) {
    if (typeof value[key] === "string" && value[key].trim().length > 0) {
      return value[key].trim();
    }
  }

  return null;
}

function getFragranceImageUrl(fragrance) {
  if (!fragrance) {
    return null;
  }

  return (
    getImageValue(fragrance.image) ||
    getImageValue(fragrance.imageUrl) ||
    getImageValue(fragrance.secureUrl)
  );
}

module.exports = {
  getFragranceImageUrl,
  hasFragranceImage,
  hasImageValue,
};
