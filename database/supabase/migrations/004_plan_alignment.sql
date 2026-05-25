-- ============================================
-- LETBUYY SCHEMA ALIGNMENT — Plan v3.0
-- Migration: 004_plan_alignment
-- Renames sites → stores, aligns all tables
-- ============================================

/*
RETIRED ENTERPRISE SAFETY NOTE:

This historical migration performed an unsafe physical rename from `sites` to
`stores`. Later migrations re-established `sites` as canonical storage and
`stores` as a compatibility view. Leaving this migration executable makes a
fresh replay capable of renaming live tenant data and then dropping it in a
later compatibility migration.

The canonical repository contract is now:
- database tables use `sites`;
- UI/API language may use store/stores;
- `stores` may only be a view or route term, never canonical table storage.

This file remains as migration-number memory only and is intentionally no-op.
*/

/*

-- ============================================
-- 1. RENAME sites → stores
-- ============================================

-- Drop existing RLS policies referencing 'sites'
DROP POLICY IF EXISTS "users_own_sites" ON sites;
DROP POLICY IF EXISTS "public_read_published_sites" ON sites;

-- Drop triggers referencing 'sites'
DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;

-- Drop indexes referencing 'sites'
DROP INDEX IF EXISTS idx_sites_user;
DROP INDEX IF EXISTS idx_sites_store_name;
DROP INDEX IF EXISTS idx_sites_subdomain;
DROP INDEX IF EXISTS idx_sites_status;

-- Rename the table
ALTER TABLE sites RENAME TO stores;

-- Rename store_name column to match plan (subdomain is the URL slug)
-- store_name was the admin URL slug, subdomain was *.letbuyy.store
-- Plan uses 'subdomain' for both, so we keep subdomain and drop store_name duplication

-- Add missing columns from plan
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Update site_type values to match plan (ecommerce → store, landing_page → landing)
UPDATE stores SET site_type = 'store' WHERE site_type = 'ecommerce';
UPDATE stores SET site_type = 'landing' WHERE site_type = 'landing_page';

-- Update status check constraint to include 'frozen'
ALTER TABLE stores DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE stores ADD CONSTRAINT stores_status_check 
    CHECK (status IN ('draft', 'published', 'frozen', 'suspended'));

-- Update site_type check constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS sites_site_type_check;
ALTER TABLE stores ADD CONSTRAINT stores_site_type_check 
    CHECK (site_type IN ('store', 'portfolio', 'resume', 'landing'));

-- Recreate indexes
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_site_type ON stores(site_type);

-- Recreate trigger
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recreate RLS policies
CREATE POLICY "users_manage_own_stores" ON stores
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "public_read_published_stores" ON stores
    FOR SELECT USING (status = 'published');


-- ============================================
-- 2. RENAME FK: site_id → store_id (all tables)
-- ============================================

-- products
ALTER TABLE products RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_products_site;
CREATE INDEX idx_products_store ON products(store_id);

-- orders
ALTER TABLE orders RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_orders_site;
CREATE INDEX idx_orders_store ON orders(store_id);

-- Add missing columns to orders per plan
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- coupons
ALTER TABLE coupons RENAME COLUMN site_id TO store_id;

-- skills
ALTER TABLE skills RENAME COLUMN site_id TO store_id;

-- education
ALTER TABLE education RENAME COLUMN site_id TO store_id;

-- testimonials
ALTER TABLE testimonials RENAME COLUMN site_id TO store_id;

-- work_experience
ALTER TABLE work_experience RENAME COLUMN site_id TO store_id;

-- certifications
ALTER TABLE certifications RENAME COLUMN site_id TO store_id;

-- resume_versions
ALTER TABLE resume_versions RENAME COLUMN site_id TO store_id;

-- leads
ALTER TABLE leads RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_leads_site;
CREATE INDEX idx_leads_store ON leads(store_id);

-- lead_forms
ALTER TABLE lead_forms RENAME COLUMN site_id TO store_id;

-- contacts → rename table to contact_submissions
ALTER TABLE contacts RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_contacts_site;

-- pages
ALTER TABLE pages RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_pages_site;
CREATE INDEX idx_pages_store ON pages(store_id);

-- shipping_zones
ALTER TABLE shipping_zones RENAME COLUMN site_id TO store_id;

-- analytics_events
ALTER TABLE analytics_events RENAME COLUMN site_id TO store_id;
DROP INDEX IF EXISTS idx_analytics_site;
CREATE INDEX idx_analytics_store ON analytics_events(store_id, created_at DESC);


-- ============================================
-- 3. RENAME projects → portfolio_projects
-- ============================================

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP INDEX IF EXISTS idx_projects_site;

ALTER TABLE projects RENAME TO portfolio_projects;
ALTER TABLE portfolio_projects RENAME COLUMN site_id TO store_id;

-- Add missing columns from plan
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

CREATE INDEX idx_portfolio_projects_store ON portfolio_projects(store_id);

CREATE TRIGGER update_portfolio_projects_updated_at BEFORE UPDATE ON portfolio_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- 4. RENAME contacts → contact_submissions
-- ============================================

ALTER TABLE contacts RENAME TO contact_submissions;

-- Add missing columns from plan
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

CREATE INDEX idx_contact_submissions_store ON contact_submissions(store_id);


-- ============================================
-- 5. RENAME super_admins → super_admin_allowlist
-- ============================================

ALTER TABLE super_admins RENAME TO super_admin_allowlist;


-- ============================================
-- 6. ADD products missing columns (plan alignment)
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Create unique constraint on store+slug
-- ALTER TABLE products ADD CONSTRAINT products_store_slug_unique UNIQUE(store_id, slug);


-- ============================================
-- 7. CREATE employee_roles TABLE (plan section 9.5)
-- ============================================

CREATE TABLE IF NOT EXISTS employee_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO employee_roles (name, display_name, permissions) VALUES
    ('support', 'Support Team', '["tickets.view", "tickets.respond", "users.read", "stores.read"]'),
    ('marketing', 'Marketing Team', '["analytics.read", "campaigns.manage", "content.manage", "banners.manage"]'),
    ('user_management', 'User Management', '["users.read", "stores.moderate", "accounts.freeze", "accounts.warn"]'),
    ('operations', 'Operations Team', '["disputes.manage", "health.view", "sellers.verify"]')
ON CONFLICT (name) DO NOTHING;

-- Add role_id FK to employees (linking to employee_roles)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES employee_roles(id);

-- Add missing columns to employees per plan
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;


-- ============================================
-- 8. UPDATE RLS POLICIES (use 'stores' everywhere)
-- ============================================

-- Drop old policies that reference 'sites'
DROP POLICY IF EXISTS "site_owner_products" ON products;
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "site_owner_orders" ON orders;
DROP POLICY IF EXISTS "site_owner_coupons" ON coupons;
DROP POLICY IF EXISTS "site_owner_projects" ON portfolio_projects;
DROP POLICY IF EXISTS "public_read_projects" ON portfolio_projects;
DROP POLICY IF EXISTS "site_owner_skills" ON skills;
DROP POLICY IF EXISTS "public_read_skills" ON skills;
DROP POLICY IF EXISTS "site_owner_education" ON education;
DROP POLICY IF EXISTS "public_read_education" ON education;
DROP POLICY IF EXISTS "site_owner_testimonials" ON testimonials;
DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
DROP POLICY IF EXISTS "site_owner_work_exp" ON work_experience;
DROP POLICY IF EXISTS "public_read_work_exp" ON work_experience;
DROP POLICY IF EXISTS "site_owner_certs" ON certifications;
DROP POLICY IF EXISTS "public_read_certs" ON certifications;
DROP POLICY IF EXISTS "site_owner_resume_versions" ON resume_versions;
DROP POLICY IF EXISTS "public_read_resume" ON resume_versions;
DROP POLICY IF EXISTS "site_owner_leads" ON leads;
DROP POLICY IF EXISTS "public_insert_leads" ON leads;
DROP POLICY IF EXISTS "site_owner_forms" ON lead_forms;
DROP POLICY IF EXISTS "public_read_forms" ON lead_forms;
DROP POLICY IF EXISTS "site_owner_contacts" ON contact_submissions;
DROP POLICY IF EXISTS "public_insert_contacts" ON contact_submissions;
DROP POLICY IF EXISTS "site_owner_pages" ON pages;
DROP POLICY IF EXISTS "public_read_published_pages" ON pages;
DROP POLICY IF EXISTS "site_owner_shipping_zones" ON shipping_zones;
DROP POLICY IF EXISTS "public_read_shipping_zones" ON shipping_zones;
DROP POLICY IF EXISTS "site_owner_shipping_rates" ON shipping_rates;
DROP POLICY IF EXISTS "site_owner_analytics" ON analytics_events;
DROP POLICY IF EXISTS "public_insert_analytics" ON analytics_events;
DROP POLICY IF EXISTS "site_owner_order_items" ON order_items;
DROP POLICY IF EXISTS "super_admin_employees" ON employees;
DROP POLICY IF EXISTS "super_admin_only" ON super_admin_allowlist;
DROP POLICY IF EXISTS "super_admin_invites" ON employee_invites;
DROP POLICY IF EXISTS "audit_read_super_admin" ON audit_logs;

-- Recreate all policies using 'stores'

-- Products
CREATE POLICY "store_owner_products" ON products
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_active_products" ON products
    FOR SELECT USING (
        is_active = TRUE AND
        store_id IN (SELECT id FROM stores WHERE status = 'published')
    );

-- Orders
CREATE POLICY "store_owner_orders" ON orders
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Order Items
CREATE POLICY "store_owner_order_items" ON order_items
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE store_id IN (
                SELECT id FROM stores WHERE user_id = auth.uid()
            )
        )
    );

-- Coupons
CREATE POLICY "store_owner_coupons" ON coupons
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Portfolio Projects
CREATE POLICY "store_owner_portfolio_projects" ON portfolio_projects
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_portfolio_projects" ON portfolio_projects
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Skills
CREATE POLICY "store_owner_skills" ON skills
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_skills" ON skills
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Education
CREATE POLICY "store_owner_education" ON education
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_education" ON education
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Testimonials
CREATE POLICY "store_owner_testimonials" ON testimonials
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_testimonials" ON testimonials
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Work Experience
CREATE POLICY "store_owner_work_experience" ON work_experience
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_work_experience" ON work_experience
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Certifications
CREATE POLICY "store_owner_certifications" ON certifications
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_certifications" ON certifications
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Resume Versions
CREATE POLICY "store_owner_resume_versions" ON resume_versions
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_resume_versions" ON resume_versions
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

-- Leads
CREATE POLICY "store_owner_leads" ON leads
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_submit_leads" ON leads
    FOR INSERT WITH CHECK (TRUE);

-- Lead Forms
CREATE POLICY "store_owner_lead_forms" ON lead_forms
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_active_forms" ON lead_forms
    FOR SELECT USING (
        is_active = TRUE AND
        store_id IN (SELECT id FROM stores WHERE status = 'published')
    );

-- Contact Submissions
CREATE POLICY "store_owner_contact_submissions" ON contact_submissions
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_submit_contact" ON contact_submissions
    FOR INSERT WITH CHECK (TRUE);

-- Pages
CREATE POLICY "store_owner_pages" ON pages
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_published_pages" ON pages
    FOR SELECT USING (
        status = 'published' AND
        store_id IN (SELECT id FROM stores WHERE status = 'published')
    );

-- Shipping
CREATE POLICY "store_owner_shipping_zones" ON shipping_zones
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_view_shipping_zones" ON shipping_zones
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE status = 'published'));

CREATE POLICY "store_owner_shipping_rates" ON shipping_rates
    FOR ALL USING (
        zone_id IN (
            SELECT id FROM shipping_zones WHERE store_id IN (
                SELECT id FROM stores WHERE user_id = auth.uid()
            )
        )
    );

-- Analytics
CREATE POLICY "store_owner_analytics" ON analytics_events
    FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "public_track_analytics" ON analytics_events
    FOR INSERT WITH CHECK (TRUE);

-- Employees (super admin managed)
CREATE POLICY "super_admin_manage_employees" ON employees
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Super Admin Allowlist
CREATE POLICY "super_admin_self_manage" ON super_admin_allowlist
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Employee Invites
CREATE POLICY "super_admin_manage_invites" ON employee_invites
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Audit Logs (super admin read)
CREATE POLICY "super_admin_read_audit_logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Employee Roles (read-only for all, managed by super admin)
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_roles" ON employee_roles
    FOR SELECT USING (TRUE);

CREATE POLICY "super_admin_manage_roles" ON employee_roles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admin_allowlist WHERE user_id = auth.uid() AND is_active = TRUE)
    );
*/
