-- ============================================================
-- CUSTOMER MANAGEMENT — Database Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. store_customers — Core customer table
-- ============================================================
CREATE TABLE IF NOT EXISTS store_customers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    password_hash   TEXT,                     -- NULL = guest (no password set yet)
    full_name       TEXT,
    phone           TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'disabled', 'guest')),

    -- Denormalized stats (updated on each order)
    total_orders    INTEGER NOT NULL DEFAULT 0,
    total_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Profile data
    addresses       JSONB DEFAULT '[]'::jsonb,
    tags            TEXT[] DEFAULT '{}',
    notes           TEXT,
    accepts_marketing BOOLEAN DEFAULT false,

    -- Timestamps & tracking
    last_order_at   TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    login_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each email is unique per store
    UNIQUE(store_id, email)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_store_customers_store_id ON store_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_customers_email ON store_customers(email);
CREATE INDEX IF NOT EXISTS idx_store_customers_status ON store_customers(store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_customers_created ON store_customers(store_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_store_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_customers_updated ON store_customers;
CREATE TRIGGER trg_store_customers_updated
    BEFORE UPDATE ON store_customers
    FOR EACH ROW EXECUTE FUNCTION update_store_customers_updated_at();

-- ============================================================
-- 2. customer_wishlists — Wishlist items
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_wishlists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,
    variant_id      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One product per customer
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_wishlists_customer ON customer_wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wishlists_store ON customer_wishlists(store_id);

-- ============================================================
-- 3. customer_activity_log — Audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_activity_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    activity_type   TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_customer ON customer_activity_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_store ON customer_activity_log(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON customer_activity_log(activity_type);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activity_log ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by our server-side code)
CREATE POLICY "service_all_store_customers" ON store_customers
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_all_customer_wishlists" ON customer_wishlists
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_all_customer_activity_log" ON customer_activity_log
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Done! Tables created successfully.
-- ============================================================
