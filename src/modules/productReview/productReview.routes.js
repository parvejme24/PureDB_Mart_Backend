import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  getProductReviews,
  addProductReview,
  updateReview,
  deleteOwnReview,
  replyToReview,
  deleteReview,
  deleteReviewReply,
  getAllReviews,
  getUserReviews,
} from "./productReview.controller.js";

const router = express.Router();

// Public routes
router.get("/:productId", getProductReviews); // Get reviews for a product

// Protected routes (require login)
router.use(protect);

// User routes
router.post("/:productId", addProductReview); // Add review to product
router.put("/:reviewId", updateReview); // Update own review
router.put("/:reviewId/reply", replyToReview); // Add or update reply to review
router.delete("/:reviewId", deleteOwnReview); // Delete own review
router.delete("/:reviewId/reply", deleteReviewReply); // Delete own reply
router.get("/user/:userId", admin, getUserReviews); // Admin: Get specific user's reviews

// Admin only routes
router.get("/admin/all", admin, getAllReviews); // Get all reviews for admin
router.delete("/:reviewId", admin, deleteReview); // Delete review
router.delete("/:reviewId/reply", admin, deleteReviewReply); // Delete reply from review

export default router;