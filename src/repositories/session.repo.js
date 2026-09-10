import { query } from "../config/db.js";

export const listEventTypes = async (creativeTypes) => {
  const params = [];
  let creativeFilter = "";

  if (creativeTypes?.length) {
    creativeFilter = `AND creative_types && $1::text[]`;
    params.push(creativeTypes);
  }

  const { rows } = await query(
    `SELECT id, slug, display_name
     FROM event_types
     WHERE active = TRUE
     ${creativeFilter}
     ORDER BY display_name ASC`,
    params
  );
  return rows;
};

export const createSession = async ({ clientId, payload, agreedAmount, packageType, rateCardItemId, creativeType }) => {
  const locationText = payload.useCreativeStudio ? "Creative's studio" : payload.locationText;

  const { rows } = await query(
    `INSERT INTO sessions (
      client_id, photographer_id, event_type_id, package_type,
      session_date, session_time, session_end_time, location_type, location_text,
      notes, number_of_outfits, number_of_shooting_locations,
      estimated_duration_minutes, deliverable_type, agreed_amount,
      rate_card_item_id, creative_type, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'pending')
    RETURNING *`,
    [
      clientId,
      payload.photographerId,
      payload.eventTypeId,
      packageType,
      payload.sessionDate,
      payload.sessionTime || null,
      payload.sessionEndTime || null,
      payload.locationType,
      locationText,
      payload.notes || null,
      payload.numberOfOutfits ?? null,
      payload.numberOfShootingLocations ?? null,
      payload.estimatedDurationMinutes ?? null,
      payload.deliverableType || null,
      agreedAmount ?? null,
      rateCardItemId ?? null,
      creativeType ?? null
    ]
  );
  return rows[0];
};

export const listMySessions = async ({ userId, role }) => {
  const column = role === "photographer" ? "s.photographer_id" : "s.client_id";
  const { rows } = await query(
    `SELECT
      s.*,
      et.display_name AS event_type_name,
      COALESCE(p.status, 'unpaid') AS payment_status
     FROM sessions s
     INNER JOIN event_types et ON et.id = s.event_type_id
     LEFT JOIN payments p ON p.session_id = s.id
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

export const markSessionComplete = async (sessionId) => {
  const { rows } = await query(
    `UPDATE sessions
     SET completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );
  return rows[0];
};

export const markSessionConfirmed = async (sessionId) => {
  const { rows } = await query(
    `UPDATE sessions
     SET client_confirmed_at = NOW(),
         status = CASE
           WHEN completed_at IS NOT NULL THEN 'completed'
           ELSE status
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );
  return rows[0];
};

export const acceptSession = async (sessionId) => {
  const { rows } = await query(
    `UPDATE sessions
     SET status = 'confirmed',
         accepted_at = NOW(),
         declined_at = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [sessionId]
  );
  return rows[0];
};

export const declineSession = async (sessionId) => {
  const { rows } = await query(
    `UPDATE sessions
     SET status = 'declined',
         declined_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [sessionId]
  );
  return rows[0];
};
