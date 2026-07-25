import { query } from "../config/db.js";
import { sendEmail } from "../config/mail.js";
import { isTruthyEnv } from "../utils/env.js";

// Will be set by initNotificationService(io) from index.js
let io = null;
let onlineUsers = null;

export const initNotificationService = (socketIo, onlineUsersMap) => {
  io = socketIo;
  onlineUsers = onlineUsersMap;
};

const EMAIL_TYPES = new Set([
  "booking_confirmed",
  "booking_canceled",
  "offer_received",
  "payment_processed",
  "session_reminder"
]);

const isUserOnline = (userId) => {
  return onlineUsers && onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
};

export const createNotification = async ({ userId, type, title, body, data }) => {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body || null, data ? JSON.stringify(data) : null]
  );

  const notification = rows[0];

  // Real-time delivery if user is online
  if (io && isUserOnline(userId)) {
    io.to(userId).emit("notification", notification);
  }

  // Email fallback for important notifications if user is offline
  if (EMAIL_TYPES.has(type) && !isUserOnline(userId) && isTruthyEnv(process.env.EMAIL_FEATURE_ENABLED)) {
    try {
      const { rows: userRows } = await query(
        "SELECT email, name FROM users WHERE id = $1",
        [userId]
      );
      if (userRows[0]) {
        const user = userRows[0];
        await sendEmail({
          to: user.email,
          subject: title,
          text: body || title,
          html: `<p>${(body || title).replace(/\n/g, "<br>")}</p>`
        }).catch((err) => console.error("Notification email failed:", err.message));
      }
    } catch (err) {
      console.error("Failed to send notification email:", err.message);
    }
  }

  return notification;
};

export const getNotifications = async ({ userId, limit = 50, offset = 0, unreadOnly = false }) => {
  let whereClause = "WHERE user_id = $1";
  const params = [userId];

  if (unreadOnly) {
    whereClause += " AND read_at IS NULL";
  }

  const countResult = await query(
    `SELECT COUNT(*) FROM notifications ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT * FROM notifications ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { notifications: rows, total };
};

export const markNotificationsRead = async ({ userId, ids }) => {
  if (!ids?.length) return [];

  const { rows } = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL
     RETURNING id`,
    [userId, ids]
  );

  return rows.map((r) => r.id);
};

export const markAllNotificationsRead = async (userId) => {
  const { rows } = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL
     RETURNING id`,
    [userId]
  );

  return { count: rows.length };
};
