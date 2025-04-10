const Product = require("../../models/productSchema.js");
const Category = require("../../models/categorySchema.js");
const Brand = require("../../models/brandSchema.js");

const featuredPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const filters = {
      category: req.query.category || "",
      brand: req.query.brand || "",
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    };
    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    let query = {
      isFeatured: true,
      status: "Available",
      category: { $in: listedCategoryIds },
    };

    if (filters.category) query.category = filters.category;
    if (filters.brand) query.brand = filters.brand;
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const brands = await Brand.find({}).lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("featured", {
      products,
      categories,
      brands,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  featuredPage,
};
