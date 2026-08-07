const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Fragrance = require("../models/fragrance");
const { buildRecommendationText } = require("./recommendationTextBuilder");

const progressInterval = 500;

async function generateRecommendationText(options = parseArgs(process.argv.slice(2))) {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from .env");
  }

  await mongoose.connect(process.env.MONGO_URL);

  const summary = {
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    empty: 0,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
  };

  try {
    const query = options.force ? {} : getMissingRecommendationTextQuery();
    const total = await Fragrance.countDocuments({});

    if (!options.force) {
      summary.skipped = total - (await Fragrance.countDocuments(query));
    }

    console.log(
      `Starting recommendation text generation. total=${total} force=${summary.force} dryRun=${summary.dryRun}`
    );

    if (summary.skipped > 0) {
      console.log(
        `Skipping ${summary.skipped} fragrances that already have recommendationText.`
      );
    }

    const cursor = Fragrance.find(query)
      .select(
        "_id name brand gender year ratingValue accords notes.top notes.middle notes.base perfumers recommendationText"
      )
      .cursor();

    for await (const fragrance of cursor) {
      if (options.limit && summary.processed >= options.limit) {
        break;
      }

      summary.processed += 1;

      try {
        if (!options.force && hasRecommendationText(fragrance.recommendationText)) {
          summary.skipped += 1;
          logSample("Skipped", fragrance, summary.skipped);
          continue;
        }

        const recommendationText = buildRecommendationText(fragrance);

        if (!recommendationText) {
          summary.empty += 1;
          console.log(`Empty: ${getFragranceLabel(fragrance)}`);
          continue;
        }

        if (!options.dryRun) {
          await Fragrance.updateOne(
            { _id: fragrance._id },
            { $set: { recommendationText } }
          );
        }

        summary.updated += 1;
        logSample(options.dryRun ? "Would update" : "Updated", fragrance, summary.updated);
      } catch (error) {
        summary.failed += 1;
        console.error(`Failed: ${getFragranceLabel(fragrance)} | ${error.message}`);
      }

      if (summary.processed % progressInterval === 0) {
        console.log(
          `Progress: processed=${summary.processed} updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed}`
        );
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log("\nRecommendation text generation complete.");
  console.log(`Processed: ${summary.processed}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Empty: ${summary.empty}`);
  console.log(`Failed: ${summary.failed}`);

  return summary;
}

function getMissingRecommendationTextQuery() {
  return {
    $or: [
      { recommendationText: { $exists: false } },
      { recommendationText: null },
      { recommendationText: "" },
    ],
  };
}

function hasRecommendationText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getFragranceLabel(fragrance) {
  const name = [fragrance.brand, fragrance.name].filter(Boolean).join(" ").trim();
  return `${name || "Unknown fragrance"} (${fragrance._id})`;
}

function logSample(action, fragrance, count) {
  if (count <= 20 || count % progressInterval === 0) {
    console.log(`${action}: ${getFragranceLabel(fragrance)}`);
  }
}

function parseArgs(args) {
  const options = {
    dryRun: false,
    force: false,
    limit: null,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--limit=")) {
      const limit = Number(arg.split("=")[1]);

      if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error("--limit must be a positive integer.");
      }

      options.limit = limit;
    }
  }

  return options;
}

if (require.main === module) {
  generateRecommendationText().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  generateRecommendationText,
  parseArgs,
};
