const User = require("../../models/userSchema.js");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema.js");
const Brand = require("../../models/brandSchema.js");
const Category = require("../../models/categorySchema.js");
const Address = require("../../models/addressSchema.js");
const Order = require("../../models/orderSchema.js");
const Cart = require("../../models/cartSchema.js");
const fs = require("fs");
const path = require("path");
const Wishlist = require("../../models/wishlistSchema");
const Wallet = require("../../models/walletSchema.js");

const loadHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    const products = await Product.find({
      isDeleted: { $ne: true },
      isNew: true,
      status: "Available",
      isListed: true,
      category: { $in: listedCategoryIds },
      brand: { $in: activeBrandIds },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .lean();

    const heroProducts = await Product.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: "Available",
          isListed: true,
          category: { $in: listedCategoryIds },
          brand: { $in: activeBrandIds },
          productImage: { $exists: true, $ne: [] },
        },
      },
      { $sample: { size: 3 } },
      { $project: { _id: 1, productName: 1, productImage: 1 } },
    ]);

    const brandsWithProducts = await Brand.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "products",
          let: { brandId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$brand", "$$brandId"] },
                    { $in: ["$category", listedCategoryIds] },
                    { $eq: ["$status", "Available"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
              },
            },
          ],
          as: "products",
        },
      },
      { $match: { "products.0": { $exists: true } } },
      { $project: { brandName: 1, brandImage: 1 } },
    ]);

    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user);
    }

    res.render("home", {
      categories,
      products,
      brands: brandsWithProducts,
      user: userData,
      heroProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("home", {
      products: [],
      brands: [],
      user: null,
    });
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadSignUpPage = async (req, res) => {
  try {
    res.render("signup");
  } catch (err) {
    console.log(
      "Some errors are there while loading signup page: ",
      err.message,
    );
  }
};

function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  console.log("Generated OTP:", otp);
  return otp;
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP:${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, confirmPassword, referralCode } =
      req.body;

    if (password !== confirmPassword) {
      return res.render("signup", { message: "Password do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.render("signup", {
          message: "Invalid referral code",
        });
      }
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password, referralCode };

    req.session.save((err) => {
      if (err) {
        console.log("Session save error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to save session",
        });
      }

      res.render("verify-otp");

      console.log("OTP Sent", otp);
    });
  } catch (err) {
    console.log("signup error", err);
    res.status(500).render("signup", {
      message: "An error occurred during signup",
    });
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (err) {}
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    console.log("Stored OTP:", req.session.userOtp);

    if (!otp || !req.session.userOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    if (String(otp) !== String(req.session.userOtp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP, Please try again",
      });
    }

    if (otp === req.session.userOtp) {
      const userData = req.session.userData;
      if (!userData) {
        return res.status(400).json({
          success: false,
          message: "User  data is missing. Please sign up again.",
        });
      }

      const referralHelper = require("../../helpers/referralHelper");
      const referralCode = await referralHelper.generateReferralCode();

      const passwordHash = await securePassword(userData.password);
      const saveUserData = new User({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: passwordHash,
        referralCode: referralCode,
      });

      const savedUser = await saveUserData.save();
      req.session.user = savedUser._id;

      delete req.session.userOtp;

      if (userData.referralCode) {
        await referralHelper.processReferralReward(
          savedUser,
          userData.referralCode,
        );
      }

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({
            success: false,
            message: "Session error",
          });
        }
        res.json({ success: true, redirectUrl: "/" });
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid OTP, Please try again",
      });
    }
  } catch (err) {
    console.log("Error Verifying OTP:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred",
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in section",
      });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSend = await sendVerificationEmail(email, otp);

    if (emailSend) {
      console.log("Resend OTP:", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP Resend Successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again",
      });
    }
  } catch (err) {
    console.error("Error resending OTP", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again",
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      let message = null;

      if (req.session.messages && req.session.messages.length > 0) {
        message = req.session.messages[req.session.messages.length - 1];
        req.session.messages = [];
      }

      return res.render("login", { message: message });
    } else {
      res.redirect("/");
    }
  } catch (err) {
    res.redirect("/pageNotFound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = findUser._id;
    req.user = findUser;
    res.redirect("/");
  } catch (err) {
    console.log("login error", err);
    res.render("login", { message: "Login failed. Please try again later" });
  }
};

