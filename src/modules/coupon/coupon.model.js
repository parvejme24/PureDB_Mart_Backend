import mongoose from "mongoose";

// Discount condition schema for flexible conditions
const DiscountConditionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["MIN_ORDER_AMOUNT", "DATE_RANGE", "USER_TYPE", "FIRST_ORDER", "CATEGORY", "PRODUCT"],
    required: true,
  },
  operator: {
    type: String,
    enum: ["GTE", "LTE", "EQ", "IN", "BETWEEN"],
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Can be number, string, array, or date range
    required: true,
  },
  value2: {
    type: mongoose.Schema.Types.Mixed, // For BETWEEN operator (end date, max amount, etc.)
  }
}, { _id: false });

// Discount rule schema for complex discount logic
const DiscountRuleSchema = new mongoose.Schema({
  target: {
    type: String,
    enum: ["ORDER_TOTAL", "SHIPPING", "PRODUCT", "CATEGORY"],
    required: true,
  },

  discountType: {
    type: String,
    enum: ["PERCENTAGE", "FLAT", "FREE", "FIXED"],
    required: true,
  },

  discountValue: {
    type: Number,
    required: true, // Percentage (0-100), flat amount, or fixed amount
  },

  maxDiscountAmount: {
    type: Number, // Maximum discount cap
  },

  // For product/category specific discounts
  applicableItems: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'applicableItemType'
  }],

  applicableItemType: {
    type: String,
    enum: ["Product", "Category"]
  }
}, { _id: false });

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // Multiple discount rules for complex scenarios
    discountRules: [DiscountRuleSchema],

    // Conditions that must be met for coupon to apply
    conditions: [DiscountConditionSchema],

    // Time-based validity
    startDate: {
      type: Date,
      default: Date.now,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    // Usage restrictions
    usageLimit: {
      type: Number, // Total usage limit across all users
      default: null, // null means unlimited
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    perUserLimit: {
      type: Number, // Usage limit per user
      default: 1,
    },

    isSingleUse: {
      type: Boolean,
      default: false, // True for one-time use coupons
    },

    usedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      orderId: {
        type: String,
      }
    }],

    // Status and visibility
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isPublic: {
      type: Boolean,
      default: true, // Public coupons can be seen by users
    },

    // Priority for multiple coupon applications
    priority: {
      type: Number,
      default: 0, // Higher number = higher priority
    },

    // Auto-apply settings
    autoApply: {
      type: Boolean,
      default: false, // Whether to auto-apply when conditions are met
    },

    // For admin tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Usage statistics
    totalDiscountGiven: {
      type: Number,
      default: 0,
    },

    lastUsedAt: {
      type: Date,
    },

    // Tags for organization
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
  },
  { timestamps: true }
);

// Indexes for performance
CouponSchema.index({ code: 1 });
CouponSchema.index({ isActive: 1, expiryDate: 1 });
CouponSchema.index({ "conditions.type": 1 });
CouponSchema.index({ tags: 1 });

// Virtual for checking if coupon is expired
CouponSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

// Pre-save middleware
CouponSchema.pre('save', function(next) {
  // Auto-set usageLimit to 1 for single-use coupons
  if (this.isSingleUse && this.usageLimit !== 1) {
    this.usageLimit = 1;
  }
  next();
});

// Virtual for checking if coupon is usable
CouponSchema.virtual('isUsable').get(function() {
  return this.isActive && !this.isExpired && (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Method to check if coupon can be applied
CouponSchema.methods.canApply = function(orderData, userId) {
  // Check basic validity
  if (!this.isActive || this.isExpired) return false;
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;

  // Check conditions
  for (const condition of this.conditions) {
    if (!this.checkCondition(condition, orderData, userId)) {
      return false;
    }
  }

  return true;
};

// Method to check individual condition
CouponSchema.methods.checkCondition = function(condition, orderData, userId) {
  const { type, operator, value, value2 } = condition;

  switch (type) {
    case 'MIN_ORDER_AMOUNT':
      return this.checkNumericCondition(orderData.subtotal, operator, value);

    case 'DATE_RANGE':
      const now = new Date();
      if (operator === 'BETWEEN') {
        return now >= new Date(value) && now <= new Date(value2);
      }
      return this.checkDateCondition(now, operator, value);

    case 'FIRST_ORDER':
      // This would need user order history - simplified check
      return orderData.isFirstOrder === true;

    case 'USER_TYPE':
      return orderData.userType === value;

    default:
      return true;
  }
};

// Helper method for numeric conditions
CouponSchema.methods.checkNumericCondition = function(actualValue, operator, targetValue) {
  switch (operator) {
    case 'GTE': return actualValue >= targetValue;
    case 'LTE': return actualValue <= targetValue;
    case 'EQ': return actualValue === targetValue;
    default: return false;
  }
};

// Helper method for date conditions
CouponSchema.methods.checkDateCondition = function(actualDate, operator, targetDate) {
  const target = new Date(targetDate);
  switch (operator) {
    case 'GTE': return actualDate >= target;
    case 'LTE': return actualDate <= target;
    case 'EQ': return actualDate.toDateString() === target.toDateString();
    default: return false;
  }
};

export default mongoose.model("Coupon", CouponSchema);
