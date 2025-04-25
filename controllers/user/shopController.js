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
const Wallet = require("../../models/walletSchema");
const { deductFromWallet, processWalletRefund } = require("./walletController");
const mongoose = require("mongoose");
const Coupon = require("../../models/couponSchema.js");
const Razorpay = require("razorpay");

// Initialize Razorpay only if credentials are available
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 15;
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
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      status: "Available",
      isListed: true, // Ensure only listed products are fetched
      category: { $in: listedCategoryIds },
      brand: { $in: activeBrandIds },
    };

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

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true, // Ensure pagination counts only listed products
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("shop", {
      products,
      categories,
      brands: activeBrands,
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
    const perPage = 15;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);

    const brand = await Brand.findOne({ _id: brandId, isActive: true }).lean();
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
      isListed: true, // Ensure only listed products are fetched
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true, // Ensure pagination counts only listed products
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
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
    const perPage = 15;
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
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Prime Layers",
      status: "Available",
      isListed: true, // Ensure only listed products are fetched
      category: { $in: listedCategoryIds },
      brand: { $in: activeBrandIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true, // Ensure pagination counts only listed products
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
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
    const perPage = 15;
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
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Vintage Athletics",
      status: "Available",
      isListed: true, // Ensure only listed products are fetched
      category: { $in: listedCategoryIds },
      brand: { $in: activeBrandIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true, // Ensure pagination counts only listed products
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
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
    const perPage = 15;
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
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Y2K Essentials",
      status: "Available",
      isListed: true, // Ensure only listed products are fetched
      category: { $in: listedCategoryIds },
      brand: { $in: activeBrandIds },
    };

    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true, // Ensure pagination counts only listed products
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
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

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty items array",
      });
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Log incoming items for debugging
    console.log("Incoming items:", items);

    // Validate all items before updating
    for (const item of items) {
      if (!item.productId || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: "Invalid item: productId and quantity are required",
        });
      }

      const product = await Product.findOne({
        _id: item.productId,
        status: "Available",
        isListed: true,
      }).populate("category");

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `The product with ID ${item.productId} is no longer available`,
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

      // Enforce maximum purchase limit of 10 per product
      if (item.quantity > 10) {
        return res.status(400).json({
          success: false,
          message: `Maximum purchase limit is 10 items per product`,
          productId: item.productId,
        });
      }
    }

    // Update only the specified items, preserving others
    const updatedItems = [...cart.items];

    for (const item of items) {
      const existingItemIndex = updatedItems.findIndex(
        (i) => i.productId._id.toString() === item.productId.toString(),
      );

      if (existingItemIndex !== -1) {
        // Update existing item
        console.log(`Updating existing item: ${item.productId}`);
        const existingItem = updatedItems[existingItemIndex];

        // Get product and calculate best offer price
        const product = await Product.findById(item.productId).populate(
          "category",
        );
        const productOffer = product.productOffer || 0;
        const categoryOffer = product.category?.categoryOffer || 0;
        const bestOfferPercentage = Math.max(productOffer, categoryOffer);

        let finalPrice = product.salesPrice;
        if (bestOfferPercentage > 0) {
          const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
          finalPrice = product.salesPrice - offerAmount;
        }

        updatedItems[existingItemIndex] = {
          ...existingItem.toObject(),
          quantity: item.quantity,
          price: finalPrice,
          totalPrice: item.quantity * finalPrice,
        };
      } else {
        // Add new item
        console.log(`Adding new item: ${item.productId}`);
        const product = await Product.findById(item.productId).populate(
          "category",
        );
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Calculate best offer price
        const productOffer = product.productOffer || 0;
        const categoryOffer = product.category?.categoryOffer || 0;
        const bestOfferPercentage = Math.max(productOffer, categoryOffer);

        let finalPrice = product.salesPrice;
        if (bestOfferPercentage > 0) {
          const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
          finalPrice = product.salesPrice - offerAmount;
        }

        updatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: finalPrice,
          totalPrice: item.quantity * finalPrice,
        });
      }
    }

    // Set updated items to cart
    cart.items = updatedItems;

    // Log updated cart items
    console.log("Updated cart items:", cart.items);

    await cart.save();

    const updatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

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
    console.log("Error updating cart:", err);
    res.status(500).json({
      success: false,
      message: "Error updating cart",
    });
  }
};

