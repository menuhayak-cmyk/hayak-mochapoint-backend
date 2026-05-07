-- ============================================================
-- 006_turkish_fields.sql
-- Add Turkish language fields to support bilingual content
-- ============================================================

-- categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_tr TEXT;

-- products
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_tr TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients_tr TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge_tr TEXT;

-- daily_picks
ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS subtitle_tr TEXT;

-- hero_slides
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS subtitle_tr TEXT;

-- contact_info
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS title_tr TEXT;
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS detail_tr TEXT;
