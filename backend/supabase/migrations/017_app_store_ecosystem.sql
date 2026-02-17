-- ================================================================
-- App Store Ecosystem
-- Migration: 017_app_store_ecosystem.sql
-- Created: 2026-02-16
-- Description: Creates all tables for the LetBuyy App Marketplace
-- ================================================================

-- ——— 1. App Developers ———
CREATE TABLE IF NOT EXISTS app_developers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  website_url     TEXT,
  support_email   TEXT,
  logo_url        TEXT,
  description     TEXT,
  verified        BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_developers_user ON app_developers(user_id);
CREATE INDEX IF NOT EXISTS idx_app_developers_status ON app_developers(status);

-- ——— 2. App Categories ———
CREATE TABLE IF NOT EXISTS app_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  icon            TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ——— 3. Marketplace Apps ———
CREATE TABLE IF NOT EXISTS marketplace_apps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES app_developers(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  type            TEXT DEFAULT 'public'
                    CHECK (type IN ('public', 'private', 'internal')),
  status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft', 'in_review', 'published', 'suspended', 'rejected')),

  -- Media
  icon_url        TEXT,
  banner_url      TEXT,
  screenshots     TEXT[] DEFAULT '{}',

  -- Pricing
  pricing_model   TEXT DEFAULT 'free'
                    CHECK (pricing_model IN ('free', 'freemium', 'one_time', 'recurring')),
  price_usd       NUMERIC(10,2) DEFAULT 0,
  price_inr       NUMERIC(10,2) DEFAULT 0,

  -- Classification
  category_id     UUID REFERENCES app_categories(id),
  tags            TEXT[] DEFAULT '{}',

  -- Stats (denormalized for performance)
  install_count   INTEGER DEFAULT 0,
  rating_avg      NUMERIC(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,

  -- Compatibility
  supported_site_types TEXT[] DEFAULT '{store,portfolio,resume,landing_page,blog}',

  -- OAuth / API
  oauth_client_id     TEXT,
  oauth_redirect_uris TEXT[] DEFAULT '{}',
  api_scopes          TEXT[] DEFAULT '{}',
  webhook_url         TEXT,

  -- Metadata
  version         TEXT DEFAULT '1.0.0',
  min_platform_version TEXT,
  documentation_url TEXT,
  privacy_policy_url TEXT,
  terms_url       TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_developer ON marketplace_apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_status ON marketplace_apps(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_category ON marketplace_apps(category_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_pricing ON marketplace_apps(pricing_model);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_slug ON marketplace_apps(slug);

-- ——— 4. App Extensions (what the app adds to the platform) ———
CREATE TABLE IF NOT EXISTS app_extensions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('storefront_block', 'admin_link', 'checkout_extension',
                                    'product_action', 'order_action', 'settings_page',
                                    'dashboard_widget', 'api_endpoint')),
  target          TEXT NOT NULL,
  label           TEXT,
  config          JSONB DEFAULT '{}',
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_extensions_app ON app_extensions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_extensions_type ON app_extensions(type);

-- ——— 5. App Installations (per-store) ———
CREATE TABLE IF NOT EXISTS app_installations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  installed_by    UUID NOT NULL REFERENCES users_custom(id),
  status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'uninstalled')),
  scopes_granted  TEXT[] DEFAULT '{}',
  config          JSONB DEFAULT '{}',
  installed_at    TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at  TIMESTAMPTZ,

  UNIQUE(app_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_app_installations_app ON app_installations(app_id);
CREATE INDEX IF NOT EXISTS idx_app_installations_store ON app_installations(store_id);
CREATE INDEX IF NOT EXISTS idx_app_installations_status ON app_installations(status);

-- ——— 6. App Reviews ———
CREATE TABLE IF NOT EXISTS app_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users_custom(id),
  store_id        UUID REFERENCES sites(id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           TEXT,
  body            TEXT,
  helpful_count   INTEGER DEFAULT 0,
  is_verified     BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'published'
                    CHECK (status IN ('published', 'pending', 'rejected', 'flagged')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_reviews_app ON app_reviews(app_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_user ON app_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_rating ON app_reviews(rating);

-- ——— 7. App Webhooks (event subscriptions) ———
CREATE TABLE IF NOT EXISTS app_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(app_id, event)
);

CREATE INDEX IF NOT EXISTS idx_app_webhooks_app ON app_webhooks(app_id);

-- ——— 8. Enable RLS ———
ALTER TABLE app_developers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_apps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_extensions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_webhooks      ENABLE ROW LEVEL SECURITY;

-- ——— 9. RLS Policies ———
-- NOTE: App uses custom auth (not Supabase Auth), so auth.uid() is always null.
-- Using permissive policies; access control is enforced at the application layer.

CREATE POLICY "service_role_app_categories" ON app_categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_app_developers" ON app_developers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_marketplace_apps" ON marketplace_apps
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_app_extensions" ON app_extensions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_app_installations" ON app_installations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_app_reviews" ON app_reviews
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_app_webhooks" ON app_webhooks
  FOR ALL USING (true) WITH CHECK (true);

-- ——— 10. Triggers ———
CREATE TRIGGER update_app_developers_updated_at
  BEFORE UPDATE ON app_developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_marketplace_apps_updated_at
  BEFORE UPDATE ON marketplace_apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_app_reviews_updated_at
  BEFORE UPDATE ON app_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ——— 11. Functions ———

-- Update app rating when a review is added/modified
CREATE OR REPLACE FUNCTION update_app_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_apps SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM app_reviews WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'published'),
    review_count = (SELECT COUNT(*) FROM app_reviews WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'published')
  WHERE id = COALESCE(NEW.app_id, OLD.app_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_app_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON app_reviews
  FOR EACH ROW EXECUTE FUNCTION update_app_rating();

-- Update install count when installation changes
CREATE OR REPLACE FUNCTION update_app_install_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_apps SET
    install_count = (SELECT COUNT(*) FROM app_installations WHERE app_id = COALESCE(NEW.app_id, OLD.app_id) AND status = 'active')
  WHERE id = COALESCE(NEW.app_id, OLD.app_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_install_count_on_change
  AFTER INSERT OR UPDATE OR DELETE ON app_installations
  FOR EACH ROW EXECUTE FUNCTION update_app_install_count();

-- ——— 12. Seed Default Categories ———
INSERT INTO app_categories (name, slug, description, icon, sort_order) VALUES
  ('Analytics',     'analytics',     'Track and analyze your store performance',    '📊', 1),
  ('Marketing',     'marketing',     'Email, social media, and ad management',      '📧', 2),
  ('Sales',         'sales',         'Boost revenue with upsells and cross-sells',  '💰', 3),
  ('Shipping',      'shipping',      'Shipping rates, tracking, and fulfillment',   '📦', 4),
  ('Design',        'design',        'Page builders, widgets, and visual tools',    '🎨', 5),
  ('Customer Service', 'customer-service', 'Live chat, helpdesk, and support tools', '💬', 6),
  ('AI Tools',      'ai-tools',      'AI-powered content, images, and automation',  '🤖', 7),
  ('Inventory',     'inventory',     'Stock management and warehouse tools',        '📋', 8),
  ('Finance',       'finance',       'Accounting, taxes, and invoicing',            '🏦', 9),
  ('Social Proof',  'social-proof',  'Reviews, ratings, and trust badges',          '⭐', 10)
ON CONFLICT (slug) DO NOTHING;
