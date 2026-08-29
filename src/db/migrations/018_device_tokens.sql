-- 018_device_tokens.sql
-- Device tokens for Firebase Cloud Messaging (push notifications)
-- and one-review-per-session enforcement.

-- 1) Device tokens (FCM). Multiple devices per user, token globally unique.
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- 2) One review per session (partial unique index allows NULL session_id).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_session
  ON reviews(session_id)
  WHERE session_id IS NOT NULL;
