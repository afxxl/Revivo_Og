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
      .limit(6)
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .lean();

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
    const { name, phone, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("signup", { message: "Password do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

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
      const user = req.session.userData;
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User  data is missing. Please sign up again.",
        });
      }
      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      const savedUser = await saveUserData.save();
      req.session.user = savedUser._id;

      delete req.session.userOtp;

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
    const referer = req.headers.referer || "/";

    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect(referer);
    });
  } catch (err) {
    console.log("Logout error", err);
    res.redirect("/pageNotFound");
  }
};

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

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to cart",
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
      });

    if (!product || !product.brand || !product.category) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    if (product.stock < 1) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    const requestedQuantity = parseInt(quantity);
    if (isNaN(requestedQuantity) || requestedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity",
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId,
    );

    if (existingItem) {
      const totalQuantity = existingItem.quantity + requestedQuantity;

      if (totalQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock. Max available: ${product.stock}`,
        });
      }

      existingItem.quantity = totalQuantity;
      existingItem.totalPrice = totalQuantity * product.salesPrice;
    } else {
      if (requestedQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock. Max available: ${product.stock}`,
        });
      }

      cart.items.push({
        productId,
        quantity: requestedQuantity,
        price: product.salesPrice,
        totalPrice: requestedQuantity * product.salesPrice,
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: "Product added to cart successfully",
      cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};

const loadProductPage = async (req, res) => {
  try {
    const productId = req.params.id;

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
      return res.status(404).render("404", { message: "Product not found" });
    }

    res.render("product", { product });
  } catch (error) {
    console.error("Error loading product page:", error);
    res.status(500).render("500", { message: "Server Error" });
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
      ordersQuery.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "orderItems.product.productName": { $regex: search, $options: "i" } },
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
    console.log("Session user:", req.session.user);
    console.log("Request body:", req.body);

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
        console.error("Email sending failed for:", email);
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

      console.log("OTP generated and sent:", otp);
      return res.json({
        success: true,
        requiresOtp: true,
        message: "OTP sent to new email for verification",
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
        success: fasle,
        message: "Failed to resend OTP",
      });
    }

    req.session.emailOtp = otp;
    console.log("Resent profile OTP:", otp);
    res.json({
      success: true,
      message: "OTP resent successfully",
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

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(user.email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP",
      });
    }

    req.session.passwordChangeOtp = otp;
    req.session.passwordChangeOtpExpires = Date.now() + 60000;

    res.json({
      success: true,
      message: "OTP sent successfully",
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
    const { otp, newPassword } = req.body;
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
};
