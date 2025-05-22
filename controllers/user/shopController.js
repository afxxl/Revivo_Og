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
      sort: req.query.sort || "",
      search: req.query.search || "",
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      status: "Available",
      isListed: true,
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

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");

      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { "brand.name": searchRegex },
      ];
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 };
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 };
    } else {
      sortOption = {};
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .sort(sortOption)
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

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
      sort: req.query.sort || "",
      search: req.query.search || "",
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);

    const brand = await Brand.findOne({ _id: brandId, isActive: true }).lean();
    if (!brand) {
      return res.status(404).render("page-404");
    }

    let query = {
      brand: brandId,
      status: "Available",
      isListed: true,
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");

      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { "brand.name": searchRegex },
      ];
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 };
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 };
    } else {
      sortOption = {};
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .sort(sortOption)
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
      sort: req.query.sort || "",
      search: req.query.search || "",
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Prime Layers",
      status: "Available",
      isListed: true,
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

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");

      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { "brand.name": searchRegex },
      ];
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 };
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 };
    } else {
      sortOption = {};
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .sort(sortOption)
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
      sort: req.query.sort || "",
      search: req.query.search || "",
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Vintage Athletics",
      status: "Available",
      isListed: true,
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

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");

      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { "brand.name": searchRegex },
      ];
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 };
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 };
    } else {
      sortOption = {};
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .sort(sortOption)
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
      sort: req.query.sort || "",
      search: req.query.search || "",
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      heritage: "Y2K Essentials",
      status: "Available",
      isListed: true,
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

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");

      query.$or = [
        { productName: searchRegex },
        { description: searchRegex },
        { "brand.name": searchRegex },
      ];
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 };
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 };
    } else {
      sortOption = {};
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .sort(sortOption)
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

      if (item.quantity > 10) {
        return res.status(400).json({
          success: false,
          message: `Maximum purchase limit is 10 items per product`,
          productId: item.productId,
        });
      }
    }

    const updatedItems = [...cart.items];

    for (const item of items) {
      const existingItemIndex = updatedItems.findIndex(
        (i) => i.productId._id.toString() === item.productId.toString(),
      );

      if (existingItemIndex !== -1) {
        const existingItem = updatedItems[existingItemIndex];

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
        const product = await Product.findById(item.productId).populate(
          "category",
        );
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

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

    cart.items = updatedItems;

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
    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;
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
        canCheckout = false;
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
    const totalQuantity = cart.items.reduce((sum, item) => {
      const quantity = parseInt(item.quantity, 10) || 0;
      return sum + quantity;
    }, 0);

    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;

    let appliedCoupon = null;
    let discount = 0;
    let sessionModified = false;

    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(
        req.session.appliedCoupon.couponId,
      );
      if (
        sessionCoupon &&
        sessionCoupon.isActive &&
        subtotal >= sessionCoupon.minPurchase &&
        new Date() >= sessionCoupon.startDate &&
        new Date() <= sessionCoupon.endDate &&
        sessionCoupon.usedCount < sessionCoupon.usageLimit &&
        !sessionCoupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        )
      ) {
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);
          if (
            sessionCoupon.maxDiscount &&
            discount > sessionCoupon.maxDiscount
          ) {
            discount = sessionCoupon.maxDiscount;
          }
        } else {
          discount = sessionCoupon.discountAmount;
        }
        discount = Math.min(discount, subtotal);
        appliedCoupon = {
          code: sessionCoupon.code,
          id: sessionCoupon._id,
          discount: discount,
          discountType: sessionCoupon.discountType,
          discountAmount: sessionCoupon.discountAmount,
        };
      } else {
        delete req.session.appliedCoupon;
        sessionModified = true;
      }
    }

    const total =
      subtotal + shipping - (appliedCoupon ? appliedCoupon.discount : 0);

    if (sessionModified) {
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error saving session:", err);
            reject(err);
          } else {
            console.log("Session saved successfully");
            resolve();
          }
        });
      });
    }

    const availableCoupons = await getAvailableCoupons(userId, subtotal);

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

    const updatedCart = await Cart.findOne({ userId });
    const cartCount = updatedCart
      ? updatedCart.items.reduce((sum, item) => sum + item.quantity, 0)
      : 0;

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    let couponRemoved = false;
    let couponMessage = null;

    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(
        req.session.appliedCoupon.couponId,
      );

      if (
        !sessionCoupon ||
        !sessionCoupon.isActive ||
        subtotal < sessionCoupon.minPurchase ||
        new Date() < sessionCoupon.startDate ||
        new Date() > sessionCoupon.endDate ||
        sessionCoupon.usedCount >= sessionCoupon.usageLimit ||
        sessionCoupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        )
      ) {
        delete req.session.appliedCoupon;
        couponRemoved = true;
        couponMessage = "Coupon removed as it is no longer valid.";
      }
    }

    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;
    const total = subtotal + shipping;

    res.json({
      success: true,
      cart: {
        items: cart.items,
        subtotal,
        shipping,
        total,
      },
      cartCount,
      couponRemoved,
      couponMessage,
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
          coupons: [],
          appliedCoupon: null,
        });
      }
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;

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
        new Date() <= sessionCoupon.endDate &&
        sessionCoupon.usedCount < sessionCoupon.usageLimit &&
        !sessionCoupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        )
      ) {
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);
          if (
            sessionCoupon.maxDiscount &&
            discount > sessionCoupon.maxDiscount
          ) {
            discount = sessionCoupon.maxDiscount;
          }
        } else {
          discount = sessionCoupon.discountAmount;
        }
        discount = Math.min(discount, subtotal);
        appliedCoupon = {
          code: sessionCoupon.code,
          id: sessionCoupon._id,
          discount: discount,
          discountType: sessionCoupon.discountType,
          discountAmount: sessionCoupon.discountAmount,
        };
      } else {
        delete req.session.appliedCoupon;
      }
    }

    const total =
      subtotal + shipping - (appliedCoupon ? appliedCoupon.discount : 0);

    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    const isCODAvailable = total <= 1000;

    res.render("checkout", {
      user,
      cart,
      subtotal,
      shipping,
      discount: appliedCoupon ? appliedCoupon.discount : 0,
      total,
      appliedCoupon,
      walletBalance,
      isCODAvailable,
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
    const {
      addressId,
      paymentMethod,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!addressId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Please select a delivery address",
        redirectUrl:
          "/order-failure?errorMessage=Please%20select%20a%20delivery%20address",
      });
    }

    if (!paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Please select a payment method",
        redirectUrl:
          "/order-failure?errorMessage=Please%20select%20a%20payment%20method",
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
        redirectUrl:
          "/order-failure?errorMessage=Your%20cart%20is%20empty.%20Please%20add%20items%20to%20your%20cart.",
      });
    }

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
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `"${product.productName}" is no longer available or invalid`,
          productId: product._id,
          redirectUrl: `/order-failure?errorMessage=${encodeURIComponent(`"${product.productName}" is no longer available or invalid`)}`,
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
    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const shipping = Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10);
    const totalPrice = subtotal;
    let discount = 0;
    let couponCode = null;
    let couponId = null;

    if (req.session.appliedCoupon) {
      const sessionCoupon = await Coupon.findById(
        req.session.appliedCoupon.couponId,
      ).session(session);

      if (
        sessionCoupon &&
        sessionCoupon.isActive &&
        subtotal >= sessionCoupon.minPurchase &&
        new Date() >= sessionCoupon.startDate &&
        new Date() <= sessionCoupon.endDate &&
        sessionCoupon.usedCount < sessionCoupon.usageLimit &&
        !sessionCoupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        )
      ) {
        if (sessionCoupon.discountType === "percentage") {
          discount = subtotal * (sessionCoupon.discountAmount / 100);
          if (
            sessionCoupon.maxDiscount &&
            discount > sessionCoupon.maxDiscount
          ) {
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
      } else {
        delete req.session.appliedCoupon;
      }
    }

    const finalAmount = subtotal + shipping - discount;

    if (paymentMethod === "COD" && finalAmount > 1000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cash on Delivery is not available for orders above ₹1000",
        redirectUrl:
          "/order-failure?errorMessage=Cash%20on%20Delivery%20is%20not%20available%20for%20orders%20above%20%E2%82%B91000",
      });
    }

    if (paymentMethod === "RAZORPAY") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay payment details",
          redirectUrl:
            "/order-failure?errorMessage=Missing%20payment%20details.%20Please%20try%20again.",
        });
      }
      const crypto = require("crypto");
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
      if (expectedSignature !== razorpay_signature) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
          redirectUrl:
            "/order-failure?errorMessage=Payment%20verification%20failed.%20Please%20try%20again.",
        });
      }
      
      // Update payment record with payment ID immediately
      await Payment.findOneAndUpdate(
        { 'razorpay.orderId': razorpay_order_id },
        {
          status: "Completed",
          transactionId: razorpay_payment_id,
          'razorpay.paymentId': razorpay_payment_id,
          'razorpay.signature': razorpay_signature
        },
        { session }
      );
    }

    if (paymentMethod === "WALLET") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance",
          redirectUrl:
            "/order-failure?errorMessage=Insufficient%20wallet%20balance.%20Please%20choose%20another%20payment%20method.",
        });
      }
      const deductResult = await deductFromWallet(
        userId,
        finalAmount,
        `Payment for order #ORD-${userId.toString().substring(0, 5)}`,
      );
      if (!deductResult.success) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: deductResult.error || "Failed to process wallet payment",
          redirectUrl: `/order-failure?errorMessage=${encodeURIComponent(deductResult.error || "Failed to process wallet payment. Please try again.")}`,
        });
      }
    }

    const address = await Address.findById(addressId);
    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Selected address not found",
        redirectUrl:
          "/order-failure?errorMessage=Selected%20address%20not%20found",
      });
    }

    const order = new Order({
      user: userId,
      address: addressId,
      addressDetails: {
        name: address.name,
        addressType: address.addressType,
        address: address.address,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        phone: address.phone,
        altPhone: address.altPhone || "",
      },
      orderItems: cart.items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice,
      discount,
      couponCode,
      couponId,
      couponApplied: !!couponCode,
      finalAmount,
      shipping,
      paymentMethod: paymentMethod,
      status: paymentMethod === "RAZORPAY" ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
    });
    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { stock: -item.quantity } },
      );
    }

    await order.save({ session });
    
    // Link payment record to order if using Razorpay
    if (paymentMethod === "RAZORPAY") {
      await Payment.findOneAndUpdate(
        { 'razorpay.orderId': razorpay_order_id },
        { 
          $set: { 
            orderId: order._id,
            status: "Completed",
            transactionId: razorpay_payment_id,
            'razorpay.paymentId': razorpay_payment_id,
            'razorpay.signature': razorpay_signature
          } 
        },
        { session }
      );
    }
    
    await User.findByIdAndUpdate(userId, { $set: { cart: [] } });
    await Cart.deleteOne({ userId });
    delete req.session.appliedCoupon;
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
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      redirectUrl:
        "/order-failure?errorMessage=An%20error%20occurred%20while%20processing%20your%20order.%20Please%20try%20again.",
    });
  }
};

