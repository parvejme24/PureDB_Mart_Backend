import Category from "./category.model.js";
import slugify from "slugify";
import cloudinary from "cloudinary";

// Cloudinary Config
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Category
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Category name is required" });

    const exist = await Category.findOne({ name });
    if (exist)
      return res.status(400).json({ message: "Category already exists" });

    let imageUrl = "";
    if (req.file) {
      const upload = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "categories",
      });
      imageUrl = upload.secure_url;
    } else {
      return res.status(400).json({ message: "Image is required" });
    }

    const category = await Category.create({
      name,
      slug: slugify(name, { lower: true }),
      image: imageUrl,
    });

    res.status(201).json({ message: "Category created", category });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get All Categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Get Single Category
export const getSingleCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ category });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Update Category
export const updateCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const { name } = req.body;

    const category = await Category.findOne({ slug });
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    if (name) {
      category.name = name;
      category.slug = slugify(name, { lower: true });
    }

    if (req.file) {
      const upload = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "categories",
      });
      category.image = upload.secure_url;
    }

    await category.save();

    res.status(200).json({ message: "Category updated", category });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Category
export const deleteCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOneAndDelete({ slug });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
