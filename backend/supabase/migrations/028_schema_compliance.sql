-- ============================================================================
-- Migration 028: Schema Compliance
-- Adds soft-delete, audit trail, and optimistic locking columns to all tables.
-- All additions are non-breaking (nullable or have defaults).
-- ============================================================================

-- ============================================================================
-- SOFT DELETE: deleted_at TIMESTAMPTZ
-- Convention: NULL = active, NOT NULL = soft-deleted
-- ============================================================================

-- Core business tables
ALTER TABLE users              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sites              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE coupons            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Portfolio/Resume tables
ALTER TABLE projects           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE skills             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE education          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE testimonials       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE work_experience    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE certifications     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE resume_versions    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Landing Page tables
ALTER TABLE leads              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE lead_forms         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Blog tables
ALTER TABLE blog_posts         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE blog_categories    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE blog_comments      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- E-commerce extended tables (from migration 027)
ALTER TABLE carts              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE product_reviews    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tax_rates          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE smart_collections  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE gallery_items      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Platform tables
ALTER TABLE notifications      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE media              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE form_submissions   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE plans              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE store_customers    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- AUDIT TRAIL: created_by / updated_by UUID
-- References the user who performed the action
-- ============================================================================

-- Core (high-write tables get both created_by and updated_by)
ALTER TABLE sites              ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE sites              ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE coupons            ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE coupons            ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Portfolio (created_by only — owner rarely changes)
ALTER TABLE projects           ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE projects           ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE skills             ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE education          ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE testimonials       ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE work_experience    ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE certifications     ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE resume_versions    ADD COLUMN IF NOT EXISTS created_by UUID;

-- Landing Page
ALTER TABLE lead_forms         ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE lead_forms         ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Blog
ALTER TABLE blog_posts         ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE blog_posts         ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE blog_categories    ADD COLUMN IF NOT EXISTS created_by UUID;

-- E-commerce extended
ALTER TABLE tax_rates          ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE tax_rates          ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE smart_collections  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE smart_collections  ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE gallery_items      ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE media              ADD COLUMN IF NOT EXISTS created_by UUID;

-- Users table (only updated_by — no created_by since users create themselves)
ALTER TABLE users              ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ============================================================================
-- OPTIMISTIC LOCKING: version INT DEFAULT 1
-- Only on tables that support concurrent edits
-- ============================================================================

ALTER TABLE users              ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE sites              ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE products           ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE coupons            ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE projects           ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE lead_forms         ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE blog_posts         ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE tax_rates          ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE smart_collections  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE plans              ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;

-- ============================================================================
-- INDEXES: Soft delete filtering — partial indexes for performance
-- WHERE deleted_at IS NULL covers the 99% case (active records)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_active ON blog_posts(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_active ON leads(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_carts_active ON carts(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_reviews_active ON product_reviews(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_customers_active ON store_customers(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_active ON media(store_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGER: Auto-increment version on UPDATE
-- Prevents two concurrent writers from silently overwriting each other.
-- Application code should: UPDATE ... SET version = version + 1 WHERE version = $old
-- This trigger is a safety net.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-increment if the application didn't already do it
    IF NEW.version = OLD.version THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all version-enabled tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'sites', 'products', 'orders', 'coupons',
        'projects', 'lead_forms', 'blog_posts', 'tax_rates',
        'smart_collections', 'plans'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_version ON %I; '
            'CREATE TRIGGER trg_%I_version BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION increment_version();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================================================
-- DOWN MIGRATION
-- To rollback, run these in reverse order:
-- ============================================================================
-- 
-- -- Drop version triggers
-- DO $$
-- DECLARE tbl TEXT;
-- BEGIN
--     FOREACH tbl IN ARRAY ARRAY[
--         'users', 'sites', 'products', 'orders', 'coupons',
--         'projects', 'lead_forms', 'blog_posts', 'tax_rates',
--         'smart_collections', 'plans'
--     ] LOOP
--         EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_version ON %I;', tbl, tbl);
--     END LOOP;
-- END $$;
-- DROP FUNCTION IF EXISTS increment_version();
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_users_active;
-- DROP INDEX IF EXISTS idx_sites_active;
-- DROP INDEX IF EXISTS idx_products_active;
-- DROP INDEX IF EXISTS idx_orders_active;
-- DROP INDEX IF EXISTS idx_coupons_active;
-- DROP INDEX IF EXISTS idx_projects_active;
-- DROP INDEX IF EXISTS idx_blog_posts_active;
-- DROP INDEX IF EXISTS idx_leads_active;
-- DROP INDEX IF EXISTS idx_contacts_active;
-- DROP INDEX IF EXISTS idx_carts_active;
-- DROP INDEX IF EXISTS idx_product_reviews_active;
-- DROP INDEX IF EXISTS idx_store_customers_active;
-- DROP INDEX IF EXISTS idx_notifications_active;
-- DROP INDEX IF EXISTS idx_media_active;
--
-- -- Drop version columns
-- ALTER TABLE users DROP COLUMN IF EXISTS version;
-- ALTER TABLE sites DROP COLUMN IF EXISTS version;
-- (... repeat for all tables ...)
--
-- -- Drop audit columns
-- ALTER TABLE sites DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE sites DROP COLUMN IF EXISTS updated_by;
-- (... repeat for all tables ...)
--
-- -- Drop soft delete columns
-- ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE sites DROP COLUMN IF EXISTS deleted_at;
-- (... repeat for all tables ...)
