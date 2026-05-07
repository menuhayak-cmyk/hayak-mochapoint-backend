-- ============================================================
-- 002_hero_slides.sql  —  Add hero slides table
-- ============================================================

CREATE TABLE IF NOT EXISTS hero_slides (
  id          SERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  phone       TEXT,
  discount    TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS hero_slides_updated_at ON hero_slides;
CREATE TRIGGER hero_slides_updated_at
  BEFORE UPDATE ON hero_slides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
