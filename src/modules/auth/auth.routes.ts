import express from "express";
import multer from "multer";
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

const storage = multer.diskStorage({});
const upload = multer({ storage });

const authRouter = express.Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.get("/me", protect, getLoggedInUser);
authRouter.put("/update", protect, upload.single("image"), updateProfile);
authRouter.put("/role", protect, admin, changeUserRole);
authRouter.delete("/:id", protect, admin, deleteUser);
authRouter.get("/all", protect, admin, getAllUsers);

export default authRouter;
