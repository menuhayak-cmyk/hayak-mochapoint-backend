-- ============================================================
-- 009_fix_missing_columns.sql
-- Ensure columns that were added manually are properly migrated
-- ============================================================

-- name_en was used in products route but missing from 001_init.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en TEXT;
