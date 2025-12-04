import jwt from "jsonwebtoken";
import User from "../modules/auth/auth.model.js";

// Protect route
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Debug: Log what we receive
    console.log("=== AUTH DEBUG ===");
    console.log("Authorization Header:", authHeader);

    // Check if authorization header exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Error: No Bearer token found");
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Token received:", token ? "Yes (length: " + token.length + ")" : "No");

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Decode without verifying first to see the payload
    const decoded_payload = jwt.decode(token);
    console.log("Token payload:", decoded_payload);
    
    if (decoded_payload) {
      const now = Math.floor(Date.now() / 1000);
      console.log("Current time (unix):", now);
      console.log("Token issued at (iat):", decoded_payload.iat);
      console.log("Token expires at (exp):", decoded_payload.exp);
      console.log("Time until expiry (seconds):", decoded_payload.exp - now);
      
      if (decoded_payload.exp < now) {
        console.log("Token IS expired!");
      } else {
        console.log("Token is NOT expired");
      }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token verified successfully!");

    // Find user by decoded id
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      console.log("Error: User not found in database");
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    console.log("User found:", user.email);
    console.log("=== AUTH SUCCESS ===");

    req.user = user;
    next();
  } catch (error) {
    console.error("=== AUTH ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Not authorized, token expired",
        expiredAt: error.expiredAt 
      });
    }

    return res.status(401).json({ message: "Not authorized" });
  }
};

// Admin check
export const admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admin only" });
  }
  next();
};
