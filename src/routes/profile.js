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

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 */
router.get("/profiles/:id", getProfile);

/**
 * @swagger
 * /api/profiles/creative:
 *   put:
 *     summary: Update photographer/creative profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *               hourlyRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - photographer role required
 */
router.put("/profiles/creative", auth(["photographer"]), updateCreativeProfile);

/**
 * @swagger
 * /api/profiles/client:
 *   put:
 *     summary: Update client profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put("/profiles/client", auth(), updateClientProfile);

/**
 * @swagger
 * /api/profiles/creative/portfolio:
 *   post:
 *     summary: Upload portfolio item
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 *     responses:
 *       200:
 *         description: Portfolio item uploaded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - photographer role required
 */
router.post("/profiles/creative/portfolio", auth(["photographer"]), upload.single("file"), uploadPortfolioItem);

/**
 * @swagger
 * /api/profiles/creative/portfolio/{itemId}:
 *   delete:
 *     summary: Delete portfolio item
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Portfolio item deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - photographer role required
 *       404:
 *         description: Portfolio item not found
 */
router.delete("/profiles/creative/portfolio/:itemId", auth(["photographer"]), deletePortfolioItem);

/**
 * @swagger
 * /api/profiles/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/profiles/avatar", auth(), upload.single("file"), uploadAvatar);

export default router;
