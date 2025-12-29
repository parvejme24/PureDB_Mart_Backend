import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createPurchase,
  createPurchaseReturn,
  deletePurchase,
  deletePurchaseReturn,
  getExpiryAlerts,
  getLowStockProducts,
  getPurchaseReturns,
  getPurchases,
  getRecentPurchases,
  getStockSummary,
  updateLowStockConfig,
  updatePurchase,
  updatePurchaseReturn,
} from "./inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.post("/purchases", protect, admin, createPurchase);
inventoryRouter.get("/purchases", protect, admin, getPurchases);
inventoryRouter.get("/purchases/recent", protect, admin, getRecentPurchases);
inventoryRouter.put("/purchases/:id", protect, admin, updatePurchase);
inventoryRouter.delete("/purchases/:id", protect, admin, deletePurchase);
inventoryRouter.get("/stock-summary", protect, admin, getStockSummary);
inventoryRouter.post("/purchase-returns", protect, admin, createPurchaseReturn);
inventoryRouter.get("/purchase-returns", protect, admin, getPurchaseReturns);
inventoryRouter.put("/purchase-returns/:id", protect, admin, updatePurchaseReturn);
inventoryRouter.delete("/purchase-returns/:id", protect, admin, deletePurchaseReturn);
inventoryRouter.get("/low-stock", protect, admin, getLowStockProducts);
inventoryRouter.patch("/low-stock/:productId", protect, admin, updateLowStockConfig);
inventoryRouter.get("/expiry-alerts", protect, admin, getExpiryAlerts);

export default inventoryRouter;

