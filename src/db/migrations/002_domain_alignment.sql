-- 002_domain_alignment.sql
-- Aligns schema to current product language and v1 feature set.
-- "Sessions" is the canonical booking object.

-- 1) Standardize user role naming.
UPDATE users SET role = 'photographer' WHERE role = 'creative';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('client', 'photographer'));
COMMENT ON COLUMN users.role IS 'Role is standardized to client | photographer (using photographer instead of creative for now).';

-- 2) Rename creative tables to photographer tables (if they exist).
DO $$
BEGIN
  IF to_regclass('public.creative_profiles') IS NOT NULL
     AND to_regclass('public.photographer_profiles') IS NULL THEN
    ALTER TABLE creative_profiles RENAME TO photographer_profiles;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.creative_categories') IS NOT NULL
     AND to_regclass('public.photographer_categories') IS NULL THEN
    ALTER TABLE creative_categories RENAME TO photographer_categories;
  END IF;
END $$;

-- 3) Photographer profile shape.
DO $$
BEGIN
  IF to_regclass('public.photographer_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'photographer_profiles'
        AND column_name = 'bio'
    ) THEN
      ALTER TABLE photographer_profiles RENAME COLUMN bio TO about_me;
    END IF;

    ALTER TABLE photographer_profiles
      ADD COLUMN IF NOT EXISTS display_title TEXT,
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS star_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS total_reviews INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gallery_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS featured_review_ids UUID[] DEFAULT ARRAY[]::UUID[],
      ADD COLUMN IF NOT EXISTS messaging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS media_used_bytes BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS media_limit_bytes BIGINT NOT NULL DEFAULT 1073741824;

    ALTER TABLE photographer_profiles
      DROP COLUMN IF EXISTS rate_card,
      DROP COLUMN IF EXISTS certifications;
  END IF;
END $$;

-- 4) Client profile additions.
DO $$
BEGIN
  IF to_regclass('public.client_profiles') IS NOT NULL THEN
    ALTER TABLE client_profiles
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS bookings_count INT NOT NULL DEFAULT 0;

    ALTER TABLE client_profiles
      DROP COLUMN IF EXISTS booking_history;
  END IF;
END $$;

-- 5) Event types for robust dropdown/search support.
CREATE TABLE IF NOT EXISTS event_types (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO event_types (slug, display_name)
VALUES
  ('event', 'Event'),
  ('portrait', 'Portrait'),
  ('fashion', 'Fashion'),
  ('wedding', 'Wedding'),
  ('birthday', 'Birthday'),
  ('commercial', 'Commercial'),
  ('product', 'Product'),
  ('real-estate', 'Real Estate')
ON CONFLICT (slug) DO NOTHING;

-- 6) Reviews (clients review photographers).
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_photographer_created
  ON reviews (photographer_id, created_at DESC);

-- 7) Portfolio media with tags and per-item limits support.
CREATE TABLE IF NOT EXISTS portfolio_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_key TEXT NOT NULL,
  media_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds <= 60),
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_portfolio_storage_key
  ON portfolio_media (storage_key);

CREATE INDEX IF NOT EXISTS idx_portfolio_photographer_created
  ON portfolio_media (photographer_id, created_at DESC);

CREATE OR REPLACE FUNCTION trg_portfolio_enforce_media_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit BIGINT;
  v_used BIGINT;
  v_current BIGINT;
BEGIN
  SELECT media_limit_bytes
  INTO v_limit
  FROM photographer_profiles
  WHERE user_id = NEW.photographer_id;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(file_size_bytes), 0)
  INTO v_used
  FROM portfolio_media
  WHERE photographer_id = NEW.photographer_id;

  IF TG_OP = 'UPDATE' THEN
    v_current := COALESCE(OLD.file_size_bytes, 0);
  ELSE
    v_current := 0;
  END IF;

  IF (v_used - v_current + NEW.file_size_bytes) > v_limit THEN
    RAISE EXCEPTION 'Media limit exceeded for photographer %', NEW.photographer_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_enforce_media_limit ON portfolio_media;
CREATE TRIGGER portfolio_enforce_media_limit
BEFORE INSERT OR UPDATE ON portfolio_media
FOR EACH ROW
EXECUTE FUNCTION trg_portfolio_enforce_media_limit();

