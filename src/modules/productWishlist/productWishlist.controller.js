import Wishlist from "./productWishlist.model.js";
import Product from "../product/product.model.js";

// Get user's wishlist
export const getUserWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: "products",
        select: "name slug image price discount category",
        populate: {
          path: "category",
          select: "name"
        }
      });

    if (!wishlist) {
      return res.status(200).json({
        wishlist: [],
        count: 0,
      });
    }

    res.status(200).json({
      wishlist: wishlist.products,
      count: wishlist.products.length,
    });
  } catch (error) {
    console.error("Get user wishlist error:", error);
    res.status(500).json({
      message: "Failed to fetch wishlist",
      error: error.message
    });
  }
};

// Add product to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Find or create user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        products: [productId],
      });
    } else {
      // Check if product is already in wishlist
      if (wishlist.products.includes(productId)) {
        return res.status(400).json({
          message: "Product is already in your wishlist"
        });
      }

      // Add product to wishlist
      wishlist.products.push(productId);
    }

    await wishlist.save();

    // Populate product details for response
    await wishlist.populate({
      path: "products",
      select: "name slug image price discount category",
      populate: {
        path: "category",
        select: "name"
      }
    });

    res.status(201).json({
      message: "Product added to wishlist successfully",
      wishlist: wishlist.products,
      count: wishlist.products.length,
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({
      message: "Failed to add product to wishlist",
      error: error.message
    });
  }
};

// Remove product from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    // Check if product is in wishlist
    const productIndex = wishlist.products.indexOf(productId);
    if (productIndex === -1) {
      return res.status(404).json({
        message: "Product not found in your wishlist"
      });
    }

    // Remove product from wishlist
    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    // Populate product details for response
    await wishlist.populate({
      path: "products",
      select: "name slug image price discount category",
      populate: {
        path: "category",
        select: "name"
      }
    });

    res.status(200).json({
      message: "Product removed from wishlist successfully",
      wishlist: wishlist.products,
      count: wishlist.products.length,
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    res.status(500).json({
      message: "Failed to remove product from wishlist",
      error: error.message
    });
  }
};

// Clear entire wishlist (remove all products)
export const clearWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { products: [] },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json({
      message: "Wishlist cleared successfully",
      wishlist: [],
      count: 0,
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);
    res.status(500).json({
      message: "Failed to clear wishlist",
      error: error.message
    });
  }
};