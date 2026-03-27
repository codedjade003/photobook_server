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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     role: { type: string, enum: [client, photographer] }
 *                     profile_photo_url: { type: string, description: Signed avatar URL when available }
 *                     client_profile_photo_url: { type: string }
 *                     photographer_profile_photo_url: { type: string }
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
 *     description: Backward-compatible alias for /api/profiles/photographer.
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
 *               businessName: { type: string }
 *               profilePhotoUrl: { type: string }
 *               displayTitle: { type: string }
 *               about: { type: string }
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
 *     description: Backward-compatible alias for /api/portfolio/upload.
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
 *               isCover:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Portfolio uploaded and saved
 *       400:
 *         description: Invalid upload payload or file constraints
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires photographer role)
 *       500:
 *         description: B2/storage error
 */
router.post("/creative/portfolio", auth(["photographer"]), upload.single("file"), uploadPortfolioItemController);

/**
 * @swagger
 * /api/profiles/creative/portfolio/{itemId}:
 *   delete:
 *     deprecated: true
 *     summary: Legacy alias for portfolio item delete
 *     description: Backward-compatible alias for /api/portfolio/{itemId} delete.
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
 *     responses:
 *       200:
 *         description: Portfolio item deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Portfolio item not found
 */
router.delete("/creative/portfolio/:itemId", auth(["photographer"]), deletePortfolioItemController);

/**
 * @swagger
 * /api/profiles/avatar:
 *   post:
 *     summary: Upload my avatar
 *     description: Uploads an image file to private storage and returns signed URLs for client display.
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
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Avatar uploaded }
 *                 avatarUrl:
 *                   type: string
 *                   description: Signed URL for immediate rendering.
 *                 avatar:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     type: { type: string, example: image }
 *                     url: { type: string }
 *                     signedUrl: { type: string }
 *                     storageKey: { type: string }
 *                 profile:
 *                   type: object
 *                   description: Updated role profile row.
 *       400:
 *         description: Invalid file type, oversized file, or malformed payload
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Storage/signing error
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     role: { type: string, enum: [client, photographer] }
 *                     profile_photo_url: { type: string, description: Signed URL when available }
 *       404:
 *         description: Profile not found
 */
router.get("/:id", getPublicProfileController);

export default router;
