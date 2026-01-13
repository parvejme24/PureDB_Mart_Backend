import Order from "./order.model.js";
import Product from "../product/product.model.js";
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from "../../utils/email.js";
import { v4 as uuidv4 } from "uuid";

// Create new order
export const createOrder = async (req, res) => {
  try {
    const {
      customerInfo,
      products,
      shippingCost,
      coupon,
      paymentMethod
    } = req.body;

    const user = req.user;

    // Validate products and calculate totals
    let subtotal = 0;
    const validatedProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          message: `Product ${item.product} not found`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
        });
      }

      const itemTotal = product.withDiscountPrice * item.quantity;
      subtotal += itemTotal;

      validatedProducts.push({
        product: item.product,
        name: product.name,
        price: product.withDiscountPrice,
        quantity: item.quantity,
        total: itemTotal
      });
    }

    // Calculate discount if coupon is provided
    let discountAmount = 0;
    if (coupon && coupon.code) {
      // Here you would validate the coupon against your coupon system
      // For now, we'll assume the discount is already calculated
      discountAmount = coupon.discountAmount || 0;
    }

    const totalAmount = subtotal + shippingCost - discountAmount;

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create order
    const order = new Order({
      orderId,
      user: user._id,
      customerInfo,
      products: validatedProducts,
      shippingCost,
      coupon: coupon || {},
      subtotal,
      totalAmount,
      paymentMethod,
    });

    await order.save();

    // Update product stock
    for (const item of validatedProducts) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity, sold: item.quantity }
      });
    }

    // Send order confirmation email
    await sendOrderConfirmationEmail(order);

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      message: "Failed to create order",
      error: error.message
    });
  }
};

// Get user's orders
export const getUserOrders = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10, status } = req.query;

    let query = { user: user._id, isDeleted: false };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message
    });
  }
};

// Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    const order = await Order.findOne({ orderId, user: user._id, isDeleted: false });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      order,
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    res.status(500).json({
      message: "Failed to fetch order",
      error: error.message
    });
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const order = await Order.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Send email notification if status was updated
    if (updateData.status) {
      await sendOrderStatusUpdateEmail(order);
    }

    res.status(200).json({
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      message: "Failed to update order",
      error: error.message
    });
  }
};

// Cancel order (user can cancel if order is still pending)
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    const order = await Order.findOne({ orderId, user: user._id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Only allow cancellation of pending orders
    if (order.status !== "PENDING") {
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage"
      });
    }

    // Update order status
    order.status = "CANCELLED";
    await order.save();

    // Restore product stock
    for (const item of order.products) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, sold: -item.quantity }
      });
    }

    res.status(200).json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      message: "Failed to cancel order",
      error: error.message
    });
  }
};

// Move order to trash (soft delete - admin only)
export const moveOrderToTrash = async (req, res) => {
  try {
    const { orderId } = req.params;
    const admin = req.user;

    const order = await Order.findOne({ orderId, isDeleted: false });

    if (!order) {
      return res.status(404).json({ message: "Order not found or already deleted" });
    }

    // Move to trash (soft delete)
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = admin._id;

    await order.save();

    res.status(200).json({
      message: "Order moved to trash successfully",
      trashedOrder: {
        orderId: order.orderId,
        customerEmail: order.customerInfo.email,
        totalAmount: order.totalAmount,
        status: order.status,
        deletedAt: order.deletedAt,
      },
    });
  } catch (error) {
    console.error("Move order to trash error:", error);
    res.status(500).json({
      message: "Failed to move order to trash",
      error: error.message
    });
  }
};

// Restore order from trash (admin only)
export const restoreOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId, isDeleted: true });

    if (!order) {
      return res.status(404).json({ message: "Order not found in trash" });
    }

    // Restore from trash
    order.isDeleted = false;
    order.deletedAt = null;
    order.deletedBy = null;

    await order.save();

    res.status(200).json({
      message: "Order restored successfully",
      restoredOrder: {
        orderId: order.orderId,
        customerEmail: order.customerInfo.email,
        totalAmount: order.totalAmount,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("Restore order error:", error);
    res.status(500).json({
      message: "Failed to restore order",
      error: error.message
    });
  }
};

// Permanently delete order (admin only - dangerous operation)
export const permanentlyDeleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOneAndDelete({ orderId, isDeleted: true });

    if (!order) {
      return res.status(404).json({ message: "Order not found in trash" });
    }

    res.status(200).json({
      message: "Order permanently deleted",
      deletedOrder: {
        orderId: order.orderId,
        customerEmail: order.customerInfo.email,
        totalAmount: order.totalAmount,
      },
    });
  } catch (error) {
    console.error("Permanently delete order error:", error);
    res.status(500).json({
      message: "Failed to permanently delete order",
      error: error.message
    });
  }
};

// Get all orders (admin only - excludes trashed orders)
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      paymentMethod
    } = req.query;

    let query = { isDeleted: false };
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const orders = await Order.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message
    });
  }
};

// Get trashed orders (admin only)
export const getTrashedOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const orders = await Order.find({ isDeleted: true })
      .populate("user", "name email")
      .populate("deletedBy", "name email")
      .sort({ deletedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments({ isDeleted: true });

    res.status(200).json({
      trashedOrders: orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get trashed orders error:", error);
    res.status(500).json({
      message: "Failed to fetch trashed orders",
      error: error.message
    });
  }
};

// Search orders by customer email or phone (admin only)
export const searchOrdersByCustomer = async (req, res) => {
  try {
    const { email, phone, page = 1, limit = 20 } = req.query;

    // Validate that at least one search parameter is provided
    if (!email && !phone) {
      return res.status(400).json({
        message: "Please provide either email or phone parameter"
      });
    }

    // Build search query
    let searchQuery = { isDeleted: false }; // Only search active orders

    if (email) {
      searchQuery["customerInfo.email"] = { $regex: email, $options: "i" };
    }

    if (phone) {
      searchQuery["customerInfo.phone"] = { $regex: phone.replace(/\s+/g, ""), $options: "i" };
    }

    const orders = await Order.find(searchQuery)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments(searchQuery);

    res.status(200).json({
      searchCriteria: { email, phone },
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Search orders by customer error:", error);
    res.status(500).json({
      message: "Failed to search orders",
      error: error.message
    });
  }
};