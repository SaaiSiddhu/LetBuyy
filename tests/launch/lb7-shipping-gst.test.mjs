import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// LB-7 + GST (V1_SCOPE_LOCK_2026_06_12):
//   - Live checkout charges merchant-configured shipping rates resolved server-side.
//   - GST is computed server-side in the gateway, never trusted from the client.
//   - Legacy fallback (express=99/standard=0) preserved for stores without rates.
//   - Coupon API rejects bogo type (422) — V1 scope lock.

const repoRoot = process.cwd();

// ---------------------------------------------------------------------------
// 1. Migration 170 exists and contains required markers.
// ---------------------------------------------------------------------------

const MIGRATION_170 = path.join(
    repoRoot,
    'database/supabase/migrations/170_v1_shipping_rates_gst.sql',
);

test('LB-7: migration 170_v1_shipping_rates_gst.sql exists', () => {
    assert.ok(existsSync(MIGRATION_170), `Expected ${MIGRATION_170} to exist`);
});

test('LB-7: migration 170 declares the new p_shipping_rate_id parameter', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    assert.match(
        sql,
        /p_shipping_rate_id\s+uuid\s+DEFAULT\s+NULL/i,
        'migration 170 must declare p_shipping_rate_id uuid DEFAULT NULL',
    );
});

test('LB-7: migration 170 declares the new p_tax_amount parameter', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    assert.match(
        sql,
        /p_tax_amount\s+numeric.*DEFAULT\s+NULL/i,
        'migration 170 must declare p_tax_amount numeric DEFAULT NULL',
    );
});

test('LB-7: migration 170 wraps in a transaction (BEGIN / COMMIT)', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    assert.match(sql, /^\s*BEGIN\s*;/m, 'migration 170 must start with BEGIN;');
    assert.match(sql, /^\s*COMMIT\s*;/m, 'migration 170 must end with COMMIT;');
});

test('LB-7: migration 170 recreates idempotently with a guarded overload retirement', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    // Strip SQL line comments so rollback guidance in the header (which mentions
    // DROP FUNCTION as the manual rollback step) does not taint statement checks.
    const exec = sql.replace(/--[^\n]*/g, '');

    // Must recreate idempotently — never a bare CREATE FUNCTION (which would lose
    // any default grants and break the SECURITY DEFINER contract on replace).
    assert.match(
        sql,
        /CREATE\s+OR\s+REPLACE\s+FUNCTION/i,
        'migration 170 must use CREATE OR REPLACE FUNCTION',
    );
    assert.doesNotMatch(
        exec,
        /\bCREATE\s+FUNCTION\b/i,
        'migration 170 must not use a bare CREATE FUNCTION (use CREATE OR REPLACE)',
    );

    // The prior 14-arg create_checkout_order overload MUST be retired in the same
    // transaction: adding two trailing params changes the signature, so without a
    // drop PostgREST resolves rpc() calls ambiguously (PGRST203) and every existing
    // 14-name call breaks. The retirement must use the idempotent guarded form.
    assert.match(
        exec,
        /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_checkout_order/i,
        'migration 170 must retire the old overload via DROP FUNCTION IF EXISTS public.create_checkout_order',
    );
});

test('LB-7: migration 170 preserves legacy fallback (express=99 / standard=0)', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    assert.match(
        sql,
        /express.*99|99.*express/i,
        'migration 170 must keep the express=99 legacy path',
    );
    assert.match(
        sql,
        /standard.*:=\s*0|v_shipping_amount\s*:=\s*0/i,
        'migration 170 must keep the standard=0 legacy path',
    );
});

test('LB-7: migration 170 includes rollback instructions in the header comment', () => {
    const sql = readFileSync(MIGRATION_170, 'utf8');
    assert.match(
        sql,
        /[Rr]ollback/,
        'migration 170 header must contain rollback guidance',
    );
});

// ---------------------------------------------------------------------------
// 2. Shipping rate resolver library exists.
// ---------------------------------------------------------------------------

const RESOLVER_PATH = path.join(
    repoRoot,
    'services/api-gateway/src/lib/shipping-rate-resolver.ts',
);

test('LB-7: shipping-rate-resolver.ts exists in gateway lib', () => {
    assert.ok(existsSync(RESOLVER_PATH), `Expected ${RESOLVER_PATH} to exist`);
});

