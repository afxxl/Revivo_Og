const Product = require("../../models/productSchema.js");
const Brand = require("../../models/brandSchema.js");
const Category = require("../../models/categorySchema.js");

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const filters = {
      category: req.query.category,
      brand: req.query.brand,
      size: req.query.size,
      condition: req.query.condition,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      heritage: req.query.heritage,
      status: req.query.status || "Available",
    };
    const categories = await Category.find({ isListed: true }).lean();
    const brands = await Brand.find({}).lean();
    const listedCategoryIds = categories.map((cat) => cat._id);

    let query = { status: "Available", category: { $in: listedCategoryIds } };

    if (req.query.category && filters.category !== "all") {
      query.category = filters.category;
    }
    if (filters.brand) query.brand = filters.brand;
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.heritage) query.heritage = filters.heritage;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("shop", {
      products,
      categories,
      brands,
      selectedCategory: filters.category || "all",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (error) {
    console.error("Error fetching shop data:", error);
    res.status(500).send("Server Error");
  }
};
const loadBrandPage = async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const brand = await Brand.findById(brandId).lean();
    if (!brand) {
      return res.status(404).render("page-404");
    }

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      brand: brandId,
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("brand", {
      brand,
      products,
      title: `${brand.brandName} | REVIVO`,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("page-404");
  }
};

//heritage

const loadPrimeLayers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    let query = {
      heritage: "Prime Layers",
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("prime-layers", {
      products,
      title: "Prime Layers Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Prime Layers:", err);
    res.status(500).send("Server Error");
  }
};

const loadVintageAthletics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      heritage: "Vintage Athletics",
      status: "Available",
      category: { $in: listedCategoryIds },
    };
    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("vintage-athletics", {
      products,
      title: "Vintage Athletics Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Vintage Athletics:", err);
    res.status(500).send("Server Error");
  }
};

const loadY2kEssentials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const skip = (page - 1) * perPage;

    const categories = await Category.find({ isListed: true }).lean();

    const listedCategoryIds = categories.map((cat) => cat._id);

    const filters = {
      size: req.query.size || "",
      condition: req.query.condition || "",
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      status: req.query.status || "Available",
    };

    let query = {
      heritage: "Y2K Essentials",
      status: "Available",
      category: { $in: listedCategoryIds },
    };

    if (filters.size) query.size = filters.size;
    if (filters.condition) query.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      query.salesPrice = {};
      if (filters.minPrice) query.salesPrice.$gte = filters.minPrice;
      if (filters.maxPrice) query.salesPrice.$lte = filters.maxPrice;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate("category")
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("y2k-essentials", {
      products,
      title: "Y2K Essentials Collection | REVIVO",
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      filters,
    });
  } catch (err) {
    console.error("Error loading Y2K Essentials:", err);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  shopPage,
  loadBrandPage,
  loadPrimeLayers,
  loadVintageAthletics,
  loadY2kEssentials,
};
