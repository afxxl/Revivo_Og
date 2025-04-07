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

db();
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  }),
);
app.use(function (req, res, next) {
  res.locals.user = req.user || null;

  if (req.session.user) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public")));
app.use("/Images", express.static(path.join(__dirname, "Images")));
app.listen(process.env.PORT, () => {
  console.log("Server up");
});

app.use("/", userRouter);
app.use("/admin", adminRouter);

const uploadDir = path.join(__dirname, "public", "uploads", "re-image");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

module.exports = app;
