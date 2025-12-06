import InventoryPurchase from "./inventory.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import Gift from "../gift/gift.model.js";
import Waste from "../waste/waste.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

export const createPurchase = async (req, res) => {
  try {
    const {
      purchaseId,
      product,
      productName,
      sku = "",
      date,
      quantity,
      unitPrice,
      transportCost = 0,
      otherCost = 0,
      note = "",
      source = "",
      collectedBy = {},
    } = req.body;

    if (!purchaseId || !product || !productName || !date || !quantity || !unitPrice) {
      return res.status(400).json({ message: "purchaseId, product, productName, date, quantity, unitPrice are required" });
    }

    const qty = parseNumber(quantity, -1);
    const price = parseNumber(unitPrice, -1);
    if (qty <= 0 || price < 0) {
      return res.status(400).json({ message: "Invalid quantity or unitPrice" });
    }

    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalPrice = qty * price;

    const purchase = await InventoryPurchase.create({
      purchaseId,
      product,
      productName,
      sku,
      date,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      transportCost: parseNumber(transportCost, 0),
      otherCost: parseNumber(otherCost, 0),
      note,
      source,
      collectedBy: {
        name: collectedBy?.name || "",
        email: collectedBy?.email || "",
        phone: collectedBy?.phone || "",
      },
      addedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    res.status(201).json({ message: "Purchase recorded", purchase });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getPurchases = async (_req, res) => {
  try {
    const purchases = await InventoryPurchase.find().sort({ date: -1 });
    res.status(200).json({ purchases });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Stock summary combining purchases, orders, gifts, and waste
export const getStockSummary = async (_req, res) => {
  try {
    const [
      purchasesAgg,
      salesAgg,
      giftsAgg,
      wasteAgg,
      products,
    ] = await Promise.all([
      InventoryPurchase.aggregate([
        {
          $group: {
            _id: "$product",
            productName: { $last: "$productName" },
            sku: { $last: "$sku" },
            purchaseQty: { $sum: "$quantity" },
            purchaseCost: {
              $sum: {
                $add: [
                  { $multiply: ["$unitPrice", "$quantity"] },
                  "$transportCost",
                  "$otherCost",
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            salesQty: { $sum: "$items.qty" },
          },
        },
      ]),
      Gift.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            giftQty: { $sum: "$items.qty" },
          },
        },
      ]),
      Waste.aggregate([
        {
          $group: {
            _id: "$product",
            wasteQty: { $sum: "$qty" },
          },
        },
      ]),
      Product.find({}, "_id name sku"),
    ]);

    const summaryMap = new Map();

    const ensureEntry = (id) => {
      const key = String(id);
      if (!summaryMap.has(key)) {
        const productDoc = products.find((p) => String(p._id) === key);
        summaryMap.set(key, {
          productId: key,
          productName: productDoc?.name || "",
          sku: productDoc?.sku || "",
          purchaseQty: 0,
          purchaseCost: 0,
          salesQty: 0,
          giftQty: 0,
          wasteQty: 0,
        });
      }
      return summaryMap.get(key);
    };

    purchasesAgg.forEach((p) => {
      const entry = ensureEntry(p._id);
      entry.purchaseQty = p.purchaseQty || 0;
      entry.purchaseCost = p.purchaseCost || 0;
      entry.productName = entry.productName || p.productName || "";
      entry.sku = entry.sku || p.sku || "";
    });

    salesAgg.forEach((s) => {
      const entry = ensureEntry(s._id);
      entry.salesQty = s.salesQty || 0;
    });

    giftsAgg.forEach((g) => {
      const entry = ensureEntry(g._id);
      entry.giftQty = g.giftQty || 0;
    });

    wasteAgg.forEach((w) => {
      const entry = ensureEntry(w._id);
      entry.wasteQty = w.wasteQty || 0;
    });

    const summary = Array.from(summaryMap.values()).map((s) => {
      const inStock = Math.max(
        0,
        (s.purchaseQty || 0) -
          (s.salesQty || 0) -
          (s.giftQty || 0) -
          (s.wasteQty || 0)
      );
      const avgUnitCost =
        s.purchaseQty && s.purchaseQty > 0
          ? (s.purchaseCost || 0) / s.purchaseQty
          : 0;
      const approxTotalCost = inStock * avgUnitCost;
      return {
        ...s,
        inStock,
        averageUnitPurchasePrice: Number(avgUnitCost.toFixed(2)),
        approximateStockValue: Number(approxTotalCost.toFixed(2)),
      };
    });

    res.status(200).json({ summary });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

