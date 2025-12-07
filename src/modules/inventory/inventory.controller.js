import InventoryPurchase from "./inventory.model.js";
import PurchaseReturn from "./purchaseReturn.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import Gift from "../gift/gift.model.js";
import Waste from "../waste/waste.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

const generatePurchaseId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PUR-${Date.now()}-${random}`;
};

const normalizeDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const createPurchase = async (req, res) => {
  try {
    const {
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
      batchNumber = "",
      expiryDate = null,
      warehouse = "main",
    } = req.body;

    if (!product || !productName || !quantity || !unitPrice) {
      return res.status(400).json({ message: "product, productName, quantity, unitPrice are required" });
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
    const computedPurchaseId = generatePurchaseId();
    const purchaseDate = normalizeDate(date);

    const purchase = await InventoryPurchase.create({
      purchaseId: computedPurchaseId,
      product,
      productName,
      sku,
      date: purchaseDate,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      transportCost: parseNumber(transportCost, 0),
      otherCost: parseNumber(otherCost, 0),
      note,
      source,
      batchNumber,
      expiryDate: expiryDate ? normalizeDate(expiryDate) : null,
      warehouse,
      collectedBy: {
        name: collectedBy?.name || req.user?.name || "",
        email: collectedBy?.email || req.user?.email || "",
        phone: collectedBy?.phone || req.user?.phone || "",
      },
      addedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    // Increase on-hand stock and keep latest purchase price
    await Product.findByIdAndUpdate(product, {
      $inc: { stock: qty },
      $set: {
        purchasePrice: price,
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
      purchaseReturnsAgg,
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
      PurchaseReturn.aggregate([
        {
          $group: {
            _id: "$product",
            returnQty: { $sum: "$quantity" },
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

    purchaseReturnsAgg.forEach((r) => {
      const entry = ensureEntry(r._id);
      entry.purchaseQty -= r.returnQty || 0;
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

export const createPurchaseReturn = async (req, res) => {
  try {
    const { purchaseId, purchaseRecordId, quantity, reason = "", note = "" } = req.body;

    if (!purchaseId && !purchaseRecordId) {
      return res.status(400).json({ message: "purchaseId or purchaseRecordId is required" });
    }

    const qty = parseNumber(quantity, -1);
    if (qty <= 0) {
      return res.status(400).json({ message: "Return quantity must be greater than 0" });
    }

    const purchase =
      (purchaseId && (await InventoryPurchase.findOne({ purchaseId }))) ||
      (purchaseRecordId && (await InventoryPurchase.findById(purchaseRecordId)));

    if (!purchase) {
      return res.status(404).json({ message: "Purchase record not found" });
    }

    const productDoc = await Product.findById(purchase.product);
    if (!productDoc) {
      return res.status(404).json({ message: "Product not found" });
    }

    const returnDoc = await PurchaseReturn.create({
      purchaseId: purchase.purchaseId,
      purchaseRef: purchase._id,
      product: purchase.product,
      productName: purchase.productName,
      sku: purchase.sku,
      quantity: qty,
      reason,
      note,
      processedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    });

    // Decrease stock to reflect returned items
    await Product.findByIdAndUpdate(purchase.product, {
      $inc: { stock: -qty },
    });

    res.status(201).json({ message: "Purchase return recorded", return: returnDoc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getPurchaseReturns = async (_req, res) => {
  try {
    const returns = await PurchaseReturn.find().sort({ date: -1 });
    res.status(200).json({ returns });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find(
      {},
      "name sku stock reorderPoint minStockLevel expiryTracking expiryWarningDays unit brand"
    ).sort({ stock: 1 });

    const lowStock = products.filter((p) => {
      const threshold = Number(p.reorderPoint || p.minStockLevel || 0);
      return threshold > 0 && Number(p.stock || 0) <= threshold;
    });

    res.status(200).json({
      count: lowStock.length,
      products: lowStock,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getExpiryAlerts = async (req, res) => {
  try {
    const windowDays = parseNumber(req.query.windowDays, 30);
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + windowDays);

    const expiring = await InventoryPurchase.find({
      expiryDate: { $ne: null, $lte: limit },
    })
      .sort({ expiryDate: 1 })
      .limit(200);

    const alerts = expiring.map((p) => {
      const daysLeft = Math.ceil((p.expiryDate - now) / (1000 * 60 * 60 * 24));
      return {
        id: p._id,
        product: p.product,
        productName: p.productName,
        sku: p.sku,
        batchNumber: p.batchNumber,
        expiryDate: p.expiryDate,
        daysLeft,
        warehouse: p.warehouse,
        quantity: p.quantity,
      };
    });

    res.status(200).json({ count: alerts.length, alerts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

