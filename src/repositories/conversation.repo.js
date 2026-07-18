import { query, getClient } from "../config/db.js";

const getExecutor = (client) => (client ? client.query.bind(client) : query);

export const findDirectConversation = async ({ userId, otherUserId, client }) => {
  const executor = getExecutor(client);
  const { rows } = await executor(
    `SELECT c.*
     FROM conversations c
     INNER JOIN conversation_participants cp1
       ON cp1.conversation_id = c.id AND cp1.user_id = $1
     INNER JOIN conversation_participants cp2
       ON cp2.conversation_id = c.id AND cp2.user_id = $2
     WHERE c.type = 'direct'
     LIMIT 1`,
    [userId, otherUserId]
  );
  return rows[0];
};

const insertConversation = async (client, { type, title, createdBy, participants }) => {
  if (!participants?.length) {
    throw new Error("No participants provided");
  }

  const { rows: conversationRows } = await client.query(
    `INSERT INTO conversations (type, title, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [type, title ?? null, createdBy ?? null]
  );

  const conversation = conversationRows[0];
  const userIds = participants.map((participant) => participant.userId);
  const roles = participants.map((participant) => participant.role || "member");

  await client.query(
    `INSERT INTO conversation_participants (conversation_id, user_id, role)
     SELECT $1, data.user_id, data.role
     FROM UNNEST($2::uuid[], $3::text[]) AS data(user_id, role)`,
    [conversation.id, userIds, roles]
  );

  return conversation;
};

export const createConversation = async ({ type, title, createdBy, participants }) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const conversation = await insertConversation(client, {
      type,
      title,
      createdBy,
      participants
    });
    await client.query("COMMIT");
    return conversation;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const createConversationWithClient = async (client, payload) => {
  return insertConversation(client, payload);
};

export const listUserConversations = async (userId) => {
  const { rows } = await query(
    `SELECT
      c.id,
      c.type,
      c.title,
      c.created_by,
      c.created_at,
      c.updated_at,
      c.last_message_at,
      c.last_message_id,
      cp.last_read_at,
      m.sender_id AS last_message_sender_id,
      m.message_type AS last_message_type,
      m.content_encrypted AS last_message_content,
      m.created_at AS last_message_created_at
     FROM conversations c
     INNER JOIN conversation_participants cp
       ON cp.conversation_id = c.id
     LEFT JOIN messages m
       ON m.id = c.last_message_id
     WHERE cp.user_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );

  return rows;
};

export const getConversationSummary = async ({ conversationId, userId }) => {
  const { rows } = await query(
    `SELECT
      c.id,
      c.type,
      c.title,
      c.created_by,
      c.created_at,
      c.updated_at,
      c.last_message_at,
      c.last_message_id,
      cp.last_read_at,
      m.sender_id AS last_message_sender_id,
      m.message_type AS last_message_type,
      m.content_encrypted AS last_message_content,
      m.created_at AS last_message_created_at
     FROM conversations c
     INNER JOIN conversation_participants cp
       ON cp.conversation_id = c.id
     LEFT JOIN messages m
       ON m.id = c.last_message_id
     WHERE cp.user_id = $1 AND c.id = $2
     LIMIT 1`,
    [userId, conversationId]
  );

  return rows[0];
};

export const listConversationParticipants = async (conversationIds) => {
  if (!conversationIds?.length) return [];

  const { rows } = await query(
    `SELECT
      cp.conversation_id,
      cp.user_id,
      cp.role,
      cp.joined_at,
      cp.last_read_at,
      u.name,
      u.email,
      u.role AS user_role,
      pp.business_name,
      pp.profile_photo_url AS photographer_photo_url,
      clp.profile_photo_url AS client_photo_url
     FROM conversation_participants cp
     INNER JOIN users u ON u.id = cp.user_id
     LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
     LEFT JOIN client_profiles clp ON clp.user_id = u.id
     WHERE cp.conversation_id = ANY($1::uuid[])
     ORDER BY u.name ASC`,
    [conversationIds]
  );

  return rows;
};

export const isParticipant = async ({ conversationId, userId }) => {
  const { rows } = await query(
    `SELECT 1
     FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId]
  );
  return Boolean(rows[0]);
};

export const getParticipant = async ({ conversationId, userId }) => {
  const { rows } = await query(
    `SELECT *
     FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId]
  );
  return rows[0];
};

export const markConversationRead = async ({
  conversationId,
  userId,
  lastReadAt,
  lastReadMessageId
}) => {
  const { rows } = await query(
    `UPDATE conversation_participants
     SET last_read_at = CASE
           WHEN last_read_at IS NULL OR last_read_at < $3 THEN $3
           ELSE last_read_at
         END,
         last_read_message_id = CASE
           WHEN last_read_at IS NULL OR last_read_at < $3 THEN $4
           ELSE last_read_message_id
         END
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING *`,
    [conversationId, userId, lastReadAt, lastReadMessageId]
  );

  return rows[0];
};
