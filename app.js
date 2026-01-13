import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./src/config/db.js";

import authRouter from "./src/modules/auth/auth.routes.js";
import categoryRouter from "./src/modules/category/category.routes.js";
import productRouter from "./src/modules/product/product.routes.js";
import productReviewRouter from "./src/modules/productReview/productReview.routes.js";

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
    if (
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === "production"
    ) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Database connection middleware for serverless
app.use(async (req, res, next) => {
  try {
    // This will be handled by the Vercel function in index.js
    // but we keep it here for local development
    if (process.env.NODE_ENV !== "production") {
      const connectDB = (await import("./src/config/db.js")).default;
      await connectDB();
    }
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(morgan("combined")); // HTTP request logger
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For ShurjoPay form data

// Default Route
app.get("/", (req, res) => {
  res.json({ message: "PureBD_Mart Server Working" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/reviews", productReviewRouter);
// app.use("/api/reviews", productReviewRouter);
// app.use("/api/wishlist", productWishlistRouter);

export default app;
