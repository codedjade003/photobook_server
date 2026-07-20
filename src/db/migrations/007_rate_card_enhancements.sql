-- 007_rate_card_enhancements.sql
-- Adds categories, description, what's included, and delivery time to rate card items.

ALTER TABLE rate_card_items
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS whats_included TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS delivery_time TEXT;

-- Loosen the pricing constraint: now pricing_amount is always required,
-- even for contact-mode items (acts as a base/reference price).
ALTER TABLE rate_card_items
  DROP CONSTRAINT IF EXISTS chk_rate_item_pricing;

ALTER TABLE rate_card_items
  ADD CONSTRAINT chk_rate_item_pricing
    CHECK (pricing_amount IS NOT NULL AND pricing_amount >= 0);

-- Ensure categories only contain allowed values.
-- This is a soft guard — app-level Zod validation is the primary gate.
ALTER TABLE rate_card_items
  DROP CONSTRAINT IF EXISTS valid_categories;

ALTER TABLE rate_card_items
  ADD CONSTRAINT valid_categories
    CHECK (
      categories IS NULL
      OR categories = ARRAY[]::TEXT[]
      OR categories <@ ARRAY['weddings','birthdays','products','headshots','events','editorial','corporate','lifestyle']::TEXT[]
    );
