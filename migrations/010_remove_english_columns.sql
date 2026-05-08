-- ============================================================
-- 010_remove_english_columns.sql
-- Remove name_en column since English language is no longer supported
-- ============================================================

ALTER TABLE products DROP COLUMN IF EXISTS name_en;
