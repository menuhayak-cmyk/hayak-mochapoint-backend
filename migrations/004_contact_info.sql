-- ============================================================
-- 004_contact_info.sql
-- Table to store dynamic addresses and phone numbers
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_info (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL, -- 'address' or 'phone'
  title_ar    TEXT NOT NULL, -- e.g., "العمل" or "الرئيسي"
  detail      TEXT NOT NULL, -- Actual phone number or address
  icon        TEXT,          -- icon name like 'MapPin', 'Phone', 'Building2'
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS contact_info_updated_at ON contact_info;
CREATE TRIGGER contact_info_updated_at
  BEFORE UPDATE ON contact_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
