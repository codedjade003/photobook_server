-- 009_messaging_enhancements.sql
-- Adds online presence, voice notes, and richer messaging features.

-- Track when a user was last seen (updated on socket disconnect).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add VOICE_NOTE as a supported message type.
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('TEXT', 'WEBRTC_SIGNAL', 'VOICE_NOTE'));
