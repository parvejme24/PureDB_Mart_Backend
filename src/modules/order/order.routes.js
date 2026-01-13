import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  moveOrderToTrash,
  restoreOrder,
  permanentlyDeleteOrder,
  getAllOrders,
  getTrashedOrders,
  searchOrdersByCustomer,
} from "./order.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// User routes
router.post("/", createOrder); // Create new order
router.get("/", getUserOrders); // Get user's orders
router.get("/:orderId", getOrderById); // Get single order details
router.put("/:orderId/cancel", cancelOrder); // Cancel order

// Admin only routes
router.get("/admin/all", admin, getAllOrders); // Get all active orders
router.get("/admin/trash", admin, getTrashedOrders); // Get trashed orders
router.get("/admin/search", admin, searchOrdersByCustomer); // Search orders by customer email/phone
router.put("/:orderId/status", admin, updateOrderStatus); // Update order status
router.put("/:orderId/trash", admin, moveOrderToTrash); // Move order to trash
router.put("/:orderId/restore", admin, restoreOrder); // Restore order from trash
router.delete("/:orderId", admin, permanentlyDeleteOrder); // Permanently delete from trash

export default router;