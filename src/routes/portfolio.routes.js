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
 *     responses:
 *       200:
 *         description: Portfolio items returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
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
 *     responses:
 *       201:
 *         description: Portfolio uploaded to B2 and metadata saved
 *       400:
 *         description: Invalid file, validation error, or media limit exceeded
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 *       500:
 *         description: B2 configuration or storage error
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
 *     responses:
 *       201:
 *         description: Portfolio metadata saved
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 */
router.post("/", auth(["photographer"]), createPortfolioItemController);

/**
 * @swagger
 * /api/portfolio/{itemId}:
 *   delete:
 *     summary: Delete portfolio item (owner token or dev override password)
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio item deleted from B2 and DB
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 *       404:
 *         description: Portfolio item not found
 *       500:
 *         description: Storage delete failure
 */
router.delete("/:itemId", auth([], { optional: true }), deletePortfolioItemController);

export default router;
