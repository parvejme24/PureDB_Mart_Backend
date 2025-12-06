import Expense from "./expense.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

export const createExpense = async (req, res) => {
  try {
    const { expenseId, date, name = "", purpose, amount, category = "", note = "" } = req.body;

    if (!expenseId || !date || !purpose || amount === undefined) {
      return res.status(400).json({ message: "expenseId, date, purpose, amount are required" });
    }

    const amt = parseNumber(amount, -1);
    if (amt <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const expense = await Expense.create({
      expenseId,
      date,
      name,
      purpose,
      amount: amt,
      category,
      note,
      recordedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    res.status(201).json({ message: "Expense recorded", expense });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getExpenses = async (_req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    res.status(200).json({ expenses, total });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

