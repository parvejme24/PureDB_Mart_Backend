import Payment from "./payment.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";

const parseNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
};

// Create payment for an order
export const createPayment = async (req, res) => {
  try {
    const {
      orderId,
      amount,
      method,
      transactionId = "",
      reference = "",
      notes = "",
      status = "completed"
    } = req.body;

    if (!orderId || !amount || !method) {
      return res.status(400).json({
        message: "orderId, amount, and method are required"
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentAmount = parseNumber(amount, -1);
    if (paymentAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    // Check if total payments exceed order total
    const existingPayments = await Payment.find({ orderId, status: "completed" });
    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid + paymentAmount > order.total) {
      return res.status(400).json({
        message: `Payment would exceed order total. Order total: ${order.total}, Already paid: ${totalPaid}`
      });
    }

    const payment = await Payment.create({
      orderId,
      amount: paymentAmount,
      method,
      status,
      transactionId,
      reference,
      notes,
      processedBy: {
        userId: req.user?._id || null,
        name: req.user?.name || "",
        email: req.user?.email || "",
      }
    });

    // Update order payment status
    const newTotalPaid = totalPaid + paymentAmount;
    const newPaymentStatus = newTotalPaid >= order.total ? "paid" :
                            newTotalPaid > 0 ? "unpaid" : "unpaid";

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: newPaymentStatus
    });

    // Update sold count for products if payment is completed
    if (status === "completed") {
      await Promise.all(order.items.map(async (item) => {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { sold: item.qty },
        });
      }));
    }

    res.status(201).json({
      message: "Payment recorded successfully",
      payment,
      orderPaymentStatus: newPaymentStatus
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get payments for an order
export const getOrderPayments = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payments = await Payment.find({ orderId })
      .sort({ createdAt: -1 });

    const totalPaid = payments
      .filter(p => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      payments,
      totalPaid,
      count: payments.length
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get all payments (admin)
export const getAllPayments = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      method,
      status,
      limit = 50,
      page = 1
    } = req.query;

    let filter = {};

    // Date filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Method filtering
    if (method) filter.method = method;

    // Status filtering
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('orderId', 'total customer.name paymentStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(filter)
    ]);

    res.status(200).json({
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const oldStatus = payment.status;
    payment.status = status;
    if (notes) payment.notes = notes;

    await payment.save();

    // Update order payment status and product sold counts if status changed
    const order = await Order.findById(payment.orderId);
    if (order) {
      const allPayments = await Payment.find({ orderId: payment.orderId });
      const totalPaid = allPayments
        .filter(p => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0);

      const newPaymentStatus = totalPaid >= order.total ? "paid" :
                              totalPaid > 0 ? "unpaid" : "unpaid";

      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: newPaymentStatus
      });

      // Adjust sold counts based on status change
      if (oldStatus !== "completed" && status === "completed") {
        // Payment completed - increase sold counts
        await Promise.all(order.items.map(async (item) => {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { sold: item.qty },
          });
        }));
      } else if (oldStatus === "completed" && status !== "completed") {
        // Payment no longer completed - decrease sold counts
        await Promise.all(order.items.map(async (item) => {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { sold: -item.qty },
          });
        }));
      }
    }

    res.status(200).json({
      message: "Payment status updated",
      payment
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Delete payment
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Don't allow deletion of completed payments
    if (payment.status === "completed") {
      return res.status(400).json({
        message: "Cannot delete completed payments. Mark as refunded instead."
      });
    }

    await payment.deleteOne();

    res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Process ShurjoPay payment
export const processShurjoPayPayment = async (req, res) => {
  try {
    const {
      orderId,
      amount,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerPostcode
    } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ message: "orderId and amount are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Import ShurjoPay dynamically to avoid issues if not installed
    const Shurjopay = (await import("shurjopay")).default;

    const shurjopay = new Shurjopay();

    const paymentData = {
      amount: parseFloat(amount),
      order_id: `ORDER_${orderId}_${Date.now()}`,
      currency: "BDT",
      customer_name: customerName || order.customer.name,
      customer_email: customerEmail || order.customer.email,
      customer_phone: customerPhone || order.customer.phone,
      customer_address: customerAddress || "N/A",
      customer_city: customerCity || "N/A",
      customer_postcode: customerPostcode || "0000",
      client_url: {
        success: `${process.env.FRONTEND_URL}/payment/success`,
        cancel: `${process.env.FRONTEND_URL}/payment/cancel`,
        fail: `${process.env.FRONTEND_URL}/payment/fail`
      }
    };

    const shurjopayResponse = await shurjopay.makePayment(paymentData);

    if (shurjopayResponse.checkout_url) {
      // Create pending payment record
      const payment = await Payment.create({
        orderId,
        amount: parseFloat(amount),
        method: "shurjopay",
        status: "pending",
        spOrderId: shurjopayResponse.sp_order_id,
        processedBy: {
          userId: req.user?._id || null,
          name: req.user?.name || "",
          email: req.user?.email || "",
        }
      });

      res.status(200).json({
        message: "ShurjoPay payment initiated",
        checkout_url: shurjopayResponse.checkout_url,
        payment
      });
    } else {
      res.status(400).json({ message: "Failed to initiate ShurjoPay payment" });
    }
  } catch (error) {
    console.log("ShurjoPay payment error:", error);
    res.status(500).json({ message: "Payment processing failed", error: error.message });
  }
};

// ShurjoPay payment verification callback
export const verifyShurjoPayPayment = async (req, res) => {
  try {
    const {
      order_id,
      currency,
      amount,
      payable_amount,
      payment_status,
      method,
      bank_tran_id,
      sp_message,
      sp_code,
      cus_name,
      cus_email,
      cus_phone,
      cus_address,
      cus_city,
      cus_postcode
    } = req.body;

    // Extract order ID from order_id (format: ORDER_{orderId}_{timestamp})
    const orderId = order_id.split('_')[1];

    const payment = await Payment.findOne({ orderId, spOrderId: order_id });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Update payment with verification data
    payment.status = payment_status === "Completed" ? "completed" : "failed";
    payment.transactionId = bank_tran_id;
    payment.bankTranId = bank_tran_id;
    payment.currencyType = currency;
    payment.currencyAmount = amount;
    payment.bankStatus = payment_status;
    payment.spMessage = sp_message;
    payment.spCode = sp_code;
    payment.validatedOn = new Date();

    await payment.save();

    // Update order and product sold counts if payment completed
    if (payment.status === "completed") {
      const order = await Order.findById(orderId);
      if (order) {
        // Update order payment status
        const allPayments = await Payment.find({ orderId, status: "completed" });
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        const newPaymentStatus = totalPaid >= order.total ? "paid" : "unpaid";
        await Order.findByIdAndUpdate(orderId, { paymentStatus: newPaymentStatus });

        // Update sold counts
        await Promise.all(order.items.map(async (item) => {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { sold: item.qty },
          });
        }));
      }
    }

    res.status(200).json({
      message: "Payment verified successfully",
      payment
    });
  } catch (error) {
    console.log("Payment verification error:", error);
    res.status(500).json({ message: "Payment verification failed", error: error.message });
  }
};

