-- ================================================================
-- Customer Credentials Table
-- Migration: 025_customer_credentials.sql
-- Created: 2026-02-17
-- Description: Creates customer_credentials table for storefront
--   customer order tracking authentication (set/verify password).
--   Used by order-service.ts setCustomerPassword/verifyCustomerPassword.
-- ================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ——— 1. Customer Credentials Table ———
CREATE TABLE IF NOT EXISTS customer_credentials (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,

  -- Contact identifier (email or phone)
  email_or_phone  TEXT NOT NULL,

  -- bcrypt hashed password
  password_hash   TEXT NOT NULL,

  -- Metadata
  last_login_at   TIMESTAMPTZ,
  login_count     INT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- One credential per contact per store
  UNIQUE(store_id, email_or_phone)
);

CREATE INDEX idx_customer_credentials_store ON customer_credentials(store_id, email_or_phone);

-- ——— 2. RLS Policies ———
ALTER TABLE customer_credentials ENABLE ROW LEVEL SECURITY;

-- Store owners can view (not passwords themselves, but records)
CREATE POLICY "Store owners manage customer credentials"
  ON customer_credentials FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

-- Service role (storefront API) can manage all credentials
CREATE POLICY "Service role manages customer credentials"
  ON customer_credentials FOR ALL
  USING (true)
  WITH CHECK (true);

-- ——— 3. Updated_at trigger ———
CREATE TRIGGER trg_customer_credentials_updated_at
  BEFORE UPDATE ON customer_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
