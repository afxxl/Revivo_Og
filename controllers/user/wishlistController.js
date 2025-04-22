const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

// Load wishlist page
const loadWishlistPage = async (req, res) => {
  try {
    console.log("Loading wishlist page for user:", req.session.user);

    // Find user's wishlist
    let wishlist = await Wishlist.findOne({
      userId: req.session.user,
    }).populate({
      path: "items.productId",
      populate: [
        { path: "category", select: "name categoryOffer isListed" },
        { path: "brand", select: "brandName isActive" },
      ],
    });

    console.log("Wishlist found:", wishlist ? "Yes" : "No");

    // If wishlist doesn't exist, create empty one
    if (!wishlist) {
      wishlist = { items: [] };
    } else {
      console.log(`Wishlist contains ${wishlist.items.length} items`);

      // Log each item in wishlist for debugging
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

    // Filter out unavailable products
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

    console.log(`Found ${availableItems.length} available items`);

    // Process items to include price information
    const wishlistItems = availableItems.map((item, index) => {
      const product = item.productId;

      // Calculate final price with offers
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

      // Make sure to convert product ID to string for consistent handling
      const processedItem = {
        ...item._doc,
        finalPrice,
        originalPrice: product.salesPrice,
        offerPercentage: bestOfferPercentage,
      };

      // Ensure the product ID is a string
      if (processedItem.productId && processedItem.productId._id) {
        console.log(
          `Original productId type for item ${index}: ${typeof processedItem.productId._id}`,
        );
        // Ensure it's available as a string
        processedItem.productId._id = processedItem.productId._id.toString();
        console.log(
          `Converted productId for item ${index}: ${processedItem.productId._id}`,
        );
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

    console.log(`Found ${unavailableItems.length} unavailable items`);

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

// Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log(
      `Adding product ${productId} to wishlist for user ${req.session.user || "guest"}`,
    );

    if (!req.session.user) {
      console.log("User not logged in, returning 401");
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

    // Validate product ID format
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error(`Invalid product ID format: ${productId}`);
      return res.status(400).json({
        success: false,
        message: `Invalid product ID format: ${productId}`,
      });
    }

    // Validate product exists and is available
    console.log(`Finding product with ID: ${productId}`);
    let product;
    try {
      product = await Product.findById(productId)
        .populate("brand")
        .populate("category");
      console.log(`Product found? ${!!product}`);
    } catch (err) {
      console.error(`Error finding product ${productId}:`, err);
      return res.status(400).json({
        success: false,
        message: `Invalid product ID format: ${productId}`,
      });
    }

    if (!product) {
      console.log(`Product not found with ID: ${productId}`);
      return res.status(404).json({
        success: false,
        message: `Product not found with ID: ${productId}`,
      });
    }

    console.log(
      `Found product: ${product.productName}, isListed: ${product.isListed}, stock: ${product.stock}, status: ${product.status}`,
    );
    console.log(
      `Brand: ${product.brand ? product.brand.brandName + " isActive: " + product.brand.isActive : "No brand"}`,
    );
    console.log(
      `Category: ${product.category ? product.category.name + " isListed: " + product.category.isListed : "No category"}`,
    );

    // Check product availability
    if (!product.isListed) {
      console.log(`Product ${productId} is not listed`);
      return res.status(400).json({
        success: false,
        message: "This product is no longer available",
      });
    }

    if (!product.brand || !product.brand.isActive) {
      console.log(`Product ${productId}'s brand is not available`);
      return res.status(400).json({
        success: false,
        message: "This product's brand is not available",
      });
    }

    if (!product.category || !product.category.isListed) {
      console.log(`Product ${productId}'s category is not available`);
      return res.status(400).json({
        success: false,
        message: "This product's category is not available",
      });
    }

    if (product.stock <= 0 || product.status !== "Available") {
      console.log(`Product ${productId} is out of stock or not available`);
      return res.status(400).json({
        success: false,
        message: "This product is out of stock",
      });
    }

    // Use findOneAndUpdate with $addToSet to atomically add the product to the wishlist if it doesn't exist
    console.log(
      `Adding product ${productId} to wishlist using atomic operation`,
    );

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
        new: true, // Return the updated document
        upsert: true, // Create the document if it doesn't exist
      },
    );

    console.log(
      `Wishlist operation complete. New count: ${result.items.length}`,
    );

    // Check if the item was added (by comparing length before and after)
    const productExists = result.items.some(
      (item) =>
        item.productId && item.productId.toString() === productId.toString(),
    );

    console.log(`Product ${productId} is in wishlist? ${productExists}`);

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

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log(
      `Attempting to remove product ${productId} from wishlist for user ${req.session.user || "guest"}`,
    );

    if (!productId) {
      console.log("No product ID provided for removal");
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!req.session.user) {
      console.log("User not logged in for wishlist removal");
      return res.status(401).json({
        success: false,
        message: "Please login to manage your wishlist",
      });
    }

    // Validate that productId is a valid ObjectId
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error(`Invalid product ID format for removal: ${productId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    console.log(`Removing product ${productId} using atomic operation`);

    // Use findOneAndUpdate with $pull operator to remove items matching productId
    // This is atomic and prevents version errors from concurrent operations
    const result = await Wishlist.findOneAndUpdate(
      { userId: req.session.user },
      { $pull: { items: { productId: productId } } },
      { new: true }, // Return updated document
    );

    if (!result) {
      console.log(`No wishlist found for user ${req.session.user}`);
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    console.log(`Product removed. New wishlist count: ${result.items.length}`);
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

// Check if an item is in wishlist
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

    // If user is not logged in, return false immediately
    if (!req.session.user) {
      return res.json({
        inWishlist: false,
        success: true,
      });
    }

    // Validate that productId is a valid ObjectId
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

    // Check if product is in wishlist
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

// Count wishlist items
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
