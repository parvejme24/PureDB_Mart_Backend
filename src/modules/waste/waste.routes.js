import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createWaste,
  getWaste,
  updateWaste,
  deleteWaste,
  getWasteStats,
  bulkCreateWaste
} from "./waste.controller.js";

const wasteRouter = express.Router();

// Waste CRUD operations
wasteRouter.post("/", protect, admin, createWaste);
wasteRouter.get("/", protect, admin, getWaste);
wasteRouter.put("/:id", protect, admin, updateWaste);
wasteRouter.delete("/:id", protect, admin, deleteWaste);

// Waste analytics and bulk operations
wasteRouter.get("/stats", protect, admin, getWasteStats);
wasteRouter.post("/bulk", protect, admin, bulkCreateWaste);

export default wasteRouter;
