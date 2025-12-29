import express from "express";
import upload from "../../middleware/upload.js";
import {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductsByCategorySlug,
  updateProduct,
  deleteProduct,
  getBestSellingProducts,
  getDealOfTheDay,
} from "./product.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const productRouter = express.Router();

// Public routes
productRouter.get("/", getAllProducts);
productRouter.get("/category/:slug", getProductsByCategorySlug);
productRouter.get("/:slug", getProductBySlug);

// Analytics routes (public for dashboard)
productRouter.get("/analytics/best-selling", getBestSellingProducts);
productRouter.get("/analytics/deal-of-the-day", getDealOfTheDay);

// Admin only routes
productRouter.post("/", protect, admin, upload.single("image"), createProduct);
productRouter.put("/:id", protect, admin, upload.single("image"), updateProduct);
productRouter.delete("/:id", protect, admin, deleteProduct);

export default productRouter;
