-- ================================================================
-- App Store Runtime Alignment
-- Migration: 043_app_store_runtime_alignment.sql
-- Purpose: Align App Store worker-owned runtime fields with existing
--          developer onboarding, app submission, and review UI contracts.
-- ================================================================

ALTER TABLE app_developers
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IN';

ALTER TABLE marketplace_apps
  ADD COLUMN IF NOT EXISTS app_url TEXT;

ALTER TABLE app_reviews
  ADD COLUMN IF NOT EXISTS user_name TEXT;

CREATE INDEX IF NOT EXISTS idx_app_developers_country ON app_developers(country);
