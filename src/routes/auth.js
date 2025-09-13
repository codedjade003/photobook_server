import express from "express";
import passport from "passport";
import { signup, login, socialLogin, appleLogin } from "../controllers/authController.js";
import { getMe } from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Local
router.post("/signup", signup);
router.post("/login", login);

// Social
router.post("/google", passport.authenticate("google-token", { session: false }), socialLogin);
router.post("/facebook", passport.authenticate("facebook-token", { session: false }), socialLogin);
router.post("/apple", appleLogin);

// Protected
router.get("/me", auth(), getMe);

export default router;
