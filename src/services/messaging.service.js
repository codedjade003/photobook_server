import { getClient } from "../config/db.js";
import {
  createConversation as createConversationRepo,
  createConversationWithClient,
  findDirectConversation,
  getConversationSummary,
  getParticipant,
  isParticipant,
  listConversationParticipants,
  listUserConversations,
  markConversationRead
} from "../repositories/conversation.repo.js";
import { createMessage as createMessageRepo, listMessages } from "../repositories/message.repo.js";
import { decryptMessage, encryptMessage } from "../utils/messageCrypto.js";

const encodeCursor = (message) => {
  const createdAt = new Date(message.created_at).toISOString();
  return Buffer.from(`${createdAt}|${message.id}`).toString("base64");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  let decoded;
  try {
    decoded = Buffer.from(cursor, "base64").toString("utf8");
  } catch (err) {
    throw new Error("Invalid cursor");
  }

  const [createdAt, id] = decoded.split("|");
  if (!createdAt || !id) {
    throw new Error("Invalid cursor");
  }

  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.valueOf())) {
    throw new Error("Invalid cursor");
  }

  return { createdAt: parsedDate.toISOString(), id };
};

const decryptSafe = (payload) => {
  if (!payload) return null;
  try {
    return decryptMessage(payload);
  } catch (err) {
    console.error("Message decrypt failed:", err.message);
    return null;
  }
};

const buildParticipantMap = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.conversation_id)) {
      map.set(row.conversation_id, []);
    }
    map.get(row.conversation_id).push({
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.user_role,
      participantRole: row.role,
      joinedAt: row.joined_at,
      lastReadAt: row.last_read_at,
      businessName: row.business_name || null,
      profilePhotoUrl: row.photographer_photo_url || row.client_photo_url || null,
      displayName: row.business_name || row.name
    });
  });
  return map;
};

const buildConversationResponse = (row, participants) => {
  const lastMessage = row.last_message_id
    ? {
        id: row.last_message_id,
        senderId: row.last_message_sender_id,
        type: row.last_message_type,
        content: row.last_message_type === "TEXT"
          ? decryptSafe(row.last_message_content)
          : null,
        createdAt: row.last_message_created_at
      }
    : null;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    lastReadAt: row.last_read_at,
    participants,
    lastMessage
  };
};

const buildDirectLockKey = (userId, otherUserId) => {
  const [first, second] = [userId, otherUserId].sort();
  return `direct:${first}:${second}`;
};

export const createConversation = async ({ creatorId, payload }) => {
  const inputIds = Array.isArray(payload.participantIds) ? payload.participantIds : [];
  const uniqueIds = Array.from(new Set(inputIds.filter(Boolean)));
  const participantIds = Array.from(new Set([...uniqueIds, creatorId]));

  if (payload.type === "direct" && participantIds.length !== 2) {
    throw new Error("Direct conversations require exactly one other participant");
  }

  if (payload.type === "group" && participantIds.length < 3) {
    throw new Error("Group conversations require at least two other participants");
  }

  if (payload.type === "direct") {
    const otherUserId = participantIds.find((id) => id !== creatorId);
    if (!otherUserId) {
      throw new Error("Direct conversations require exactly one other participant");
    }

    let conversationId = null;
    let created = false;

    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [buildDirectLockKey(creatorId, otherUserId)]
      );

      const existing = await findDirectConversation({ userId: creatorId, otherUserId, client });
      if (existing) {
        conversationId = existing.id;
      } else {
        const participants = participantIds.map((id) => ({
          userId: id,
          role: id === creatorId ? "admin" : "member"
        }));

        const conversation = await createConversationWithClient(client, {
          type: payload.type,
          title: payload.title ?? null,
          createdBy: creatorId,
          participants
        });

        conversationId = conversation.id;
        created = true;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const message = payload.initialMessage
      ? await sendTextMessage({
          conversationId,
          senderId: creatorId,
          content: payload.initialMessage
        })
      : null;

    const summary = await getConversationSummary({ conversationId, userId: creatorId });
    if (!summary) {
      throw new Error("Conversation not found");
    }
    const participants = await listConversationParticipants([conversationId]);
    const map = buildParticipantMap(participants);

    return {
      conversation: buildConversationResponse(summary, map.get(conversationId) || []),
      message,
      created
    };
  }

  const participants = participantIds.map((id) => ({
    userId: id,
    role: id === creatorId ? "admin" : "member"
  }));

  const conversation = await createConversationRepo({
    type: payload.type,
    title: payload.title ?? null,
    createdBy: creatorId,
    participants
  });

  let message = null;
  if (payload.initialMessage) {
    message = await sendTextMessage({
      conversationId: conversation.id,
      senderId: creatorId,
      content: payload.initialMessage
    });
  }

  const summary = await getConversationSummary({ conversationId: conversation.id, userId: creatorId });
  if (!summary) {
    throw new Error("Conversation not found");
  }
  const participantRows = await listConversationParticipants([conversation.id]);
  const participantMap = buildParticipantMap(participantRows);

  return {
    conversation: buildConversationResponse(summary, participantMap.get(conversation.id) || []),
    message,
    created: true
  };
};

export const listConversationsForUser = async (userId) => {
  const conversationRows = await listUserConversations(userId);
  if (!conversationRows.length) return [];

  const conversationIds = conversationRows.map((row) => row.id);
  const participantRows = await listConversationParticipants(conversationIds);
  const participantMap = buildParticipantMap(participantRows);

  return conversationRows.map((row) => (
    buildConversationResponse(row, participantMap.get(row.id) || [])
  ));
};

export const listConversationMessages = async ({
  conversationId,
  userId,
  limit = 30,
  cursor,
  markRead = true
}) => {
  const allowed = await isParticipant({ conversationId, userId });
  if (!allowed) {
    return null;
  }

  const parsedCursor = decodeCursor(cursor);
  const fetchLimit = Math.min(Math.max(limit, 1), 50) + 1;
  const rows = await listMessages({
    conversationId,
    limit: fetchLimit,
    cursor: parsedCursor
  });

  const hasMore = rows.length > fetchLimit - 1;
  const slice = hasMore ? rows.slice(0, fetchLimit - 1) : rows;
  const participant = await getParticipant({ conversationId, userId });
  const lastReadAt = participant?.last_read_at ? new Date(participant.last_read_at) : null;

  const items = slice.map((row) => {
    const createdAt = row.created_at;
    const isRead = row.sender_id === userId
      || (lastReadAt && new Date(createdAt) <= lastReadAt);

    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      type: row.message_type,
      content: row.message_type === "TEXT" ? decryptSafe(row.content_encrypted) : null,
      createdAt,
      isRead
    };
  });

  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1]) : null;

  if (markRead && slice.length) {
    await markConversationRead({
      conversationId,
      userId,
      lastReadAt: slice[0].created_at,
      lastReadMessageId: slice[0].id
    });
  }

  return { items, nextCursor };
};

export const sendTextMessage = async ({ conversationId, senderId, content }) => {
  const allowed = await isParticipant({ conversationId, userId: senderId });
  if (!allowed) {
    throw new Error("forbidden");
  }

  const encrypted = encryptMessage(content);
  const message = await createMessageRepo({
    conversationId,
    senderId,
    messageType: "TEXT",
    contentEncrypted: encrypted
  });

  await markConversationRead({
    conversationId,
    userId: senderId,
    lastReadAt: message.created_at,
    lastReadMessageId: message.id
  });

  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    type: message.message_type,
    content,
    createdAt: message.created_at,
    isRead: true
  };
};
