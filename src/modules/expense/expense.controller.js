import Expense from "./expense.model.js";
import User from "../auth/auth.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

const generateExpenseId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${Date.now()}-${random}`;
};

// Create expense record
export const createExpense = async (req, res) => {
  try {
    const {
      expenseId,
      date,
      involvedPerson,
      purpose,
      amount,
      note = "",
    } = req.body;

    if (!date || !purpose || !amount) {
      return res.status(400).json({
        message: "date, purpose, and amount are required"
      });
    }

    // Validate involved persons
    if (involvedPerson && Array.isArray(involvedPerson)) {
      for (const person of involvedPerson) {
        if (!person.userId || !person.name || !person.email) {
          return res.status(400).json({
            message: "Each involved person must have userId, name, and email"
          });
        }

        const userExists = await User.findById(person.userId);
        if (!userExists) {
          return res.status(404).json({
            message: `User not found: ${person.name}`
          });
        }
      }
    }

    const expenseAmount = parseNumber(amount, -1);
    if (expenseAmount <= 0) {
      return res.status(400).json({ message: "Expense amount must be greater than 0" });
    }

    const expense = await Expense.create({
      expenseId: expenseId || generateExpenseId(),
      date: new Date(date),
      involvedPerson: involvedPerson || [],
      purpose,
      amount: expenseAmount,
      note,
    });

    res.status(201).json({
      message: "Expense recorded successfully",
      expense
    });
  } catch (error) {
    console.log("Create expense error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get expenses with filtering
export const getExpenses = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      year,
      purpose,
      involvedPerson,
      minAmount,
      maxAmount,
      limit = 50,
      page = 1
    } = req.query;

    let filter = {};

    // Date filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    } else if (year) {
      const startYear = new Date(`${year}-01-01`);
      const endYear = new Date(`${year}-12-31`);
      filter.date = { $gte: startYear, $lte: endYear };
    }

    // Purpose filtering
    if (purpose) {
      filter.purpose = new RegExp(purpose, 'i');
    }

    // Involved person filtering
    if (involvedPerson) {
      filter["involvedPerson.userId"] = involvedPerson;
    }

    // Amount filtering
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseNumber(minAmount);
      if (maxAmount) filter.amount.$lte = parseNumber(maxAmount);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [expenses, totalCount] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('involvedPerson.userId', 'name email'),
      Expense.countDocuments(filter)
    ]);

    // Calculate totals
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    res.status(200).json({
      expenses,
      summary: {
        totalRecords: totalCount,
        totalAmount,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        limit: parseInt(limit)
      },
      filters: {
        startDate,
        endDate,
        year,
        purpose,
        involvedPerson,
        minAmount,
        maxAmount
      }
    });
  } catch (error) {
    console.log("Get expenses error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get expense by ID
export const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id)
      .populate('involvedPerson.userId', 'name email');

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.status(200).json({ expense });
  } catch (error) {
    console.log("Get expense by ID error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update expense
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const allowedUpdates = [
      'date', 'purpose', 'amount', 'note'
    ];

    // Update basic fields
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'date') {
          expense[field] = updates[field] ? new Date(updates[field]) : expense[field];
        } else if (field === 'amount') {
          const amount = parseNumber(updates[field], expense[field]);
          if (amount <= 0) {
            throw new Error("Expense amount must be greater than 0");
          }
          expense[field] = amount;
        } else {
          expense[field] = updates[field];
        }
      }
    });

    // Update involved persons if provided
    if (updates.involvedPerson !== undefined) {
      if (!Array.isArray(updates.involvedPerson)) {
        return res.status(400).json({ message: "involvedPerson must be an array" });
      }

      // Validate each person
      for (const person of updates.involvedPerson) {
        if (!person.userId || !person.name || !person.email) {
          return res.status(400).json({
            message: "Each involved person must have userId, name, and email"
          });
        }

        const userExists = await User.findById(person.userId);
        if (!userExists) {
          return res.status(404).json({
            message: `User not found: ${person.name}`
          });
        }
      }

      expense.involvedPerson = updates.involvedPerson;
    }

    await expense.save();

    res.status(200).json({
      message: "Expense updated successfully",
      expense
    });
  } catch (error) {
    console.log("Update expense error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete expense
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.status(200).json({
      message: "Expense deleted successfully",
      deletedAmount: expense.amount
    });
  } catch (error) {
    console.log("Delete expense error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get expense statistics
export const getExpenseStats = async (req, res) => {
  try {
    const { startDate, endDate, year } = req.query;

    let dateFilter = {};

    // Date filtering
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    } else if (year) {
      const startYear = new Date(`${year}-01-01`);
      const endYear = new Date(`${year}-12-31`);
      dateFilter.date = { $gte: startYear, $lte: endYear };
    }

    const [
      totalExpenses,
      expensesByPurpose,
      expensesByMonth,
      expensesByPerson
    ] = await Promise.all([
      // Total expenses
      Expense.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
            averageAmount: { $avg: "$amount" }
          }
        }
      ]),

      // Expenses by purpose
      Expense.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$purpose",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]),

      // Monthly expense trend
      Expense.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } }
      ]),

      // Expenses by person
      Expense.aggregate([
        { $match: dateFilter },
        { $unwind: "$involvedPerson" },
        {
          $lookup: {
            from: "users",
            localField: "involvedPerson.userId",
            foreignField: "_id",
            as: "personInfo"
          }
        },
        { $unwind: "$personInfo" },
        {
          $group: {
            _id: "$involvedPerson.userId",
            personName: { $first: "$personInfo.name" },
            personEmail: { $first: "$personInfo.email" },
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.status(200).json({
      summary: totalExpenses[0] || {
        totalAmount: 0,
        totalRecords: 0,
        averageAmount: 0
      },
      expensesByPurpose,
      monthlyTrend: expensesByMonth,
      expensesByPerson,
      period: {
        startDate,
        endDate,
        year
      }
    });
  } catch (error) {
    console.log("Get expense stats error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Bulk create expenses
export const bulkCreateExpenses = async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ message: "expenses array is required" });
    }

    const validExpenses = [];
    const errors = [];

    // Validate each expense
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      const { expenseId, date, purpose, amount, involvedPerson, note } = expense;

      if (!date || !purpose || !amount) {
        errors.push({ index: i, error: "date, purpose, and amount are required" });
        continue;
      }

      const expenseAmount = parseNumber(amount, -1);
      if (expenseAmount <= 0) {
        errors.push({ index: i, error: "Expense amount must be greater than 0" });
        continue;
      }

      // Validate involved persons
      let validPersons = [];
      if (involvedPerson && Array.isArray(involvedPerson)) {
        for (const person of involvedPerson) {
          if (!person.userId || !person.name || !person.email) {
            errors.push({ index: i, error: "Each involved person must have userId, name, and email" });
            continue;
          }

          const userExists = await User.findById(person.userId);
          if (!userExists) {
            errors.push({ index: i, error: `User not found: ${person.name}` });
            continue;
          }

          validPersons.push(person);
        }
      }

      validExpenses.push({
        expenseId: expenseId || generateExpenseId(),
        date: new Date(date),
        involvedPerson: validPersons,
        purpose,
        amount: expenseAmount,
        note: note || "",
      });
    }

    if (validExpenses.length === 0) {
      return res.status(400).json({
        message: "No valid expenses to process",
        errors
      });
    }

    // Create expenses
    const createdExpenses = await Expense.insertMany(validExpenses);

    res.status(201).json({
      message: `Successfully created ${createdExpenses.length} expense records`,
      created: createdExpenses.length,
      totalAmount: createdExpenses.reduce((sum, exp) => sum + exp.amount, 0),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.log("Bulk create expenses error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
