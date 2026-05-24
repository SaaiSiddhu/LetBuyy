-- ============================================================================
-- Migration 029: Order Items Relational Table
-- Replaces the JSONB `orders.items` column with a proper relational table.
-- The existing JSONB column is kept for now (backward compatibility).
-- A future migration will migrate existing data and drop the column.
-- ============================================================================

-- ============================================================================
-- 1. ORDER_ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id        UUID REFERENCES product_variants(id) ON DELETE SET NULL,

    -- Line item details
    sku               TEXT,
    title             TEXT NOT NULL,               -- Product name (frozen at purchase)
    variant_title     TEXT,                         -- e.g. "Large / Blue"
    quantity          INT NOT NULL CHECK (quantity > 0),
    unit_price        DECIMAL(10,2) NOT NULL,       -- Price per unit at time of purchase
    discount_amount   DECIMAL(10,2) DEFAULT 0,      -- Per-item discount applied
    tax_amount        DECIMAL(10,2) DEFAULT 0,      -- Per-item tax
    total             DECIMAL(10,2) NOT NULL,       -- (unit_price * quantity) - discount + tax

    -- Snapshot: frozen copy of product data at purchase time
    -- Ensures order history is accurate even if product is deleted/changed
    product_snapshot  JSONB NOT NULL DEFAULT '{}',
    -- Example: { name, description, images, price, variant, weight, dimensions }

    -- Fulfillment tracking per item
    fulfillment_status TEXT DEFAULT 'unfulfilled'
        CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'returned')),
    fulfilled_quantity INT DEFAULT 0,

    -- Soft delete + audit
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibility for databases that already had the older order_items table
-- from migration 003 before this migration was introduced.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_title TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_snapshot JSONB NOT NULL DEFAULT '{}';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'returned'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_quantity INT DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE order_items
SET
    title = COALESCE(title, name, 'Item'),
    unit_price = COALESCE(unit_price, price, 0)
WHERE title IS NULL OR unit_price IS NULL;

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
    ON order_items(product_id) WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_active
    ON order_items(order_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Store owners can manage order items for their stores' orders
CREATE POLICY "store_owners_manage_order_items" ON order_items
    FOR ALL TO authenticated
    USING (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN sites s ON o.store_id = s.id
            WHERE s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN sites s ON o.store_id = s.id
            WHERE s.user_id = auth.uid()
        )
    );

-- Service role full access (webhook handlers create order items)
CREATE POLICY "service_all_order_items" ON order_items
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ============================================================================
-- DOWN MIGRATION (commented out — run manually to rollback)
-- ============================================================================
--
-- DROP POLICY IF EXISTS "service_all_order_items" ON order_items;
-- DROP POLICY IF EXISTS "store_owners_manage_order_items" ON order_items;
-- DROP INDEX IF EXISTS idx_order_items_active;
-- DROP INDEX IF EXISTS idx_order_items_product;
-- DROP INDEX IF EXISTS idx_order_items_order;
-- DROP TABLE IF EXISTS order_items;
