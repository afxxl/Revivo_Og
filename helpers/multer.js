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
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (!mimetype || !extname) {
    req.fileValidationError =
      "Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!";
    return cb(new Error("Only image files are allowed!"), false);
  }

  if (file.size > 5 * 1024 * 1024) {
    req.fileValidationError = "File size exceeds 5MB limit";
    return cb(new Error("File size exceeds 5MB limit"), false);
  }

  cb(null, true);
};

const limits = {
  fileSize: 1024 * 1024 * 5,
  files: 10,
};

const uploadBrand = multer({
  storage: brandStorage,
  fileFilter: fileFilter,
  limits: { fileSize: limits.fileSize },
});

const uploadProduct = multer({
  storage: productStorage,
  fileFilter: fileFilter,
  limits: limits,
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

const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../public/uploads/profile-images");
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";

    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

module.exports = {
  uploadBrand: uploadBrand.single("image"),
  uploadProduct: uploadProduct.array("images", 10),
  uploadCategory: multer({
    storage: categoryStorage,
    fileFilter: fileFilter,
    limits: { fileSize: limits.fileSize },
  }).single("categoryImage"),

  uploadProfile: multer({
    storage: profileStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 },
    files: 1,
  }).single("profileImage"),
};
