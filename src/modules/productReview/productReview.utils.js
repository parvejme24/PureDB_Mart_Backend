import mongoose from "mongoose";
import ProductReview from "./productReview.model.js";
import Product from "../product/product.model.js";
import Order from "../order/order.model.js";

// Utility function to safely convert ObjectId
export const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (error) {
    console.error("Invalid ObjectId:", id);
    return null;
  }
};

// Re-export mongoose for convenience
export { mongoose };

// Validates rating value
export const validateRating = (rating) => {
  const numRating = Number(rating);
  return Number.isFinite(numRating) && numRating >= 1 && numRating <= 5;
};

// Generates a unique review ID
export const generateReviewId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `REV-${Date.now()}-${random}`;
};

// Generates a unique reply ID
export const generateReplyId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `REP-${Date.now()}-${random}`;
};

// Checks if a user has purchased a specific product
export const hasUserPurchasedProduct = async (userEmail, productId) => {
  try {
    const userHasPurchased = await Order.findOne({
      "customer.email": userEmail,
      "items.product": productId,
      status: { $in: ["delivered", "shipped"] }
    });
    return !!userHasPurchased;
  } catch (error) {
    return false;
  }
};

// Checks if product exists
export const doesProductExist = async (productId) => {
  try {
    const product = await Product.findById(productId);
    return !!product;
  } catch (error) {
    return false;
  }
};

// Checks if user has already reviewed a product
export const hasUserReviewedProduct = async (productId, userId) => {
  try {
    const existingReview = await ProductReview.findOne({
      product: productId,
      user: userId
    });
    return !!existingReview;
  } catch (error) {
    return false;
  }
};

// Updates product's average rating
export const updateProductAverageRating = async (productId) => {
  try {
    const ratingStats = await ProductReview.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingStats.length > 0 ? ratingStats[0].averageRating : 0;
    return averageRating;
  } catch (error) {
    return 0;
  }
};

// Checks if user owns a review
export const isReviewOwner = async (reviewId, userId) => {
  try {
    const review = await ProductReview.findById(reviewId);
    return review && review.user.toString() === userId.toString();
  } catch (error) {
    return false;
  }
};

// Checks if user owns a reply
export const isReplyOwner = async (reviewId, replyId, userId) => {
  try {
    const review = await ProductReview.findById(reviewId);
    if (!review) return false;

    const reply = review.replies.id(replyId);
    return reply && reply.user.toString() === userId.toString();
  } catch (error) {
    return false;
  }
};

// Parses and validates pagination parameters
export const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));

  return { page, limit };
};

// Parses and validates sorting parameters for reviews
export const parseReviewSortParams = (sort = "newest") => {
  const sortOptions = {
    "newest": { createdAt: -1 },
    "oldest": { createdAt: 1 },
    "rating-high": { rating: -1 },
    "rating-low": { rating: 1 },
    "helpful": { helpful: -1 }
  };

  return sortOptions[sort] || sortOptions.newest;
};

// Builds filter object for reviews
export const buildReviewFilter = (query, productId = null) => {
  const filter = {};

  if (productId) {
    filter.product = productId;
  }

  filter.isApproved = true;

  if (query.verified === 'true') {
    filter.isVerified = true;
  }

  if (query.rating && [1, 2, 3, 4, 5].includes(parseInt(query.rating))) {
    filter.rating = parseInt(query.rating);
  }

  return filter;
};
