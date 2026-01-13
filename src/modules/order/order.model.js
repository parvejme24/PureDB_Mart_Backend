import mongoose from "mongoose";

/* ---------- Order Product ---------- */
const OrderProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true }, // snapshot
    price: { type: Number, required: true }, // snapshot
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

/* ---------- Order Schema ---------- */
const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerInfo: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      division: { type: String, required: true },
      district: { type: String, required: true },
      upazila: { type: String, required: true },
      zipCode: { type: String },
      detailsAddress: { type: String, required: true },
    },
    products: {
      type: [OrderProductSchema],
      required: true,
    },
    shippingCost: { type: Number, required: true },

    /* ---------- Coupon Section ---------- */
    coupon: {
      code: { type: String },
      discountType: {
        type: String,
        enum: ["PERCENTAGE", "FLAT"],
      },
      discountValue: { type: Number },
      discountAmount: { type: Number, default: 0 },
    },
    subtotal: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "BKASH", "NAGAD", "CARD"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);
