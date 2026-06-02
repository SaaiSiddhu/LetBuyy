-- ============================================
-- LETBUYY PLANS & SUBSCRIPTIONS
-- Migration: 011_plans_table
-- Creates plans table with seed data,
-- updates subscriptions for per-site billing
-- ============================================

-- ============================================
-- 1. PLANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    site_type TEXT NOT NULL,
    slug TEXT NOT NULL,                    -- 'free', 'starter', 'business', 'enterprise'
    name TEXT NOT NULL,                    -- 'Starter', 'Business', 'Enterprise'
    tagline TEXT,                          -- Short description
    is_popular BOOLEAN DEFAULT false,
    
    -- Pricing (stored in paise for INR, cents for USD)
    price_monthly_inr INTEGER NOT NULL DEFAULT 0,    -- 99900 = ₹999
    price_yearly_inr INTEGER DEFAULT 0,              -- per month billed annually
    price_monthly_usd INTEGER DEFAULT 0,             -- 1200 = $12
    price_yearly_usd INTEGER DEFAULT 0,              -- per month billed annually
    
    -- Transaction fee (store plans only)
    gmv_percentage DECIMAL(4,2) DEFAULT 0,           -- 2.0 = 2% GMV fee
    setup_fee_inr INTEGER DEFAULT 0,                 -- one-time setup fee in paise
    
    -- Promotional pricing
    promo_price_inr INTEGER DEFAULT 0,               -- paise (7900 = ₹79)
    promo_months INTEGER DEFAULT 0,                  -- first N months
    promo_label TEXT,                                 -- 'Get 3 months for ₹79/month'
    
    -- Limits
    products_limit INTEGER,           -- null = unlimited
    orders_limit INTEGER,             -- null = unlimited, per month
    pages_limit INTEGER,              -- portfolio/blog pages
    storage_mb INTEGER DEFAULT 100,   -- in MB
    staff_limit INTEGER DEFAULT 1,
    ai_credits_monthly INTEGER DEFAULT 10,
    
    -- Features (structured JSON)
    features JSONB DEFAULT '[]',
    
    -- Compare table config
    compare_features JSONB DEFAULT '[]',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    requires_contact BOOLEAN DEFAULT false,
    trial_days INTEGER DEFAULT 7,
    
    -- Branding
    custom_domain BOOLEAN DEFAULT false,
    branding_removable BOOLEAN DEFAULT false,
    support_level TEXT DEFAULT 'community',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(site_type, slug)
);

CREATE INDEX idx_plans_site_type ON plans(site_type);
CREATE INDEX idx_plans_active ON plans(is_active) WHERE is_active = true;

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: Plans are publicly readable
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_plans" ON plans FOR SELECT USING (true);
CREATE POLICY "super_admin_manage_plans" ON plans FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
);


-- ============================================
-- 2. UPDATE SUBSCRIPTIONS TABLE
-- ============================================

-- Add store-level subscription support
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_paid INTEGER DEFAULT 0;  -- paise
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);


-- ============================================
-- 3. BILLING HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Invoice
    invoice_number TEXT NOT NULL,
    description TEXT NOT NULL,        -- 'Starter plan - Monthly'
    
    -- Amount (paise)
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    tax_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL,
    
    -- Payment
    payment_gateway TEXT,
    payment_id TEXT,                   -- Razorpay payment ID
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Period
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    -- PDF
    invoice_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_history_user ON billing_history(user_id);
CREATE INDEX idx_billing_history_store ON billing_history(store_id);

ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_billing" ON billing_history
    FOR ALL USING (user_id = auth.uid());


-- ============================================
-- 4. SEED DATA — STORE PLANS
-- ============================================

INSERT INTO plans (site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr, price_monthly_usd, price_yearly_usd,
    gmv_percentage, promo_price_inr, promo_months, promo_label,
    products_limit, orders_limit, storage_mb, staff_limit, ai_credits_monthly,
    custom_domain, branding_removable, support_level,
    display_order, requires_contact, trial_days, features) VALUES

-- Store: Starter
('store', 'starter', 'Starter', 'For solo entrepreneurs launching their first store', true,
    99900, 79900, 1200, 1000,
    2.0, 7900, 3, 'Get 3 months for ₹79/month',
    100, 250, 2048, 1, 30,
    true, false, 'email_48h',
    1, false, 7,
    '[
        {"label": "100 products", "icon": "inventory_2"},
        {"label": "250 orders/month", "icon": "shopping_bag"},
        {"label": "2 GB storage", "icon": "cloud"},
        {"label": "30 AI credits/month", "icon": "auto_awesome"},
        {"label": "Custom domain", "icon": "language"},
        {"label": "Razorpay + Stripe", "icon": "payments"},
        {"label": "Email support (48h)", "icon": "support_agent"},
        {"label": "5 free themes", "icon": "palette"}
    ]'::jsonb),

