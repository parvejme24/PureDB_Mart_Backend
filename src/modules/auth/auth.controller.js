import User from "./auth.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// Helper: Generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// -------------------- Register User --------------------
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ fullName, email, password, phone });
    const token = generateToken(user);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Login User --------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(404).json({ message: "Invalid email or password" });

    const token = generateToken(user);
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        image: user.image,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Get Logged-in User --------------------
export const getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Update Profile --------------------
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { fullName, phone, password, address } = req.body;

    // Update fullName
    if (fullName) user.fullName = fullName;

    // Update phone
    if (phone) user.phone = phone;

    // Update password
    if (password) user.password = password; // Will be hashed by pre-save hook

    // Update address - handle JSON parsing safely
    if (address) {
      try {
        user.address = typeof address === "string" ? JSON.parse(address) : address;
      } catch (parseError) {
        return res.status(400).json({ 
          message: "Invalid address format. Please send valid JSON.",
          example: '{"country": "Bangladesh", "division": "Dhaka", "district": "Dhaka", "upazila": "Dhanmondi", "postalCode": "1216", "detailsAddress": "House 123, Road 5"}'
        });
      }
    }

    // Handle image upload
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (user.image?.public_id) {
          await deleteImage(user.image.public_id);
        }

        // Upload new image
        const uploadResult = await uploadFromBuffer(req.file.buffer, "profile_images");
        user.image = {
          url: uploadResult.url,
          public_id: uploadResult.public_id,
        };
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ 
          message: "Image upload failed. Please check Cloudinary configuration.",
          error: uploadError.message 
        });
      }
    }

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(user._id).select("-password");
    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Change Role (Admin only) --------------------
export const changeUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();

    const updatedUser = await User.findById(user._id).select("-password");
    res.status(200).json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Delete User (Admin only) --------------------
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete user image from Cloudinary if exists
    if (user.image?.public_id) {
      await deleteImage(user.image.public_id);
    }

    await user.deleteOne();

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Get All Users (Admin only) --------------------
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const users = await User.find().select("-password");
    res.status(200).json({ users });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
