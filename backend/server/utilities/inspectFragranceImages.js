const fs = require("fs");
const path = require("path");

const imageFolder = path.join(__dirname, "../fragrance-images");
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function normalizeImageKey(filename) {
  const nameWithoutExtension = path.parse(filename).name;

  return nameWithoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function getSupportedImageFiles() {
  return fs
    .readdirSync(imageFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => {
      const extension = path.extname(filename).toLowerCase();
      return (
        !filename.startsWith(".") &&
        filename !== ".gitkeep" &&
        supportedExtensions.has(extension)
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

function inspectFragranceImages() {
  const imageFiles = getSupportedImageFiles();

  console.log(`Supported fragrance image files found: ${imageFiles.length}`);

  if (imageFiles.length === 0) {
    console.log("No supported fragrance images found in fragrance-images.");
    return;
  }

  imageFiles.forEach((filename) => {
    console.log(`${filename} -> ${normalizeImageKey(filename)}`);
  });
}

if (require.main === module) {
  inspectFragranceImages();
}

module.exports = {
  getSupportedImageFiles,
  imageFolder,
  normalizeImageKey,
};
