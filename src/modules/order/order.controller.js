import Order from "./order.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

const computeItemsTotal = (items = []) =>
  items.reduce((sum, item) => sum + parseNumber(item.price, 0) * parseNumber(item.qty, 0), 0);

const updatePaymentStatusByBalance = (order) => {
  const due = order.dueAmount || 0;
  order.paymentStatus = due > 0 ? "unpaid" : "paid";
};

// Create new order
export const createOrder = async (req, res) => {
  try {
    const { items, customer, total, paymentMethod, shippingCost } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    const itemsTotal = computeItemsTotal(items);
    const shipping = parseNumber(shippingCost, 0);
    const computedTotal = itemsTotal + shipping;

    const order = await Order.create({
      items,
      customer,
      itemsTotal,
      shippingCost: shipping,
      total: total !== undefined ? parseNumber(total, computedTotal) : computedTotal,
      paymentMethod,
    });

    // Update sold count for each product
    const updatePromises = items.map((item) =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { sold: item.qty },
      })
    );
    await Promise.all(updatePromises);

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Admin: Create custom/manual order
export const createCustomOrder = async (req, res) => {
  try {
    const {
      items,
      customer,
      total,
      paymentMethod = "COD",
      shippingCost,
      createdByName,
      createdByEmail,
      createdByPhone,
      payments = [],
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    const itemsTotal = computeItemsTotal(items);
    const shipping = parseNumber(shippingCost, 0);
    const computedTotal = itemsTotal + shipping;

    const order = new Order({
      isManual: true,
      items,
      customer,
      itemsTotal,
      shippingCost: shipping,
      total: total !== undefined ? parseNumber(total, computedTotal) : computedTotal,
      paymentMethod,
      createdBy: {
        userId: req.user?._id || null,
        name: createdByName || req.user?.name || "",
        email: createdByEmail || req.user?.email || "",
        phone: createdByPhone || req.user?.phone || "",
      },
      payments: (payments || []).map((p) => ({
        amount: parseNumber(p.amount, 0),
        method: p.method || "cash",
        receivedBy: {
          userId: req.user?._id || null,
          name: p.receivedBy?.name || req.user?.name || "",
          email: p.receivedBy?.email || req.user?.email || "",
        },
        note: p.note || "",
        receivedAt: p.receivedAt || Date.now(),
      })),
    });

    updatePaymentStatusByBalance(order);
    await order.save();

    // Update sold count for each product
    const updatePromises = items.map((item) =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { sold: item.qty },
      })
    );
    await Promise.all(updatePromises);

    res.status(201).json({ message: "Custom order created successfully", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get all orders (admin only)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("items.product");
    res.status(200).json({ orders });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).json({ order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !["pending", "processing", "shipped", "delivered", "cancelled"].includes(
        status
      )
    ) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    order.status = status;
    await order.save();

    res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Admin: add a payment entry to an order (partial payments supported)
export const addPayment = async (req, res) => {
  try {
    const { amount, method = "cash", note = "" } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const paymentAmount = parseNumber(amount, -1);
    if (paymentAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    order.payments.push({
      amount: paymentAmount,
      method,
      note,
      receivedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
      receivedAt: Date.now(),
    });

    updatePaymentStatusByBalance(order);
    await order.save();

    res
      .status(200)
      .json({ message: "Payment recorded successfully", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete order (admin only)
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
