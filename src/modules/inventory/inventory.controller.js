import { InventoryPurchase, PurchaseReturn } from "./inventory.model.js";
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
    const computedPurchaseId = purchaseId || generatePurchaseId();
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

export const getPurchases = async (req, res) => {
  try {
    const { startDate, endDate, year, limit = 50 } = req.query;

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

    const purchases = await InventoryPurchase.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ purchases });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getRecentPurchases = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const purchases = await InventoryPurchase.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ purchases });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const purchase = await InventoryPurchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Check if returns exist for this purchase
    const hasReturns = await PurchaseReturn.findOne({ purchaseRef: id });
    if (hasReturns && (updates.product || updates.quantity)) {
      return res.status(400).json({ message: "Cannot update product or quantity when returns exist" });
    }

    // Calculate stock adjustment if quantity changed
    let stockAdjustment = 0;
    if (updates.quantity !== undefined && updates.quantity !== purchase.quantity) {
      const newQty = parseNumber(updates.quantity, purchase.quantity);
      if (newQty < 0) {
        return res.status(400).json({ message: "Quantity cannot be negative" });
      }

      // Check if reducing quantity below returned amounts
      if (hasReturns) {
        const totalReturned = await PurchaseReturn.aggregate([
          { $match: { purchaseRef: purchase._id } },
          { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]);
        const returnedQty = totalReturned[0]?.total || 0;
        if (newQty < returnedQty) {
          return res.status(400).json({ message: "Cannot reduce quantity below returned amounts" });
        }
      }

      stockAdjustment = newQty - purchase.quantity;
    }

    // Update purchase fields
    const allowedUpdates = [
      'productName', 'sku', 'date', 'quantity', 'unitPrice',
      'transportCost', 'otherCost', 'note', 'source', 'batchNumber',
      'expiryDate', 'warehouse', 'collectedBy'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'date' || field === 'expiryDate') {
          purchase[field] = updates[field] ? normalizeDate(updates[field]) : null;
        } else if (field === 'quantity' || field === 'unitPrice' || field === 'transportCost' || field === 'otherCost') {
          purchase[field] = parseNumber(updates[field], purchase[field]);
        } else {
          purchase[field] = updates[field];
        }
      }
    });

    // Recalculate total price
    purchase.totalPrice = purchase.quantity * purchase.unitPrice;

    await purchase.save();

    // Update product stock if quantity changed
    if (stockAdjustment !== 0) {
      await Product.findByIdAndUpdate(purchase.product, {
        $inc: { stock: stockAdjustment }
      });
    }

    res.status(200).json({ message: "Purchase updated", purchase });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await InventoryPurchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Check if returns exist
    const hasReturns = await PurchaseReturn.findOne({ purchaseRef: id });
    if (hasReturns) {
      return res.status(400).json({ message: "Cannot delete purchase with existing returns" });
    }

    // Reverse stock adjustment
    await Product.findByIdAndUpdate(purchase.product, {
      $inc: { stock: -purchase.quantity }
    });

    await purchase.deleteOne();

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Stock summary combining purchases, orders, gifts, and waste
export const getStockSummary = async (req, res) => {
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

    // Check total already returned for this purchase
    const totalReturned = await PurchaseReturn.aggregate([
      { $match: { purchaseRef: purchase._id } },
      { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]);
    const alreadyReturned = totalReturned[0]?.total || 0;

    if (alreadyReturned + qty > purchase.quantity) {
      return res.status(400).json({
        message: `Cannot return more than purchased. Already returned: ${alreadyReturned}, Purchased: ${purchase.quantity}`
      });
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

export const getPurchaseReturns = async (req, res) => {
  try {
    const { startDate, endDate, year, limit = 50 } = req.query;

    let filter = {};

    // Date filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    } else if (year) {
      const startYear = new Date(`${year}-01-01`);
      const endYear = new Date(`${year}-12-31`);
      filter.createdAt = { $gte: startYear, $lte: endYear };
    }

    const returns = await PurchaseReturn.find(filter)
      .populate('purchaseRef', 'purchaseId date')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ returns });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const updatePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason, note } = req.body;

    const returnDoc = await PurchaseReturn.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: "Purchase return not found" });
    }

    const purchase = await InventoryPurchase.findById(returnDoc.purchaseRef);
    if (!purchase) {
      return res.status(404).json({ message: "Associated purchase not found" });
    }

    // Calculate new quantity
    const newQty = quantity !== undefined ? parseNumber(quantity, returnDoc.quantity) : returnDoc.quantity;
    if (newQty <= 0) {
      return res.status(400).json({ message: "Return quantity must be greater than 0" });
    }

    // Check total returned doesn't exceed purchase quantity
    const totalReturned = await PurchaseReturn.aggregate([
      { $match: { purchaseRef: purchase._id, _id: { $ne: returnDoc._id } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]);
    const alreadyReturned = totalReturned[0]?.total || 0;

    if (alreadyReturned + newQty > purchase.quantity) {
      return res.status(400).json({
        message: `Cannot return more than purchased. Already returned: ${alreadyReturned}, Purchased: ${purchase.quantity}`
      });
    }

    // Calculate stock adjustment
    const qtyDiff = newQty - returnDoc.quantity;

    // Check if we have enough stock for increase
    if (qtyDiff > 0) {
      const productDoc = await Product.findById(purchase.product);
      if (!productDoc || productDoc.stock < qtyDiff) {
        return res.status(400).json({ message: "Not enough stock to increase return quantity" });
      }
    }

    // Update return record
    returnDoc.quantity = newQty;
    if (reason !== undefined) returnDoc.reason = reason;
    if (note !== undefined) returnDoc.note = note;

    await returnDoc.save();

    // Adjust stock
    if (qtyDiff !== 0) {
      await Product.findByIdAndUpdate(purchase.product, {
        $inc: { stock: -qtyDiff }
      });
    }

    res.status(200).json({ message: "Purchase return updated", return: returnDoc });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const deletePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const returnDoc = await PurchaseReturn.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: "Purchase return not found" });
    }

    // Restore stock
    await Product.findByIdAndUpdate(returnDoc.product, {
      $inc: { stock: returnDoc.quantity }
    });

    await returnDoc.deleteOne();

    res.status(200).json({ message: "Purchase return deleted successfully" });
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
    const limit = parseInt(req.query.limit) || 200;

    // Date filtering
    const { startDate, endDate, year } = req.query;
    let dateFilter = {};

    if (startDate || endDate) {
      dateFilter.expiryDate = {};
      if (startDate) dateFilter.expiryDate.$gte = new Date(startDate);
      if (endDate) dateFilter.expiryDate.$lte = new Date(endDate);
    } else if (year) {
      const startYear = new Date(`${year}-01-01`);
      const endYear = new Date(`${year}-12-31`);
      dateFilter.expiryDate = { $gte: startYear, $lte: endYear };
    } else {
      // Default to expiring within windowDays
      const now = new Date();
      const limit = new Date();
      limit.setDate(now.getDate() + windowDays);
      dateFilter.expiryDate = { $ne: null, $lte: limit };
    }

    const expiring = await InventoryPurchase.find(dateFilter)
      .sort({ expiryDate: 1 })
      .limit(limit);

    const alerts = expiring.map((p) => {
      const daysLeft = p.expiryDate ? Math.ceil((p.expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
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
