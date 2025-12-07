import Product from "./product.model.js";
import Category from "../category/category.model.js";
import slugify from "slugify";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// -------------------- Create Product --------------------
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      discount = 0,
      weight = 0,
      unit = "",
      brand = "",
      barcode = "",
      purchasePrice = 0,
      reorderPoint = 0,
      minStockLevel = 0,
      expiryTracking = false,
      expiryWarningDays = 30,
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || !stock) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate category
    const categoryExists = await Category.findById(category);
    if (!categoryExists)
      return res.status(404).json({ message: "Category not found" });

    // Validate image upload
    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadFromBuffer(req.file.buffer, "products");

    const discountAmount = Math.max(0, Number(discount) || 0);
    const weightValue = Math.max(0, Number(weight) || 0);
    const purchasePriceValue = Math.max(0, Number(purchasePrice) || 0);
    const reorderPointValue = Math.max(0, Number(reorderPoint) || 0);
    const minStockLevelValue = Math.max(0, Number(minStockLevel) || 0);
    const warningDaysValue = Math.max(0, Number(expiryWarningDays) || 0) || 30;

    const product = await Product.create({
      name,
      slug: slugify(name, { lower: true }),
      description,
      price,
      discount: discountAmount,
      weight: weightValue,
      category,
      stock,
      unit,
      brand,
      barcode,
      purchasePrice: purchasePriceValue,
      reorderPoint: reorderPointValue,
      minStockLevel: minStockLevelValue,
      expiryTracking: Boolean(expiryTracking),
      expiryWarningDays: warningDaysValue,
      image: {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      },
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Get All Products --------------------
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category").sort({ createdAt: -1 });
    res.status(200).json({ products });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Get Product By Slug --------------------
export const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.status(200).json({ product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Get Products By Category Slug --------------------
export const getProductsByCategorySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    const products = await Product.find({ category: category._id })
      .populate("category")
      .sort({ createdAt: -1 });

    res.status(200).json({ products });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Update Product --------------------
export const updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      discount,
      weight,
      unit,
      brand,
      barcode,
      purchasePrice,
      reorderPoint,
      minStockLevel,
      expiryTracking,
      expiryWarningDays,
    } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update basic fields
    if (name) {
      product.name = name;
      product.slug = slugify(name, { lower: true });
    }
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists)
        return res.status(404).json({ message: "Category not found" });
      product.category = category;
    }
    if (stock !== undefined) product.stock = stock;
    if (discount !== undefined) {
      const parsedDiscount = Number(discount);
      product.discount = parsedDiscount >= 0 ? parsedDiscount : 0;
    }
    if (weight !== undefined) {
      const parsedWeight = Number(weight);
      product.weight = parsedWeight >= 0 ? parsedWeight : 0;
    }
    if (unit !== undefined) product.unit = unit;
    if (brand !== undefined) product.brand = brand;
    if (barcode !== undefined) product.barcode = barcode;
    if (purchasePrice !== undefined) {
      const parsedPurchasePrice = Number(purchasePrice);
      product.purchasePrice = parsedPurchasePrice >= 0 ? parsedPurchasePrice : 0;
    }
    if (reorderPoint !== undefined) {
      const parsedReorder = Number(reorderPoint);
      product.reorderPoint = parsedReorder >= 0 ? parsedReorder : 0;
    }
    if (minStockLevel !== undefined) {
      const parsedMin = Number(minStockLevel);
      product.minStockLevel = parsedMin >= 0 ? parsedMin : 0;
    }
    if (expiryTracking !== undefined) {
      product.expiryTracking = Boolean(expiryTracking);
    }
    if (expiryWarningDays !== undefined) {
      const parsedWarning = Number(expiryWarningDays);
      product.expiryWarningDays = parsedWarning >= 0 ? parsedWarning : product.expiryWarningDays;
    }

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary
      if (product.image?.public_id) {
        await deleteImage(product.image.public_id);
      }

      // Upload new image
      const uploadResult = await uploadFromBuffer(req.file.buffer, "products");
      product.image = {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      };
    }

    await product.save();

    const updatedProduct = await Product.findById(product._id).populate("category");
    res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Delete Product --------------------
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete image from Cloudinary
    if (product.image?.public_id) {
      await deleteImage(product.image.public_id);
    }

    await product.deleteOne();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
