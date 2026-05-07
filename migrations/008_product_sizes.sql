-- ============================================================
-- 008_product_sizes.sql — Product Sizes (per-size pricing)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_sizes (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name_ar     TEXT NOT NULL,         -- اسم الحجم بالعربية (مثال: صغير، وسط، كبير)
  name_tr     TEXT,                  -- اسم الحجم بالتركية
  price       NUMERIC(10,2) NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes(product_id);
