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
 * components:
 *   schemas:
 *     ConversationParticipant:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Jade }
 *         email: { type: string, format: email }
 *         role: { type: string, enum: [client, photographer], description: User's current role }
 *         participantRole: { type: string, enum: [member, admin], description: Role within this conversation }
 *         joinedAt: { type: string, format: date-time }
 *         lastReadAt: { type: string, format: date-time, nullable: true }
 *         businessName: { type: string, nullable: true, example: Timmon Photography, description: Photographer's business name, null for clients }
 *         profilePhotoUrl: { type: string, nullable: true, description: Signed B2 URL, valid for 1 hour }
 *         displayName: { type: string, example: Timmon Photography, description: businessName for photographers, name for clients }
 *     Message:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         conversationId: { type: string, format: uuid }
 *         senderId: { type: string, format: uuid }
 *         type: { type: string, enum: [TEXT, WEBRTC_SIGNAL, VOICE_NOTE], description: TEXT = chat message, WEBRTC_SIGNAL = call signaling, VOICE_NOTE = audio clip }
 *         content: { type: string, nullable: true, description: Message text, encrypted in DB but decrypted in response }
 *         createdAt: { type: string, format: date-time }
 *         isRead: { type: boolean }
 *     Conversation:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         type: { type: string, enum: [direct, group] }
 *         title: { type: string, nullable: true }
 *         createdBy: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         lastMessageAt: { type: string, format: date-time, nullable: true }
 *         lastReadAt: { type: string, format: date-time, nullable: true }
 *         participants:
 *           type: array
 *           items: { $ref: '#/components/schemas/ConversationParticipant' }
 *         lastMessage:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             senderId: { type: string, format: uuid }
 *             type: { type: string, enum: [TEXT, WEBRTC_SIGNAL, VOICE_NOTE] }
 *             content: { type: string, nullable: true }
 *             createdAt: { type: string, format: date-time }
 */

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
 *                 default: direct
 *               title:
 *                 type: string
 *                 example: Project Chat
 *               participantIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               initialMessage:
 *                 type: string
 *                 maxLength: 2000
 *                 example: "Hey, let's get started."
 *     responses:
 *       201:
 *         description: Conversation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation: { $ref: '#/components/schemas/Conversation' }
 *                 message: { $ref: '#/components/schemas/Message' }
 *                 reused: { type: boolean, description: false means new, true means existing conversation was reused }
 *       200:
 *         description: Existing conversation reused (when type=direct and one already exists)
 *       401:
 *         description: Unauthorized
 */
router.post("/", auth(), createConversationController);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: List conversations for the current user
 *     description: |
 *       Returns all conversations with full participant details including:
 *       - **displayName**: business name for photographers, real name for clients
 *       - **profilePhotoUrl**: signed B2 URL for the avatar
 *       - **lastMessage**: decrypted last message with type (TEXT / WEBRTC_SIGNAL / VOICE_NOTE)
 *
 *       Real-time updates are delivered via Socket.io — see WebSocket Events section.
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
 *                   items: { $ref: '#/components/schemas/Conversation' }
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth(), listConversationsController);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: Fetch messages for a conversation (cursor pagination)
 *     description: |
 *       Returns messages newest-first with cursor-based pagination.
 *       Set markRead=true to update your read position.
 *       Supported message types: TEXT, WEBRTC_SIGNAL, VOICE_NOTE.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 30 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string, description: Base64 cursor from previous response's nextCursor }
 *       - in: query
 *         name: markRead
 *         schema: { type: boolean, default: true }
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
 *                   items: { $ref: '#/components/schemas/Message' }
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   description: Pass this as the cursor parameter to get the next page. null means no more messages.
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
 *     summary: Send a message to a conversation
 *     description: |
 *       Sends a text message to the specified conversation.
 *       The message is encrypted before storage and broadcast via Socket.io to all participants.
 *       For voice notes, upload the audio to B2 first then send the URL as the message content.
 *       For WebRTC signaling, use Socket.io events (see WebSocket Events section below).
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *                 maxLength: 2000
 *                 example: "Hello! Are you available next Tuesday?"
 *     responses:
 *       201:
 *         description: Message created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { $ref: '#/components/schemas/Message' }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 *       429:
 *         description: Rate limit exceeded (10 messages per 10 seconds)
 *
 * @swagger
 * /websocket-events:
 *   get:
 *     summary: WebSocket Events (Socket.io)
 *     description: |
 *       ## Real-time Messaging & Calls
 *
 *       Connect to the same server URL with your JWT token:
 *       ```js
 *       const socket = io("https://your-server.com", { auth: { token: "Bearer <jwt>" } });
 *       ```
 *
 *       ### Room Management
 *       | Client → Server | Payload |
 *       |---|---|
 *       | `join_room` | `{ conversationId }` |
 *
 *       ### Messaging
 *       | Client → Server | Payload | Server → Room |
 *       |---|---|---|
 *       | `send_message` | `{ conversationId, content }` | `message { id, senderId, type, content, createdAt, isRead }` |
 *
 *       ### Typing Indicators
 *       | Client → Server | Payload | Server → Room |
 *       |---|---|---|
 *       | `typing:start` | `{ conversationId }` | `user:typing { userId, conversationId }` |
 *       | `typing:stop` | `{ conversationId }` | `user:stop_typing { userId, conversationId }` |
 *
 *       ### Online Presence
 *       | Server → Room | When |
 *       |---|---|
 *       | `user:online { userId }` | User joins Socket.io |
 *       | `user:offline { userId, lastSeenAt }` | User disconnects (last_seen_at also updated in DB) |
 *
 *       ### WebRTC Calls (Video/Voice)
 *       | Client → Server | Payload | Server → Room |
 *       |---|---|---|
 *       | `webrtc_offer` | `{ conversationId, offer }` | `webrtc_offer { conversationId, fromUserId, offer }` |
 *       | `webrtc_answer` | `{ conversationId, answer }` | `webrtc_answer { conversationId, fromUserId, answer }` |
 *       | `ice_candidate` | `{ conversationId, candidate }` | `ice_candidate { conversationId, fromUserId, candidate }` |
 *
 *       ### Rate Limits
 *       | Event | Limit |
 *       |---|---|
 *       | `send_message` | 10 per 10 seconds |
 *       | WebRTC signals | 30 per 10 seconds |
 *     tags: [Messaging]
 */
router.post("/:id/messages", auth(), messageSendRateLimiter, sendMessageController);

export default router;
