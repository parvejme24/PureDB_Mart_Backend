import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 5050;

// Connect to database
let isConnected = false;

const ensureDbConnection = async () => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
      console.log("✅ Database connected");
    } catch (err) {
      console.error("❌ Database connection failed:", err.message);
      throw err;
    }
  }
};

// Vercel serverless function
export default async function handler(req, res) {
  try {
    // Ensure database connection for serverless
    await ensureDbConnection();

    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error("Serverless function error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
}

// For local development
if (process.env.NODE_ENV !== "production") {
  console.log("=== Environment Check ===");
  console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "✅ Set" : "❌ Missing");
  console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "✅ Set" : "❌ Missing");
  console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "✅ Set" : "❌ Missing");
  console.log("JWT_SECRET:", process.env.JWT_SECRET ? "✅ Set" : "❌ Missing");
  console.log("MONGODB_URI:", process.env.MONGODB_URI ? "✅ Set" : "❌ Missing");
  console.log("SP_ENDPOINT:", process.env.SP_ENDPOINT ? "✅ Set" : "❌ Missing");
  console.log("=========================");

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ Database connection failed:", err.message);
    });
}
