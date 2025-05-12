const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema.js");
const referralHelper = require("../helpers/referralHelper");
require("dotenv").config();

// Determine which callback URL to use based on environment
let callbackURL;
if (process.env.NODE_ENV === 'production') {
  callbackURL = "https://www.revivo.live/auth/google/callback";
} else {
  callbackURL = "http://localhost:3000/auth/google/callback";
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL,
      passReqToCallback: true,
      proxy: true, // Handle proxy issues in production
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo', // Use v3 API
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            if (user.isBlocked) {
              return done(null, false, { message: "User is blocked by admin" });
            }

            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          } else {
            const referralCode = await referralHelper.generateReferralCode();

            const referredBy = req.session.referralCode
              ? await User.findOne({ referralCode: req.session.referralCode })
              : null;

            user = new User({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              isBlocked: false,
              referralCode: referralCode,
              referredBy: referredBy ? referredBy._id : null,
            });

            await user.save();

            if (referredBy) {
              await referralHelper.processReferralReward(
                user,
                req.session.referralCode,
              );
              delete req.session.referralCode;
            }
          }
        } else {
          if (user.isBlocked) {
            return done(null, false, { message: "User is blocked by admin" });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
