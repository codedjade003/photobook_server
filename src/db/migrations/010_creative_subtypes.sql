-- 010_creative_subtypes.sql
-- Adds creative subtypes (photographer, videographer, content_creator) and
-- scopes event_types to creative subtypes.

-- 1) Add creative_type to users (NULL for clients, required for creatives)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS creative_type VARCHAR(50)
  CHECK (creative_type IN ('photographer', 'videographer', 'content_creator'));

-- 2) Add creative_types filter column to event_types
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS creative_types TEXT[] NOT NULL DEFAULT '{photographer,videographer}';

-- 3) Seed/subtype-scope the event types
-- Photographer + Videographer shared event types
INSERT INTO event_types (slug, display_name, active, creative_types)
VALUES
  ('event', 'Event', TRUE, '{photographer,videographer}'),
  ('portrait', 'Portrait', TRUE, '{photographer,videographer}'),
  ('fashion', 'Fashion', TRUE, '{photographer,videographer}'),
  ('wedding', 'Wedding', TRUE, '{photographer,videographer}'),
  ('street-photography', 'Street Photography', TRUE, '{photographer,videographer}')
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    active = EXCLUDED.active,
    creative_types = EXCLUDED.creative_types;

-- Content creator content types (functionally the same as event_types)
INSERT INTO event_types (slug, display_name, active, creative_types)
VALUES
  ('bts-content', 'Behind the Scenes Content', TRUE, '{content_creator}'),
  ('event-highlights', 'Event Highlights', TRUE, '{content_creator}'),
  ('instagram-reels', 'Instagram Reels', TRUE, '{content_creator}'),
  ('social-media-content', 'Social Media Content', TRUE, '{content_creator}'),
  ('same-day-content', 'Same-day Content', TRUE, '{content_creator}'),
  ('short-form-content', 'Short-form Content', TRUE, '{content_creator}'),
  ('photo-video-coverage', 'Photo & Video Coverage', TRUE, '{content_creator}')
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    active = EXCLUDED.active,
    creative_types = EXCLUDED.creative_types;

-- 4) Deactivate old types that aren't in the new taxonomy
UPDATE event_types
SET active = FALSE
WHERE slug NOT IN (
  'event', 'portrait', 'fashion', 'wedding', 'street-photography',
  'bts-content', 'event-highlights', 'instagram-reels',
  'social-media-content', 'same-day-content', 'short-form-content',
  'photo-video-coverage'
);
