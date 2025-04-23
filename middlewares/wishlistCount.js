const Wishlist = require("../models/wishlistSchema");

const checkWishlistCount = async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.wishlistCount = 0;
      return next();
    }

    const wishlist = await Wishlist.findOne({ userId: req.session.user });

    if (wishlist && wishlist.items) {
      res.locals.wishlistCount = wishlist.items.length;
    } else {
      res.locals.wishlistCount = 0;
    }

    next();
  } catch (error) {
    console.error("Error checking wishlist count:", error.message);
    res.locals.wishlistCount = 0;
    next();
  }
};

module.exports = checkWishlistCount;
