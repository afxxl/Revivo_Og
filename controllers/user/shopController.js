const Product = require("../../models/productSchema.js");
const Brand = require("../../models/brandSchema.js");
const Category = require("../../models/categorySchema.js");
const Cart = require("../../models/cartSchema.js");
const Address = require("../../models/addressSchema.js");
const User = require("../../models/userSchema.js");
const Order = require("../../models/orderSchema.js");
const Payment = require("../../models/paymentSchema.js");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const filters = {
      category: req.query.category,
      brand: req.query.brand,
      size: req.query.size,
      condition: req.query.condition,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      heritage: req.query.heritage,
      status: req.query.status || "Available",
    };
    const categories = await Category.find({ isListed: true }).lean();
    const brands = await Brand.find({}).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);

    let query = { status: "Available", category: { $in: listedCategoryIds } };

    if (req.query.category && filters.category !== "all") {
      query.category = filters.category;
    }
    if (filters.brand) query.brand = filters.brand;
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.heritage) query.heritage = filters.heritage;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("shop", {
      products,
      categories,
      brands,
      selectedCategory: filters.category || "all",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (error) {
    console.error("Error fetching shop data:", error);
    res.status(500).send("Server Error");
  }
};
const loadBrandPage = async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const brand = await Brand.findById(brandId).lean();
    if (!brand) {
      return res.status(404).render("page-404");
    }

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      brand: brandId,
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("brand", {
      brand,
      products,
      title: `${brand.brandName} | REVIVO`,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("page-404");
  }
};

//heritage

const loadPrimeLayers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    let query = {
      heritage: "Prime Layers",
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("prime-layers", {
      products,
      title: "Prime Layers Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Prime Layers:", err);
    res.status(500).send("Server Error");
  }
};

const loadVintageAthletics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      heritage: "Vintage Athletics",
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("vintage-athletics", {
      products,
      title: "Vintage Athletics Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Vintage Athletics:", err);
    res.status(500).send("Server Error");
  }
};

const loadY2kEssentials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      heritage: "Y2K Essentials",
      status: "Available",
      category: { $in: listedCategoryIds },
    };

    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("y2k-essentials", {
      products,
      title: "Y2K Essentials Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Y2K Essentials:", err);
    res.status(500).send("Server Error");
  }
};

//Cart

const loadCartPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    if (!cart) {
      return res.render("cart", {
        cart: { items: [] },
        subtotal: 0,
        total: 0,
        canCheckout: true,
      });
    }

    let canCheckout = true;
    const updatedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);

      if (!product || product.stock === 0 || product.status !== "Available") {
        canCheckout = false;
        item.unavailable = true;
      } else {
        item.quantity = Math.min(item.quantity, product.stock);
        item.maxStock = product.stock;
      }
      updatedItems.push(item);
    }

    const subtotal = updatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const shipping = subtotal > 0 ? 5 : 0;
    const total = subtotal + shipping;

    res.render("cart", {
      cart: {
        ...cart,
        items: updatedItems,
      },
      subtotal,
      shipping,
      total,
      canCheckout,
    });
  } catch (err) {
    console.log("Error loading cart:", err);
    res.status(500).render("page-404", { message: "Error loading cart" });
  }
};

const updateCart = async (req, res) => {
  try {
    const { items } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to update cart",
      });
    }

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) cart = new Cart({ userId, items: [] });

    for (const item of items) {
      const product = await Product.findOne({
        _id: item.productId,
        status: "Available",
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "The product is no longer available",
          productId: item.productId,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available for "${product.productName}"`,
          productId: item.productId,
          availableStock: product.stock,
        });
      }
    }
    cart.items = items.map((item) => {
      const existingItem = cart.items.find(
        (i) => i.productId._id.toString() === item.productId,
      );

      if (existingItem) {
        return {
          ...existingItem.toObject(),
          quantity: item.quantity,
          totalPrice: item.quantity * existingItem.price,
        };
      } else {
        const product = cart.items.find(
          (i) => i.productId._id.toString() === item.productId,
        )?.productId;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.salesPrice,
          totalPrice: item.quantity * product.salesPrice,
        };
      }
    });

    await cart.save();

    const updatedCart = await Cart.findById(cart._id).populate(
      "items.productId",
    );

    const cartCount = updatedCart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const subtotal = updatedCart.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const shipping = subtotal > 0 ? 5 : 0;
    const total = subtotal + shipping;

    res.json({
      success: true,
      cart: {
        items: updatedCart.items,
        subtotal,
        shipping,
        total,
      },
      cartCount,
    });
  } catch (err) {
    console.error("Error updating cart:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update cart",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );

    await cart.save();

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shipping = subtotal > 0 ? 5 : 0;
    const total = subtotal + shipping;

    const updatedCart = await Cart.findOne({ userId });
    const cartCount = updatedCart
      ? updatedCart.items.reduce((sum, item) => sum + item.quantity, 0)
      : 0;

    res.json({
      success: true,
      cart: {
        items: cart.items,
        subtotal,
        shipping,
        total,
      },
      cartCount,
    });
  } catch (err) {
    console.log("Error removing from cart:", err);
    res.status(500).json({
      success: false,
      message: "Error removing from cart",
    });
  }
};

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const user = await User.findById(userId).populate("addresses").lean();

    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .lean();

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shipping = subtotal > 0 ? 5 : 0;
    const total = subtotal + shipping;
    res.render("checkout", {
      user,
      cart,
      subtotal,
      shipping,
      total,
    });
  } catch (err) {
    console.error("Error loading checkout:", err);
    res.status(500).render("page-404", { message: "Error loading checkout" });
  }
};

const createOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a delivery address",
      });
    }

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    let subtotal = 0;
    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.stock === 0 || product.status !== "Available") {
        return res.status(400).json({
          success: false,
          message: `"${product.productName}" is no longer available`,
          productId: product._id,
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available for ${product.productName}`,
        });
      }
      subtotal += item.totalPrice;
    }

    const shipping = 5;
    const totalPrice = subtotal;
    const finalAmount = subtotal + shipping;

    const order = new Order({
      user: userId,
      address: addressId,
      orderItems: cart.items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      discount: 0,
      finalAmount,
      paymentMethod: "COD",
      status: "Pending",
    });

    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } },
      );
    }

    await order.save();
    await User.findByIdAndUpdate(userId, {
      $push: { orders: order._id },
    });
    await Cart.deleteOne({ userId });

    res.json({
      success: true,
      orderId: order._id,
      redirectUrl: `/order-confirmation/${order._id}`,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

const loadOrderConfirmation = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("user")
      .populate("address")
      .populate({
        path: "orderItems.product",
        model: "Product",
      })
      .lean();

    if (!order) {
      return res.status(404).render("page-404");
    }

    res.render("order-confirmation", {
      orderId: order._id,
      orderDate: order.createdOn,
      deliveryAddress: order.address,
      items: order.orderItems,
      total: order.finalAmount,
      paymentMethod: order.paymentMethod,
    });
  } catch (err) {
    console.error("Error loading order confirmation:", err);
    res.status(500).render("page-404");
  }
};

const orderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("user")
      .populate("address")
      .populate({
        path: "orderItems.product",
        model: "Product",
      });

    if (!order) {
      return res.status(404).render("page-404");
    }

    res.render("order-details", { order });
  } catch (err) {
    console.log("Error fetching order details:", err);
    res.status(500).render("page-404");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ orderId, user: userId }).populate(
      "orderItems.product",
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!["Pending", "Confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = "Cancelled";
    order.cancelReason = reason;
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (err) {
    console.error("Error cancelling order:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};
const requestReturn = async (req, res) => {
  try {
    const { reason } = req.body;
    const orderId = req.params.orderId;
    const userId = req.session.user;

    console.log("Return request received:", { orderId, userId, reason });

    const order = await Order.findOne({ orderId, user: userId });

    if (!order) {
      console.log("Order not found");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("Current order status:", order.status);

    if (order.status !== "Delivered") {
      console.log("Invalid status for return:", order.status);
      return res.status(400).json({
        success: false,
        message: "Returns can only be requested for delivered orders",
        currentStatus: order.status,
      });
    }

    order.status = "Return Requested";
    order.return = {
      requested: true,
      reason,
      status: "pending",
      requestedAt: new Date(),
    };

    await order.save();

    console.log("Return request processed successfully");
    res.json({
      success: true,
      message: "Return request submitted for admin approval",
    });
  } catch (err) {
    console.error("Error requesting return:", err);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

const generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ orderId, user: userId })
      .populate("user")
      .populate("address")
      .populate({
        path: "orderItems.product",
        model: "Product",
      });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Delivered" && order.status !== "Returned") {
      return res.status(400).json({
        success: false,
        message: "Invoice is only available for delivered orders",
      });
    }

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${order.orderId}.pdf"`,
    );

    doc.pipe(res);

    doc.fontSize(20).text("REVIVO", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text("INVOICE", { align: "center", underline: true });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice #: ${order.orderId}`);
    doc.text(`Date: ${order.createdOn.toLocaleDateString()}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    doc.fontSize(14).text("Customer Information", { underline: true });
    doc.fontSize(12).text(`Name: ${order.address.name}`);
    doc.text(`Address: ${order.address.address}`);
    doc.text(
      `City: ${order.address.city}, ${order.address.state} ${order.address.pincode}`,
    );
    doc.text(`Phone: ${order.address.phone}`);
    doc.moveDown();

    doc.fontSize(14).text("Order Items", { underline: true });
    doc.moveDown();

    doc.font("Helvetica-Bold");
    doc.text("Item", 50, doc.y);
    doc.text("Quantity", 300, doc.y);
    doc.text("Price", 400, doc.y, { width: 100, align: "right" });
    doc.moveDown();

    doc.font("Helvetica");
    order.orderItems.forEach((item) => {
      doc.text(item.product.productName, 50, doc.y);
      doc.text(item.quantity.toString(), 300, doc.y);
      doc.text(`$${item.price.toFixed(2)}`, 400, doc.y, {
        width: 100,
        align: "right",
      });
      doc.moveDown();
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").text("Order Summary", { underline: true });
    doc.moveDown();
    doc.font("Helvetica");
    doc.text(`Subtotal: $${order.totalPrice.toFixed(2)}`, { align: "right" });
    doc.text(`Shipping: $5.00`, { align: "right" });
    doc.moveDown();
    doc
      .font("Helvetica-Bold")
      .text(`Total: $${order.finalAmount.toFixed(2)}`, { align: "right" });
    doc.moveDown();

    doc
      .fontSize(10)
      .text("Thank you for shopping with REVIVO!", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Error generating invoice:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate invoice" });
  }
};

module.exports = {
  shopPage,
  loadBrandPage,
  loadPrimeLayers,
  loadVintageAthletics,
  loadY2kEssentials,
  loadCartPage,
  updateCart,
  removeFromCart,
  createOrder,
  loadCheckoutPage,
  loadOrderConfirmation,
  orderDetails,
  cancelOrder,
  requestReturn,
  generateInvoice,
};
