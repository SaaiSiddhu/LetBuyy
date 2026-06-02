-- ============================================================================
-- Migration 027: Missing Tables
-- Creates the 8 tables documented but not yet migrated.
-- Priority: HIGH (carts), MEDIUM (reviews, tax, inventory), LOW (portfolio)
-- ============================================================================

-- ============================================================================
-- 1. CARTS (HIGH PRIORITY — blocks checkout flow)
-- Ref: Doc 05 §6.2
-- ============================================================================

CREATE TABLE IF NOT EXISTS carts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id                UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    customer_id             UUID,                           -- Null for anonymous
    session_id              TEXT,                            -- For anonymous tracking
    items                   JSONB NOT NULL DEFAULT '[]',
    -- items: [{ product_id, variant_id, quantity, price_at_add, title, image }]
    coupon_code             TEXT,
    notes                   TEXT,

    -- Abandoned cart tracking
    status                  TEXT DEFAULT 'active'
                            CHECK (status IN ('active', 'abandoned', 'converted', 'recovered')),
    abandoned_at            TIMESTAMPTZ,
    recovery_email_sent     BOOLEAN DEFAULT false,
    recovery_email_sent_at  TIMESTAMPTZ,

    expires_at              TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_store_customer ON carts(store_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(store_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_abandoned ON carts(store_id, status) WHERE status = 'abandoned';

-- ============================================================================
-- 2. PRODUCT REVIEWS (MEDIUM PRIORITY)
-- Ref: Doc 05 — product review/rating system
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           TEXT,
    body            TEXT,
    images          TEXT[] DEFAULT '{}',
    is_verified     BOOLEAN DEFAULT false,          -- Verified purchaser
    is_approved     BOOLEAN DEFAULT false,          -- Moderated by store owner
    helpful_count   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, is_approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_store ON product_reviews(store_id, is_approved);

-- ============================================================================
-- 3. TAX RATES (MEDIUM PRIORITY)
-- Ref: Doc 05 §13
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                   -- "GST 18%", "GST 12%", "VAT"
    rate            DECIMAL(5,4) NOT NULL,           -- 0.1800 = 18%
    country         TEXT DEFAULT 'IN',
    state           TEXT,                             -- State-specific tax
    is_compound     BOOLEAN DEFAULT false,
    is_shipping     BOOLEAN DEFAULT false,            -- Apply to shipping?
    priority        INT DEFAULT 0,                    -- Order of application for compound taxes
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_store ON tax_rates(store_id, is_active);

-- ============================================================================
-- 4. INVENTORY MANAGEMENT (MEDIUM PRIORITY)
-- Ref: Doc 05 §3.1 — Multi-warehouse inventory
-- ============================================================================

-- Inventory locations (multi-warehouse support)
CREATE TABLE IF NOT EXISTS inventory_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                        -- "Main Warehouse", "Store Front"
    address     JSONB,                                -- { line1, line2, city, state, zip, country }
    is_default  BOOLEAN DEFAULT false,
    status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_store ON inventory_locations(store_id, status);

-- Inventory per location per variant
CREATE TABLE IF NOT EXISTS inventory_levels (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    location_id  UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    available    INT NOT NULL DEFAULT 0,
    reserved     INT NOT NULL DEFAULT 0,              -- Reserved during checkout
    incoming     INT NOT NULL DEFAULT 0,              -- Purchase orders in transit
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, variant_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_product ON inventory_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON inventory_levels(location_id);

-- Inventory adjustment log (auditable)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    variant_id      UUID REFERENCES product_variants(id),
    location_id     UUID NOT NULL REFERENCES inventory_locations(id),
    quantity_change  INT NOT NULL,                    -- +50 (restock) or -1 (sold)
    reason          TEXT NOT NULL                     -- sale, return, adjustment, recount, transfer, damaged
                    CHECK (reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')),
    reference_id    UUID,                             -- order_id, transfer_id, etc.
    note            TEXT,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_product ON inventory_adjustments(product_id, created_at DESC);

-- ============================================================================
-- 5. SMART COLLECTIONS (LOW PRIORITY)
-- Ref: Doc 05 §4
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    description TEXT,
    conditions  JSONB NOT NULL,                       -- Rules for auto-inclusion
    -- Example: [{ "field": "price", "operator": "greater_than", "value": 1000 }]
    match_type  TEXT DEFAULT 'all'                    -- 'all' (AND) or 'any' (OR)
                CHECK (match_type IN ('all', 'any')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(store_id, slug)
);

-- ============================================================================
-- 6. GALLERY ITEMS (LOW PRIORITY — Portfolio)
-- Ref: Doc 06 §4.1
-- ============================================================================

CREATE TABLE IF NOT EXISTS gallery_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,

    title         TEXT,
    description   TEXT,

    -- Media
    type          TEXT NOT NULL DEFAULT 'image'
                  CHECK (type IN ('image', 'video', 'embed')),
    url           TEXT NOT NULL,
    thumbnail_url TEXT,
    blurhash      TEXT,

    -- Metadata
    width         INT,
    height        INT,
    file_size     INT,
    mime_type     TEXT,
    alt_text      TEXT,

    -- Organization
    category      TEXT DEFAULT 'General',
    tags          TEXT[] DEFAULT '{}',
    display_order INT DEFAULT 0,
    is_visible    BOOLEAN DEFAULT true,

    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_store ON gallery_items(store_id, display_order);

-- ============================================================================
-- 7. SKILL ENDORSEMENTS (LOW PRIORITY — Resume)
-- Ref: Doc 06 §3
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_endorsements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    endorser_name   TEXT NOT NULL,
    endorser_email  TEXT NOT NULL,
    endorser_title  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(skill_id, endorser_email)
);

-- ============================================================================
-- RLS: Enable Row Level Security on all new tables
-- ============================================================================

ALTER TABLE carts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_collections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_endorsements     ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Carts: Service role full access (cart ops go through backend API)
CREATE POLICY "service_all_carts" ON carts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Carts: Customers can view/manage their own carts
CREATE POLICY "customers_manage_own_carts" ON carts
    FOR ALL TO authenticated
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- Product Reviews: Public can read approved reviews
CREATE POLICY "public_read_approved_reviews" ON product_reviews
    FOR SELECT TO anon, authenticated
    USING (is_approved = true);

-- Product Reviews: Store owners manage their store's reviews
CREATE POLICY "store_owners_manage_reviews" ON product_reviews
    FOR ALL TO authenticated
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Product Reviews: Service role full access
CREATE POLICY "service_all_reviews" ON product_reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tax Rates: Store owners manage their tax rates
CREATE POLICY "store_owners_manage_tax" ON tax_rates
    FOR ALL TO authenticated
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Tax Rates: Service role full access
CREATE POLICY "service_all_tax_rates" ON tax_rates
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Inventory Locations: Store owners manage
CREATE POLICY "store_owners_manage_locations" ON inventory_locations
    FOR ALL TO authenticated
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Inventory Levels: Store owners manage
CREATE POLICY "store_owners_manage_levels" ON inventory_levels
    FOR ALL TO authenticated
    USING (product_id IN (SELECT id FROM products WHERE store_id IN (SELECT id FROM sites WHERE user_id = auth.uid())))
    WITH CHECK (product_id IN (SELECT id FROM products WHERE store_id IN (SELECT id FROM sites WHERE user_id = auth.uid())));

-- Inventory Adjustments: Store owners can view
CREATE POLICY "store_owners_view_adjustments" ON inventory_adjustments
    FOR SELECT TO authenticated
    USING (product_id IN (SELECT id FROM products WHERE store_id IN (SELECT id FROM sites WHERE user_id = auth.uid())));

-- Inventory: Service role full access
CREATE POLICY "service_all_inventory_locations" ON inventory_locations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_inventory_levels" ON inventory_levels
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_inventory_adjustments" ON inventory_adjustments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Smart Collections: Store owners manage
CREATE POLICY "store_owners_manage_smart_collections" ON smart_collections
    FOR ALL TO authenticated
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Smart Collections: Public can view
CREATE POLICY "public_view_smart_collections" ON smart_collections
    FOR SELECT TO anon USING (true);

-- Gallery Items: Store owners manage
CREATE POLICY "store_owners_manage_gallery" ON gallery_items
    FOR ALL TO authenticated
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Gallery Items: Public can view visible items
CREATE POLICY "public_view_gallery" ON gallery_items
    FOR SELECT TO anon
    USING (is_visible = true);

-- Gallery: Service role full access
CREATE POLICY "service_all_gallery" ON gallery_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Skill Endorsements: Anyone can create (visitors)
CREATE POLICY "anyone_create_endorsements" ON skill_endorsements
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Skill Endorsements: Public can view
CREATE POLICY "public_view_endorsements" ON skill_endorsements
    FOR SELECT TO anon, authenticated
    USING (true);

-- Skill Endorsements: Skill owner can delete
CREATE POLICY "skill_owner_manage_endorsements" ON skill_endorsements
    FOR DELETE TO authenticated
    USING (skill_id IN (
        SELECT s.id FROM skills s
        JOIN sites st ON s.store_id = st.id
        WHERE st.user_id = auth.uid()
    ));

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION (reuse existing or create)
-- ============================================================================

-- Apply updated_at trigger to tables that have updated_at
DO $$
BEGIN
    -- Carts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_carts_updated_at') THEN
        CREATE TRIGGER update_carts_updated_at
            BEFORE UPDATE ON carts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    -- Inventory Levels
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_levels_updated_at') THEN
        CREATE TRIGGER update_inventory_levels_updated_at
            BEFORE UPDATE ON inventory_levels
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
