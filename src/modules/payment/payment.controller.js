import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import { v4 as uuidv4 } from "uuid";

// Lazy initialization of ShurjoPay
let shurjopayInstance = null;

// Check if ShurjoPay is configured
const checkShurjoPayConfig = () => {
  const missing = [];
  if (!process.env.SP_ENDPOINT) missing.push("SP_ENDPOINT");
  if (!process.env.SP_USERNAME) missing.push("SP_USERNAME");
  if (!process.env.SP_PASSWORD) missing.push("SP_PASSWORD");
  if (!process.env.SP_PREFIX) missing.push("SP_PREFIX");
  if (!process.env.SP_RETURN_URL) missing.push("SP_RETURN_URL");
  return missing;
};

const getShurjoPay = async () => {
  const missingVars = checkShurjoPayConfig();
  if (missingVars.length > 0) {
    throw new Error(`Missing ShurjoPay config: ${missingVars.join(", ")}`);
  }

  if (!shurjopayInstance) {
    const shurjopayModule = await import("shurjopay");
    shurjopayInstance = shurjopayModule.default();
    shurjopayInstance.config(
      process.env.SP_ENDPOINT,
      process.env.SP_USERNAME,
      process.env.SP_PASSWORD,
      process.env.SP_PREFIX,
      process.env.SP_RETURN_URL
    );
  }
  return shurjopayInstance;
};

// Promisify makePayment
const makePaymentAsync = (shurjopay, paymentData) => {
  return new Promise((resolve, reject) => {
    shurjopay.makePayment(
      paymentData,
      (response) => resolve(response),
      (error) => reject(error)
    );
  });
};

// Promisify verifyPayment
const verifyPaymentAsync = (shurjopay, orderId) => {
  return new Promise((resolve, reject) => {
    shurjopay.verifyPayment(
      orderId,
      (response) => resolve(response),
      (error) => reject(error)
    );
  });
};

