import mongoose from "mongoose";

const GiftItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, default: "" },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const GiftSchema = new mongoose.Schema(
  {
    giftId: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    giver: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, default: "" },
    recipientAddress: { type: String, default: "" },
    items: { type: [GiftItemSchema], default: [] },
    note: { type: String, default: "" },
    shippingAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Gift", GiftSchema);

