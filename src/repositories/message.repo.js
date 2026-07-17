import { query, getClient } from "../config/db.js";

export const createMessage = async ({
  conversationId,
  senderId,
  messageType,
  contentEncrypted
}) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, content_encrypted)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversationId, senderId, messageType, contentEncrypted]
    );

    const message = rows[0];

    await client.query(
      `UPDATE conversations
       SET last_message_id = $1,
           last_message_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [message.id, message.created_at, conversationId]
    );

    await client.query("COMMIT");
    return message;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const listMessages = async ({ conversationId, limit, cursor }) => {
  const params = [conversationId, limit];
  let cursorClause = "";

  if (cursor?.createdAt && cursor?.id) {
    params.push(cursor.createdAt, cursor.id);
    cursorClause = "AND (created_at, id) < ($3::timestamptz, $4::uuid)";
  }

  const { rows } = await query(
    `SELECT id, conversation_id, sender_id, message_type, content_encrypted, created_at
     FROM messages
     WHERE conversation_id = $1
     ${cursorClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    params
  );

  return rows;
};
