-- 003_auth_hardening.sql
-- Adds safety controls around email verification retries and resend limits.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_resend_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_resend_window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_verification_locked_until ON users(verification_locked_until);
CREATE INDEX IF NOT EXISTS idx_users_verification_resend_window ON users(verification_resend_window_started_at);
