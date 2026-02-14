import { Router } from "express";
import auth from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  createPortfolioItemController,
  uploadPortfolioItemController,
  listMyPortfolioController,
  deletePortfolioItemController
} from "../controllers/portfolio.controller.js";

const router = Router();

/**
 * @swagger
 * /api/portfolio/me:
 *   get:
 *     summary: List my portfolio items
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 */
router.get("/me", auth(["photographer"]), listMyPortfolioController);

/**
 * @swagger
 * /api/portfolio/upload:
 *   post:
 *     summary: Upload media file to Backblaze B2 and create portfolio item
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: JSON array string or comma-separated list
 *               durationSeconds:
 *                 type: number
 *                 description: Required for video
 *               isCover:
 *                 type: boolean
 */
router.post("/upload", auth(["photographer"]), upload.single("file"), uploadPortfolioItemController);

/**
 * @swagger
 * /api/portfolio:
 *   post:
 *     summary: Add portfolio item
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mediaType, storageKey, mediaUrl, fileSizeBytes]
 *             properties:
 *               mediaType: { type: string, enum: [image, video] }
 *               storageKey: { type: string, example: photographer/abc123.jpg }
 *               mediaUrl: { type: string, example: https://f005.backblazeb2.com/file/your-bucket/a.jpg }
 *               title: { type: string }
 *               description: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               fileSizeBytes: { type: number, example: 345678 }
 *               durationSeconds: { type: number, example: 45 }
 *               isCover: { type: boolean, example: false }
 */
router.post("/", auth(["photographer"]), createPortfolioItemController);

/**
 * @swagger
 * /api/portfolio/{itemId}:
 *   delete:
 *     summary: Delete portfolio item
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:itemId", auth(["photographer"]), deletePortfolioItemController);

export default router;
