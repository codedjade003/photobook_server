-- 004_event_types_seed_refresh.sql
-- Align dropdown event types with the current booking taxonomy.

-- Preserve existing foreign keys where possible by renaming legacy slugs first.
UPDATE event_types
SET slug = 'birthdays',
    display_name = 'Birthdays',
    active = TRUE
WHERE slug = 'birthday'
  AND NOT EXISTS (
    SELECT 1
    FROM event_types
    WHERE slug = 'birthdays'
  );

UPDATE event_types
SET slug = 'corporate',
    display_name = 'Corporate',
    active = TRUE
WHERE slug = 'commercial'
  AND NOT EXISTS (
    SELECT 1
    FROM event_types
    WHERE slug = 'corporate'
  );

INSERT INTO event_types (slug, display_name, active)
VALUES
  ('event', 'Event', TRUE),
  ('portrait', 'Portrait', TRUE),
  ('fashion', 'Fashion', TRUE),
  ('wedding', 'Wedding', TRUE),
  ('birthdays', 'Birthdays', TRUE),
  ('corporate', 'Corporate', TRUE),
  ('product', 'Product', TRUE)
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    active = EXCLUDED.active;

UPDATE event_types
SET active = FALSE
WHERE slug NOT IN (
  'event',
  'portrait',
  'fashion',
  'wedding',
  'birthdays',
  'corporate',
  'product'
);
