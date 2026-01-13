import express from "express";
import upload from "../../middleware/upload.js";
import {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getBestSellingProducts,
  getDealOfTheDay,
  updateProduct,
  deleteProduct,
} from "./product.controller.js";

const router = express.Router();

// Create new product
router.post("/", upload.single("image"), createProduct);

// Get all products with filtering, pagination, and search
router.get("/", getAllProducts);

// Get product by slug
router.get("/:slug", getProductBySlug);

// Get best selling products
router.get("/best-selling", getBestSellingProducts);

// Get deal of the day (top 10 best selling products)
router.get("/deal-of-the-day", getDealOfTheDay);

// Update product by id
router.put("/:id", upload.single("image"), updateProduct);

// Delete product by id
router.delete("/:id", deleteProduct);

export default router;