import User from "./auth.model.js";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

// Cloudinary configuration
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------- REGISTER USER --------------------
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ fullName, email, password });

    res.status(201).json({ user, message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- LOGIN USER --------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Invalid email or password" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(404).json({ message: "Invalid email or password" });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        image: user.image,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- GET LOGGED-IN USER --------------------
export const getLoggedInUser = async (req, res) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by decoded ID
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

// -------------------- UPDATE PROFILE --------------------
export const updateProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, password, address } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (fullName) user.fullName = fullName;
    if (password) user.password = password; // will be hashed by pre-save hook
    if (address) user.address = address;

    if (req.file) {
      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "profile_images",
      });
      user.image = result.secure_url;
    }

    await user.save();
    res.status(200).json({ user, message: "Profile updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- CHANGE ROLE (ADMIN ONLY) --------------------
export const changeUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();

    res.status(200).json({ user, message: "User role updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- DELETE USER (ADMIN ONLY) --------------------
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- GET ALL USERS (ADMIN ONLY) --------------------
export const getAllUser = async (req, res) => {
  try {
    // Check admin role
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const users = await User.find().select("-password");
    res.status(200).json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
