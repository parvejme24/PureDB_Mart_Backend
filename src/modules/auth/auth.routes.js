import express from "express";
import upload from "../../middleware/upload.js";
import {
  registerUser,
  loginUser,
  getLoggedInUser,
  updateProfile,
  changeUserRole,
  deleteUser,
  getAllUsers,
} from "./auth.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const authRouter = express.Router();

// Public routes
authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);

// Protected routes
authRouter.get("/me", protect, getLoggedInUser);
authRouter.put("/update", protect, upload.single("image"), updateProfile);

// Admin only routes
authRouter.put("/role", protect, admin, changeUserRole);
authRouter.delete("/:id", protect, admin, deleteUser);
authRouter.get("/all", protect, admin, getAllUsers);

export default authRouter;

