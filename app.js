const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const db = require("./config/db.js");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const session = require("express-session");
const passport = require("./config/passport.js");
const fs = require("fs");
const MongoStore = require("connect-mongo");
const User = require("./models/userSchema.js");
const nocache = require("nocache");

db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache());
app.use(
  session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),

    cookie: {
      secure: false,

      httpOnly: true,

      maxAge: 72 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
  try {
    if (req.user) {
      res.locals.user = req.user;
      req.session.user = req.user._id;
      return next();
    }

    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user) {
        res.locals.user = user;
        req.user = user;
        return next();
      }
    }

    res.locals.user = null;
    next();
  } catch (err) {
    console.error("Session middleware error:", err);
    next(err);
  }
});

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public")));
app.use("/Images", express.static(path.join(__dirname, "Images")));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const uploadDir = path.join(__dirname, "public", "uploads", "re-image");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.listen(process.env.PORT, () => {
  console.log("Server up");
});

module.exports = app;
