-- 010_custom_offers_expiry.sql
-- Adds validity period to custom offers.

ALTER TABLE custom_offers
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