const logout = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      await new Promise((resolve) => {
        req.logout((err) => {
          if (err) {
            console.error("Passport logout error:", err);
          }
          resolve();
        });
      });
    }

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }

        res.clearCookie("user.sid", { path: "/" });

        res.redirect("/");
      });
    } else {
      res.clearCookie("user.sid", { path: "/" });
      res.redirect("/");
    }
  } catch (err) {
    console.error("User Logout error:", err);
    res.redirect("/pageNotFound");
  }
};

module.exports = { logout };

const loadResetPassword = async (req, res) => {
  try {
    res.render("resetPass");
  } catch (err) {
    console.log("Reset password page is not found");
    res.redirect("/pageNotFound");
  }
};

const sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("resetPass", { message: "User not found" });
    }

    const otp = generateOtp();
    const emailSend = await sendVerificationEmail(email, otp);

    if (!emailSend) {
      return res.render("resetPass", {
        message: "Failed to send OTP. Try again",
      });
    }
    req.session.resetOtp = otp;
    req.session.resetEmail = email;
    console.log("Reset OTP sent:", otp);
    res.render("verify-reset-otp");
  } catch (err) {
    console.log("Error sending OTP for password reset", err);
    res.render("resetPass", { message: "An error occurred. Try again later" });
  }
};
const verifyResetOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || !req.session.resetOtp) {
      return res.render("verify-reset-otp", {
        message: "Invalid or expired OTP",
      });
    }
    if (otp !== req.session.resetOtp) {
      return res.render("verify-reset-otp", {
        message: "Incorrect OTP. Try again",
      });
    }
    res.render("new-password");
  } catch (err) {
    console.log("Error verifying reset OTP", err);
    res.render("verify-reset-otp", { message: "An error occurred. Try again" });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("new-password", { message: "Password do not match" });
    }
    const email = req.session.resetEmail;
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne({ email }, { password: hashedPassword });

    req.session.resetOtp = null;
    req.session.resetEmail = null;

    res.render("login", {
      script: `
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            Swal.fire({
              icon: 'success',
              title: 'Success!',
              text: 'Password reset successfully. Please login.',
              confirmButtonColor: '#6C7559'
            });
          });
        </script>
      `,
    });
  } catch (err) {
    console.log("Error resetting password", err);
    res.render("new-password", { message: "An error occurred. Try again" });
  }
};

