import express from "express";
import multer from "multer";
import {
  createProduct,
  getAllProducts,
  getProductById,
  getProductsByCategorySlug,
  updateProduct,
  deleteProduct,
} from "./product.controller.js";

const productRouter = express.Router();

// -------------------- Multer Config --------------------
const storage = multer.diskStorage({});
const upload = multer({ storage });

// -------------------- Routes --------------------
productRouter.post("/", upload.single("image"), createProduct);
productRouter.get("/", getAllProducts);
productRouter.get("/:id", getProductById);
productRouter.get("/category/:slug", getProductsByCategorySlug);
productRouter.put("/:id", upload.single("image"), updateProduct);
productRouter.delete("/:id", deleteProduct);

export default productRouter;
