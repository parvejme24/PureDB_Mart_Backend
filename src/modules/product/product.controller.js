import Product from "./product.model.js";
import Category from "../category/category.model.js";
import slugify from "slugify";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// -------------------- Create Product --------------------
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

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

    const product = await Product.create({
      name,
      slug: slugify(name, { lower: true }),
      description,
      price,
      category,
      stock,
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
    const { name, description, price, category, stock } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update basic fields
    if (name) {
      product.name = name;
      product.slug = slugify(name, { lower: true });
    }
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists)
        return res.status(404).json({ message: "Category not found" });
      product.category = category;
    }
    if (stock !== undefined) product.stock = stock;

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
