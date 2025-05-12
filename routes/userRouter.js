const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController.js");
const shopController = require("../controllers/user/shopController.js");
const passport = require("passport");
const featuredController = require("../controllers/user/featuredController.js");
const newArrivalsController = require("../controllers/user/newArrivalsController.js");
const footerController = require("../controllers/user/footerController.js");
const { userAuth, adminAuth } = require("../middlewares/auth");
const { uploadProfile } = require("../helpers/multer.js");
const getCartCount = require("../middlewares/cartCount.js");
const validationController = require("../controllers/user/validationController.js");
const User = require("../models/userSchema.js");
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

// Store email before Google OAuth (for mobile fallback)
router.post('/store-temp-email', (req, res) => {
  const { email } = req.body;
  if (email) {
    req.session.tempEmail = email;
    req.session.save((err) => {
      if (err) {
        console.error('Error saving email to session:', err);
        return res.status(500).json({ success: false });
      }
      return res.json({ success: true });
    });
  } else {
    res.json({ success: false, message: 'No email provided' });
  }
});

// Google OAuth login route
router.get(
  "/auth/google",
  (req, res, next) => {
    // Log the user agent for debugging
    const userAgent = req.headers['user-agent'] || '';
    console.log(`Google OAuth login initiated from: ${req.headers.host}, User-Agent: ${userAgent.substring(0, 50)}...`);
    
    // Store the email from the session if it exists (for mobile fallback)
    if (req.session.email && !req.session.tempEmail) {
      req.session.tempEmail = req.session.email;
    }
    
    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: 'select_account', // Always show account selector
    accessType: 'online' // Don't request refresh tokens to simplify the flow
  }),
);
router.post("/store-referral-code", (req, res) => {
  try {
    const { referralCode } = req.body;

    if (referralCode) {
      req.session.referralCode = referralCode;
      req.session.save((err) => {
        if (err) {
          console.error("Error saving referral code to session:", err);
          return res.status(500).json({ success: false });
        }
        return res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    console.error("Error storing referral code:", error);
    res.status(500).json({ success: false });
  }
});

// Google OAuth callback route
router.get(
  "/auth/google/callback",
  function(req, res, next) {
    // Log the callback request details for debugging
    console.log('Google OAuth callback received:', {
      code: req.query.code ? 'present' : 'missing',
      state: req.query.state,
      error: req.query.error,
      host: req.headers.host,
      protocol: req.headers['x-forwarded-proto'] || req.protocol,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...' // Truncate for log readability
    });
    
    // Log all request headers for detailed debugging
    console.log('OAuth callback headers:', JSON.stringify(req.headers, null, 2));
    console.log('OAuth callback query:', JSON.stringify(req.query, null, 2));
    console.log('OAuth callback session:', req.session ? 'Session exists' : 'No session');
    
    // Special handling for token errors
    passport.authenticate('google', { failWithError: true }, function(err, user, info) {
      if (err) {
        console.error('Google OAuth error details:', err.name, err.message);
        
        // Special handling for TokenError - try to proceed if we have a user
        if (err.name === 'TokenError') {
          // Check if we already have a session - the user might already be logged in
          if (req.session.user) {
            console.log('User already has a session, redirecting to home');
            return res.redirect('/');
          }
          
          // Try to find user by email if we stored it in the session
          if (req.session.tempEmail) {
            console.log('Attempting to find user by stored email:', req.session.tempEmail);
            const User = require('../models/userSchema');
            
            User.findOne({ email: req.session.tempEmail })
              .then(existingUser => {
                if (existingUser) {
                  console.log('Found user by email, logging in despite token error');
                  req.session.user = existingUser._id;
                  req.session.save(() => res.redirect('/'));
                } else {
                  console.log('No user found with stored email');
                  res.redirect('/login?error=token_error');
                }
              })
              .catch(findErr => {
                console.error('Error finding user by email:', findErr);
                res.redirect('/login?error=db_error');
              });
            return;
          }
          
          // If we get here, we couldn't recover from the token error
          return res.redirect('/login?error=token_error&msg=' + encodeURIComponent('Please try again or use email login'));
        }
        
        // For other errors, redirect to login with error message
        return res.redirect('/login?error=' + encodeURIComponent(err.message || 'Authentication failed'));
      }
      
      if (!user) {
        return res.redirect('/login?error=auth_failed');
      }
      
      // Authentication succeeded - log the user in
      req.logIn(user, function(loginErr) {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.redirect('/login?error=login_failed');
        }
        
        // Set the user ID in the session
        req.session.user = user._id;
        
        // Clear any temporary email we stored
        if (req.session.tempEmail) {
          delete req.session.tempEmail;
        }
        
        // Save the session explicitly to ensure it's stored before redirect
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Error saving user session after OAuth:', saveErr);
            return res.redirect('/login?error=session_save');
          }
          
          // Redirect to home page
          res.redirect('/');
        });
      });
    })(req, res, next);
  }
);

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

// Footer pages - About section
router.get("/about", footerController.loadAboutPage);
router.get("/sustainability", footerController.loadSustainabilityPage);
router.get("/careers", footerController.loadCareersPage);
router.get("/press", footerController.loadPressPage);

// Footer pages - Help section
router.get("/contact", footerController.loadContactPage);
router.post("/submit-contact", userController.handleContactForm);
router.get("/shipping", footerController.loadShippingPage);
router.get("/faq", footerController.loadFaqPage);
router.get("/size-guide", footerController.loadSizeGuidePage);

module.exports = router;
