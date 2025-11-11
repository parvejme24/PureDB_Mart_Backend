import express from "express";
import cors from "cors";
import authRouter from "./src/modules/auth/auth.routes.ts";
import categoryRouter from "./src/modules/category/category.routes.js";

const app = express();

// CORS options
const corsOptions = {
  origin: ["http://localhost:3000", "http://example.com"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Default Route
app.get("/", (req, res) => {
  res.json({ message: "PureDB_Mart Server Working" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);

export default app;
