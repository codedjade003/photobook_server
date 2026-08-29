import { query } from "../config/db.js";

export const createReview = async ({ photographerId, clientId, sessionId, rating, comment }) => {
  const { rows } = await query(
    `INSERT INTO reviews (photographer_id, client_id, session_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [photographerId, clientId, sessionId ?? null, rating, comment ?? null]
  );
  return rows[0];
};

export const findReviewBySessionId = async (sessionId) => {
  const { rows } = await query(
    `SELECT * FROM reviews WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );
  return rows[0];
};

export const listReviewsByPhotographer = async ({ photographerId, limit = 50 }) => {
  const { rows } = await query(
    `SELECT
       r.id,
       r.photographer_id,
       r.client_id,
       r.session_id,
       r.rating,
       r.comment,
       r.created_at,
       u.name AS client_name
     FROM reviews r
     INNER JOIN users u ON u.id = r.client_id
     WHERE r.photographer_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [photographerId, limit]
  );
  return rows;
};
