require("dotenv").config();

const path = require("path");
const cloudinary = require("../config/cloudinary.config");

async function uploadTestImage() {
  try {
    // Path to your image
    const imagePath = path.join(
      __dirname,
      "../test/aventus.jpg"
    );

    console.log("Uploading image from:");
    console.log(imagePath);

    const result = await cloudinary.uploader.upload(imagePath, {
      folder: "waterscent/fragrances",
      public_id: "creed-aventus-test",
      overwrite: true,
      resource_type: "image",
    });

    console.log("\n Upload successful!");
    console.log("Image URL:");
    console.log(result.secure_url);

    console.log("\nPublic ID:");
    console.log(result.public_id);

  } catch (error) {
    console.error("\n Upload failed");
    console.error(error);
  }
}

uploadTestImage();