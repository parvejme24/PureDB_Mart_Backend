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

const buildDateFilter = (startDate, endDate, year) => {
  if (startDate || endDate) {
    const filter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) filter.$lte = new Date(endDate);
    return filter;
  }
  if (year) {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
    return { $gte: start, $lt: end };
  }
  return null;
};

const getReturnedQuantity = async (purchaseRef, excludeReturnId = null) => {
  const match = { purchaseRef };
  if (excludeReturnId) {
    match._id = { $ne: excludeReturnId };
  }
  const agg = await PurchaseReturn.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return agg?.[0]?.total || 0;
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
    const { startDate, endDate, year, limit } = _req.query;
    const dateFilter = buildDateFilter(startDate, endDate, year);
    const query = {};
    if (dateFilter) query.date = dateFilter;

    const cursor = InventoryPurchase.find(query).sort({ date: -1 });
    if (limit) {
      const l = parseInt(limit, 10);
      if (Number.isFinite(l) && l > 0) cursor.limit(l);
    }

    const purchases = await cursor;
    res.status(200).json({ purchases });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      product,
      productName,
      sku,
      date,
      quantity,
      unitPrice,
      transportCost,
      otherCost,
      note,
      source,
      batchNumber,
      expiryDate,
      warehouse,
    } = req.body;

    const purchase = await InventoryPurchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const oldQty = purchase.quantity;
    const oldProduct = String(purchase.product);

    const existingReturnsQty = await getReturnedQuantity(purchase._id);

    // Do not allow changing product if returns already exist
    if (product && String(product) !== oldProduct && existingReturnsQty > 0) {
      return res.status(400).json({ message: "Cannot change product because returns exist for this purchase" });
    }

    if (product && String(product) !== oldProduct) {
      const newProductExists = await Product.findById(product);
      if (!newProductExists) {
        return res.status(404).json({ message: "New product not found" });
      }
    }

    const newQty = quantity !== undefined ? parseNumber(quantity, -1) : oldQty;
    if (newQty <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }
    if (newQty < existingReturnsQty) {
      return res.status(400).json({ message: "Quantity cannot be less than already returned quantity" });
    }

    const newUnitPrice = unitPrice !== undefined ? parseNumber(unitPrice, -1) : purchase.unitPrice;
    if (newUnitPrice < 0) {
      return res.status(400).json({ message: "unitPrice cannot be negative" });
    }

    // Adjust stock for quantity and product changes
    const qtyDiff = newQty - oldQty;

    // If product changed, move stock from old product to new product
    if (product && String(product) !== oldProduct) {
      const oldProductDoc = await Product.findById(oldProduct);
      if (!oldProductDoc || Number(oldProductDoc.stock || 0) < oldQty) {
        return res.status(400).json({ message: "Cannot move purchase: insufficient stock on old product" });
      }
      await Product.findByIdAndUpdate(oldProduct, { $inc: { stock: -oldQty } });
      await Product.findByIdAndUpdate(product, {
        $inc: { stock: newQty },
        $set: { purchasePrice: newUnitPrice },
      });
    } else if (qtyDiff !== 0) {
      // same product, adjust by diff; prevent negative stock
      const productDoc = await Product.findById(oldProduct);
      if (qtyDiff < 0 && Number(productDoc.stock || 0) < Math.abs(qtyDiff)) {
        return res.status(400).json({ message: "Cannot reduce quantity below current stock" });
      }
      await Product.findByIdAndUpdate(oldProduct, {
        $inc: { stock: qtyDiff },
        $set: { purchasePrice: newUnitPrice },
      });
    } else {
      await Product.findByIdAndUpdate(oldProduct, { $set: { purchasePrice: newUnitPrice } });
    }

    purchase.product = product || purchase.product;
    purchase.productName = productName || purchase.productName;
    if (sku !== undefined) purchase.sku = sku;
    if (date !== undefined) purchase.date = normalizeDate(date);
    purchase.quantity = newQty;
    purchase.unitPrice = newUnitPrice;
    purchase.totalPrice = newQty * newUnitPrice;
    if (transportCost !== undefined) purchase.transportCost = parseNumber(transportCost, 0);
    if (otherCost !== undefined) purchase.otherCost = parseNumber(otherCost, 0);
    if (note !== undefined) purchase.note = note;
    if (source !== undefined) purchase.source = source;
    if (batchNumber !== undefined) purchase.batchNumber = batchNumber;
    if (expiryDate !== undefined) purchase.expiryDate = expiryDate ? normalizeDate(expiryDate) : null;
    if (warehouse !== undefined) purchase.warehouse = warehouse;

    await purchase.save();

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

    const existingReturnsQty = await getReturnedQuantity(purchase._id);
    if (existingReturnsQty > 0) {
      return res.status(400).json({ message: "Cannot delete purchase with existing returns" });
    }

    // Ensure we have enough stock to remove
    const productDoc = await Product.findById(purchase.product);
    if (!productDoc || Number(productDoc.stock || 0) < purchase.quantity) {
      return res.status(400).json({ message: "Cannot delete: insufficient stock to reverse purchase" });
    }

    await InventoryPurchase.findByIdAndDelete(id);
    await Product.findByIdAndUpdate(purchase.product, {
      $inc: { stock: -purchase.quantity },
    });

    res.status(200).json({ message: "Purchase deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
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
    if (Number(productDoc.stock || 0) < qty) {
      return res.status(400).json({ message: "Not enough stock to record return" });
    }

    const alreadyReturned = await getReturnedQuantity(purchase._id);
    if (alreadyReturned + qty > purchase.quantity) {
      return res.status(400).json({ message: "Return quantity exceeds purchased quantity" });
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

export const updatePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason = "", note = "" } = req.body;

    const returnDoc = await PurchaseReturn.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: "Purchase return not found" });
    }

    const purchase = await InventoryPurchase.findById(returnDoc.purchaseRef);
    if (!purchase) {
      return res.status(404).json({ message: "Original purchase not found" });
    }

    const qty = quantity !== undefined ? parseNumber(quantity, -1) : returnDoc.quantity;
    if (qty <= 0) {
      return res.status(400).json({ message: "Return quantity must be greater than 0" });
    }

    const diff = qty - returnDoc.quantity; // positive means more return, reduce stock more
    const productDoc = await Product.findById(returnDoc.product);
    if (!productDoc) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (diff > 0 && Number(productDoc.stock || 0) < diff) {
      return res.status(400).json({ message: "Not enough stock to increase return quantity" });
    }

    const alreadyReturned = await getReturnedQuantity(purchase._id, returnDoc._id);
    if (alreadyReturned + qty > purchase.quantity) {
      return res.status(400).json({ message: "Return quantity exceeds purchased quantity" });
    }

    returnDoc.quantity = qty;
    returnDoc.reason = reason;
    returnDoc.note = note;
    returnDoc.processedBy = {
      userId: req.user?._id || returnDoc.processedBy?.userId || null,
      name: req.user?.name || returnDoc.processedBy?.name || "",
      email: req.user?.email || returnDoc.processedBy?.email || "",
    };
    await returnDoc.save();

    if (diff !== 0) {
      await Product.findByIdAndUpdate(returnDoc.product, {
        $inc: { stock: -diff },
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

    await PurchaseReturn.findByIdAndDelete(id);

    // Undo the stock deduction from this return
    await Product.findByIdAndUpdate(returnDoc.product, {
      $inc: { stock: returnDoc.quantity },
    });

    res.status(200).json({ message: "Purchase return deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getPurchaseReturns = async (_req, res) => {
  try {
    const { startDate, endDate, year, limit } = _req.query;
    const dateFilter = buildDateFilter(startDate, endDate, year);
    const query = {};
    if (dateFilter) query.date = dateFilter;

    const cursor = PurchaseReturn.find(query).sort({ date: -1 });
    if (limit) {
      const l = parseInt(limit, 10);
      if (Number.isFinite(l) && l > 0) cursor.limit(l);
    }

    const returns = await cursor;
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

export const updateLowStockConfig = async (req, res) => {
  try {
    const { productId } = req.params;
    const { reorderPoint, minStockLevel, expiryWarningDays, expiryTracking } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (reorderPoint !== undefined) {
      const rp = parseNumber(reorderPoint, 0);
      product.reorderPoint = rp;
    }
    if (minStockLevel !== undefined) {
      const min = parseNumber(minStockLevel, 0);
      product.minStockLevel = min;
    }
    if (expiryWarningDays !== undefined) {
      const warn = parseNumber(expiryWarningDays, 0);
      product.expiryWarningDays = warn;
    }
    if (expiryTracking !== undefined) {
      product.expiryTracking = Boolean(expiryTracking);
    }

    await product.save();

    res.status(200).json({ message: "Low stock / expiry config updated", product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getExpiryAlerts = async (req, res) => {
  try {
    const { windowDays, startDate, endDate, year, limit = 200 } = req.query;
    const now = new Date();
    const dateFilter = buildDateFilter(startDate, endDate, year);

    let match = { expiryDate: { $ne: null } };
    if (dateFilter) {
      match.expiryDate = { ...match.expiryDate, ...dateFilter };
    } else {
      const wd = parseNumber(windowDays, 30);
      const limitDate = new Date();
      limitDate.setDate(now.getDate() + wd);
      match.expiryDate = { ...match.expiryDate, $lte: limitDate };
    }

    const cap = parseInt(limit, 10);
    const capped = Number.isFinite(cap) && cap > 0 ? cap : 200;

    const expiring = await InventoryPurchase.find(match)
      .sort({ expiryDate: 1 })
      .limit(capped);

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

export const getRecentPurchases = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const l = parseInt(limit, 10);
    const capped = Number.isFinite(l) && l > 0 ? l : 10;
    const purchases = await InventoryPurchase.find().sort({ createdAt: -1 }).limit(capped);
    res.status(200).json({ purchases });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

