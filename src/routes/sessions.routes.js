import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  createSessionController,
  deleteSessionController,
  listEventTypesController,
  listMySessionsController
} from "../controllers/sessions.controller.js";

const router = Router();

/**
 * @swagger
 * /api/sessions/event-types:
 *   get:
 *     summary: List available event types for booking form dropdown
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: Event types returned
 */
router.get("/event-types", listEventTypesController);

/**
 * @swagger
 * /api/sessions/me:
 *   get:
 *     summary: List my sessions (client or photographer view)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions returned
 *       401:
 *         description: Unauthorized
 */
router.get("/me", auth(), listMySessionsController);

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a session booking request (client)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [photographerId, eventTypeId, packageType, sessionDate, sessionTime, locationType, locationText]
 *             properties:
 *               photographerId: { type: string, example: 00000000-0000-0000-0000-000000000000 }
 *               eventTypeId: { type: number, example: 1 }
 *               packageType: { type: string, enum: [regular, premium], example: regular }
 *               sessionDate: { type: string, example: 2026-03-21 }
 *               sessionTime: { type: string, example: "15:30" }
 *               locationType: { type: string, enum: [indoor, outdoor], example: indoor }
 *               locationText: { type: string, example: Victoria Island, Lagos }
 *     responses:
 *       201:
 *         description: Session booking created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires client role)
 */
router.post("/", auth(["client"]), createSessionController);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete session (owner token or dev override password)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.delete("/:sessionId", auth([], { optional: true }), deleteSessionController);

export default router;
