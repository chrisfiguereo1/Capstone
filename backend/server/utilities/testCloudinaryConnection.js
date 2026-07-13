
require("dotenv").config();

const cloudinary = require("../config/cloudinary.config");

async function testCloudinaryConnection() {
  try {
    const result = await cloudinary.api.ping();

    console.log("Cloudinary connected successfully");
    console.log(result);
  } catch (error) {
    console.error("Cloudinary connection failed");
    console.error(error.message);
  }
}

testCloudinaryConnection();
