import Waste from "./waste.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

export const createWaste = async (req, res) => {
  try {
    const { product, productName, sku = "", qty, reason = "", date, note = "" } = req.body;

    if (!product || !productName || !date || qty === undefined) {
      return res.status(400).json({ message: "product, productName, qty, date are required" });
    }

    const productExists = await Product.findById(product);
    if (!productExists) return res.status(404).json({ message: "Product not found" });

    const quantity = parseNumber(qty, -1);
    if (quantity <= 0) return res.status(400).json({ message: "qty must be greater than 0" });
    if (Number(productExists.stock || 0) < quantity) {
      return res.status(400).json({ message: "Not enough stock to mark as waste" });
    }

    const waste = await Waste.create({
      product,
      productName,
      sku,
      qty: quantity,
      reason,
      date,
      note,
      recordedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    await Product.findByIdAndUpdate(product, {
      $inc: { stock: -quantity },
    });

    res.status(201).json({ message: "Waste recorded", waste });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getWaste = async (_req, res) => {
  try {
    const waste = await Waste.find().sort({ date: -1 });
    res.status(200).json({ waste });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

