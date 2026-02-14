import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  createSessionController,
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
 */
router.post("/", auth(["client"]), createSessionController);

export default router;
