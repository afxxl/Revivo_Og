const User = require("../../models/userSchema.js");
const Order = require("../../models/orderSchema.js");
const Product = require("../../models/productSchema.js");
const Coupon = require("../../models/couponSchema.js");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const moment = require("moment");

const pageerror = async (req, res) => {
  res.render("admin-error");
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.session.admin = admin._id;

    return res.json({
      success: true,
      message: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const { filter = "daily", startDate, endDate } = req.query;

      // Calculate date ranges based on filter
      let dateFilter = {};
      let timeFormat = "%Y-%m-%d";
      let groupByFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdOn" },
      };

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (filter === "custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        dateFilter = {
          createdOn: {
            $gte: start,
            $lte: end,
          },
        };
      } else if (filter === "yearly") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = {
          createdOn: { $gte: startOfYear },
        };
        timeFormat = "%Y-%m";
        groupByFormat = {
          $dateToString: { format: "%Y-%m", date: "$createdOn" },
        };
      } else if (filter === "weekly") {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        dateFilter = {
          createdOn: { $gte: startOfWeek },
        };
      } else {
        // daily (default)
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        dateFilter = {
          createdOn: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        };
      }

      // Get order statistics
      const matchFilter = {
        ...dateFilter,
        status: { $nin: ["Cancelled", "Returned"] },
      };
      const orderStats = await Order.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: groupByFormat,
            count: { $sum: 1 },
            revenue: { $sum: "$finalAmount" },
            discount: { $sum: "$discount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Get payment method distribution
      const paymentMethodStats = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
            amount: { $sum: "$finalAmount" },
          },
        },
      ]);

      // Get order status distribution
      const orderStatusStats = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      // Get coupon usage statistics
      const couponStats = await Order.aggregate([
        { $match: { ...dateFilter, couponApplied: true } },
        {
          $group: {
            _id: "$couponCode",
            count: { $sum: 1 },
            totalDiscount: { $sum: "$discount" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      // Get total statistics
      const totalStats = await Promise.all([
        Order.countDocuments(matchFilter), // Changed from dateFilter to matchFilter
        Order.aggregate([
          { $match: matchFilter }, // Filter out cancelled orders for revenue
          { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]),
        Order.aggregate([
          { $match: matchFilter }, // Filter out cancelled orders for discount
          { $group: { _id: null, total: { $sum: "$discount" } } },
        ]),
      ]);
      const dashboardData = {
        currentPage: "dashboard",
        orderStats,
        paymentMethodStats,
        orderStatusStats,
        couponStats,
        totalOrders: totalStats[0],
        totalRevenue: totalStats[1][0]?.total || 0,
        totalDiscount: totalStats[2][0]?.total || 0,
        filter,
        startDate: startDate || "",
        endDate: endDate || "",
        moment,
      };

      res.render("dashboard", dashboardData);
    } catch (err) {
      console.error("Dashboard error:", err);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageerror");
      }
      return res.redirect("/admin/login");
    });
  } catch (err) {
    console.log("Logout error", err);
    res.redirect("/pageerror");
  }
};

// Function to generate dashboard data for export
const exportDashboardData = async (req, res) => {
  try {
    const { filter = "daily", startDate, endDate, format = "pdf" } = req.query;

    // Calculate date ranges based on filter (same logic as loadDashboard)
    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdOn: {
          $gte: start,
          $lte: end,
        },
      };
    } else if (filter === "yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = {
        createdOn: { $gte: startOfYear },
      };
    } else if (filter === "weekly") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      dateFilter = {
        createdOn: { $gte: startOfWeek },
      };
    } else {
      // daily (default)
      const startOfDay = new Date(today);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      dateFilter = {
        createdOn: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      };
    }

    // Get detailed order data for export
    const orders = await Order.find(dateFilter)
      .populate("user", "name email")
      .populate("couponId", "code discountType discountValue")
      .sort({ createdOn: -1 })
      .lean();

    // Format data based on requested export format
    if (format === "excel") {
      const excel = require("exceljs");
      const workbook = new excel.Workbook();
      const worksheet = workbook.addWorksheet("Dashboard Report");

      // Add headers
      worksheet.columns = [
        { header: "Order ID", key: "orderId", width: 15 },
        { header: "Customer", key: "customer", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Payment Method", key: "paymentMethod", width: 15 },
        { header: "Total Amount", key: "amount", width: 15 },
        { header: "Discount", key: "discount", width: 15 },
        { header: "Coupon", key: "coupon", width: 15 },
      ];

      // Add rows
      orders.forEach((order) => {
        worksheet.addRow({
          orderId: order.orderId,
          customer: order.user
            ? `${order.user.name} (${order.user.email})`
            : "Unknown",
          date: moment(order.createdOn).format("YYYY-MM-DD"),
          status: order.status,
          paymentMethod: order.paymentMethod,
          amount: order.finalAmount,
          discount: order.discount,
          coupon: order.couponCode || "None",
        });
      });

      // Set response headers
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=dashboard-report-${moment().format("YYYY-MM-DD")}.xlsx`,
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // PDF
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument();

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=dashboard-report-${moment().format("YYYY-MM-DD")}.pdf`,
      );

      // Pipe to response
      doc.pipe(res);

      // Add title
      doc.fontSize(16).text("Dashboard Report", { align: "center" });
      doc.moveDown();

      // Add date range
      let dateRangeText = "";
      if (filter === "custom") {
        dateRangeText = `${moment(startDate).format("YYYY-MM-DD")} to ${moment(endDate).format("YYYY-MM-DD")}`;
      } else {
        dateRangeText =
          filter.charAt(0).toUpperCase() + filter.slice(1) + " Report";
      }
      doc.fontSize(12).text(dateRangeText, { align: "center" });
      doc.moveDown();

      // Add summary
      const totalRevenue = orders.reduce(
        (sum, order) => sum + order.finalAmount,
        0,
      );
      const totalDiscount = orders.reduce(
        (sum, order) => sum + order.discount,
        0,
      );

      doc.fontSize(12).text(`Total Orders: ${orders.length}`);
      doc.fontSize(12).text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`);
      doc.fontSize(12).text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
      doc.moveDown();

      // Add orders table
      const tableTop = 200;
      const itemsPerPage = 20;
      let currentPage = 1;
      let yPosition = tableTop;

      // Table headers
      doc.fontSize(10);
      doc.text("Order ID", 50, yPosition);
      doc.text("Date", 150, yPosition);
      doc.text("Status", 220, yPosition);
      doc.text("Amount", 290, yPosition);
      doc.text("Discount", 360, yPosition);
      doc.text("Payment", 430, yPosition);

      yPosition += 20;

      // Table rows
      orders.forEach((order, index) => {
        if (index > 0 && index % itemsPerPage === 0) {
          // Add new page
          doc.addPage();
          yPosition = 50;

          // Add headers on new page
          doc.text("Order ID", 50, yPosition);
          doc.text("Date", 150, yPosition);
          doc.text("Status", 220, yPosition);
          doc.text("Amount", 290, yPosition);
          doc.text("Discount", 360, yPosition);
          doc.text("Payment", 430, yPosition);

          yPosition += 20;
        }

        doc.text(order.orderId, 50, yPosition);
        doc.text(moment(order.createdOn).format("YYYY-MM-DD"), 150, yPosition);
        doc.text(order.status, 220, yPosition);
        doc.text(`₹${order.finalAmount.toFixed(2)}`, 290, yPosition);
        doc.text(`₹${order.discount.toFixed(2)}`, 360, yPosition);
        doc.text(order.paymentMethod, 430, yPosition);

        yPosition += 20;
      });

      // Finalize PDF
      doc.end();
    }
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  exportDashboardData,
};
