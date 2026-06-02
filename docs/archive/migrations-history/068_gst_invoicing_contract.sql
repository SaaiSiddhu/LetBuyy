-- ============================================================================
-- Migration 068: GST Invoicing Contract
-- Additive India-native commerce fields for GSTIN capture, HSN product
-- classification, and generated invoice snapshots. Production application is
-- human-gated by the foundation mission; this migration is safe for local proof.
-- ============================================================================

-- Store legal/tax identity. Database ownership remains `sites`; UI may say store.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gst_state_code TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'LBY';

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_gstin_format_check;
ALTER TABLE sites ADD CONSTRAINT sites_gstin_format_check
    CHECK (
        gstin IS NULL
        OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    );

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_gst_state_code_check;
ALTER TABLE sites ADD CONSTRAINT sites_gst_state_code_check
    CHECK (
        gst_state_code IS NULL
        OR gst_state_code ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'
    );

-- Product tax classification. Keep legacy hs_code for compatibility while
-- adding India GST-native HSN.
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT;

UPDATE products
SET hsn_code = hs_code
WHERE hsn_code IS NULL
  AND hs_code IS NOT NULL
  AND hs_code ~ '^\d{4,8}$';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_hsn_code_format_check;
ALTER TABLE products ADD CONSTRAINT products_hsn_code_format_check
    CHECK (hsn_code IS NULL OR hsn_code ~ '^\d{4,8}$');

-- Customer address GST capture for B2B storefront checkout and repeat buyers.
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS state_code TEXT;

ALTER TABLE customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_gstin_format_check;
ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_gstin_format_check
    CHECK (
        gstin IS NULL
        OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    );

ALTER TABLE customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_state_code_check;
ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_state_code_check
    CHECK (
        state_code IS NULL
        OR state_code ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'
    );

-- Order-level GST invoice snapshot. The JSONB invoice is immutable evidence for
-- storefront/admin reads; provider e-invoice IRN submission stays human-gated.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_gstin TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS place_of_supply_state TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_invoice_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_invoice JSONB;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_gstin_format_check;
ALTER TABLE orders ADD CONSTRAINT orders_customer_gstin_format_check
    CHECK (
        customer_gstin IS NULL
        OR customer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    );

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_place_of_supply_state_check;
ALTER TABLE orders ADD CONSTRAINT orders_place_of_supply_state_check
    CHECK (
        place_of_supply_state IS NULL
        OR place_of_supply_state ~ '^(0[1-9]|[12][0-9]|3[0-8]|97)$'
    );

-- Line-level GST split. These values are denormalized from the generated
-- invoice so reporting does not need to reinterpret historical order JSON.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taxable_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_hsn_code_format_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_hsn_code_format_check
    CHECK (hsn_code IS NULL OR hsn_code ~ '^\d{4,8}$');

CREATE INDEX IF NOT EXISTS idx_sites_gstin
    ON sites(gstin)
    WHERE gstin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_store_hsn
    ON products(store_id, hsn_code)
    WHERE hsn_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_gst_invoice_number
    ON orders(store_id, gst_invoice_number)
    WHERE gst_invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_hsn
    ON order_items(hsn_code)
    WHERE hsn_code IS NOT NULL;
