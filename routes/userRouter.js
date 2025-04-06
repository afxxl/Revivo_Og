const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController.js");
const shopController = require("../controllers/user/shopController.js");
const passport = require("passport");
const featuredController = require("../controllers/user/featuredController.js");
const newArrivalsController = require("../controllers/user/newArrivalsController.js");

router.get("/pageNotFound", userController.pageNotFound);

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

module.exports = router;
