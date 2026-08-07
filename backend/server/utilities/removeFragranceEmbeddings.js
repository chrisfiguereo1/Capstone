const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Fragrance = require("../models/fragrance");

async function removeFragranceEmbeddings() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from .env");
  }

  await mongoose.connect(process.env.MONGO_URL);

  try {
    const before = await getEmbeddingCounts();
    console.log(
      `Before cleanup: withEmbedding=${before.withEmbedding} withEmbeddingModel=${before.withEmbeddingModel} withEmbeddingUpdatedAt=${before.withEmbeddingUpdatedAt}`
    );

    const result = await Fragrance.updateMany(
      {
        $or: [
          { embedding: { $exists: true } },
          { embeddingModel: { $exists: true, $ne: "" } },
          { embeddingUpdatedAt: { $exists: true, $ne: null } },
        ],
      },
      {
        $unset: {
          embedding: "",
          embeddingModel: "",
          embeddingUpdatedAt: "",
        },
      }
    );

    const after = await getEmbeddingCounts();
    console.log(
      `Cleanup result: matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
    console.log(
      `After cleanup: withEmbedding=${after.withEmbedding} withEmbeddingModel=${after.withEmbeddingModel} withEmbeddingUpdatedAt=${after.withEmbeddingUpdatedAt}`
    );

    return {
      before,
      after,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    };
  } finally {
    await mongoose.disconnect();
  }
}

async function getEmbeddingCounts() {
  const [withEmbedding, withEmbeddingModel, withEmbeddingUpdatedAt] =
    await Promise.all([
      Fragrance.countDocuments({ embedding: { $exists: true } }),
      Fragrance.countDocuments({ embeddingModel: { $exists: true, $ne: "" } }),
      Fragrance.countDocuments({
        embeddingUpdatedAt: { $exists: true, $ne: null },
      }),
    ]);

  return {
    withEmbedding,
    withEmbeddingModel,
    withEmbeddingUpdatedAt,
  };
}

if (require.main === module) {
  removeFragranceEmbeddings().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  removeFragranceEmbeddings,
};
