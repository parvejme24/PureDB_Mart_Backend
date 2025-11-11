import express from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "./order.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const orderRouter = express.Router();

// -------------------- Public Routes --------------------
orderRouter.post("/", createOrder);

// -------------------- Protected/Admin Routes --------------------
orderRouter.get("/", protect, admin, getAllOrders);
orderRouter.get("/:id", protect, admin, getOrderById);
orderRouter.put("/:id/status", protect, admin, updateOrderStatus);
orderRouter.delete("/:id", protect, admin, deleteOrder);

export default orderRouter;
