const express = require("express");
const mongoose = require("mongoose");

const authenticateToken = require("../middleware/authenticateToken");
const Fragrance = require("../models/fragrance");
const Review = require("../models/review");
const User = require("../models/userModel");

const router = express.Router();
const MAX_REVIEW_LENGTH = 1500;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validateReviewInput(body) {
  const rating = Number(body.rating);
  const comment = String(body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { message: "Please select a rating from 1 to 5." };
  }

  if (!comment) {
    return { message: "Please write a review before submitting." };
  }

  if (comment.length > MAX_REVIEW_LENGTH) {
    return {
      message: `Reviews must be ${MAX_REVIEW_LENGTH} characters or fewer.`,
    };
  }

  return { rating, comment };
}

function formatReview(review, currentUserId) {
  const reviewObject = review.toObject ? review.toObject() : review;
  const userId = String(reviewObject.userId);

  return {
    _id: reviewObject._id,
    fragranceId: reviewObject.fragranceId,
    userId,
    username: reviewObject.username,
    rating: reviewObject.rating,
    comment: reviewObject.comment,
    createdAt: reviewObject.createdAt,
    updatedAt: reviewObject.updatedAt,
    isOwner: Boolean(currentUserId && userId === String(currentUserId)),
  };
}

async function buildReviewResponse(fragranceId, currentUserId) {
  const reviews = await Review.find({ fragranceId })
    .sort({ createdAt: -1 })
    .lean();
  const reviewCount = reviews.length;
  const averageRating = reviewCount
    ? Math.round(
        (reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviewCount) *
          10
      ) / 10
    : null;
  const userReview = reviews.find(
    (review) => String(review.userId) === String(currentUserId)
  );

  return {
    reviewCount,
    averageRating,
    userReview: userReview ? formatReview(userReview, currentUserId) : null,
    reviews: reviews.map((review) => formatReview(review, currentUserId)),
  };
}

router.get("/fragrances/:fragranceId/reviews", async (req, res) => {
  try {
    const { fragranceId } = req.params;

    if (!isValidObjectId(fragranceId)) {
      return res.status(400).json({ message: "Invalid fragrance ID." });
    }

    const fragranceExists = await Fragrance.exists({ _id: fragranceId });
    if (!fragranceExists) {
      return res.status(404).json({ message: "Fragrance not found." });
    }

    res.status(200).json(await buildReviewResponse(fragranceId));
  } catch (error) {
    res.status(500).json({ message: "Unable to load reviews." });
  }
});

router.post(
  "/fragrances/:fragranceId/reviews",
  authenticateToken,
  async (req, res) => {
    try {
      const { fragranceId } = req.params;

      if (!isValidObjectId(fragranceId)) {
        return res.status(400).json({ message: "Invalid fragrance ID." });
      }

      const validation = validateReviewInput(req.body);
      if (validation.message) {
        return res.status(400).json({ message: validation.message });
      }

      const [fragranceExists, user] = await Promise.all([
        Fragrance.exists({ _id: fragranceId }),
        User.findById(req.userId).select("username"),
      ]);

      if (!fragranceExists) {
        return res.status(404).json({ message: "Fragrance not found." });
      }

      if (!user) {
        return res.status(401).json({ message: "Authenticated user not found." });
      }

      const review = await Review.create({
        fragranceId,
        userId: req.userId,
        username: user.username,
        rating: validation.rating,
        comment: validation.comment,
      });

      res.status(201).json({
        review: formatReview(review, req.userId),
        summary: await buildReviewResponse(fragranceId, req.userId),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "You have already reviewed this fragrance.",
        });
      }

      res.status(500).json({ message: "Unable to save review." });
    }
  }
);

router.put("/reviews/:reviewId", authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID." });
    }

    const validation = validateReviewInput(req.body);
    if (validation.message) {
      return res.status(400).json({ message: validation.message });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (String(review.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only edit your own review." });
    }

    review.rating = validation.rating;
    review.comment = validation.comment;
    await review.save();

    res.status(200).json({
      review: formatReview(review, req.userId),
      summary: await buildReviewResponse(review.fragranceId, req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to update review." });
  }
});

router.delete("/reviews/:reviewId", authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID." });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (String(review.userId) !== String(req.userId)) {
      return res
        .status(403)
        .json({ message: "You can only delete your own review." });
    }

    const fragranceId = review.fragranceId;
    await review.deleteOne();

    res.status(200).json({
      message: "Review deleted.",
      summary: await buildReviewResponse(fragranceId, req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete review." });
  }
});

module.exports = router;
