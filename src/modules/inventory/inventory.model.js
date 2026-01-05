import mongoose from "mongoose";

const CollectedBySchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false }
);

const AddedBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
  },
  { _id: false }
);

const InventoryPurchaseSchema = new mongoose.Schema(
  {
    purchaseId: { type: String, required: true, unique: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, default: "" },
    date: { type: Date, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true }, // quantity * unitPrice
    transportCost: { type: Number, default: 0 },
    otherCost: { type: Number, default: 0 },
    note: { type: String, default: "" },
    source: { type: String, default: "" }, // place or person the product was collected from
    collectedBy: { type: CollectedBySchema, default: {} }, // person who physically collected
    addedBy: { type: AddedBySchema, default: {} }, // logged in user who created entry
    batchNumber: { type: String, default: "" },
    expiryDate: { type: Date, default: null },
    warehouse: { type: String, default: "main" },
  },
  { timestamps: true }
);

const PurchaseReturnSchema = new mongoose.Schema(
  {
    purchaseId: { type: String, required: true },
    purchaseRef: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryPurchase", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, default: "" },
    quantity: { type: Number, required: true },
    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    processedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const InventoryPurchase = mongoose.model("InventoryPurchase", InventoryPurchaseSchema);
export const PurchaseReturn = mongoose.model("PurchaseReturn", PurchaseReturnSchema);
