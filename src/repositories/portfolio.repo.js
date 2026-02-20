import { query } from "../config/db.js";

export const addPortfolioItem = async ({ photographerId, payload }) => {
  const { rows } = await query(
    `INSERT INTO portfolio_media (
      photographer_id, media_type, storage_key, media_url, title, description, tags, file_size_bytes, duration_seconds, is_cover
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      photographerId,
      payload.mediaType,
      payload.storageKey,
      payload.mediaUrl,
      payload.title || null,
      payload.description || null,
      payload.tags || [],
      payload.fileSizeBytes,
      payload.durationSeconds ?? null,
      payload.isCover ?? false
    ]
  );
  return rows[0];
};

export const listMyPortfolio = async (photographerId) => {
  const { rows } = await query(
    `SELECT * FROM portfolio_media
     WHERE photographer_id = $1
     ORDER BY created_at DESC`,
    [photographerId]
  );
  return rows;
};

export const findPortfolioItemById = async ({ photographerId, itemId }) => {
  const { rows } = await query(
    `SELECT *
     FROM portfolio_media
     WHERE photographer_id = $1 AND id = $2
     LIMIT 1`,
    [photographerId, itemId]
  );
  return rows[0];
};

export const findPortfolioItemByIdAnyOwner = async (itemId) => {
  const { rows } = await query(
    `SELECT *
     FROM portfolio_media
     WHERE id = $1
     LIMIT 1`,
    [itemId]
  );
  return rows[0];
};

export const deletePortfolioItem = async ({ photographerId, itemId }) => {
  const { rows } = await query(
    `DELETE FROM portfolio_media
     WHERE photographer_id = $1 AND id = $2
     RETURNING *`,
    [photographerId, itemId]
  );
  return rows[0];
};
