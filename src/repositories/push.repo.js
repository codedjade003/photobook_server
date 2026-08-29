import { query } from "../config/db.js";

// ─────────────────────────────────────────────────────────────
// Device tokens (FCM) — one row per device, token globally unique.
// ─────────────────────────────────────────────────────────────

export const registerDeviceToken = async ({ userId, token, platform }) => {
  const { rows } = await query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       updated_at = NOW()
     RETURNING *`,
    [userId, token, platform ?? null]
  );
  return rows[0];
};

export const findTokensForUser = async (userId) => {
  const { rows } = await query(
    `SELECT token FROM device_tokens WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.token);
};

export const removeDeviceToken = async ({ token, userId }) => {
  const { rows } = await query(
    `DELETE FROM device_tokens
     WHERE token = $1
       AND ($2::uuid IS NULL OR user_id = $2::uuid)
     RETURNING token`,
    [token, userId ?? null]
  );
  return rows[0];
};
