// src/routes/profile.js
import express from "express";
import auth from "../middleware/auth.js";
import { upload } from "../config/multerS3.js";
import {
  getProfile,
  updateCreativeProfile,
  updateClientProfile,
  uploadPortfolioItem,
  deletePortfolioItem,
  uploadAvatar
} from "../controllers/profileController.js";

const router = express.Router();

// Public
router.get("/profiles/:id", getProfile);

// Protected - owner only updates
router.put("/profiles/creative", auth(["photographer"]), updateCreativeProfile);
router.put("/profiles/client", auth(), updateClientProfile); // owner check inside middleware via token id

// Portfolio (creatives only)
router.post("/profiles/creative/portfolio", auth(["photographer"]), upload.single("file"), uploadPortfolioItem);
router.delete("/profiles/creative/portfolio/:itemId", auth(["photographer"]), deletePortfolioItem);

// Avatar (both roles)
router.post("/profiles/avatar", auth(), upload.single("file"), uploadAvatar);

export default router;
