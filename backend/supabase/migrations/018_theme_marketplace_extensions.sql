-- ================================================================
-- Theme Marketplace Extensions
-- Migration: 018_theme_marketplace_extensions.sql
-- Created: 2026-02-16
-- Description: Extends themes table and adds purchase/review tables
-- ================================================================

-- ——— 1. Extend existing themes table ———
ALTER TABLE themes
  ADD COLUMN IF NOT EXISTS long_description   TEXT,
  ADD COLUMN IF NOT EXISTS industry           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS theme_preset_id    TEXT,
  ADD COLUMN IF NOT EXISTS version            TEXT DEFAULT '1.0.0',

  -- LetBuyy-specific pricing
  ADD COLUMN IF NOT EXISTS letbuyy_pricing_type TEXT DEFAULT 'free'
    CHECK (letbuyy_pricing_type IN ('free', 'one_time', 'subscription')),
  ADD COLUMN IF NOT EXISTS letbuyy_price_usd  NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letbuyy_price_inr  NUMERIC(10,2) DEFAULT 0,

  -- Other platform pricing (for cross-platform themes)
  ADD COLUMN IF NOT EXISTS shopify_price_usd  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS wordpress_price_usd NUMERIC(10,2),

  -- Media
  ADD COLUMN IF NOT EXISTS screenshots        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS demo_url           TEXT,

  -- Customization options
  ADD COLUMN IF NOT EXISTS color_presets      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS font_pairings      JSONB DEFAULT '[]',

  -- Features & compatibility
  ADD COLUMN IF NOT EXISTS features           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_site_types TEXT[] DEFAULT '{store}',
  ADD COLUMN IF NOT EXISTS supported_platforms TEXT[] DEFAULT '{letbuyy}',
  ADD COLUMN IF NOT EXISTS tags               TEXT[] DEFAULT '{}',

  -- Denormalized stats
  ADD COLUMN IF NOT EXISTS rating_avg         NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count       INTEGER DEFAULT 0,

  -- Author details
  ADD COLUMN IF NOT EXISTS author_url         TEXT,
  ADD COLUMN IF NOT EXISTS author_avatar      TEXT,
  ADD COLUMN IF NOT EXISTS author_verified    BOOLEAN DEFAULT false,

  -- Updated timestamp
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- Additional indexes on themes
CREATE INDEX IF NOT EXISTS idx_themes_pricing ON themes(letbuyy_pricing_type);
CREATE INDEX IF NOT EXISTS idx_themes_tags ON themes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_themes_industry ON themes USING GIN(industry);
CREATE INDEX IF NOT EXISTS idx_themes_supported_types ON themes USING GIN(supported_site_types);

-- ——— 2. Theme Purchases ———
CREATE TABLE IF NOT EXISTS theme_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users_custom(id),
  theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  price_paid_usd  NUMERIC(10,2) DEFAULT 0,
  price_paid_inr  NUMERIC(10,2) DEFAULT 0,
  currency        TEXT DEFAULT 'INR',
  payment_id      TEXT,
  payment_method  TEXT,
  status          TEXT DEFAULT 'completed'
                    CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  license_key     TEXT,
  purchased_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_purchases_user ON theme_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_purchases_status ON theme_purchases(status);

