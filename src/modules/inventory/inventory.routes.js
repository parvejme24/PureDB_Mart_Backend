import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createPurchase,
  createPurchaseReturn,
  getExpiryAlerts,
  getLowStockProducts,
  getPurchaseReturns,
  getPurchases,
  getStockSummary,
} from "./inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.post("/purchases", protect, admin, createPurchase);
inventoryRouter.get("/purchases", protect, admin, getPurchases);
inventoryRouter.get("/stock-summary", protect, admin, getStockSummary);
inventoryRouter.post("/purchase-returns", protect, admin, createPurchaseReturn);
inventoryRouter.get("/purchase-returns", protect, admin, getPurchaseReturns);
inventoryRouter.get("/low-stock", protect, admin, getLowStockProducts);
inventoryRouter.get("/expiry-alerts", protect, admin, getExpiryAlerts);

export default inventoryRouter;

