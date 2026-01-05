import mongoose from "mongoose";
import Product from "./product.model.js";
import Category from "../category/category.model.js";
import Order from "../order/order.model.js";
import slugify from "slugify";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// Utility function to safely convert ObjectId
export const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (error) {
    console.error("Invalid ObjectId:", id);
    return null;
  }
};

// Re-export mongoose for convenience
export { mongoose };

/**
 * Generates a unique product slug
 * @param {string} name - Product name
 * @returns {string} - Generated slug
 */
export const generateProductSlug = (name) => {
  return slugify(name, { lower: true });
};

/**
 * Validates product creation/update data
 * @param {object} data - Product data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {object} - Validation result with isValid and errors
 */
export const validateProductData = (data, isUpdate = false) => {
  const errors = [];
  const requiredFields = ['name', 'description', 'price', 'category', 'stock'];

  // Check required fields for creation
  if (!isUpdate) {
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });
  }

  // Validate name
  if (data.name && (typeof data.name !== 'string' || data.name.trim().length < 2)) {
    errors.push('Name must be at least 2 characters long');
  }

  // Validate price
  if (data.price !== undefined) {
    const price = Number(data.price);
    if (isNaN(price) || price < 0) {
      errors.push('Price must be a positive number');
    }
  }

  // Validate stock
  if (data.stock !== undefined) {
    const stock = Number(data.stock);
    if (isNaN(stock) || stock < 0) {
      errors.push('Stock must be a non-negative number');
    }
  }

  // Validate discount
  if (data.discount !== undefined) {
    const discount = Number(data.discount);
    if (isNaN(discount) || discount < 0) {
      errors.push('Discount must be a non-negative number');
    }
  }

  // Validate weight
  if (data.weight !== undefined) {
    const weight = Number(data.weight);
    if (isNaN(weight) || weight < 0) {
      errors.push('Weight must be a non-negative number');
    }
  }

  // Validate purchase price
  if (data.purchasePrice !== undefined) {
    const purchasePrice = Number(data.purchasePrice);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push('Purchase price must be a non-negative number');
    }
  }

  // Validate reorder point and min stock level
  if (data.reorderPoint !== undefined) {
    const reorderPoint = Number(data.reorderPoint);
    if (isNaN(reorderPoint) || reorderPoint < 0) {
      errors.push('Reorder point must be a non-negative number');
    }
  }

  if (data.minStockLevel !== undefined) {
    const minStockLevel = Number(data.minStockLevel);
    if (isNaN(minStockLevel) || minStockLevel < 0) {
      errors.push('Minimum stock level must be a non-negative number');
    }
  }

  // Validate expiry warning days
  if (data.expiryWarningDays !== undefined) {
    const expiryWarningDays = Number(data.expiryWarningDays);
    if (isNaN(expiryWarningDays) || expiryWarningDays < 0) {
      errors.push('Expiry warning days must be a non-negative number');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Checks if category exists
 * @param {string} categoryId - Category ID to check
 * @returns {boolean} - True if category exists
 */
export const doesCategoryExist = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId);
    return !!category;
  } catch (error) {
    console.log("Error checking category existence:", error);
    return false;
  }
};

/**
 * Checks if product exists by ID
 * @param {string} productId - Product ID to check
 * @returns {boolean} - True if product exists
 */
export const doesProductExist = async (productId) => {
  try {
    const product = await Product.findById(productId);
    return !!product;
  } catch (error) {
    console.log("Error checking product existence:", error);
    return false;
  }
};

/**
 * Checks if product exists by slug
 * @param {string} slug - Product slug to check
 * @param {string} excludeId - Product ID to exclude (for updates)
 * @returns {boolean} - True if product exists
 */
export const doesProductExistBySlug = async (slug, excludeId = null) => {
  try {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const product = await Product.findOne(query);
    return !!product;
  } catch (error) {
    console.log("Error checking product existence by slug:", error);
    return false;
  }
};

/**
 * Handles image upload to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} folder - Cloudinary folder name
 * @returns {object} - Upload result with url and public_id
 */
export const uploadProductImage = async (imageBuffer, folder = "products") => {
  try {
    const uploadResult = await uploadFromBuffer(imageBuffer, folder);
    return {
      url: uploadResult.url,
      public_id: uploadResult.public_id
    };
  } catch (error) {
    console.error("Error uploading product image:", error);
    throw new Error("Failed to upload image");
  }
};

/**
 * Deletes image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
export const deleteProductImage = async (publicId) => {
  try {
    if (publicId) {
      await deleteImage(publicId);
    }
  } catch (error) {
    console.error("Error deleting product image:", error);
    // Don't throw error for image deletion failures
  }
};

/**
 * Parses and validates pagination parameters
 * @param {object} query - Query parameters
 * @returns {object} - Parsed pagination parameters
 */
