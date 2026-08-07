const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Fragrance = require("../models/fragrance");
const { getOrFetchFragranceImage } = require("../services/fragranceImageService");
const { getFragranceImageUrl } = require("./imagePresence");

const fanFavoriteIds = [
  "6a28e95e06bfc109a654b19b",
  "6a28e95e06bfc109a6547d2f",
  "6a28e95e06bfc109a654a3ee",
  "6a28e95e06bfc109a654b659",
  "6a28e95e06bfc109a654b880",
  "6a28e95e06bfc109a654b5cc",
  "6a28e95e06bfc109a654b3bd",
  "6a28e95e06bfc109a654b4b4",
  "6a28e95e06bfc109a654af66",
  "6a28e95e06bfc109a654b705",
  "6a28e95e06bfc109a6549923",
  "6a28e95e06bfc109a654b86c",
  "6a28e95e06bfc109a654b7a9",
  "6a28e95e06bfc109a654b782",
  "6a28e95e06bfc109a654b805",
  "6a28e95e06bfc109a654b73a",
  "6a28e95d06bfc109a6545f74",
  "6a28e95e06bfc109a654aa09",
  "6a28e95e06bfc109a6547adf",
];

async function populateFanFavoriteImages() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from .env");
  }

  await mongoose.connect(process.env.MONGO_URL);

  const summary = {
    cached: 0,
    saved: 0,
    failed: 0,
    missingRecord: 0,
  };

  try {
    for (const id of fanFavoriteIds) {
      const fragrance = await Fragrance.findById(
        id,
        "_id url brand name image imageUrl imagePublicId imageSource imageStatus secureUrl"
      ).lean();

      if (!fragrance) {
        summary.missingRecord += 1;
        console.log(`missing-record | ${id}`);
        continue;
      }

      const cachedImageUrl = getFragranceImageUrl(fragrance);

      if (cachedImageUrl) {
        summary.cached += 1;
        console.log(
          `cached | ${fragrance.brand} ${fragrance.name} | ${cachedImageUrl}`
        );
        continue;
      }

      const result = await getOrFetchFragranceImage(id);

      if (result.ok && result.imageUrl) {
        summary.saved += result.status === "saved" ? 1 : 0;
        summary.cached += result.status === "cached" ? 1 : 0;
        console.log(
          `${result.status} | ${fragrance.brand} ${fragrance.name} | ${result.imageUrl}`
        );
        continue;
      }

      summary.failed += 1;
      console.log(
        `failed | ${fragrance.brand} ${fragrance.name} | ${result.status} | ${result.message}`
      );
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(
    `summary | cached=${summary.cached} saved=${summary.saved} failed=${summary.failed} missingRecord=${summary.missingRecord}`
  );

  return summary;
}

if (require.main === module) {
  populateFanFavoriteImages().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  fanFavoriteIds,
  populateFanFavoriteImages,
};
