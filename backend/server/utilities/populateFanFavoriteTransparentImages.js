const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary.config");
const Fragrance = require("../models/fragrance");
const { fanFavoriteIds } = require("./populateFanFavoriteImages");
const { getFragranceImageUrl } = require("./imagePresence");

const cloudinaryFolder = "waterscent/fragrances/transparent";

async function populateFanFavoriteTransparentImages() {
  validateEnvironment();

  await mongoose.connect(process.env.MONGO_URL);

  const summary = {
    cached: 0,
    saved: 0,
    failed: 0,
    missingImage: 0,
    missingRecord: 0,
  };

  try {
    for (const id of fanFavoriteIds) {
      const fragrance = await Fragrance.findById(
        id,
        "_id brand name image imageUrl secureUrl transparentImage transparentImageUrl transparentImagePublicId"
      );

      if (!fragrance) {
        summary.missingRecord += 1;
        console.log(`missing-record | ${id}`);
        continue;
      }

      const cachedTransparentImage =
        getStringValue(fragrance.transparentImageUrl) ||
        getStringValue(fragrance.transparentImage);

      if (cachedTransparentImage) {
        summary.cached += 1;
        console.log(
          `cached | ${fragrance.brand} ${fragrance.name} | ${cachedTransparentImage}`
        );
        continue;
      }

      const sourceImageUrl = getFragranceImageUrl(fragrance);

      if (!sourceImageUrl) {
        summary.missingImage += 1;
        console.log(`missing-image | ${fragrance.brand} ${fragrance.name}`);
        continue;
      }

      try {
        const uploadResult = await uploadTransparentImage(
          sourceImageUrl,
          fragrance
        );

        fragrance.transparentImage = uploadResult.secure_url;
        fragrance.transparentImageUrl = uploadResult.secure_url;
        fragrance.transparentImagePublicId = uploadResult.public_id;
        fragrance.transparentImageSource = "cloudinary-make-transparent";
        fragrance.transparentImageStatus = "review";
        await fragrance.save();

        summary.saved += 1;
        console.log(
          `saved | ${fragrance.brand} ${fragrance.name} | ${uploadResult.secure_url}`
        );
      } catch (error) {
        summary.failed += 1;
        console.log(
          `failed | ${fragrance.brand} ${fragrance.name} | ${error.message}`
        );
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(
    `summary | cached=${summary.cached} saved=${summary.saved} failed=${summary.failed} missingImage=${summary.missingImage} missingRecord=${summary.missingRecord}`
  );

  return summary;
}

function validateEnvironment() {
  const missing = [
    "MONGO_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment values: ${missing.join(", ")}`);
  }
}

function getStringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function uploadTransparentImage(imageUrl, fragrance) {
  return cloudinary.uploader.upload(imageUrl, {
    folder: cloudinaryFolder,
    public_id: buildPublicId(fragrance),
    overwrite: false,
    resource_type: "image",
    format: "png",
    transformation: [
      {
        effect: "make_transparent:12",
        color: "white",
      },
      {
        width: 800,
        height: 800,
        crop: "limit",
        quality: "auto",
      },
    ],
  });
}

function buildPublicId(fragrance) {
  const key = `${fragrance.brand || "unknown"}-${fragrance.name || fragrance._id}`;
  return key
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

if (require.main === module) {
  populateFanFavoriteTransparentImages().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  populateFanFavoriteTransparentImages,
};
