-- ============================================
-- LETBUYY PLATFORM DATABASE SCHEMA
-- Supabase Project: Letbuyy_Store
-- Created: February 6, 2026
-- ============================================

-- ============================================
-- USERS & AUTH
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    
    -- Subscription
    subscription_tier TEXT DEFAULT 'free' 
        CHECK (subscription_tier IN ('free', 'starter', 'business', 'enterprise')),
    subscription_expires_at TIMESTAMPTZ,
    
    -- Saved accounts (for /select page - Shopify style)
    saved_accounts JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SITES (Multi-Type)
-- ============================================

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Info
    name TEXT NOT NULL,
    store_name TEXT UNIQUE NOT NULL,  -- URL slug: admin.letbuyy.store/{store_name}
    tagline TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    
    -- Site Type
    site_type TEXT NOT NULL CHECK (site_type IN ('ecommerce', 'portfolio', 'resume', 'landing_page')),
    
    -- Domain
    subdomain TEXT UNIQUE NOT NULL,   -- For *.letbuyy.store
    custom_domain TEXT,
    
    -- Theme
    theme_id TEXT DEFAULT 'modern',
    theme_settings JSONB DEFAULT '{}',
    template_config JSONB DEFAULT '{}',
    sections JSONB DEFAULT '[]',
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
    published_at TIMESTAMPTZ,
    
    -- Analytics
    views_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- E-COMMERCE: PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    
    images TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Variants
    variants JSONB DEFAULT '[]',
    
    -- Inventory
    stock INT DEFAULT 0,
    track_inventory BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- E-COMMERCE: ORDERS
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    
    -- Customer
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    
    -- Address
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    
    -- Items
    items JSONB NOT NULL,
    
    -- Totals
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Coupon
    coupon_code TEXT,
    coupon_discount DECIMAL(10,2),
    
    -- Status
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_status TEXT DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Payment
    payment_method TEXT,
    payment_id TEXT,
    
    -- Tracking
    tracking_number TEXT,
    carrier TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- E-COMMERCE: COUPONS
-- ============================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    code TEXT NOT NULL,
    description TEXT,
    
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping', 'bogo')),
    discount_value DECIMAL(10,2),
    
    min_order_amount DECIMAL(10,2),
    max_discount DECIMAL(10,2),
    usage_limit INT,
    usage_count INT DEFAULT 0,
    per_user_limit INT DEFAULT 1,
    
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(site_id, code)
);

-- ============================================
-- PORTFOLIO: PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    
    images TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    video_url TEXT,
    
    client_name TEXT,
    project_date DATE,
    technologies TEXT[] DEFAULT '{}',
    
    live_url TEXT,
    github_url TEXT,
    behance_url TEXT,
    dribbble_url TEXT,
    
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PORTFOLIO: SKILLS
-- ============================================

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    category TEXT DEFAULT 'technical',
    proficiency_level INT DEFAULT 50 CHECK (proficiency_level BETWEEN 0 AND 100),
    years_experience INT,
    certification_url TEXT,
    icon_url TEXT,
    
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PORTFOLIO/RESUME: EDUCATION
-- ============================================

CREATE TABLE IF NOT EXISTS education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    
    gpa DECIMAL(3,2),
    honors TEXT[] DEFAULT '{}',
    
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PORTFOLIO: TESTIMONIALS
-- ============================================

CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    author_name TEXT NOT NULL,
    author_title TEXT,
    author_company TEXT,
    author_avatar TEXT,
    
    content TEXT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESUME: WORK EXPERIENCE
-- ============================================

CREATE TABLE IF NOT EXISTS work_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    location TEXT,
    company_logo TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    
    responsibilities TEXT[] DEFAULT '{}',
    achievements TEXT[] DEFAULT '{}',
    
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESUME: CERTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    no_expiry BOOLEAN DEFAULT FALSE,
    
    credential_id TEXT,
    credential_url TEXT,
    badge_url TEXT,
    
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESUME: PDF VERSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    template_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    pdf_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    
    download_count INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LANDING PAGE: LEADS
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    form_id UUID,
    
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    company TEXT,
    
    custom_fields JSONB DEFAULT '{}',
    utm_params JSONB DEFAULT '{}',
    
    source_url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LANDING PAGE: FORMS
-- ============================================

