const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    const categoryData = await Category.find({
      name: { $regex: ".*" + search + ".*", $options: "i" },
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Category.countDocuments({
      name: { $regex: ".*" + search + ".*", $options: "i" },
    });

    const totalPages = Math.ceil(count / limit);

    res.render("category", {
      cat: categoryData,
      totalPages: totalPages,
      currentPage: page,
      totalCategories: count,
      perPage: limit,
      searchQuery: search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
const addCategory = async (req, res) => {
  try {
    const { name, description, categoryOffer } = req.body;
    const image = req.file
      ? `/uploads/category-images/${req.file.filename}`
      : "";

    if (!name || !description) {
      return res
        .status(400)
        .json({ error: "Name and description are required" });
    }

    const offerValue =
      categoryOffer !== undefined ? parseFloat(categoryOffer) : 0;
    if (isNaN(offerValue) || offerValue < 0 || offerValue > 100) {
      return res.status(400).json({
        error: "Category offer must be a number between 0 and 100",
      });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const existingCategory = await Category.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
        { slug: slug },
      ],
    });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory = new Category({
      name: name.trim(),
      description: description.trim(),
      image: image,
      slug: slug,
      isListed: true,
      categoryOffer: offerValue,
    });

    await newCategory.save();
    return res.status(200).json({
      success: true,
      message: "Category added successfully",
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while adding the category",
    });
  }
};

const editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.render("editCategory", { category });
  } catch (err) {
    console.error("Error fetching category:", err);
    res.redirect("/admin/pageerror");
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, categoryOffer } = req.body;
    const image = req.file
      ? `/uploads/category-images/${req.file.filename}`
      : req.body.existingImage;

    if (!name || !description) {
      return res
        .status(400)
        .json({ error: "Name and description are required" });
    }

    const offerValue =
      categoryOffer !== undefined ? parseFloat(categoryOffer) : undefined;
    if (
      offerValue !== undefined &&
      (isNaN(offerValue) || offerValue < 0 || offerValue > 100)
    ) {
      return res.status(400).json({
        error: "Category offer must be a number between 0 and 100",
      });
    }

    const newSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const existingCategory = await Category.findOne({
      _id: { $ne: categoryId },
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, "i") } },
        { slug: newSlug },
      ],
    });

    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "category with this name already exists" });
    }

    const updateData = {
      name: name.trim(),
      description: description.trim(),
      image: image,
      slug: newSlug,
    };

    if (offerValue !== undefined) {
      updateData.categoryOffer = offerValue;
    }

    const updateCategory = await Category.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true },
    );

    if (!updateCategory) {
      return res.status(404).json({ error: "category not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category: updateCategory,
    });
  } catch (err) {
    console.error("Error updating category:", err);
    return res.status(500).json({
      error: err.message || "An error occurred while updating the category",
    });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    category.isListed = !category.isListed;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category ${category.isListed ? "listed" : "unlisted"} successfully`,
      isListed: category.isListed,
    });
  } catch (error) {
    console.error("Error toggling category status:", error);
    return res.status(500).json({
      error:
        error.message || "An error occurred while toggling the category status",
    });
  }
};

const updateCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { categoryOffer } = req.body;

    if (categoryOffer !== undefined) {
      if (isNaN(categoryOffer) || categoryOffer < 0 || categoryOffer > 100) {
        return res.status(400).json({
          success: false,
          error: "Category offer must be a number between 0 and 100",
        });
      }
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    const offerValue = categoryOffer || 0;

    category.categoryOffer = offerValue;
    await category.save();

    return res.status(200).json({
      success: true,
      message:
        offerValue > 0
          ? "Category offer added successfully"
          : "Category offer removed successfully",
      categoryOffer: offerValue,
    });
  } catch (error) {
    console.error("Update Category Offer Error:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while updating the category offer",
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    await Category.findByIdAndDelete(categoryId);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while deleting the category",
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).select("name");
    return res.json(categories);
  } catch (error) {
    console.error("Error fetching categories for API:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  editCategory,
  updateCategory,
  toggleCategoryStatus,
  updateCategoryOffer,
  deleteCategory,
  getCategories,
};
