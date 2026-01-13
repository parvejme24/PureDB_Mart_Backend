import mongoose from "mongoose";

const ReviewReplySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    replyText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const ProductReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // reviewer
    },
    reviewText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    reviewRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    reply: {
      type: ReviewReplySchema,
      default: null, // only ONE reply
    },
  },
  { timestamps: true }
);

export default mongoose.model("ProductReview", ProductReviewSchema);
