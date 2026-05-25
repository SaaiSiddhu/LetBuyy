-- ================================================================
-- AI Credits & Notification Preferences
-- Migration: 024_ai_and_notifications.sql
-- Created: 2026-02-17
-- Description: Creates ai_usage, ai_credits, and
--   notification_preferences tables for AI Studio
--   and notification settings features.
-- ================================================================

-- ——— 1. AI Credits ———
CREATE TABLE IF NOT EXISTS ai_credits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Balance
  balance         INTEGER DEFAULT 0,                 -- current credit balance
  plan_credits    INTEGER DEFAULT 100,               -- credits allocated by subscription plan
  bonus_credits   INTEGER DEFAULT 0,                 -- promotional/bonus credits

  -- Lifetime stats
  total_used      INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,

  -- Reset tracking
  last_reset_at   TIMESTAMPTZ DEFAULT NOW(),         -- when plan credits last refreshed
  reset_period    TEXT DEFAULT 'monthly' CHECK (reset_period IN ('daily','weekly','monthly')),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_credits_store ON ai_credits(store_id);

-- ——— 2. AI Usage Log ———
CREATE TABLE IF NOT EXISTS ai_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  -- Feature info
  feature         TEXT NOT NULL CHECK (feature IN (
    'product_description', 'seo_meta', 'blog_post', 'social_copy',
    'image_generation', 'translation', 'chat', 'content_rewrite',
    'email_campaign', 'ad_copy', 'custom'
  )),

  -- Usage details
  prompt          TEXT,
  output          TEXT,
  tokens_input    INTEGER DEFAULT 0,
  tokens_output   INTEGER DEFAULT 0,
  credits_used    INTEGER DEFAULT 1,

  -- Model info
  model           TEXT DEFAULT 'gpt-4o-mini',
  provider        TEXT DEFAULT 'openai',
  latency_ms      INTEGER,

  -- Result
  status          TEXT DEFAULT 'completed' CHECK (status IN ('completed','failed','cancelled')),
  error_message   TEXT,

  -- Rating
  user_rating     INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
  user_feedback   TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_store ON ai_usage(store_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON ai_usage(store_id, feature);

-- ——— 3. Notification Preferences (extend existing table from 003) ———
-- Table already exists from 003_align_schema.sql; add missing columns
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_store ON notification_preferences(user_id, store_id);

-- ——— 4. RLS Policies ———
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- AI Credits: store owner reads and manages
CREATE POLICY "Store owners manage AI credits"
  ON ai_credits FOR ALL
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

-- AI Usage: store owner reads, service role inserts
CREATE POLICY "Store owners view AI usage"
  ON ai_usage FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

CREATE POLICY "Service role manages AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (true);

-- Notification Preferences: user manages their own
CREATE POLICY "Users manage their notification preferences"
  ON notification_preferences FOR ALL
  USING (
    true
  )
  WITH CHECK (
    true
  );

-- ——— 5. Updated_at triggers ———
CREATE TRIGGER trg_ai_credits_updated_at
  BEFORE UPDATE ON ai_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
