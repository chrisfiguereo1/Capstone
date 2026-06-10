require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const Fragrance = require("../models/fragrance");

mongoose.set("strictQuery", false);

const csvPath = path.join(__dirname, "../data/fra_cleaned.csv");

function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(",", "."));
}

async function importFragrances() {
  try {
    console.log("CSV path:", csvPath);

    if (!fs.existsSync(csvPath)) {
      console.log("CSV file not found");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    const fragrances = [];

    fs.createReadStream(csvPath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row) => {
        fragrances.push({
          url: row.url || "",
          name: row.Perfume || "",
          brand: row.Brand || "",
          country: row.Country || "",
          gender: row.Gender || "",
          year: row.Year ? Number(row.Year) : null,

          ratingValue: toNumber(row["Rating Value"]),
          ratingCount: toNumber(row["Rating Count"]),

          notes: {
            top: splitList(row.Top),
            middle: splitList(row.Middle),
            base: splitList(row.Base),
          },

          perfumers: [row.Perfumer1, row.Perfumer2].filter(Boolean),

          accords: [
            row.mainaccord1,
            row.mainaccord2,
            row.mainaccord3,
            row.mainaccord4,
            row.mainaccord5,
          ].filter(Boolean),

          source: "fra_cleaned",
        });

        if (fragrances.length % 1000 === 0) {
          console.log(`Read ${fragrances.length} rows...`);
        }
      })
      .on("end", async () => {
        try {
          console.log(`Finished reading CSV. Total: ${fragrances.length}`);

          await Fragrance.deleteMany({});
          console.log("Deleted old fragrance documents");

          await Fragrance.insertMany(fragrances, { ordered: false });
          console.log(`Imported ${fragrances.length} fragrances`);
        } catch (error) {
          console.error("Import Error:", error);
        } finally {
          await mongoose.connection.close();
          console.log("MongoDB connection closed");
          process.exit(0);
        }
      })
      .on("error", async (error) => {
        console.error("CSV Read Error:", error);
        await mongoose.connection.close();
        process.exit(1);
      });
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

importFragrances();