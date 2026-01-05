import ProductWishlist from "./productWishlist.model.js";
import Product from "../product/product.model.js";

// Add product to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { product } = req.body;

    if (!product) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if product is already in user's wishlist
    const existingWishlistItem = await ProductWishlist.findOne({
      product,
      user: req.user._id
    });

    if (existingWishlistItem) {
      return res.status(400).json({ message: "Product is already in your wishlist" });
    }

    const wishlistItem = await ProductWishlist.create({
      product,
      user: req.user._id
    });

    res.status(201).json({
      message: "Product added to wishlist",
      wishlistItem
    });
  } catch (error) {
    console.log("Add to wishlist error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Remove product from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlistItem = await ProductWishlist.findOneAndDelete({
      product: productId,
      user: req.user._id
    });

    if (!wishlistItem) {
      return res.status(404).json({ message: "Product not found in your wishlist" });
    }

    res.status(200).json({ message: "Product removed from wishlist" });
  } catch (error) {
    console.log("Remove from wishlist error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get user's wishlist
export const getUserWishlist = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [wishlistItems, totalCount] = await Promise.all([
      ProductWishlist.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'product',
          select: 'name slug sku shortDescription price discount weight weightUnit category image views isDeliveryChargeFree'
        }),
      ProductWishlist.countDocuments({ user: req.user._id })
    ]);

    // Filter out items where product no longer exists
    const validItems = wishlistItems.filter(item => item.product !== null);

    res.status(200).json({
      wishlist: validItems,
      totalCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.log("Get user wishlist error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Check if product is in user's wishlist
export const checkWishlistStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlistItem = await ProductWishlist.findOne({
      product: productId,
      user: req.user._id
    });

    res.status(200).json({
      isInWishlist: !!wishlistItem,
      wishlistItem: wishlistItem || null
    });
  } catch (error) {
    console.log("Check wishlist status error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Clear user's entire wishlist
export const clearWishlist = async (req, res) => {
  try {
    const result = await ProductWishlist.deleteMany({
      user: req.user._id
    });

    res.status(200).json({
      message: "Wishlist cleared successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.log("Clear wishlist error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get wishlist statistics (admin)
export const getWishlistStats = async (req, res) => {
  try {
    const [
      totalWishlistItems,
      uniqueProducts,
      uniqueUsers,
      mostWishlistedProducts
    ] = await Promise.all([
      ProductWishlist.countDocuments(),
      ProductWishlist.distinct('product'),
      ProductWishlist.distinct('user'),
      ProductWishlist.aggregate([
        {
          $group: {
            _id: "$product",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            productName: "$product.name",
            productSku: "$product.sku",
            wishlistCount: "$count"
          }
        }
      ])
    ]);

    res.status(200).json({
      stats: {
        totalWishlistItems,
        uniqueProductsInWishlist: uniqueProducts.length,
        uniqueUsersWithWishlist: uniqueUsers.length,
        mostWishlistedProducts
      }
    });
  } catch (error) {
    console.log("Get wishlist stats error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Bulk add products to wishlist (for admin or data migration)
export const bulkAddToWishlist = async (req, res) => {
  try {
    const { products } = req.body; // Array of product IDs

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products array is required" });
    }

    const wishlistItems = products.map(productId => ({
      product: productId,
      user: req.user._id
    }));

    // Use upsert to avoid duplicates
    const bulkOps = wishlistItems.map(item => ({
      updateOne: {
        filter: { product: item.product, user: item.user },
        update: item,
        upsert: true
      }
    }));

    const result = await ProductWishlist.bulkWrite(bulkOps);

    res.status(200).json({
      message: "Products added to wishlist",
      result: {
        insertedCount: result.upsertedCount,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.log("Bulk add to wishlist error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
