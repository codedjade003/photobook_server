-- 006_live_locations.sql
-- Adds real-time location sharing support for the Live Maps feature.

-- Stores the latest known location for each user.
CREATE TABLE IF NOT EXISTS user_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manage who shares their location with whom.
-- A row here means: user_id allows target_user_id to see their location.
CREATE TABLE IF NOT EXISTS location_shares (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, target_user_id)
);

-- Index to quickly find who I can see (inverse lookup).
CREATE INDEX IF NOT EXISTS idx_location_shares_target
  ON location_shares (target_user_id, user_id);
