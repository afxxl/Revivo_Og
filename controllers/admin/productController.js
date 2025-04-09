const mongoose = require("mongoose"); // This must be line 1
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Category = require("../../models/categorySchema");
const fs = require("fs");
const path = require("path");

const productInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 10;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: ".*" + search + ".*", $options: "i" } },
        { description: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .populate("brand")
      .populate("category")
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: ".*" + search + ".*", $options: "i" } },
        { description: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    const brands = await Brand.find({ isActive: true });
    const categories = await Category.find({ isListed: true });

    res.render("products", {
      data: productData,
      totalPages: totalPages,
      currentPage: page,
      totalProducts: count,
      perPage: limit,
      brands: brands,
      categories: categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const addProduct = async (req, res) => {
  console.log("Full request body:", req.body);
  console.log("Brand value:", req.body.brand);
  console.log("Type of brand:", typeof req.body.brand);
  console.log("Files received:", req.files ? req.files.length : 0);
  try {
    const {
      productName,
      brand,
      category,
      size,
      condition,
      regularPrice,
      salesPrice,
      productOffer,
      stock,
      heritage,
      quantity,
      status,
      description,
      isFeatured,
      isNew,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(brand)) {
      return res.status(400).json({
        success: false,
        error: "Invalid brand ID format",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID format",
      });
    }

    const brandExists = await Brand.exists({ _id: brand });
    if (!brandExists) {
      return res.status(400).json({
        success: false,
        error: "Brand not found",
      });
    }

    const categoryExists = await Category.exists({ _id: category });
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        error: "Category not found",
      });
    }

    if (
      isNaN(regularPrice) ||
      isNaN(salesPrice) ||
      isNaN(stock) ||
      isNaN(quantity)
    ) {
      return res.status(400).json({
        success: false,
        error: "Price, stock and quantity must be numbers",
      });
    }

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({
        success: false,
        error: "At least 3 images required",
      });
    }

    const productImages = req.files.map((file) => {
      return `/uploads/product-images/${file.filename}`;
    });

    const newProduct = new Product({
      productName,
      brand,
      category,
      size,
      condition,
      regularPrice: parseFloat(regularPrice),
      salesPrice: parseFloat(salesPrice),
      productOffer:
        productOffer && !isNaN(productOffer) ? parseInt(productOffer) : 0,
      stock: parseInt(stock),
      heritage: heritage || "None",
      quantity: parseInt(quantity),
      status,
      description,
      productImage: productImages,
      isFeatured: req.body.isFeatured === "on",
      isNew: req.body.isNew === "on",
    });

    await newProduct.validate();

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: newProduct,
    });
  } catch (err) {
    console.error("Product creation error:", err);

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        fs.unlink(file.path, () => {});
      });
    }

    let errorMessage = "Failed to add product";
    if (err.name === "ValidationError") {
      errorMessage = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    await Product.findByIdAndDelete(productId);

    if (product.productImage && product.productImage.length > 0) {
      product.productImage.forEach((imagePath) => {
        const fullPath = path.join(__dirname, "../../public", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete Product Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while deleting the product",
    });
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
      .populate("brand")
      .populate("category");

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const brands = await Brand.find({ isActive: true });
    const categories = await Category.find({ isListed: true });

    res.render("editProduct", {
      product,
      brands,
      categories,
    });
  } catch (error) {
    console.error("Edit Product Error:", error);
    res.redirect("/admin/pageerror");
  }
};

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      productName,
      brand,
      category,
      size,
      condition,
      regularPrice,
      salesPrice,
      productOffer,
      stock,
      heritage,
      quantity,
      status,
      description,
      isFeatured,
      isNew,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(brand)) {
      return res.status(400).json({
        success: false,
        error: "Invalid brand ID format",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID format",
      });
    }

    const brandExists = await Brand.exists({ _id: brand });
    if (!brandExists) {
      return res.status(400).json({
        success: false,
        error: "Brand not found",
      });
    }

    const categoryExists = await Category.exists({ _id: category });
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        error: "Category not found",
      });
    }

    if (
      isNaN(regularPrice) ||
      isNaN(salesPrice) ||
      isNaN(stock) ||
      isNaN(quantity)
    ) {
      return res.status(400).json({
        success: false,
        error: "Price, stock and quantity must be numbers",
      });
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    let deletedImages = [];
    try {
      deletedImages = JSON.parse(req.body.deletedImages || "[]");
    } catch (error) {
      console.error("Error parsing deletedImages:", error);
    }

    deletedImages.forEach((imagePath) => {
      const fullPath = path.join(__dirname, "../../public", imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    const remainingImages = existingProduct.productImage.filter(
      (image) => !deletedImages.includes(image),
    );

    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map(
        (file) => `/uploads/product-images/${file.filename}`,
      );
    }

    const updatedImages = [...remainingImages, ...newImages];

    if (updatedImages.length < 3) {
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          fs.unlink(file.path, () => {});
        });
      }
      return res.status(400).json({
        success: false,
        error: "At least 3 images are required",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        productName,
        brand,
        category,
        size,
        condition,
        regularPrice: parseFloat(regularPrice),
        salesPrice: parseFloat(salesPrice),
        productOffer:
          productOffer && !isNaN(productOffer) ? parseInt(productOffer) : 0,
        stock: parseInt(stock),
        heritage: heritage || "None",
        quantity: parseInt(quantity),
        status,
        description,
        productImage: updatedImages,
        isFeatured: isFeatured === "on",
        isNew: isNew === "on",
      },
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update Product Error:", error);

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        fs.unlink(file.path, () => {});
      });
    }

    let errorMessage = "Failed to update product";
    if (error.name === "ValidationError") {
      errorMessage = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  productInfo,
  addProduct,
  deleteProduct,
  editProduct,
  updateProduct,
};
