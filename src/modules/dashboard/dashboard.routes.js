import express from "express";
import {
  getDashboardStats,
  getRevenueOverview,
  getProductPerformance,
  getCategoryPerformance,
  incrementProductView,
} from "./dashboard.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const dashboardRouter = express.Router();

// Admin only routes
dashboardRouter.get("/stats", protect, admin, getDashboardStats);
dashboardRouter.get("/revenue-overview", protect, admin, getRevenueOverview);
dashboardRouter.get("/product-performance", protect, admin, getProductPerformance);
dashboardRouter.get("/category-performance", protect, admin, getCategoryPerformance);

// Public route - increment product view (called when user views a product)
dashboardRouter.post("/product-view/:productId", incrementProductView);

export default dashboardRouter;

