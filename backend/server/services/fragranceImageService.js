const Fragrance = require("../models/fragrance");
const {
  getFragranceImageUrl,
  hasFragranceImage,
} = require("../utilities/imagePresence");
const { searchFragranceImage } = require("../utilities/fragranceFinderApi");

const failedLookups = new Map();
const inFlightLookups = new Map();
const LOOKUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GENERATED_SOURCE = "waterscent-generated";
const GENERATED_STATUS = "review";
const GENERATED_PUBLIC_ID_PREFIX = "waterscent/fragrances/generated/";

const fragranceFields =
  "_id brand name image imageUrl imagePublicId imageSource imageStatus secureUrl";

function getNoImageGuard(fragranceId) {
  return {
    _id: fragranceId,
    $and: [
      {
        $or: [
          { image: null },
          { image: "" },
          { image: { $exists: false } },
        ],
      },
      {
        $or: [
          { imageUrl: null },
          { imageUrl: "" },
          { imageUrl: { $exists: false } },
        ],
      },
    ],
  };
}

function hasGeneratedPlaceholderMetadata(fragrance) {
  return (
    fragrance.imageSource === GENERATED_SOURCE &&
    fragrance.imageStatus === GENERATED_STATUS &&
    typeof fragrance.imagePublicId === "string" &&
    fragrance.imagePublicId.startsWith(GENERATED_PUBLIC_ID_PREFIX) &&
    hasFragranceImage(fragrance)
  );
}

function getGeneratedReplacementGuard(fragrance) {
  const query = {
    _id: fragrance._id,
    imageSource: GENERATED_SOURCE,
    imageStatus: GENERATED_STATUS,
    imagePublicId: fragrance.imagePublicId,
  };

  if (typeof fragrance.image === "string" && fragrance.image.trim()) {
    query.image = fragrance.image;
  }

  if (typeof fragrance.imageUrl === "string" && fragrance.imageUrl.trim()) {
    query.imageUrl = fragrance.imageUrl;
  }

  return query;
}

function isCoolingDown(fragranceId) {
  const failedAt = failedLookups.get(fragranceId);
  return failedAt && Date.now() - failedAt < LOOKUP_COOLDOWN_MS;
}

function rememberFailure(fragranceId, status) {
  if (status !== "rate_limited") {
    failedLookups.set(fragranceId, Date.now());
  }
}

function clearFailure(fragranceId) {
  failedLookups.delete(fragranceId);
}

function getImageUpdate(imageUrl) {
  return {
    image: imageUrl,
    imageUrl,
    imagePublicId: "",
    imageSource: "rapidapi",
    imageStatus: "review",
  };
}

async function fetchAndSaveFragranceImage(fragranceId, options) {
  const replaceGenerated = Boolean(options && options.replaceGenerated);
  const fragrance = await Fragrance.findById(fragranceId, fragranceFields)
    .lean()
    .exec();

  if (!fragrance) {
    return {
      ok: false,
      httpStatus: 404,
      status: "not_found",
      message: "Fragrance not found.",
      apiCalled: false,
    };
  }

  const existingImageUrl = getFragranceImageUrl(fragrance);

  if (existingImageUrl && !replaceGenerated) {
    return {
      ok: true,
      status: "cached",
      imageUrl: existingImageUrl,
      source: fragrance.imageSource || "saved",
      cached: true,
      apiCalled: false,
    };
  }

  if (existingImageUrl && replaceGenerated && !hasGeneratedPlaceholderMetadata(fragrance)) {
    return {
      ok: true,
      status: "protected_existing_image",
      imageUrl: existingImageUrl,
      source: fragrance.imageSource || "saved",
      cached: true,
      apiCalled: false,
      message: "Existing image is not a WaterScent-generated placeholder.",
    };
  }

  if (isCoolingDown(fragranceId)) {
    return {
      ok: false,
      httpStatus: 429,
      status: "lookup_cooldown",
      cached: false,
      apiCalled: false,
      message: "A recent image lookup failed. Please try again later.",
    };
  }

  const apiResult = await searchFragranceImage({
    name: fragrance.name,
    brand: fragrance.brand,
  });

  if (!apiResult.ok) {
    rememberFailure(fragranceId, apiResult.status);
    return {
      ok: false,
      httpStatus: statusToHttpStatus(apiResult.status),
      status: apiResult.status,
      cached: false,
      apiCalled: apiResult.apiCalled,
      message: apiResult.message,
    };
  }

  const query = existingImageUrl
    ? getGeneratedReplacementGuard(fragrance)
    : getNoImageGuard(fragrance._id);

  const updateResult = await Fragrance.updateOne(query, {
    $set: getImageUpdate(apiResult.imageUrl),
  });

  if (updateResult.modifiedCount !== 1) {
    return {
      ok: false,
      httpStatus: 409,
      status: "guarded_update_failed",
      cached: false,
      apiCalled: apiResult.apiCalled,
      message: "Fragrance image changed before the lookup could be saved.",
    };
  }

  clearFailure(fragranceId);

  return {
    ok: true,
    status: "saved",
    imageUrl: apiResult.imageUrl,
    source: "rapidapi",
    cached: false,
    apiCalled: apiResult.apiCalled,
    match: apiResult.match,
  };
}

function statusToHttpStatus(status) {
  if (status === "missing_config") {
    return 503;
  }

  if (status === "rate_limited" || status === "lookup_cooldown") {
    return 429;
  }

  if (status === "timeout") {
    return 504;
  }

  if (status === "api_error") {
    return 502;
  }

  return 404;
}

async function getOrFetchFragranceImage(fragranceId, options = {}) {
  const key = String(fragranceId);

  if (inFlightLookups.has(key)) {
    return inFlightLookups.get(key);
  }

  const lookup = fetchAndSaveFragranceImage(key, options).finally(() => {
    inFlightLookups.delete(key);
  });

  inFlightLookups.set(key, lookup);
  return lookup;
}

module.exports = {
  getOrFetchFragranceImage,
};
