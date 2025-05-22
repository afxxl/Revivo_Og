const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController.js");
const shopController = require("../controllers/user/shopController.js");
const passport = require("passport");
const featuredController = require("../controllers/user/featuredController.js");
const newArrivalsController = require("../controllers/user/newArrivalsController.js");
const footerController = require("../controllers/user/footerController.js");
const authController = require("../controllers/user/authController.js");
const { userAuth, adminAuth } = require("../middlewares/auth");
const { uploadProfile } = require("../helpers/multer.js");
const getCartCount = require("../middlewares/cartCount.js");
const validationController = require("../controllers/user/validationController.js");
const wishlistController = require("../controllers/user/wishlistController.js");
const getWishlistCount = require("../middlewares/wishlistCount.js");
const walletController = require("../controllers/user/walletController");

router.use(getCartCount);
router.use(getWishlistCount);

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignUpPage);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.post("/add-to-cart", userController.addToCart);

router.post("/store-temp-email", authController.storeTempEmail);

router.get(
  "/auth/google",
  authController.prepareGoogleAuth,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    accessType: "online",
  }),
);
router.post("/store-referral-code", authController.storeReferralCode);

router.get("/auth/google/callback", authController.handleGoogleCallback);

router.get("/forgot-password", userController.loadResetPassword);
router.post("/sendResetOtp", userController.sendResetOtp);
router.post("/verifyResetOtp", userController.verifyResetOtp);
router.post("/updatePassword", userController.updatePassword);

router.get("/logout", userController.logout);
router.get("/api/check-session", userController.checkSession);

router.post("/resend-reset-otp", userController.resendResetOtp);

router.get("/shop", shopController.shopPage);
router.get("/featured", featuredController.featuredPage);

router.get("/new-arrivals", newArrivalsController.newArrivalsPage);

router.get("/shop/brand/:brandId", shopController.loadBrandPage);

router.get("/product/:id", userController.loadProductPage);

//heritage

router.get("/shop/collection/prime-layers", shopController.loadPrimeLayers);
router.get(
  "/shop/collection/vintage-athletics",
  shopController.loadVintageAthletics,
);
router.get("/shop/collection/y2k-essentials", shopController.loadY2kEssentials);

//Profile

router.get("/profile", userAuth, userController.loadProfilePage);
router.post(
  "/update-profile",
  userAuth,
  validationController.validateProfileUpdate,
  userController.updateProfile,
);
router.post("/verify-email-otp", userController.verifyEmailOtp);
router.post(
  "/update-profile-image",
  userAuth,
  uploadProfile,
  userController.updateProfileImage,
);
router.post("/resend-profile-otp", userController.resendProfileOtp);

//Address

router.post(
  "/addresses",
  userAuth,
  validationController.validateAddress,
  userController.addAddress,
);

router.get("/addresses", userAuth, userController.loadAddAddress);

router.patch(
  "/addresses/:id",
  userAuth,
  validationController.validateAddress,
  userController.updateAddress,
);

router.delete("/addresses/:id", userAuth, userController.deleteAddress);
router.get("/addresses/:id", userAuth, userController.getAddress);

//Cart

router.get("/cart", userAuth, shopController.loadCartPage);
router.post("/update-cart", userAuth, shopController.updateCart);
router.post("/remove-from-cart", userAuth, shopController.removeFromCart);
router.post("/apply-coupon", userAuth, shopController.applyCoupon);
router.post("/apply-coupon/remove", userAuth, shopController.removeCoupon);
router.get("/get-dynamic-coupons", userAuth, shopController.getDynamicCoupons);

//checkout

router.get("/checkout", userAuth, shopController.loadCheckoutPage);

//orders
router.post("/create-order", userAuth, shopController.createOrder);

router.get(
  "/order-confirmation",
  userAuth,
  shopController.loadOrderConfirmation,
);

router.get("/order-failure", userAuth, shopController.loadOrderFailure);

// Razorpay routes
router.post(
  "/create-razorpay-order",
  userAuth,
  shopController.createRazorpayOrder,
);
router.post(
  "/verify-razorpay-payment",
  userAuth,
  shopController.verifyRazorpayPayment,
);

//order

router.get("/orders/:orderId", shopController.orderDetails);
router.post("/orders/:orderId/cancel", userAuth, shopController.cancelOrder);
router.post(
  "/orders/:orderId/request-return",
  userAuth,
  shopController.requestReturn,
);

router.post(
  "/verify-current-password",
  userAuth,
  userController.verifyCurrentPassword,
);

router.post(
  "/validate-password-change",
  userAuth,
  validationController.validatePasswordChange,
  (req, res) => res.json({ success: true }),
);

router.post(
  "/send-password-change-otp",
  userAuth,
  userController.sendPasswordChangeOtp,
);

router.post(
  "/verify-password-change-otp",
  userAuth,
  userController.verifyPasswordChangeOtp,
);

router.post(
  "/resend-password-change-otp",
  userAuth,
  userController.resendPasswordChangeOtp,
);

router.get(
  "/orders/:orderId/invoice",
  userAuth,
  shopController.generateInvoice,
);

// Wishlist routes
router.get("/wishlist", userAuth, wishlistController.loadWishlistPage);
router.post("/add-to-wishlist", userAuth, wishlistController.addToWishlist);
router.post(
  "/remove-from-wishlist",
  userAuth,
  wishlistController.removeFromWishlist,
);
router.get(
  "/check-wishlist-status/:productId",
  wishlistController.checkWishlistStatus,
);
router.get("/get-wishlist-count", wishlistController.getWishlistCount);

//wallet
router.get("/wallet", userAuth, walletController.getWalletPage);

// Referral routes
router.get("/api/referral-stats", userAuth, userController.getReferralStats);

// Newsletter subscription
router.post("/subscribe-newsletter", userController.subscribeNewsletter);

// Footer pages
router.get("/about", footerController.loadAboutPage);
router.get("/sustainability", footerController.loadSustainabilityPage);
router.get("/careers", footerController.loadCareersPage);
router.get("/press", footerController.loadPressPage);

router.get("/contact", footerController.loadContactPage);
router.post("/submit-contact", userController.handleContactForm);
router.get("/shipping", footerController.loadShippingPage);
router.get("/faq", footerController.loadFaqPage);
router.get("/size-guide", footerController.loadSizeGuidePage);

module.exports = router;
