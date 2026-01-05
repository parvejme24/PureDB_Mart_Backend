import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createPurchase,
  getPurchases,
  getRecentPurchases,
  updatePurchase,
  deletePurchase,
  getStockSummary,
  createPurchaseReturn,
  getPurchaseReturns,
  updatePurchaseReturn,
  deletePurchaseReturn,
  getLowStockProducts,
  getExpiryAlerts,
} from "./inventory.controller.js";

const inventoryRouter = express.Router();

// Purchase routes
inventoryRouter.post("/purchases", protect, admin, createPurchase);
inventoryRouter.get("/purchases", protect, admin, getPurchases);
inventoryRouter.get("/purchases/recent", protect, admin, getRecentPurchases);
inventoryRouter.put("/purchases/:id", protect, admin, updatePurchase);
inventoryRouter.delete("/purchases/:id", protect, admin, deletePurchase);

// Purchase return routes
inventoryRouter.post("/purchase-returns", protect, admin, createPurchaseReturn);
inventoryRouter.get("/purchase-returns", protect, admin, getPurchaseReturns);
inventoryRouter.put("/purchase-returns/:id", protect, admin, updatePurchaseReturn);
inventoryRouter.delete("/purchase-returns/:id", protect, admin, deletePurchaseReturn);

// Stock and alerts
inventoryRouter.get("/stock-summary", protect, admin, getStockSummary);
inventoryRouter.get("/low-stock", protect, admin, getLowStockProducts);
inventoryRouter.get("/expiry-alerts", protect, admin, getExpiryAlerts);

// Low stock config update
inventoryRouter.patch("/low-stock/:productId", protect, admin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { reorderPoint, minStockLevel, expiryWarningDays, expiryTracking } = req.body;

    const Product = (await import("../product/product.model.js")).default;

    const updateData = {};
    if (reorderPoint !== undefined) updateData.reorderPoint = Number(reorderPoint) || 0;
    if (minStockLevel !== undefined) updateData.minStockLevel = Number(minStockLevel) || 0;
    if (expiryWarningDays !== undefined) updateData.expiryWarningDays = Number(expiryWarningDays) || 30;
    if (expiryTracking !== undefined) updateData.expiryTracking = Boolean(expiryTracking);

    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Low stock settings updated", product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default inventoryRouter;
