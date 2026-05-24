-- ============================================
-- LETBUYY SCHEMA FIX — Migration 008
-- Fix site_type check constraints, add missing
-- columns to sites, update stores view & triggers
-- ============================================

-- ============================================
-- 1. FIX sites.site_type CHECK CONSTRAINT
-- Old: ('ecommerce','portfolio','resume','landing_page')
-- New: ('store','portfolio','resume','landing','blog')
-- ============================================

-- Drop old constraint FIRST (existing rows may already have new values)
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_site_type_check;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS stores_site_type_check;

-- Update existing data to new values
UPDATE sites SET site_type = 'store' WHERE site_type = 'ecommerce';
UPDATE sites SET site_type = 'landing' WHERE site_type = 'landing_page';

-- Add new constraint
ALTER TABLE sites ADD CONSTRAINT sites_site_type_check
    CHECK (site_type IN ('store', 'portfolio', 'resume', 'landing', 'blog'));


-- ============================================
-- 2. FIX sites.status CHECK CONSTRAINT
-- Add 'published', 'unpublished', 'frozen'
-- ============================================

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS stores_status_check;

ALTER TABLE sites ADD CONSTRAINT sites_status_check
    CHECK (status IN ('draft', 'published', 'unpublished', 'frozen', 'suspended'));


-- ============================================
-- 3. ADD MISSING COLUMNS TO sites TABLE
-- Based on docs/08_Database_Schema.md stores spec
-- ============================================

-- Trial columns
ALTER TABLE sites ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sites ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');
ALTER TABLE sites ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'active';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- Add check for trial_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sites_trial_status_check'
    ) THEN
        ALTER TABLE sites ADD CONSTRAINT sites_trial_status_check
            CHECK (trial_status IN ('active', 'grace', 'frozen', 'cancelled', 'paid'));
    END IF;
END $$;

-- Branding columns
ALTER TABLE sites ADD COLUMN IF NOT EXISTS og_image_url TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6366f1';

-- Domain columns
ALTER TABLE sites ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'pending';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sites_ssl_status_check'
    ) THEN
        ALTER TABLE sites ADD CONSTRAINT sites_ssl_status_check
            CHECK (ssl_status IN ('pending', 'active', 'failed'));
    END IF;
END $$;

-- Currency & locale
ALTER TABLE sites ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en-IN';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT true;

-- AI & theme
ALTER TABLE sites ADD COLUMN IF NOT EXISTS industry TEXT;

-- Counters (denormalized)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0;

-- Description (ensure exists)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS description TEXT;


-- ============================================
-- 4. FIX onboarding_attempts.site_type CONSTRAINT
-- ============================================

ALTER TABLE onboarding_attempts DROP CONSTRAINT IF EXISTS onboarding_attempts_site_type_check;

-- Update existing data to new values
UPDATE onboarding_attempts SET site_type = 'store' WHERE site_type = 'ecommerce';
UPDATE onboarding_attempts SET site_type = 'landing' WHERE site_type = 'landing_page';

ALTER TABLE onboarding_attempts ADD CONSTRAINT onboarding_attempts_site_type_check
    CHECK (site_type IN ('store', 'portfolio', 'resume', 'landing', 'blog'));


-- ============================================
-- 5. UPDATE stores VIEW
-- Drop and recreate with new columns
-- ============================================

DROP TRIGGER IF EXISTS stores_insert_trigger ON stores;
DROP TRIGGER IF EXISTS stores_update_trigger ON stores;
DROP TRIGGER IF EXISTS stores_delete_trigger ON stores;
DROP VIEW IF EXISTS stores;

CREATE OR REPLACE VIEW stores AS
SELECT
    id,
    user_id,
    custom_user_id,
    name,
    store_name,
    tagline,
    logo_url,
    favicon_url,
    site_type,
    subdomain,
    custom_domain,
    theme_id,
    theme_settings,
    template_config,
    sections,
    status,
    published_at,
    views_count,
    -- New columns
    trial_started_at,
    trial_ends_at,
    trial_status,
    frozen_at,
    og_image_url,
    brand_color,
    domain_verified,
    ssl_status,
    currency,
    locale,
    tax_inclusive,
    industry,
    product_count,
    order_count,
    page_count,
    description,
    -- Timestamps
    created_at,
    updated_at,
    -- Aliases the admin app expects
    name AS display_name