-- Store: Business
('store', 'business', 'Business', 'For growing businesses that need advanced features', false,
    299900, 224900, 3600, 2700,
    1.2, 7900, 3, 'Get 3 months for ₹79/month',
    1000, 2500, 10240, 3, 100,
    true, true, 'email_24h',
    2, false, 7,
    '[
        {"label": "1,000 products", "icon": "inventory_2"},
        {"label": "2,500 orders/month", "icon": "shopping_bag"},
        {"label": "10 GB storage", "icon": "cloud"},
        {"label": "100 AI credits/month", "icon": "auto_awesome"},
        {"label": "3 staff accounts", "icon": "group"},
        {"label": "Priority support (24h)", "icon": "support_agent"},
        {"label": "All free themes", "icon": "palette"},
        {"label": "Abandoned cart recovery", "icon": "shopping_cart"},
        {"label": "Multi-currency (5)", "icon": "currency_exchange"},
        {"label": "Custom CSS", "icon": "code"}
    ]'::jsonb),

-- Store: Enterprise
('store', 'enterprise', 'Enterprise', 'For high-volume brands scaling to millions', false,
    1499900, 1049900, 17900, 12500,
    0.8, 0, 0, NULL,
    NULL, NULL, 51200, NULL, 500,
    true, true, 'dedicated_phone',
    3, true, 7,
    '[
        {"label": "Unlimited products", "icon": "inventory_2"},
        {"label": "Unlimited orders", "icon": "shopping_bag"},
        {"label": "50 GB storage", "icon": "cloud"},
        {"label": "500 AI credits/month", "icon": "auto_awesome"},
        {"label": "Unlimited staff", "icon": "group"},
        {"label": "Dedicated support + phone", "icon": "support_agent"},
        {"label": "All themes + custom", "icon": "palette"},
        {"label": "White-label branding", "icon": "verified"},
        {"label": "Multi-currency (135+)", "icon": "currency_exchange"},
        {"label": "Full API + Webhooks", "icon": "api"},
        {"label": "Done-for-you onboarding", "icon": "rocket_launch"}
    ]'::jsonb)

ON CONFLICT (site_type, slug) DO NOTHING;


-- ============================================
-- 5. SEED DATA — PORTFOLIO PLANS
-- ============================================

INSERT INTO plans (site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr, price_monthly_usd, price_yearly_usd,
    pages_limit, storage_mb, ai_credits_monthly,
    custom_domain, branding_removable, support_level,
    display_order, requires_contact, trial_days, features) VALUES

-- Portfolio: Starter
('portfolio', 'starter', 'Starter', 'Showcase your best work with a single portfolio page', true,
    34900, 23300, 400, 340,
    1, 512, 15,
    true, false, 'email_48h',
    1, false, 7,
    '[
        {"label": "1 portfolio page", "icon": "web"},
        {"label": "512 MB storage", "icon": "cloud"},
        {"label": "15 AI credits/month", "icon": "auto_awesome"},
        {"label": "Custom domain", "icon": "language"},
        {"label": "Contact form", "icon": "mail"},
        {"label": "Analytics (basic)", "icon": "analytics"}
    ]'::jsonb),

-- Portfolio: Pro
('portfolio', 'pro', 'Pro', 'Multiple portfolios for creative professionals', false,
    99900, 66600, 1200, 960,
    5, 2048, 50,
    true, true, 'email_24h',
    2, false, 7,
    '[
        {"label": "5 portfolio pages", "icon": "web"},
        {"label": "2 GB storage", "icon": "cloud"},
        {"label": "50 AI credits/month", "icon": "auto_awesome"},
        {"label": "Custom CSS", "icon": "code"},
        {"label": "Password protection", "icon": "lock"},
        {"label": "Advanced analytics", "icon": "analytics"},
        {"label": "Priority support (24h)", "icon": "support_agent"}
    ]'::jsonb),

-- Portfolio: Agency
('portfolio', 'agency', 'Agency', 'Unlimited portfolios for agencies and studios', false,
    299900, 199900, 3600, 2880,
    NULL, 10240, 150,
    true, true, 'dedicated',
    3, false, 7,
    '[
        {"label": "Unlimited pages", "icon": "web"},
        {"label": "10 GB storage", "icon": "cloud"},
        {"label": "150 AI credits/month", "icon": "auto_awesome"},
        {"label": "Team collaboration", "icon": "group"},
        {"label": "Client portals", "icon": "meeting_room"},
        {"label": "White-label", "icon": "verified"},
        {"label": "Dedicated support", "icon": "support_agent"}
    ]'::jsonb)

ON CONFLICT (site_type, slug) DO NOTHING;


-- ============================================
-- 6. SEED DATA — LANDING PAGE PLANS
-- ============================================

INSERT INTO plans (site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr, price_monthly_usd, price_yearly_usd,
    pages_limit, storage_mb, ai_credits_monthly,
    custom_domain, branding_removable, support_level,
    display_order, requires_contact, trial_days, features) VALUES

