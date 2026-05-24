# LetBuyy Platform — Shopify-Inspired Comprehensive Analysis

> **Part 5 of 8** | Complete Database Schema — All Tables, Migrations & RLS Policies
>
> **Date:** February 13, 2026 | **Version:** 4.0 (Shopify-Inspired Rebuild)
>
> **Prev:** [Part 4](./Shopify_Inspired_Analysis_Part4_TrialPayment.md) | **Next:** Part 6 (Admin Dashboard Variants)

---

## 17. Complete Database Schema

### 17.1 Core Tables Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE ARCHITECTURE OVERVIEW                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTHENTICATION (Supabase Auth)                                              │
│  └─ auth.users                                                               │
│                                                                              │
│  CORE PLATFORM                                                               │
│  ├─ stores (extended with trial & payment fields)                            │
│  ├─ onboarding_responses (JSONB storage)                                     │
│  ├─ email_logs (notification tracking)                                       │
│  └─ onboarding_attempts (failure logging)                                    │
│                                                                              │
│  PAYMENT & SUBSCRIPTION                                                      │
│  ├─ payment_methods (UPI, cards, etc.)                                       │
│  ├─ payment_transactions (billing history)                                   │
│  ├─ subscriptions (active subscriptions)                                     │
│  └─ subscription_history (status changes)                                    │
│                                                                              │
│  SITE-TYPE SPECIFIC                                                          │
│  ├─ E-COMMERCE                                                               │
│  │  ├─ products                                                              │
│  │  ├─ product_variants                                                      │
│  │  ├─ product_inventory                                                     │
│  │  ├─ orders                                                                │
│  │  ├─ order_items                                                           │
│  │  ├─ customers                                                             │
│  │  ├─ shipping_zones                                                        │
│  │  ├─ shipping_methods                                                      │
│  │  ├─ coupons                                                               │
│  │  └─ coupon_redemptions                                                    │
│  │                                                                           │
│  ├─ BLOGGER                                                                  │
│  │  ├─ blogs                                                                 │
│  │  ├─ blog_posts                                                            │
│  │  ├─ blog_categories                                                       │
│  │  ├─ blog_tags                                                             │
│  │  ├─ blog_post_categories                                                  │
│  │  ├─ blog_post_tags                                                        │
│  │  ├─ blog_comments                                                         │
│  │  └─ blog_subscribers                                                      │
│  │                                                                           │
│  ├─ PORTFOLIO                                                                │
│  │  ├─ portfolio_projects                                                    │
│  │  ├─ portfolio_categories                                                  │
│  │  ├─ portfolio_testimonials                                                │
│  │  └─ portfolio_services                                                    │
│  │                                                                           │
│  ├─ RESUME                                                                   │
│  │  ├─ resume_profiles                                                       │
│  │  ├─ resume_experiences                                                    │
│  │  ├─ resume_education                                                      │
│  │  ├─ resume_skills                                                         │
│  │  ├─ resume_certifications                                                 │
│  │  └─ resume_languages                                                      │
│  │                                                                           │
│  └─ LANDING PAGE                                                             │
│     ├─ landing_pages                                                         │
│     ├─ landing_leads                                                         │
│     └─ landing_analytics                                                     │
│                                                                              │
│  SHARED/CROSS-CUTTING                                                        │
│  ├─ media_library (all site types)                                           │
│  ├─ activity_logs (audit trail)                                              │
│  ├─ content_versions (version control)                                       │
│  ├─ analytics_events (tracking)                                              │
│  └─ currencies (multi-currency support)                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Migration Scripts

### 18.1 Migration 001 — Stores Table Extension

