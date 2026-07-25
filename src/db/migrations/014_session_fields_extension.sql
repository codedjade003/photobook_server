-- 011_session_fields_extension.sql
-- Extends the sessions table with new booking fields, status workflow,
-- and migrates package_type to new enum values.

-- 1) Drop the old constraint FIRST so we can migrate values
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_package_type_check;

-- 2) Migrate package_type: 'regular' → 'standard', keep 'premium'
UPDATE sessions SET package_type = 'standard' WHERE package_type = 'regular';

-- 3) Add the new CHECK constraint with expanded values
ALTER TABLE sessions ADD CONSTRAINT sessions_package_type_check
  CHECK (package_type IN ('basic', 'standard', 'premium'));

-- 4) Add new nullable fields
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS number_of_outfits INT,
  ADD COLUMN IF NOT EXISTS number_of_shooting_locations INT,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS deliverable_type VARCHAR(50);

-- 5) Migrate status to new workflow values
-- Map old status values to new ones
UPDATE sessions SET status = 'confirmed' WHERE status = 'accepted';
UPDATE sessions SET status = 'canceled' WHERE status = 'cancelled' OR status = 'rejected';
-- 'pending' and 'completed' stay the same

-- 5) Update the CHECK constraint for status
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled'));