const loadCartPage = async (req, res) => {
  try {
    const userId = req.session.user;

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

    if (!cart) {
      return res.render("cart", {
        cart: { items: [] },
        subtotal: 0,
        shipping: 0,
        total: 0,
        canCheckout: true,
        coupons: [],
        appliedCoupon: null,
      });
    }

    let canCheckout = true;
    const updatedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id).populate(
        "category",
      );
      if (
        !product ||
        product.stock === 0 ||
        product.status !== "Available" ||
        !product.isListed
      ) {
        continue;
      } else {
        item.quantity = Math.min(item.quantity, product.stock, 10);

        const productOffer = product.productOffer || 0;
        const categoryOffer = product.category?.categoryOffer || 0;
        const bestOfferPercentage = Math.max(productOffer, categoryOffer);

        let finalPrice = product.salesPrice;
        if (bestOfferPercentage > 0) {
          const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
          finalPrice = product.salesPrice - offerAmount;
        }

        item.price = finalPrice;
        item.totalPrice = item.quantity * finalPrice;
        item.maxStock = Math.min(product.stock, 10);
        updatedItems.push(item);
      }
    }

    if (updatedItems.length !== cart.items.length) {
      cart.items = updatedItems;
      await cart.save();
    }

    const subtotal = updatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const shipping = subtotal > 0 ? 5 : 0;

    const availableCoupons = await getAvailableCoupons(userId, subtotal);

    let appliedCoupon = null;
    let discount = 0;

    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(
        req.session.appliedCoupon.couponId,
      );

      if (
        sessionCoupon &&
        sessionCoupon.isActive &&
        subtotal >= sessionCoupon.minPurchase &&
        new Date() >= sessionCoupon.startDate &&
        new Date() <= sessionCoupon.endDate
      ) {
        // Calculate discount
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);

          // Apply max discount limit if set
          if (
            sessionCoupon.maxDiscount &&
            discount > sessionCoupon.maxDiscount
          ) {
            discount = sessionCoupon.maxDiscount;
          }
        } else {
          // fixed amount
          discount = sessionCoupon.discountAmount;
        }

        // Ensure discount doesn't exceed subtotal
        discount = Math.min(discount, subtotal);

        appliedCoupon = {
          code: sessionCoupon.code,
          id: sessionCoupon._id,
          discount: discount,
          discountType: sessionCoupon.discountType,
          discountAmount: sessionCoupon.discountAmount,
        };
      } else {
        // Clear invalid coupon from session
        delete req.session.appliedCoupon;
      }
    }

    const total =
      subtotal + shipping - (appliedCoupon ? appliedCoupon.discount : 0);

    res.render("cart", {
      cart: {
        ...cart.toObject(),
        items: updatedItems,
      },
      subtotal,
      shipping,
      total,
      canCheckout,
      coupons: availableCoupons,
      appliedCoupon,
    });
  } catch (err) {
    console.log("Error loading cart:", err);
    res.status(500).render("page-404", { message: "Error loading cart" });
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
      .populate({
        path: "items.productId",
        populate: [{ path: "brand" }, { path: "category" }],
      })
      .lean();

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // Validate cart items
    for (const item of cart.items) {
      const product = item.productId;
      if (
        !product.isListed ||
        !product.brand.isActive ||
        !product.category.isListed ||
        product.status !== "Available" ||
        product.stock < item.quantity
      ) {
        return res.render("cart", {
          cart,
          subtotal: 0,
          shipping: 0,
          total: 0,
          canCheckout: false,
          errorMessage: `Cannot proceed to checkout. "${product.productName}" is no longer available or invalid.`,
        });
      }
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shipping = subtotal > 0 ? 5 : 0;

    // Check for an applied coupon in the session
    let appliedCoupon = null;
    let discount = 0;

    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(
        req.session.appliedCoupon.couponId,
      );

      if (
        sessionCoupon &&
        sessionCoupon.isActive &&
        subtotal >= sessionCoupon.minPurchase &&
        new Date() >= sessionCoupon.startDate &&
        new Date() <= sessionCoupon.endDate
      ) {
        // Calculate discount
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);

          // Apply max discount limit if set
          if (
            sessionCoupon.maxDiscount &&
            discount > sessionCoupon.maxDiscount
          ) {
            discount = sessionCoupon.maxDiscount;
          }
        } else {
          // fixed amount
          discount = sessionCoupon.discountAmount;
        }

        // Ensure discount doesn't exceed subtotal
        discount = Math.min(discount, subtotal);

        appliedCoupon = {
          code: sessionCoupon.code,
          id: sessionCoupon._id,
          discount: discount,
          discountType: sessionCoupon.discountType,
          discountAmount: sessionCoupon.discountAmount,
        };
      }
    }

    const total =
      subtotal + shipping - (appliedCoupon ? appliedCoupon.discount : 0);

    // Get wallet balance
    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    res.render("checkout", {
      user,
      cart,
      subtotal,
      shipping,
      discount: appliedCoupon ? appliedCoupon.discount : 0,
      total,
      appliedCoupon,
      walletBalance,
    });
  } catch (err) {
    console.error("Error loading checkout:", err);
    res.status(500).render("page-404", { message: "Error loading checkout" });
  }
};

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a delivery address",
      });
    }
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please select a payment method",
      });
    }

    // Razorpay: verify payment before creating order
    if (paymentMethod === "RAZORPAY") {
      // Verify payment
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: "Missing Razorpay payment details" });
      }
      const crypto = require("crypto");
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }
    }

    // Find cart
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Calculate prices (same as before)
    let subtotal = 0;
    for (const item of cart.items) {
      const product = item.productId;
      if (
        !product.isListed ||
        !product.brand.isActive ||
        !product.category.isListed ||
        product.status !== "Available" ||
        product.stock < item.quantity
      ) {
        return res.status(400).json({
          success: false,
          message: `"${product.productName}" is no longer available or invalid`,
          productId: product._id,
        });
      }
      const productOffer = product.productOffer || 0;
      const categoryOffer = product.category?.categoryOffer || 0;
      const bestOfferPercentage = Math.max(productOffer, categoryOffer);
      let finalPrice = product.salesPrice;
      if (bestOfferPercentage > 0) {
        const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
        finalPrice = product.salesPrice - offerAmount;
      }
      item.price = finalPrice;
      item.totalPrice = item.quantity * finalPrice;
      subtotal += item.totalPrice;
    }
    const shipping = 5;
    const totalPrice = subtotal;
    let discount = 0;
    let couponCode = null;
    let couponId = null;
    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(req.session.appliedCoupon.couponId).session(session);
      if (
        sessionCoupon &&
        sessionCoupon.isActive &&
        subtotal >= sessionCoupon.minPurchase &&
        new Date() >= sessionCoupon.startDate &&
        new Date() <= sessionCoupon.endDate
      ) {
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);
          if (sessionCoupon.maxDiscount && discount > sessionCoupon.maxDiscount) {
            discount = sessionCoupon.maxDiscount;
          }
        } else {
          discount = sessionCoupon.discountAmount;
        }
        discount = Math.min(discount, subtotal);
        couponCode = sessionCoupon.code;
        couponId = sessionCoupon._id;
        sessionCoupon.usedCount += 1;
        sessionCoupon.usedBy.push({ user: userId, usedAt: new Date() });
        await sessionCoupon.save({ session });
      }
    }
    const finalAmount = subtotal + shipping - discount;

    // Handle wallet payment
    if (paymentMethod === "WALLET") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }
      const deductResult = await deductFromWallet(userId, finalAmount, `Payment for order #ORD-${userId.toString().substring(0, 5)}`);
      if (!deductResult.success) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: deductResult.error || "Failed to process wallet payment" });
      }
    }

    // Create order
    const order = new Order({
      user: userId,
      address: addressId,
      orderItems: cart.items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      discount,
      couponCode,
      couponId,
      finalAmount,
      paymentMethod: paymentMethod,
      status: paymentMethod === "RAZORPAY" ? "Confirmed" : "Pending",
    });
    for (const item of cart.items) {
      await Product.updateOne({ _id: item.productId._id }, { $inc: { stock: -item.quantity } });
    }
    await order.save({ session });
    await User.findByIdAndUpdate(userId, { $set: { cart: [] } });
    await Cart.deleteOne({ userId });
    await session.commitTransaction();
    session.endSession();
    res.json({
      success: true,
      orderId: order.orderId,
      redirectUrl: `/order-confirmation?orderId=${order.orderId}&total=${finalAmount}`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

const loadOrderConfirmation = async (req, res) => {
  try {
    const { orderId, total } = req.query;

    if (!orderId) {
      return res.status(404).render("page-404");
    }

    const order = await Order.findOne({ orderId })
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
      orderId: order.orderId,
      orderDate: order.createdOn,
      deliveryAddress: order.address,
      items: order.orderItems,
      total: parseFloat(total) || order.finalAmount,
      subtotal: order.totalPrice,
      discount: order.discount,
      couponCode: order.couponCode,
      couponApplied: !!order.couponCode,
      shipping: 5,
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
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for cancellation",
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order",
      });
    }

    if (order.status !== "Pending" && order.status !== "Confirmed") {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
      });
    }

    // Process refund for online payments and wallet
    if (["WALLET", "CARD", "PAYPAL", "RAZORPAY"].includes(order.paymentMethod)) {
      // For Razorpay payments, find the payment record first
      if (order.paymentMethod === "RAZORPAY") {
        const payment = await Payment.findOne({ orderId: order._id });
        console.log(`Processing refund for order: ${order.orderId}, userId: ${userId}, amount: ${order.finalAmount}`);
        
        if (payment && payment.razorpay && payment.razorpay.paymentId) {
          try {
            // Only attempt Razorpay refund if we have the payment ID and Razorpay is initialized
            if (razorpay) {
              console.log(`Initiating Razorpay refund for payment: ${payment.razorpay.paymentId}`);
              
              try {
                // Create refund in Razorpay
                const razorpayRefund = await razorpay.payments.refund(payment.razorpay.paymentId, {
                  amount: Math.round(order.finalAmount * 100), // Amount in paise
                  notes: {
                    orderId: order.orderId,
                    reason: reason || "Order cancelled by customer"
                  }
                });
                
                console.log("Razorpay refund created:", razorpayRefund);
              } catch (razorpayError) {
                console.error("Error with Razorpay API:", razorpayError);
              }
              
              // Also add to wallet for convenience and tracking - convert userId to string if it's an ObjectId
              const userIdStr = userId.toString();
              console.log(`Adding refund to wallet for user: ${userIdStr}`);
              
              const refundResult = await processWalletRefund(
                userIdStr,
                order.finalAmount,
                `Refund for cancelled Razorpay order #${order.orderId}`,
              );
              
              console.log("Wallet refund result:", refundResult);
              
              // Update payment record
              payment.status = "Refunded";
              payment.refund = {
                refundId: payment.razorpay.paymentId, // Use payment ID if refund ID not available
                amount: order.finalAmount,
                createdAt: new Date()
              };
              await payment.save();
            } else {
              // If Razorpay is not initialized, just add to wallet
              console.log("Razorpay not initialized, adding to wallet directly");
              const refundResult = await processWalletRefund(
                userId.toString(),
                order.finalAmount,
                `Refund for cancelled Razorpay order #${order.orderId}`,
              );
              console.log("Wallet refund result:", refundResult);
            }
          } catch (refundError) {
            console.error("Error processing Razorpay refund:", refundError);
            // Still add to wallet even if Razorpay refund fails
            const refundResult = await processWalletRefund(
              userId.toString(),
              order.finalAmount,
              `Refund for cancelled order #${order.orderId} (Razorpay refund failed)`,
            );
            console.log("Wallet refund result after Razorpay failure:", refundResult);
          }
        } else {
          // No payment record found or no payment ID, just add to wallet
          console.log("No payment record found, adding to wallet directly");
          const refundResult = await processWalletRefund(
            userId.toString(),
            order.finalAmount,
            `Refund for cancelled order #${order.orderId}`,
          );
          console.log("Wallet refund result (no payment record):", refundResult);
        }
      } else {
        // For non-Razorpay payments, use the existing wallet refund process
        console.log(`Processing refund for ${order.paymentMethod} payment, userId: ${userId}, amount: ${order.finalAmount}`);
        const refundResult = await processWalletRefund(
          userId.toString(),
          order.finalAmount,
          `Refund for cancelled order #${order.orderId}`,
        );
        console.log("Wallet refund result (non-Razorpay):", refundResult);

        if (!refundResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to process refund. Please contact support.",
          });
        }
      }
    }

    // Update product stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    // Update order status
    order.status = "Cancelled";
    order.cancelReason = reason;
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
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
      doc.text(`₹${item.price.toFixed(2)}`, 400, doc.y, {
        width: 100,
        align: "right",
      });
      doc.moveDown();
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").text("Order Summary", { underline: true });
    doc.moveDown();
    doc.font("Helvetica");
    doc.text(`Subtotal: ₹${order.totalPrice.toFixed(2)}`, { align: "right" });
    doc.text(`Shipping: ₹5.00`, { align: "right" });
    doc.moveDown();
    doc
      .font("Helvetica-Bold")
      .text(`Total: ₹${order.finalAmount.toFixed(2)}`, { align: "right" });
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

