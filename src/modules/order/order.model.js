import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        title: String,
        price: Number,
        qty: Number,
        weight: { type: Number, default: 0 },
        purchasePrice: { type: Number, default: 0 }, // optional unit purchase price reference
      },
    ],
    isManual: { type: Boolean, default: false }, // if created by admin from dashboard
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: {
        country: { type: String, default: "" },
        division: { type: String, default: "" },
        district: { type: String, default: "" },
        upazila: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        detailsAddress: { type: String, default: "" },
      },
    },
    shippingCost: { type: Number, default: 0 },
    itemsTotal: { type: Number, default: 0 }, // sum of line items (before shipping)
    total: Number,
    paymentMethod: {
      type: String,
      enum: ["COD", "ShurjoPay"],
      required: true,
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentDetails: {
      spOrderId: { type: String, default: null },
      bankTranId: { type: String, default: null },
      cardType: { type: String, default: null },
      currencyType: { type: String, default: null },
      currencyAmount: { type: Number, default: null },
      validatedOn: { type: Date, default: null },
      bankStatus: { type: String, default: null },
      spMessage: { type: String, default: null },
    },
    payments: [
      {
        amount: { type: Number, required: true },
        method: { type: String, default: "cash" },
        receivedBy: {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          name: { type: String, default: "" },
          email: { type: String, default: "" },
        },
        note: { type: String, default: "" },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Virtuals for payment aggregation
OrderSchema.virtual("totalPaid").get(function () {
  return (this.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
});

OrderSchema.virtual("dueAmount").get(function () {
  const total = Number(this.total) || 0;
  const paid = this.totalPaid || 0;
  const due = total - paid;
  return due > 0 ? due : 0;
});

OrderSchema.set("toJSON", { virtuals: true });
OrderSchema.set("toObject", { virtuals: true });

export default mongoose.model("Order", OrderSchema);