// -------------------- Initialize Payment --------------------
// POST /api/payment/init
export const initPayment = async (req, res) => {
  try {
    const { items, customer, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    if (!customer || !customer.name || !customer.email || !customer.phone) {
      return res.status(400).json({ message: "Customer details are required" });
    }

    // Generate unique order ID
    const orderId = `ORD_${uuidv4().replace(/-/g, "").substring(0, 12)}`;

    // Create order with pending payment status
    const order = await Order.create({
      items,
      customer,
      total,
      paymentMethod: "ShurjoPay",
      paymentStatus: "unpaid",
      transactionId: orderId,
      status: "pending",
    });

    // Prepare ShurjoPay payment data
    const paymentData = {
      amount: total,
      order_id: orderId,
      currency: "BDT",
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: customer.address?.detailsAddress || "N/A",
      customer_city: customer.address?.district || "",
      customer_post_code: customer.address?.postalCode || "",
      client_ip: req.ip || req.headers["x-forwarded-for"] || "",
    };

    try {
      const shurjopay = await getShurjoPay();
      const response = await makePaymentAsync(shurjopay, paymentData);

      if (response.checkout_url) {
        res.status(200).json({
          success: true,
          message: "Payment initiated successfully",
          paymentUrl: response.checkout_url,
          transactionId: orderId,
          orderId: order._id,
          spOrderId: response.sp_order_id,
        });
      } else {
        await Order.findByIdAndDelete(order._id);
        res.status(400).json({
          success: false,
          message: "Failed to initialize payment",
          error: response,
        });
      }
    } catch (paymentError) {
      await Order.findByIdAndDelete(order._id);
      console.error("ShurjoPay init error:", paymentError);
      res.status(500).json({
        success: false,
        message: "Payment initialization failed",
        error: paymentError.message || paymentError,
      });
    }
  } catch (error) {
    console.error("Payment init error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Payment Callback (Return URL) --------------------
// GET /api/payment/callback
export const paymentCallback = async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=missing_order_id`);
    }

    try {
      const shurjopay = await getShurjoPay();
      const response = await verifyPaymentAsync(shurjopay, order_id);
      const paymentInfo = response[0];

      if (paymentInfo && paymentInfo.sp_code === "1000") {
        const order = await Order.findOneAndUpdate(
          { transactionId: order_id },
          {
            paymentStatus: "paid",
            paymentDetails: {
              spOrderId: paymentInfo.sp_order_id,
              bankTranId: paymentInfo.bank_trx_id,
              cardType: paymentInfo.method,
              currencyType: paymentInfo.currency,
              currencyAmount: parseFloat(paymentInfo.amount),
              validatedOn: new Date(paymentInfo.date_time),
              bankStatus: paymentInfo.bank_status,
              spMessage: paymentInfo.sp_message,
            },
          },
          { new: true }
        );

        if (order) {
          const updatePromises = order.items.map((item) =>
            Product.findByIdAndUpdate(item.product, {
              $inc: { sold: item.qty },
            })
          );
          await Promise.all(updatePromises);
        }

        res.redirect(
          `${process.env.FRONTEND_URL}/payment/success?transactionId=${order_id}&orderId=${order?._id}`
        );
      } else {
        const spMessage = paymentInfo?.sp_message || "Payment verification failed";
        await Order.findOneAndUpdate(
          { transactionId: order_id },
          { paymentStatus: "failed" }
        );

        res.redirect(
          `${process.env.FRONTEND_URL}/payment/failed?transactionId=${order_id}&reason=${encodeURIComponent(spMessage)}`
        );
      }
    } catch (verifyError) {
      console.error("Payment verification error:", verifyError);
      await Order.findOneAndUpdate(
        { transactionId: order_id },
        { paymentStatus: "failed" }
      );
      res.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?transactionId=${order_id}&reason=verification_error`
      );
    }
  } catch (error) {
    console.error("Payment callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=server_error`);
  }
};

// -------------------- Verify Payment --------------------
// POST /api/payment/verify
export const verifyPayment = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    try {
      const shurjopay = await getShurjoPay();
      const response = await verifyPaymentAsync(shurjopay, order_id);
      const paymentInfo = response[0];

      if (paymentInfo && paymentInfo.sp_code === "1000") {
        const order = await Order.findOne({ transactionId: order_id });

        if (order && order.paymentStatus !== "paid") {
          order.paymentStatus = "paid";
          order.paymentDetails = {
            spOrderId: paymentInfo.sp_order_id,
            bankTranId: paymentInfo.bank_trx_id,
            cardType: paymentInfo.method,
            currencyType: paymentInfo.currency,
            currencyAmount: parseFloat(paymentInfo.amount),
            validatedOn: new Date(paymentInfo.date_time),
            bankStatus: paymentInfo.bank_status,
            spMessage: paymentInfo.sp_message,
          };
          await order.save();

          const updatePromises = order.items.map((item) =>
            Product.findByIdAndUpdate(item.product, {
              $inc: { sold: item.qty },
            })
          );
          await Promise.all(updatePromises);
        }

        res.status(200).json({
          success: true,
          message: "Payment verified successfully",
          paymentStatus: "paid",
          paymentInfo,
          orderId: order?._id,
        });
      } else {
        res.status(200).json({
          success: false,
          message: paymentInfo?.sp_message || "Payment not completed",
          paymentStatus: paymentInfo?.bank_status || "failed",
          paymentInfo,
        });
      }
    } catch (verifyError) {
      console.error("Verify payment error:", verifyError);
      res.status(500).json({
        success: false,
        message: "Payment verification failed",
        error: verifyError.message || verifyError,
      });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Check Payment Status --------------------
// GET /api/payment/status/:transactionId
export const checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const order = await Order.findOne({ transactionId }).populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      success: true,
      order: {
        _id: order._id,
        transactionId: order.transactionId,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentDetails: order.paymentDetails,
        total: order.total,
        status: order.status,
        items: order.items,
        customer: order.customer,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- IPN (Instant Payment Notification) --------------------
// POST /api/payment/ipn
export const paymentIPN = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    try {
      const shurjopay = await getShurjoPay();
      const response = await verifyPaymentAsync(shurjopay, order_id);
      const paymentInfo = response[0];

      if (paymentInfo && paymentInfo.sp_code === "1000") {
        const order = await Order.findOne({ transactionId: order_id });

        if (order && order.paymentStatus !== "paid") {
          order.paymentStatus = "paid";
          order.paymentDetails = {
            spOrderId: paymentInfo.sp_order_id,
            bankTranId: paymentInfo.bank_trx_id,
            cardType: paymentInfo.method,
            currencyType: paymentInfo.currency,
            currencyAmount: parseFloat(paymentInfo.amount),
            validatedOn: new Date(paymentInfo.date_time),
            bankStatus: paymentInfo.bank_status,
            spMessage: paymentInfo.sp_message,
          };
          await order.save();

          const updatePromises = order.items.map((item) =>
            Product.findByIdAndUpdate(item.product, {
              $inc: { sold: item.qty },
            })
          );
          await Promise.all(updatePromises);
        }
      }

      res.status(200).json({ message: "IPN processed" });
    } catch (verifyError) {
      console.error("IPN verification error:", verifyError);
      res.status(500).json({ message: "IPN processing failed" });
    }
  } catch (error) {
    console.error("IPN error:", error);
    res.status(500).json({ message: "IPN processing failed" });
  }
};

// -------------------- Get All Transactions (Admin) --------------------
// GET /api/payment/transactions
export const getAllTransactions = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { paymentMethod: "ShurjoPay" };

    if (status) {
      query.paymentStatus = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("items.product", "name image"),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Check Payment Config (Debug) --------------------
// GET /api/payment/config-check
export const checkPaymentConfig = async (req, res) => {
  const config = {
    SP_ENDPOINT: process.env.SP_ENDPOINT ? "✅ Set" : "❌ Missing",
    SP_USERNAME: process.env.SP_USERNAME ? "✅ Set" : "❌ Missing",
    SP_PASSWORD: process.env.SP_PASSWORD ? "✅ Set (hidden)" : "❌ Missing",
    SP_PREFIX: process.env.SP_PREFIX ? "✅ Set" : "❌ Missing",
    SP_RETURN_URL: process.env.SP_RETURN_URL || "❌ Missing",
    FRONTEND_URL: process.env.FRONTEND_URL || "❌ Missing",
  };

  const missingVars = checkShurjoPayConfig();
  const isConfigured = missingVars.length === 0;

  res.status(200).json({
    success: isConfigured,
    message: isConfigured ? "ShurjoPay is configured" : "ShurjoPay is NOT configured",
    missing: missingVars,
    config,
  });
};
