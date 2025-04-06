const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({
  brandName: {
    type: String,
    required: true,
  },
  brandImage: {
    type: [String],
    required: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  logo: {
    type: String,
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true,
  },
});

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
