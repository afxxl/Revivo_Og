const User = require("../../models/userSchema.js");

const userInfo = async (req, res) => {
  try {
    let searchQuery = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    const searchConditions = {
      isAdmin: false,
    };

    if (searchQuery) {
      searchConditions.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
      ];
    }

    const userData = await User.find(searchConditions)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(searchConditions);

    const totalPages = Math.ceil(count / limit);

    res.render("users", {
      data: userData,
      totalPages: totalPages,
      currentPage: page,
      totalUsers: count,
      perPage: limit,
      searchQuery: searchQuery,
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

    const sessions = req.sessionStore.sessions;
    let sessionUpdated = false;

    console.log(`Blocking user with ID: ${id}`);

    for (let sessionId in sessions) {
      try {
        const sessionData = JSON.parse(sessions[sessionId]);
        if (sessionData.user && sessionData.user.toString() === id.toString()) {
          console.log(
            `Found session for user ${id}, setting wasBlockedByAdmin flag`,
          );

          sessionData.wasBlockedByAdmin = true;
          req.sessionStore.sessions[sessionId] = JSON.stringify(sessionData);
          sessionUpdated = true;
        }
      } catch (e) {
        console.error("Error parsing session:", e);
      }
    }

    if (sessionUpdated) {
      console.log(`Successfully updated session for user ${id}`);
    } else {
      console.log(`No active session found for user ${id}`);
    }

    res.redirect("/admin/users");
  } catch (err) {
    console.error("Error blocking user:", err);
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