```sql
-- Migration: 001_extend_stores_table.sql
-- Description: Add trial and payment fields to stores table
-- Date: 2026-02-13

-- Add new columns to stores table
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'trial' 
    CHECK (status IN ('trial', 'active', 'inactive', 'payment_failed', 'suspended')),
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10,2) DEFAULT 499.00,
  ADD COLUMN IF NOT EXISTS subscription_currency VARCHAR(3) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS onboarding_responses JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS store_config JSONB DEFAULT '{}';

-- Create function to auto-set trial dates
CREATE OR REPLACE FUNCTION set_trial_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_starts_at IS NULL THEN
    NEW.trial_starts_at := NOW();
  END IF;
  
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_trial_dates ON stores;
CREATE TRIGGER trg_set_trial_dates
  BEFORE INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION set_trial_dates();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_trial_expiry 
  ON stores(status, trial_ends_at) 
  WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_stores_user_status 
  ON stores(user_id, status);

-- Add helpful view for trial expiry monitoring
CREATE OR REPLACE VIEW stores_expiring_soon AS
SELECT 
  s.*,
  EXTRACT(DAY FROM (s.trial_ends_at - NOW())) AS days_until_expiry,
  u.email AS owner_email
FROM stores s
JOIN auth.users u ON s.user_id = u.id
WHERE s.status = 'trial'
  AND s.trial_ends_at > NOW()
  AND s.trial_ends_at <= NOW() + INTERVAL '7 days'
ORDER BY s.trial_ends_at ASC;

COMMENT ON VIEW stores_expiring_soon IS 
  'Shows all trial stores expiring within 7 days for notification purposes';
```

### 18.2 Migration 002 — Payment Tables

```sql
-- Migration: 002_create_payment_tables.sql
-- Description: Create payment methods, transactions, and subscription tables
-- Date: 2026-02-13

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Payment Gateway
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
  provider_customer_id VARCHAR(255) NOT NULL,
  provider_payment_method_id VARCHAR(255) NOT NULL,
  
  -- Method Details
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('upi', 'card', 'netbanking', 'wallet')),
  
  -- Card details (if applicable)
  card_brand VARCHAR(20),
  card_last_4 VARCHAR(4),
  card_expiry_month INTEGER,
  card_expiry_year INTEGER,
  
  -- UPI details (if applicable)
  upi_id VARCHAR(100),
  
  -- Wallet details (if applicable)
  wallet_provider VARCHAR(50),
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  billing_name VARCHAR(100),
  billing_email VARCHAR(255),
  billing_phone VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_provider_method UNIQUE (provider, provider_payment_method_id)
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_store ON payment_methods(store_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

COMMENT ON TABLE payment_methods IS 'Stores user payment methods for subscriptions';

-- ============================================
-- PAYMENT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  
  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  type VARCHAR(20) NOT NULL CHECK (type IN (
    'subscription', 
    'trial_conversion', 
    'addon', 
    'refund', 
    'chargeback'
  )),
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending', 
    'processing',
    'success', 
    'failed', 
    'refunded',
    'disputed'
  )),
  
  -- Provider Details
  provider VARCHAR(20) NOT NULL,
  provider_transaction_id VARCHAR(255),
  provider_order_id VARCHAR(255),
  provider_payment_id VARCHAR(255),
  
  -- Failure Handling
  failure_code VARCHAR(50),
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Billing Period (for subscriptions)
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  
  -- Metadata
  description TEXT,
  invoice_url TEXT,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_provider_transaction UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX idx_payment_transactions_store ON payment_transactions(store_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX idx_payment_transactions_created ON payment_transactions(created_at DESC);
CREATE INDEX idx_payment_transactions_retry ON payment_transactions(status, next_retry_at) 
  WHERE status = 'failed' AND retry_count < max_retries;

COMMENT ON TABLE payment_transactions IS 'Complete payment transaction history';

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  
  -- Subscription Details
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'past_due',
    'canceled',
    'paused',
    'expired'
  )),
  
  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancellation_reason VARCHAR(100),
  cancellation_note TEXT,
  
  -- Provider
  provider VARCHAR(20) NOT NULL,
  provider_subscription_id VARCHAR(255),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_active_subscription_per_store UNIQUE (store_id, status) 
    WHERE status = 'active'
);

CREATE INDEX idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end) 
  WHERE status = 'active';

COMMENT ON TABLE subscriptions IS 'Active and historical subscription records';

-- ============================================
-- SUBSCRIPTION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'created',
    'activated',
    'payment_succeeded',
    'payment_failed',
    'canceled',
    'paused',
    'resumed',
    'expired',
    'updated'
  )),
  
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_store ON subscription_history(store_id);
CREATE INDEX idx_subscription_history_created ON subscription_history(created_at DESC);

COMMENT ON TABLE subscription_history IS 'Audit trail for subscription changes';
```

