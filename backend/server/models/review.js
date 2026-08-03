const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
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
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ fragranceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
