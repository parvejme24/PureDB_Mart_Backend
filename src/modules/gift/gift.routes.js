import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import { createGift, getGifts } from "./gift.controller.js";

const giftRouter = express.Router();

giftRouter.post("/", protect, admin, createGift);
giftRouter.get("/", protect, admin, getGifts);

export default giftRouter;

