import express from "express";
import multer from "multer";
import {
  changeUserRole,
  deleteUser,
  getAllUser,
  getLoggedInUser,
  loginUser,
  registerUser,
  updateProfile,
} from "./auth.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const storage = multer.diskStorage({});
const upload = multer({ storage });

const authRouter = express.Router();

// Public routes
authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);

// Protected routes
authRouter.get("/me", protect, getLoggedInUser);
authRouter.put("/update/:id", protect, upload.single("image"), updateProfile);

// Admin routes
authRouter.put("/role", protect, admin, changeUserRole);
authRouter.delete("/:id", protect, admin, deleteUser);
authRouter.get("/all", protect, admin, getAllUser);

export default authRouter;
