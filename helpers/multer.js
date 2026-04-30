const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const makeStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `revivo/${folder}`,
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      resource_type: "image",
    },
  });

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extOk = allowed.test(file.originalname.split(".").pop().toLowerCase());
  const mimeOk = allowed.test(file.mimetype.split("/")[1]);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    req.fileValidationError =
      "Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!";
    cb(new Error("Only image files are allowed!"), false);
  }
};

const limits = { fileSize: 5 * 1024 * 1024 };

module.exports = {
  uploadBrand: multer({
    storage: makeStorage("brand-images"),
    fileFilter,
    limits,
  }).single("image"),

  uploadProduct: multer({
    storage: makeStorage("product-images"),
    fileFilter,
    limits,
  }).array("images", 10),

  uploadCategory: multer({
    storage: makeStorage("category-images"),
    fileFilter,
    limits,
  }).single("categoryImage"),

  uploadProfile: multer({
    storage: makeStorage("profile-images"),
    fileFilter,
    limits,
  }).single("profileImage"),
};
