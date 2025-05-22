const User = require("../../models/userSchema.js");

const storeTempEmail = (req, res) => {
  const { email } = req.body;
  if (email) {
    req.session.tempEmail = email;
    req.session.save((err) => {
      if (err) {
        console.error("Error saving email to session:", err);
        return res.status(500).json({ success: false });
      }
      return res.json({ success: true });
    });
  } else {
    res.json({ success: false, message: "No email provided" });
  }
};

const prepareGoogleAuth = (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  console.log(
    `Google OAuth login initiated from: ${req.headers.host}, User-Agent: ${userAgent.substring(0, 50)}...`,
  );

  if (req.session.email && !req.session.tempEmail) {
    req.session.tempEmail = req.session.email;
  }

  next();
};

const storeReferralCode = (req, res) => {
  try {
    const { referralCode } = req.body;

    if (referralCode) {
      req.session.referralCode = referralCode;
      req.session.save((err) => {
        if (err) {
          console.error("Error saving referral code to session:", err);
          return res.status(500).json({ success: false });
        }
        return res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    console.error("Error storing referral code:", error);
    res.status(500).json({ success: false });
  }
};

const handleGoogleCallback = (req, res, next) => {
  console.log("Google OAuth callback received:", {
    code: req.query.code ? "present" : "missing",
    state: req.query.state,
    error: req.query.error,
    host: req.headers.host,
    protocol: req.headers["x-forwarded-proto"] || req.protocol,
    userAgent: req.headers["user-agent"]?.substring(0, 50) + "...",
  });

  console.log("OAuth callback headers:", JSON.stringify(req.headers, null, 2));
  console.log("OAuth callback query:", JSON.stringify(req.query, null, 2));
  console.log(
    "OAuth callback session:",
    req.session ? "Session exists" : "No session",
  );

  require("passport").authenticate(
    "google",
    { failWithError: true },
    function (err, user, info) {
      if (err) {
        console.error("Google OAuth error details:", err.name, err.message);

        if (err.name === "TokenError") {
          if (req.session.user) {
            console.log("User already has a session, redirecting to home");
            return res.redirect("/");
          }

          if (err.message.includes("Invalid authorization code")) {
            console.log(
              "Invalid auth code, likely due to double-click or expired code",
            );

            if (req.session.tempEmail) {
              console.log(
                "Redirecting to login with temp email:",
                req.session.tempEmail,
              );
              return res.redirect(
                `/login?email=${encodeURIComponent(
                  req.session.tempEmail,
                )}&error=auth_code`,
              );
            }

            return res.redirect(
              "/login?error=token_error&msg=" +
                encodeURIComponent("Please try again or use email login"),
            );
          }

          return res.redirect(
            "/login?error=token_error&msg=" +
              encodeURIComponent("Please try again or use email login"),
          );
        }

        return res.redirect(
          "/login?error=" +
            encodeURIComponent(err.message || "Authentication failed"),
        );
      }

      if (!user) {
        if (info && info.message) {
          if (info.message === "User is blocked by admin") {
            return res.redirect(
              "/login?error=blocked_user&message=" +
                encodeURIComponent("Your account has been blocked by admin"),
            );
          }
          return res.redirect(
            "/login?error=" + encodeURIComponent(info.message),
          );
        }
        return res.redirect("/login?error=authentication_failed");
      }

      req.login(user, function (loginErr) {
        if (loginErr) {
          console.error("Login error after OAuth:", loginErr);
          return res.redirect("/login?error=login_failed");
        }

        req.session.user = user;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Error saving user session after OAuth:", saveErr);
            return res.redirect("/login?error=session_save");
          }

          res.redirect("/");
        });
      });
    },
  )(req, res, next);
};

module.exports = {
  storeTempEmail,
  prepareGoogleAuth,
  storeReferralCode,
  handleGoogleCallback,
};
