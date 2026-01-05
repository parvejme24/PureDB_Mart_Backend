import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  addToWishlist,
  removeFromWishlist,
  getUserWishlist,
  checkWishlistStatus,
  clearWishlist,
  getWishlistStats,
  bulkAddToWishlist,
} from "./productWishlist.controller.js";

const productWishlistRouter = express.Router();

// Protected routes (authenticated users)
productWishlistRouter.post("/", protect, addToWishlist);
productWishlistRouter.get("/", protect, getUserWishlist);
productWishlistRouter.delete("/:productId", protect, removeFromWishlist);
productWishlistRouter.get("/check/:productId", protect, checkWishlistStatus);
productWishlistRouter.delete("/", protect, clearWishlist);

// Bulk operations (optional, for admin or advanced users)
productWishlistRouter.post("/bulk", protect, bulkAddToWishlist);

// Admin routes
productWishlistRouter.get("/admin/stats", protect, admin, getWishlistStats);

export default productWishlistRouter;
