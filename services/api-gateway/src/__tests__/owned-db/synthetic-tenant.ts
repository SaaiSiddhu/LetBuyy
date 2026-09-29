// Synthetic tenants for the gateway database suites.
//
// The suites used to lean on a merchant that already existed in the developer's restored stack (a fixed store id, a fixed
// warehouse id, GST registration and tax rates someone had seeded by hand, and a history of real orders). They now build
// what they need, inside the database the runner cloned for them, from nothing but this file and the migrations:
//
//   - every id is random per run, so no suite depends on an id, an owner or a row that any other run created;
//   - every identity is plainly synthetic (`.invalid` addresses, `syn-` subdomains, "Synthetic" names);
//   - nothing here removes a row afterwards. The suites keep the database's own protections active (GST invoices are
//     immutable, gift-card ledgers are append-only, order triggers fire), so there is no sane way to delete their output
//     by hand; the database is simply thrown away with the suite, which is the cleanup boundary.
//
// The shape is what the RPCs under test actually require (each column and rate below was read from the migrations and the
// checkout route, not guessed): a published store with a valid GSTIN and state code, a default inventory location
// (inventory_levels.location_id is NOT NULL), and the two GST rates the checkout route reads by HSN precedence.

import { randomUUID } from 'node:crypto';

export interface SyntheticTenant {
    siteId: string;
    locationId: string;
    subdomain: string;
    tag: string;
}

type Psql = (sql: string) => string;

export interface SeedOptions {
    /** A GSTIN and a place-of-supply state ('29', Karnataka), as issue_gst_invoice and the GST computation require. */
    gst?: boolean;
    /** An 18% default rate and a 12% HSN-6109 rate, as the checkout route resolves them. */
    taxRates?: boolean;
}

export function newSyntheticTenant(tag: string): SyntheticTenant {
    if (!/^[a-z0-9-]{1,20}$/.test(tag)) throw new Error('a tenant tag is lowercase letters, digits and hyphens');
    return { siteId: randomUUID(), locationId: randomUUID(), subdomain: `syn-${tag}-${randomUUID().slice(0, 8)}`, tag };
}

export function seedSyntheticTenant(psql: Psql, tenant: SyntheticTenant, options: SeedOptions = {}): void {
    const gst = options.gst ?? false;
    psql(`
        INSERT INTO sites (id, name, store_name, site_type, subdomain, status, published, currency, locale, gstin, gst_state_code, legal_name, created_at, updated_at)
        VALUES ('${tenant.siteId}', 'Synthetic ${tenant.tag}', 'Synthetic ${tenant.tag}', 'store', '${tenant.subdomain}', 'published', true, 'INR', 'en-IN',
                ${gst ? "'29AAAAA0000A1Z5'" : 'NULL'}, ${gst ? "'29'" : 'NULL'}, 'Synthetic Test Tenant Pvt Ltd', now(), now());
    `);
    psql(`
        INSERT INTO inventory_locations (id, store_id, name, is_default, status, created_at)
        VALUES ('${tenant.locationId}', '${tenant.siteId}', 'Synthetic Default Warehouse', true, 'active', now());
    `);
    if (options.taxRates) {
        psql(`
            INSERT INTO tax_rates (store_id, name, rate, hsn_code, is_active, is_shipping, priority, applies_to) VALUES
              ('${tenant.siteId}', 'Synthetic Default GST', 0.18, NULL, true, false, 0, 'all'),
              ('${tenant.siteId}', 'Synthetic HSN 6109 GST', 0.12, '6109', true, false, 10, 'all');
        `);
    }
}

/**
 * One real order for a tenant, placed through the real create_checkout_order RPC (never a hand-built orders row), so that
 * a suite that reads "the tenant's own orders and order items" has something genuine to read.
 */
export function seedSyntheticOrder(psql: Psql, tenant: SyntheticTenant): { productId: string; orderId: string } {
    const productId = randomUUID();
    psql(`
        INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
        VALUES ('${productId}', '${tenant.siteId}', 'Synthetic Seed Product', 199.00, 'SYN-SEED-${tenant.subdomain}', true, now(), now());
    `);
    psql(`
        INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
        VALUES (gen_random_uuid(), '${tenant.siteId}', '${productId}', NULL, '${tenant.locationId}', 25, 0, 0, 25, 0, 25, now(), now());
    `);
    const orderId = psql(`
        SELECT create_checkout_order(
            '${tenant.siteId}'::uuid, 'Synthetic Seed Buyer', 'syn-seed-buyer-${tenant.subdomain}@example.invalid', '9000000099',
            '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}'::jsonb,
            '[{"product_id":"${productId}","quantity":1}]'::jsonb,
            'cod', NULL, NULL, NULL, 'standard',
            'syn-seed-order-idem-${tenant.subdomain}', NULL, 'syn-seed-order-req-${tenant.subdomain}'
        ) ->> 'id';
    `);
    return { productId, orderId };
}
