require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const dbConnection = require("../config/db.config");
const Fragrance = require("../models/fragrance");
const { hasFragranceImage } = require("./imagePresence");
const { normalizeImageKey } = require("./inspectFragranceImages");

const outputDirectory = path.join(__dirname, "../fragrance-images/generated");
const reportDirectory = path.join(__dirname, "../reports");
const duplicateReportPath = path.join(
  reportDirectory,
  "duplicate-fragrance-keys.json"
);
const reportPath = path.join(reportDirectory, "generated-fragrance-images.json");
const generatedMarker = "waterscent-generated-placeholder";
const fragranceFields =
  "_id brand name year accords image imageUrl imageSource imageStatus";

const palettes = [
  {
    name: "cool-airy",
    accords: ["fresh", "aquatic", "marine", "ozonic", "water"],
    colors: ["#dff7ff", "#79bfe5", "#2c6688", "#f5fcff"],
  },
  {
    name: "warm-natural",
    accords: ["woody", "oud", "earthy", "mossy", "patchouli"],
    colors: ["#f3dfc3", "#a47747", "#3c2b20", "#fff8ea"],
  },
  {
    name: "soft-rich",
    accords: ["vanilla", "sweet", "gourmand", "caramel", "chocolate"],
    colors: ["#ffe8cc", "#c77a76", "#5b2f45", "#fff6e6"],
  },
  {
    name: "bright-botanical",
    accords: ["citrus", "aromatic", "green", "herbal", "bergamot"],
    colors: ["#f7ffd9", "#8fcf74", "#28705c", "#fffde7"],
  },
  {
    name: "elegant-floral",
    accords: ["floral", "rose", "white floral", "powdery", "violet"],
    colors: ["#fff0f7", "#d989b5", "#634174", "#fffafd"],
  },
  {
    name: "dark-sophisticated",
    accords: ["leather", "tobacco", "smoky", "amber", "spicy"],
    colors: ["#2f2b33", "#7d5741", "#141217", "#f3d9b0"],
  },
];

function parseArguments(args) {
  const options = {
    dryRun: args.length === 0,
    limit: null,
    overwriteGenerated: false,
  };
  let hasDryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      hasDryRun = true;
      options.dryRun = true;
      continue;
    }

    if (arg === "--overwrite-generated") {
      options.overwriteGenerated = true;
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
      options.dryRun = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (hasDryRun || (args.length > 0 && options.limit === null)) {
    options.dryRun = true;
  }

  return options;
}

function normalizeFragranceKey(fragrance) {
  return normalizeImageKey(`${fragrance.brand || ""}${fragrance.name || ""}`);
}

function readDuplicateKeys() {
  if (!fs.existsSync(duplicateReportPath)) {
    return new Set();
  }

  const report = JSON.parse(fs.readFileSync(duplicateReportPath, "utf8"));
  return new Set(report.map((group) => group.normalizedKey));
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function titleCase(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function wrapText(value, maxChars, maxLines) {
  const words = titleCase(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word.length > maxChars ? word.slice(0, maxChars - 1) : word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function getPalette(accords) {
  const normalizedAccords = (accords || []).map((accord) =>
    String(accord).toLowerCase()
  );

  return (
    palettes.find((palette) =>
      palette.accords.some((accord) =>
        normalizedAccords.some((item) => item.includes(accord))
      )
    ) || palettes[0]
  );
}

function isGeneratedFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return fs.readFileSync(filePath, "utf8").includes(generatedMarker);
}

function getOutputPaths(normalizedKey) {
  const filename = `${normalizedKey}.svg`;

  return {
    filename,
    outputPath: path.join(outputDirectory, filename),
  };
}

function buildTextLines(lines, startY, fontSize, lineHeight, weight) {
  return lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      return `<text x="500" y="${y}" text-anchor="middle" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="#fff">${escapeXml(line)}</text>`;
    })
    .join("\n");
}

function buildSvg(fragrance, normalizedKey) {
  const accords = Array.isArray(fragrance.accords) ? fragrance.accords : [];
  const palette = getPalette(accords);
  const [colorOne, colorTwo, colorThree, colorFour] = palette.colors;
  const brandLines = wrapText(fragrance.brand || "Unknown Brand", 24, 2);
  const nameLines = wrapText(fragrance.name || "Untitled Fragrance", 22, 3);
  const year = fragrance.year ? String(fragrance.year) : "";
  const accordLabels = accords.slice(0, 3).map(titleCase);
  const accordText = accordLabels.length ? accordLabels.join("  /  ") : "Fragrance Artwork";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${generatedMarker}:${normalizedKey} -->
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(titleCase(fragrance.brand))} ${escapeXml(titleCase(fragrance.name))} generated WaterScent artwork</title>
  <desc id="desc">Generated placeholder artwork with a generic perfume bottle silhouette. This is not real product photography.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colorOne}"/>
      <stop offset="52%" stop-color="${colorTwo}"/>
      <stop offset="100%" stop-color="${colorThree}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${colorFour}" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="${colorOne}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.48"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#000" flood-opacity="0.30"/>
    </filter>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect width="1000" height="1000" fill="url(#glow)"/>
  <circle cx="210" cy="210" r="170" fill="#fff" opacity="0.10"/>
  <circle cx="820" cy="180" r="120" fill="#fff" opacity="0.08"/>
  <circle cx="780" cy="790" r="210" fill="#000" opacity="0.08"/>
  <path d="M116 720 C245 610 338 704 461 620 C591 531 680 584 885 486" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="3"/>

  ${buildTextLines(brandLines, 116, 38, 44, 600)}

  <g filter="url(#shadow)">
    <rect x="439" y="265" width="122" height="70" rx="18" fill="#fff" opacity="0.40"/>
    <rect x="464" y="221" width="72" height="58" rx="14" fill="#fff" opacity="0.50"/>
    <rect x="443" y="202" width="114" height="30" rx="13" fill="#fff" opacity="0.58"/>
    <path d="M380 355 C380 318 410 294 447 294 H553 C590 294 620 318 620 355 V680 C620 732 580 766 500 766 C420 766 380 732 380 680 Z" fill="url(#glass)" stroke="#fff" stroke-opacity="0.72" stroke-width="5"/>
    <path d="M419 378 C442 342 478 334 500 334 C470 414 468 587 424 680 C410 617 409 457 419 378 Z" fill="#fff" opacity="0.23"/>
    <rect x="423" y="478" width="154" height="118" rx="22" fill="#fff" opacity="0.18" stroke="#fff" stroke-opacity="0.28"/>
  </g>

  ${buildTextLines(nameLines, 836 - (nameLines.length - 1) * 27, 46, 54, 700)}
  ${
    year
      ? `<text x="500" y="930" text-anchor="middle" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#fff" opacity="0.82">${escapeXml(year)}</text>`
      : ""
  }
  <text x="500" y="694" text-anchor="middle" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="24" font-weight="600" fill="#fff" opacity="0.76">${escapeXml(accordText)}</text>
  <text x="500" y="962" text-anchor="middle" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#fff" opacity="0.86">WaterScent</text>
  <text x="500" y="985" text-anchor="middle" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="14" fill="#fff" opacity="0.72">Generated fragrance artwork</text>
