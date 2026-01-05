import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createGift,
  getGifts,
  getGiftById,
  updateGift,
  deleteGift,
  getGiftStats
} from "./gift.controller.js";

const giftRouter = express.Router();

// Gift CRUD operations
giftRouter.post("/", protect, admin, createGift);
giftRouter.get("/", protect, admin, getGifts);
giftRouter.get("/:id", protect, admin, getGiftById);
giftRouter.put("/:id", protect, admin, updateGift);
giftRouter.delete("/:id", protect, admin, deleteGift);

// Gift analytics
giftRouter.get("/stats/analytics", protect, admin, getGiftStats);

export default giftRouter;
