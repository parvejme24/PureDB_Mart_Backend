import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import { createPurchase, getPurchases, getStockSummary } from "./inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.post("/purchases", protect, admin, createPurchase);
inventoryRouter.get("/purchases", protect, admin, getPurchases);
inventoryRouter.get("/stock-summary", protect, admin, getStockSummary);

export default inventoryRouter;

