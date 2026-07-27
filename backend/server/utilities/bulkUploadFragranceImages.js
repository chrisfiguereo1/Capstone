require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const cloudinary = require("../config/cloudinary.config");
const dbConnection = require("../config/db.config");
const Fragrance = require("../models/fragrance");
const {
  getFragranceImageUrl,
  hasFragranceImage,
} = require("./imagePresence");
const {
  imageFolder,
  normalizeImageKey,
} = require("./inspectFragranceImages");

const generatedImageSource = "waterscent-generated";
const generatedImageStatus = "review";

const sourceModes = {
  real: {
    cloudinaryFolder: "waterscent/fragrances",
    imageDirectory: imageFolder,
    reportFilename: "fragrance-image-upload-report.json",
    imageSource: "Cloudinary Bulk Import",
    imageStatus: "matched",
    supportedExtensions: new Set([".jpg", ".jpeg", ".png", ".webp"]),
  },
  generated: {
    cloudinaryFolder: "waterscent/fragrances/generated",
    imageDirectory: path.join(imageFolder, "generated"),
    reportFilename: "generated-image-upload-report.json",
    imageSource: generatedImageSource,
    imageStatus: generatedImageStatus,
    supportedExtensions: new Set([".svg"]),
  },
};
const reportDirectory = path.join(__dirname, "../reports");
const fragranceFields =
  "_id brand name image imageUrl imagePublicId imageSource imageStatus secureUrl";

function parseArguments(args) {
  const options = {
    dryRun: args.length === 0,
    limit: null,
    retryFailed: false,
    replaceGenerated: false,
    source: null,
  };
  let hasDryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      hasDryRun = true;
      options.dryRun = true;
      continue;
    }

    if (arg === "--retry-failed") {
      options.retryFailed = true;
      continue;
    }

    if (arg === "--replace-generated") {
      options.replaceGenerated = true;
      continue;
    }

    if (arg.startsWith("--source=")) {
      const source = arg.slice("--source=".length);

      if (!sourceModes[source]) {
        throw new Error(
          `Invalid --source value "${source}". Use "real" or "generated".`
        );
      }

      options.source = source;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const rawLimit = arg.slice("--limit=".length);
      const limit = Number(rawLimit);

      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(
          `Invalid --limit value "${rawLimit}". Use a positive whole number.`
        );
      }

      options.limit = limit;
      if (options.source) {
        options.dryRun = false;
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (hasDryRun || !options.source || (args.length > 0 && options.limit === null)) {
    options.dryRun = true;
  }

  if (!hasDryRun && options.source && options.limit !== null) {
    options.dryRun = false;
  }

  if (options.replaceGenerated && options.source !== "real") {
    throw new Error("--replace-generated can only be used with --source=real.");
  }

  return options;
}

function normalizeFragranceKey(fragrance) {
  return normalizeImageKey(`${fragrance.brand || ""}${fragrance.name || ""}`);
}

function groupByKey(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function getReportPath(sourceMode) {
  const reportFilename = sourceMode
    ? sourceModes[sourceMode].reportFilename
    : sourceModes.real.reportFilename;

  return path.join(reportDirectory, reportFilename);
}

function loadPreviouslyFailedFilenames(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return new Set();
  }

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const failedResults = Array.isArray(report.results)
      ? report.results.filter((result) => result.classification === "FAILED")
      : [];

    return new Set(failedResults.map((result) => result.filename));
  } catch (error) {
    console.warn(
      "Could not read previous upload report; previously failed files will not be skipped."
    );
    console.warn(error.message);
    return new Set();
  }
}