const resendResetOtp = async (req, res) => {
  try {
    const email = req.session.resetEmail;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in session",
      });
    }

    const otp = generateOtp();
    const emailSend = await sendVerificationEmail(email, otp);

    if (emailSend) {
      req.session.resetOtp = otp;
      console.log("Reset OTP resent:", otp);
      res.json({
        success: true,
        message: "OTP Resent Successfully",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send OTP",
      });
    }
  } catch (err) {
    console.error("Error resending reset OTP:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while resending OTP",
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.session.user;

    console.log("Add to cart request received:", {
      productId,
      quantity,
      userId: userId || "not logged in",
    });

    if (!userId) {
      console.log("User not logged in, returning 401");
      return res.status(401).json({
        success: false,
        message: "Please login to add items to cart",
      });
    }

    if (
      !productId ||
      typeof productId !== "string" ||
      !productId.match(/^[0-9a-fA-F]{24}$/)
    ) {
      console.error(`Invalid product ID format: ${productId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(productId)
      .populate("brand")
      .populate("category");

    if (!product) {
      console.log(`Product not found with ID: ${productId}`);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log(
      `Found product: ${product.productName}, isListed: ${product.isListed}, stock: ${product.stock}, status: ${product.status}`,
    );

    if (!product.isListed) {
      return res.status(400).json({
        success: false,
        message: "This product is no longer available",
      });
    }

    if (!product.brand || !product.brand.isActive) {
      return res.status(400).json({
        success: false,
        message: "This product's brand is not available",
      });
    }

    if (!product.category || !product.category.isListed) {
      return res.status(400).json({
        success: false,
        message: "This product's category is not available",
      });
    }

    if (product.status !== "Available" || product.stock === 0) {
      return res.status(400).json({
        success: false,
        message: `"${product.productName}" is out of stock`,
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available for "${product.productName}"`,
      });
    }

    if (quantity > 10) {
      return res.status(400).json({
        success: false,
        message: `Maximum purchase limit is 10 items per product`,
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

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        updatedAt: new Date(),
        createdAt: new Date(),
      });
    }

    if (!cart.items) {
      console.log(`Items array doesn't exist, creating it`);
      cart.items = [];
    }

    let existingItemIndex = -1;
    if (cart.items && cart.items.length > 0) {
      existingItemIndex = cart.items.findIndex(
        (item) =>
          item.productId && item.productId.toString() === productId.toString(),
      );
    }

    if (existingItemIndex !== -1) {
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + parseInt(quantity);

      if (newQuantity > 10) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more. Maximum purchase limit is 10 items per product.`,
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.price = finalPrice;
      existingItem.totalPrice = existingItem.quantity * finalPrice;

      cart.items[existingItemIndex] = existingItem;
    } else {
      const newItem = {
        productId,
        quantity: parseInt(quantity),
        price: finalPrice,
        totalPrice: parseInt(quantity) * finalPrice,
        status: "active",
        cancelationReason: "none",
      };

      cart.items.push(newItem);
    }

    await cart.save();
    console.log("Cart saved successfully");

    try {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        const inWishlist = wishlist.items.some(
          (item) => item.productId.toString() === productId,
        );

        if (inWishlist) {
          console.log(`Removing product ${productId} from wishlist`);
          await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: productId } } },
            { new: true },
          );
        }
      }
    } catch (wishlistErr) {
      console.error("Error handling wishlist during add to cart:", wishlistErr);
    }

    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    let wishlistCount = 0;
    try {
      const updatedWishlist = await Wishlist.findOne({ userId });
      wishlistCount = updatedWishlist ? updatedWishlist.items.length : 0;
    } catch (err) {
      console.error("Error getting wishlist count:", err);
    }

    console.log(
      `Response: success=true, cartCount=${cartCount}, wishlistCount=${wishlistCount}`,
    );

    res.json({
      success: true,
      message: "Product added to cart",
      cartCount,
      wishlistCount,
    });
  } catch (err) {
    console.error("Error adding to cart:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Failed to add to cart",
    });
  }
};
const loadProductPage = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`Invalid product ID format requested: ${productId}`);
      return res.status(404).render("page-404", {
        message: "Product not found - Invalid ID format",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      status: "Available",
    })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .lean();

    if (!product || !product.brand || !product.category) {
      return res
        .status(404)
        .render("page-404", { message: "Product not found" });
    }

    if (product._id) {
      product._id = product._id.toString();
    }

    res.render("product", { product });
  } catch (error) {
    console.error("Error loading product page:", error);

    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(404).render("page-404", {
        message: "Product not found - Invalid ID format",
      });
    }

    return res.status(500).render("page-404", {
      message:
        "An error occurred while loading the product. Please try again later.",
    });
  }
};

const loadProfilePage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const userId = req.session.user;
    const { search, ordersPage = 1 } = req.query;
    const perPage = 5;
    const skip = (ordersPage - 1) * perPage;

    let ordersQuery = { user: userId };
    if (search) {
      const matchingProducts = await Product.find({
        productName: { $regex: search, $options: "i" },
      }).select("_id");

      const productIds = matchingProducts.map((p) => p._id);

      ordersQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "orderItems.product": { $in: productIds } },
      ];
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(ordersQuery)
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(perPage)
        .populate({
          path: "orderItems.product",
          select: "productName productImage salesPrice",
        })
        .populate("address")
        .lean(),
      Order.countDocuments(ordersQuery),
    ]);

    const totalPages = Math.ceil(totalOrders / perPage);

    const user = await User.findById(userId).populate("addresses").lean();

    // Add a flag to indicate if the user has a password set
    user.hasPassword = !!user.password;
    delete user.password; // Remove the actual password for security

    user.orders = orders;
    user.ordersCurrentPage = Number(ordersPage);
    user.ordersTotal = totalOrders;
    user.ordersTotalPages = totalPages;
    user.ordersPerPage = perPage;
    user.ordersSearch = search;

    res.render("profile", { user });
  } catch (err) {
    console.log("Error Loading Profile Page:", err);
    res.redirect("/pageNotFound");
  }
};

const updateProfile = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to update profile",
      });
    }

    const { name, email, phone } = req.body;
    const user = await User.findById(req.session.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (email && email !== user.email) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email",
        });
      }

      req.session.pendingProfileUpdate = {
        name: name || user.name,
        email: email,
        phone: phone || user.phone,
      };
      req.session.emailOtp = otp;

      return res.json({
        success: true,
        requiresOtp: true,
        message: "OTP sent successfully to your new email",
      });
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    const updatedUser = await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: err.message,
    });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    console.log("Stored OTP:", req.session.emailOtp);

    if (
      !req.session.user ||
      !req.session.emailOtp ||
      !req.session.pendingProfileUpdate
    ) {
      console.log("Session data missing");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP session",
      });
    }

    if (otp !== req.session.emailOtp) {
      console.log("OTP mismatch");
      return res.status(400).json({
        success: false,
        message: "Incorrect OTP",
      });
    }

    const user = await User.findById(req.session.user);
    const { name, email, phone } = req.session.pendingProfileUpdate;
    user.name = name;
    user.email = email;
    user.phone = phone;

    const updatedUser = await user.save();
    req.session.pendingProfileUpdate = null;
    req.session.emailOtp = null;

    res.json({
      success: true,
      message: "Email verified and profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (err) {
    console.error("Error verifying email OTP:", err);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: err.message,
    });
  }
};

const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      if (req.fileValidationError) {
        return res.status(400).json({
          success: false,
          message: req.fileValidationError,
        });
      }
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPG, PNG, GIF, or WEBP are allowed.",
      });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "File size exceeds 5MB limit",
      });
    }

    const userId = req.session.user;
    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    const user = await User.findById(userId);
    const oldImagePath = user.profileImage;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: imagePath },
      { new: true },
    );

    if (oldImagePath && !oldImagePath.includes("default-profile.jpg")) {
      const oldImageFullPath = path.join(__dirname, "../public", oldImagePath);
      if (fs.existsSync(oldImageFullPath)) {
        fs.unlinkSync(oldImageFullPath);
      }
    }

    res.json({
      success: true,
      imageUrl: imagePath,
      message: "Profile image updated successfully",
    });
  } catch (err) {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error updating profile image:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update profile image",
    });
  }
};

const resendProfileOtp = async (req, res) => {
  try {
    if (!req.session.pendingProfileUpdate || !req.session.emailOtp) {
      return res.status(400).json({
        success: false,
        message: "No pending email change request",
      });
    }

    const { email } = req.session.pendingProfileUpdate;
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP",
      });
    }

    req.session.emailOtp = otp;
    res.json({
      success: true,
      message: "OTP resent successfully to your new email",
    });
  } catch (err) {
    console.error("Error resending profile OTP:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const isDefault =
      req.body.isDefault === "true" || req.body.isDefault === true;

    const address = new Address({
      ...req.body,
      isDefault,
      userId: userId,
    });

    if (isDefault) {
      await Address.updateMany(
        { userId: userId },
        { $set: { isDefault: false } },
      );
    }

    await address.save();

    await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: address._id } },
      { new: true },
    );

    res.status(201).json({
      success: true,
      address,
      message: "Address added successfully",
    });
  } catch (err) {
    console.error("Error adding address:", err);
    res.status(400).json({
      success: false,
      message: "Failed to add address",
      error: err.message,
    });
  }
};

const loadAddAddress = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id });
    res.send(addresses);
  } catch (err) {
    res.status(500).send();
  }
};

const updateAddress = async (req, res) => {
  try {
    const updates = req.body;

    if (updates.updateType === "setDefault") {
      await Address.updateMany(
        { userId: req.session.user, _id: { $ne: req.params.id } },
        { $set: { isDefault: false } },
      );

      const address = await Address.findOneAndUpdate(
        { _id: req.params.id, userId: req.session.user },
        { $set: { isDefault: true } },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        address,
        message: "Default address updated successfully",
      });
    }

    updates.isDefault =
      updates.isDefault === "true" || updates.isDefault === true;

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.user },
      updates,
      { new: true },
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (updates.isDefault) {
      await Address.updateMany(
        { userId: req.session.user, _id: { $ne: address._id } },
        { $set: { isDefault: false } },
      );
    }

    res.status(200).json({
      success: true,
      address,
    });
  } catch (err) {
    console.error("Update address error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.session.user,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or you don't have permission to delete it",
      });
    }

    if (address.isDefault) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete the default address. Set another address as default first.",
      });
    }

    await Address.findByIdAndDelete(req.params.id);

    await User.findByIdAndUpdate(
      req.session.user,
      { $pull: { addresses: req.params.id } },
      { new: true },
    );

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

const getAddress = async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.session.user,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.status(200).json(address);
  } catch (err) {
    console.error("Error fetching address:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const sendPasswordChangeOtp = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { currentPassword, newPassword, isGoogleLogin } = req.body;
    req.session.tempNewPassword = newPassword;

    // Skip password verification for Google users
    if (!isGoogleLogin && user.password) {
      // Only verify password for non-Google users
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!passwordMatch) {
        return res.status(400).json({
          success: false,
          message: "Incorrect current password",
        });
      }
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(user.email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP",
      });
    }

    req.session.passwordChangeOtp = otp;
    req.session.passwordChangeOtpExpires = Date.now() + 60000; // 1 minute expiration

    res.json({
      success: true,
      message: "OTP sent successfully to your email",
    });
  } catch (err) {
    console.error("Error sending password change OTP:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

const verifyPasswordChangeOtp = async (req, res) => {
  try {
    const { otp, newPassword, isGoogleLogin } = req.body;
    const user = await User.findById(req.session.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      !req.session.passwordChangeOtp ||
      !req.session.passwordChangeOtpExpires
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP session expired. Please request a new OTP.",
      });
    }

    if (Date.now() > req.session.passwordChangeOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (otp !== req.session.passwordChangeOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const hashedPassword = await securePassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    req.session.passwordChangeOtp = null;
    req.session.passwordChangeOtpExpires = null;
    req.session.tempNewPassword = null;

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Error verifying password change OTP:", err);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};
const resendPasswordChangeOtp = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(user.email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP",
      });
    }

    req.session.passwordChangeOtp = otp;
    req.session.passwordChangeOtpExpires = Date.now() + 60000;

    res.json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    console.error("Error resending password change OTP:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

const verifyCurrentPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const user = await User.findById(req.session.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    res.json({
      success: true,
      message: "Current password verified",
    });
  } catch (err) {
    console.error("Error verifying current password:", err);
    res.status(500).json({
      success: false,
      message: "Failed to verify password",
    });
  }
};

const getReferralStats = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to view referral stats",
      });
    }

    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const referredUsers = await User.find({ referredBy: userId })
      .select("name email createdAt")
      .sort({ createdAt: -1 });

    const wallet = await Wallet.findOne({ userId });
    let totalReferralEarnings = 0;

    if (wallet) {
      totalReferralEarnings = wallet.transactions
        .filter(
          (t) => t.description && t.description.includes("Referral bonus"),
        )
        .reduce((sum, t) => sum + t.transactionAmount, 0);
    }

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode || null,
        referralCount: referredUsers.length,
        totalEarnings: totalReferralEarnings,
        referredUsers: referredUsers,
      },
    });
  } catch (err) {
    console.error("Error getting referral stats:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get referral statistics",
    });
  }
};
const checkSession = async (req, res) => {
  try {
    const userId = req.session.user || (req.user && req.user._id);

    if (req.session.wasBlockedByAdmin) {
      const response = {
        loggedIn: false,
        user: null,
        isBlocked: true,
      };

      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }

        return res.json(response);
      });

      return;
    }

    if (!userId) {
      return res.json({
        loggedIn: false,
        user: null,
        isBlocked: false,
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.json({
        loggedIn: false,
        user: null,
        isBlocked: false,
      });
    }

    if (user.isBlocked) {
      console.log("User found to be blocked in database");

      const response = {
        loggedIn: false,
        user: null,
        isBlocked: true,
      };

      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }

        return res.json(response);
      });

      return;
    }

    return res.json({
      loggedIn: true,
      user: {
        name: user.name,
        email: user.email,
      },
      isBlocked: false,
    });
  } catch (err) {
    console.error("Check session error:", err);
    return res.status(500).json({
      loggedIn: false,
      user: null,
      isBlocked: false,
      error: "Server error",
    });
  }
};

const subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    // Check if email format is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    // Send welcome email
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Welcome to REVIVO Vintage Community!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0dcd4; border-radius: 5px;">
          <h2 style="color: #2C2C2C; text-align: center;">Welcome to Our Vintage Community!</h2>
          <p style="color: #2C2C2C; line-height: 1.6;">Thank you for subscribing to the REVIVO newsletter. We're excited to have you join our community of vintage enthusiasts!</p>
          <p style="color: #2C2C2C; line-height: 1.6;">You'll now receive:</p>
          <ul style="color: #2C2C2C; line-height: 1.6;">
            <li>Early access to new arrivals</li>
            <li>Exclusive vintage styling tips</li>
            <li>Special offers and promotions</li>
            <li>Invitations to community events</li>
          </ul>
          <p style="color: #2C2C2C; line-height: 1.6;">Stay tuned for our next newsletter!</p>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0dcd4;">
            <p style="color: #2C2C2C; font-size: 12px;">© 2024 REVIVO. All rights reserved.</p>
            <p style="color: #2C2C2C; font-size: 12px;">You can unsubscribe at any time by clicking the unsubscribe link in our emails.</p>
          </div>
        </div>
      `,
    });

    if (info.accepted.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Successfully subscribed to newsletter!",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send confirmation email" });
    }
  } catch (error) {
    console.error("Error subscribing to newsletter:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request",
    });
  }
};

const handleContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Check if email format is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    // Send email to admin
    const adminInfo = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: process.env.NODEMAILER_EMAIL, // Send to admin email
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0dcd4; border-radius: 5px;">
          <h2 style="color: #2C2C2C; text-align: center;">New Contact Form Submission</h2>
          <p style="color: #2C2C2C; line-height: 1.6;"><strong>Name:</strong> ${name}</p>
          <p style="color: #2C2C2C; line-height: 1.6;"><strong>Email:</strong> ${email}</p>
          <p style="color: #2C2C2C; line-height: 1.6;"><strong>Subject:</strong> ${subject}</p>
          <p style="color: #2C2C2C; line-height: 1.6;"><strong>Message:</strong></p>
          <div style="background-color: #f8f7f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="color: #2C2C2C; line-height: 1.6;">${message}</p>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0dcd4;">
            <p style="color: #2C2C2C; font-size: 12px;">© 2024 REVIVO. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    // Send confirmation email to user
    const userInfo = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Thank you for contacting REVIVO",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0dcd4; border-radius: 5px;">
          <h2 style="color: #2C2C2C; text-align: center;">Thank You for Contacting Us!</h2>
          <p style="color: #2C2C2C; line-height: 1.6;">Dear ${name},</p>
          <p style="color: #2C2C2C; line-height: 1.6;">Thank you for reaching out to REVIVO. We have received your message regarding "${subject}" and will get back to you as soon as possible.</p>
          <p style="color: #2C2C2C; line-height: 1.6;">For your reference, here's a copy of your message:</p>
          <div style="background-color: #f8f7f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="color: #2C2C2C; line-height: 1.6;">${message}</p>
          </div>
          <p style="color: #2C2C2C; line-height: 1.6;">If you have any additional questions or information to provide, please don't hesitate to reply to this email.</p>
          <p style="color: #2C2C2C; line-height: 1.6;">Warm regards,</p>
          <p style="color: #2C2C2C; line-height: 1.6;">The REVIVO Team</p>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0dcd4;">
            <p style="color: #2C2C2C; font-size: 12px;">© 2024 REVIVO. All rights reserved.</p>
            <p style="color: #2C2C2C; font-size: 12px;">You can unsubscribe from our emails at any time by clicking the unsubscribe link in our emails.</p>
          </div>
        </div>
      `,
    });

    if (adminInfo.accepted.length > 0 && userInfo.accepted.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Your message has been sent successfully!",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to send message. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Error handling contact form:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request",
    });
  }
};

module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignUpPage,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadResetPassword,
  sendResetOtp,
  verifyResetOtp,
  updatePassword,
  resendResetOtp,
  addToCart,
  loadProductPage,
  loadProfilePage,
  updateProfile,
  verifyEmailOtp,
  updateProfileImage,
  resendProfileOtp,
  addAddress,
  loadAddAddress,
  updateAddress,
  deleteAddress,
  getAddress,
  verifyCurrentPassword,
  resendPasswordChangeOtp,
  verifyPasswordChangeOtp,
  sendPasswordChangeOtp,
  getReferralStats,
  checkSession,
  subscribeNewsletter,
  handleContactForm,
};
