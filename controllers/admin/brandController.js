const Brand = require("../../models/brandSchema");
const path = require("path");
const fs = require("fs");

const Product = require("../../models/productSchema");

const getBrandPage = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const brandData = await Brand.find({
      brandName: { $regex: ".*" + search + ".*", $options: "i" },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments({
      brandName: { $regex: ".*" + search + ".*", $options: "i" },
    });
    const totalPages = Math.ceil(totalBrands / limit);

    res.render("brands", {
      data: brandData,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (err) {
    console.error("Get Brand Error:", err);
    res.redirect("/admin/pageerror");
  }
};

const brandInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    const brandData = await Brand.find({
      brandName: { $regex: ".*" + search + ".*", $options: "i" },
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await Brand.countDocuments({
      brandName: { $regex: ".*" + search + ".*", $options: "i" },
    });

    const totalPages = Math.ceil(count / limit);

    res.render("admin/brands", {
      data: brandData,
      totalPages: totalPages,
      currentPage: page,
      totalBrands: count,
      perPage: limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const addBrand = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Brand image is required" });
    }

    const imagePath = "/uploads/brand-images/" + req.file.filename;

    const existingBrand = await Brand.findOne({
      brandName: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingBrand) {
      return res.status(400).json({ error: "Brand already exists" });
    }

    const newBrand = new Brand({
      brandName: name.trim(),
      brandImage: [imagePath],
      isActive: true,
    });

    await newBrand.save();
    console.log("Brand saved:", newBrand);

    return res.status(200).json({
      success: true,
      message: "Brand added successfully",
      brand: newBrand,
    });
  } catch (error) {
    console.error("Add Brand Error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while adding the brand",
    });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const brandId = req.params.id;

    // Optional: Check if any products are associated with this brand
    // const products = await Product.find({ brand: brandId });
    // if (products.length > 0) {
    //     return res.status(400).json({
    //         error: "Cannot delete brand with associated products"
    //     });
    // }

    const deletedBrand = await Brand.findByIdAndDelete(brandId);

    if (!deletedBrand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    // Optional: Delete the associated image file
    // fs.unlinkSync(path.join(__dirname, '../public', deletedBrand.brandImage[0]));

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete Brand Error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while deleting the brand",
    });
  }
};

//getEditBrand
const getEditBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.redirect("/admin/brands"); // or show error page
    }
    res.render("edit-brand", { brand }); // Render the EJS template with brand data
  } catch (error) {
    console.error("Edit Brand Error:", error);
    res.redirect("/admin/pageerror"); // or handle error appropriately
  }
};

const updateBrand = async (req, res) => {
  try {
    const brandId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    const updateData = {
      brandName: name.trim(),
    };

    if (req.file) {
      const imagePath = "/uploads/brand-images/" + req.file.filename;
      updateData.brandImage = [imagePath];
    }

    const updatedBrand = await Brand.findByIdAndUpdate(brandId, updateData, {
      new: true,
    });

    if (!updatedBrand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      brand: updatedBrand,
    });
  } catch (error) {
    console.error("Update Brand Error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while updating the brand",
    });
  }
};
const toggleBrandStatus = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    brand.isActive = !brand.isActive;
    await brand.save();

    return res.status(200).json({
      success: true,
      message: `Brand ${brand.isActive ? "activated" : "deactivated"} successfully`,
      isActive: brand.isActive,
    });
  } catch (error) {
    console.error("Toggle Brand Error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while toggling brand status",
    });
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  deleteBrand,
  getEditBrand,
  updateBrand,
  toggleBrandStatus,
  brandInfo,
};