const getAvailableCoupons = async (userId, cartTotal) => {
  try {
    const currentDate = new Date();

    const availableCoupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      minPurchase: { $lte: cartTotal },
    });

    const filteredCoupons = await Promise.all(
      availableCoupons.map(async (coupon) => {
        const userUsed = coupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        );
        if (userUsed) {
          return null;
        }

        if (coupon.usedCount >= coupon.usageLimit) {
          return null;
        }

        return coupon;
      }),
    );

    return filteredCoupons.filter((coupon) => coupon !== null);
  } catch (error) {
    console.error("Error fetching available coupons:", error);
    return [];
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user;

    const coupon = await Coupon.findOne({
      code: couponCode.trim().toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or inactive",
      });
    }

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon has expired or not yet active",
      });
    }

    // Check if user has already used this coupon
    const userUsed = coupon.usedBy.some(
      (usage) => usage.user.toString() === userId.toString(),
    );
    if (userUsed) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon",
      });
    }

    // Check if coupon has reached its usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit",
      });
    }

    // Get cart and check minimum purchase requirement
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    if (subtotal < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = subtotal * (coupon.discountAmount / 100);

      // Apply max discount limit if set
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      // fixed amount
      discountAmount = coupon.discountAmount;
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const shipping = 5; // Standard shipping cost
    const total = subtotal + shipping - discountAmount;

    // Store the applied coupon in the session
    req.session.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      discount: discountAmount,
    };

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      cart: {
        subtotal,
        discount: discountAmount,
        shipping,
        total,
        couponCode: coupon.code,
        couponId: coupon._id,
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while applying the coupon",
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    // Check if there's an applied coupon in the session
    if (!req.session.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied to remove",
      });
    }

    // Remove the coupon from the session
    delete req.session.appliedCoupon;

    return res.status(200).json({
      success: true,
      message: "Coupon removed successfully",
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while removing the coupon",
    });
  }
};

