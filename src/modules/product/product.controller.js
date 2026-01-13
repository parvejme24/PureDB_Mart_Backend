import Product from "./product.model.js";
import { uploadFromBuffer, deleteImage } from "../../utils/cloudinary.js";

// Helper function to generate slug from product name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Helper function to create unique slug
const createUniqueSlug = async (baseSlug) => {
  let slug = baseSlug;
  let counter = 1;

  while (await Product.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Create new product
export const createProduct = async (req, res) => {
  try {
    const productData = req.body;

    // Auto-generate slug from product name
    if (productData.name) {
      const baseSlug = generateSlug(productData.name);
      productData.slug = await createUniqueSlug(baseSlug);
    }

    // Handle image upload if provided
    if (req.file) {
      const folder = "products";
      const uploadResult = await uploadFromBuffer(req.file.buffer, folder);

      productData.image = {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      };
    }

    const product = new Product(productData);
    await product.save();

    // Populate category after saving
    await product.populate("category", "name slug");

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    if (error.code === 11000) {
      res.status(400).json({
        message: "Product with this name or slug already exists"
      });
    } else if (error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    } else {
      res.status(500).json({
        message: "Failed to create product",
        error: error.message
      });
    }
  }
};

// Get all products
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Build query
    let query = {};

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Product.countDocuments(query);

    res.status(200).json({
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message
    });
  }
};

// Get product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate("category", "name slug");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Increment views count
    await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

    res.status(200).json({
      product: {
        ...product.toObject(),
        views: product.views + 1, // Return updated view count
      },
    });
  } catch (error) {
    console.error("Get product by slug error:", error);
    res.status(500).json({
      message: "Failed to fetch product",
      error: error.message
    });
  }
};

// Get best selling products
export const getBestSellingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({ sold: { $gt: 0 } })
      .populate("category", "name slug")
      .sort({ sold: -1 })
      .limit(Number(limit));

    res.status(200).json({
      products,
      count: products.length,
    });
  } catch (error) {
    console.error("Get best selling products error:", error);
    res.status(500).json({
      message: "Failed to fetch best selling products",
      error: error.message
    });
  }
};

// Get deal of the day (top 10 best selling products)
export const getDealOfTheDay = async (req, res) => {
  try {
    const products = await Product.find({ sold: { $gt: 0 } })
      .populate("category", "name slug")
      .sort({ sold: -1 })
      .limit(10);

    res.status(200).json({
      dealOfTheDay: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Get deal of the day error:", error);
    res.status(500).json({
      message: "Failed to fetch deal of the day",
      error: error.message
    });
  }
};

// Update product by id
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If there's a new image, handle image upload
    if (req.file) {
      const folder = "products";
      const uploadResult = await uploadFromBuffer(req.file.buffer, folder);

      updateData.image = {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      };

      // Delete old image if it exists
      const existingProduct = await Product.findById(id);
      if (existingProduct?.image?.public_id) {
        await deleteImage(existingProduct.image.public_id);
      }
    }

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name slug");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    if (error.code === 11000) {
      res.status(400).json({
        message: "Product with this name or slug already exists"
      });
    } else {
      res.status(500).json({
        message: "Failed to update product",
        error: error.message
      });
    }
  }
};

// Delete product by id
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete associated image from Cloudinary
    if (product.image?.public_id) {
      await deleteImage(product.image.public_id);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      message: "Product deleted successfully",
      deletedProduct: {
        id: product._id,
        name: product.name,
        slug: product.slug,
      },
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      message: "Failed to delete product",
      error: error.message
    });
  }
};