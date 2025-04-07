const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "product",
        required: true,
      },
      addedOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

module.exports = Wishlist;
