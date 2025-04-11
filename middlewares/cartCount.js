// cartCount.js

const Cart = require("../models/cartSchema.js");

const getCartCount = async (req, res, next) => {
  try {
    if (req.session.user) {
      const cart = await Cart.findOne({ userId: req.session.user });
      res.locals.cartCount = cart
        ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
        : 0;
    } else {
      res.locals.cartCount = 0;
    }
    next();
  } catch (error) {
    console.error("Error getting cart count:", error);
    res.locals.cartCount = 0;
    next();
  }
};

module.exports = getCartCount;
