const User = require("../../models/userSchema.js");

const mongoose = require("mongoose");

const bcrypt = require("bcrypt");

const pageerror = async (req, res) => {
  res.render("admin-error");
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.session.admin = admin._id;

    return res.json({
      success: true,
      message: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const dashboardData = {
        currentPage: "dashboard",
      };
      res.render("dashboard", dashboardData);
    } catch (err) {
      console.error("Dashboard error:", err);
      res.redirect("/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageerror");
      }
      return res.redirect("/admin/login");
    });
  } catch (err) {
    console.log("Logout error", err);
    res.redirect("/pageerror");
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
};
