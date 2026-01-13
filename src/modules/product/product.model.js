import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },
    sku: { type: String, default: "", unique: false }, // optional product code
    shortDescription: { type: String, required: true, default: "" },
    description: { type: String, required: true, default: "" },
    price: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 }, // absolute discount amount in BDT
    weight: { type: Number, default: 0 }, // product weight for shipping logic
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    stock: { type: Number, required: true },
    weightUnit: { type: String, default: "" }, // e.g., pcs, kg, box
    sold: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    productExpiryDays: { type: Date, default: null },
    isDeliveryChargeFree: { type: Boolean, default: false },
    transportCost: { type: Number, default: 0 },
    otherCost: { type: Number, default: 0 },
    note: { type: String, default: "" },
    image: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    purchasePrice: { type: Number, default: 0 }, // cost price for profit calculation
    minStockLevel: { type: Number, default: 0 }, // minimum stock level alert
    expiryTracking: { type: Boolean, default: false }, // enable expiry date tracking
    expiryWarningDays: { type: Number, default: 30 }, // days before expiry to show warning
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
