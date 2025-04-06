const User = require("../models/userSchema.js");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch((error) => {
        console.log("Error in user auth middleware");
        res.status(500).send("Internal Server error");
      });
  } else {
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    User.findById(req.session.admin)
      .then((data) => {
        if (data && data.isAdmin) {
          next();
        } else {
          res.redirect("/admin/login");
        }
      })
      .catch((error) => {
        console.log("Error in adminAuth middleware", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/admin/login");
  }
};

module.exports = {
  userAuth,
  adminAuth,
};