### 18.3 Migration 003 — Onboarding Tables

```sql
-- Migration: 003_create_onboarding_tables.sql
-- Description: Enhanced onboarding tracking
-- Date: 2026-02-13

-- ============================================
-- ONBOARDING ATTEMPTS TABLE (Enhanced)
-- ============================================
DROP TABLE IF EXISTS onboarding_attempts;
CREATE TABLE onboarding_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Attempt Details
  site_type VARCHAR(20) NOT NULL CHECK (site_type IN (
    'ecommerce', 'portfolio', 'resume', 'landing', 'blogger'
  )),
  subdomain VARCHAR(63) NOT NULL,
  store_name VARCHAR(100),
  
  -- Responses
  responses JSONB DEFAULT '{}',
  
  -- Outcome
  success BOOLEAN NOT NULL,
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_onboarding_attempts_user ON onboarding_attempts(user_id);
CREATE INDEX idx_onboarding_attempts_success ON onboarding_attempts(success);
CREATE INDEX idx_onboarding_attempts_subdomain ON onboarding_attempts(subdomain);
CREATE INDEX idx_onboarding_attempts_attempted ON onboarding_attempts(attempted_at DESC);

COMMENT ON TABLE onboarding_attempts IS 'Tracks all onboarding attempts (success and failures)';

-- ============================================
-- ONBOARDING PROGRESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 5,
  completed_steps INTEGER[] DEFAULT '{}',
  
  site_type VARCHAR(20),
  partial_data JSONB DEFAULT '{}',
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_active_progress_per_user UNIQUE (user_id)
    WHERE completed_at IS NULL
);

CREATE INDEX idx_onboarding_progress_user ON onboarding_progress(user_id);

COMMENT ON TABLE onboarding_progress IS 'Tracks in-progress onboarding sessions';
```

### 18.4 Migration 004 — Email & Notifications

```sql
-- Migration: 004_create_email_notifications.sql
-- Description: Enhanced email logging and notification queue
-- Date: 2026-02-13

-- ============================================
-- EMAIL LOGS TABLE (Enhanced)
-- ============================================
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS template_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Add index for scheduled emails
CREATE INDEX IF NOT EXISTS idx_email_logs_scheduled 
  ON email_logs(scheduled_for) 
  WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email Preferences
  email_trial_reminders BOOLEAN DEFAULT TRUE,
  email_payment_updates BOOLEAN DEFAULT TRUE,
  email_product_updates BOOLEAN DEFAULT TRUE,
  email_marketing BOOLEAN DEFAULT FALSE,
  
  -- In-App Preferences
  inapp_trial_reminders BOOLEAN DEFAULT TRUE,
  inapp_comments BOOLEAN DEFAULT TRUE,
  inapp_orders BOOLEAN DEFAULT TRUE,
  inapp_analytics BOOLEAN DEFAULT FALSE,
  
  -- Push Preferences (future)
  push_enabled BOOLEAN DEFAULT FALSE,
  
  -- Quiet Hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_prefs_per_user UNIQUE (user_id)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

COMMENT ON TABLE notification_preferences IS 'User notification preferences';

-- ============================================
-- NOTIFICATION QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'trial_reminder_7d',
    'trial_reminder_3d',
    'trial_reminder_1d',
    'trial_expired',
    'payment_succeeded',
    'payment_failed',
    'store_deactivated',
    'store_reactivated',
    'subscription_renewed',
    'subscription_canceled'
  )),
  
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'inapp', 'push')),
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'sent',
    'failed',
    'canceled'
  )),
  
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  
  data JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_scheduled 
  ON notification_queue(scheduled_for) 
  WHERE status = 'pending';
CREATE INDEX idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX idx_notification_queue_type ON notification_queue(type);

COMMENT ON TABLE notification_queue IS 'Scheduled notification delivery queue';
```

### 18.5 Migration 005 — RLS Policies

