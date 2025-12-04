import Category from "./category.model.js";
import slugify from "slugify";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// -------------------- Create Category --------------------
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Category name is required" });

    const exist = await Category.findOne({ name });
    if (exist)
      return res.status(400).json({ message: "Category already exists" });

    // Validate image upload
    if (!req.file) {
      return res.status(400).json({ message: "Category image is required" });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadFromBuffer(req.file.buffer, "categories");

    const category = await Category.create({
      name,
      slug: slugify(name, { lower: true }),
      image: {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      },
    });

    res.status(201).json({ message: "Category created successfully", category });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Get All Categories --------------------
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ categories });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Get Single Category by Slug --------------------
export const getSingleCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ category });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// -------------------- Update Category by ID --------------------
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const category = await Category.findById(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    if (name) {
      category.name = name;
      category.slug = slugify(name, { lower: true });
    }

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary
      if (category.image?.public_id) {
        await deleteImage(category.image.public_id);
      }

      // Upload new image
      const uploadResult = await uploadFromBuffer(req.file.buffer, "categories");
      category.image = {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      };
    }

    await category.save();

    res.status(200).json({ message: "Category updated successfully", category });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Delete Category by ID --------------------
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    // Delete image from Cloudinary
    if (category.image?.public_id) {
      await deleteImage(category.image.public_id);
    }

    await category.deleteOne();

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