-- ——— 3. Theme Reviews ———
CREATE TABLE IF NOT EXISTS theme_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users_custom(id),
  theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           TEXT,
  content         TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'published'
                    CHECK (status IN ('published', 'pending', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_reviews_theme ON theme_reviews(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_reviews_user ON theme_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_reviews_rating ON theme_reviews(rating);

-- ——— 4. Enable RLS ———
ALTER TABLE theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews   ENABLE ROW LEVEL SECURITY;

-- ——— 5. RLS Policies ———

-- Theme Purchases: users manage own purchases
CREATE POLICY "Users view own theme purchases"
  ON theme_purchases FOR SELECT
  USING (true);

CREATE POLICY "Users create theme purchases"
  ON theme_purchases FOR INSERT
  WITH CHECK (true);

-- Theme Reviews: public read published; users manage own
CREATE POLICY "Public can read published theme reviews"
  ON theme_reviews FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users manage own theme reviews"
  ON theme_reviews FOR ALL
  USING (true);

-- ——— 6. Triggers ———
CREATE TRIGGER update_theme_reviews_updated_at
  BEFORE UPDATE ON theme_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update theme rating when review changes
CREATE OR REPLACE FUNCTION update_theme_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE themes SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND status = 'published'),
    review_count = (SELECT COUNT(*) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND status = 'published'),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_theme_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON theme_reviews
  FOR EACH ROW EXECUTE FUNCTION update_theme_rating();

-- Update install count to include purchases
CREATE OR REPLACE FUNCTION update_theme_install_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE themes SET
    install_count = (
      SELECT COUNT(*) FROM store_themes WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id) AND is_active = true
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_theme_install_count_on_change
  AFTER INSERT OR UPDATE OR DELETE ON store_themes
  FOR EACH ROW EXECUTE FUNCTION update_theme_install_count();

-- ——— 7. Seed extended theme data (update existing themes) ———
UPDATE themes SET
  long_description = 'Urban Kicks is a bold, minimal e-commerce theme built for streetwear brands, sneaker shops, and urban fashion labels. Features a full-screen hero with cinematic overlays, 4-column product grid with hover animations, and testimonial carousel.',
  industry = ARRAY['streetwear', 'sneakers', 'fashion'],
  theme_preset_id = 'minimal_modern',
  features = ARRAY['Responsive Layout', 'Dark Mode', 'Product Quick View', 'Mega Menu', 'Wishlist', 'Ajax Cart'],
  supported_site_types = ARRAY['store'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['streetwear', 'minimal', 'modern', 'sneakers'],
  color_presets = '[{"name":"Midnight","primary":"#000000","secondary":"#FFFFFF","accent":"#8B5CF6"},{"name":"Ocean","primary":"#1E3A5F","secondary":"#E0F2FE","accent":"#0EA5E9"}]'::jsonb,
  font_pairings = '[{"heading":"Inter","body":"Inter"},{"heading":"Space Grotesk","body":"Inter"}]'::jsonb,
  updated_at = NOW()
WHERE slug = 'urban-kicks';

UPDATE themes SET
  long_description = 'Aurora features a modern gradient-based design with glassmorphism cards, smooth transitions, and vibrant color palettes. Perfect for tech-forward brands and digital product stores.',
  industry = ARRAY['tech', 'digital', 'saas'],
  theme_preset_id = 'gradient_glass',
  features = ARRAY['Glassmorphism Cards', 'Gradient Backgrounds', 'Smooth Animations', 'Responsive Grid', 'Dark Mode'],
  supported_site_types = ARRAY['store', 'landing_page'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['modern', 'gradient', 'glassmorphism', 'tech'],
  updated_at = NOW()
WHERE slug = 'aurora';

UPDATE themes SET
  long_description = 'Zenith is a clean, professional theme built for businesses that value clarity and precision. Features sharp typography, full-width imagery, and a distraction-free shopping experience.',
  industry = ARRAY['business', 'professional', 'consulting'],
  theme_preset_id = 'clean_professional',
  features = ARRAY['Full-Width Imagery', 'Sharp Typography', 'Minimal Design', 'Fast Loading', 'SEO Optimized'],
  supported_site_types = ARRAY['store', 'portfolio'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['minimal', 'professional', 'clean', 'business'],
  updated_at = NOW()
WHERE slug = 'zenith';

UPDATE themes SET
  long_description = 'Ember is a luxury dark theme crafted for premium brands. Gold accents, rich typography with Playfair Display, and sophisticated animations create an exclusive shopping experience.',
  industry = ARRAY['luxury', 'jewelry', 'watches', 'premium'],
  theme_preset_id = 'luxury_dark',
  features = ARRAY['Dark Mode Native', 'Gold Accents', 'Premium Typography', 'Luxury Animations', 'Video Hero'],
  supported_site_types = ARRAY['store'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['luxury', 'dark', 'premium', 'gold'],
  letbuyy_pricing_type = 'one_time',
  letbuyy_price_usd = 29.00,
  letbuyy_price_inr = 499.00,
  is_premium = true,
  updated_at = NOW()
WHERE slug = 'ember';

UPDATE themes SET
  long_description = 'Blossom is a soft, organic theme designed for eco-friendly brands, artisan shops, and wellness stores. Features pastel palettes, rounded elements, and a warm, inviting aesthetic.',
  industry = ARRAY['organic', 'wellness', 'artisan', 'handmade'],
  theme_preset_id = 'soft_organic',
  features = ARRAY['Pastel Palette', 'Rounded Elements', 'Warm Aesthetic', 'Instagram Feed', 'Blog Integration'],
  supported_site_types = ARRAY['store', 'blog'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['organic', 'pastel', 'soft', 'wellness', 'handmade'],
  updated_at = NOW()
WHERE slug = 'blossom';

UPDATE themes SET
  long_description = 'Nova is a vibrant, high-energy theme perfect for youth brands, gaming stores, and creative businesses. Neon gradients, bold layouts, and dynamic animations make every page pop.',
  industry = ARRAY['gaming', 'youth', 'creative', 'entertainment'],
  theme_preset_id = 'vibrant_neon',
  features = ARRAY['Neon Gradients', 'Bold Typography', 'Dynamic Animations', 'Parallax Scrolling', 'Video Backgrounds'],
  supported_site_types = ARRAY['store', 'landing_page'],
  supported_platforms = ARRAY['letbuyy'],
  tags = ARRAY['vibrant', 'neon', 'gaming', 'youth', 'bold'],
  updated_at = NOW()
WHERE slug = 'nova';
