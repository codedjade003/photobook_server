import { query } from "../config/db.js";

export const listEventTypes = async () => {
  const { rows } = await query(
    `SELECT id, slug, display_name
     FROM event_types
     WHERE active = TRUE
     ORDER BY display_name ASC`
  );
  return rows;
};

export const createSession = async ({ clientId, payload }) => {
  const { rows } = await query(
    `INSERT INTO sessions (
      client_id, photographer_id, event_type_id, package_type, session_date, session_time, location_type, location_text
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [
      clientId,
      payload.photographerId,
      payload.eventTypeId,
      payload.packageType,
      payload.sessionDate,
      payload.sessionTime,
      payload.locationType,
      payload.locationText
    ]
  );
  return rows[0];
};

export const listMySessions = async ({ userId, role }) => {
  const column = role === "photographer" ? "s.photographer_id" : "s.client_id";
  const { rows } = await query(
    `SELECT
      s.*,
      et.display_name AS event_type_name
     FROM sessions s
     INNER JOIN event_types et ON et.id = s.event_type_id
     WHERE ${column} = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows;
};

export const findSessionById = async (sessionId) => {
  const { rows } = await query(
    `SELECT *
     FROM sessions
     WHERE id = $1
     LIMIT 1`,
    [sessionId]
  );
  return rows[0];
};

export const deleteSessionById = async (sessionId) => {
  const { rows } = await query(
    `DELETE FROM sessions
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );
  return rows[0];
};
