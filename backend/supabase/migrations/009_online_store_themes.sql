-- =============================================
-- Online Store: Themes & Store Themes
-- Migration: 20250215_online_store_themes.sql
-- =============================================

-- 1. Create themes table (platform‑wide catalog)
CREATE TABLE IF NOT EXISTS themes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  site_type       TEXT NOT NULL DEFAULT 'store',
  category        TEXT,
  description     TEXT,

  -- Preview
  preview_url     TEXT,
  thumbnail_url   TEXT,

  -- Pricing
  is_premium      BOOLEAN DEFAULT false,
  price           NUMERIC(10,2) DEFAULT 0,

  -- Configuration (colors, fonts, layout)
  config          JSONB DEFAULT '{
    "colors": {
      "primary": "#6366f1",
      "secondary": "#8b5cf6",
      "background": "#ffffff",
      "text": "#1f2937",
      "accent": "#f59e0b"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter"
    },
    "layout": {
      "headerStyle": "sticky",
      "footerStyle": "standard",
      "maxWidth": 1280
    },
    "darkMode": false
  }',

  -- Metadata
  author          TEXT DEFAULT 'LetBuyy',
  version         TEXT DEFAULT '1.0',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  install_count   INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(site_type, is_active);
CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category);

-- 2. Create store_themes table (per‑store installed themes)
CREATE TABLE IF NOT EXISTS store_themes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  is_active       BOOLEAN DEFAULT true,
  config_overrides JSONB DEFAULT '{}',
  installed_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_store_themes_store ON store_themes(store_id, is_active);

-- 3. Enable RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_themes ENABLE ROW LEVEL SECURITY;

-- Themes are readable by everyone (public catalog)
CREATE POLICY "Themes are viewable by everyone"
  ON themes FOR SELECT
  USING (true);

-- Store themes: store owners can read/write
CREATE POLICY "Store owners can view their themes"
  ON store_themes FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can install themes"
  ON store_themes FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can update their themes"
  ON store_themes FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can uninstall themes"
  ON store_themes FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- 4. Seed default free themes
INSERT INTO themes (name, slug, site_type, category, description, config, author, sort_order) VALUES
(
  'Urban Kicks',
  'urban-kicks',
  'store',
  'modern',
  'Bold, streetwear-inspired theme with vibrant gradients and dynamic layouts.',
  '{
    "colors": {"primary": "#8B5CF6", "secondary": "#3B82F6", "background": "#ffffff", "text": "#1f2937", "accent": "#F59E0B"},
    "fonts": {"heading": "Inter", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": false
  }',
  'LetBuyy',
  1
),
(
  'Aurora',
  'aurora',
  'store',
  'modern',
  'Modern, gradient-based with glassmorphism cards and smooth transitions.',
  '{
    "colors": {"primary": "#6366F1", "secondary": "#EC4899", "background": "#ffffff", "text": "#1f2937", "accent": "#8B5CF6"},
    "fonts": {"heading": "Inter", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": false
  }',
  'LetBuyy',
  2
),
(
  'Zenith',
  'zenith',
  'store',
  'minimal',
  'Clean, professional theme with full-width imagery and sharp typography.',
  '{
    "colors": {"primary": "#0F172A", "secondary": "#64748B", "background": "#ffffff", "text": "#0F172A", "accent": "#3B82F6"},
    "fonts": {"heading": "Inter", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": false
  }',
  'LetBuyy',
  3
),
(
  'Ember',
  'ember',
  'store',
  'luxury',
  'Luxury dark theme with gold accents and premium feel.',
  '{
    "colors": {"primary": "#1C1917", "secondary": "#D97706", "background": "#0C0A09", "text": "#FAFAF9", "accent": "#D97706"},
    "fonts": {"heading": "Playfair Display", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": true
  }',
  'LetBuyy',
  4
),
(
  'Blossom',
  'blossom',
  'store',
  'organic',
  'Soft, organic theme with pastel palette and rounded elements.',
  '{
    "colors": {"primary": "#FDF2F8", "secondary": "#F9A8D4", "background": "#FFFBEB", "text": "#1f2937", "accent": "#EC4899"},
    "fonts": {"heading": "Outfit", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": false
  }',
  'LetBuyy',
  5
),
(
  'Nova',
  'nova',
  'store',
  'vibrant',
  'Vibrant, energetic theme with neon gradients and bold layouts.',
  '{
    "colors": {"primary": "#7C3AED", "secondary": "#06B6D4", "background": "#ffffff", "text": "#1f2937", "accent": "#F59E0B"},
    "fonts": {"heading": "Inter", "body": "Inter"},
    "layout": {"headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280},
    "darkMode": false
  }',
  'LetBuyy',
  6
)
ON CONFLICT (slug) DO NOTHING;
