import express from "express";
import passport from "passport";
import { signup, login, socialLogin, appleLogin, updateRole, updateProfile, verifyEmail, requestPasswordReset, resetPassword } from "../controllers/authController.js";
import { getMe } from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Local
router.post("/signup", signup);
router.post("/login", login);
// Email verification
router.post("/verify-email", verifyEmail);

// Password reset
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", resetPassword);

// Social
router.post("/google", passport.authenticate("google-token", { session: false }), socialLogin);
router.post("/facebook", passport.authenticate("facebook-token", { session: false }), socialLogin);
router.post("/apple", appleLogin);

// Protected
router.get("/me", auth(), getMe);
router.put("/profile", auth(), updateProfile);

// Patch user role
router.patch("/role", auth(), updateRole);

export default router;
