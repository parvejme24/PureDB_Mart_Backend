import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  bulkCreateExpenses
} from "./expense.controller.js";

const expenseRouter = express.Router();

// Expense CRUD operations
expenseRouter.post("/", protect, admin, createExpense);
expenseRouter.get("/", protect, admin, getExpenses);
expenseRouter.get("/:id", protect, admin, getExpenseById);
expenseRouter.put("/:id", protect, admin, updateExpense);
expenseRouter.delete("/:id", protect, admin, deleteExpense);

// Expense analytics and bulk operations
expenseRouter.get("/stats/analytics", protect, admin, getExpenseStats);
expenseRouter.post("/bulk", protect, admin, bulkCreateExpenses);

export default expenseRouter;

