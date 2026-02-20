import { query } from "../config/db.js";

export const ensureRateCard = async (photographerId) => {
  const { rows } = await query(
    `INSERT INTO rate_cards (photographer_id)
     VALUES ($1)
     ON CONFLICT (photographer_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [photographerId]
  );
  return rows[0];
};

export const addRateCardItem = async ({ photographerId, payload }) => {
  const rateCard = await ensureRateCard(photographerId);
  const { rows } = await query(
    `INSERT INTO rate_card_items (
      rate_card_id, service_name, quantity_label, quantity_max, pricing_amount, currency_code, pricing_mode, sort_order
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [
      rateCard.id,
      payload.serviceName,
      payload.quantityLabel ?? null,
      payload.quantityMax ?? null,
      payload.pricingMode === "fixed" ? payload.pricingAmount : null,
      payload.currencyCode ?? "USD",
      payload.pricingMode,
      payload.sortOrder ?? 0
    ]
  );
  return rows[0];
};

export const listRateCardItems = async (photographerId) => {
  const { rows } = await query(
    `SELECT rci.*
     FROM rate_card_items rci
     INNER JOIN rate_cards rc ON rc.id = rci.rate_card_id
     WHERE rc.photographer_id = $1
     ORDER BY rci.sort_order ASC, rci.created_at ASC`,
    [photographerId]
  );
  return rows;
};

export const findRateCardItemById = async (itemId) => {
  const { rows } = await query(
    `SELECT
      rci.*,
      rc.photographer_id
     FROM rate_card_items rci
     INNER JOIN rate_cards rc ON rc.id = rci.rate_card_id
     WHERE rci.id = $1
     LIMIT 1`,
    [itemId]
  );
  return rows[0];
};

export const deleteRateCardItemById = async (itemId) => {
  const { rows } = await query(
    `DELETE FROM rate_card_items
     WHERE id = $1
     RETURNING *`,
    [itemId]
  );
  return rows[0];
};
