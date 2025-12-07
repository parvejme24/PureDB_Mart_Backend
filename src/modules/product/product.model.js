import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, default: "", unique: false }, // optional product code
    description: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // absolute discount amount in BDT
    weight: { type: Number, default: 0 }, // product weight for shipping logic
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    stock: { type: Number, required: true },
    unit: { type: String, default: "" }, // e.g., pcs, kg, box
    brand: { type: String, default: "" },
    barcode: { type: String, default: "" },
    purchasePrice: { type: Number, default: 0 }, // latest purchase unit price
    reorderPoint: { type: Number, default: 0 }, // low-stock threshold
    minStockLevel: { type: Number, default: 0 }, // alternative threshold
    expiryTracking: { type: Boolean, default: false },
    expiryWarningDays: { type: Number, default: 30 },
    image: {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
    views: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Virtual field to expose discounted price without storing it
ProductSchema.virtual("withDiscountPrice").get(function () {
  const price = Number(this.price) || 0;
  const discount = Number(this.discount) || 0;
  const discounted = price - discount;
  return discounted > 0 ? discounted : 0;
});

ProductSchema.set("toJSON", { virtuals: true });
ProductSchema.set("toObject", { virtuals: true });

export default mongoose.model("Product", ProductSchema);