const loadOrderConfirmation = async (req, res) => {
  try {
    const { orderId, total } = req.query;

    if (!orderId) {
      return res.redirect("/orders");
    }

    const order = await Order.findOne({ orderId })
      .populate("address")
      .populate({
        path: "orderItems.product",
        model: "Product",
      });

    if (!order) {
      return res.status(404).render("page-404", {
        message: "Order not found",
      });
    }

    res.render("order-confirmation", {
      order,
      total: parseFloat(total) || order.finalAmount,
      discount: order.discount,
      couponCode: order.couponCode,
      couponApplied: !!order.couponCode,
      shipping: order.shipping || 0,
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

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
      });
    }

    if (
      ["WALLET", "CARD", "PAYPAL", "RAZORPAY"].includes(order.paymentMethod)
    ) {
      if (order.paymentMethod === "RAZORPAY") {
        const payment = await Payment.findOne({ orderId: order._id });

        if (payment && payment.razorpay && payment.razorpay.paymentId) {
          try {
            if (razorpay) {
              try {
                const razorpayRefund = await razorpay.payments.refund(
                  payment.razorpay.paymentId,
                  {
                    amount: Math.round(order.finalAmount * 100),
                    notes: {
                      orderId: order.orderId,
                      reason: reason || "Order cancelled by customer",
                    },
                  },
                );
              } catch (razorpayError) {
                console.error("Error with Razorpay API:", razorpayError);
              }

              const userIdStr = userId.toString();

              const refundResult = await processWalletRefund(
                userIdStr,
                order.finalAmount,
                `Refund for cancelled Razorpay order #${order.orderId}`,
              );

              payment.status = "Refunded";
              payment.refund = {
                refundId: payment.razorpay.paymentId,
                amount: order.finalAmount,
                createdAt: new Date(),
              };
              await payment.save();
            } else {
              const refundResult = await processWalletRefund(
                userId.toString(),
                order.finalAmount,
                `Refund for cancelled Razorpay order #${order.orderId}`,
              );
            }
          } catch (refundError) {
            console.error("Error processing Razorpay refund:", refundError);
            const refundResult = await processWalletRefund(
              userId.toString(),
              order.finalAmount,
              `Refund for cancelled order #${order.orderId} (Razorpay refund failed)`,
            );
            console.log(
              "Wallet refund result after Razorpay failure:",
              refundResult,
            );
          }
        } else {
          console.log("No payment record found, adding to wallet directly");
          const refundResult = await processWalletRefund(
            userId.toString(),
            order.finalAmount,
            `Refund for cancelled order #${order.orderId}`,
          );
          console.log(
            "Wallet refund result (no payment record):",
            refundResult,
          );
        }
      } else {
        console.log(
          `Processing refund for ${order.paymentMethod} payment, userId: ${userId}, amount: ${order.finalAmount}`,
        );
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

    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = OrderStatus.CANCELLED;
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

    const order = await Order.findOne({ orderId, user: userId });

    if (!order) {
      console.log("Order not found");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "Delivered") {
      console.log("Invalid status for return:", order.status);
      return res.status(400).json({
        success: false,
        message: "Returns can only be requested for delivered orders",
        currentStatus: order.status,
      });
    }

    order.status = OrderStatus.RETURN_REQUESTED;
    order.return = {
      requested: true,
      reason,
      status: "pending",
      requestedAt: new Date(),
    };

    await order.save();

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

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="REVIVO-Invoice-${order.orderId}.pdf"`,
    );

    doc.pipe(res);

    const primaryColor = "#2C2C2C";
    const secondaryColor = "#f8c78d";
    const textColor = "#333333";
    const lightGray = "#e0e0e0";

    doc
      .fontSize(28)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("REVIVO", { align: "center" });

    doc
      .fontSize(10)
      .fillColor(textColor)
      .font("Helvetica")
      .text("Premium Vintage Clothing", { align: "center" });

    doc.moveDown(1);

    doc
      .strokeColor(secondaryColor)
      .lineWidth(3)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();

    doc.moveDown(1.5);

    const colWidth = (doc.page.width - 100) / 2;

    doc
      .fontSize(16)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("INVOICE", 50, doc.y);

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor(textColor)
      .font("Helvetica")
      .text(`Invoice #: ${order.orderId}`, 50);

    doc.moveDown(0.3);

    doc.text(
      `Date: ${new Date(order.createdOn).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      50,
    );

    doc.moveDown(0.3);

    doc.text(`Payment: ${order.paymentMethod}`, 50);

    doc.moveDown(0.3);

    let statusColor = primaryColor;
    if (order.status === "Delivered") statusColor = "#48bb78";
    if (order.status === "Returned") statusColor = "#e53e3e";

    doc
      .fillColor(statusColor)
      .font("Helvetica-Bold")
      .text(`Status: ${order.status}`, 50);

    doc
      .fontSize(10)
      .fillColor(textColor)
      .font("Helvetica")
      .text(
        "REVIVO Vintage Clothing",
        doc.page.width - 50 - colWidth,
        doc.y - 80,
        {
          width: colWidth,
          align: "right",
        },
      );

    doc.moveDown(0.3);

    doc.text("123 Fashion Street, Bangalore", {
      width: colWidth,
      align: "right",
    });

    doc.moveDown(0.3);

    doc.text("Karnataka, India - 560001", {
      width: colWidth,
      align: "right",
    });

    doc.moveDown(0.3);

    doc.text("support@revivo.com | +91 9876543210", {
      width: colWidth,
      align: "right",
    });

    doc.moveDown(2);

    doc
      .strokeColor(lightGray)
      .lineWidth(1)
      .rect(50, doc.y, doc.page.width - 100, 120)
      .stroke();

    doc
      .fontSize(12)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("customer", 70, doc.y + 15);

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor(textColor)
      .font("Helvetica-Bold")
      .text(`${order.user.name || "customer"}`, 70);

    doc.moveDown(0.3);

    doc
      .font("Helvetica")
      .text(`email: ${order.user.email || "not available"}`, 70);

    doc.moveDown(0.3);

    doc.text(`phone: ${order.user.phone || "not available"}`, 70);

    doc
      .fontSize(12)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("shipping address", doc.page.width / 2, doc.y - 65);

    doc.moveDown(0.5);

    if (order.addressdetails) {
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(`${order.addressdetails.name}`, doc.page.width / 2);

      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .text(`${order.addressdetails.address}`, doc.page.width / 2);

      doc.moveDown(0.3);

      doc.text(
        `${order.addressdetails.city}, ${order.addressdetails.state} - ${order.addressdetails.pincode}`,
        doc.page.width / 2,
      );

      doc.moveDown(0.3);

      doc.text(`phone: ${order.addressdetails.phone}`, doc.page.width / 2);
    } else if (order.address) {
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(`${order.address.name}`, doc.page.width / 2);

      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .text(`${order.address.address}`, doc.page.width / 2);

      doc.moveDown(0.3);

      doc.text(
        `${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
        doc.page.width / 2,
      );

      doc.moveDown(0.3);

      doc.text(`phone: ${order.address.phone}`, doc.page.width / 2);
    } else {
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(`${order.user.name || "customer"}`, doc.page.width / 2);

      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .text(`address information not available`, doc.page.width / 2);
    }

    doc.moveDown(3);

    doc
      .fontSize(14)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("order items", 50);

    doc.moveDown(1);

    const tabletop = doc.y;
    doc.rect(50, tabletop, doc.page.width - 100, 25).fill(primaryColor);

    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("product", 70, tabletop + 8)
      .text("qty", 300, tabletop + 8, { width: 40, align: "center" })
      .text("price", 370, tabletop + 8, { width: 70, align: "right" })
      .text("total", 470, tabletop + 8, { width: 70, align: "right" });

    let tablerowy = tabletop + 30;
    let alternaterow = false;

    if (order.orderItems && Array.isArray(order.orderItems)) {
      order.orderItems.forEach((item, i) => {
        if (alternaterow) {
          doc.rect(50, tablerowy - 5, doc.page.width - 100, 30).fill("#f9f9f9");
        }
        alternaterow = !alternaterow;

        doc
          .fillColor(textColor)
          .fontSize(10)
          .font("Helvetica")
          .text(item.product.productname, 70, tablerowy, { width: 220 });

        doc.text(item.quantity.toString(), 300, tablerowy, {
          width: 40,
          align: "center",
        });
        doc.text(`₹${item.price.toFixed(2)}`, 370, tablerowy, {
          width: 70,
          align: "right",
        });
        doc.text(
          `₹${(item.price * item.quantity).toFixed(2)}`,
          470,
          tablerowy,
          {
            width: 70,
            align: "right",
          },
        );

        tablerowy += 30;
      });
    } else {
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica")
        .text("No items in this order", 70, tablerowy, { width: 400 });
    }

    doc
      .strokeColor(lightGray)
      .lineWidth(1)
      .moveTo(50, tablerowy + 5)
      .lineTo(doc.page.width - 50, tablerowy + 5)
      .stroke();

    doc.moveDown(1.5);

    const summaryx = 350;
    const summaryWidth = 170;

    doc
      .strokeColor(lightGray)
      .lineWidth(1)
      .rect(summaryx - 10, doc.y - 5, summaryWidth + 20, 140)
      .stroke();

    const summarystarty = doc.y + 10;

    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("order summary", summaryx + 10, summarystarty, {
        width: summaryWidth,
      });

    doc.moveDown(1);

    if (order.totalPrice) {
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica")
        .text("subtotal:", summaryx + 10, doc.y, { width: 80 })
        .text(`₹${order.totalPrice.toFixed(2)}`, summaryx + 90, doc.y - 12, {
          width: 70,
          align: "right",
        });
    }

    doc.moveDown(0.7);

    if (order.shippingCost) {
      doc
        .text("shipping:", summaryx + 10, doc.y, { width: 80 })
        .text(`₹${order.shippingCost.toFixed(2)}`, summaryx + 90, doc.y - 12, {
          width: 70,
          align: "right",
        });
    }

    if (order.discount > 0) {
      doc.moveDown(0.7);
      doc
        .fillColor("#48bb78")
        .text("discount:", summaryx + 10, doc.y, { width: 80 })
        .text(`-₹${order.discount.toFixed(2)}`, summaryx + 90, doc.y - 12, {
          width: 70,
          align: "right",
        });
    }

    doc.moveDown(0.7);
    doc
      .strokeColor(lightGray)
      .lineWidth(1)
      .moveTo(summaryx, doc.y)
      .lineTo(summaryx + summaryWidth, doc.y)
      .stroke();

    doc.moveDown(0.7);

    doc
      .strokeColor(primaryColor)
      .lineWidth(1)
      .rect(summaryx, doc.y - 5, summaryWidth, 30)
      .fill(primaryColor);

    const totaltexty = doc.y + 7;

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12);

    doc.text("total:", summaryx + 10, totaltexty, { continued: true });

    if (order.finalAmount) {
      doc.text(`₹${order.finalAmount.toFixed(2)}`, {
        align: "right",
        width: summaryWidth - 20,
      });
    }

    doc.moveDown(3);

    const footery = doc.page.height - 80;

    doc
      .strokeColor(secondaryColor)
      .lineWidth(2)
      .moveTo(50, footery)
      .lineTo(doc.page.width - 50, footery)
      .stroke();

    doc
      .fontSize(10)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("thank you for shopping with revivo!", 50, footery + 15, {
        align: "center",
      });

    doc
      .fontSize(8)
      .fillColor(textColor)
      .font("Helvetica")
      .text(
        "for any questions or concerns regarding this order, please contact our customer support.",
        { align: "center" },
      );

    doc
      .fontSize(8)
      .fillColor(primaryColor)
      .text("www.revivo.com | support@revivo.com | +91 9876543210", {
        align: "center",
      });

    doc.end();
  } catch (err) {
    console.error("error generating invoice:", err);
    res
      .status(500)
      .json({ success: false, message: "failed to generate invoice" });
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
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    });

    const filteredCoupons = await Promise.all(
      availableCoupons.map(async (coupon) => {
        const userUsed = coupon.usedBy.some(
          (usage) => usage.user.toString() === userId.toString(),
        );
        if (userUsed) {
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

const getDynamicCoupons = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

    let subtotal = 0;
    if (cart && cart.items.length > 0) {
      subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    const availableCoupons = await getAvailableCoupons(userId, subtotal);

    res.status(200).json({
      success: true,
      coupons: availableCoupons,
    });
  } catch (error) {
    console.error("Error fetching dynamic coupons:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available coupons",
    });
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

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit",
      });
    }

    const userUsed = coupon.usedBy.some(
      (usage) => usage.user.toString() === userId.toString(),
    );
    if (userUsed) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon",
      });
    }

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

    const totalQuantity = cart.items.reduce((sum, item) => {
      const quantity = parseInt(item.quantity, 10) || 0;
      return sum + quantity;
    }, 0);

    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = subtotal * (coupon.discountAmount / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountAmount;
    }

    discountAmount = Math.min(discountAmount, subtotal);

    delete req.session.appliedCoupon;

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
        total: subtotal + shipping - discountAmount,
        couponCode: coupon.code,
        couponId: coupon._id,
        debug: {
          totalQuantity,
          calculatedShipping: shipping,
        },
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
    console.log(
      "Attempting to remove coupon from session:",
      req.session.appliedCoupon,
    );

    if (!req.session.appliedCoupon) {
      console.log("No coupon found in session");
      return res.status(400).json({
        success: false,
        message: "No coupon applied to remove",
      });
    }

    delete req.session.appliedCoupon;
    console.log("Coupon removed from session");

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });

    let subtotal = 0;
    let items = [];
    if (cart && cart.items.length > 0) {
      items = cart.items.filter((item) => {
        const product = item.productId;
        return (
          product &&
          product.isListed &&
          product.status === "Available" &&
          product.stock >= item.quantity
        );
      });
      subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    }
    const totalQuantity = cart.items.reduce((sum, item) => {
      const quantity = parseInt(item.quantity, 10) || 0;
      return sum + quantity;
    }, 0);
    console.log("Total quantity when removing coupon:", totalQuantity);

    const shipping =
      subtotal > 0
        ? subtotal > 1000
          ? 0
          : Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10)
        : 0;

    console.log("Calculated shipping charge when removing coupon:", shipping);

    let total = subtotal + shipping;

    if (cart && items.length !== cart.items.length) {
      cart.items = items;
      await cart.save();
    }

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          reject(err);
        } else {
          console.log("Session saved successfully");
          resolve();
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: "Coupon removed successfully",
      cart: {
        subtotal,
        shipping,
        total,
        items,
      },
    });
  } catch (error) {
    console.error("Detailed error removing coupon:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "An error occurred while removing the coupon: " + error.message,
      errorDetails:
        process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay is not configured. Please set up Razorpay credentials.",
      });
    }

    const userId = req.session.user;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "brand" }, { path: "category" }],
    });
    const user = await User.findById(userId);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

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
    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const shipping = Math.max(40, 40 + Math.floor(totalQuantity / 3) * 10);
    let discount = 0;
    if (req.session.appliedCoupon) {
      discount = req.session.appliedCoupon.discount || 0;
    }
    const finalAmount = subtotal + shipping - discount;

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `cart_${cart._id}`,
      notes: {
        userId: userId.toString(),
      },
    });
    
    // Create a payment record for this Razorpay order
    const payment = new Payment({
      status: "Pending",
      userId: userId,
      method: "RAZORPAY",
      amount: finalAmount,
      paymentGateway: "Razorpay",
      razorpay: {
        orderId: razorpayOrder.id
      }
    });
    
    await payment.save();

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
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay is not configured. Please set up Razorpay credentials.",
        redirectUrl: `/order-failure?errorMessage=Payment gateway not configured&orderId=${req.body.orderId}`,
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;
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
        redirectUrl: `/order-failure?errorMessage=Payment verification failed&orderId=${orderId}&errorCode=AUTH_FAIL`,
      });
    }

    const payment = await Payment.findOneAndUpdate(
      { "razorpay.orderId": razorpay_order_id },
      {
        status: "Completed",
        transactionId: razorpay_payment_id,
        "razorpay.paymentId": razorpay_payment_id,
        "razorpay.signature": razorpay_signature,
      },
      { new: true },
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
        redirectUrl: `/order-failure?errorMessage=Payment record not found&orderId=${orderId}&errorCode=PAYMENT_NOT_FOUND`,
      });
    }

    const order = await Order.findOne({ orderId });
    if (order) {
      order.status = OrderStatus.CONFIRMED;
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
      redirectUrl: `/order-failure?errorMessage=${encodeURIComponent(error.message)}&orderId=${req.body.orderId}&errorCode=SERVER_ERROR`,
    });
  }
};

const loadOrderFailure = async (req, res) => {
  try {
    const { errorMessage, orderId, errorCode } = req.query;
    let order = null;

    if (orderId) {
      order = await Order.findOne({ orderId }).lean();
    }

    res.render("order-failure", {
      orderId,
      order,
      errorMessage: errorMessage || "Payment could not be processed",
      errorCode: errorCode || "",
    });
  } catch (error) {
    console.error("Error loading order failure page:", error);
    res.status(500).send("Server Error");
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
  loadOrderFailure,
  orderDetails,
  cancelOrder,
  requestReturn,
  generateInvoice,
  getAvailableCoupons,
  getDynamicCoupons,
  applyCoupon,
  removeCoupon,
  createRazorpayOrder,
  verifyRazorpayPayment,
};
