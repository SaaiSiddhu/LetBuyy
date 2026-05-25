-- ============================================
-- LETBUYY SCHEMA ALIGNMENT
-- Migration: 003_align_schema
-- Adds missing tables from IMPLEMENTATION_PLAN.md
-- ============================================

-- ============================================
-- USER PROFILES (links to auth.users)
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'starter', 'business', 'enterprise')),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'business', 'enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    payment_gateway TEXT CHECK (payment_gateway IN ('stripe', 'razorpay')),
    external_subscription_id TEXT,
    stores_limit INTEGER DEFAULT 1,
    products_limit INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ============================================
-- ORDER ITEMS (normalized from orders.items JSONB)
-- ============================================

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- CUSTOM PAGES (all site types)
-- ============================================

CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content JSONB,
    html_content TEXT,
    is_homepage BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    seo_title TEXT,
    seo_description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

CREATE INDEX idx_pages_site ON pages(site_id);

-- ============================================
-- SHIPPING ZONES & RATES
-- ============================================

CREATE TABLE IF NOT EXISTS shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    countries TEXT[] DEFAULT '{}',
    states TEXT[] DEFAULT '{}',
    is_rest_of_world BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('flat', 'weight_based', 'price_based', 'free')),
    price DECIMAL(10,2) DEFAULT 0,
    min_weight DECIMAL(10,2),
    max_weight DECIMAL(10,2),
    min_order_amount DECIMAL(10,2),
    estimated_days_min INTEGER,
    estimated_days_max INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMPLOYEE INVITES
-- ============================================

CREATE TABLE IF NOT EXISTS employee_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('support', 'sales', 'marketing', 'operations', 'manager', 'admin')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_invites_token ON employee_invites(token);
CREATE INDEX idx_employee_invites_email ON employee_invites(email);

-- ============================================
-- ANALYTICS EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_view', 'product_view', 'add_to_cart',
        'begin_checkout', 'purchase', 'contact_submit',
        'resume_download', 'project_view'
    )),
    visitor_id TEXT,
    session_id TEXT,
    page_path TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    device_type TEXT,
    country TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_site ON analytics_events(site_id, created_at DESC);
CREATE INDEX idx_analytics_type ON analytics_events(event_type, created_at DESC);

-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_new_order BOOLEAN DEFAULT true,
    email_low_stock BOOLEAN DEFAULT true,
    email_new_contact BOOLEAN DEFAULT true,
    email_resume_download BOOLEAN DEFAULT true,
    push_new_order BOOLEAN DEFAULT true,
    push_low_stock BOOLEAN DEFAULT true,
    push_new_contact BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FCM DEVICE TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('android', 'ios', 'web', 'macos', 'windows')),
    device_name TEXT,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- ============================================
-- RLS FOR NEW TABLES
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- User profiles
CREATE POLICY "users_own_profile" ON user_profiles
    FOR ALL USING (id = auth.uid());

-- Subscriptions
CREATE POLICY "users_own_subscription" ON subscriptions
    FOR ALL USING (user_id = auth.uid());

-- Order items follow parent order access
CREATE POLICY "site_owner_order_items" ON order_items
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE site_id IN (
                SELECT id FROM sites WHERE user_id = auth.uid()
            )
        )
    );

-- Pages
CREATE POLICY "site_owner_pages" ON pages
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

CREATE POLICY "public_read_published_pages" ON pages
    FOR SELECT USING (
        status = 'published' AND
        site_id IN (SELECT id FROM sites WHERE status = 'published')
    );

-- Shipping
CREATE POLICY "site_owner_shipping_zones" ON shipping_zones
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

CREATE POLICY "public_read_shipping_zones" ON shipping_zones
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

CREATE POLICY "site_owner_shipping_rates" ON shipping_rates
    FOR ALL USING (
        zone_id IN (
            SELECT id FROM shipping_zones WHERE site_id IN (
                SELECT id FROM sites WHERE user_id = auth.uid()
            )
        )
    );

-- Employee invites (super admin only)
CREATE POLICY "super_admin_invites" ON employee_invites
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Analytics events: site owner can read, anyone can insert (for tracking)
CREATE POLICY "site_owner_analytics" ON analytics_events
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

CREATE POLICY "public_insert_analytics" ON analytics_events
    FOR INSERT WITH CHECK (TRUE);

-- Notification preferences
CREATE POLICY "users_own_notifications" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Device tokens
CREATE POLICY "users_own_devices" ON device_tokens
    FOR ALL USING (user_id = auth.uid());

-- ============================================
-- TRIGGERS FOR NEW TABLES
-- ============================================

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit triggers for sensitive tables
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_employee_invites AFTER INSERT OR UPDATE OR DELETE ON employee_invites
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
