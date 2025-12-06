import express from "express";
import {
  createOrder,
  createCustomOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  addPayment,
} from "./order.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const orderRouter = express.Router();

// -------------------- Public Routes --------------------
orderRouter.post("/", createOrder);

// -------------------- Protected/Admin Routes --------------------
orderRouter.post("/custom", protect, admin, createCustomOrder);
orderRouter.get("/", protect, admin, getAllOrders);
orderRouter.get("/:id", protect, admin, getOrderById);
orderRouter.post("/:id/payments", protect, admin, addPayment);
orderRouter.put("/:id/status", protect, admin, updateOrderStatus);
orderRouter.delete("/:id", protect, admin, deleteOrder);

export default orderRouter;
