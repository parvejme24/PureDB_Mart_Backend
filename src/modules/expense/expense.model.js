import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    expenseId: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    involvedPerson: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: { type: String, required: true },
        email: { type: String, required: true },
      },
    ],
    purpose: { type: String, required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);
