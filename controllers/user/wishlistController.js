const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

const loadWishlistPage = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({
      userId: req.session.user,
    }).populate({
      path: "items.productId",
      populate: [
        { path: "category", select: "name categoryOffer isListed" },
        { path: "brand", select: "brandName isActive" },
      ],
    });

    if (!wishlist) {
      wishlist = { items: [] };
    } else {
      wishlist.items.forEach((item, index) => {
        const productExists = !!item.productId;
        console.log(`Item ${index + 1}:`);
        console.log(`- Product exists: ${productExists}`);
        if (productExists) {
          console.log(`- Product ID: ${item.productId._id}`);
          console.log(`- Product Name: ${item.productId.productName}`);
          console.log(
            `- Brand: ${item.productId.brand ? item.productId.brand.brandName : "Not found"}`,
          );
          console.log(
            `- Category: ${item.productId.category ? item.productId.category.name : "Not found"}`,
          );
          console.log(`- isListed: ${item.productId.isListed}`);
          console.log(`- Stock: ${item.productId.stock}`);
          console.log(`- Status: ${item.productId.status}`);
        }
      });
    }

    const availableItems = wishlist.items.filter((item) => {
      const product = item.productId;
      return (
        product &&
        product.isListed &&
        product.brand &&
        product.brand.isActive &&
        product.category &&
        product.category.isListed &&
        product.stock > 0 &&
        product.status === "Available"
      );
    });

    const wishlistItems = availableItems.map((item, index) => {
      const product = item.productId;

      const productOffer = product.productOffer || 0;
      const categoryOffer =
        product.category && product.category.categoryOffer
          ? product.category.categoryOffer
          : 0;
      const bestOfferPercentage = Math.max(productOffer, categoryOffer);

      let finalPrice = product.salesPrice;
      if (bestOfferPercentage > 0) {
        const offerAmount = product.salesPrice * (bestOfferPercentage / 100);
        finalPrice = product.salesPrice - offerAmount;
      }

      const processedItem = {
        ...item._doc,
        finalPrice,
        originalPrice: product.salesPrice,
        offerPercentage: bestOfferPercentage,
      };

      if (processedItem.productId && processedItem.productId._id) {
        processedItem.productId._id = processedItem.productId._id.toString();
      }

      return processedItem;
    });

    const unavailableItems = wishlist.items.filter((item) => {
      const product = item.productId;
      return (
        !product ||
        !product.isListed ||
        !product.brand ||
        !product.brand.isActive ||
        !product.category ||
        !product.category.isListed ||
        product.stock <= 0 ||
        product.status !== "Available"
      );
    });

    res.render("wishlist", {
      wishlistItems,
      unavailableItems,
      title: "Your Wishlist | REVIVO",
    });
  } catch (error) {
    console.error("Error loading wishlist:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).render("user/error", {
      message: "Failed to load wishlist. Please try again later.",
      error: error.message,
    });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to your wishlist",
      });
    }

    if (!productId) {
      console.log("No product ID provided");
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid product ID format: ${productId}`,
      });
    }

    let product;
    try {
      product = await Product.findById(productId)
        .populate("brand")
        .populate("category");
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: `Invalid product ID format: ${productId}`,
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with ID: ${productId}`,
      });
    }

    if (!product.isListed) {
      return res.status(400).json({
        success: false,
        message: "This product is no longer available",
      });
    }

    if (!product.brand || !product.brand.isActive) {
      return res.status(400).json({
        success: false,
        message: "This product's brand is not available",
      });
    }

    if (!product.category || !product.category.isListed) {
      return res.status(400).json({
        success: false,
        message: "This product's category is not available",
      });
    }

    if (product.stock <= 0 || product.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: "This product is out of stock",
      });
    }

    const newItem = {
      productId: productId,
      addedAt: new Date(),
    };

    const result = await Wishlist.findOneAndUpdate(
      { userId: req.session.user },
      {
        $addToSet: { items: newItem },
      },
      {
        new: true,
        upsert: true,
      },
    );

    const productExists = result.items.some(
      (item) =>
        item.productId && item.productId.toString() === productId.toString(),
    );

    if (productExists) {
      return res.json({
        success: true,
        message: "Product added to wishlist",
        inWishlist: true,
        wishlistCount: result.items.length,
      });
    } else {
      return res.json({
        success: true,
        inWishlist: true,
        message: "Product already in wishlist",
        wishlistCount: result.items.length,
      });
    }
  } catch (error) {
    console.error("Error adding to wishlist:", error.message);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({
      success: false,
      message: `Failed to add product to wishlist: ${error.message}`,
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Please login to manage your wishlist",
      });
    }

    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const result = await Wishlist.findOneAndUpdate(
      { userId: req.session.user },
      { $pull: { items: { productId: productId } } },
      { new: true },
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    return res.json({
      success: true,
      message: "Product removed from wishlist",
      inWishlist: false,
      wishlistCount: result.items.length,
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error.message);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist: " + error.message,
    });
  }
};

const checkWishlistStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
        inWishlist: false,
      });
    }

    if (!req.session.user) {
      return res.json({
        inWishlist: false,
        success: true,
      });
    }

    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
        inWishlist: false,
      });
    }

    const wishlist = await Wishlist.findOne({ userId: req.session.user });

    if (!wishlist) {
      return res.json({
        inWishlist: false,
        success: true,
      });
    }

    const inWishlist = wishlist.items.some((item) => {
      if (!item.productId) return false;
      return item.productId.toString() === productId.toString();
    });

    return res.json({
      inWishlist,
      success: true,
    });
  } catch (error) {
    console.error("Error checking wishlist status:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to check wishlist status: " + error.message,
      inWishlist: false,
    });
  }
};

const getWishlistCount = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({
        count: 0,
      });
    }

    const wishlist = await Wishlist.findOne({ userId: req.session.user });

    return res.json({
      count: wishlist ? wishlist.items.length : 0,
    });
  } catch (error) {
    console.error("Error getting wishlist count:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to get wishlist count",
    });
  }
};

module.exports = {
  loadWishlistPage,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  getWishlistCount,
};
