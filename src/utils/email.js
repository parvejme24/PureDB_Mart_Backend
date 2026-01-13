import nodemailer from "nodemailer";

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail", // or your email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password for Gmail
    },
  });
};

// Send order confirmation email
export const sendOrderConfirmationEmail = async (order) => {
  try {
    const transporter = createTransporter();

    const productsList = order.products
      .map(
        (item) =>
          `<tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>৳${item.price}</td>
            <td>৳${item.total}</td>
          </tr>`
      )
      .join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Order Confirmation</h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Shipping Address</h3>
          <p><strong>Name:</strong> ${order.customerInfo.fullName}</p>
          <p><strong>Phone:</strong> ${order.customerInfo.phone}</p>
          <p><strong>Address:</strong> ${order.customerInfo.detailsAddress}</p>
          <p><strong>Area:</strong> ${order.customerInfo.upazila}, ${order.customerInfo.district}, ${order.customerInfo.division}</p>
          ${order.customerInfo.zipCode ? `<p><strong>ZIP Code:</strong> ${order.customerInfo.zipCode}</p>` : ''}
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e9ecef;">
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">Product</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">Qty</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: right;">Price</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productsList}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Summary</h3>
          <p><strong>Subtotal:</strong> ৳${order.subtotal}</p>
          <p><strong>Shipping Cost:</strong> ৳${order.shippingCost}</p>
          ${order.coupon.discountAmount ? `<p><strong>Discount:</strong> -৳${order.coupon.discountAmount}</p>` : ''}
          <p style="font-size: 18px; font-weight: bold; color: #28a745;"><strong>Total: ৳${order.totalAmount}</strong></p>
        </div>

        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px;">
          <h3 style="color: #155724; margin: 0;">Thank you for your order!</h3>
          <p style="color: #155724; margin: 10px 0;">We'll send you updates as your order progresses.</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 12px;">
            PureBD Mart - Your Trusted Online Store<br>
            For any questions, contact us at support@purebdmart.com
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.customerInfo.email,
      subject: `Order Confirmation - ${order.orderId}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${order.customerInfo.email}`);

  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
    // Don't throw error to avoid breaking order creation
  }
};

// Send order status update email
export const sendOrderStatusUpdateEmail = async (order) => {
  try {
    const transporter = createTransporter();

    const statusMessages = {
      PENDING: "Your order is being processed",
      CONFIRMED: "Your order has been confirmed and is being prepared",
      SHIPPED: "Your order has been shipped and is on the way",
      DELIVERED: "Your order has been delivered successfully",
      CANCELLED: "Your order has been cancelled"
    };

    const statusColors = {
      PENDING: "#ffc107",
      CONFIRMED: "#17a2b8",
      SHIPPED: "#007bff",
      DELIVERED: "#28a745",
      CANCELLED: "#dc3545"
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Order Status Update</h2>

        <div style="background-color: ${statusColors[order.status] || '#6c757d'}; color: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h3 style="margin: 0; color: white;">${order.status}</h3>
          <p style="margin: 10px 0; color: white;">${statusMessages[order.status] || "Your order status has been updated"}</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order.orderId}"
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Order Details
          </a>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 12px;">
            PureBD Mart - Your Trusted Online Store<br>
            For any questions, contact us at support@purebdmart.com
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.customerInfo.email,
      subject: `Order Status Update - ${order.orderId} - ${order.status}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order status update email sent to ${order.customerInfo.email} for order ${order.orderId}`);

  } catch (error) {
    console.error("Failed to send order status update email:", error);
    // Don't throw error to avoid breaking status updates
  }
};