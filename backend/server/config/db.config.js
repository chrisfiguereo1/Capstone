const mongoose = require("mongoose");

const dbConnection = async () => {
  try {
    mongoose.set("strictQuery", false);

    if (!process.env.MONGO_URL) {
      console.error("MONGO_URL is missing from .env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URL);

    console.log("The backend has connected to the MongoDB database.");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

module.exports = dbConnection;