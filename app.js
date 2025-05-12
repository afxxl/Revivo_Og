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
const compression = require("compression");

db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache());

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const userSessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URL,
  collectionName: "user_sessions",
  ttl: 72 * 60 * 60,
  autoRemove: "native",
});

const adminSessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URL,
  collectionName: "admin_sessions",
  ttl: 72 * 60 * 60,
  autoRemove: "native",
});

app.use(
  /^(?!\/admin).*/,
  session({
    name: "user.sid",
    secret: process.env.SESSION_SECRET + "_user",
    resave: true,
    saveUninitialized: true,
    store: userSessionStore,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
      path: "/",
      sameSite: "lax",
    },
  }),
);

app.use(/^(?!\/admin).*/, passport.initialize());
app.use(/^(?!\/admin).*/, passport.session());

app.use(
  "/admin",
  session({
    name: "admin.sid",
    secret: process.env.SESSION_SECRET + "_admin",
    resave: true,
    saveUninitialized: true,
    store: adminSessionStore,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
      path: "/admin",
      sameSite: "lax",
    },
  }),
);

app.use(async (req, res, next) => {
  try {
    res.locals.user = null;
    res.locals.admin = null;

    if (
      req.session.user &&
      req.path.startsWith("/") &&
      !req.path.startsWith("/admin")
    ) {
      const user = await User.findById(req.session.user);
      if (user && !user.isBlocked && !user.isAdmin) {
        res.locals.user = user;
        req.user = user;
      } else {
        req.session.user = null;
        req.session.passport = null;
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });
      }
    }

    if (
      req.user &&
      req.path.startsWith("/") &&
      !req.path.startsWith("/admin")
    ) {
      const user = await User.findById(req.user._id);
      if (user && !user.isBlocked && !user.isAdmin) {
        res.locals.user = user;
        req.session.user = user._id;
      } else {
        req.user = null;
        req.session.user = null;
        req.session.passport = null;
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });
      }
    }

    if (req.session.admin && req.path.startsWith("/admin")) {
      const admin = await User.findById(req.session.admin);
      if (admin && admin.isAdmin) {
        res.locals.admin = admin;
      } else {
        req.session.admin = null;
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            resolve();
          });
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    etag: true,
    lastModified: true,
    immutable: true,
    index: false,
  }),
);
app.use("/Images", express.static(path.join(__dirname, "Images")));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(
  compression({
    level: 6,
    threshold: 0,
  }),
);

const uploadDir = path.join(__dirname, "public", "uploads", "re-image");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log("Server up");
});

module.exports = app;
