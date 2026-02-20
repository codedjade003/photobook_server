import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  getMyProfileController,
  updateClientProfileController,
  updatePhotographerProfileController
} from "../controllers/profiles.controller.js";

const router = Router();

/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     summary: Get my profile (client or photographer)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Unauthorized
 */
router.get("/me", auth(), getMyProfileController);

/**
 * @swagger
 * /api/profiles/photographer:
 *   put:
 *     summary: Update photographer profile
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
 *               businessName: { type: string, example: Timmon Photography }
 *               profilePhotoUrl: { type: string, example: https://cdn.example.com/p.jpg }
 *               displayTitle: { type: string, example: Corporate Photographer }
 *               about: { type: string, example: Passionate photographer... }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Photographer profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 */
router.put("/photographer", auth(["photographer"]), updatePhotographerProfileController);

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
 *               profilePhotoUrl: { type: string, example: https://cdn.example.com/c.jpg }
 *               location: { type: string, example: Lagos, Nigeria }
 *     responses:
 *       200:
 *         description: Client profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires client role)
 */
router.put("/client", auth(["client"]), updateClientProfileController);

export default router;