test('LB-7: resolver throws on unknown rate id, returns null for no-rates store', () => {
    const src = readFileSync(RESOLVER_PATH, 'utf8');
    assert.match(
        src,
        /throw\s+new\s+Error/,
        'resolver must throw when a rate ID cannot be validated',
    );
    // Returns null when store has no rates configured.
    assert.match(
        src,
        /return\s+null/,
        'resolver must return null for stores without configured rates',
    );
});

// ---------------------------------------------------------------------------
// 3. Gateway order-execution adapter passes new RPC params.
// ---------------------------------------------------------------------------

const ADAPTER_PATH = path.join(
    repoRoot,
    'services/api-gateway/src/execution/order-execution.adapter.ts',
);

test('LB-7: order-execution adapter forwards p_shipping_rate_id to RPC', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    assert.match(
        src,
        /p_shipping_rate_id/,
        'adapter must pass p_shipping_rate_id to create_checkout_order RPC',
    );
});

test('LB-7: order-execution adapter forwards p_tax_amount to RPC', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    assert.match(
        src,
        /p_tax_amount/,
        'adapter must pass p_tax_amount to create_checkout_order RPC',
    );
});

// ---------------------------------------------------------------------------
// 4. Storefront checkout-payment route computes GST and resolves rate server-side.
// ---------------------------------------------------------------------------

const CHECKOUT_PAYMENT_ROUTE = path.join(
    repoRoot,
    'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts',
);

test('LB-7: checkout-payment route imports calculateGstLine', () => {
    const src = readFileSync(CHECKOUT_PAYMENT_ROUTE, 'utf8');
    assert.match(
        src,
        /calculateGstLine/,
        'checkout-payment-routes.ts must import calculateGstLine',
    );
});

test('LB-7: checkout-payment route calls resolveShippingRate', () => {
    const src = readFileSync(CHECKOUT_PAYMENT_ROUTE, 'utf8');
    assert.match(
        src,
        /resolveShippingRate/,
        'checkout-payment-routes.ts must call resolveShippingRate',
    );
});

test('LB-7: checkout-payment route does NOT trust client-supplied shipping amount directly', () => {
    const src = readFileSync(CHECKOUT_PAYMENT_ROUTE, 'utf8');
    // Must not write body.shippingAmount or body.shipping_amount straight to the order command.
    assert.doesNotMatch(
        src,
        /shipping_amount\s*:\s*body\./,
        'checkout route must not copy body.shipping_amount verbatim into the order command',
    );
});

// ---------------------------------------------------------------------------
// 5. Hosted checkout delivery step no longer stores verbatim client price.
// ---------------------------------------------------------------------------

const HOSTED_CHECKOUT_ROUTE = path.join(
    repoRoot,
    'services/api-gateway/src/routes/checkout.ts',
);

test('LB-7: hosted checkout delivery step uses server_resolved flag', () => {
    const src = readFileSync(HOSTED_CHECKOUT_ROUTE, 'utf8');
    assert.match(
        src,
        /server_resolved\s*:\s*true/,
        'checkout.ts delivery step must tag the persisted quote with server_resolved: true',
    );
});

test('LB-7: hosted checkout delivery step calls resolveShippingRate', () => {
    const src = readFileSync(HOSTED_CHECKOUT_ROUTE, 'utf8');
    assert.match(
        src,
        /resolveShippingRate/,
        'checkout.ts delivery step must call resolveShippingRate',
    );
});

// ---------------------------------------------------------------------------
// 6. Storefront checkout client fetches rates and sends shippingRateId.
// ---------------------------------------------------------------------------

const CHECKOUT_CLIENT = path.join(
    repoRoot,
    'apps/customer_web/src/app/store/[subdomain]/checkout/checkout-client.tsx',
);

test('LB-7: checkout-client.tsx fetches /api/shipping/rates', () => {
    const src = readFileSync(CHECKOUT_CLIENT, 'utf8');
    assert.match(
        src,
        /\/api\/shipping\/rates/,
        'checkout-client.tsx must fetch /api/shipping/rates for rate display',
    );
});

test('LB-7: checkout-client.tsx sends shippingRateId in order payload', () => {
    const src = readFileSync(CHECKOUT_CLIENT, 'utf8');
    assert.match(
        src,
        /shippingRateId/,
        'checkout-client.tsx must include shippingRateId in the order payload',
    );
});

// ---------------------------------------------------------------------------
// 7. Storefront shipping-rates proxy route exists.
// ---------------------------------------------------------------------------

const STOREFRONT_RATES_PROXY = path.join(
    repoRoot,
    'apps/customer_web/src/app/api/shipping/rates/route.ts',
);

