const Coupon = require("../../models/couponSchema");

// Load coupon management page
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    res.render("admin-coupons", {
      coupons,
      currentPage: "coupons",
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.redirect("/admin/pageerror");
  }
};

// Add new coupon
const addCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountAmount,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
    });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // Create new coupon
    const newCoupon = new Coupon({
      code: code.trim().toUpperCase(),
      description,
      discountType,
      discountAmount,
      minPurchase: minPurchase || 0,
      maxDiscount: maxDiscount || null,
      startDate,
      endDate,
      usageLimit: usageLimit || 1,
    });

    await newCoupon.save();

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create coupon",
    });
  }
};

// Edit coupon page
const getEditCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId).populate({
      path: "usedBy.user",
      select: "name email",
    });

    if (!coupon) {
      return res.redirect("/admin/coupons");
    }

    res.render("admin-edit-coupon", {
      coupon,
      currentPage: "coupons",
    });
  } catch (error) {
    console.error("Error fetching coupon for edit:", error);
    res.redirect("/admin/pageerror");
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      description,
      discountType,
      discountAmount,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        description,
        discountType,
        discountAmount,
        minPurchase: minPurchase || 0,
        maxDiscount: maxDiscount || null,
        startDate,
        endDate,
        usageLimit: usageLimit || 1,
      },
      { new: true },
    );

    if (!updatedCoupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon",
    });
  }
};

// Toggle coupon active status
const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon status",
    });
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const result = await Coupon.findByIdAndDelete(couponId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
    });
  }
};

// Get coupon usage data
const getCouponUsage = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId).populate({
      path: "usedBy.user",
      select: "name email",
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      usedBy: coupon.usedBy,
    });
  } catch (error) {
    console.error("Error fetching coupon usage data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupon usage data",
    });
  }
};

module.exports = {
  getCoupons,
  addCoupon,
  getEditCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getCouponUsage,
};
