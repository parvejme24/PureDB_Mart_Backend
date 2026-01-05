import Product from "./product.model.js";
import Category from "../category/category.model.js";
import {
  validateProductData,
  doesCategoryExist,
  generateProductSlug,
  uploadProductImage,
  deleteProductImage,
  getBestSellingProductsData,
  getDealOfTheDayData,
  incrementProductViews
} from "./product.utils.js";

// Create Product
export const createProduct = async (req, res) => {
  try {
    const validation = validateProductData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ message: "Validation failed", errors: validation.errors });
    }

    if (!(await doesCategoryExist(req.body.category))) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!req.file) return res.status(400).json({ message: "Product image is required" });

    const imageData = await uploadProductImage(req.file.buffer);
    const product = await Product.create({
      ...req.body,
      slug: generateProductSlug(req.body.name),
      image: imageData,
    });

    const populatedProduct = await Product.findById(product._id).populate("category");
    res.status(201).json({ message: "Product created successfully", product: populatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get All Products
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category").sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Get Product By Slug
export const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });

    incrementProductViews(product._id);
    res.json({ product });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Get Products By Category Slug
export const getProductsByCategorySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) return res.status(404).json({ message: "Category not found" });

    const products = await Product.find({ category: category._id })
      .populate("category")
      .sort({ createdAt: -1 });

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Update Product
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const validation = validateProductData(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({ message: "Validation failed", errors: validation.errors });
    }

    if (req.body.category && !(await doesCategoryExist(req.body.category))) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'name') {
          product.name = req.body.name;
          product.slug = generateProductSlug(req.body.name);
        } else {
          product[key] = req.body[key];
        }
      }
    });

    if (req.file) {
      await deleteProductImage(product.image?.public_id);
      product.image = await uploadProductImage(req.file.buffer);
    }

    await product.save();
    const updatedProduct = await Product.findById(product._id).populate("category");
    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await deleteProductImage(product.image?.public_id);
    await product.deleteOne();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Best Selling Products
export const getBestSellingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const minSold = parseInt(req.query.minSold) || 1;

    const products = await getBestSellingProductsData({ limit, minSold });
    res.json({ products, total: products.length });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get Deal of the Day
export const getDealOfTheDay = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 7;

    const products = await getDealOfTheDayData({ limit, days });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    res.json({
      message: `Recently ordered products (last ${days} days)`,
      products,
      total: products.length,
      period: { startDate, days }
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

