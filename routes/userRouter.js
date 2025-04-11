const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController.js");
const shopController = require("../controllers/user/shopController.js");
const passport = require("passport");
const featuredController = require("../controllers/user/featuredController.js");
const newArrivalsController = require("../controllers/user/newArrivalsController.js");
const { userAuth, adminAuth } = require("../middlewares/auth");
const { uploadProfile } = require("../helpers/multer.js");
const getCartCount = require("../middlewares/cartCount.js");

router.use(getCartCount);

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignUpPage);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);

router.post("/add-to-cart", userController.addToCart);

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureMessage: true,
  }),
  async (req, res) => {
    try {
      req.session.user = req.user._id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/login");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect("/login");
    }
  },
);

router.get("/forgot-password", userController.loadResetPassword);
router.post("/sendResetOtp", userController.sendResetOtp);
router.post("/verifyResetOtp", userController.verifyResetOtp);
router.post("/updatePassword", userController.updatePassword);

router.get("/logout", userController.logout);

router.post("/resend-reset-otp", userController.resendResetOtp);

router.get("/shop", shopController.shopPage);
router.get("/featured", featuredController.featuredPage);

router.get("/new-arrivals", newArrivalsController.newArrivalsPage);

router.get("/api/check-session", (req, res) => {
  res.json({
    loggedIn: !!req.session.user,
    user: req.session.user
      ? { name: req.user.name, email: req.user.email }
      : null,
  });
});

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
router.post("/update-profile", userAuth, userController.updateProfile);
router.post("/verify-email-otp", userController.verifyEmailOtp);
router.post(
  "/update-profile-image",
  userAuth,
  uploadProfile,
  userController.updateProfileImage,
);
router.post("/resend-profile-otp", userController.resendProfileOtp);

//Address

router.post("/addresses", userAuth, userController.addAddress);

router.get("/addresses", userAuth, userController.loadAddAddress);

router.patch("/addresses/:id", userAuth, userController.updateAddress);

router.delete("/addresses/:id", userAuth, userController.deleteAddress);
router.get("/addresses/:id", userAuth, userController.getAddress);

//Cart

router.get("/cart", userAuth, shopController.loadCartPage);
router.post("/update-cart", userAuth, shopController.updateCart);
router.post("/remove-from-cart", userAuth, shopController.removeFromCart);

//checkout

router.get("/checkout", userAuth, shopController.loadCheckoutPage);
router.post("/create-order", userAuth, shopController.createOrder);

router.get(
  "/order-confirmation/:orderId",
  userAuth,
  shopController.loadOrderConfirmation,
);

module.exports = router;