function createResult(filename, normalizedKey, classification, details) {
  return {
    filename,
    normalizedKey,
    classification,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

function createEmptyReport(options) {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    dryRun: options.dryRun,
    limit: options.limit,
    retryFailed: options.retryFailed,
    replaceGenerated: options.replaceGenerated,
    sourceMode: options.source || "none",
    summary: {
      imagesScanned: 0,
      eligible: 0,
      uploaded: 0,
      replacedGenerated: 0,
      alreadyHasImage: 0,
      existingRealImageProtected: 0,
      generatedReplacementNotRequested: 0,
      invalidGeneratedMetadata: 0,
      ambiguous: 0,
      invalidGeneratedFiles: 0,
      unmatched: 0,
      failed: 0,
      cleanupRequired: 0,
      skippedPreviouslyFailed: 0,
    },
    results: [],
  };
}

function writeReport(report, reportPath) {
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function getFragranceDetails(fragrance) {
  if (!fragrance) {
    return {};
  }

  return {
    fragranceId: fragrance._id.toString(),
    brand: fragrance.brand || "",
    name: fragrance.name || "",
  };
}

function buildCloudinaryPublicId(normalizedKey, sourceMode) {
  if (sourceMode === "generated") {
    return `generated_${normalizedKey}`;
  }

  return normalizedKey;
}

function getGuardedNoImageQuery(fragranceId) {
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

function getGeneratedCloudinaryFolderPrefix() {
  return `${sourceModes.generated.cloudinaryFolder}/`;
}

function hasGeneratedPlaceholderMetadata(fragrance) {
  return (
    fragrance.imageSource === generatedImageSource &&
    fragrance.imageStatus === generatedImageStatus &&
    typeof fragrance.imagePublicId === "string" &&
    fragrance.imagePublicId.startsWith(getGeneratedCloudinaryFolderPrefix()) &&
    hasFragranceImage(fragrance)
  );
}

function getGeneratedReplacementValidationError(fragrance) {
  if (fragrance.imageSource !== generatedImageSource) {
    return `Expected imageSource "${generatedImageSource}".`;
  }

  if (fragrance.imageStatus !== generatedImageStatus) {
    return `Expected imageStatus "${generatedImageStatus}".`;
  }

  if (
    typeof fragrance.imagePublicId !== "string" ||
    !fragrance.imagePublicId.startsWith(getGeneratedCloudinaryFolderPrefix())
  ) {
    return `Expected imagePublicId to begin with "${getGeneratedCloudinaryFolderPrefix()}".`;
  }

  if (!hasFragranceImage(fragrance)) {
    return "Expected an existing generated image URL.";
  }

  return null;
}

function getGuardedGeneratedReplacementQuery(fragrance) {
  const query = {
    _id: fragrance._id,
    imageSource: generatedImageSource,
    imageStatus: generatedImageStatus,
    imagePublicId: fragrance.imagePublicId,
  };

  const imageUrl = getFragranceImageUrl(fragrance);

  if (typeof fragrance.image === "string" && fragrance.image.trim().length > 0) {
    query.image = fragrance.image;
  }

  if (
    typeof fragrance.imageUrl === "string" &&
    fragrance.imageUrl.trim().length > 0
  ) {
    query.imageUrl = fragrance.imageUrl;
  }

  if (!query.image && !query.imageUrl && imageUrl) {
    query.$or = [{ image: imageUrl }, { imageUrl }];
  }

  return query;
}

function getImageFiles(sourceMode) {
  const sourceConfig = sourceModes[sourceMode];

  return fs
    .readdirSync(sourceConfig.imageDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => {
      const extension = path.extname(filename).toLowerCase();
      return (
        !filename.startsWith(".") &&
        filename !== ".gitkeep" &&
        sourceConfig.supportedExtensions.has(extension)
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

function validateGeneratedSvg(filename) {
  const filePath = path.join(sourceModes.generated.imageDirectory, filename);
  const svg = fs.readFileSync(filePath, "utf8");
  const trimmed = svg.trimStart().toLowerCase();

  if (path.extname(filename).toLowerCase() !== ".svg") {
    return "Generated file must have a .svg extension.";
  }

  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<svg")) {
    return "Generated SVG must begin with XML or SVG content.";
  }

  if (!svg.includes("waterscent-generated-placeholder")) {
    return "Generated SVG is missing the WaterScent internal marker.";
  }

  if (!svg.includes("Generated fragrance artwork")) {
    return "Generated SVG is missing the visible disclosure text.";
  }

  if (/<script[\s>]/i.test(svg)) {
    return "Generated SVG must not contain scripts.";
  }

  if (/<(?:iframe|foreignObject)[\s>]/i.test(svg)) {
    return "Generated SVG must not contain iframes or foreign objects.";
  }

  if (/<image[\s>]/i.test(svg) || /<style[\s>]/i.test(svg)) {
    return "Generated SVG must not contain image or stylesheet elements.";
  }

  if (/(?:href|src)=["']https?:\/\//i.test(svg) || /url\(\s*https?:\/\//i.test(svg)) {
    return "Generated SVG must not contain remote URL references.";
  }

  return null;
}

async function uploadImage(filename, normalizedKey, sourceMode) {
  const sourceConfig = sourceModes[sourceMode];
  const imagePath = path.join(sourceConfig.imageDirectory, filename);
  const publicId = buildCloudinaryPublicId(normalizedKey, sourceMode);

  const result = await cloudinary.uploader.upload(imagePath, {
    folder: sourceConfig.cloudinaryFolder,
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
    transformation: [
      {
        width: 800,
        height: 800,
        crop: "limit",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });

  if (!result.secure_url) {
    throw new Error("Cloudinary upload did not return a secure URL.");
  }

  return result;
}

async function deleteUploadedAsset(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return {
      compensationDeleted: result.result === "ok",
      compensationResult: result.result,
    };
  } catch (error) {
    return {
      compensationDeleted: false,
      compensationError: error.message,
    };
  }
}

async function updateFragranceImage(fragrance, uploadResult, sourceMode) {
  const sourceConfig = sourceModes[sourceMode];

  return Fragrance.updateOne(getGuardedNoImageQuery(fragrance._id), {
    $set: {
      image: uploadResult.secure_url,
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
      imageSource: sourceConfig.imageSource,
      imageStatus: sourceConfig.imageStatus,
    },
  });
}

async function replaceGeneratedFragranceImage(fragrance, uploadResult) {
  const sourceConfig = sourceModes.real;

  return Fragrance.updateOne(getGuardedGeneratedReplacementQuery(fragrance), {
    $set: {
      image: uploadResult.secure_url,
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
      imageSource: sourceConfig.imageSource,
      imageStatus: sourceConfig.imageStatus,
    },
  });
}

function printResult(result) {
  console.log(`\n${result.classification}`);
  console.log(result.filename);

  if (result.brand || result.name) {
    console.log(`${result.brand || ""} ${result.name || ""}`.trim());
  }

  if (result.error) {
    console.log(result.error);
  }
}

async function processEligibleUpload(
  filename,
  normalizedKey,
  fragrance,
  report,
  sourceMode,
  options
) {
  const sourceConfig = sourceModes[sourceMode];
  const publicId = `${sourceConfig.cloudinaryFolder}/${buildCloudinaryPublicId(
    normalizedKey,
    sourceMode
  )}`;
  const replacingGenerated = Boolean(options.replaceGenerated);
  const oldGeneratedImageUrl = replacingGenerated
    ? getFragranceImageUrl(fragrance)
    : null;
  const oldGeneratedPublicId = replacingGenerated
    ? fragrance.imagePublicId || null
    : null;
  const baseDetails = {
    ...getFragranceDetails(fragrance),
    replacementRequested: replacingGenerated,
    oldGeneratedImageUrl,
    oldGeneratedPublicId,
    cloudinaryPublicId: publicId,
    imageSourceSaved: sourceConfig.imageSource,
    imageStatusSaved: sourceConfig.imageStatus,
  };

  try {
    const uploadResult = await uploadImage(filename, normalizedKey, sourceMode);
    const updateResult = replacingGenerated
      ? await replaceGeneratedFragranceImage(fragrance, uploadResult)
      : await updateFragranceImage(fragrance, uploadResult, sourceMode);

    if (updateResult.modifiedCount !== 1) {
      const compensation = await deleteUploadedAsset(uploadResult.public_id);
      throw new Error(
        `MongoDB guarded update modified ${updateResult.modifiedCount} records. Compensation deletion result: ${JSON.stringify(
          compensation
        )}`
      );
    }

    let oldAssetDeletionStatus = null;
    let cleanupRequired = false;

    if (replacingGenerated) {
      const oldAssetDeletion = await deleteUploadedAsset(oldGeneratedPublicId);
      oldAssetDeletionStatus =
        oldAssetDeletion.compensationResult ||
        oldAssetDeletion.compensationError ||
        "unknown";
      cleanupRequired = oldAssetDeletion.compensationDeleted !== true;

      if (cleanupRequired) {
        report.summary.cleanupRequired += 1;
      }
    }

    report.summary.uploaded += 1;
    if (replacingGenerated) {
      report.summary.replacedGenerated += 1;
    }

    return createResult(filename, normalizedKey, "UPLOADED", {
      ...baseDetails,
      databaseReplacementStatus:
        updateResult.modifiedCount === 1 ? "updated" : "not_updated",
      oldAssetDeletionStatus,
      cleanupRequired,
      cloudinaryPublicId: uploadResult.public_id,
      newPublicId: uploadResult.public_id,
      secureUrl: uploadResult.secure_url,
      newImageUrl: uploadResult.secure_url,
    });
  } catch (error) {
    report.summary.failed += 1;
    return createResult(filename, normalizedKey, "FAILED", {
      ...baseDetails,
      error: error.message,
    });
  }
}

async function bulkUploadFragranceImages() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const report = createEmptyReport(options);
  const reportPath = getReportPath(options.source);

  try {
    await dbConnection();

    const imageFiles = options.source ? getImageFiles(options.source) : [];
    const previouslyFailed = loadPreviouslyFailedFilenames(reportPath);
    const fragrances = await Fragrance.find({}, fragranceFields).lean().exec();
    const fragrancesByKey = groupByKey(fragrances, normalizeFragranceKey);

    let uploadAttempts = 0;
    report.summary.imagesScanned = imageFiles.length;

    console.log(options.dryRun ? "DRY RUN" : "LIVE UPLOAD");
    console.log(`Source mode: ${options.source || "none"}`);
    console.log(`Replace generated: ${options.replaceGenerated ? "yes" : "no"}`);
    console.log(`Images found: ${imageFiles.length}`);

    for (const filename of imageFiles) {
      const normalizedKey = normalizeImageKey(filename);
      const matches = fragrancesByKey.get(normalizedKey) || [];

      if (options.source === "generated") {
        const validationError = validateGeneratedSvg(filename);

        if (validationError) {
          report.summary.invalidGeneratedFiles += 1;
          const result = createResult(filename, normalizedKey, "INVALID_GENERATED_FILE", {
            error: validationError,
          });
          report.results.push(result);
          printResult(result);
          continue;
        }
      }

      if (!options.retryFailed && previouslyFailed.has(filename)) {
        report.summary.skippedPreviouslyFailed += 1;
        const result = createResult(
          filename,
          normalizedKey,
          "SKIPPED_PREVIOUSLY_FAILED",
          {}
        );
        report.results.push(result);
        printResult(result);
        continue;
      }

      if (matches.length === 0) {
        report.summary.unmatched += 1;
        const result = createResult(filename, normalizedKey, "NO_MATCH", {});
        report.results.push(result);
        printResult(result);
        continue;
      }

      if (matches.length > 1) {
        report.summary.ambiguous += 1;
        const result = createResult(filename, normalizedKey, "AMBIGUOUS_MATCH", {
          matchingRecordCount: matches.length,
          matchingFragranceIds: matches.map((match) => match._id.toString()),
        });
        report.results.push(result);
        printResult(result);
        continue;
      }

      const fragrance = matches[0];

      if (hasFragranceImage(fragrance)) {
        if (options.source === "real" && options.replaceGenerated) {
          if (fragrance.imageSource !== generatedImageSource) {
            report.summary.existingRealImageProtected += 1;
            report.summary.alreadyHasImage += 1;
            const result = createResult(
              filename,
              normalizedKey,
              "EXISTING_REAL_IMAGE_PROTECTED",
              {
                ...getFragranceDetails(fragrance),
                replacementRequested: true,
                existingImage: getFragranceImageUrl(fragrance),
                existingImagePublicId: fragrance.imagePublicId || null,
                existingImageSource: fragrance.imageSource || null,
                existingImageStatus: fragrance.imageStatus || null,
              }
            );
            report.results.push(result);
            printResult(result);
            continue;
          }

          const validationError =
            getGeneratedReplacementValidationError(fragrance);

          if (validationError) {
            report.summary.invalidGeneratedMetadata += 1;
            const result = createResult(
              filename,
              normalizedKey,
              "INVALID_GENERATED_METADATA",
              {
                ...getFragranceDetails(fragrance),
                replacementRequested: true,
                existingImage: getFragranceImageUrl(fragrance),
                existingImagePublicId: fragrance.imagePublicId || null,
                existingImageSource: fragrance.imageSource || null,
                existingImageStatus: fragrance.imageStatus || null,
                error: validationError,
              }
            );
            report.results.push(result);
            printResult(result);
            continue;
          }

          report.summary.eligible += 1;

          if (options.dryRun) {
            const result = createResult(
              filename,
              normalizedKey,
              "READY_TO_REPLACE_GENERATED",
              {
                ...getFragranceDetails(fragrance),
                replacementRequested: true,
                oldGeneratedImageUrl: getFragranceImageUrl(fragrance),
                oldGeneratedPublicId: fragrance.imagePublicId || null,
                newPublicId: `${sourceModes.real.cloudinaryFolder}/${buildCloudinaryPublicId(
                  normalizedKey,
                  options.source
                )}`,
                imageSourceSaved: sourceModes.real.imageSource,
                imageStatusSaved: sourceModes.real.imageStatus,
              }
            );
            report.results.push(result);
            printResult(result);
            continue;
          }

          if (options.limit !== null && uploadAttempts >= options.limit) {
            const result = createResult(filename, normalizedKey, "SKIPPED_LIMIT", {
              ...getFragranceDetails(fragrance),
              replacementRequested: true,
            });
            report.results.push(result);
            printResult(result);
            continue;
          }

          uploadAttempts += 1;
          const result = await processEligibleUpload(
            filename,
            normalizedKey,
            fragrance,
            report,
            options.source,
            options
          );
          report.results.push(result);
          printResult(result);
          continue;
        }

        let classification = "ALREADY_HAS_IMAGE";

        if (options.source === "real") {
          const isGeneratedPlaceholder = hasGeneratedPlaceholderMetadata(fragrance);
          classification = isGeneratedPlaceholder
            ? "GENERATED_REPLACEMENT_NOT_REQUESTED"
            : "EXISTING_REAL_IMAGE_PROTECTED";

          if (isGeneratedPlaceholder) {
            report.summary.generatedReplacementNotRequested += 1;
          } else {
            report.summary.existingRealImageProtected += 1;
          }
        }

        report.summary.alreadyHasImage += 1;
        const result = createResult(filename, normalizedKey, classification, {
          ...getFragranceDetails(fragrance),
          replacementRequested: options.replaceGenerated,
          existingImage: getFragranceImageUrl(fragrance),
          existingImagePublicId: fragrance.imagePublicId || null,
          existingImageSource: fragrance.imageSource || null,
          existingImageStatus: fragrance.imageStatus || null,
        });
        report.results.push(result);
        printResult(result);
        continue;
      }

      if (options.source === "real" && options.replaceGenerated) {
        report.summary.invalidGeneratedMetadata += 1;
        const result = createResult(filename, normalizedKey, "INVALID_GENERATED_METADATA", {
          ...getFragranceDetails(fragrance),
          replacementRequested: true,
          error: "Matched record does not have an existing generated image to replace.",
        });
        report.results.push(result);
        printResult(result);
        continue;
      }

      report.summary.eligible += 1;

      if (options.dryRun) {
        const sourceConfig = sourceModes[options.source];
        const result = createResult(filename, normalizedKey, "READY_TO_UPLOAD", {
          ...getFragranceDetails(fragrance),
          cloudinaryPublicId: `${sourceConfig.cloudinaryFolder}/${buildCloudinaryPublicId(
            normalizedKey,
            options.source
          )}`,
          imageSourceSaved: sourceConfig.imageSource,
          imageStatusSaved: sourceConfig.imageStatus,
        });
        report.results.push(result);
        printResult(result);
        continue;
      }

      if (options.limit !== null && uploadAttempts >= options.limit) {
        const result = createResult(filename, normalizedKey, "SKIPPED_LIMIT", {
          ...getFragranceDetails(fragrance),
        });
        report.results.push(result);
        printResult(result);
        continue;
      }

      uploadAttempts += 1;
      const result = await processEligibleUpload(
        filename,
        normalizedKey,
        fragrance,
        report,
        options.source,
        options
      );
      report.results.push(result);
      printResult(result);
    }

    report.finishedAt = new Date().toISOString();
    writeReport(report, reportPath);

    console.log("\nSummary\n");
    console.log(`Images scanned: ${report.summary.imagesScanned}`);
    console.log(`Eligible: ${report.summary.eligible}`);
    console.log(`Uploaded: ${report.summary.uploaded}`);
    console.log(`Replaced generated: ${report.summary.replacedGenerated}`);
    console.log(`Already have images: ${report.summary.alreadyHasImage}`);
    console.log(
      `Generated replacement not requested: ${report.summary.generatedReplacementNotRequested}`
    );
    console.log(
      `Existing real images protected: ${report.summary.existingRealImageProtected}`
    );
    console.log(
      `Invalid generated metadata: ${report.summary.invalidGeneratedMetadata}`
    );
    console.log(`Ambiguous matches: ${report.summary.ambiguous}`);
    console.log(`Invalid generated files: ${report.summary.invalidGeneratedFiles}`);
    console.log(`Unmatched: ${report.summary.unmatched}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Cleanup required: ${report.summary.cleanupRequired}`);
    console.log(
      `Skipped previously failed: ${report.summary.skippedPreviouslyFailed}`
    );
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.summary.failed += 1;
    report.results.push(
      createResult("", "", "FAILED", {
        error: error.message,
      })
    );
    writeReport(report, reportPath);
    console.error("Bulk image upload failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

bulkUploadFragranceImages();
