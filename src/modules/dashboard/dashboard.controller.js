import User from "../auth/auth.model.js";
import Order from "../order/order.model.js";
import Product from "../product/product.model.js";
import Category from "../category/category.model.js";
import { InventoryPurchase } from "../inventory/inventory.model.js";
import Expense from "../expense/expense.model.js";
import Waste from "../waste/waste.model.js";

// -------------------- Dashboard Stats --------------------
// GET /api/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalOrders, totalProducts, revenueData] =
      await Promise.all([
        User.countDocuments(),
        Order.countDocuments(),
        Product.countDocuments(),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
        ]),
      ]);

    const revenue = revenueData[0]?.totalRevenue || 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        totalProducts,
        revenue,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Revenue Overview by Month --------------------
// GET /api/dashboard/revenue-overview?year=2024
export const getRevenueOverview = async (req, res) => {
  try {
    const { year } = req.query;
    const selectedYear = year ? parseInt(year) : new Date().getFullYear();

    // Get all available years from orders
    const availableYears = await Order.aggregate([
      {
        $group: {
          _id: { $year: "$createdAt" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const years = availableYears.map((y) => y._id);

    // Get monthly revenue for selected year
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: { $ne: "cancelled" },
          createdAt: {
            $gte: new Date(`${selectedYear}-01-01`),
            $lte: new Date(`${selectedYear}-12-31T23:59:59.999Z`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Create full 12 months data with 0 for months without orders
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const revenueByMonth = monthNames.map((name, index) => {
      const monthData = monthlyRevenue.find((m) => m._id === index + 1);
      return {
        month: name,
        monthNumber: index + 1,
        revenue: monthData?.revenue || 0,
        orderCount: monthData?.orderCount || 0,
      };
    });

    // Calculate year totals
    const yearTotal = revenueByMonth.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        orderCount: acc.orderCount + m.orderCount,
      }),
      { revenue: 0, orderCount: 0 }
    );

    res.status(200).json({
      success: true,
      selectedYear,
      availableYears: years,
      revenueByMonth,
      yearTotal,
    });
  } catch (error) {
    console.error("Revenue overview error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Product Performance --------------------
// GET /api/dashboard/product-performance?startDate=2024-01-01&endDate=2024-12-31
export const getProductPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let matchStage = {};

    // If date filters provided, filter orders by date
    if (startDate && endDate) {
      matchStage = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(`${endDate}T23:59:59.999Z`),
        },
      };
    }

    // Get product sales data from orders
    const salesData = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" }, ...matchStage } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.qty" },
          totalRevenue: {
            $sum: { $multiply: ["$items.price", "$items.qty"] },
          },
        },
      },
      { $sort: { totalSold: -1 } },
    ]);

    // Get all products with views
    const products = await Product.find()
      .select("name slug image views sold price stock")
      .populate("category", "name slug")
      .lean();

    // Merge sales data with product info
    const productPerformance = products.map((product) => {
      const sales = salesData.find(
        (s) => s._id?.toString() === product._id.toString()
      );
      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        category: product.category,
        price: product.price,
        stock: product.stock,
        views: product.views,
        sold: sales?.totalSold || product.sold || 0,
        revenue: sales?.totalRevenue || 0,
      };
    });

    // Sort by sold count (descending)
    productPerformance.sort((a, b) => b.sold - a.sold);

    // Calculate averages
    const totalProducts = productPerformance.length;
    const avgViews =
      totalProducts > 0
        ? Math.round(
            productPerformance.reduce((acc, p) => acc + p.views, 0) /
              totalProducts
          )
        : 0;
    const avgSold =
      totalProducts > 0
        ? Math.round(
            productPerformance.reduce((acc, p) => acc + p.sold, 0) /
              totalProducts
          )
        : 0;

    // Top performers
    const topByViews = [...productPerformance]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
    const topBySales = productPerformance.slice(0, 10);

    res.status(200).json({
      success: true,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalProducts,
        avgViews,
        avgSold,
      },
      topByViews,
      topBySales,
      allProducts: productPerformance,
    });
  } catch (error) {
    console.error("Product performance error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Category Performance --------------------
// GET /api/dashboard/category-performance?startDate=2024-01-01&endDate=2024-12-31
export const getCategoryPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let orderMatchStage = { status: { $ne: "cancelled" } };

    if (startDate && endDate) {
      orderMatchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    // Get all categories
    const categories = await Category.find().select("name slug image").lean();

    // Get products grouped by category with their performance
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          productCount: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalStock: { $sum: "$stock" },
          products: { $push: "$_id" },
        },
      },
    ]);

    // Get sales data by product, then map to categories
    const salesByProduct = await Order.aggregate([
      { $match: orderMatchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.qty" },
          totalRevenue: {
            $sum: { $multiply: ["$items.price", "$items.qty"] },
          },
        },
      },
    ]);

    // Get product to category mapping
    const productCategoryMap = await Product.find()
      .select("_id category")
      .lean();
    const categoryMap = {};
    productCategoryMap.forEach((p) => {
      categoryMap[p._id.toString()] = p.category?.toString();
    });

    // Aggregate sales by category
    const salesByCategory = {};
    salesByProduct.forEach((sale) => {
      const categoryId = categoryMap[sale._id?.toString()];
      if (categoryId) {
        if (!salesByCategory[categoryId]) {
          salesByCategory[categoryId] = { totalSold: 0, totalRevenue: 0 };
        }
        salesByCategory[categoryId].totalSold += sale.totalSold;
        salesByCategory[categoryId].totalRevenue += sale.totalRevenue;
      }
    });

    // Build category performance data
    const categoryPerformance = categories.map((category) => {
      const categoryProducts = productsByCategory.find(
        (p) => p._id?.toString() === category._id.toString()
      );
      const categorySales = salesByCategory[category._id.toString()];

      return {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        image: category.image,
        productCount: categoryProducts?.productCount || 0,
        totalViews: categoryProducts?.totalViews || 0,
        totalStock: categoryProducts?.totalStock || 0,
        totalSold: categorySales?.totalSold || 0,
        totalRevenue: categorySales?.totalRevenue || 0,
      };
    });

    // Sort by revenue (descending)
    categoryPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calculate totals
    const totals = categoryPerformance.reduce(
      (acc, cat) => ({
        totalProducts: acc.totalProducts + cat.productCount,
        totalViews: acc.totalViews + cat.totalViews,
        totalSold: acc.totalSold + cat.totalSold,
        totalRevenue: acc.totalRevenue + cat.totalRevenue,
      }),
      { totalProducts: 0, totalViews: 0, totalSold: 0, totalRevenue: 0 }
    );

    res.status(200).json({
      success: true,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      totals,
      categories: categoryPerformance,
    });
  } catch (error) {
    console.error("Category performance error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -------------------- Increment Product View --------------------
// -------------------- Revenue Analytics --------------------
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { year, month } = req.query;

    // Default to current year and month
    const currentDate = new Date();
    const selectedYear = year ? parseInt(year) : currentDate.getFullYear();
    const selectedMonth = month ? parseInt(month) : currentDate.getMonth() + 1; // JS months are 0-based

    // Get monthly revenue data for the selected year
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: { $ne: "cancelled" },
          createdAt: {
            $gte: new Date(`${selectedYear}-01-01`),
            $lt: new Date(`${selectedYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 },
          totalItemsSold: { $sum: { $sum: "$items.qty" } }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get monthly costs (purchase costs, transport, other costs)
    const monthlyCosts = await InventoryPurchase.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${selectedYear}-01-01`),
            $lt: new Date(`${selectedYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          totalPurchaseCost: { $sum: { $add: ["$transportCost", "$otherCost"] } },
          totalProductCost: { $sum: { $multiply: ["$quantity", "$unitPrice"] } }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get monthly expenses
    const monthlyExpenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${selectedYear}-01-01`),
            $lt: new Date(`${selectedYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          totalExpenses: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get daily revenue for the selected month
    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 1);

    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          status: { $ne: "cancelled" },
          createdAt: {
            $gte: startOfMonth,
            $lt: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$createdAt" },
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get daily costs for the selected month
    const dailyCosts = await InventoryPurchase.aggregate([
      {
        $match: {
          date: {
            $gte: startOfMonth,
            $lt: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          totalPurchaseCost: { $sum: { $add: ["$transportCost", "$otherCost"] } },
          totalProductCost: { $sum: { $multiply: ["$quantity", "$unitPrice"] } }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get daily expenses for the selected month
    const dailyExpenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: startOfMonth,
            $lt: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          totalExpenses: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Combine monthly data
    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const sales = monthlyRevenue.find(r => r._id === m);
      const costs = monthlyCosts.find(c => c._id === m);
      const expenses = monthlyExpenses.find(e => e._id === m);

      const totalSales = sales?.totalSales || 0;
      const totalCosts = (costs?.totalPurchaseCost || 0) + (costs?.totalProductCost || 0) + (expenses?.totalExpenses || 0);
      const netRevenue = totalSales - totalCosts;

      monthlyData.push({
        month: m,
        monthName: new Date(selectedYear, m - 1).toLocaleString('default', { month: 'long' }),
        totalSales,
        totalCosts,
        netRevenue,
        orderCount: sales?.orderCount || 0,
        itemsSold: sales?.totalItemsSold || 0
      });
    }

    // Combine daily data for selected month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyData = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const sales = dailyRevenue.find(r => r._id === d);
      const costs = dailyCosts.find(c => c._id === d);
      const expenses = dailyExpenses.find(e => e._id === d);

      const totalSales = sales?.totalSales || 0;
      const totalCosts = (costs?.totalPurchaseCost || 0) + (costs?.totalProductCost || 0) + (expenses?.totalExpenses || 0);
      const netRevenue = totalSales - totalCosts;

      dailyData.push({
        day: d,
        date: new Date(selectedYear, selectedMonth - 1, d).toISOString().split('T')[0],
        totalSales,
        totalCosts,
        netRevenue,
        orderCount: sales?.orderCount || 0
      });
    }

    // Calculate totals for selected month
    const monthTotal = {
      totalSales: dailyData.reduce((sum, day) => sum + day.totalSales, 0),
      totalCosts: dailyData.reduce((sum, day) => sum + day.totalCosts, 0),
      netRevenue: dailyData.reduce((sum, day) => sum + day.netRevenue, 0),
      totalOrders: dailyData.reduce((sum, day) => sum + day.orderCount, 0)
    };

    // Calculate totals for selected year
    const yearTotal = {
      totalSales: monthlyData.reduce((sum, month) => sum + month.totalSales, 0),
      totalCosts: monthlyData.reduce((sum, month) => sum + month.totalCosts, 0),
      netRevenue: monthlyData.reduce((sum, month) => sum + month.netRevenue, 0),
      totalOrders: monthlyData.reduce((sum, month) => sum + month.orderCount, 0)
    };

    res.status(200).json({
      success: true,
      currentSelection: {
        year: selectedYear,
        month: selectedMonth,
        monthName: new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })
      },
      monthlyData,
      dailyData,
      monthTotal,
      yearTotal,
      availableYears: await getAvailableYears()
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Helper function to get available years
const getAvailableYears = async () => {
  try {
    const orderYears = await Order.aggregate([
      { $group: { _id: { $year: "$createdAt" } } },
      { $sort: { "_id": -1 } }
    ]);

    const purchaseYears = await InventoryPurchase.aggregate([
      { $group: { _id: { $year: "$date" } } },
      { $sort: { "_id": -1 } }
    ]);

    const allYears = [...new Set([
      ...orderYears.map(y => y._id),
      ...purchaseYears.map(y => y._id)
    ])].sort((a, b) => b - a);

    return allYears.length > 0 ? allYears : [new Date().getFullYear()];
  } catch (error) {
    console.error("Get available years error:", error);
    return [new Date().getFullYear()];
  }
};

// POST /api/dashboard/product-view/:productId
export const incrementProductView = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ success: true, views: product.views });
  } catch (error) {
    console.error("Increment view error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

