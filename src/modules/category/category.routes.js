import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
} from "./category.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const storage = multer.diskStorage({});
const upload = multer({ storage });

const categoryRouter = express.Router();

// Public
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:slug", getSingleCategory);

// Admin only
categoryRouter.post("/", protect, admin, upload.single("image"), createCategory);
categoryRouter.put("/:slug", protect, admin, upload.single("image"), updateCategory);
categoryRouter.delete("/:slug", protect, admin, deleteCategory);

export default categoryRouter;
