const Product = require("../../models/productSchema.js");

const featuredPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8; // Products per page

    const totalProducts = await Product.countDocuments({ isFeatured: true });
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find({ isFeatured: true })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render("featured", {
      products,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
    });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  featuredPage,
};
