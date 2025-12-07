import mongoose from "mongoose";

const ProcessedBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
  },
  { _id: false }
);

const PurchaseReturnSchema = new mongoose.Schema(
  {
    purchaseId: { type: String, required: true },
    purchaseRef: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryPurchase" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, default: "" },
    sku: { type: String, default: "" },
    quantity: { type: Number, required: true },
    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    processedBy: { type: ProcessedBySchema, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseReturn", PurchaseReturnSchema);


