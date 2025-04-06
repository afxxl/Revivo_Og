const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuid(),
    unique: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ],
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["COD", "ONLINE", "WALLET"],
  },
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED"],
    default: "PENDING",
  },
  deliveryInstructions: String,
  estimatedDeliveryDate: Date,
});
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
