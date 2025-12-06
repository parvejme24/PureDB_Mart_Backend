import express from "express";
import { protect, admin } from "../../middleware/authMiddleware.js";
import { createExpense, getExpenses } from "./expense.controller.js";

const expenseRouter = express.Router();

expenseRouter.post("/", protect, admin, createExpense);
expenseRouter.get("/", protect, admin, getExpenses);

export default expenseRouter;

