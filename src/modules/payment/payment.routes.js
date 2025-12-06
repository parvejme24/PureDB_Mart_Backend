import express from "express";
import {
  initPayment,
  paymentCallback,
  verifyPayment,
  checkPaymentStatus,
  paymentIPN,
  getAllTransactions,
  checkPaymentConfig,
} from "./payment.controller.js";
import { protect, admin } from "../../middleware/authMiddleware.js";

const paymentRouter = express.Router();

// Debug route - Check payment config
paymentRouter.get("/config-check", checkPaymentConfig);

// Public routes - Initialize payment
paymentRouter.post("/init", initPayment);

// ShurjoPay callback route (GET request - return URL)
paymentRouter.get("/callback", paymentCallback);

// Verify payment (can be called from frontend)
paymentRouter.post("/verify", verifyPayment);

// IPN endpoint
paymentRouter.post("/ipn", paymentIPN);

// Protected routes - Check payment status
paymentRouter.get("/status/:transactionId", protect, checkPaymentStatus);

// Admin only routes
paymentRouter.get("/transactions", protect, admin, getAllTransactions);

export default paymentRouter;
