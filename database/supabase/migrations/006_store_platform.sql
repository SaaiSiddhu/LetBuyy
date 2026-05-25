-- ============================================
-- LETBUYY STORE PLATFORM
-- Migration: 006_store_platform
-- Adds: stores view, email_logs, onboarding_attempts,
--        subdomain validation, service-role RLS
-- ============================================

-- ============================================
-- 0. PREREQUISITE TABLES (safe re-creation)
-- These should exist from earlier migrations but
-- we use IF NOT EXISTS to be resilient.
-- ============================================

-- Users custom table (from 005_auth_system.sql)
CREATE TABLE IF NOT EXISTS users_custom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table (from 001_initial_schema.sql)
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    store_name TEXT UNIQUE NOT NULL,
    tagline TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    site_type TEXT NOT NULL DEFAULT 'ecommerce' CHECK (site_type IN ('ecommerce', 'portfolio', 'resume', 'landing_page')),
    subdomain TEXT UNIQUE NOT NULL,
    custom_domain TEXT,
    theme_id TEXT DEFAULT 'modern',
    theme_settings JSONB DEFAULT '{}',
    template_config JSONB DEFAULT '{}',
    sections JSONB DEFAULT '[]',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
    published_at TIMESTAMPTZ,
    views_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Products table (referenced later for RLS)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    sku TEXT,
    barcode TEXT,
    quantity INT DEFAULT 0,
    track_inventory BOOLEAN DEFAULT true,
    images JSONB DEFAULT '[]',
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Orders table (referenced later for RLS)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    customer_email TEXT,
    customer_name TEXT,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    shipping DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    items JSONB DEFAULT '[]',
    shipping_address JSONB DEFAULT '{}',
    billing_address JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Pages table (referenced later for RLS)
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Sessions table (from 005_auth_system.sql)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    device_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table (from 005_auth_system.sql)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    user_agent TEXT,
    trusted BOOLEAN DEFAULT false,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 1a. LINK users_custom TO sites
-- Add custom_user_id before creating the view
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sites' AND column_name = 'custom_user_id'
    ) THEN
        ALTER TABLE sites ADD COLUMN custom_user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_sites_custom_user ON sites(custom_user_id);
    END IF;
END $$;

-- ============================================
-- 1b. STORES VIEW (alias for sites table)
-- The frontend apps use 'stores' but the DB table
-- is 'sites'. This updatable view bridges the gap.
-- ============================================

-- Drop existing 'stores' if it exists as a TABLE
-- (older schema had a physical stores table — we replace it with a view)
DROP TABLE IF EXISTS stores CASCADE;
-- Also drop if it exists as a view (for re-runs)
DROP VIEW IF EXISTS stores CASCADE;

-- Create an updatable view so apps can INSERT/UPDATE/DELETE
-- through the 'stores' name while data lives in 'sites'
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
    created_at,
    updated_at,
    -- Aliases the admin app expects
    name AS display_name,
    tagline AS description,
    'INR' AS currency,
    NULL::TEXT AS language
FROM sites;

-- Make the view insertable/updatable with INSTEAD OF triggers
CREATE OR REPLACE FUNCTION stores_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sites (
        user_id, custom_user_id, name, store_name, tagline, logo_url, favicon_url,
        site_type, subdomain, custom_domain, theme_id, theme_settings,
        template_config, sections, status
    ) VALUES (
        NEW.user_id,
        NEW.custom_user_id,
        COALESCE(NEW.name, NEW.display_name, NEW.store_name),
        NEW.store_name,
        COALESCE(NEW.tagline, NEW.description),
        NEW.logo_url,
        NEW.favicon_url,
        NEW.site_type,
        COALESCE(NEW.subdomain, NEW.store_name),
        NEW.custom_domain,
        COALESCE(NEW.theme_id, 'modern'),
        COALESCE(NEW.theme_settings, '{}'),
        COALESCE(NEW.template_config, '{}'),
        COALESCE(NEW.sections, '[]'),
        COALESCE(NEW.status, 'draft')
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION stores_update_fn()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sites SET
        name = COALESCE(NEW.name, NEW.display_name, OLD.name),
        store_name = COALESCE(NEW.store_name, OLD.store_name),
        tagline = COALESCE(NEW.tagline, NEW.description, OLD.tagline),
        logo_url = COALESCE(NEW.logo_url, OLD.logo_url),
        favicon_url = COALESCE(NEW.favicon_url, OLD.favicon_url),
        site_type = COALESCE(NEW.site_type, OLD.site_type),
        subdomain = COALESCE(NEW.subdomain, OLD.subdomain),
        custom_domain = NEW.custom_domain,
        theme_id = COALESCE(NEW.theme_id, OLD.theme_id),
        theme_settings = COALESCE(NEW.theme_settings, OLD.theme_settings),
        status = COALESCE(NEW.status, OLD.status)
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

DROP TRIGGER IF EXISTS stores_insert_trigger ON stores;
CREATE TRIGGER stores_insert_trigger
    INSTEAD OF INSERT ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_insert_fn();

DROP TRIGGER IF EXISTS stores_update_trigger ON stores;
CREATE TRIGGER stores_update_trigger
    INSTEAD OF UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_update_fn();

DROP TRIGGER IF EXISTS stores_delete_trigger ON stores;
CREATE TRIGGER stores_delete_trigger
    INSTEAD OF DELETE ON stores
    FOR EACH ROW EXECUTE FUNCTION stores_delete_fn();


-- ============================================
-- 2. EMAIL LOGS
-- Track all transactional emails sent by the platform
-- ============================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'verification', 'magic_link', 'password_reset',
        'store_created_success', 'store_created_failure',
        'welcome', 'order_confirmation', 'order_shipped',
        'low_stock_alert', 'subscription_renewal'
    )),
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    provider_message_id TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes use service role key)
DROP POLICY IF EXISTS "service_role_email_logs" ON email_logs;
CREATE POLICY "service_role_email_logs" ON email_logs
    FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- 3. ONBOARDING ATTEMPTS
