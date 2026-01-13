import express from "express";
import { protect } from "../../middleware/authMiddleware.js";
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from "./productWishlist.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user's wishlist
router.get("/", getUserWishlist);

// Add product to wishlist
router.post("/:productId", addToWishlist);

// Remove product from wishlist
router.delete("/:productId", removeFromWishlist);

// Clear entire wishlist
router.delete("/", clearWishlist);

export default router;