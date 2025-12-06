import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import { createWaste, getWaste } from "./waste.controller.js";

const wasteRouter = express.Router();

wasteRouter.post("/", protect, admin, createWaste);
wasteRouter.get("/", protect, admin, getWaste);

export default wasteRouter;

