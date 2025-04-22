const Wishlist = require('../models/wishlistSchema');

// Middleware to check wishlist count and handle errors
const checkWishlistCount = async (req, res, next) => {
  try {
    // Skip processing if user is not logged in
    if (!req.session.user) {
      res.locals.wishlistCount = 0;
      return next();
    }

    // Fetch wishlist from database
    const wishlist = await Wishlist.findOne({ userId: req.session.user });

    // Set wishlist count for views
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