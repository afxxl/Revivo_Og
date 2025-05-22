const Order = require("../../models/orderSchema.js");
const mongoose = require("mongoose");
const Product = require("../../models/productSchema.js");
const { processWalletRefund } = require("../user/walletController.js");

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
        populate: [
          { path: "brand", model: "Brand" },
          { path: "category", model: "Category" },
        ],
      })
      .lean();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    let paymentDetails = null;
    if (order.paymentMethod === "RAZORPAY") {
      const Payment = require("../../models/paymentSchema.js");

      const paymentQueries = [
        { orderId: order._id },
        { orderId: order._id.toString() },
        { "razorpay.orderId": { $regex: new RegExp(order.orderId, "i") } },
        { transactionId: { $regex: new RegExp(order.orderId, "i") } },
        { method: "RAZORPAY", userId: order.user._id },
      ];

      for (const query of paymentQueries) {
        paymentDetails = await Payment.findOne(query).lean();
        if (paymentDetails) break;
      }

      if (!paymentDetails) {
        paymentDetails = await Payment.findOne({
          userId: order.user._id,
          method: "RAZORPAY",
        })
          .sort({ createdAt: -1 })
          .lean();
      }

      if (paymentDetails) {
        const updateData = {};
        let needsUpdate = false;

        if (!paymentDetails.orderId) {
          updateData.orderId = order._id;
          needsUpdate = true;
        }

        if (
          paymentDetails.transactionId &&
          !paymentDetails.razorpay?.paymentId
        ) {
          updateData["razorpay.paymentId"] = paymentDetails.transactionId;
          needsUpdate = true;
        } else if (
          !paymentDetails.transactionId &&
          paymentDetails.razorpay?.paymentId
        ) {
          updateData.transactionId = paymentDetails.razorpay.paymentId;
          needsUpdate = true;
        }

        if (
          (!paymentDetails.transactionId ||
            !paymentDetails.razorpay?.paymentId) &&
          paymentDetails.razorpay?.orderId
        ) {
          const syntheticPaymentId = `pay_${paymentDetails.razorpay.orderId.substring(6)}`;

          if (!paymentDetails.transactionId) {
            updateData.transactionId = syntheticPaymentId;
            needsUpdate = true;
          }

          if (!paymentDetails.razorpay?.paymentId) {
            updateData["razorpay.paymentId"] = syntheticPaymentId;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await Payment.findByIdAndUpdate(paymentDetails._id, {
            $set: updateData,
          });

          paymentDetails = await Payment.findById(paymentDetails._id).lean();
        }

        if (
          order.status === "Cancelled" &&
          paymentDetails.status !== "Refunded"
        ) {
          await Payment.findByIdAndUpdate(paymentDetails._id, {
            $set: { status: "Refunded" },
          });
          paymentDetails.status = "Refunded";
        } else if (
          order.status === "Returned" &&
          paymentDetails.status !== "Refunded"
        ) {
          await Payment.findByIdAndUpdate(paymentDetails._id, {
            $set: { status: "Refunded" },
          });
          paymentDetails.status = "Refunded";
        } else if (
          [
            "Pending",
            "Confirmed",
            "Shipped",
            "Out for Delivery",
            "Delivered",
          ].includes(order.status) &&
          paymentDetails.status !== "Completed"
        ) {
          await Payment.findByIdAndUpdate(paymentDetails._id, {
            $set: { status: "Completed" },
          });
          paymentDetails.status = "Completed";
        }
      }
    }

    res.render("admin-order-details", {
      order,
      paymentDetails,
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

      if (
        order.paymentMethod === "WALLET" ||
        order.paymentMethod === "CARD" ||
        order.paymentMethod === "PAYPAL" ||
        order.paymentMethod === "COD" ||
        order.paymentMethod === "RAZORPAY"
      ) {
        console.log(
          `Processing return refund for order: ${order.orderId}, userId: ${order.user}, amount: ${order.finalAmount}`,
        );

        if (order.paymentMethod === "RAZORPAY") {
          const Payment = require("../../models/paymentSchema.js");
          const payment = await Payment.findOne({ orderId: order._id });

          if (payment && payment.razorpay && payment.razorpay.paymentId) {
            try {
              const Razorpay = require("razorpay");
              const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
              });

              console.log(
                `Return: Initiating Razorpay refund for payment: ${payment.razorpay.paymentId}`,
              );

              try {
                const razorpayRefund = await razorpay.payments.refund(
                  payment.razorpay.paymentId,
                  {
                    amount: Math.round(order.finalAmount * 100),
                    notes: {
                      orderId: order.orderId,
                      reason: "Return approved",
                    },
                  },
                );

                payment.status = "Refunded";
                payment.refund = {
                  refundId: razorpayRefund.id,
                  amount: order.finalAmount,
                  createdAt: new Date(),
                  reason: "Return approved",
                };
                await payment.save();
              } catch (razorpayError) {
                console.error(
                  "Error with Razorpay API during return:",
                  razorpayError,
                );
              }
            } catch (refundError) {
              console.error(
                "Error processing Razorpay refund for return:",
                refundError,
              );
            }
          }
        }

        const userIdStr = order.user.toString();
        console.log(`Adding return refund to wallet for user: ${userIdStr}`);

        const refundResult = await processWalletRefund(
          userIdStr,
          order.finalAmount,
          `Refund for order #${order.orderId} (Return)`,
        );

        console.log("Return wallet refund result:", refundResult);
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

    if (status === "Cancelled") {
      if (
        ["WALLET", "CARD", "PAYPAL", "RAZORPAY"].includes(order.paymentMethod)
      ) {
        if (order.paymentMethod === "RAZORPAY") {
          const Payment = require("../../models/paymentSchema.js");
          const payment = await Payment.findOne({ orderId: order._id });

          if (payment && payment.razorpay && payment.razorpay.paymentId) {
            try {
              const Razorpay = require("razorpay");
              const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
              });

              const razorpayRefund = await razorpay.payments.refund(
                payment.razorpay.paymentId,
                {
                  amount: Math.round(order.finalAmount * 100),
                  notes: {
                    orderId: order.orderId,
                    reason: "Order cancelled by admin",
                  },
                },
              );

              const userIdStr = order.user.toString();

              const refundResult = await processWalletRefund(
                userIdStr,
                order.finalAmount,
                `Refund for cancelled Razorpay order #${order.orderId} (by admin)`,
              );

              console.log("Admin wallet refund result:", refundResult);

              payment.status = "Refunded";
              payment.refund = {
                refundId: razorpayRefund.id,
                amount: order.finalAmount,
                createdAt: new Date(),
                reason: "Order cancelled by admin",
              };
              await payment.save();
            } catch (refundError) {
              const refundResult = await processWalletRefund(
                order.user.toString(),
                order.finalAmount,
                `Refund for cancelled order #${order.orderId} (Razorpay refund failed)`,
              );
            }
          } else {
            const refundResult = await processWalletRefund(
              order.user.toString(),
              order.finalAmount,
              `Refund for cancelled order #${order.orderId} (by admin)`,
            );
          }
        } else {
          console.log(
            `Admin processing non-Razorpay refund for user: ${order.user.toString()}, amount: ${order.finalAmount}`,
          );
          const refundResult = await processWalletRefund(
            order.user.toString(),
            order.finalAmount,
            `Refund for cancelled order #${order.orderId} (by admin)`,
          );
          console.log("Admin non-Razorpay wallet refund result:", refundResult);
        }
      }

      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }
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
