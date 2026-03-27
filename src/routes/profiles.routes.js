import { Router } from "express";
import auth from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  getMyProfileController,
  getPublicProfileController,
  uploadAvatarController,
  updateClientProfileController,
  updatePhotographerProfileController,
  updateMyProfileByRoleController
} from "../controllers/profiles.controller.js";
import {
  deletePortfolioItemController,
  uploadPortfolioItemController
} from "../controllers/portfolio.controller.js";

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
 *   patch:
 *     summary: Partially update photographer profile
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
router.patch("/photographer", auth(["photographer"]), updatePhotographerProfileController);

/**
 * @swagger
 * /api/profiles/creative:
 *   put:
 *     deprecated: true
 *     summary: Legacy alias for photographer profile update
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Photographer profile updated
 */
router.put("/creative", auth(["photographer"]), updatePhotographerProfileController);

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
 *   patch:
 *     summary: Partially update client profile
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
router.patch("/client", auth(["client"]), updateClientProfileController);

/**
 * @swagger
 * /api/profiles/{role}:
 *   put:
 *     summary: Update my profile by role (dynamic route)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [client, photographer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   profilePhotoUrl: { type: string, example: https://cdn.example.com/c.jpg }
 *                   location: { type: string, example: Lagos, Nigeria }
 *               - type: object
 *                 properties:
 *                   businessName: { type: string, example: Timmon Photography }
 *                   profilePhotoUrl: { type: string, example: https://cdn.example.com/p.jpg }
 *                   displayTitle: { type: string, example: Corporate Photographer }
 *                   about: { type: string, example: Passionate photographer... }
 *                   tags:
 *                     type: array
 *                     items: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (role mismatch)
 *   patch:
 *     summary: Partially update my profile by role (dynamic route)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [client, photographer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   profilePhotoUrl: { type: string, example: https://cdn.example.com/c.jpg }
 *                   location: { type: string, example: Lagos, Nigeria }
 *               - type: object
 *                 properties:
 *                   businessName: { type: string, example: Timmon Photography }
 *                   profilePhotoUrl: { type: string, example: https://cdn.example.com/p.jpg }
 *                   displayTitle: { type: string, example: Corporate Photographer }
 *                   about: { type: string, example: Passionate photographer... }
 *                   tags:
 *                     type: array
 *                     items: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (role mismatch)
 */
router.put("/:role(client|photographer)", auth(), updateMyProfileByRoleController);
router.patch("/:role(client|photographer)", auth(), updateMyProfileByRoleController);

/**
 * @swagger
 * /api/profiles/creative/portfolio:
 *   post:
 *     deprecated: true
 *     summary: Legacy alias for portfolio upload
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
 */
router.post("/creative/portfolio", auth(["photographer"]), upload.single("file"), uploadPortfolioItemController);

/**
 * @swagger
 * /api/profiles/creative/portfolio/{itemId}:
 *   delete:
 *     deprecated: true
 *     summary: Legacy alias for portfolio item delete
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.delete("/creative/portfolio/:itemId", auth(["photographer"]), deletePortfolioItemController);

/**
 * @swagger
 * /api/profiles/avatar:
 *   post:
 *     summary: Upload my avatar
 *     tags: [Profiles]
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
 */
router.post("/avatar", auth(), upload.single("file"), uploadAvatarController);

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Get public profile by user ID
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Public profile returned
 *       404:
 *         description: Profile not found
 */
router.get("/:id", getPublicProfileController);

export default router;
