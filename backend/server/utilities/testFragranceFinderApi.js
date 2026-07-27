require("dotenv").config();

const {
  getRapidApiConfig,
  getSearchUrl,
  searchFragranceImage,
} = require("./fragranceFinderApi");

async function testFragranceFinderApi() {
  const query = process.argv.slice(2).join(" ").trim();

  if (!query) {
    console.error('Usage: node utilities/testFragranceFinderApi.js "Dior Sauvage"');
    process.exit(1);
  }

  const config = getRapidApiConfig();
  const searchUrl = getSearchUrl(config, query);
  const [brand, ...nameParts] = query.split(/\s+/);
  const result = await searchFragranceImage({
    brand,
    name: nameParts.join(" ") || query,
  });

  console.log(`HTTP status: ${result.httpStatus || "not requested"}`);
  console.log(`Confirmed endpoint path: ${result.endpointPath || searchUrl.pathname}`);
  console.log(
    `Top-level response type: ${result.responseShape?.topLevelType || "unknown"}`
  );
  console.log(
    `Top-level keys: ${(result.responseShape?.topLevelKeys || []).join(", ") || "none"}`
  );
  console.log(`Fragrance results: ${result.resultCount || 0}`);
  console.log(
    `First result keys: ${(result.responseShape?.firstResultKeys || []).join(", ") || "none"}`
  );
  console.log(`Matched fragrance name: ${result.match?.perfume || "none"}`);
  console.log(`Matched brand: ${result.match?.brand || "none"}`);
  console.log(`Matched image URL: ${result.imageUrl || "none"}`);

  if (Array.isArray(result.candidates) && result.candidates.length) {
    console.log("\nReturned candidates:");
    result.candidates.forEach((candidate, index) => {
      console.log(`${index + 1}.`);
      console.log(`Index: ${candidate.index}`);
      console.log(`Perfume: ${candidate.perfume || "none"}`);
      console.log(`Brand: ${candidate.brand || "none"}`);
      console.log(`Image present: ${candidate.imagePresent ? "true" : "false"}`);
      console.log(`ID: ${candidate.id || "none"}`);
    });
  }

  if (Array.isArray(result.topCandidates) && result.topCandidates.length) {
    console.log("\nBest scored candidates:");
    result.topCandidates.forEach((candidate, index) => {
      console.log(`Candidate ${index + 1}:`);
      console.log(`Perfume: ${candidate.perfume || "none"}`);
      console.log(`Brand: ${candidate.brand || "none"}`);
      console.log(`Score: ${candidate.score}`);
      console.log(`Name match: ${candidate.nameMatch ? "true" : "false"}`);
      console.log(`Brand match: ${candidate.brandMatch ? "true" : "false"}`);
      console.log(`Has image: ${candidate.hasImage ? "true" : "false"}`);
    });
  }

  if (!result.ok) {
    console.log(`Status: ${result.status}`);
    console.log(`Message: ${result.message}`);
    process.exitCode = 1;
  }
}

testFragranceFinderApi();
