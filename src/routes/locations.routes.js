import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  updateLocationController,
  getMyLocationController,
  getNearbyLocationsController,
  getUserLocationController,
  shareLocationController,
  unshareLocationController,
  listSharesController
} from "../controllers/location.controller.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Location:
 *       type: object
 *       properties:
 *         user_id: { type: string, format: uuid }
 *         latitude: { type: number }
 *         longitude: { type: number }
 *         accuracy: { type: number, nullable: true }
 *         altitude: { type: number, nullable: true }
 *         speed: { type: number, nullable: true }
 *         heading: { type: number, nullable: true }
 *         updated_at: { type: string, format: date-time }
 *     LocationShare:
 *       type: object
 *       properties:
 *         user_id: { type: string, format: uuid }
 *         target_user_id: { type: string, format: uuid }
 *         created_at: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/locations:
 *   put:
 *     summary: Update your current live location
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude: { type: number, example: 6.5244 }
 *               longitude: { type: number, example: 3.3792 }
 *               accuracy: { type: number, example: 12.5 }
 *               altitude: { type: number, example: 40.0 }
 *               speed: { type: number, example: 0.5 }
 *               heading: { type: number, example: 180.0 }
 *     responses:
 *       200:
 *         description: Location updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 location: { $ref: '#/components/schemas/Location' }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put("/", auth(), updateLocationController);

/**
 * @swagger
 * /api/locations/me:
 *   get:
 *     summary: Get your own latest location
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Your location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 location: { $ref: '#/components/schemas/Location' }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No location recorded yet
 */
router.get("/me", auth(), getMyLocationController);

/**
 * @swagger
 * /api/locations/nearby:
 *   get:
 *     summary: Get locations of all users sharing with you
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visible locations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locations:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - { $ref: '#/components/schemas/Location' }
 *                       - type: object
 *                         properties:
 *                           name: { type: string }
 *                           role: { type: string }
 *       401:
 *         description: Unauthorized
 */
router.get("/nearby", auth(), getNearbyLocationsController);

/**
 * @swagger
 * /api/locations/shares:
 *   get:
 *     summary: List who you share with and who shares with you
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Share relationships
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 given:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       target_user_id: { type: string, format: uuid }
 *                       name: { type: string }
 *                       role: { type: string }
 *                       created_at: { type: string }
 *                 received:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id: { type: string, format: uuid }
 *                       name: { type: string }
 *                       role: { type: string }
 *                       created_at: { type: string }
 *                       last_location_at: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 */
router.get("/shares", auth(), listSharesController);

/**
 * @swagger
 * /api/locations/share:
 *   post:
 *     summary: Share your location with another user
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Location shared
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/share", auth(), shareLocationController);

/**
 * @swagger
 * /api/locations/share/{userId}:
 *   delete:
 *     summary: Stop sharing your location with a user
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Location sharing stopped
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share relationship not found
 */
router.delete("/share/:userId", auth(), unshareLocationController);

/**
 * @swagger
 * /api/locations/{userId}:
 *   get:
 *     summary: Get a specific user's location (requires their share permission)
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User location
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user hasn't shared with you)
 *       404:
 *         description: No location recorded yet
 */
router.get("/:userId", auth(), getUserLocationController);

export default router;