</svg>
`;
}

function createEmptyReport(options) {
  return {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    limit: options.limit,
    overwriteGenerated: options.overwriteGenerated,
    summary: {
      fragrancesScanned: 0,
      eligible: 0,
      generated: 0,
      skippedExistingImage: 0,
      skippedAmbiguous: 0,
      failed: 0,
    },
    results: [],
  };
}

function writeReport(report) {
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function createResult(fragrance, normalizedKey, output, status, error) {
  return {
    fragranceId: fragrance._id.toString(),
    brand: fragrance.brand || "",
    name: fragrance.name || "",
    year: fragrance.year || null,
    accords: Array.isArray(fragrance.accords) ? fragrance.accords.slice(0, 3) : [],
    normalizedKey,
    outputFilename: output.filename,
    outputPath: output.outputPath,
    status,
    error: error || null,
    timestamp: new Date().toISOString(),
  };
}

async function getCandidateFragrances(report) {
  const duplicateKeys = readDuplicateKeys();
  const fragrances = await Fragrance.find({}, fragranceFields)
    .sort({ ratingCount: -1 })
    .lean()
    .exec();
  const keyCounts = new Map();

  report.summary.fragrancesScanned = fragrances.length;

  fragrances.forEach((fragrance) => {
    const key = normalizeFragranceKey(fragrance);
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  });

  return fragrances.filter((fragrance) => {
    if (hasFragranceImage(fragrance)) {
      report.summary.skippedExistingImage += 1;
      return false;
    }

    const key = normalizeFragranceKey(fragrance);

    if (keyCounts.get(key) !== 1 || duplicateKeys.has(key)) {
      report.summary.skippedAmbiguous += 1;
      return false;
    }

    return true;
  });
}

async function generatePlaceholderImages() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const report = createEmptyReport(options);

  try {
    await dbConnection();

    const candidates = await getCandidateFragrances(report);
    let generatedCount = 0;

    fs.mkdirSync(outputDirectory, { recursive: true });
    report.summary.eligible = candidates.length;

    console.log(options.dryRun ? "DRY RUN" : "LOCAL GENERATION");
    console.log(`Eligible fragrances: ${candidates.length}`);

    for (const fragrance of candidates) {
      if (options.limit !== null && generatedCount >= options.limit) {
        break;
      }

      const normalizedKey = normalizeFragranceKey(fragrance);
      const output = getOutputPaths(normalizedKey);

      try {
        if (fs.existsSync(output.outputPath)) {
          if (!options.overwriteGenerated) {
            report.results.push(
              createResult(fragrance, normalizedKey, output, "SKIPPED_EXISTS")
            );
            continue;
          }

          if (!isGeneratedFile(output.outputPath)) {
            report.results.push(
              createResult(
                fragrance,
                normalizedKey,
                output,
                "SKIPPED_MANUAL_FILE"
              )
            );
            continue;
          }
        }

        if (options.dryRun) {
          report.results.push(
            createResult(fragrance, normalizedKey, output, "WOULD_GENERATE")
          );
          generatedCount += 1;
          continue;
        }

        fs.writeFileSync(output.outputPath, buildSvg(fragrance, normalizedKey));
        generatedCount += 1;
        report.summary.generated += 1;
        report.results.push(
          createResult(fragrance, normalizedKey, output, "GENERATED")
        );
      } catch (error) {
        report.summary.failed += 1;
        report.results.push(
          createResult(fragrance, normalizedKey, output, "FAILED", error.message)
        );
      }
    }

    writeReport(report);

    console.log("\nSummary\n");
    console.log(`Fragrances scanned: ${report.summary.fragrancesScanned}`);
    console.log(`Eligible: ${report.summary.eligible}`);
    console.log(`Generated: ${report.summary.generated}`);
    console.log(`Skipped existing image: ${report.summary.skippedExistingImage}`);
    console.log(`Skipped ambiguous: ${report.summary.skippedAmbiguous}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    report.summary.failed += 1;
    writeReport(report);
    console.error("Generated placeholder image workflow failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

generatePlaceholderImages();
