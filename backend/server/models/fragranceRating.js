const mongoose = require("mongoose");

const fragranceRatingSchema = new mongoose.Schema(
  {
    fragranceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fragrance",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    projection: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    longevity: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
  },
  { timestamps: true }
);

fragranceRatingSchema.index({ fragranceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("FragranceRating", fragranceRatingSchema);
