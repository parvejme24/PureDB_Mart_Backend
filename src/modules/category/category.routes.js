import express from "express";
import upload from "../../middleware/upload.js";
import {
  createCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
} from "./category.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const categoryRouter = express.Router();

// Public routes
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:slug", getSingleCategory);

// Admin only routes
categoryRouter.post("/", protect, admin, upload.single("image"), createCategory);
categoryRouter.put("/:id", protect, admin, upload.single("image"), updateCategory);
categoryRouter.delete("/:id", protect, admin, deleteCategory);

export default categoryRouter;
