import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { OAuth2Client } from "google-auth-library";
import { Strategy as CustomStrategy } from "passport-custom";
import User from "../models/User.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ✅ Google ID Token Strategy
passport.use("google-token", new CustomStrategy(async (req, done) => {
  try {
    const idToken = req.body.idToken; // Flutter sends this
    if (!idToken) {
      return done(null, false, { message: "No ID token provided" });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    let user = await User.findOne({ providerId: payload.sub, provider: "google" });
    if (!user) {
      user = await User.create({
        name: payload.name,
        email: payload.email,
        provider: "google",
        providerId: payload.sub,
        role: "client",
      });
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

export default passport;
