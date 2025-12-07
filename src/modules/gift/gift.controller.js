import Gift from "./gift.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

export const createGift = async (req, res) => {
  try {
    const {
      giftId,
      date,
      recipientName,
      recipientPhone = "",
      recipientAddress = "",
      shippingAddress = "",
      items,
      note = "",
    } = req.body;

    if (!giftId || !date || !recipientName || !items || !items.length) {
      return res.status(400).json({ message: "giftId, date, recipientName, items are required" });
    }

    // Validate products exist and normalize items
    const normalizedItems = [];
    for (const item of items) {
      const { product, productName, sku = "", qty, unitPrice = 0 } = item;
      if (!product || !productName || qty === undefined) {
        return res.status(400).json({ message: "Each item requires product, productName, qty" });
      }
      const productExists = await Product.findById(product);
      if (!productExists) {
        return res.status(404).json({ message: `Product not found: ${product}` });
      }
      const quantity = parseNumber(qty, -1);
      if (quantity <= 0) {
        return res.status(400).json({ message: "Item quantity must be greater than 0" });
      }
      if (Number(productExists.stock || 0) < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${productExists.name || product}` });
      }
      const unit = parseNumber(unitPrice, 0);
      normalizedItems.push({
        product,
        productName,
        sku,
        qty: quantity,
        unitPrice: unit,
        totalPrice: quantity * unit,
      });
    }

    const gift = await Gift.create({
      giftId,
      date,
      recipientName,
      recipientPhone,
      recipientAddress,
      shippingAddress,
      items: normalizedItems,
      note,
      giver: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    // Reduce stock for gifted items
    const updatePromises = normalizedItems.map((item) =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty },
      })
    );
    await Promise.all(updatePromises);

    res.status(201).json({ message: "Gift recorded", gift });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getGifts = async (_req, res) => {
  try {
    const gifts = await Gift.find().sort({ date: -1 });
    res.status(200).json({ gifts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

