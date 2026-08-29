import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  completeSessionController,
  confirmSessionController,
  createSessionController,
  deleteSessionController,
  listEventTypesController,
  listMySessionsController
} from "../controllers/sessions.controller.js";
import { createReviewController } from "../controllers/review.controller.js";

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       slug: { type: string }
 *                       display_name: { type: string }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       status: { type: string }
 *                       session_date: { type: string }
 *                       session_time: { type: string }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Session created }
 *                 session:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     client_id: { type: string, format: uuid }
 *                     photographer_id: { type: string, format: uuid }
 *                     status: { type: string, example: pending }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Session deleted }
 *                 session:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.delete("/:sessionId", auth([], { optional: true }), deleteSessionController);

/**
 * @swagger
 * /api/sessions/{sessionId}/complete:
 *   patch:
 *     summary: Mark session complete (creative only) — step 1 of payout release
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     description: |
 *       Sets session status to 'completed' and stores completed_at.
 *       Payout is released automatically only when BOTH this step and
 *       the client's confirm step have happened (and payment is confirmed).
 *     responses:
 *       200:
 *         description: Session marked complete (payout included when released)
 *       403:
 *         description: Not the session's creative
 *       404:
 *         description: Session not found
 */
router.patch("/:sessionId/complete", auth(), completeSessionController);

/**
 * @swagger
 * /api/sessions/{sessionId}/confirm:
 *   patch:
 *     summary: Confirm satisfaction (client only) — step 2 of payout release
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     description: |
 *       Stores client_confirmed_at. Payout is released automatically only
 *       when BOTH the creative's complete step and this step have happened.
 *     responses:
 *       200:
 *         description: Session confirmed (payout included when released)
 *       403:
 *         description: Not the session's client
 *       404:
 *         description: Session not found
 */
router.patch("/:sessionId/confirm", auth(), confirmSessionController);

/**
 * @swagger
 * /api/sessions/{sessionId}/review:
 *   post:
 *     summary: Review a completed session's photographer (client only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, example: "Amazing shoot!" }
 *     responses:
 *       201:
 *         description: Review submitted
 *       400:
 *         description: Invalid rating or session not completed
 *       403:
 *         description: Not the session's client
 *       404:
 *         description: Session not found
 *       409:
 *         description: Review already exists for this session
 */
router.post("/:sessionId/review", auth(["client"]), createReviewController);

export default router;
