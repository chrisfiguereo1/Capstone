const OpenAI = require("openai");

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

let openaiClient = null;

async function createEmbedding(text, options = {}) {
  const embeddings = await createEmbeddings([text], options);
  return embeddings[0];
}

async function createEmbeddings(inputs, options = {}) {
  const normalizedInputs = normalizeInputs(inputs);

  if (normalizedInputs.length === 0) {
    throw new Error("At least one non-empty input is required to create embeddings.");
  }

  const model = options.model || EMBEDDING_MODEL;
  const response = await withRetry(
    () =>
      getOpenAIClient().embeddings.create({
        model,
        input: normalizedInputs,
        dimensions: options.dimensions || EMBEDDING_DIMENSIONS,
      }),
    {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    }
  );

  if (!response || !Array.isArray(response.data)) {
    throw new Error("OpenAI embeddings response did not include a data array.");
  }

  const embeddings = response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);

  if (embeddings.length !== normalizedInputs.length) {
    throw new Error(
      `OpenAI returned ${embeddings.length} embeddings for ${normalizedInputs.length} inputs.`
    );
  }

  const expectedDimensions = options.dimensions || EMBEDDING_DIMENSIONS;
  const dimensions = validateEmbeddingBatch(embeddings, expectedDimensions);

  return embeddings.map((embedding) => {
    if (embedding.length !== dimensions) {
      throw new Error("OpenAI returned embeddings with inconsistent dimensions.");
    }

    return embedding;
  });
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from the backend environment.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

function normalizeInputs(inputs) {
  if (!Array.isArray(inputs)) {
    throw new Error("Embedding inputs must be provided as an array.");
  }

  return inputs.map((input) => {
    if (typeof input !== "string" || !input.trim()) {
      throw new Error("Embedding input must be a non-empty string.");
    }

    return input.trim();
  });
}

function validateEmbeddingBatch(embeddings, expectedDimensions = EMBEDDING_DIMENSIONS) {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error("OpenAI returned no embeddings.");
  }

  let dimensions = null;

  for (const embedding of embeddings) {
    validateEmbedding(embedding, expectedDimensions);

    if (dimensions === null) {
      dimensions = embedding.length;
    } else if (embedding.length !== dimensions) {
      throw new Error("OpenAI returned embeddings with inconsistent dimensions.");
    }
  }

  return dimensions;
}

function validateEmbedding(embedding, expectedDimensions = EMBEDDING_DIMENSIONS) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding must be a non-empty array.");
  }

  if (embedding.length !== expectedDimensions) {
    throw new Error(
      `Embedding must contain ${expectedDimensions} dimensions. Received ${embedding.length}.`
    );
  }

  if (!embedding.every((value) => Number.isFinite(value))) {
    throw new Error("Embedding must contain only finite numbers.");
  }
}

async function withRetry(operation, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= options.maxRetries || !isRetryableError(error)) {
        break;
      }

      const retryAfterMs = getRetryAfterMs(error);
      const delayMs =
        retryAfterMs || options.retryDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `OpenAI embedding request failed with retryable error (${getErrorStatus(
          error
        ) || error.code || error.name || "unknown"}). Retrying in ${delayMs}ms.`
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`OpenAI embedding request failed: ${lastError.message}`);
}

function isRetryableError(error) {
  const status = getErrorStatus(error);
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status >= 500 && status < 600) ||
    ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"].includes(error.code)
  );
}

function getErrorStatus(error) {
  return error.status || error.statusCode || error.response?.status || null;
}

function getRetryAfterMs(error) {
  const retryAfterMs =
    error.headers?.["retry-after-ms"] ||
    error.response?.headers?.["retry-after-ms"];
  const retryAfter =
    error.headers?.["retry-after"] || error.response?.headers?.["retry-after"];

  if (retryAfterMs) {
    const numericRetryAfterMs = Number(retryAfterMs);
    return Number.isFinite(numericRetryAfterMs) && numericRetryAfterMs > 0
      ? Math.ceil(numericRetryAfterMs)
      : null;
  }

  if (!retryAfter) {
    return null;
  }

  const numericRetryAfter = Number(retryAfter);

  if (!Number.isFinite(numericRetryAfter) || numericRetryAfter <= 0) {
    return null;
  }

  return Math.ceil(numericRetryAfter * 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  createEmbedding,
  createEmbeddings,
  validateEmbedding,
};
