const Product = require("../../models/productSchema.js");
const Brand = require("../../models/brandSchema.js");
const Category = require("../../models/categorySchema.js");

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8; // Products per page

    const categories = await Category.find({ isListed: true }).lean();
    const brands = await Brand.find({}).lean();

    let query = {};
    if (req.query.category) {
      query.category = req.query.category;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render("shop", {
      products,
      categories,
      brands,
      selectedCategory: req.query.category || "all",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
    });
  } catch (error) {
    console.error("Error fetching shop data:", error);
    res.status(500).send("Server Error");
  }
};

const loadBrandPage = async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const brand = await Brand.findById(brandId);

    if (!brand) {
      return res.status(404).render("404");
    }

    const products = await Product.find({
      brand: brandId,
    }).populate("category");

    res.render("brand", {
      brand,
      products,
      title: `${brand.brandName} | REVIVO`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("500");
  }
};

module.exports = {
  shopPage,
  loadBrandPage,
};
