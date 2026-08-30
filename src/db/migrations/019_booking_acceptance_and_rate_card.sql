-- 019_booking_acceptance_and_rate_card.sql
-- Multi-role creatives, rate-card-backed booking packages, and the
-- accept/decline/deliverables session workflow.

-- ─────────────────────────────────────────────────────────────
-- 1) Users: multi creative subtypes (was single creative_type)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS creative_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migrate any existing single creative_type into the array.
UPDATE users
SET creative_types = ARRAY[creative_type]
WHERE creative_type IS NOT NULL
  AND (creative_types IS NULL OR cardinality(creative_types) = 0);

ALTER TABLE users DROP COLUMN IF EXISTS creative_type;

-- ─────────────────────────────────────────────────────────────
-- 2) Sessions: rate-card-backed packages + workflow timestamps
-- ─────────────────────────────────────────────────────────────
-- Package names are no longer a hardcoded enum — they come from the
-- creative's rate card service_name.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_package_type_check;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS rate_card_item_id UUID
    REFERENCES rate_card_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_end_time TIME;

-- Status workflow: pending → confirmed (accepted) / declined / canceled;
-- confirmed → completed once deliverables are sent AND confirmed.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'confirmed', 'declined', 'completed', 'canceled'));

CREATE INDEX IF NOT EXISTS idx_sessions_creative_type ON sessions(creative_type);
CREATE INDEX IF NOT EXISTS idx_sessions_rate_card_item ON sessions(rate_card_item_id);

-- ─────────────────────────────────────────────────────────────
-- 3) Event types: match the final booking-form taxonomy
-- ─────────────────────────────────────────────────────────────
UPDATE event_types SET creative_types = '{photographer}' WHERE slug = 'portrait';
UPDATE event_types SET creative_types = '{photographer}' WHERE slug = 'street-photography';

INSERT INTO event_types (slug, display_name, active, creative_types)
VALUES
  ('photo-coverage', 'Photo Coverage', TRUE, '{photographer}'),
  ('video-coverage', 'Video Coverage', TRUE, '{videographer}')
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    active = EXCLUDED.active,
    creative_types = EXCLUDED.creative_types;

-- Videographer + photographer shared: event, fashion, wedding
UPDATE event_types SET creative_types = '{photographer,videographer}'
WHERE slug IN ('event', 'fashion', 'wedding');
