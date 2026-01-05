import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createProductReview,
  getProductReviews,
  getProductAverageRating,
  updateProductReview,
  deleteProductReview,
  approveReview,
  getUserReviews,
  addReviewReply,
  updateReviewReply,
  deleteReviewReply,
  getReviewReplies,
} from "./productReview.controller.js";

const productReviewRouter = express.Router();

// Debug route to check server status
productReviewRouter.get("/debug", (req, res) => {
  res.json({
    message: "Review API is working",
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET ? "Set" : "Not set",
      MONGODB_URI: process.env.MONGODB_URI ? "Set" : "Not set",
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "Set" : "Not set",
    }
  });
});

// Public routes
productReviewRouter.get("/product/:productId", getProductReviews);
productReviewRouter.get("/product/:productId/average-rating", getProductAverageRating);

// Protected routes (authenticated users)
productReviewRouter.post("/", protect, createProductReview);
productReviewRouter.get("/user", protect, getUserReviews);
productReviewRouter.put("/:id", protect, updateProductReview);
productReviewRouter.delete("/:id", protect, deleteProductReview);

// Review replies
productReviewRouter.post("/:reviewId/reply", protect, addReviewReply);
productReviewRouter.get("/:reviewId/reply", getReviewReplies);
productReviewRouter.put("/:reviewId/reply/:replyId", protect, updateReviewReply);
productReviewRouter.delete("/:reviewId/reply/:replyId", protect, deleteReviewReply);

// Admin routes
productReviewRouter.put("/:reviewId/approve", protect, admin, approveReview);

export default productReviewRouter;
