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
      rate_card_id, service_name, quantity_label, quantity_max,
      pricing_amount, currency_code, pricing_mode, sort_order,
      categories, description, whats_included, delivery_time
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      rateCard.id,
      payload.serviceName,
      payload.quantityLabel ?? null,
      payload.quantityMax ?? null,
      payload.pricingAmount,
      payload.currencyCode ?? "NGN",
      payload.pricingMode ?? "fixed",
      payload.sortOrder ?? 0,
      payload.categories ?? [],
      payload.description ?? null,
      payload.whatsIncluded ?? [],
      payload.deliveryTime ?? null
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

export const updateRateCardItemById = async ({ itemId, payload }) => {
  const { rows } = await query(
    `UPDATE rate_card_items
     SET
       service_name    = COALESCE($2, service_name),
       quantity_label  = COALESCE($3, quantity_label),
       quantity_max    = COALESCE($4, quantity_max),
       pricing_amount  = COALESCE($5, pricing_amount),
       currency_code   = COALESCE($6, currency_code),
       pricing_mode    = COALESCE($7, pricing_mode),
       sort_order      = COALESCE($8, sort_order),
       categories      = COALESCE($9, categories),
       description     = COALESCE($10, description),
       whats_included  = COALESCE($11, whats_included),
       delivery_time   = COALESCE($12, delivery_time),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      itemId,
      payload.serviceName ?? null,
      payload.quantityLabel ?? null,
      payload.quantityMax ?? null,
      payload.pricingAmount ?? null,
      payload.currencyCode ?? null,
      payload.pricingMode ?? null,
      payload.sortOrder ?? null,
      payload.categories ?? null,
      payload.description ?? null,
      payload.whatsIncluded ?? null,
      payload.deliveryTime ?? null
    ]
  );
  return rows[0];
};
