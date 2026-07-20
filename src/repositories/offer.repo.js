import { query, getClient } from "../config/db.js";

export const createOffer = async ({ userId, payload }) => {
  const { rows } = await query(
    `INSERT INTO custom_offers (
      created_by, sent_to, service_name, description,
      pricing_amount, currency_code, pricing_mode,
      categories, whats_included, delivery_time,
      quantity_label, quantity_max,
      session_date, session_time, location_type, location_text,
      expires_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [
      userId,
      payload.sentTo,
      payload.serviceName,
      payload.description ?? null,
      payload.pricingAmount,
      payload.currencyCode ?? "NGN",
      payload.pricingMode ?? "fixed",
      payload.categories ?? [],
      payload.whatsIncluded ?? [],
      payload.deliveryTime ?? null,
      payload.quantityLabel ?? null,
      payload.quantityMax ?? null,
      payload.sessionDate ?? null,
      payload.sessionTime ?? null,
      payload.locationType ?? null,
      payload.locationText ?? null,
      payload.expiresAt ?? null
    ]
  );
  return rows[0];
};

export const findOfferById = async (offerId) => {
  const { rows } = await query(
    `SELECT * FROM custom_offers WHERE id = $1 LIMIT 1`,
    [offerId]
  );
  return rows[0] || null;
};

export const listOffersForUser = async (userId) => {
  const { rows } = await query(
    `SELECT
      co.*,
      sender.name AS sender_name,
      sender.role AS sender_role,
      recipient.name AS recipient_name,
      recipient.role AS recipient_role
     FROM custom_offers co
     INNER JOIN users sender ON sender.id = co.created_by
     INNER JOIN users recipient ON recipient.id = co.sent_to
     WHERE co.created_by = $1 OR co.sent_to = $1
     ORDER BY co.created_at DESC`,
    [userId]
  );
  return rows;
};

export const updateOfferStatus = async ({ offerId, status }) => {
  const { rows } = await query(
    `UPDATE custom_offers
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [offerId, status]
  );
  return rows[0];
};

export const linkOfferToSession = async ({ offerId, sessionId }) => {
  const { rows } = await query(
    `UPDATE custom_offers
     SET session_id = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [offerId, sessionId]
  );
  return rows[0];
};
