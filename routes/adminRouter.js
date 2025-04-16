const router = require("express").Router();
const adminController = require("../controllers/admin/adminController");
const usercontroller = require("../controllers/admin/usercontroller.js");
const { userAuth, adminAuth } = require("../middlewares/auth");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController.js");
const multer = require("../helpers/multer");

//error
router.get("/pageerror", adminController.pageerror);
//login
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);
//User
router.get("/users", adminAuth, usercontroller.userInfo);
router.get("/blockUser", adminAuth, usercontroller.userBlocked);
router.get("/unblockUser", adminAuth, usercontroller.userUnBlocked);

//Category
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post(
  "/addCategory",
  adminAuth,
  multer.uploadCategory,
  categoryController.addCategory,
);
router.get("/editCategory/:id", adminAuth, categoryController.editCategory);
router.post(
  "/updateCategory/:id",
  adminAuth,
  multer.uploadCategory,
  categoryController.updateCategory,
);
router.get(
  "/toggleCategory/:id",
  adminAuth,
  categoryController.toggleCategoryStatus,
);

//Brands
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post(
  "/addBrand",
  adminAuth,
  multer.uploadBrand,
  brandController.addBrand,
);
router.delete("/deleteBrand/:id", adminAuth, brandController.deleteBrand);
router.get("/editBrand/:id", adminAuth, brandController.getEditBrand);
router.post(
  "/updateBrand/:id",
  adminAuth,
  multer.uploadBrand,
  brandController.updateBrand,
);
router.get("/toggleBrand/:id", adminAuth, brandController.toggleBrandStatus);

//Products
router.get("/products", adminAuth, productController.productInfo);
router.post(
  "/addProduct",
  adminAuth,
  multer.uploadProduct,
  productController.addProduct,
);
router.get("/editProduct/:id", adminAuth, productController.editProduct);
router.post(
  "/updateProduct/:id",
  adminAuth,
  multer.uploadProduct,
  productController.updateProduct,
);
router.delete("/deleteProduct/:id", adminAuth, productController.deleteProduct);
router.get(
  "/toggleProduct/:id",
  adminAuth,
  productController.toggleProductStatus,
);

//order
router.get("/orders", adminAuth, orderController.loadOrderDetails);
router.get("/orders/:id", adminAuth, orderController.orderDetails);
router.post(
  "/orders/:id/handle-return",
  adminAuth,
  orderController.handleReturn,
);
router.post(
  "/orders/:id/update-status",
  adminAuth,
  orderController.updateStatus,
);

module.exports = router;
