const Product = require("../../models/productSchema.js");

const newArrivalsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8; // Products per page

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalProducts = await Product.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      isNew: true,
    });

    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find({
      createdAt: { $gte: thirtyDaysAgo },
      isNew: true,
    })
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render("new-arrivals", {
      products,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
    });
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  newArrivalsPage,
};
