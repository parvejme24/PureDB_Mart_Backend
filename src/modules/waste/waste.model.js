import mongoose from "mongoose";

const WasteSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    wasteQty: { type: Number, required: true },
    reason: { type: String, default: "" },
    date: { type: Date, required: true },
    note: { type: String, default: "" },
    recordedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Waste", WasteSchema);

