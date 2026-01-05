import Gift from "./gift.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

const generateGiftId = () => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `GIFT-${Date.now()}-${random}`;
};

// Create gift record and reduce product stock
export const createGift = async (req, res) => {
  try {
    const {
      giftId,
      date,
      recipientName,
      recipientPhone,
      recipientEmailAddress = "",
      shippingAddress = "",
      items,
      note = "",
    } = req.body;

    if (!date || !recipientName || !recipientPhone || !items || !items.length) {
      return res.status(400).json({
        message: "date, recipientName, recipientPhone, and items are required"
      });
    }

    // Validate and prepare items
    const processedItems = [];
    for (const item of items) {
      const { product, productName, giftQty } = item;

      if (!product || !productName || giftQty === undefined) {
        return res.status(400).json({
          message: "Each item must have product, productName, and giftQty"
        });
      }

      const productExists = await Product.findById(product);
      if (!productExists) {
        return res.status(404).json({ message: `Product not found: ${productName}` });
      }

      const qty = parseNumber(giftQty, -1);
      if (qty <= 0) {
        return res.status(400).json({
          message: `Gift quantity must be greater than 0 for ${productName}`
        });
      }

      if (Number(productExists.stock || 0) < qty) {
        return res.status(400).json({
          message: `Not enough stock for ${productName}`,
          availableStock: productExists.stock,
          requestedQty: qty
        });
      }

      processedItems.push({
        product,
        productName,
        giftQty: qty,
      });
    }

    const gift = await Gift.create({
      giftId: giftId || generateGiftId(),
      date: new Date(date),
      giver: {
        userId: req.user?._id || null,
        name: req.user?.name || req.body.giverName || "",
        email: req.user?.email || req.body.giverEmail || "",
      },
      recipientName,
      recipientPhone,
      recipientEmailAddress,
      shippingAddress,
      items: processedItems,
      note,
    });

    // Reduce stock for gifted items
    const stockUpdates = processedItems.map(item =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.giftQty },
      })
    );

    await Promise.all(stockUpdates);

    res.status(201).json({
      message: "Gift recorded successfully",
      gift
    });
  } catch (error) {
    console.log("Create gift error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get gifts with filtering
export const getGifts = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      year,
      recipientName,
      giver,
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

    // Recipient filtering
    if (recipientName) {
      filter.recipientName = new RegExp(recipientName, 'i');
    }

    // Giver filtering
    if (giver) {
      filter.$or = [
        { "giver.userId": giver },
        { "giver.name": new RegExp(giver, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [gifts, totalCount] = await Promise.all([
      Gift.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('items.product', 'name sku'),
      Gift.countDocuments(filter)
    ]);

    // Calculate totals
    const totalGiftedItems = gifts.reduce((sum, gift) =>
      sum + gift.items.reduce((itemSum, item) => itemSum + item.giftQty, 0), 0
    );

    res.status(200).json({
      gifts,
      summary: {
        totalRecords: totalCount,
        totalGiftedItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        limit: parseInt(limit)
      },
      filters: {
        startDate,
        endDate,
        year,
        recipientName,
        giver
      }
    });
  } catch (error) {
    console.log("Get gifts error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get gift by ID
export const getGiftById = async (req, res) => {
  try {
    const { id } = req.params;

    const gift = await Gift.findById(id).populate('items.product', 'name sku price');
    if (!gift) {
      return res.status(404).json({ message: "Gift not found" });
    }

    res.status(200).json({ gift });
  } catch (error) {
    console.log("Get gift by ID error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update gift
export const updateGift = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const gift = await Gift.findById(id);
    if (!gift) {
      return res.status(404).json({ message: "Gift not found" });
    }

    const allowedUpdates = [
      'recipientName', 'recipientPhone', 'recipientEmailAddress',
      'shippingAddress', 'note', 'date'
    ];

    // Update basic fields
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'date') {
          gift[field] = updates[field] ? new Date(updates[field]) : gift[field];
        } else {
          gift[field] = updates[field];
        }
      }
    });

    await gift.save();

    res.status(200).json({
      message: "Gift updated successfully",
      gift
    });
  } catch (error) {
    console.log("Update gift error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete gift and restore product stock
export const deleteGift = async (req, res) => {
  try {
    const { id } = req.params;

    const gift = await Gift.findById(id);
    if (!gift) {
      return res.status(404).json({ message: "Gift not found" });
    }

    // Restore stock for gifted items
    const stockUpdates = gift.items.map(item =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.giftQty }
      })
    );

    await Promise.all(stockUpdates);
    await gift.deleteOne();

    res.status(200).json({
      message: "Gift deleted and stock restored",
      restoredItems: gift.items.length,
      totalRestoredQty: gift.items.reduce((sum, item) => sum + item.giftQty, 0)
    });
  } catch (error) {
    console.log("Delete gift error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get gift statistics
export const getGiftStats = async (req, res) => {
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
      totalGifts,
      giftsByMonth,
      topRecipients,
      mostGiftedProducts
    ] = await Promise.all([
      // Total gifts and items
      Gift.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalGifts: { $sum: 1 },
            totalItems: { $sum: { $size: "$items" } },
            totalQty: { $sum: { $sum: "$items.giftQty" } }
          }
        }
      ]),

      // Monthly gift trend
      Gift.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            count: { $sum: 1 },
            totalQty: { $sum: { $sum: "$items.giftQty" } }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } }
      ]),

      // Top recipients
      Gift.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$recipientName",
            giftCount: { $sum: 1 },
            totalItems: { $sum: { $size: "$items" } },
            totalQty: { $sum: { $sum: "$items.giftQty" } }
          }
        },
        { $sort: { giftCount: -1 } },
        { $limit: 10 }
      ]),

      // Most gifted products
      Gift.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$items.product",
            productName: { $first: "$productInfo.name" },
            sku: { $first: "$productInfo.sku" },
            totalGifted: { $sum: "$items.giftQty" },
            giftRecords: { $sum: 1 }
          }
        },
        { $sort: { totalGifted: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.status(200).json({
      summary: totalGifts[0] || {
        totalGifts: 0,
        totalItems: 0,
        totalQty: 0
      },
      monthlyTrend: giftsByMonth,
      topRecipients,
      mostGiftedProducts,
      period: {
        startDate,
        endDate,
        year
      }
    });
  } catch (error) {
    console.log("Get gift stats error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
