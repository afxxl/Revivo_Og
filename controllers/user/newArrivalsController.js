const Product = require("../../models/productSchema.js");
const Category = require("../../models/categorySchema.js");
const Brand = require("../../models/brandSchema.js");

const newArrivalsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 15;
    const skip = (page - 1) * perPage;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const filters = {
      category: req.query.category || "",
      brand: req.query.brand || "",
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      sort: req.query.sort || "", // Add sort filter
      search: req.query.search || "", // Add search filter
    };

    const categories = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);
    const activeBrands = await Brand.find({ isActive: true }).lean();
    const activeBrandIds = activeBrands.map((brand) => brand._id);

    let query = {
      createdAt: { $gte: thirtyDaysAgo },
      isNew: true,
      isListed: true,
      brand: { $in: activeBrandIds },
    };

    // Add search functionality
    if (filters.search) {
      query.$or = [
        { productName: { $regex: new RegExp(filters.search, 'i') } },
        { description: { $regex: new RegExp(filters.search, 'i') } }
      ];
      
      // Also search by brand name
      const matchingBrands = await Brand.find({ 
        name: { $regex: new RegExp(filters.search, 'i') },
        isActive: true 
      }).lean();
      
      if (matchingBrands.length > 0) {
        const brandIds = matchingBrands.map(brand => brand._id);
        query.$or.push({ brand: { $in: brandIds } });
      }
    }

    if (filters.category) {
      query.category = filters.category;
    } else {
      if (!filters.search) {
        query.$or = [
          { category: { $in: listedCategoryIds } },
          { category: { $exists: true } },
        ];
      } else {
        // If we have a search query, add category filter to existing $or
        query.$and = [
          { $or: query.$or },
          { 
            $or: [
              { category: { $in: listedCategoryIds } },
              { category: { $exists: true } },
            ]
          }
        ];
        delete query.$or;
      }
    }

    if (filters.brand) query.brand = filters.brand;
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments({
      ...query,
      isListed: true,
    });
    const totalPages = Math.ceil(totalProducts / perPage);

    // Define sort options
    let sortOption = {};
    if (filters.sort === "low-to-high") {
      sortOption = { salesPrice: 1 }; // Ascending (low to high)
    } else if (filters.sort === "high-to-low") {
      sortOption = { salesPrice: -1 }; // Descending (high to low)
    } else {
      sortOption = { createdAt: -1 }; // Default sorting by creation date
    }

    const products = await Product.find(query)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isActive: true },
      })
      .sort(sortOption) // Apply sorting
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("new-arrivals", {
      products,
      categories,
      brands: activeBrands,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  newArrivalsPage,
};
