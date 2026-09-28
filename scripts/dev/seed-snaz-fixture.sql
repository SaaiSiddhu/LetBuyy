-- Seeds the shared "snaz" merchant fixture that several real-Postgres test files assume already
-- exists: services/api-gateway/src/__tests__/{gst-tax-computation,gift-card-money-path,
-- inventory-reservation-lifecycle,merchant-tenant-predicate,gst-invoice-issuance}.test.ts.
--
-- Why this file exists: fixing those 5 files' stale docker container name (D03 permission
-- equivalence follow-up, 2026-09-28) made them stop SKIPPING and start genuinely running against
-- real Postgres -- which revealed that "snaz" (site_id 9c047c9a-1ea3-4438-b1f7-4a9d1a123adb) does
-- not exist in the current local instance. No seed script for it existed anywhere in this repo; it
-- was very likely created once, manually, directly via psql, against a PREVIOUS local Supabase
-- Postgres container (before the local dev stack was recreated/renamed to
-- supabase_db_letbuyy-newmac-20260926), and that seed was never captured or re-applied. This file
-- makes that reproducible and durable across the next database recreation.
--
-- Every value and column requirement below was read from the 5 test files' own exact assertions and
-- the real schema (database/supabase/migrations/000_baseline.sql, 123_mobile_tax_rate_parity.sql),
-- not guessed:
--   - sites.gstin must match sites_gstin_format_check: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$
--     (a real GSTIN shape; "AAAAA0000A" is the CBIC's own commonly-cited example PAN placeholder).
--   - sites.gst_state_code must match sites_gst_state_code_check: ^(0[1-9]|[12][0-9]|3[0-8]|97)$ --
--     '29' (Karnataka) is used because every one of these test files' own order-creation calls
--     already hard-code state/state_code "Karnataka"/"29" for their orders, so the supplier
--     (snaz) and the buyer's address must agree for the intra-state CGST+SGST split those tests
--     assert on to be correct, not merely non-erroring.
--   - tax_rates needs exactly two active, non-shipping rows for snaz (checkout-payment-routes.ts
--     reads `rate, hsn_code` filtered by `store_id, is_active=true, is_shipping=false,
--     deleted_at IS NULL`, ordered by priority): one with hsn_code NULL (the default rate) and one
--     with hsn_code = '6109' (the HSN-specific rate gst-tax-computation.test.ts exercises).
--     gst-tax-computation.test.ts's own comment says "an active 18% default + HSN-6109 12% rate".
--     rate is numeric(5,4); the route's own toBps() treats a value <= 1 as a fraction, so 0.18/0.12.
--   - inventory_locations needs one row at the fixed id every one of these files already hard-codes
--     as LOCATION_ID ('69db8dab-95c7-43bd-b105-3b9d2c2dbf90', "snaz default location" per their own
--     comments), tied to snaz's store_id.
--   - merchant-tenant-predicate.test.ts's first two real-Postgres tests need at least one row each
--     in orders/order_items (site_id = snaz) and inventory_levels (store_id = snaz) --
--     `assert.ok(rows.length > 0, ...)`, never an exact count -- so a small, disposable seed order
--     (created through the real create_checkout_order RPC, the same one every other file's own
--     tests use, never a hand-crafted orders row) satisfies this precisely, without fabricating
--     "65 real orders" the code comments describe historically but the assertions never require.
--   - gift-card-money-path.test.ts's cross-tenant test additionally references a second,
--     unrelated site (OTHER_STORE_ID = 18f06a39-9f1d-418f-b582-c339a0193dcd) and looks up ANY of
--     its inventory_locations rows at runtime (no fixed id assumed) -- that one check is already
--     written to gracefully no-op if the location is missing (`if (crossLocation) { ... }`), so it
--     is a soft dependency, not a hard failure; seeded here anyway for full, intended test coverage
--     rather than a silently-skipped assertion.
--
-- Usage (idempotent -- safe to re-run against the same database any number of times):
--   docker exec -i <container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
--     < scripts/dev/seed-snaz-fixture.sql
-- or: node scripts/dev/seed-snaz-fixture.mjs
--
-- Never DELETEs or UPDATEs an existing row's business data (matching every one of these test
-- files' own "money-table discipline" -- money tables are additive only) except to fill in
-- gstin/gst_state_code ONLY when they are still NULL, so a later, real merchant-configured value
-- (set through the actual gateway endpoints, as gst-tax-computation.test.ts's own comment
-- describes the intended long-term path) is never clobbered by re-running this script.

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. snaz itself.
-- ---------------------------------------------------------------------------------------------
INSERT INTO sites (
    id, name, store_name, site_type, subdomain, status, published,
    currency, locale, gstin, gst_state_code, legal_name,
    created_at, updated_at
) VALUES (
    '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb', 'Snaz', 'Snaz', 'store', 'snaz', 'published', true,
    'INR', 'en-IN', '29AAAAA0000A1Z5', '29', 'Snaz Test Fixture Pvt Ltd',
    now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Fill in GST registration only if it is still unset -- never overwrite a real, later-configured
-- value (e.g. one set through the actual merchant settings API, the intended real path).
UPDATE sites
   SET gstin = '29AAAAA0000A1Z5',
       gst_state_code = '29'
 WHERE id = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb'
   AND gstin IS NULL;

-- The second, unrelated tenant gift-card-money-path.test.ts's cross-tenant check references.
INSERT INTO sites (
    id, name, store_name, site_type, subdomain, status, published,
    currency, locale, created_at, updated_at
) VALUES (
    '18f06a39-9f1d-418f-b582-c339a0193dcd', 'Snaz Cross-Tenant Fixture', 'Snaz Cross-Tenant Fixture',
    'store', 'snaz-cross-tenant-fixture', 'published', true,
    'INR', 'en-IN', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 2. Default inventory location for each site (inventory_levels.location_id is NOT NULL).
-- ---------------------------------------------------------------------------------------------
INSERT INTO inventory_locations (id, store_id, name, is_default, status, created_at)
VALUES (
    '69db8dab-95c7-43bd-b105-3b9d2c2dbf90', '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb',
    'Snaz Default Warehouse', true, 'active', now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_locations (id, store_id, name, is_default, status, created_at)
SELECT gen_random_uuid(), '18f06a39-9f1d-418f-b582-c339a0193dcd', 'Cross-Tenant Fixture Warehouse', true, 'active', now()
WHERE NOT EXISTS (
    SELECT 1 FROM inventory_locations
     WHERE store_id = '18f06a39-9f1d-418f-b582-c339a0193dcd' AND deleted_at IS NULL
);

-- ---------------------------------------------------------------------------------------------
-- 3. GST tax rates for snaz: an 18% default (hsn_code NULL) and a 12% HSN-6109 override.
--    tax_rates has no unique constraint on (store_id) WHERE hsn_code IS NULL, only the partial
--    index on (store_id, hsn_code) WHERE hsn_code IS NOT NULL -- WHERE NOT EXISTS covers both
--    uniformly rather than relying on two different conflict-target shapes.
-- ---------------------------------------------------------------------------------------------
INSERT INTO tax_rates (store_id, name, rate, hsn_code, is_active, is_shipping, priority, applies_to)
SELECT '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb', 'Snaz Default GST', 0.18, NULL, true, false, 0, 'all'
WHERE NOT EXISTS (
    SELECT 1 FROM tax_rates
     WHERE store_id = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb' AND hsn_code IS NULL AND deleted_at IS NULL
);

INSERT INTO tax_rates (store_id, name, rate, hsn_code, is_active, is_shipping, priority, applies_to)
SELECT '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb', 'Snaz HSN 6109 GST', 0.12, '6109', true, false, 10, 'all'
WHERE NOT EXISTS (
    SELECT 1 FROM tax_rates
     WHERE store_id = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb' AND hsn_code = '6109' AND deleted_at IS NULL
);

-- ---------------------------------------------------------------------------------------------
-- 4. A small amount of real order/order_items/inventory_levels history for snaz, created
--    through the real create_checkout_order RPC -- never a hand-crafted orders row -- so
--    merchant-tenant-predicate.test.ts's "snaz must carry real orders"/"real inventory rows"
--    checks (each asserting only `.length > 0`, never an exact count) have something real to
--    find regardless of which test file runs first in a freshly-created database. Conditional on
--    no snaz orders already existing, so re-running this script does not keep adding more.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
    v_product_id uuid;
    v_order_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders WHERE site_id = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb') THEN
        v_product_id := gen_random_uuid();

        INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
        VALUES (v_product_id, '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb', 'SNAZ-SEED Fixture Product', 199.00, 'SNAZ-SEED-PRODUCT', true, now(), now());

        INSERT INTO inventory_levels (
            id, store_id, product_id, variant_id, location_id,
            available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb', v_product_id, NULL, '69db8dab-95c7-43bd-b105-3b9d2c2dbf90',
            25, 0, 0, 25, 0, 25,
            now(), now()
        );

        SELECT (create_checkout_order(
            '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb'::uuid, 'Snaz Seed Buyer', 'snaz-seed-buyer@example.invalid', '9000000099',
            '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}'::jsonb,
            ('[{"product_id":"' || v_product_id || '","quantity":1}]')::jsonb,
            'cod', NULL, NULL, NULL, 'standard',
            'snaz-seed-order-idem', NULL, 'snaz-seed-order-req'
        ) ->> 'id')::uuid INTO v_order_id;

        RAISE NOTICE 'snaz seed order created: %', v_order_id;
    ELSE
        RAISE NOTICE 'snaz already has order history -- skipped seed order';
    END IF;
END $$;

COMMIT;
