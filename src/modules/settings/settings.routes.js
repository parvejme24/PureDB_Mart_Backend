import express from "express";
import upload from "../../middleware/upload.js";
import { getSettings, updateSettings } from "./settings.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const settingsRouter = express.Router();

// Public route to fetch configuration for frontend
settingsRouter.get("/", getSettings);

// Admin route to manage shipping + branding assets
settingsRouter.put(
  "/",
  protect,
  admin,
  upload.fields([
    { name: "siteLogo", maxCount: 1 },
    { name: "siteFavicon", maxCount: 1 },
  ]),
  updateSettings
);

export default settingsRouter;

