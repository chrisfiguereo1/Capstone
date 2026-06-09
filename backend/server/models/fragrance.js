const mongoose = require("mongoose");

const fragranceSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },

    brand: {
      type: String,
      default: "",
    },

    country: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "",
    },

    year: {
      type: Number,
      default: null,
    },

    ratingValue: {
      type: Number,
      default: 0,
    },

    ratingCount: {
      type: Number,
      default: 0,
    },

    notes: {
      top: {
        type: [String],
        default: [],
      },

      middle: {
        type: [String],
        default: [],
      },

      base: {
        type: [String],
        default: [],
      },
    },

    perfumers: {
      type: [String],
      default: [],
    },

    accords: {
      type: [String],
      default: [],
    },

    source: {
      type: String,
      default: "fra_cleaned",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Fragrance", fragranceSchema);