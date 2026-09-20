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

export const markSessionComplete = async (sessionId, { autoReleaseDays = 7 } = {}) => {
  // Mirrors markSessionConfirmed: whichever side acts last flips the status to
  // 'completed'. auto_release_at starts the escrow clock so funds can't be
  // stranded by a client who simply never confirms.
  const { rows } = await query(
    `UPDATE sessions
     SET completed_at = NOW(),
         auto_release_at = NOW() + ($2 || ' days')::interval,
         status = CASE
           WHEN client_confirmed_at IS NOT NULL THEN 'completed'
           ELSE status
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId, String(autoReleaseDays)]
  );
  return rows[0];
};

// Sessions whose deliverables were sent, never confirmed or disputed, and
// whose auto-release deadline has passed. Drives the escrow sweep job.
export const findSessionsDueForAutoRelease = async (limit = 50) => {
  const { rows } = await query(
    `SELECT s.id
     FROM sessions s
     INNER JOIN payments pay ON pay.session_id = s.id AND pay.status = 'confirmed'
     LEFT JOIN payouts po ON po.session_id = s.id
     LEFT JOIN refunds r ON r.session_id = s.id
     WHERE s.completed_at IS NOT NULL
       AND s.client_confirmed_at IS NULL
       AND s.auto_release_at IS NOT NULL
       AND s.auto_release_at <= NOW()
       AND s.refunded_at IS NULL
       AND r.id IS NULL
       AND (po.id IS NULL OR po.status = 'failed')
     ORDER BY s.auto_release_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

export const markSessionRefunded = async (sessionId, { client } = {}) => {
  const executor = client ? client.query.bind(client) : query;
  const { rows } = await executor(
    `UPDATE sessions
     SET refunded_at = NOW(),
         -- Keep 'declined' so we don't lose why the booking ended.
         status = CASE WHEN status = 'declined' THEN 'declined' ELSE 'canceled' END,
         auto_release_at = NULL,
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
         auto_release_at = NULL,
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
