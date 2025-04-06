const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const brandStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../public/uploads/brand-images");
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "brand-" + uniqueSuffix + ext);
  },
});

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../public/uploads/product-images");
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "product-" + uniqueSuffix + ext);
  },
});

const fileFilter = function (req, file, cb) {
  if (
    !file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|webp|WEBP)$/)
  ) {
    req.fileValidationError = "Only image files are allowed!";
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const limits = {
  fileSize: 1024 * 1024 * 5,
  files: 10,
};

// Create separate upload instances
const uploadBrand = multer({
  storage: brandStorage,
  fileFilter: fileFilter,
  limits: { fileSize: limits.fileSize }, // Single file for brand
});

const uploadProduct = multer({
  storage: productStorage,
  fileFilter: fileFilter,
  limits: limits, // Multiple files with higher limits for products
});

const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../public/uploads/category-images");
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "category-" + uniqueSuffix + ext);
  },
});

// Export the configured upload instances
module.exports = {
  uploadBrand: uploadBrand.single("image"), // For single brand image
  uploadProduct: uploadProduct.array("images", 10), // For multiple product images
  uploadCategory: multer({
    storage: categoryStorage,
    fileFilter: fileFilter,
    limits: { fileSize: limits.fileSize },
  }).single("categoryImage"), // Single file for category
};
