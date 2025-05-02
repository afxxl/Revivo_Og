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
      const totalProducts = await Product.countDocuments();

      const totalUsers = await User.countDocuments({ isAdmin: false });

      const totalOrdersExcludingCancelledAndReturned =
        await Order.countDocuments({
          status: { $nin: ["Cancelled", "Returned"] },
        });

      const orderStatusStats = await Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      res.render("dashboard", {
        totalProducts,
        totalUsers,
        totalOrdersExcludingCancelledAndReturned,
        orderStatusStats,
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).render("admin-error", {
        message: "Failed to load dashboard",
      });
    }
  } else {
    res.redirect("/admin/login");
  }
};

const loadSalesReport = async (req, res) => {
  if (req.session.admin) {
    try {
      const { filter = "daily", startDate, endDate } = req.query;

      let dateFilter = {};
      let timeFormat = "%Y-%m-%d";
      let groupByFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdOn" },
      };
      let dateRange = [];

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Helper function to generate date range
      const generateDateRange = (start, end, format) => {
        const dates = [];
        let currentDate = new Date(start);
        while (currentDate <= end) {
          if (format === "%Y-%m") {
            dates.push(
              `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
            );
            currentDate.setMonth(currentDate.getMonth() + 1);
          } else {
            dates.push(
              `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(
                currentDate.getDate(),
              ).padStart(2, "0")}`,
            );
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
        return dates;
      };

      // Set date filter and generate date range
      if (filter === "custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter = { createdOn: { $gte: start, $lte: end } };
        dateRange = generateDateRange(start, end, timeFormat);
      } else if (filter === "yearly") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        dateFilter = { createdOn: { $gte: startOfYear } };
        timeFormat = "%Y-%m";
        groupByFormat = {
          $dateToString: { format: "%Y-%m", date: "$createdOn" },
        };
        dateRange = generateDateRange(startOfYear, endOfYear, timeFormat);
      } else if (filter === "weekly") {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        dateFilter = { createdOn: { $gte: startOfWeek } };
        dateRange = generateDateRange(startOfWeek, endOfWeek, timeFormat);
      } else {
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter = { createdOn: { $gte: startOfDay, $lte: endOfDay } };
        dateRange = generateDateRange(startOfDay, endOfDay, timeFormat);
      }

      const matchFilter = { ...dateFilter, status: "Delivered" };
      const orderStatsRaw = await Order.aggregate([
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

      const orderStats = dateRange.map((date) => {
        const stat = orderStatsRaw.find((stat) => stat._id === date);
        return stat || { _id: date, count: 0, revenue: 0, discount: 0 };
      });

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

      const orderStatusStats = await Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const couponStats = await Order.aggregate([
        { $match: { ...dateFilter, couponApplied: true } },
        {
          $group: {
            _id: "$couponCode",
            count: { $sum: 1 },
            totalDiscount: { $sum: "$discount" },
          },
        },
        { $sort: { totalDiscount: -1 } },
        { $limit: 5 },
      ]);

      const topCategories = await Order.aggregate([
        { $match: { status: "Delivered", ...dateFilter } },
        { $unwind: "$orderItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "categories",
            localField: "product.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category._id",
            categoryName: { $first: "$category.name" },
            totalSales: { $sum: "$orderItems.price" },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
      ]);

      // Get top 5 products by sales
      const topProducts = await Order.aggregate([
        { $match: { status: "Delivered", ...dateFilter } },
        { $unwind: "$orderItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product._id",
            productName: { $first: "$product.productName" },
            totalSales: { $sum: "$orderItems.price" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      // Get top 5 brands by sales
      const topBrands = await Order.aggregate([
        { $match: { status: "Delivered", ...dateFilter } },
        { $unwind: "$orderItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "brands",
            localField: "product.brand",
            foreignField: "_id",
            as: "brand",
          },
        },
        { $unwind: "$brand" },
        {
          $group: {
            _id: "$brand._id",
            brandName: { $first: "$brand.brandName" },
            totalSales: { $sum: "$orderItems.price" },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
      ]);

      const totalRevenue = orderStats.reduce(
        (acc, curr) => acc + curr.revenue,
        0,
      );
      const totalOrders = orderStats.reduce((acc, curr) => acc + curr.count, 0);
      const totalDiscount = orderStats.reduce(
        (acc, curr) => acc + curr.discount,
        0,
      );

      res.render("sales-report", {
        orderStats,
        totalRevenue,
        totalOrders,
        totalDiscount,
        paymentMethodStats,
        orderStatusStats,
        couponStats,
        topCategories,
        topProducts,
        topBrands,
        filter,
        startDate: startDate || "",
        endDate: endDate || "",
      });
    } catch (err) {
      console.error("Sales Report error:", err);
      res
        .status(500)
        .render("admin-error", { message: "Failed to load sales report" });
    }
  } else {
    res.redirect("/admin/login");
  }
};

const logout = async (req, res) => {
  try {
    console.log("Before Admin Logout - Session ID:", req.sessionID);
    console.log("Admin Session data:", req.session);
    console.log("Cookies:", JSON.stringify(req.cookies, null, 2));

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Admin session destruction error:", err);
          return res.status(500).redirect("/admin/login");
        }

        res.clearCookie("admin.sid", { path: "/admin" });

        console.log("Admin session destroyed successfully");
        res.redirect("/admin/login");
      });
    } else {
      res.clearCookie("admin.sid", { path: "/admin" });
      res.redirect("/admin/login");
    }
  } catch (err) {
    console.error("Admin Logout error:", err);
    res.status(500).redirect("/admin/login");
  }
};

const exportDashboardData = async (req, res) => {
  try {
    try {
      require.resolve("pdfkit");
      require.resolve("exceljs");
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: "Missing dependencies. Run: npm install pdfkit exceljs",
      });
    }

    const { filter = "daily", startDate, endDate, format = "pdf" } = req.query;

    // Validate custom date filter
    if (filter === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: "Both startDate and endDate are required for custom filter",
      });
    }

    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Date filter configuration
    switch (filter) {
      case "custom":
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter = { createdOn: { $gte: start, $lte: end } };
        break;
      case "yearly":
        dateFilter = { createdOn: { $gte: new Date(now.getFullYear(), 0, 1) } };
        break;
      case "weekly":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        dateFilter = { createdOn: { $gte: startOfWeek } };
        break;
      default: // daily
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter = { createdOn: { $gte: startOfDay, $lte: endOfDay } };
    }

    // Generate date range text
    let dateRangeText;
    switch (filter) {
      case "custom":
        dateRangeText = `${moment(startDate).format("MMM D, YYYY")} - ${moment(endDate).format("MMM D, YYYY")}`;
        break;
      case "yearly":
        dateRangeText = `Year ${moment().format("YYYY")}`;
        break;
      case "weekly":
        dateRangeText = `Week of ${moment().startOf("week").format("MMM D")}`;
        break;
      default:
        dateRangeText = moment().format("MMM D, YYYY");
    }

    // Fetch orders
    const orders = await Order.find({
      ...dateFilter,
      status: "Delivered",
    })
      .populate("user", "name email")
      .sort({ createdOn: -1 })
      .lean();

    // Calculate totals with fallbacks
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.finalAmount || 0),
      0,
    );
    const totalDiscount = orders.reduce(
      (sum, order) => sum + (order.discount || 0),
      0,
    );

    if (format === "excel") {
      const excel = require("exceljs");
      const workbook = new excel.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      // Excel formatting
      worksheet.columns = [
        { header: "Order ID", key: "orderId", width: 20 },
        { header: "Customer", key: "customer", width: 25 },
        { header: "Date", key: "date", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Payment Method", key: "paymentMethod", width: 18 },
        {
          header: "Amount (₹)",
          key: "amount",
          width: 15,
          style: { numFmt: "#,##0.00" },
        },
        {
          header: "Discount (₹)",
          key: "discount",
          width: 15,
          style: { numFmt: "#,##0.00" },
        },
        { header: "Coupon Code", key: "coupon", width: 15 },
      ];

      if (orders.length > 0) {
        orders.forEach((order) => {
          worksheet.addRow({
            orderId: order.orderId,
            customer: order.user
              ? `${order.user.name} <${order.user.email}>`
              : "Guest",
            date: moment(order.createdOn).format("YYYY-MM-DD"),
            status: order.status,
            paymentMethod: order.paymentMethod,
            amount: order.finalAmount,
            discount: order.discount,
            coupon: order.couponCode || "N/A",
          });
        });
      } else {
        worksheet.addRow({
          orderId: "N/A",
          customer: "No Data",
          date: "N/A",
          status: "N/A",
          paymentMethod: "N/A",
          amount: 0,
          discount: 0,
          coupon: "N/A",
        });
      }

      // Set response headers
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Revivo-Sales-${moment().format("YYYY-MM-DD")}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      const PDFDocument = require("pdfkit");
      const path = require("path");
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      // PDF error handling
      doc.on("error", (err) => {
        console.error("PDF stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "PDF generation failed",
          });
        }
      });

      // PDF headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Revivo-Sales-${moment().format("YYYY-MM-DD")}.pdf`,
      );

      doc.pipe(res);

      // Register Google Fonts
      try {
        doc.registerFont(
          "HennyPenny-Regular",
          path.join(__dirname, "..", "..", "fonts", "HennyPenny-Regular.ttf"),
        );
        doc.registerFont(
          "DancingScript-Regular",
          path.join(
            __dirname,
            "..",
            "..",
            "fonts",
            "DancingScript-Regular.ttf",
          ),
        );
      } catch (err) {
        console.error("Font registration error:", err.message);
        doc.registerFont("HennyPenny-Regular", "Helvetica-Bold");
        doc.registerFont("DancingScript-Regular", "Times-Roman");
      }

      // PDF content
      // Header Section
      doc
        .fillColor("#10b981")
        .font("HennyPenny-Regular", 28)
        .text("Revivo", 50, 40, { align: "center" })
        .font("DancingScript-Regular", 16)
        .fillColor("#2C2C2C")
        .text("Sales Report", 50, 70, { align: "center" })
        .moveDown(0.5);

      // Gradient Header Background
      const gradient = doc.linearGradient(50, 100, 550, 100);
      gradient.stop(0, "#10b981").stop(1, "#059669");
      doc.rect(50, 100, 500, 40).fill(gradient);

      // Report Metadata
      doc
        .font("Helvetica", 10)
        .fillColor("#ffffff")
        .text(`Generated: ${moment().format("MMM D, YYYY h:mm A")}`, 60, 110)
        .text(`Period: ${dateRangeText}`, 60, 125)
        .moveDown(1);

      // Summary Section
      doc
        .font("Helvetica-Bold", 12)
        .fillColor("#2C2C2C")
        .text("Summary", 50, 160)
        .moveTo(50, 170)
        .lineTo(150, 170)
        .strokeColor("#10b981")
        .stroke();

      if (orders.length > 0) {
        doc
          .font("Helvetica", 10)
          .text(`Total Orders: ${orders.length}`, 50, 180)
          .text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, 50, 195)
          .text(`Total Discount: ₹${totalDiscount.toFixed(2)}`, 50, 210)
          .text(
            `Net Revenue: ₹${(totalRevenue - totalDiscount).toFixed(2)}`,
            50,
            225,
          )
          .moveDown(2);

        // Table Setup
        const tableConfig = {
          startY: 260,
          columns: [
            { header: "Order ID", width: 75, align: "left" },
            { header: "Date", width: 65, align: "left" },
            { header: "Status", width: 80, align: "center" },
            { header: "Amount", width: 80, align: "right" },
            { header: "Discount", width: 120, align: "right" },
            { header: "Payment", width: 100, align: "left" },
          ],
          rows: orders.map((order) => {
            const discountValue = `₹${order.discount.toFixed(2)}   `;
            return [
              order.orderId,
              moment(order.createdOn).format("MMM D, YY"),
              order.status,
              `₹${order.finalAmount.toFixed(2)}`,
              discountValue,
              order.paymentMethod,
            ];
          }),
        };

        // Draw Table Header
        let yPosition = tableConfig.startY;
        doc
          .rect(50, yPosition - 10, 520, 25)
          .fillColor("#10b981")
          .fill();
        doc.font("Helvetica-Bold", 10).fillColor("#ffffff");
        tableConfig.columns.forEach((col, i) => {
          const xPosition =
            50 +
            tableConfig.columns.slice(0, i).reduce((a, c) => a + c.width, 0);
          doc.text(col.header, xPosition, yPosition, {
            width: col.width,
            align: col.align,
          });
        });

        // Draw Table Rows
        doc.font("Helvetica", 9).fillColor("#2C2C2C");
        tableConfig.rows.forEach((row, rowIndex) => {
          yPosition += 25;
          if (yPosition > 720) {
            doc.addPage();
            yPosition = 50;
            // Redraw header on new page
            doc
              .rect(50, yPosition - 10, 520, 25)
              .fillColor("#10b981")
              .fill();
            doc.font("Helvetica-Bold", 10).fillColor("#ffffff");
            tableConfig.columns.forEach((col, i) => {
              const xPosition =
                50 +
                tableConfig.columns
                  .slice(0, i)
                  .reduce((a, c) => a + c.width, 0);
              doc.text(col.header, xPosition, yPosition, {
                width: col.width,
                align: col.align,
              });
            });
            yPosition += 25;
          }

          // Alternating row background
          if (rowIndex % 2 === 0) {
            doc
              .rect(50, yPosition - 10, 520, 25)
              .fillColor("#f8f8f8")
              .fill();
          }

          // Row content
          doc.fillColor("#2C2C2C");
          row.forEach((cell, cellIndex) => {
            const xPosition =
              50 +
              tableConfig.columns
                .slice(0, cellIndex)
                .reduce((a, c) => a + c.width, 0);
            const adjustedX = xPosition + (cellIndex === 5 ? 10 : 0);
            doc.text(cell, adjustedX, yPosition, {
              width: tableConfig.columns[cellIndex].width,
              align: tableConfig.columns[cellIndex].align,
            });
          });
        });
      } else {
        doc
          .font("Helvetica", 12)
          .fillColor("#2C2C2C")
          .text("No delivered orders found in the selected period.", 50, 180, {
            align: "center",
          })
          .moveDown(2);
      }

      // Footer with Branding
      doc
        .font("DancingScript-Regular", 12)
        .fillColor("#10b981")
        .text("Revivo - Empowering Sustainable Fashion", 50, 760, {
          align: "center",
        });

      // Subtle Watermark
      doc
        .font("HennyPenny-Regular", 40)
        .fillColor("#10b981")
        .opacity(0.1)
        .text("Revivo", 150, 400, { align: "center", rotate: -45 });

      doc.end();
    }
  } catch (err) {
    console.error("Export error:", {
      message: err.message,
      stack: err.stack,
      query: req.query,
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Export failed. Please check server logs",
        errorCode: "EXPORT_ERROR",
      });
    }
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  loadSalesReport,
  pageerror,
  logout,
  exportDashboardData,
};
