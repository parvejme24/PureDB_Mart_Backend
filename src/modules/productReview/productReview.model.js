import mongoose from "mongoose";

// Review Reply Schema
const ReviewReplySchema = new mongoose.Schema({
  replyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  userRole: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  replyText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Product Review Schema
const ProductReviewSchema = new mongoose.Schema({
  reviewId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  comment: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  isApproved: {
    type: Boolean,
    default: true,
    index: true
  },
  helpful: {
    type: Number,
    default: 0,
    min: 0
  },
  replies: [ReviewReplySchema]
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  // Add compound indexes for better query performance
  indexes: [
    { product: 1, isApproved: 1 },
    { user: 1, product: 1 }, // Prevent duplicate reviews per user per product
    { createdAt: -1 },
    { rating: -1, createdAt: -1 }
  ]
});

// Prevent duplicate reviews from same user for same product
ProductReviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Pre-save middleware to update timestamps
ProductReviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("ProductReview", ProductReviewSchema);
export { ReviewReplySchema };
