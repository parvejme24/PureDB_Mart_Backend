import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getPublicCoupons,
} from "./coupon.controller.js";

const router = express.Router();

// Public routes
router.get("/public", getPublicCoupons); // Get public coupons for users

// Protected routes (require authentication)
router.use(protect);

// User routes
router.post("/validate", validateCoupon); // Validate and calculate coupon discount

// Admin only routes
router.get("/admin/all", admin, getAllCoupons); // Get all coupons (admin)
router.post("/", admin, createCoupon); // Create new coupon
router.get("/:couponId", admin, getCouponById); // Get single coupon
router.put("/:couponId", admin, updateCoupon); // Update coupon
router.delete("/:couponId", admin, deleteCoupon); // Delete coupon

export default router;