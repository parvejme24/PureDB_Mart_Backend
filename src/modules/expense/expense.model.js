import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    expenseId: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    name: { type: String, default: "" }, // person involved
    purpose: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: "" },
    note: { type: String, default: "" },
    recordedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);

