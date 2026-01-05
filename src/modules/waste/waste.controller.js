import Waste from "./waste.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

// Create waste entry and reduce product stock
export const createWaste = async (req, res) => {
  try {
    const { product, wasteQty, reason = "", date, note = "" } = req.body;

    if (!product || !wasteQty || !date) {
      return res.status(400).json({
        message: "product, wasteQty, and date are required"
      });
    }

    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const qty = parseNumber(wasteQty, -1);
    if (qty <= 0) {
      return res.status(400).json({ message: "Waste quantity must be greater than 0" });
    }

    // Check if there's enough stock to waste
    if (Number(productExists.stock || 0) < qty) {
      return res.status(400).json({
        message: "Not enough stock to mark as waste",
        availableStock: productExists.stock,
        requestedWaste: qty
      });
    }

    const waste = await Waste.create({
      product,
      wasteQty: qty,
      reason,
      date: new Date(date),
      note,
      recordedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || req.body.recordedByName || "",
        email: req.user?.email || req.body.recordedByEmail || "",
      },
    });

    // Reduce product stock
    await Product.findByIdAndUpdate(product, {
      $inc: { stock: -qty },
    });

    res.status(201).json({
      message: "Waste recorded successfully",
      waste
    });
  } catch (error) {
    console.log("Create waste error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get waste records with filtering
export const getWaste = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      year,
      product,
      reason,
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

    // Product filtering
    if (product) filter.product = product;

    // Reason filtering
    if (reason) filter.reason = new RegExp(reason, 'i');

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [wasteRecords, totalCount] = await Promise.all([
      Waste.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('product', 'name sku'),
      Waste.countDocuments(filter)
    ]);

    // Calculate totals
    const totalWasteQty = wasteRecords.reduce((sum, record) => sum + record.wasteQty, 0);

    res.status(200).json({
      waste: wasteRecords,
      summary: {
        totalRecords: totalCount,
        totalWasteQty,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        limit: parseInt(limit)
      },
      filters: {
        startDate,
        endDate,
        year,
        product,
        reason
      }
    });
  } catch (error) {
    console.log("Get waste error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update waste record
export const updateWaste = async (req, res) => {
  try {
    const { id } = req.params;
    const { wasteQty, reason, date, note } = req.body;

    const waste = await Waste.findById(id);
    if (!waste) {
      return res.status(404).json({ message: "Waste record not found" });
    }

    const oldQty = waste.wasteQty;
    const newQty = wasteQty !== undefined ? parseNumber(wasteQty, oldQty) : oldQty;

    if (newQty <= 0) {
      return res.status(400).json({ message: "Waste quantity must be greater than 0" });
    }

    // Calculate stock adjustment
    const qtyDifference = newQty - oldQty;

    // If increasing waste, check if there's enough stock
    if (qtyDifference > 0) {
      const product = await Product.findById(waste.product);
      if (!product || Number(product.stock || 0) < qtyDifference) {
        return res.status(400).json({
          message: "Not enough stock to increase waste quantity",
          availableStock: product?.stock || 0,
          requestedIncrease: qtyDifference
        });
      }
    }

    // Update waste record
    waste.wasteQty = newQty;
    if (reason !== undefined) waste.reason = reason;
    if (date !== undefined) waste.date = new Date(date);
    if (note !== undefined) waste.note = note;

    await waste.save();

    // Adjust product stock
    if (qtyDifference !== 0) {
      await Product.findByIdAndUpdate(waste.product, {
        $inc: { stock: -qtyDifference }
      });
    }

    res.status(200).json({
      message: "Waste record updated successfully",
      waste
    });
  } catch (error) {
    console.log("Update waste error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete waste record and restore product stock
export const deleteWaste = async (req, res) => {
  try {
    const { id } = req.params;

    const waste = await Waste.findById(id);
    if (!waste) {
      return res.status(404).json({ message: "Waste record not found" });
    }

    // Restore product stock
    await Product.findByIdAndUpdate(waste.product, {
      $inc: { stock: waste.wasteQty }
    });

    await waste.deleteOne();

    res.status(200).json({
      message: "Waste record deleted and stock restored",
      restoredQty: waste.wasteQty
    });
  } catch (error) {
    console.log("Delete waste error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get waste statistics
export const getWasteStats = async (req, res) => {
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
      totalWaste,
      wasteByReason,
      wasteByProduct,
      monthlyWaste
    ] = await Promise.all([
      // Total waste quantity and value
      Waste.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: null,
            totalQty: { $sum: "$wasteQty" },
            totalValue: {
              $sum: { $multiply: ["$wasteQty", "$productInfo.purchasePrice"] }
            },
            totalRecords: { $sum: 1 }
          }
        }
      ]),

      // Waste by reason
      Waste.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$reason",
            qty: { $sum: "$wasteQty" },
            count: { $sum: 1 }
          }
        },
        { $sort: { qty: -1 } }
      ]),

      // Top wasted products
      Waste.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$product",
            productName: { $first: "$productInfo.name" },
            sku: { $first: "$productInfo.sku" },
            totalQty: { $sum: "$wasteQty" },
            totalValue: {
              $sum: { $multiply: ["$wasteQty", "$productInfo.purchasePrice"] }
            },
            records: { $sum: 1 }
          }
        },
        { $sort: { totalQty: -1 } },
        { $limit: 10 }
      ]),

      // Monthly waste trend (last 12 months)
      Waste.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            qty: { $sum: "$wasteQty" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { "_id.year": -1, "_id.month": -1 }
        },
        { $limit: 12 }
      ])
    ]);

    res.status(200).json({
      summary: totalWaste[0] || {
        totalQty: 0,
        totalValue: 0,
        totalRecords: 0
      },
      wasteByReason,
      topWastedProducts: wasteByProduct,
      monthlyTrend: monthlyWaste,
      period: {
        startDate,
        endDate,
        year
      }
    });
  } catch (error) {
    console.log("Get waste stats error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Bulk create waste records
export const bulkCreateWaste = async (req, res) => {
  try {
    const { wasteRecords } = req.body;

    if (!Array.isArray(wasteRecords) || wasteRecords.length === 0) {
      return res.status(400).json({ message: "wasteRecords array is required" });
    }

    const validRecords = [];
    const errors = [];

    // Validate each record
    for (let i = 0; i < wasteRecords.length; i++) {
      const record = wasteRecords[i];
      const { product, wasteQty, reason, date, note } = record;

      if (!product || !wasteQty || !date) {
        errors.push({ index: i, error: "product, wasteQty, and date are required" });
        continue;
      }

      const productExists = await Product.findById(product);
      if (!productExists) {
        errors.push({ index: i, error: "Product not found" });
        continue;
      }

      const qty = parseNumber(wasteQty, -1);
      if (qty <= 0) {
        errors.push({ index: i, error: "Waste quantity must be greater than 0" });
        continue;
      }

      if (Number(productExists.stock || 0) < qty) {
        errors.push({ index: i, error: "Not enough stock for waste" });
        continue;
      }

      validRecords.push({
        product,
        wasteQty: qty,
        reason: reason || "",
        date: new Date(date),
        note: note || "",
        recordedBy: {
          userId: req.user?._id || null,
          name: req.user?.name || "",
          email: req.user?.email || "",
        }
      });
    }

    if (validRecords.length === 0) {
      return res.status(400).json({
        message: "No valid waste records to process",
        errors
      });
    }

    // Create waste records
    const createdWaste = await Waste.insertMany(validRecords);

    // Update product stocks
    const stockUpdates = validRecords.reduce((acc, record) => {
      acc[record.product] = (acc[record.product] || 0) + record.wasteQty;
      return acc;
    }, {});

    const updatePromises = Object.entries(stockUpdates).map(([productId, qty]) =>
      Product.findByIdAndUpdate(productId, { $inc: { stock: -qty } })
    );

    await Promise.all(updatePromises);

    res.status(201).json({
      message: `Successfully created ${createdWaste.length} waste records`,
      created: createdWaste.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.log("Bulk create waste error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
