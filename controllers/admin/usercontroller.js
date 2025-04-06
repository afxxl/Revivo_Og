const User = require("../../models/userSchema.js");

const userInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("users", {
      data: userData,
      totalPages: totalPages,
      currentPage: page,
      totalUsers: count,
      perPage: limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const userBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/users");
  } catch (err) {
    res.redirect("/pageerror");
  }
};

const userUnBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/users");
  } catch (err) {
    res.redirect("/pageerror");
  }
};

module.exports = {
  userInfo,
  userBlocked,
  userUnBlocked,
};
