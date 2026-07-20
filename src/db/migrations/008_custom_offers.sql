-- 008_custom_offers.sql
-- Adds bidirectional custom offers between users (photographers ↔ clients).
-- An accepted offer auto-creates a session booking.

CREATE TABLE IF NOT EXISTS custom_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  pricing_amount NUMERIC(12,2) NOT NULL CHECK (pricing_amount >= 0),
  currency_code TEXT NOT NULL DEFAULT 'NGN',
  pricing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed', 'contact')),
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  whats_included TEXT[] DEFAULT ARRAY[]::TEXT[],
  delivery_time TEXT,
  quantity_label TEXT,
  quantity_max INT CHECK (quantity_max IS NULL OR quantity_max > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  session_date DATE,
  session_time TIME,
  location_type TEXT CHECK (location_type IS NULL OR location_type IN ('indoor', 'outdoor')),
  location_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_offers_created_by
  ON custom_offers (created_by, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_offers_sent_to
  ON custom_offers (sent_to, status, created_at DESC);