// Process SSLCommerz payment
export const processSSLCommerzPayment = async (req, res) => {
  try {
    const {
      orderId,
      amount,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress
    } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ message: "orderId and amount are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Import SSLCommerz dynamically
    const SSLCommerzPayment = (await import("sslcommerz-lts")).default;

    const sslcz = new SSLCommerzPayment(
      process.env.SSLC_STORE_ID,
      process.env.SSLC_STORE_PASSWORD,
      false // Set to true for live mode
    );

    const data = {
      total_amount: parseFloat(amount),
      currency: 'BDT',
      tran_id: `SSL_${orderId}_${Date.now()}`,
      success_url: `${process.env.FRONTEND_URL}/payment/ssl-success`,
      fail_url: `${process.env.FRONTEND_URL}/payment/ssl-fail`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/ssl-cancel`,
      ipn_url: `${process.env.BACKEND_URL}/api/payment/ssl-ipn`,
      shipping_method: 'NO',
      product_name: 'Order Payment',
      product_category: 'E-commerce',
      product_profile: 'general',
      cus_name: customerName || order.customer.name,
      cus_email: customerEmail || order.customer.email,
      cus_add1: customerAddress || 'N/A',
      cus_city: 'N/A',
      cus_state: 'N/A',
      cus_postcode: '0000',
      cus_country: 'Bangladesh',
      cus_phone: customerPhone || order.customer.phone,
      ship_name: customerName || order.customer.name,
      ship_add1: customerAddress || 'N/A',
      ship_city: 'N/A',
      ship_state: 'N/A',
      ship_postcode: '0000',
      ship_country: 'Bangladesh'
    };

    const sslResponse = await sslcz.init(data);

    if (sslResponse.GatewayPageURL) {
      // Create pending payment record
      const payment = await Payment.create({
        orderId,
        amount: parseFloat(amount),
        method: "sslcommerz",
        status: "pending",
        transactionId: data.tran_id,
        processedBy: {
          userId: req.user?._id || null,
          name: req.user?.name || "",
          email: req.user?.email || "",
        }
      });

      res.status(200).json({
        message: "SSLCommerz payment initiated",
        gateway_url: sslResponse.GatewayPageURL,
        payment
      });
    } else {
      res.status(400).json({ message: "Failed to initiate SSLCommerz payment" });
    }
  } catch (error) {
    console.log("SSLCommerz payment error:", error);
    res.status(500).json({ message: "Payment processing failed", error: error.message });
  }
};

// SSLCommerz IPN (Instant Payment Notification)
export const sslCommerzIPN = async (req, res) => {
  try {
    const sslcData = req.body;

    const payment = await Payment.findOne({ transactionId: sslcData.tran_id });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Update payment with SSLCommerz data
    payment.status = sslcData.status === "VALID" ? "completed" : "failed";
    payment.sslcTranId = sslcData.tran_id;
    payment.sslcAmount = sslcData.amount;
    payment.sslcCurrency = sslcData.currency;
    payment.sslcStatus = sslcData.status;
    payment.sslcCardType = sslcData.card_type;
    payment.sslcCardNo = sslcData.card_no;
    payment.sslcBankTranId = sslcData.bank_tran_id;
    payment.sslcError = sslcData.error;

    await payment.save();

    // Update order and product sold counts if payment completed
    if (payment.status === "completed") {
      const order = await Order.findById(payment.orderId);
      if (order) {
        const allPayments = await Payment.find({ orderId: payment.orderId, status: "completed" });
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        const newPaymentStatus = totalPaid >= order.total ? "paid" : "unpaid";
        await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: newPaymentStatus });

        await Promise.all(order.items.map(async (item) => {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { sold: item.qty },
          });
        }));
      }
    }

    res.status(200).json({
      message: "IPN processed successfully",
      payment
    });
  } catch (error) {
    console.log("IPN processing error:", error);
    res.status(500).json({ message: "IPN processing failed", error: error.message });
  }
};
