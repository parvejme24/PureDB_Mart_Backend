import Coupon from "./coupon.model.js";

// Create new coupon (admin only)
export const createCoupon = async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const coupon = new Coupon(couponData);
    await coupon.save();

    res.status(201).json({
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    if (error.code === 11000) {
      res.status(400).json({
        message: "Coupon code already exists"
      });
    } else {
      res.status(500).json({
        message: "Failed to create coupon",
        error: error.message
      });
    }
  }
};

// Get all coupons (admin only)
export const getAllCoupons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      if (status === 'active') query.isActive = true;
      if (status === 'inactive') query.isActive = false;
      if (status === 'expired') query.expiryDate = { $lt: new Date() };
    }

    // Filter by discount type
    if (type) {
      query['discountRules.discountType'] = type;
    }

    // Search by code or title
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const coupons = await Coupon.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Coupon.countDocuments(query);

    res.status(200).json({
      coupons,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalCoupons: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get all coupons error:", error);
    res.status(500).json({
      message: "Failed to fetch coupons",
      error: error.message
    });
  }
};

// Get single coupon (admin only)
export const getCouponById = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId)
      .populate('createdBy', 'name email');

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json({
      coupon,
    });
  } catch (error) {
    console.error("Get coupon by ID error:", error);
    res.status(500).json({
      message: "Failed to fetch coupon",
      error: error.message
    });
  }
};

// Update coupon (admin only)
export const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const updateData = req.body;

    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json({
      message: "Coupon updated successfully",
      coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    if (error.code === 11000) {
      res.status(400).json({
        message: "Coupon code already exists"
      });
    } else {
      res.status(500).json({
        message: "Failed to update coupon",
        error: error.message
      });
    }
  }
};

// Delete coupon (admin only)
export const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findByIdAndDelete(couponId);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json({
      message: "Coupon deleted successfully",
      deletedCoupon: {
        id: coupon._id,
        code: coupon.code,
        title: coupon.title,
      },
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      message: "Failed to delete coupon",
      error: error.message
    });
  }
};

// Validate and apply coupon to order
export const validateCoupon = async (req, res) => {
  try {
    const { code, orderData } = req.body;

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({
        message: "Invalid or inactive coupon code"
      });
    }

    if (coupon.isExpired) {
      return res.status(400).json({
        message: "Coupon has expired"
      });
    }

    // Check usage limits
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        message: "Coupon usage limit exceeded"
      });
    }

    // Check if user already used this coupon
    const userAlreadyUsed = coupon.usedBy.some(usage => usage.user.toString() === req.user._id.toString());

    if (userAlreadyUsed) {
      return res.status(400).json({
        message: "You have already used this coupon"
      });
    }

    // For single-use coupons, check if anyone has used it
    if (coupon.isSingleUse && coupon.usedCount > 0) {
      return res.status(400).json({
        message: "This coupon has already been used"
      });
    }

    // Check per-user limit for non-single-use coupons
    if (!coupon.isSingleUse) {
      const userUsageCount = coupon.usedBy.filter(usage => usage.user.toString() === req.user._id.toString()).length;

      if (userUsageCount >= coupon.perUserLimit) {
        return res.status(400).json({
          message: "You have reached the usage limit for this coupon"
        });
      }
    }

    // Validate coupon conditions
    const canApply = coupon.canApply(orderData, req.user._id);
    if (!canApply) {
      return res.status(400).json({
        message: "Coupon conditions not met"
      });
    }

    // Calculate discount
    const discount = calculateDiscount(coupon, orderData);

    res.status(200).json({
      valid: true,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        isSingleUse: coupon.isSingleUse,
        discount,
      },
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    res.status(500).json({
      message: "Failed to validate coupon",
      error: error.message
    });
  }
};

// Get public coupons (for users to browse)
export const getPublicCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      isActive: true,
      isPublic: true,
      expiryDate: { $gt: new Date() }
    })
    .select('code title description discountRules expiryDate')
    .sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      coupons,
    });
  } catch (error) {
    console.error("Get public coupons error:", error);
    res.status(500).json({
      message: "Failed to fetch coupons",
      error: error.message
    });
  }
};

// Helper function to calculate discount
const calculateDiscount = (coupon, orderData) => {
  let totalDiscount = 0;

  for (const rule of coupon.discountRules) {
    let discount = 0;

    switch (rule.target) {
      case 'ORDER_TOTAL':
        if (rule.discountType === 'PERCENTAGE') {
          discount = (orderData.subtotal * rule.discountValue) / 100;
        } else if (rule.discountType === 'FLAT') {
          discount = rule.discountValue;
        }
        break;

      case 'SHIPPING':
        if (rule.discountType === 'FREE') {
          discount = orderData.shippingCost;
        } else if (rule.discountType === 'FLAT') {
          discount = Math.min(rule.discountValue, orderData.shippingCost);
        } else if (rule.discountType === 'PERCENTAGE') {
          discount = (orderData.shippingCost * rule.discountValue) / 100;
        }
        break;

      // Add more cases for PRODUCT, CATEGORY specific discounts
    }

    // Apply max discount cap if set
    if (rule.maxDiscountAmount) {
      discount = Math.min(discount, rule.maxDiscountAmount);
    }

    totalDiscount += discount;
  }

  return {
    amount: Math.round(totalDiscount * 100) / 100, // Round to 2 decimal places
    currency: 'BDT'
  };
};

// Mark coupon as used (called when order is completed)
export const markCouponUsed = async (couponCode, userId, orderId, discountAmount) => {
  try {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Add user to usedBy array
    coupon.usedBy.push({
      user: userId,
      orderId: orderId,
      usedAt: new Date()
    });

    // Increment usage count
    coupon.usedCount += 1;

    // Update total discount given
    coupon.totalDiscountGiven += discountAmount;

    // Update last used timestamp
    coupon.lastUsedAt = new Date();

    await coupon.save();

    return coupon;
  } catch (error) {
    console.error('Mark coupon used error:', error);
    throw error;
  }
};