test('LB-7: storefront /api/shipping/rates proxy route exists', () => {
    assert.ok(
        existsSync(STOREFRONT_RATES_PROXY),
        `Expected ${STOREFRONT_RATES_PROXY} to exist`,
    );
});

test('LB-7: storefront rates proxy uses internalStorefrontApiFetch (never trusts client headers)', () => {
    const src = readFileSync(STOREFRONT_RATES_PROXY, 'utf8');
    assert.match(
        src,
        /internalStorefrontApiFetch/,
        'storefront rates proxy must use internalStorefrontApiFetch to add internal API secret',
    );
});

// ---------------------------------------------------------------------------
// 8. Coupon API blocks bogo discount type (V1 scope lock).
// ---------------------------------------------------------------------------

const COUPONS_ROUTE = path.join(
    repoRoot,
    'services/api-gateway/src/routes/coupons.ts',
);

test('LB-7: coupons POST route rejects bogo type with 422', () => {
    const src = readFileSync(COUPONS_ROUTE, 'utf8');
    // Find the POST handler block: from router.post('/', ...) to the next router.*
    const postIdx = src.indexOf("router.post('/'");
    assert.ok(postIdx > -1, 'coupons.ts must have a POST / route');
    // Take a generous slice covering the POST handler body.
    const postSection = src.slice(postIdx, postIdx + 1200);
    assert.match(
        postSection,
        /bogo/,
        'coupons POST handler must check for bogo',
    );
    assert.match(
        postSection,
        /422/,
        'coupons POST handler must return 422 for bogo',
    );
});

test('LB-7: coupons PATCH route rejects bogo type with 422', () => {
    const src = readFileSync(COUPONS_ROUTE, 'utf8');
    const patchIdx = src.indexOf("router.patch('/:id'");
    assert.ok(patchIdx > -1, 'coupons.ts must have a PATCH route');
    const patchSection = src.slice(patchIdx, patchIdx + 800);
    assert.match(patchSection, /bogo/, 'coupons PATCH handler must check for bogo');
    assert.match(patchSection, /422/, 'coupons PATCH handler must return 422 for bogo');
});

test('LB-7: coupons bogo guard returns UNSUPPORTED_DISCOUNT_TYPE error code', () => {
    const src = readFileSync(COUPONS_ROUTE, 'utf8');
    assert.match(
        src,
        /UNSUPPORTED_DISCOUNT_TYPE/,
        'coupons route must use UNSUPPORTED_DISCOUNT_TYPE error code',
    );
});

// ---------------------------------------------------------------------------
// 9. MCP rate proxy routes exist.
// ---------------------------------------------------------------------------

const MCP_RATES_POST = path.join(
    repoRoot,
    'apps/merchant_web/src/app/api/stores/[store]/shipping/rates/route.ts',
);
const MCP_RATES_DELETE = path.join(
    repoRoot,
    'apps/merchant_web/src/app/api/stores/[store]/shipping/rates/[rateId]/route.ts',
);

test('LB-7: MCP shipping rates POST proxy route exists', () => {
    assert.ok(existsSync(MCP_RATES_POST), `Expected ${MCP_RATES_POST} to exist`);
});

test('LB-7: MCP shipping rates DELETE proxy route exists', () => {
    assert.ok(
        existsSync(MCP_RATES_DELETE),
        `Expected ${MCP_RATES_DELETE} to exist`,
    );
});

// ---------------------------------------------------------------------------
// 10. MCP shipping settings page has rate add/remove UI wired.
// ---------------------------------------------------------------------------

const MCP_SHIPPING_PAGE = path.join(
    repoRoot,
    'apps/merchant_web/src/app/[store]/settings/shipping/page.tsx',
);

test('LB-7: MCP shipping page includes handleAddRate callback', () => {
    const src = readFileSync(MCP_SHIPPING_PAGE, 'utf8');
    assert.match(src, /handleAddRate/, 'shipping page must define handleAddRate');
});

test('LB-7: MCP shipping page includes handleDeleteRate callback', () => {
    const src = readFileSync(MCP_SHIPPING_PAGE, 'utf8');
    assert.match(
        src,
        /handleDeleteRate/,
        'shipping page must define handleDeleteRate',
    );
});

test('LB-7: MCP shipping page renders inline rate add form', () => {
    const src = readFileSync(MCP_SHIPPING_PAGE, 'utf8');
    assert.match(
        src,
        /Add rate/,
        'shipping page must render an "Add rate" control in the zone card',
    );
});
