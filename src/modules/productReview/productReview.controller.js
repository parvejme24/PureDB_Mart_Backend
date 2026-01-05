import ProductReview from "./productReview.model.js";
import {
  validateRating,
  generateReviewId,
  generateReplyId,
  hasUserPurchasedProduct,
  doesProductExist,
  hasUserReviewedProduct,
  updateProductAverageRating,
  isReviewOwner,
  isReplyOwner,
  parsePaginationParams,
  parseReviewSortParams,
  buildReviewFilter
} from "./productReview.utils.js";

// Create Product Review
export const createProductReview = async (req, res) => {
  try {
    const { product, rating, comment = "" } = req.body;
    const user = req.user;

    if (!validateRating(rating)) return res.status(400).json({ message: "Invalid rating" });
    if (!(await doesProductExist(product))) return res.status(404).json({ message: "Product not found" });
    if (await hasUserReviewedProduct(product, user._id)) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    const isVerified = await hasUserPurchasedProduct(user.email, product);
    const review = await ProductReview.create({
      reviewId: generateReviewId(),
      product,
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      rating: parseInt(rating),
      comment,
      isVerified
    });

    await updateProductAverageRating(product);
    res.status(201).json({ message: "Review created successfully", review });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Product Reviews
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page, limit } = parsePaginationParams(req.query);
    const sort = parseReviewSortParams(req.query.sort);
    const filter = buildReviewFilter(req.query, productId);

    const skip = (page - 1) * limit;
    const reviews = await ProductReview.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("user", "name avatar");

    const total = await ProductReview.countDocuments(filter);
    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Product Average Rating
export const getProductAverageRating = async (req, res) => {
  try {
    const { productId } = req.params;
    const averageRating = await updateProductAverageRating(productId);
    const totalReviews = await ProductReview.countDocuments({
      product: productId,
      isApproved: true
    });

    res.json({ averageRating, totalReviews });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Update Product Review
export const updateProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    if (!(await isReviewOwner(id, userId))) {
      return res.status(403).json({ message: "Not authorized to update this review" });
    }

    if (rating && !validateRating(rating)) {
      return res.status(400).json({ message: "Invalid rating" });
    }

    const updateData = {};
    if (rating) updateData.rating = parseInt(rating);
    if (comment !== undefined) updateData.comment = comment;

    const review = await ProductReview.findByIdAndUpdate(id, updateData, { new: true });
    if (!review) return res.status(404).json({ message: "Review not found" });

    await updateProductAverageRating(review.product);
    res.json({ message: "Review updated successfully", review });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete Product Review
export const deleteProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!(await isReviewOwner(id, userId))) {
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    const review = await ProductReview.findByIdAndDelete(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    await updateProductAverageRating(review.product);
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Approve Review (Admin only)
export const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await ProductReview.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true }
    );

    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review approved successfully", review });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get User Reviews
export const getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit } = parsePaginationParams(req.query);

    const skip = (page - 1) * limit;
    const reviews = await ProductReview.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("product", "name image slug");

    const total = await ProductReview.countDocuments({ user: userId });
    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Add Review Reply
export const addReviewReply = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { replyText } = req.body;
    const user = req.user;

    if (!replyText || replyText.trim().length === 0) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const review = await ProductReview.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const reply = {
      replyId: generateReplyId(),
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role || "user",
      replyText: replyText.trim()
    };

    review.replies.push(reply);
    await review.save();

    res.status(201).json({ message: "Reply added successfully", reply });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Review Replies
export const getReviewReplies = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await ProductReview.findById(reviewId).select("replies");

    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json({ replies: review.replies });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Update Review Reply
export const updateReviewReply = async (req, res) => {
  try {
    const { reviewId, replyId } = req.params;
    const { replyText } = req.body;
    const userId = req.user._id;

    if (!(await isReplyOwner(reviewId, replyId, userId))) {
      return res.status(403).json({ message: "Not authorized to update this reply" });
    }

    if (!replyText || replyText.trim().length === 0) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const review = await ProductReview.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const reply = review.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    reply.replyText = replyText.trim();
    reply.updatedAt = new Date();
    await review.save();

    res.json({ message: "Reply updated successfully", reply });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete Review Reply
export const deleteReviewReply = async (req, res) => {
  try {
    const { reviewId, replyId } = req.params;
    const userId = req.user._id;

    if (!(await isReplyOwner(reviewId, replyId, userId))) {
      return res.status(403).json({ message: "Not authorized to delete this reply" });
    }

    const review = await ProductReview.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.replies.pull(replyId);
    await review.save();

    res.json({ message: "Reply deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