-- Keep photographer rating aggregates in sync.
CREATE OR REPLACE FUNCTION refresh_photographer_rating(p_photographer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE photographer_profiles pp
  SET
    total_reviews = agg.total_reviews,
    star_rating = agg.star_rating
  FROM (
    SELECT
      r.photographer_id,
      COUNT(*)::INT AS total_reviews,
      COALESCE(ROUND(AVG(r.rating)::NUMERIC, 2), 0.00) AS star_rating
    FROM reviews r
    WHERE r.photographer_id = p_photographer_id
    GROUP BY r.photographer_id
  ) agg
  WHERE pp.user_id = agg.photographer_id;

  UPDATE photographer_profiles
  SET total_reviews = 0, star_rating = 0.00
  WHERE user_id = p_photographer_id
    AND NOT EXISTS (
      SELECT 1 FROM reviews r WHERE r.photographer_id = p_photographer_id
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_reviews_refresh_photographer()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_photographer_rating(OLD.photographer_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_photographer_rating(NEW.photographer_id);
  IF TG_OP = 'UPDATE' AND NEW.photographer_id <> OLD.photographer_id THEN
    PERFORM refresh_photographer_rating(OLD.photographer_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_refresh_photographer ON reviews;
CREATE TRIGGER reviews_refresh_photographer
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trg_reviews_refresh_photographer();

-- Keep media usage and gallery count in sync.
CREATE OR REPLACE FUNCTION refresh_photographer_media_stats(p_photographer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE photographer_profiles pp
  SET
    gallery_count = agg.gallery_count,
    media_used_bytes = agg.media_used_bytes
  FROM (
    SELECT
      pm.photographer_id,
      COUNT(*)::INT AS gallery_count,
      COALESCE(SUM(pm.file_size_bytes), 0)::BIGINT AS media_used_bytes
    FROM portfolio_media pm
    WHERE pm.photographer_id = p_photographer_id
    GROUP BY pm.photographer_id
  ) agg
  WHERE pp.user_id = agg.photographer_id;

  UPDATE photographer_profiles
  SET gallery_count = 0, media_used_bytes = 0
  WHERE user_id = p_photographer_id
    AND NOT EXISTS (
      SELECT 1 FROM portfolio_media pm WHERE pm.photographer_id = p_photographer_id
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_portfolio_refresh_photographer()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_photographer_media_stats(OLD.photographer_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_photographer_media_stats(NEW.photographer_id);
  IF TG_OP = 'UPDATE' AND NEW.photographer_id <> OLD.photographer_id THEN
    PERFORM refresh_photographer_media_stats(OLD.photographer_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_refresh_photographer ON portfolio_media;
CREATE TRIGGER portfolio_refresh_photographer
AFTER INSERT OR UPDATE OR DELETE ON portfolio_media
FOR EACH ROW
EXECUTE FUNCTION trg_portfolio_refresh_photographer();

-- 8) Rate card normalized tables.
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_card_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES rate_cards(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  quantity_label TEXT,
  quantity_max INT CHECK (quantity_max IS NULL OR quantity_max > 0),
  pricing_amount NUMERIC(12,2),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('fixed', 'contact')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rate_item_pricing
    CHECK (
      (pricing_mode = 'fixed' AND pricing_amount IS NOT NULL AND pricing_amount >= 0)
      OR
      (pricing_mode = 'contact' AND pricing_amount IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_rate_card_items_rate_card
  ON rate_card_items (rate_card_id, sort_order ASC);

-- 9) Sessions table (booking equivalent).
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type_id INT NOT NULL REFERENCES event_types(id),
  package_type TEXT NOT NULL CHECK (package_type IN ('regular', 'premium')),
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('indoor', 'outdoor')),
  location_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_client_created
  ON sessions (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_photographer_created
  ON sessions (photographer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_event_type
  ON sessions (event_type_id);

-- 10) Keep category join table aligned with renamed term.
DO $$
BEGIN
  IF to_regclass('public.photographer_categories') IS NOT NULL THEN
    ALTER TABLE photographer_categories
      RENAME COLUMN creative_user_id TO photographer_user_id;
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    NULL;
END $$;
