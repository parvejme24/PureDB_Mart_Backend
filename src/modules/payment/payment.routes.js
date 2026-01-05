import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createPayment,
  getOrderPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
  processShurjoPayPayment,
  verifyShurjoPayPayment,
  processSSLCommerzPayment,
  sslCommerzIPN,
} from "./payment.controller.js";

const paymentRouter = express.Router();

// Payment CRUD routes (admin only)
paymentRouter.post("/", protect, admin, createPayment);
paymentRouter.get("/", protect, admin, getAllPayments);
paymentRouter.put("/:id/status", protect, admin, updatePaymentStatus);
paymentRouter.delete("/:id", protect, admin, deletePayment);

// Order payment routes
paymentRouter.get("/order/:orderId", protect, admin, getOrderPayments);

// ShurjoPay routes
paymentRouter.post("/shurjopay/initiate", protect, processShurjoPayPayment);
paymentRouter.post("/shurjopay/verify", verifyShurjoPayPayment);

// SSLCommerz routes
paymentRouter.post("/sslcommerz/initiate", protect, processSSLCommerzPayment);
paymentRouter.post("/sslcommerz/ipn", sslCommerzIPN);

export default paymentRouter;
