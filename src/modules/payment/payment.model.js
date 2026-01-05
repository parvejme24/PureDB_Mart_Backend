import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "shurjopay", "sslcommerz"],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending"
    },
    transactionId: { type: String, default: "" },
    reference: { type: String, default: "" }, // For bank reference, check number, etc.
    notes: { type: String, default: "" },
    processedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    // ShurjoPay specific fields
    spOrderId: { type: String, default: "" },
    bankTranId: { type: String, default: "" },
    cardType: { type: String, default: "" },
    currencyType: { type: String, default: "" },
    currencyAmount: { type: String, default: "" },
    validatedOn: { type: Date, default: null },
    bankStatus: { type: String, default: "" },
    spMessage: { type: String, default: "" },
    spCode: { type: String, default: "" },
    // SSLCommerz specific fields
    sslcTranId: { type: String, default: "" },
    sslcAmount: { type: String, default: "" },
    sslcCurrency: { type: String, default: "" },
    sslcStatus: { type: String, default: "" },
    sslcCardType: { type: String, default: "" },
    sslcCardNo: { type: String, default: "" },
    sslcBankTranId: { type: String, default: "" },
    sslcError: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", PaymentSchema);
