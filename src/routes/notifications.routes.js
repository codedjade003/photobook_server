import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  listNotifications,
  markRead,
  markAllRead
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

export default router;