export const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10)); // Max 100 items per page

  return { page, limit };
};

/**
 * Builds filter object for products based on query parameters
 * @param {object} query - Query parameters
 * @returns {object} - Filter object
 */
export const buildProductFilter = (query) => {
  const filter = {};

  // Filter by category
  if (query.category) {
    filter.category = query.category;
  }

  // Filter by price range
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) {
      filter.price.$gte = Number(query.minPrice);
    }
    if (query.maxPrice !== undefined) {
      filter.price.$lte = Number(query.maxPrice);
    }
  }

  // Filter by stock availability
  if (query.inStock === 'true') {
    filter.stock = { $gt: 0 };
  } else if (query.inStock === 'false') {
    filter.stock = { $lte: 0 };
  }

  // Filter by discount
  if (query.hasDiscount === 'true') {
    filter.discount = { $gt: 0 };
  }

  return filter;
};

/**
 * Parses and validates sorting parameters for products
 * @param {string} sort - Sort parameter
 * @returns {object} - MongoDB sort object
 */
export const parseProductSortParams = (sort = "newest") => {
  const sortOptions = {
    "newest": { createdAt: -1 },
    "oldest": { createdAt: 1 },
    "price-high": { price: -1 },
    "price-low": { price: 1 },
    "name-asc": { name: 1 },
    "name-desc": { name: -1 },
    "popular": { views: -1, sold: -1 }
  };

  return sortOptions[sort] || sortOptions.newest;
};

/**
 * Gets best selling products with filtering options
 * @param {object} options - Query options
 * @returns {Array} - Array of best selling products
 */
export const getBestSellingProductsData = async (options = {}) => {
  const { limit = 10, minSold = 1 } = options;

  const filterQuery = {};
  if (minSold >= 0) {
    filterQuery.sold = { $gte: minSold };
  }

  const products = await Product.find(filterQuery)
    .populate("category")
    .sort({ sold: -1 })
    .limit(limit);

  return products;
};


/**
 * Updates product view count
 * @param {string} productId - Product ID
 */
export const incrementProductViews = async (productId) => {
  try {
    await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } });
  } catch (error) {
    console.log("Error incrementing product views:", error);
  }
};

/**
 * Gets deal of the day products (recently ordered)
 * @param {object} options - Query options
 * @returns {Array} - Array of deal products with order info
 */
export const getDealOfTheDayData = async (options = {}) => {
  const { limit = 10, days = 7 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const recentOrders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: "cancelled" }
      }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalOrdered: { $sum: "$items.qty" },
        lastOrderedDate: { $max: "$createdAt" },
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
      }
    },
    {
      $sort: { lastOrderedDate: -1, totalOrdered: -1 }
    },
    {
      $limit: limit
    }
  ]);

  const productIds = recentOrders.map(order => order._id);
  const products = await Product.find({ _id: { $in: productIds } }).populate("category");

  const recentProducts = recentOrders.map(orderData => {
    const product = products.find(p => String(p._id) === String(orderData._id));
    if (!product) return null;

    const originalPrice = Number(product.price) || 0;
    const discountAmount = Number(product.discount) || 0;
    const discountedPrice = originalPrice - discountAmount;
    const discountPercentage = originalPrice > 0 ? ((discountAmount / originalPrice) * 100).toFixed(1) : 0;

    return {
      ...product.toObject(),
      orderInfo: {
        totalOrdered: orderData.totalOrdered,
        lastOrderedDate: orderData.lastOrderedDate,
        orderCount: orderData.orderCount,
        totalRevenue: orderData.totalRevenue,
        periodDays: days
      },
      dealInfo: discountAmount > 0 ? {
        originalPrice,
        discountedPrice,
        discountAmount,
        discountPercentage: parseFloat(discountPercentage),
        savings: discountAmount
      } : null
    };
  }).filter(Boolean);

  return recentProducts;
};

/**
 * Gets products with pagination and filtering
 * @param {object} options - Query options
 * @returns {object} - Paginated result with products and metadata
 */
export const getProductsWithPagination = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    filter = {},
    sort = "newest",
    populateCategory = true
  } = options;

  const skip = (page - 1) * limit;
  const sortOption = parseProductSortParams(sort);

  let query = Product.find(filter).sort(sortOption).skip(skip).limit(limit);

  if (populateCategory) {
    query = query.populate("category");
  }

  const [products, total] = await Promise.all([
    query,
    Product.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    products,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};
