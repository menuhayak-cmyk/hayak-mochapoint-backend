-- ============================================================
-- 007_reviews_turkish_fields.sql
-- Add Turkish language field to reviews table
-- ============================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS comment_tr TEXT;
