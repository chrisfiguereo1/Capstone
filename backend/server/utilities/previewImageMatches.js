require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const dbConnection = require("../config/db.config");
const Fragrance = require("../models/fragrance");
const {
  getSupportedImageFiles,
  normalizeImageKey,
} = require("./inspectFragranceImages");

const reportDirectory = path.join(__dirname, "../reports");
const duplicateReportPath = path.join(
  reportDirectory,
  "duplicate-fragrance-keys.json"
);
const fragrancePreviewFields =
  "_id brand name year gender image imageUrl imagePublicId imageSource url source ratingValue ratingCount";

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

function hasImage(fragrance) {
  return Boolean(fragrance.image || fragrance.imageUrl);
}

function getImageValue(fragrance) {
  return fragrance.image || fragrance.imageUrl || "";
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return "none";
  }

  return value;
}

function buildDuplicateReport(duplicateGroups) {
  return duplicateGroups.map(([normalizedKey, records]) => ({
    normalizedKey,
    count: records.length,
    records: records.map((fragrance) => ({
      _id: fragrance._id.toString(),
      brand: fragrance.brand || "",
      name: fragrance.name || "",
      year: fragrance.year,
      gender: fragrance.gender || "",
      hasImage: hasImage(fragrance),
      image: fragrance.image || null,
      imageUrl: fragrance.imageUrl || null,
      imagePublicId: fragrance.imagePublicId || null,
      imageSource: fragrance.imageSource || null,
      sourceUrl: fragrance.url || null,
      source: fragrance.source || null,
      ratingValue: fragrance.ratingValue,
      ratingCount: fragrance.ratingCount,
    })),
  }));
}

function writeDuplicateReport(report) {
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(
    duplicateReportPath,
    `${JSON.stringify(report, null, 2)}\n`
  );
}

function printFragranceDetails(fragrance, index) {
  console.log(`${index + 1}.`);
  console.log(`ID: ${fragrance._id}`);
  console.log(`Brand: ${formatValue(fragrance.brand)}`);
  console.log(`Name: ${formatValue(fragrance.name)}`);
  console.log(`Year: ${formatValue(fragrance.year)}`);
  console.log(`Gender: ${formatValue(fragrance.gender)}`);
  console.log(`Has image: ${hasImage(fragrance) ? "yes" : "no"}`);
  console.log(`Image value: ${formatValue(getImageValue(fragrance))}`);
  console.log(`Image public ID: ${formatValue(fragrance.imagePublicId)}`);
  console.log(`Image source: ${formatValue(fragrance.imageSource)}`);
  console.log(`Source URL: ${formatValue(fragrance.url || fragrance.sourceUrl)}`);
  console.log(`Data source: ${formatValue(fragrance.source)}`);
  console.log(`Rating: ${formatValue(fragrance.ratingValue)}`);
  console.log(`Rating count: ${formatValue(fragrance.ratingCount)}`);
}

function printDuplicateReport(report) {
  console.log("\nDuplicate Database Key Report\n");

  if (report.length === 0) {
    console.log("No duplicate normalized database keys found.");
    return;
  }

  report.forEach((group) => {
    console.log(`\nDUPLICATE KEY: ${group.normalizedKey}`);
    console.log(`Records: ${group.count}\n`);

    group.records.forEach((fragrance, index) => {
      printFragranceDetails(fragrance, index);
      console.log("");
    });
  });
}

function printReadyToUpload(filename, fragrance) {
  console.log("\nREADY TO UPLOAD\n");
  console.log(filename);
  console.log("\n->\n");
  console.log(fragrance.brand || "");
  console.log(fragrance.name || "");
}

function printNoMatch(filename) {
  console.log("\nNO MATCH\n");
  console.log(filename);
}

function printAlreadyHasImage(filename, fragrance) {
  console.log("\nALREADY HAS IMAGE\n");
  console.log(filename);
  console.log("\n->\n");
  console.log(fragrance.brand || "");
  console.log(fragrance.name || "");
}

function printAmbiguousMatch(filename, key, matches) {
  console.log("\nAMBIGUOUS MATCH\n");
  console.log(filename);
  console.log(`Normalized key: ${key}`);
  console.log(`Matching database records: ${matches.length}`);

  matches.forEach((fragrance, index) => {
    console.log("");
    printFragranceDetails(fragrance, index);
  });
}

async function previewImageMatches() {
  try {
    await dbConnection();

    const imageFiles = getSupportedImageFiles();
    const fragrances = await Fragrance.find({}, fragrancePreviewFields)
      .lean()
      .exec();

    const fragrancesByKey = groupByKey(fragrances, normalizeFragranceKey);
    const fragranceDuplicateKeys = [...fragrancesByKey.entries()].filter(
      ([, matches]) => matches.length > 1
    );
    const duplicateReport = buildDuplicateReport(fragranceDuplicateKeys);

    let readyToUpload = 0;
    let alreadyHaveImages = 0;
    let ambiguousImageMatches = 0;
    let unmatchedImages = 0;

    writeDuplicateReport(duplicateReport);

    console.log(`Total images found: ${imageFiles.length}`);
    console.log(`Total fragrances: ${fragrances.length}`);

    imageFiles.forEach((filename) => {
      const key = normalizeImageKey(filename);
      const matches = fragrancesByKey.get(key) || [];

      if (matches.length === 0) {
        unmatchedImages += 1;
        printNoMatch(filename);
        return;
      }

      if (matches.length > 1) {
        ambiguousImageMatches += 1;
        printAmbiguousMatch(filename, key, matches);
        return;
      }

      if (hasImage(matches[0])) {
        alreadyHaveImages += 1;
        printAlreadyHasImage(filename, matches[0]);
        return;
      }

      readyToUpload += 1;
      printReadyToUpload(filename, matches[0]);
    });

    printDuplicateReport(duplicateReport);

    console.log("\nSummary\n");
    console.log(`Images scanned: ${imageFiles.length}`);
    console.log(`Database fragrances: ${fragrances.length}`);
    console.log(`Ready to upload: ${readyToUpload}`);
    console.log(`Already have images: ${alreadyHaveImages}`);
    console.log(`Ambiguous image matches: ${ambiguousImageMatches}`);
    console.log(`Unmatched images: ${unmatchedImages}`);
    console.log(`Duplicate database keys: ${duplicateReport.length}`);
    console.log(`Duplicate report: ${duplicateReportPath}`);
  } catch (error) {
    console.error("Image match preview failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

previewImageMatches();
