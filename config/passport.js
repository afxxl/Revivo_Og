const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema.js");
const referralHelper = require("../helpers/referralHelper");
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      passReqToCallback: true,
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
            // Generate a referral code for the new user
            const referralCode = await referralHelper.generateReferralCode();
            
            // Check if a referral code was provided in the session
            const referredBy = req.session.referralCode 
              ? await User.findOne({ referralCode: req.session.referralCode }) 
              : null;
            
            user = new User({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              isBlocked: false,
              referralCode: referralCode,
              referredBy: referredBy ? referredBy._id : null
            });
            
            await user.save();
            
            // Process referral reward if applicable
            if (referredBy) {
              await referralHelper.processReferralReward(user, req.session.referralCode);
              // Clear the referral code from session after use
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