CREATE TABLE IF NOT EXISTS lead_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    fields JSONB NOT NULL,
    
    success_message TEXT DEFAULT 'Thank you for your submission!',
    redirect_url TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    submission_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UNIVERSAL: CONTACTS
-- ============================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    
    is_read BOOLEAN DEFAULT FALSE,
    replied_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_store_name ON sites(store_name);
CREATE INDEX IF NOT EXISTS idx_sites_subdomain ON sites(subdomain);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_products_site ON products(site_id);
CREATE INDEX IF NOT EXISTS idx_orders_site ON orders(site_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_projects_site ON projects(site_id);
CREATE INDEX IF NOT EXISTS idx_leads_site ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_contacts_site ON contacts(site_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE education ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own data
DROP POLICY IF EXISTS "users_own_data" ON users;
CREATE POLICY "users_own_data" ON users
    FOR ALL USING (id = auth.uid());

-- Users can manage their own sites
DROP POLICY IF EXISTS "users_own_sites" ON sites;
CREATE POLICY "users_own_sites" ON sites
    FOR ALL USING (user_id = auth.uid());

-- Public can read published sites
DROP POLICY IF EXISTS "public_read_published_sites" ON sites;
CREATE POLICY "public_read_published_sites" ON sites
    FOR SELECT USING (status = 'published');

-- Site owners can manage their products
DROP POLICY IF EXISTS "site_owner_products" ON products;
CREATE POLICY "site_owner_products" ON products
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Public can view published products
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
    FOR SELECT USING (
        is_active = TRUE AND 
        site_id IN (SELECT id FROM sites WHERE status = 'published')
    );

-- Site owners can manage their orders
DROP POLICY IF EXISTS "site_owner_orders" ON orders;
CREATE POLICY "site_owner_orders" ON orders
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Same pattern for other tables...
DROP POLICY IF EXISTS "site_owner_coupons" ON coupons;
CREATE POLICY "site_owner_coupons" ON coupons
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "site_owner_projects" ON projects;
CREATE POLICY "site_owner_projects" ON projects
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_projects" ON projects;
CREATE POLICY "public_read_projects" ON projects
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_skills" ON skills;
CREATE POLICY "site_owner_skills" ON skills
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_skills" ON skills;
CREATE POLICY "public_read_skills" ON skills
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_education" ON education;
CREATE POLICY "site_owner_education" ON education
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_education" ON education;
CREATE POLICY "public_read_education" ON education
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_testimonials" ON testimonials;
CREATE POLICY "site_owner_testimonials" ON testimonials
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
CREATE POLICY "public_read_testimonials" ON testimonials
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_work_exp" ON work_experience;
CREATE POLICY "site_owner_work_exp" ON work_experience
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_work_exp" ON work_experience;
CREATE POLICY "public_read_work_exp" ON work_experience
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_certs" ON certifications;
CREATE POLICY "site_owner_certs" ON certifications
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_certs" ON certifications;
CREATE POLICY "public_read_certs" ON certifications
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_resume_versions" ON resume_versions;
CREATE POLICY "site_owner_resume_versions" ON resume_versions
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_resume" ON resume_versions;
CREATE POLICY "public_read_resume" ON resume_versions
    FOR SELECT USING (site_id IN (SELECT id FROM sites WHERE status = 'published'));

DROP POLICY IF EXISTS "site_owner_leads" ON leads;
CREATE POLICY "site_owner_leads" ON leads
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Anyone can insert leads (form submissions)
DROP POLICY IF EXISTS "public_insert_leads" ON leads;
CREATE POLICY "public_insert_leads" ON leads
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "site_owner_forms" ON lead_forms;
CREATE POLICY "site_owner_forms" ON lead_forms
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "public_read_forms" ON lead_forms;
CREATE POLICY "public_read_forms" ON lead_forms
    FOR SELECT USING (
        is_active = TRUE AND 
        site_id IN (SELECT id FROM sites WHERE status = 'published')
    );

DROP POLICY IF EXISTS "site_owner_contacts" ON contacts;
CREATE POLICY "site_owner_contacts" ON contacts
    FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Anyone can insert contacts (contact form)
DROP POLICY IF EXISTS "public_insert_contacts" ON contacts;
CREATE POLICY "public_insert_contacts" ON contacts
    FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();
