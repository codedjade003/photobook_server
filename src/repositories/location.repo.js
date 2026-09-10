import { query } from "../config/db.js";

export const upsertLocation = async ({ userId, latitude, longitude, accuracy, altitude, speed, heading }) => {
  const { rows } = await query(
    `INSERT INTO user_locations (user_id, latitude, longitude, accuracy, altitude, speed, heading, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       accuracy = COALESCE($4, user_locations.accuracy),
       altitude = COALESCE($5, user_locations.altitude),
       speed = COALESCE($6, user_locations.speed),
       heading = COALESCE($7, user_locations.heading),
       updated_at = NOW()
     RETURNING *`,
    [userId, latitude, longitude, accuracy ?? null, altitude ?? null, speed ?? null, heading ?? null]
  );
  return rows[0];
};

export const getLocationByUserId = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM user_locations WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
};

export const getLocationsForUser = async (userId) => {
  const { rows } = await query(
    `SELECT ul.*, u.name, u.role
     FROM location_shares ls
     INNER JOIN user_locations ul ON ul.user_id = ls.user_id
     INNER JOIN users u ON u.id = ls.user_id
     WHERE ls.target_user_id = $1
     ORDER BY ul.updated_at DESC`,
    [userId]
  );
  return rows;
};

// Every creative (non-client) who has shared a location within the last
// 24 hours — regardless of explicit share relationships. Used by the map.
export const getActiveCreativesNearby = async ({ excludeUserId }) => {
  const { rows } = await query(
    `SELECT
       ul.user_id,
       ul.latitude,
       ul.longitude,
       ul.updated_at,
       u.name,
       u.role,
       COALESCE(pp.profile_photo_url, clp.profile_photo_url) AS avatar_url
     FROM user_locations ul
     INNER JOIN users u ON u.id = ul.user_id
     LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
     LEFT JOIN client_profiles clp ON clp.user_id = u.id
     WHERE u.role <> 'client'
       AND ul.updated_at > NOW() - INTERVAL '24 hours'
       AND u.id <> $1
     ORDER BY ul.updated_at DESC`,
    [excludeUserId]
  );
  return rows;
};

export const addShare = async ({ userId, targetUserId }) => {
  const { rows } = await query(
    `INSERT INTO location_shares (user_id, target_user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [userId, targetUserId]
  );
  return rows[0] || null;
};

export const removeShare = async ({ userId, targetUserId }) => {
  const { rows } = await query(
    `DELETE FROM location_shares
     WHERE user_id = $1 AND target_user_id = $2
     RETURNING *`,
    [userId, targetUserId]
  );
  return rows[0] || null;
};

export const canViewLocation = async ({ viewerId, targetUserId }) => {
  const { rows } = await query(
    `SELECT 1 FROM location_shares
     WHERE user_id = $1 AND target_user_id = $2
     LIMIT 1`,
    [targetUserId, viewerId]
  );
  return rows.length > 0;
};

export const listSharesGiven = async (userId) => {
  const { rows } = await query(
    `SELECT ls.target_user_id, u.name, u.role, ls.created_at
     FROM location_shares ls
     INNER JOIN users u ON u.id = ls.target_user_id
     WHERE ls.user_id = $1
     ORDER BY ls.created_at DESC`,
    [userId]
  );
  return rows;
};

export const listSharesReceived = async (userId) => {
  const { rows } = await query(
    `SELECT ls.user_id, u.name, u.role, ls.created_at, ul.updated_at AS last_location_at
     FROM location_shares ls
     INNER JOIN users u ON u.id = ls.user_id
     LEFT JOIN user_locations ul ON ul.user_id = ls.user_id
     WHERE ls.target_user_id = $1
     ORDER BY ls.created_at DESC`,
    [userId]
  );
  return rows;
};