FROM sites;


-- ============================================
-- 6. RECREATE INSTEAD OF TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION stores_insert_fn()
RETURNS TRIGGER AS $$
DECLARE
    inserted_row sites%ROWTYPE;
BEGIN
    INSERT INTO sites (
        user_id, custom_user_id, name, store_name, tagline, logo_url, favicon_url,
        site_type, subdomain, custom_domain, theme_id, theme_settings,
        template_config, sections, status, description, brand_color,
        currency, locale, industry
    ) VALUES (
        NEW.user_id,
        NEW.custom_user_id,
        COALESCE(NEW.name, NEW.display_name, NEW.store_name),
        COALESCE(NEW.store_name, NEW.subdomain),
        NEW.tagline,
        NEW.logo_url,
        NEW.favicon_url,
        COALESCE(NEW.site_type, 'store'),
        COALESCE(NEW.subdomain, NEW.store_name),
        NEW.custom_domain,
        COALESCE(NEW.theme_id, 'modern'),
        COALESCE(NEW.theme_settings, '{}'),
        COALESCE(NEW.template_config, '{}'),
        COALESCE(NEW.sections, '[]'),
        COALESCE(NEW.status, 'draft'),
        NEW.description,
        COALESCE(NEW.brand_color, '#6366f1'),
        COALESCE(NEW.currency, 'INR'),
        COALESCE(NEW.locale, 'en-IN'),
        NEW.industry
    )
    RETURNING * INTO inserted_row;

    -- Map sites columns back to the view's NEW record
    NEW.id := inserted_row.id;
    NEW.subdomain := inserted_row.subdomain;
    NEW.status := inserted_row.status;
    NEW.trial_started_at := inserted_row.trial_started_at;
    NEW.trial_ends_at := inserted_row.trial_ends_at;
    NEW.trial_status := inserted_row.trial_status;
    NEW.created_at := inserted_row.created_at;
    NEW.updated_at := inserted_row.updated_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION stores_update_fn()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sites SET
        name = COALESCE(NEW.name, NEW.display_name, OLD.name),
        store_name = COALESCE(NEW.store_name, OLD.store_name),
        tagline = COALESCE(NEW.tagline, OLD.tagline),
        logo_url = COALESCE(NEW.logo_url, OLD.logo_url),
        favicon_url = COALESCE(NEW.favicon_url, OLD.favicon_url),
        site_type = COALESCE(NEW.site_type, OLD.site_type),
        subdomain = COALESCE(NEW.subdomain, OLD.subdomain),
        custom_domain = NEW.custom_domain,
        theme_id = COALESCE(NEW.theme_id, OLD.theme_id),
        theme_settings = COALESCE(NEW.theme_settings, OLD.theme_settings),
        status = COALESCE(NEW.status, OLD.status),
        description = COALESCE(NEW.description, OLD.description),
        brand_color = COALESCE(NEW.brand_color, OLD.brand_color),
        industry = COALESCE(NEW.industry, OLD.industry),
        trial_status = COALESCE(NEW.trial_status, OLD.trial_status),
        frozen_at = NEW.frozen_at,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION stores_delete_fn()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM sites WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
CREATE TRIGGER stores_insert_trigger
    INSTEAD OF INSERT ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_insert_fn();

CREATE TRIGGER stores_update_trigger
    INSTEAD OF UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_update_fn();

CREATE TRIGGER stores_delete_trigger
    INSTEAD OF DELETE ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_delete_fn();


-- ============================================
-- 7. CREATE store_surveys TABLE (if missing)
-- ============================================

CREATE TABLE IF NOT EXISTS store_surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL UNIQUE,
    industry TEXT,
    target_audience TEXT,
    business_goal TEXT,
    brand_tone TEXT,
    team_size TEXT,
    revenue_range TEXT,
    additional_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE store_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_store_surveys" ON store_surveys;
CREATE POLICY "service_role_store_surveys" ON store_surveys
    FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- 8. ADD INDEXES for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sites_trial_status ON sites(trial_status);
CREATE INDEX IF NOT EXISTS idx_sites_trial_ends ON sites(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_sites_site_type ON sites(site_type);
