const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const indexConfigPath = path.join(
  __dirname,
  "../config/fragranceVectorSearchIndex.json"
);

async function recreateFragranceVectorSearchIndex() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from .env");
  }

  const config = JSON.parse(fs.readFileSync(indexConfigPath, "utf8"));

  await mongoose.connect(process.env.MONGO_URL);

  try {
    await dropSearchIndexIfExists(config);
    await createSearchIndex(config);
    await waitForSearchIndex(config);
  } finally {
    await mongoose.disconnect();
  }
}

async function dropSearchIndexIfExists(config) {
  const indexes = await listSearchIndexes(config.collection);
  const existingIndex = indexes.find((index) => index.name === config.name);

  if (!existingIndex) {
    console.log(`No existing search index named ${config.name}.`);
    return;
  }

  await mongoose.connection.db.command({
    dropSearchIndex: config.collection,
    name: config.name,
  });
  console.log(`Dropped existing search index ${config.name}.`);
}

async function createSearchIndex(config) {
  const result = await mongoose.connection.db.command({
    createSearchIndexes: config.collection,
    indexes: [
      {
        name: config.name,
        type: config.type,
        definition: config.definition,
      },
    ],
  });

  console.log(JSON.stringify(result, null, 2));
}

async function waitForSearchIndex(config) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const indexes = await listSearchIndexes(config.collection);
    const index = indexes.find((item) => item.name === config.name);

    console.log(
      `Index poll ${attempt}: status=${index?.status || "missing"} queryable=${
        index?.queryable || false
      }`
    );

    if (index && (index.queryable || index.status === "READY")) {
      return index;
    }

    await sleep(5000);
  }

  throw new Error(`Search index ${config.name} was not ready after polling.`);
}

async function listSearchIndexes(collection) {
  const result = await mongoose.connection.db.command({
    aggregate: collection,
    pipeline: [{ $listSearchIndexes: {} }],
    cursor: {},
  });

  return result.cursor.firstBatch || [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  recreateFragranceVectorSearchIndex().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  recreateFragranceVectorSearchIndex,
};
