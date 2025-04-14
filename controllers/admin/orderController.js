const Order = require("../../models/orderSchema.js");
const mongoose = require("mongoose");
const Product = require("../../models/productSchema.js");

const loadOrderDetails = async (req, res) => {
  try {
    const { page = 1, search } = req.query;
    const perPage = 5;
    const skip = (page - 1) * perPage;

    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, "i");

      const matchingUsers = await mongoose
        .model("User")
        .find({
          $or: [{ name: searchRegex }, { email: searchRegex }],
        })
        .select("_id");

      const userIds = matchingUsers.map((user) => user._id);

      query = {
        $or: [
          { orderId: searchRegex },
          { status: searchRegex },
          { user: { $in: userIds } },
        ],
      };
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email")
        .populate("address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.render("orders", {
      orders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / perPage),
      search,
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).render("page-404");
  }
};

const orderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user")
      .populate("address")
      .populate({
        path: "orderItems.product",
        model: "Product",
      })
      .lean();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("admin-order-details", {
      order,
      currentPage: "orders",
    });
  } catch (err) {
    console.error("Error fetching order details:", err);
    res.status(500).render("admin-error");
  }
};

const handleReturn = async (req, res) => {
  try {
    const { action } = req.body;
    const order = await Order.findById(req.params.id).populate(
      "orderItems.product",
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Return Requested") {
      return res.status(400).json({
        success: false,
        message: "No pending return request for this order",
      });
    }

    if (action === "approve") {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: item.quantity },
        });
      }

      order.status = "Returned";
      order.return = {
        ...order.return,
        status: "approved",
        processedAt: new Date(),
      };
    } else {
      order.status = "Delivered";
      order.return = {
        ...order.return,
        status: "rejected",
        processedAt: new Date(),
      };
    }

    await order.save();

    res.json({
      success: true,
      message: `Return request ${action}d successfully`,
    });
  } catch (err) {
    console.error("Error handling return:", err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "Delivered" && status !== "Return Request") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify status after delivery except for returns",
      });
    }

    if (order.status === "Returned") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify status of returned orders",
      });
    }

    const validTransitions = {
      Pending: ["Confirmed", "Cancelled"],
      Confirmed: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: ["Return Request"],
      "Return Request": ["Returned", "Delivered"],
      Returned: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`,
        allowedStatuses: validTransitions[order.status],
      });
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  loadOrderDetails,
  orderDetails,
  handleReturn,
  updateStatus,
};
