const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      required: true,
      enum: ["Like New", "Gently Used", "Fair Condition"],
    },
    regularPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    salesPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    productOffer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["Available", "Out of stock", "Discontinued"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    productImage: [
      {
        type: String,
        required: true,
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    heritage: {
      type: String,
      enum: ["Prime Layers", "Vintage Athletics", "Y2K Essentials", "None"],
      default: "None",
    },
  },
  {
    timestamps: true,
  },
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
