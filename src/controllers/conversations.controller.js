import {
  conversationIdParamsSchema,
  createConversationSchema,
  listMessagesSchema,
  sendMessageSchema
} from "../validators/conversations.schema.js";
import {
  createConversation,
  listConversationMessages,
  listConversationsForUser,
  sendTextMessage
} from "../services/messaging.service.js";
import { handleRequest } from "../utils/http.js";
import { isParticipant } from "../repositories/conversation.repo.js";

export const createConversationController = (req, res) => {
  return handleRequest(res, async () => {
    const payload = createConversationSchema.parse(req.body);
    const result = await createConversation({ creatorId: req.user.id, payload });
    res.status(result.created ? 201 : 200).json({
      conversation: result.conversation,
      message: result.message,
      reused: !result.created
    });
  });
};

export const listConversationsController = (req, res) => {
  return handleRequest(res, async () => {
    const conversations = await listConversationsForUser(req.user.id);
    res.json({ conversations });
  });
};

export const listMessagesController = (req, res) => {
  return handleRequest(res, async () => {
    const { id: conversationId } = conversationIdParamsSchema.parse(req.params);
    const payload = listMessagesSchema.parse(req.query);
    const result = await listConversationMessages({
      conversationId,
      userId: req.user.id,
      limit: payload.limit ?? 30,
      cursor: payload.cursor,
      markRead: payload.markRead ?? true
    });

    if (!result) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json({ messages: result.items, nextCursor: result.nextCursor });
  });
};

export const sendMessageController = (req, res) => {
  return handleRequest(res, async () => {
    const { id: conversationId } = conversationIdParamsSchema.parse(req.params);
    const payload = sendMessageSchema.parse(req.body);
    const allowed = await isParticipant({
      conversationId,
      userId: req.user.id
    });

    if (!allowed) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await sendTextMessage({
      conversationId,
      senderId: req.user.id,
      content: payload.content
    });

    res.status(201).json({ message });
  });
};
