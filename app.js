import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";

import authRouter from "./src/modules/auth/auth.routes.js";
import categoryRouter from "./src/modules/category/category.routes.js";
import productRouter from "./src/modules/product/product.routes.js";
import orderRouter from "./src/modules/order/order.routes.js";
import dashboardRouter from "./src/modules/dashboard/dashboard.routes.js";
import paymentRouter from "./src/modules/payment/payment.routes.js";
import settingsRouter from "./src/modules/settings/settings.routes.js";
import shippingRouter from "./src/modules/shipping/shipping.routes.js";
import inventoryRouter from "./src/modules/inventory/inventory.routes.js";
import giftRouter from "./src/modules/gift/gift.routes.js";
import wasteRouter from "./src/modules/waste/waste.routes.js";
import expenseRouter from "./src/modules/expense/expense.routes.js";

const app = express();

// CORS options - Allow all origins in production for flexibility
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "production") {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For ShurjoPay form data

// Database connection middleware for serverless
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// Default Route
app.get("/", (req, res) => {
  res.json({ message: "PureBD_Mart Server Working" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/shipping", shippingRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/gifts", giftRouter);
app.use("/api/waste", wasteRouter);
app.use("/api/expenses", expenseRouter);

export default app;
