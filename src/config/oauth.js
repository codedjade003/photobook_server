import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findUserByEmail, createUser } from "../repositories/user.repo.js";
import { ensureRoleProfile } from "../repositories/profile.repo.js";

// Google OAuth Configuration
export const configureGoogleOAuth = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_BASE_URL}/api/auth/google/callback`
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Find or create user
          let user = await findUserByEmail(email);
          if (!user) {
            user = await createUser({
              name: profile.displayName || email.split("@")[0],
              email,
              passwordHash: null, // OAuth users don't have passwords
              role: "client",
              emailVerified: true // Google verified emails are already verified
            });
            await ensureRoleProfile({ userId: user.id, role: "client" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const { findUserById } = await import("../repositories/user.repo.js");
      const user = await findUserById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};

export default configureGoogleOAuth;

