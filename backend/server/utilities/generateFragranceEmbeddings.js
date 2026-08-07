const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Fragrance = require("../models/fragrance");
const {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  createEmbeddings,
  validateEmbedding,
} = require("../services/embeddingService");

const defaultBatchSize = 50;

async function generateFragranceEmbeddings(
  options = parseArgs(process.argv.slice(2))
) {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from .env");
  }

  if (!options.dryRun && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from the backend environment.");
  }

  await mongoose.connect(process.env.MONGO_URL);

  const summary = {
    total: 0,
    alreadyCached: 0,
    generated: 0,
    failed: 0,
    missingRecommendationText: 0,
    processed: 0,
    dimensions: null,
    model: EMBEDDING_MODEL,
    expectedDimensions: EMBEDDING_DIMENSIONS,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
  };

  try {
    summary.total = await Fragrance.countDocuments({});
    const query = options.force ? {} : getMissingEmbeddingQuery();

    if (!options.force) {
      const remaining = await Fragrance.countDocuments(query);
      summary.alreadyCached = summary.total - remaining;
    }

    console.log(
      `Starting embedding generation. total=${summary.total} model=${summary.model} force=${summary.force} dryRun=${summary.dryRun} batchSize=${options.batchSize}`
    );

    if (summary.alreadyCached > 0) {
      console.log(
        `Skipping ${summary.alreadyCached} fragrances that already have embeddings.`
      );
    }

    const cursor = Fragrance.find(query)
      .select("_id brand name recommendationText embeddingModel +embedding")
      .cursor();

    let batch = [];
    let batchNumber = 0;

    for await (const fragrance of cursor) {
      if (
        options.limit &&
        summary.processed + batch.length >= options.limit
      ) {
        break;
      }

      if (!options.force && hasValidEmbedding(fragrance.embedding)) {
        summary.alreadyCached += 1;
        continue;
      }

      if (!hasRecommendationText(fragrance.recommendationText)) {
        summary.missingRecommendationText += 1;
        console.log(`Missing recommendationText: ${getFragranceLabel(fragrance)}`);
        continue;
      }

      batch.push(fragrance);

      if (batch.length >= options.batchSize) {
        batchNumber += 1;
        await processBatch(batch, batchNumber, summary, options);
        batch = [];
      }
    }

    if (batch.length > 0) {
      batchNumber += 1;
      await processBatch(batch, batchNumber, summary, options);
    }
  } finally {
    await mongoose.disconnect();
  }

  printSummary(summary);
  return summary;
}

async function processBatch(batch, batchNumber, summary, options) {
  console.log(`Embedding batch ${batchNumber}: ${batch.length} fragrances`);

  if (options.dryRun) {
    summary.processed += batch.length;
    console.log(
      `Would generate embeddings for: ${batch
        .slice(0, 3)
        .map(getFragranceLabel)
        .join("; ")}${batch.length > 3 ? "; ..." : ""}`
    );
    return;
  }

  try {
    const inputs = batch.map((fragrance) => fragrance.recommendationText);
    const embeddings = await createEmbeddings(inputs, {
      model: summary.model,
      maxRetries: options.maxRetries,
    });

    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: received ${embeddings.length}, expected ${batch.length}.`
      );
    }

    const dimensions = validateEmbeddingsForBatch(embeddings, summary);
    const now = new Date();
    const operations = batch.map((fragrance, index) => ({
      updateOne: {
        filter: { _id: fragrance._id },
        update: {
          $set: {
            embedding: embeddings[index],
            embeddingModel: summary.model,
            embeddingUpdatedAt: now,
          },
        },
      },
    }));

    await Fragrance.bulkWrite(operations, { ordered: false });

    summary.processed += batch.length;
    summary.generated += batch.length;
    console.log(
          `Saved embeddings: ${batch.length}. Total completed: ${
        summary.generated + summary.alreadyCached
      } / ${summary.total}. Dimensions: ${dimensions}`
    );
  } catch (error) {
    summary.processed += batch.length;
    summary.failed += batch.length;
    console.error(
      `Failed batch ${batchNumber}: ${error.message}. Batch starts with ${getFragranceLabel(
        batch[0]
      )}`
    );
  }
}

function validateEmbeddingsForBatch(embeddings, summary) {
  let dimensions = null;

  for (const embedding of embeddings) {
    validateEmbedding(embedding);

    if (dimensions === null) {
      dimensions = embedding.length;
    } else if (embedding.length !== dimensions) {
      throw new Error("Batch contains inconsistent embedding dimensions.");
    }
  }

  if (summary.dimensions === null) {
    summary.dimensions = dimensions;
  } else if (summary.dimensions !== dimensions) {
    throw new Error(
      `Embedding dimensions changed from ${summary.dimensions} to ${dimensions}.`
    );
  }

  return dimensions;
}

function getMissingEmbeddingQuery() {
  return {
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
      { [`embedding.${EMBEDDING_DIMENSIONS - 1}`]: { $exists: false } },
      { [`embedding.${EMBEDDING_DIMENSIONS}`]: { $exists: true } },
    ],
  };
}

function hasValidEmbedding(value) {
  try {
    validateEmbedding(value);
    return true;
  } catch (error) {
    return false;
  }
}

function hasRecommendationText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getFragranceLabel(fragrance) {
  const name = [fragrance.brand, fragrance.name].filter(Boolean).join(" ").trim();
  return `${name || "Unknown fragrance"} (${fragrance._id})`;
}

function printSummary(summary) {
  console.log("\nEmbedding generation complete.");
  console.log(`Total fragrances: ${summary.total}`);
  console.log(`Already cached: ${summary.alreadyCached}`);
  console.log(`Generated: ${summary.generated}`);
  console.log(`Missing recommendationText: ${summary.missingRecommendationText}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Model: ${summary.model}`);
  console.log(`Dimensions: ${summary.dimensions || "N/A"}`);
}

function parseArgs(args) {
  const options = {
    dryRun: false,
    force: false,
    limit: null,
    batchSize: defaultBatchSize,
    maxRetries: 3,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveIntegerArg(arg, "--limit");
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = parsePositiveIntegerArg(arg, "--batch-size");
    } else if (arg.startsWith("--max-retries=")) {
      options.maxRetries = parsePositiveIntegerArg(arg, "--max-retries");
    }
  }

  return options;
}

function parsePositiveIntegerArg(arg, name) {
  const value = Number(arg.split("=")[1]);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

if (require.main === module) {
  generateFragranceEmbeddings().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  generateFragranceEmbeddings,
  parseArgs,
};
