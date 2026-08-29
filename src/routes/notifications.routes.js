import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  deleteDeviceToken,
  listNotifications,
  markAllRead,
  markRead,
  registerDeviceToken
} from "../controllers/notification.controller.js";

const router = Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: List notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: unread
 *         schema: { type: boolean, default: false }
 *         description: Filter to only unread notifications
 *     responses:
 *       200:
 *         description: Notifications returned
 */
router.get("/", auth(), listNotifications);

/**
 * @swagger
 * /api/notifications/read:
 *   patch:
 *     summary: Mark specific notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notifications marked as read
 */
router.patch("/read", auth(), markRead);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch("/read-all", auth(), markAllRead);

/**
 * @swagger
 * /api/notifications/device-token:
 *   post:
 *     summary: Register an FCM device token for push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     description: Called by the client after login / when the FCM token changes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, example: "fcm-token-from-firebase" }
 *               platform: { type: string, enum: [ios, android, web], example: android }
 *     responses:
 *       201:
 *         description: Device token registered
 *       400:
 *         description: Missing token
 */
router.post("/device-token", auth(), registerDeviceToken);

/**
 * @swagger
 * /api/notifications/device-token:
 *   delete:
 *     summary: Remove a device token (logout)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Device token removed
 */
router.delete("/device-token", auth(), deleteDeviceToken);

export default router;