-- Landing: Starter
('landing', 'starter', 'Starter', 'One high-converting landing page for your campaign', true,
    59900, 44900, 700, 500,
    1, 512, 20,
    true, false, 'email_48h',
    1, false, 7,
    '[
        {"label": "1 landing page", "icon": "web"},
        {"label": "Lead capture forms", "icon": "contact_mail"},
        {"label": "A/B testing (2 variants)", "icon": "science"},
        {"label": "Custom domain", "icon": "language"},
        {"label": "Analytics", "icon": "analytics"},
        {"label": "20 AI credits/month", "icon": "auto_awesome"}
    ]'::jsonb),

-- Landing: Growth
('landing', 'growth', 'Growth', 'Multiple landing pages with advanced conversion tools', false,
    149900, 119900, 1800, 1440,
    5, 2048, 60,
    true, true, 'email_24h',
    2, false, 7,
    '[
        {"label": "5 landing pages", "icon": "web"},
        {"label": "Unlimited forms", "icon": "contact_mail"},
        {"label": "A/B testing (5 variants)", "icon": "science"},
        {"label": "60 AI credits/month", "icon": "auto_awesome"},
        {"label": "UTM tracking", "icon": "link"},
        {"label": "Priority support", "icon": "support_agent"}
    ]'::jsonb),

-- Landing: Agency
('landing', 'agency', 'Agency', 'Unlimited pages for marketing agencies', false,
    599900, 449900, 7200, 5400,
    NULL, 10240, 200,
    true, true, 'dedicated',
    3, true, 7,
    '[
        {"label": "Unlimited pages", "icon": "web"},
        {"label": "White-label", "icon": "verified"},
        {"label": "200 AI credits/month", "icon": "auto_awesome"},
        {"label": "Team collaboration", "icon": "group"},
        {"label": "Webhooks + API", "icon": "api"},
        {"label": "Dedicated support", "icon": "support_agent"}
    ]'::jsonb)

ON CONFLICT (site_type, slug) DO NOTHING;


-- ============================================
-- 7. COMPARE FEATURES (Store plans)
-- ============================================

-- Update store plans with compare_features for the comparison table
UPDATE plans SET compare_features = '[
    {
        "category": "Pricing",
        "items": [
            {"label": "Monthly price", "starter": "₹999/mo", "business": "₹2,999/mo", "enterprise": "₹14,999/mo"},
            {"label": "Annual price", "starter": "₹799/mo", "business": "₹2,249/mo", "enterprise": "₹10,499/mo", "description": "Save 20-30% with annual billing"},
            {"label": "Transaction fee", "starter": "2% of GMV", "business": "1.2% of GMV", "enterprise": "0.8% of GMV", "description": "Platform fee on top of payment gateway fees"}
        ]
    },
    {
        "category": "Products & Orders",
        "items": [
            {"label": "Products", "starter": "100", "business": "1,000", "enterprise": "Unlimited"},
            {"label": "Product variants", "starter": "10", "business": "50", "enterprise": "Unlimited"},
            {"label": "Product images", "starter": "5", "business": "15", "enterprise": "Unlimited"},
            {"label": "Orders per month", "starter": "250", "business": "2,500", "enterprise": "Unlimited"},
            {"label": "Bulk import", "starter": true, "business": true, "enterprise": true}
        ]
    },
    {
        "category": "Payments & Checkout",
        "items": [
            {"label": "Payment gateways", "starter": "Razorpay + Stripe", "business": "All gateways", "enterprise": "All + Custom"},
            {"label": "Multi-currency", "starter": false, "business": "5 currencies", "enterprise": "135+ currencies"},
            {"label": "Abandoned cart", "starter": false, "business": true, "enterprise": "AI-powered"}
        ]
    },
    {
        "category": "Design & Branding",
        "items": [
            {"label": "Themes", "starter": "5 free", "business": "All free", "enterprise": "All + Custom"},
            {"label": "Custom domain", "starter": true, "business": true, "enterprise": true},
            {"label": "Custom CSS", "starter": false, "business": true, "enterprise": true},
            {"label": "Storage", "starter": "2 GB", "business": "10 GB", "enterprise": "50 GB"},
            {"label": "Remove branding", "starter": "₹199/mo add-on", "business": true, "enterprise": "White-label"}
        ]
    },
    {
        "category": "AI & Automation",
        "items": [
            {"label": "Monthly AI credits", "starter": "30", "business": "100", "enterprise": "500"},
            {"label": "AI model", "starter": "Flash", "business": "Sonnet", "enterprise": "All models"},
            {"label": "Smart pricing", "starter": false, "business": true, "enterprise": true},
            {"label": "AI credit top-ups", "starter": "From ₹149", "business": "From ₹149", "enterprise": "Bulk pricing"}
        ]
    },
    {
        "category": "Team & Support",
        "items": [
            {"label": "Staff accounts", "starter": "1", "business": "3", "enterprise": "Unlimited"},
            {"label": "Support", "starter": "Email (48h)", "business": "Priority (24h)", "enterprise": "Dedicated + Phone"},
            {"label": "API access", "starter": "Read-only", "business": "Full REST", "enterprise": "Full + Webhooks"},
            {"label": "Onboarding", "starter": "Video guides", "business": "1-on-1 call", "enterprise": "Done-for-you"}
        ]
    }
]'::jsonb
WHERE site_type = 'store';
