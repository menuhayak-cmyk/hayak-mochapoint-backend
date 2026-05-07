-- ============================================================
-- 005_orders.sql
-- Tables for managing customer orders
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  table_number TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status       TEXT DEFAULT 'pending', -- pending, preparing, completed, cancelled
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER, -- Can be null if it's a bundle or generic item
  product_name TEXT NOT NULL,
  price        NUMERIC(10, 2) NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  options      JSONB, -- For extra options like size, sugar, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
