const mongoose = require("mongoose");

const fragranceSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    country: { type: String, default: "" },
    gender: { type: String, default: "" },
    year: { type: Number, default: null },

    ratingValue: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    perfumers: { type: [String], default: [] },
    accords: { type: [String], default: [] },

    notes: { type: [String], default: [] },
    topNotes: { type: [String], default: [] },
    middleNotes: { type: [String], default: [] },
    baseNotes: { type: [String], default: [] },

    longevity: { type: String, default: "" },
    projection: { type: String, default: "" },
    season: { type: String, default: "" },

    source: { type: String, default: "manual" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Fragrance", fragranceSchema);