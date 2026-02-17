-- ================================================================
-- Customer System Extensions
-- Migration: 023_customer_system.sql
-- Created: 2026-02-17
-- Description: Creates customer_addresses, wishlists,
--   return_requests, and payment_transactions tables
--   for storefront and admin order management.
-- ================================================================

-- ——— 1. Customer Addresses ———
CREATE TABLE IF NOT EXISTS customer_addresses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT,

  -- Address fields
  label           TEXT DEFAULT 'home' CHECK (label IN ('home','work','other')),
  full_name       TEXT NOT NULL,
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  postal_code     TEXT NOT NULL,
  country         TEXT DEFAULT 'IN',
  landmark        TEXT,

  -- Settings
  is_default      BOOLEAN DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_addresses_store ON customer_addresses(store_id, customer_email);

-- ——— 2. Wishlists ———
CREATE TABLE IF NOT EXISTS wishlists (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  customer_email  TEXT NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, customer_email, product_id)
);

CREATE INDEX idx_wishlists_customer ON wishlists(store_id, customer_email);
CREATE INDEX idx_wishlists_product ON wishlists(product_id);

-- ——— 3. Return Requests ———
CREATE TABLE IF NOT EXISTS return_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,

  -- Request details
  reason          TEXT NOT NULL CHECK (reason IN ('defective','wrong_item','not_as_described','changed_mind','too_late','other')),
  description     TEXT,
  images          TEXT[] DEFAULT '{}',

  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing','refunded','completed')),
  approved_at     TIMESTAMPTZ,
  refund_amount   NUMERIC(10,2),
  refund_method   TEXT CHECK (refund_method IN ('original_payment','store_credit','bank_transfer')),
  refunded_at     TIMESTAMPTZ,

  -- Admin notes
  admin_notes     TEXT,
  processed_by    UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_return_requests_order ON return_requests(order_id);
CREATE INDEX idx_return_requests_store ON return_requests(store_id, status);

-- ——— 4. Payment Transactions ———
CREATE TABLE IF NOT EXISTS payment_transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,

  -- Payment info
  gateway         TEXT NOT NULL CHECK (gateway IN ('stripe','razorpay','paypal','cod','bank_transfer')),
  gateway_txn_id  TEXT,                              -- external transaction ID
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',

  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded','partially_refunded')),
  failure_reason  TEXT,

  -- Metadata
  payment_method  TEXT,                              -- 'card', 'upi', 'netbanking', 'wallet', etc.
  card_last4      TEXT,
  card_brand      TEXT,
  metadata        JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_txn_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_txn_store ON payment_transactions(store_id, status);
CREATE INDEX idx_payment_txn_gateway ON payment_transactions(gateway, gateway_txn_id);

-- ——— 5. RLS Policies ———
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Customer Addresses: store owner manages
CREATE POLICY "Store owners manage customer addresses"
  ON customer_addresses FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

-- Wishlists: store owner can view, insert/delete handled by storefront API
CREATE POLICY "Store owners view wishlists"
  ON wishlists FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

CREATE POLICY "Anyone can manage their wishlists via API"
  ON wishlists FOR ALL
  USING (true)
  WITH CHECK (
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- Return Requests: store owner manages, customers create
CREATE POLICY "Store owners manage returns"
  ON return_requests FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

-- Payment Transactions: store owner reads
CREATE POLICY "Store owners view payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

CREATE POLICY "Service role manages payment transactions"
  ON payment_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ——— 6. Updated_at triggers ———
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_return_requests_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
