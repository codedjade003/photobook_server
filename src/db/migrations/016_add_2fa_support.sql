-- Add 2FA support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_oauth_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for google_oauth_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_google_oauth_id ON users(google_oauth_id);
CREATE INDEX IF NOT EXISTS idx_last_login ON users(last_login_at DESC);
