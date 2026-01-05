import mongoose from "mongoose";

// Cache the database connection for serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return the existing connection
  if (cached.conn) {
    console.log("✅ Using cached MongoDB connection");
    return cached.conn;
  }

  // If a connection is in progress, wait for it
  if (!cached.promise) {
    console.log("🔄 Creating new MongoDB connection...");
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };

    // Check if MONGODB_URI is available
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("🔍 MONGODB_URI available:", !!process.env.MONGODB_URI);

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, opts)
      .then((mongoose) => {
        console.log(`✅ MongoDB Connected: ${mongoose.connection.name}`);
        return mongoose;
      })
      .catch((error) => {
        console.error("❌ MongoDB Connection Failed:", error.message);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    console.log("✅ MongoDB connection established successfully");
  } catch (error) {
    cached.promise = null;
    console.error("❌ MongoDB Connection Failed:", error.message);
    console.error("❌ Error details:", error);
    throw error;
  }

  return cached.conn;
};

export default connectDB;