```sql
-- Migration: 005_row_level_security.sql
-- Description: Comprehensive RLS policies for all tables
-- Date: 2026-02-13

-- ============================================
-- STORES TABLE RLS
-- ============================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Users can view their own stores
DROP POLICY IF EXISTS stores_select_own ON stores;
CREATE POLICY stores_select_own ON stores
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create stores
DROP POLICY IF EXISTS stores_insert_own ON stores;
CREATE POLICY stores_insert_own ON stores
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own stores
DROP POLICY IF EXISTS stores_update_own ON stores;
CREATE POLICY stores_update_own ON stores
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users cannot delete stores (soft delete via status only)
DROP POLICY IF EXISTS stores_delete_own ON stores;
CREATE POLICY stores_delete_own ON stores
  FOR DELETE
  USING (FALSE);

-- ============================================
-- PAYMENT METHODS RLS
-- ============================================
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_methods_select_own ON payment_methods;
CREATE POLICY payment_methods_select_own ON payment_methods
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS payment_methods_insert_own ON payment_methods;
CREATE POLICY payment_methods_insert_own ON payment_methods
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS payment_methods_update_own ON payment_methods;
CREATE POLICY payment_methods_update_own ON payment_methods
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS payment_methods_delete_own ON payment_methods;
CREATE POLICY payment_methods_delete_own ON payment_methods
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- PAYMENT TRANSACTIONS RLS
-- ============================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_select_own ON payment_transactions;
CREATE POLICY payment_transactions_select_own ON payment_transactions
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Only system can insert transactions
DROP POLICY IF EXISTS payment_transactions_insert_system ON payment_transactions;
CREATE POLICY payment_transactions_insert_system ON payment_transactions
  FOR INSERT
  WITH CHECK (FALSE);

-- No updates or deletes allowed
DROP POLICY IF EXISTS payment_transactions_no_update ON payment_transactions;
CREATE POLICY payment_transactions_no_update ON payment_transactions
  FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS payment_transactions_no_delete ON payment_transactions;
CREATE POLICY payment_transactions_no_delete ON payment_transactions
  FOR DELETE
  USING (FALSE);

-- ============================================
-- SUBSCRIPTIONS RLS
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON subscriptions;
CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Users can cancel their subscriptions (update only)
DROP POLICY IF EXISTS subscriptions_update_own ON subscriptions;
CREATE POLICY subscriptions_update_own ON subscriptions
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Only allow updating cancel_at_period_end and cancellation fields
    (OLD.status = NEW.status OR NEW.status IN ('canceled', 'paused'))
  );

-- ============================================
-- EMAIL LOGS RLS
-- ============================================
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_select_own ON email_logs;
CREATE POLICY email_logs_select_own ON email_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Only system can insert email logs
DROP POLICY IF EXISTS email_logs_insert_system ON email_logs;
CREATE POLICY email_logs_insert_system ON email_logs
  FOR INSERT
  WITH CHECK (FALSE);

-- ============================================
-- ONBOARDING ATTEMPTS RLS
-- ============================================
ALTER TABLE onboarding_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_attempts_select_own ON onboarding_attempts;
CREATE POLICY onboarding_attempts_select_own ON onboarding_attempts
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS onboarding_attempts_insert_own ON onboarding_attempts;
CREATE POLICY onboarding_attempts_insert_own ON onboarding_attempts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- NOTIFICATION PREFERENCES RLS
-- ============================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_prefs_all ON notification_preferences;
CREATE POLICY notification_prefs_all ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## 19. Helper Functions

### 19.1 Trial Management Functions

```sql
-- Function: Get days left in trial
CREATE OR REPLACE FUNCTION get_trial_days_left(store_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  days_left INTEGER;
BEGIN
  SELECT GREATEST(0, EXTRACT(DAY FROM (trial_ends_at - NOW()))::INTEGER)
  INTO days_left
  FROM stores
  WHERE id = store_uuid AND status = 'trial';
  
  RETURN COALESCE(days_left, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Check if store should be deactivated
CREATE OR REPLACE FUNCTION should_deactivate_store(store_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  store_record RECORD;
BEGIN
  SELECT status, trial_ends_at, autopay_enabled
  INTO store_record
  FROM stores
  WHERE id = store_uuid;
  
  RETURN (
    store_record.status = 'trial' 
    AND store_record.trial_ends_at <= NOW()
    AND NOT store_record.autopay_enabled
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Deactivate expired trial stores
CREATE OR REPLACE FUNCTION deactivate_expired_trials()
RETURNS TABLE(store_id UUID, subdomain VARCHAR, owner_email VARCHAR) AS $$
BEGIN
  RETURN QUERY
  UPDATE stores s
  SET 
    status = 'inactive',
    deactivated_at = NOW(),
    deactivation_reason = 'trial_expired_no_payment'
  FROM auth.users u
  WHERE s.user_id = u.id
    AND s.status = 'trial'
    AND s.trial_ends_at <= NOW()
    AND s.autopay_enabled = FALSE
  RETURNING s.id, s.subdomain, u.email;
END;
$$ LANGUAGE plpgsql;

-- Function: Get store config
CREATE OR REPLACE FUNCTION get_store_config(store_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  config JSONB;
BEGIN
  SELECT store_config INTO config
  FROM stores
  WHERE id = store_uuid;
  
  RETURN COALESCE(config, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;
```

### 19.2 Payment Helper Functions

```sql
-- Function: Get active payment method for store
CREATE OR REPLACE FUNCTION get_active_payment_method(store_uuid UUID)
RETURNS UUID AS $$
DECLARE
  method_id UUID;
BEGIN
  SELECT id INTO method_id
  FROM payment_methods pm
  JOIN stores s ON pm.user_id = s.user_id
  WHERE s.id = store_uuid
    AND pm.is_active = TRUE
    AND pm.is_default = TRUE
  LIMIT 1;
  
  RETURN method_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Record payment transaction
CREATE OR REPLACE FUNCTION record_payment_transaction(
  p_store_id UUID,
  p_amount DECIMAL,
  p_type VARCHAR,
  p_provider VARCHAR,
  p_provider_transaction_id VARCHAR,
  p_status VARCHAR DEFAULT 'pending'
)
RETURNS UUID AS $$
DECLARE
  transaction_id UUID;
BEGIN
  INSERT INTO payment_transactions (
    store_id,
    amount,
    type,
    provider,
    provider_transaction_id,
    status
  ) VALUES (
    p_store_id,
    p_amount,
    p_type,
    p_provider,
    p_provider_transaction_id,
    p_status
  )
  RETURNING id INTO transaction_id;
  
  RETURN transaction_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 20. Database Triggers

### 20.1 Auto-Update Triggers

```sql
-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
DROP TRIGGER IF EXISTS trg_stores_updated_at ON stores;
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 20.2 Subscription History Trigger

```sql
-- Trigger: Log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO subscription_history (
      subscription_id,
      store_id,
      event_type,
      new_status,
      amount,
      currency
    ) VALUES (
      NEW.id,
      NEW.store_id,
      'created',
      NEW.status,
      NEW.amount,
      NEW.currency
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO subscription_history (
      subscription_id,
      store_id,
      event_type,
      old_status,
      new_status,
      amount,
      currency
    ) VALUES (
      NEW.id,
      NEW.store_id,
      CASE NEW.status
        WHEN 'canceled' THEN 'canceled'
        WHEN 'paused' THEN 'paused'
        WHEN 'active' THEN 'resumed'
        ELSE 'updated'
      END,
      OLD.status,
      NEW.status,
      NEW.amount,
      NEW.currency
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_history ON subscriptions;
CREATE TRIGGER trg_subscription_history
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION log_subscription_change();
```

---

> **→ Continues in Part 6:** Admin Dashboard Variants — Detailed Wireframes Per Site Type

---

## Document Navigation

| Part | Content |
|------|---------|
| [Part 1](./Shopify_Inspired_Analysis_Part1_Architecture.md) | Architecture & Trial System |
| [Part 2](./Shopify_Inspired_Analysis_Part2_Onboarding.md) | Onboarding Flow |
| [Part 3](./Shopify_Inspired_Analysis_Part3_StoreManagement.md) | Store Management UI |
| [Part 4](./Shopify_Inspired_Analysis_Part4_TrialPayment.md) | Trial & Payment UI |
| **Part 5** (this) | Complete Database Schema |
| Part 6 | Admin Dashboard Variants |
| Part 7 | Deployment & Migration |
| Part 8 | Implementation Roadmap |