-- Track store creation attempts for analytics
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE,
    requested_name TEXT NOT NULL,
    requested_subdomain TEXT NOT NULL,
    site_type TEXT NOT NULL CHECK (site_type IN ('ecommerce', 'portfolio', 'resume', 'landing_page')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    failure_reason TEXT,
    error_details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_attempts(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_created ON onboarding_attempts(created_at DESC);

ALTER TABLE onboarding_attempts ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "service_role_onboarding" ON onboarding_attempts;
CREATE POLICY "service_role_onboarding" ON onboarding_attempts
    FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- 4. SUBDOMAIN VALIDATION FUNCTION
-- Server-side validation with reserved words
-- ============================================

CREATE OR REPLACE FUNCTION validate_subdomain(subdomain_input TEXT)
RETURNS JSONB AS $$
DECLARE
    reserved_words TEXT[] := ARRAY[
        'accounts', 'admin', 'console', 'team', 'api', 'webhooks',
        'www', 'mail', 'ftp', 'localhost', 'letbuyy',
        'seller', 'buyer', 'customer', 'support', 'help', 'contact',
        'about', 'terms', 'privacy', 'policy', 'faq', 'blog', 'press',
        'careers', 'investors', 'partners', 'affiliates', 'legal',
        'store', 'stores', 'shop', 'app', 'dashboard', 'billing',
        'auth', 'login', 'signup', 'register', 'onboarding',
        'static', 'assets', 'cdn', 'media', 'images', 'files',
        'null', 'undefined', 'test', 'demo', 'example', 'staging'
    ];
    existing_count INTEGER;
BEGIN
    -- Check minimum length
    IF LENGTH(subdomain_input) < 4 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'too_short',
            'message', 'Subdomain must be at least 4 characters'
        );
    END IF;

    -- Check maximum length
    IF LENGTH(subdomain_input) > 63 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'too_long',
            'message', 'Subdomain must be at most 63 characters'
        );
    END IF;

    -- Check format (a-z, 0-9, hyphen, must start/end with alphanumeric)
    IF subdomain_input !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
       AND subdomain_input !~ '^[a-z0-9]{4,}$' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'invalid_format',
            'message', 'Only lowercase letters, numbers, and hyphens allowed. Must start and end with a letter or number.'
        );
    END IF;

    -- Check double hyphens
    IF subdomain_input LIKE '%--%' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'double_hyphen',
            'message', 'Subdomain cannot contain consecutive hyphens'
        );
    END IF;

    -- Check reserved words
    IF subdomain_input = ANY(reserved_words) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'reserved',
            'message', 'This subdomain is reserved and cannot be used'
        );
    END IF;

    -- Check uniqueness
    SELECT COUNT(*) INTO existing_count
    FROM sites
    WHERE subdomain = subdomain_input OR store_name = subdomain_input;

    IF existing_count > 0 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'taken',
            'message', 'This subdomain is already in use'
        );
    END IF;

    -- All checks passed
    RETURN jsonb_build_object(
        'valid', true,
        'reason', 'available',
        'message', 'Subdomain is available'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 5. SERVICE ROLE RLS FOR SITES (custom auth)
-- The custom auth system uses service_role key,
-- so we need permissive policies for sites access
-- from API routes.
-- ============================================

-- Add service role policy for sites (in addition to auth.uid() policies)
DROP POLICY IF EXISTS "service_role_sites" ON sites;
CREATE POLICY "service_role_sites" ON sites
    FOR ALL USING (true) WITH CHECK (true);

-- Add service role policies for products, orders (admin app uses service role)
DROP POLICY IF EXISTS "service_role_products" ON products;
CREATE POLICY "service_role_products" ON products
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_orders" ON orders;
CREATE POLICY "service_role_orders" ON orders
    FOR ALL USING (true) WITH CHECK (true);

-- Pages
DROP POLICY IF EXISTS "service_role_pages" ON pages;
CREATE POLICY "service_role_pages" ON pages
    FOR ALL USING (true) WITH CHECK (true);


-- (custom_user_id already added above in section 1a)

-- (stores view and insert trigger already defined above with custom_user_id)
