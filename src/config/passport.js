import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleTokenStrategy } from "passport-google-token";
//import FacebookTokenStrategy from "passport-facebook-token";
import User from "../models/User.js";

// ✅ Google Strategy
passport.use(new GoogleTokenStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ providerId: profile.id, provider: "google" });
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        provider: "google",
        providerId: profile.id,
        role: "client"
      });
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// import FacebookTokenStrategy from "passport-facebook-token";

// passport.use(new FacebookTokenStrategy({
//   clientID: process.env.FACEBOOK_APP_ID,
//   clientSecret: process.env.FACEBOOK_APP_SECRET
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     let user = await User.findOne({ providerId: profile.id, provider: "facebook" });
//     if (!user) {
//       user = await User.create({
//         name: profile.displayName,
//         email: profile.emails?.[0]?.value,
//         provider: "facebook",
//         providerId: profile.id,
//         role: "client"
//       });
//     }
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
// }));

export default passport;