// Razorpay controller functions
const createRazorpayOrder = async (req, res) => {
  try {
    // Check if Razorpay is initialized
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: "Razorpay is not configured. Please set up Razorpay credentials.",
      });
    }

    const userId = req.session.user;
    const { addressId } = req.body;

    // Find cart and user
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });
    const user = await User.findById(userId);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    // Calculate total
    let subtotal = 0;
    for (const item of cart.items) {
      const product = item.productId;
      const productOffer = product.productOffer || 0;
      const categoryOffer = product.category?.categoryOffer || 0;
      const bestOfferPercentage = Math.max(productOffer, categoryOffer);
      let finalPrice = product.salesPrice;
      if (bestOfferPercentage > 0) {
        const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
        finalPrice = product.salesPrice - offerAmount;
      }
      subtotal += item.quantity * finalPrice;
    }
    const shipping = 5;
    let discount = 0;
    if (req.session.appliedCoupon) {
      discount = req.session.appliedCoupon.discount || 0;
    }
    const finalAmount = subtotal + shipping - discount;

    // Create Razorpay order (not DB order)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100), // paise
      currency: "INR",
      receipt: `cart_${cart._id}`,
      notes: {
        userId: userId.toString(),
      },
    });

    res.json({
      success: true,
      order: razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error.message,
    });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    // Check if Razorpay is initialized
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Razorpay is not configured. Please set up Razorpay credentials.",
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { "razorpay.orderId": razorpay_order_id },
      {
        status: "Completed",
        transactionId: razorpay_payment_id,
        "razorpay.paymentId": razorpay_payment_id,
        "razorpay.signature": razorpay_signature,
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Update order status
    const order = await Order.findOne({ orderId });
    if (order) {
      order.status = "Confirmed";
      await order.save();
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      redirectUrl: `/order-confirmation?orderId=${orderId}&total=${payment.amount}`,
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
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
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  createRazorpayOrder,
  verifyRazorpayPayment,
};
