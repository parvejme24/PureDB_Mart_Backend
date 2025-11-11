import Product from "./product.model.js";
import Category from "../category/category.model.js";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------- CREATE PRODUCT --------------------
export const createProduct = async (req, res) => {
  try {
    const { name, slug, description, price, category, stock } = req.body;

    // Validate category
    const categoryExists = await Category.findById(category);
    if (!categoryExists)
      return res.status(404).json({ message: "Category not found" });

    // Validate image upload
    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    // Upload image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
      folder: "products",
    });

    const product = await Product.create({
      name,
      slug,
      description,
      price,
      category,
      stock,
      image: {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      },
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- GET ALL PRODUCTS --------------------
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category");
    res.status(200).json({ products });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- GET PRODUCT BY ID --------------------
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.status(200).json({ product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- GET PRODUCTS BY CATEGORY SLUG --------------------
export const getProductsByCategorySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    const products = await Product.find({ category: category._id }).populate(
      "category"
    );

    res.status(200).json({ products });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- UPDATE PRODUCT --------------------
export const updateProduct = async (req, res) => {
  try {
    const { name, slug, description, price, category, stock } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update basic fields
    if (name) product.name = name;
    if (slug) product.slug = slug;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;
    if (stock) product.stock = stock;

    // Update image if uploaded
    if (req.file) {
      // Delete old image from Cloudinary
      if (product.image?.public_id) {
        await cloudinary.uploader.destroy(product.image.public_id);
      }

      // Upload new image
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: "products",
      });
      product.image = {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    }

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- DELETE PRODUCT --------------------
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete image from Cloudinary
    if (product.image?.public_id) {
      await cloudinary.uploader.destroy(product.image.public_id);
    }

    await product.deleteOne();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
