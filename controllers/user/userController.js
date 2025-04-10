const User = require("../../models/userSchema.js");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema.js");
const Brand = require("../../models/brandSchema.js");
const Category = require("../../models/categorySchema.js");

const loadHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);

    const products = await Product.find({
      isDeleted: { $ne: true },
      isNew: true,
      status: "Available",
      category: { $in: listedCategoryIds },
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("brand")
      .populate("category");

    const brandsWithProducts = await Brand.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "brand",
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
  return Math.floor(100000 + Math.random() * 900000).toString();
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
        return res.redirect("/signup");
      }

      res.render("verify-otp");

      console.log("OTP Sent", otp);
    });
  } catch (err) {
    console.log("signup error", err);
    res.redirect("/pageNotFound");
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
    const { productId } = req.body;

    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to cart",
      });
    }

    res.json({
      success: true,
      message: "Product added to cart successfully",
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

    const product = await Product.findById(productId)
      .populate("brand")
      .populate("category")
      .lean();

    if (!product) {
      return res.status(404).render("404", { message: "Product not found" });
    }

    res.render("product", { product });
  } catch (error) {
    console.error("Error loading product page:", error);
    res.status(500).render("500", { message: "Server Error" });
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
};
