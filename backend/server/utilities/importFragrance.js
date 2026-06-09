require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");

const Fragrance = require("../models/fragrance");

async function importFragrances() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);

    console.log("Connected to MongoDB");

    const fragrances = [];

    fs.createReadStream(__dirname + "/../data/fra_cleaned.csv")
      .pipe(csv())

      .on("data", (row) => {
        fragrances.push({
          url: row.url || "",

          name: row.Perfume || "",

          brand: row.Brand || "",

          country: row.Country || "",

          gender: row.Gender || "",

          year: row.Year ? Number(row.Year) : null,

          ratingValue: row["Rating Value"]
            ? Number(row["Rating Value"])
            : 0,

          ratingCount: row["Rating Count"]
            ? Number(row["Rating Count"])
            : 0,

          notes: {
            top: row.Top
              ? row.Top.split(",").map((note) => note.trim())
              : [],

            middle: row.Middle
              ? row.Middle.split(",").map((note) => note.trim())
              : [],

            base: row.Base
              ? row.Base.split(",").map((note) => note.trim())
              : [],
          },

          perfumers: [
            row.Perfumer1,
            row.Perfumer2,
          ].filter(Boolean),

          accords: [
            row.mainaccord1,
            row.mainaccord2,
            row.mainaccord3,
            row.mainaccord4,
            row.mainaccord5,
          ].filter(Boolean),

          source: "fra_cleaned",
        });
      })

      .on("end", async () => {
        try {
          console.log(
            `Found ${fragrances.length} fragrances to import`
          );

          // Remove old fragrance data
          await Fragrance.deleteMany({});

          // Insert all fragrances
          await Fragrance.insertMany(fragrances);

          console.log(
            `Successfully imported ${fragrances.length} fragrances`
          );
        } catch (error) {
          console.error("Import Error:", error);
        } finally {
          await mongoose.connection.close();
          console.log("MongoDB connection closed");
        }
      })

      .on("error", (error) => {
        console.error("CSV Read Error:", error);
      });

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

importFragrances();