require("dotenv").config();

const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const dbConnection = require("../config/db.config");
const Fragrance = require("../models/fragrance");
const { normalizeImageKey } = require("./inspectFragranceImages");

const reportDirectory = path.join(__dirname, "../reports");
const duplicateReportPath = path.join(
  reportDirectory,
  "duplicate-fragrance-keys.json"
);
const candidateJsonPath = path.join(
  reportDirectory,
  "fragrance-image-candidates.json"
);
const candidateHtmlPath = path.join(
  reportDirectory,
  "fragrance-image-candidates.html"
);
const fragranceFields = "_id brand name year gender ratingCount image imageUrl";
const maxFragrances = 25;
const requestDelayMs = 1200;
const requestTimeoutMs = 12000;
const maxRetries = 2;
const userAgent = "WaterScent open-license image discovery/1.0";
const preferredLicenses = new Set(["cc0", "pdm", "by", "by-sa"]);
const disallowedMetadataTerms = [
  "advertisement",
  "campaign",
  "event",
  "logo",
  "poster",
  "sample",
  "vial",
  "decant",
  "giftset",
  "giftcollection",
  "storefront",
];
const possibleFlankerTerms = [
  "flora",
  "futura",
  "sport",
  "extreme",
  "intense",
  "limited",
  "edition",
  "absolu",
  "elixir",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFragranceKey(fragrance) {
  return normalizeImageKey(`${fragrance.brand || ""}${fragrance.name || ""}`);
}

function displayName(value) {
  return String(value || "").replace(/-/g, " ");
}

function hasImage(fragrance) {
  return Boolean(fragrance.image || fragrance.imageUrl);
}

function readDuplicateKeys() {
  if (!fs.existsSync(duplicateReportPath)) {
    return new Set();
  }

  const report = JSON.parse(fs.readFileSync(duplicateReportPath, "utf8"));
  return new Set(report.map((group) => group.normalizedKey));
}

function readPreviousManifest() {
  if (!fs.existsSync(candidateJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(candidateJsonPath, "utf8"));
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function getSearchQueries(fragrance) {
  const brand = displayName(fragrance.brand);
  const name = displayName(fragrance.name);

  return [
    `"${brand} ${name} perfume bottle"`,
    `"${brand} ${name} fragrance"`,
    `"${brand} ${name}"`,
  ];
}

async function fetchJson(url, options) {
  await delay(requestDelayMs);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": userAgent,
          accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 403 || response.status === 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        await delay(requestDelayMs * (attempt + 2));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Request failed after ${maxRetries + 1} attempts: ${options}`);
}

function licenseAllowsPotentialCommercialUse(license) {
  const normalizedLicense = String(license || "").toLowerCase();

  if (!normalizedLicense) {
    return false;
  }

  if (normalizedLicense.includes("nc") || normalizedLicense.includes("non")) {
    return false;
  }

  if (normalizedLicense.includes("fair") || normalizedLicense.includes("non-free")) {
    return false;
  }

  return preferredLicenses.has(normalizedLicense) ||
    normalizedLicense.includes("public domain") ||
    normalizedLicense.includes("cc0") ||
    normalizedLicense.includes("cc-by") ||
    normalizedLicense.includes("cc by");
}

function scoreCandidate(fragrance, candidate) {
  let score = 0;
  const brandKey = normalizeImageKey(fragrance.brand || "");
  const nameKey = normalizeImageKey(fragrance.name || "");
  const titleKey = normalizeImageKey(candidate.title || "");
  const descriptionKey = normalizeImageKey(candidate.description || "");
  const metadataKey = normalizeImageKey(
    `${candidate.title || ""} ${candidate.description || ""} ${
      candidate.sourcePageUrl || ""
    } ${candidate.attributionText || ""}`
  );

  if (titleKey.includes(brandKey) && titleKey.includes(nameKey)) {
    score += 40;
  }

  if (metadataKey.includes(brandKey) && metadataKey.includes(nameKey)) {
    score += 20;
  }

  if (metadataKey.includes("bottle") || metadataKey.includes("flacon")) {
    score += 20;
  }

  if (candidate.sourcePageUrl && metadataKey.includes(nameKey)) {
    score += 10;
  }

  if ((candidate.width || 0) >= 600 && (candidate.height || 0) >= 600) {
    score += 5;
  }

  if (
    metadataKey.includes("transparent") ||
    metadataKey.includes("whitebackground")
  ) {
    score += 5;
  }

  if (
    metadataKey.includes("giftset") ||
    metadataKey.includes("giftcollection")
  ) {
    score -= 30;
  }

  if (
    metadataKey.includes("sample") ||
    metadataKey.includes("vial") ||
    metadataKey.includes("decant")
  ) {
    score -= 30;
  }

  if (metadataKey.includes(brandKey) && !metadataKey.includes(nameKey)) {
    score -= 30;
  }

  if ((candidate.width && candidate.width < 300) || (candidate.height && candidate.height < 300)) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function classifyCandidate(fragrance, candidate) {
  const licenseOk = licenseAllowsPotentialCommercialUse(candidate.license);
  const metadataKey = normalizeImageKey(
    `${candidate.title || ""} ${candidate.description || ""} ${
      candidate.sourcePageUrl || ""
    }`
  );
  const brandKey = normalizeImageKey(fragrance.brand || "");
  const nameKey = normalizeImageKey(fragrance.name || "");
  const originalNameKey = normalizeImageKey(displayName(fragrance.name));
  const hasDisallowedTerm = disallowedMetadataTerms.some((term) =>
    metadataKey.includes(term)
  );
  const hasFlankerMismatch = possibleFlankerTerms.some((term) => {
    const termKey = normalizeImageKey(term);
    return metadataKey.includes(termKey) && !originalNameKey.includes(termKey);
  });

  if (!licenseOk) {
    return "REJECTED";
  }

  if (hasDisallowedTerm || hasFlankerMismatch) {
    return "REJECTED";
  }

  if (!metadataKey.includes(brandKey) || !metadataKey.includes(nameKey)) {
    return "REJECTED";
  }

  if (candidate.confidenceScore >= 70) {
    return "STRONG CANDIDATE";
  }

  return "NEEDS MANUAL REVIEW";
}

function buildBaseResult(fragrance, normalizedKey, method) {
  return {
    discoveryMethod: method,
    fragranceId: fragrance._id.toString(),
    brand: fragrance.brand || "",
    name: fragrance.name || "",
    year: fragrance.year,
    gender: fragrance.gender || "",
    ratingCount: fragrance.ratingCount || 0,
    normalizedKey,
    candidateImageUrl: "",
    thumbnailUrl: "",
    sourcePageUrl: "",
    sourceDomain: "",
    imageTitle: "",
    creator: "",
    creatorUrl: "",
    license: "",
    licenseVersion: "",
    licenseUrl: "",
    attributionText: "",
    width: null,
    height: null,
    contentType: "",
    imageFileType: "",
    confidenceScore: 0,
    classification: "NO OPENLY LICENSED RESULT",
    reviewStatus: "pending",
    notes: "",
  };
}

function completeCandidateResult(fragrance, normalizedKey, candidate) {
  const result = {
    ...buildBaseResult(fragrance, normalizedKey, candidate.discoveryMethod),
    candidateImageUrl: candidate.candidateImageUrl || "",
    thumbnailUrl: candidate.thumbnailUrl || "",
    sourcePageUrl: candidate.sourcePageUrl || "",
    sourceDomain: getDomain(candidate.sourcePageUrl),
    imageTitle: candidate.title || "",
    creator: candidate.creator || "",
    creatorUrl: candidate.creatorUrl || "",
    license: candidate.license || "",
    licenseVersion: candidate.licenseVersion || "",
    licenseUrl: candidate.licenseUrl || "",
    attributionText: candidate.attributionText || "",
    width: candidate.width || null,
    height: candidate.height || null,
    contentType: candidate.contentType || "",
    imageFileType: candidate.imageFileType || "",
    notes: candidate.notes || "",
  };

  result.confidenceScore = scoreCandidate(fragrance, result);
  result.classification = classifyCandidate(fragrance, result);

  return result;
}

function buildOpenverseResult(fragrance, normalizedKey, item) {
  return completeCandidateResult(fragrance, normalizedKey, {
    discoveryMethod: "openverse",
    candidateImageUrl: item.url,
    thumbnailUrl: item.thumbnail || "",
    sourcePageUrl: item.foreign_landing_url || item.url,
    title: item.title || "",
    creator: item.creator || "",
    creatorUrl: item.creator_url || "",
    license: item.license || "",
    licenseVersion: item.license_version || "",
    licenseUrl: item.license_url || "",
    attributionText: item.attribution || "",
    width: item.width || null,
    height: item.height || null,
    contentType: item.frontend_media_type || "",
    imageFileType: item.extension || "",
    description: `${item.title || ""} ${item.creator || ""}`,
    notes:
      "Openverse candidate. License metadata requires manual verification at the original source.",
  });
}

function getMetadataValue(metadata, key) {
  return stripHtml(metadata && metadata[key] ? metadata[key].value : "");
}

function buildWikimediaResult(fragrance, normalizedKey, page) {
  const imageInfo = page.imageinfo && page.imageinfo[0] ? page.imageinfo[0] : {};
  const metadata = imageInfo.extmetadata || {};
  const license = getMetadataValue(metadata, "LicenseShortName");
  const licenseUrl = getMetadataValue(metadata, "LicenseUrl");
  const usageTerms = getMetadataValue(metadata, "UsageTerms");
  const description = getMetadataValue(metadata, "ImageDescription");
  const creator = getMetadataValue(metadata, "Artist") || getMetadataValue(metadata, "Author");
  const credit = getMetadataValue(metadata, "Credit");

  return completeCandidateResult(fragrance, normalizedKey, {
    discoveryMethod: "wikimedia",
    candidateImageUrl: imageInfo.url || "",
    thumbnailUrl: imageInfo.thumburl || "",
    sourcePageUrl: imageInfo.descriptionurl || "",
    title: page.title || "",
    creator,
    creatorUrl: "",
    license: license || usageTerms,
    licenseVersion: "",
    licenseUrl,
    attributionText: credit || creator,
    width: imageInfo.width || null,
    height: imageInfo.height || null,
    contentType: imageInfo.mime || "",
    imageFileType: imageInfo.mime ? imageInfo.mime.replace("image/", "") : "",
    description,
    notes:
      "Wikimedia Commons candidate. License metadata requires manual verification on the file page.",
  });
}

async function searchOpenverse(fragrance, normalizedKey, query) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "5");
  url.searchParams.set("license_type", "commercial");

  const data = await fetchJson(url.href, "Openverse");
  const items = Array.isArray(data.results) ? data.results : [];

  return items.map((item) => buildOpenverseResult(fragrance, normalizedKey, item));
}

async function searchWikimedia(fragrance, normalizedKey, query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "400");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const data = await fetchJson(url.href, "Wikimedia Commons");
  const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];

  return pages
    .filter((page) => page.imageinfo && page.imageinfo[0])
    .map((page) => buildWikimediaResult(fragrance, normalizedKey, page));
}

function chooseBestResult(results) {
  const strong = results.find(
    (result) => result.classification === "STRONG CANDIDATE"
  );

  if (strong) {
    return strong;
  }

  const manual = results
    .filter((result) => result.classification === "NEEDS MANUAL REVIEW")
    .sort((a, b) => b.confidenceScore - a.confidenceScore)[0];

  if (manual) {
    return manual;
  }

  const rejected = results
    .filter((result) => result.classification === "REJECTED")
    .sort((a, b) => b.confidenceScore - a.confidenceScore)[0];

  return rejected || null;
}

async function discoverCandidate(fragrance) {
  const normalizedKey = normalizeFragranceKey(fragrance);
  const allResults = [];

  for (const query of getSearchQueries(fragrance)) {
    let openverseResults = [];
    let wikimediaResults = [];

    try {
      openverseResults = await searchOpenverse(fragrance, normalizedKey, query);
    } catch (error) {
      allResults.push({
        ...buildBaseResult(fragrance, normalizedKey, "openverse"),
        classification: "REJECTED",
        notes: `Openverse query failed: ${error.message}`,
      });
    }

    allResults.push(...openverseResults);

    const strongOpenverse = openverseResults.find(
      (result) => result.classification === "STRONG CANDIDATE"
    );

    if (strongOpenverse) {
      return strongOpenverse;
    }

    try {
      wikimediaResults = await searchWikimedia(fragrance, normalizedKey, query);
    } catch (error) {
      allResults.push({
        ...buildBaseResult(fragrance, normalizedKey, "wikimedia"),
        classification: "REJECTED",
        notes: `Wikimedia query failed: ${error.message}`,
      });
    }

    allResults.push(...wikimediaResults);

    const strongWikimedia = wikimediaResults.find(
      (result) => result.classification === "STRONG CANDIDATE"
    );

    if (strongWikimedia) {
      return strongWikimedia;
    }
  }

  const bestResult = chooseBestResult(allResults);

  if (bestResult) {
    return bestResult;
  }

  return {
    ...buildBaseResult(fragrance, normalizedKey, "open-license-indexes"),
    notes: "No openly licensed result found in Openverse or Wikimedia Commons.",
  };
}

async function getSelectedFragrances() {
  const duplicateKeys = readDuplicateKeys();
  const fragrances = await Fragrance.find({}, fragranceFields)
    .sort({ ratingCount: -1 })
    .lean()
    .exec();
  const keyCounts = new Map();

  fragrances.forEach((fragrance) => {
    const key = normalizeFragranceKey(fragrance);
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  });

  return fragrances
    .filter((fragrance) => !hasImage(fragrance))
    .filter((fragrance) => {
      const key = normalizeFragranceKey(fragrance);
      return keyCounts.get(key) === 1 && !duplicateKeys.has(key);
    })
    .slice(0, maxFragrances);
}

function buildManifest(results, fragrancesChecked, previousManifest) {
  return {
    generatedAt: new Date().toISOString(),
    discoveryMode: "open-license-indexes",
    sourcesSearched: ["openverse", "wikimedia"],
    fragrancesChecked,
    summary: {
      strongCandidates: results.filter(
        (result) => result.classification === "STRONG CANDIDATE"
      ).length,
      manualReviewCandidates: results.filter(
        (result) => result.classification === "NEEDS MANUAL REVIEW"
      ).length,
      rejectedCandidates: results.filter(
        (result) => result.classification === "REJECTED"
      ).length,
      noOpenlyLicensedResult: results.filter(
        (result) => result.classification === "NO OPENLY LICENSED RESULT"
      ).length,
    },
    previousDiscoverySummary: previousManifest
      ? {
          generatedAt: previousManifest.generatedAt || null,
          discoveryMode: previousManifest.discoveryMode || "official-site",
          fragrancesChecked: previousManifest.fragrancesChecked || 0,
          summary: previousManifest.summary || {},
        }
      : null,
    results,
  };
}

function writeJsonManifest(manifest) {
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(candidateJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeHtmlReport(manifest) {
  const rows = manifest.results
    .map((result) => {
      const image = result.candidateImageUrl
        ? `<img src="${escapeHtml(result.thumbnailUrl || result.candidateImageUrl)}" alt="">`
        : "<span>No candidate</span>";
      const source = result.sourcePageUrl
        ? `<a href="${escapeHtml(result.sourcePageUrl)}">${escapeHtml(
            result.sourceDomain || result.discoveryMethod
          )}</a>`
        : "none";

      return `<tr>
  <td>${image}</td>
  <td>${escapeHtml(result.brand)}</td>
  <td>${escapeHtml(result.name)}</td>
  <td>${escapeHtml(result.discoveryMethod)}</td>
  <td>${escapeHtml(result.confidenceScore)}</td>
  <td>${escapeHtml(result.classification)}</td>
  <td>${escapeHtml(result.creator)}</td>
  <td>${escapeHtml(result.license || "none")}</td>
  <td>${escapeHtml(result.attributionText || "none")}</td>
  <td>${source}</td>
  <td>${escapeHtml(result.reviewStatus)}</td>
  <td>${escapeHtml(result.notes)}</td>
</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WaterScent Open-License Candidate Review</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { background: #f4f4f4; text-align: left; }
    img { max-width: 120px; max-height: 160px; object-fit: contain; }
  </style>
</head>
<body>
  <h1>WaterScent Open-License Candidate Review</h1>
  <p>Generated at ${escapeHtml(manifest.generatedAt)}. All candidates remain pending manual review.</p>
  <table>
    <thead>
      <tr>
        <th>Preview</th>
        <th>Brand</th>
        <th>Fragrance</th>
        <th>Discovery Source</th>
        <th>Confidence</th>
        <th>Classification</th>
        <th>Creator</th>
        <th>License</th>
        <th>Required Attribution</th>
        <th>Original Source</th>
        <th>Review Status</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;

  fs.writeFileSync(candidateHtmlPath, html);
}

async function discoverFragranceImageCandidates() {
  const previousManifest = readPreviousManifest();

  try {
    await dbConnection();

    const selectedFragrances = await getSelectedFragrances();
    const results = [];

    for (const fragrance of selectedFragrances) {
      console.log(`${fragrance.brand} ${fragrance.name}`);
      const result = await discoverCandidate(fragrance);
      results.push(result);
      console.log(`${result.classification}: ${result.discoveryMethod}`);
    }

    const manifest = buildManifest(
      results,
      selectedFragrances.length,
      previousManifest
    );
    writeJsonManifest(manifest);
    writeHtmlReport(manifest);

    console.log("\nSummary\n");
    console.log(`Fragrances checked: ${manifest.fragrancesChecked}`);
    console.log(`Strong candidates: ${manifest.summary.strongCandidates}`);
    console.log(
      `Manual-review candidates: ${manifest.summary.manualReviewCandidates}`
    );
    console.log(`Rejected candidates: ${manifest.summary.rejectedCandidates}`);
    console.log(
      `No openly licensed result: ${manifest.summary.noOpenlyLicensedResult}`
    );
    console.log(`JSON report: ${candidateJsonPath}`);
    console.log(`HTML report: ${candidateHtmlPath}`);
  } catch (error) {
    console.error("Open-license image candidate discovery failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

discoverFragranceImageCandidates();
