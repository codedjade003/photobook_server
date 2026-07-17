import { Router } from "express";
import auth from "../middleware/auth.js";
import { messageSendRateLimiter } from "../middleware/rateLimit.js";
import {
  createConversationController,
  listConversationsController,
  listMessagesController,
  sendMessageController
} from "../controllers/conversations.controller.js";

const router = Router();

/**
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: Create a conversation (direct or group)
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantIds]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [direct, group]
 *                 example: direct
 *               title:
 *                 type: string
 *                 example: "Project Chat"
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               initialMessage:
 *                 type: string
 *                 example: "Hey, let's get started."
 *     responses:
 *       201:
 *         description: Conversation created
 *       200:
 *         description: Existing conversation reused
 *       401:
 *         description: Unauthorized
 */
router.post("/", auth(), createConversationController);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: List conversations for the current user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       type: { type: string, enum: [direct, group] }
 *                       title: { type: string, nullable: true }
 *                       lastMessageAt: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth(), listConversationsController);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: Fetch messages for a conversation (cursor pagination)
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 30
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           description: Base64 cursor from previous response
 *       - in: query
 *         name: markRead
 *         schema:
 *           type: boolean
 *           example: true
 *     responses:
 *       200:
 *         description: Messages returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       senderId: { type: string, format: uuid }
 *                       type: { type: string, enum: [TEXT] }
 *                       content: { type: string, nullable: true }
 *                       createdAt: { type: string }
 *                       isRead: { type: boolean }
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get("/:id/messages", auth(), listMessagesController);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   post:
 *     summary: Send a text message to a conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Hello!"
 *     responses:
 *       201:
 *         description: Message created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     conversationId: { type: string, format: uuid }
 *                     senderId: { type: string, format: uuid }
 *                     type: { type: string, enum: [TEXT] }
 *                     content: { type: string }
 *                     createdAt: { type: string }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/:id/messages", auth(), messageSendRateLimiter, sendMessageController);

export default router;
