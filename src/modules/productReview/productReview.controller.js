import ProductReview from "./productReview.model.js";
import Product from "../product/product.model.js";

// Get all reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviews = await ProductReview.find({ product: productId })
      .populate("user", "name email")
      .populate("reply.user", "name email")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ProductReview.countDocuments({ product: productId });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      message: "Failed to fetch reviews",
      error: error.message
    });
  }
};

// Add review to product (only logged-in users)
export const addProductReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { reviewText, reviewRating } = req.body;
    const user = req.user;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Create new review (multiple reviews allowed per user per product)
    const review = new ProductReview({
      product: productId,
      user: user._id,
      reviewText: reviewText.trim(),
      reviewRating: Number(reviewRating),
      // reply defaults to null
    });

    await review.save();
    await review.populate("user", "name email");

    res.status(201).json({
      message: "Review added successfully",
      review,
    });
  } catch (error) {
    console.error("Add product review error:", error);
    res.status(500).json({
      message: "Failed to add review",
      error: error.message
    });
  }
};

// Add or update reply to a review (any authenticated user)
export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { replyText } = req.body;
    const user = req.user;

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if review already has a reply
    if (review.reply) {
      // Check if user owns the reply (can only update their own reply)
      if (review.reply.user.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "You can only update your own replies" });
      }

      // Update existing reply
      review.reply.replyText = replyText.trim();
      review.reply.updatedAt = new Date();

      await review.save();
      await review.populate("reply.user", "name email");

      res.status(200).json({
        message: "Reply updated successfully",
        review,
      });
    } else {
      // Add new reply
      review.reply = {
        user: user._id,
        replyText: replyText.trim(),
      };

      await review.save();
      await review.populate("reply.user", "name email");

      res.status(201).json({
        message: "Reply added successfully",
        review,
      });
    }
  } catch (error) {
    console.error("Reply to review error:", error);
    res.status(500).json({
      message: "Failed to add/update reply",
      error: error.message
    });
  }
};

// Update own review (review owner only)
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reviewText, reviewRating } = req.body;
    const user = req.user;

    const review = await ProductReview.findOne({ _id: reviewId, user: user._id });

    if (!review) {
      return res.status(404).json({ message: "Review not found or you don't have permission to update it" });
    }

    // Update review fields
    if (reviewText !== undefined) review.reviewText = reviewText.trim();
    if (reviewRating !== undefined) review.reviewRating = Number(reviewRating);

    await review.save();

    res.status(200).json({
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      message: "Failed to update review",
      error: error.message
    });
  }
};

// Delete own review (review owner only)
export const deleteOwnReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = req.user;

    const review = await ProductReview.findOneAndDelete({ _id: reviewId, user: user._id });

    if (!review) {
      return res.status(404).json({ message: "Review not found or you don't have permission to delete it" });
    }

    res.status(200).json({
      message: "Review deleted successfully",
      deletedReview: {
        id: review._id,
        reviewText: review.reviewText,
      },
    });
  } catch (error) {
    console.error("Delete own review error:", error);
    res.status(500).json({
      message: "Failed to delete review",
      error: error.message
    });
  }
};

// Delete review (admin only)
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ProductReview.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({
      message: "Review deleted successfully",
      deletedReview: {
        id: review._id,
        reviewText: review.reviewText,
      },
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      message: "Failed to delete review",
      error: error.message
    });
  }
};

// Delete reply from review (reply owner only)
export const deleteReviewReply = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = req.user;

    const review = await ProductReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (!review.reply) {
      return res.status(404).json({ message: "Review has no reply to delete" });
    }

    // Check if user owns the reply
    if (review.reply.user.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own replies" });
    }

    review.reply = null;
    await review.save();

    res.status(200).json({
      message: "Reply deleted successfully",
    });
  } catch (error) {
    console.error("Delete review reply error:", error);
    res.status(500).json({
      message: "Failed to delete reply",
      error: error.message
    });
  }
};

// Get all reviews (admin only - for management)
export const getAllReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      product,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    let query = {};
    if (product) query.product = product;

    const reviews = await ProductReview.find(query)
      .populate("product", "name slug")
      .populate("user", "name email")
      .populate("reply.user", "name email")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ProductReview.countDocuments(query);

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({
      message: "Failed to fetch reviews",
      error: error.message
    });
  }
};

// Get user's reviews (admin only - can view any user's reviews with product details)
export const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await ProductReview.find({ user: userId })
      .populate({
        path: "product",
        select: "name image category _id",
        populate: {
          path: "category",
          select: "name"
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ProductReview.countDocuments({ user: userId });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({
      message: "Failed to fetch user reviews",
      error: error.message
    });
  }
};