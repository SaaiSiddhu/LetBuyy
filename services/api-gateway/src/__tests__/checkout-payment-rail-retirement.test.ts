/**
 * Phase M1 — non-canonical payment-rail retirement, behavioural regression tests.
 *
 * DOC 03 row 11 (Payments): "Single capture adapter -> posts canonical ledger;
 * money-in MoR-on-own-Razorpay; one payments row." LETBUYY_FOUNDATION_ROADMAP.md
 * P5/W-03 commits to "retire legacy app-local checkout/Stripe/PayPal handlers from
 * the live path." This exercises the REAL mounted app (`app.route('/storefront',
 * storefrontRouter)`, matching services/api-gateway/src/index.ts:752) rather than a
 * re-implementation, so a route accidentally left registered — or a 500/503 standing
 * in for the expected 404 — fails here, not just in a source-text contract test.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Env } from '../index';
import storefrontRouter from '../routes/storefront';

const testDir = dirname(fileURLToPath(import.meta.url));
const routesPath = join(testDir, '../routes/storefront/checkout-payment-routes.ts');
const currentSource = readFileSync(routesPath, 'utf8');
const buyerCheckoutClient = readFileSync(join(testDir,
    '../../../../apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx'), 'utf8');

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: 'https://postgrest.checkout-rail-retirement.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    } as unknown as Env;
}

function storefrontApp(): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>();
    app.route('/storefront', storefrontRouter);
    return app;
}

// ─── A. Retired routes are unreachable through the real mount chain ───────────

const RETIRED_ROUTES = [
    '/storefront/any-subdomain/payments/stripe/checkout',
    '/storefront/any-subdomain/payments/paypal/order',
    '/storefront/any-subdomain/payments/paypal/capture',
    '/storefront/any-subdomain/payments/cashfree/order',
    '/storefront/any-subdomain/payments/cashfree/verify',
];

for (const path of RETIRED_ROUTES) {
    test(`retired route is unreachable (404, not 503/500): POST ${path}`, async () => {
        // No Supabase fixture is installed: a 404 must come from Hono's own router
        // finding no match, before any handler ever runs and needs a database.
        const response = await storefrontApp().request(
            path,
            { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
            env(),
        );
        assert.equal(response.status, 404, `${path} must return 404, not a handler-level error status`);
    });
}

test('none of the retired provider paths appear anywhere in the mounted storefront router tree', () => {
    for (const segment of ['/payments/stripe/', '/payments/paypal/', '/payments/cashfree/']) {
        assert.ok(
            !currentSource.includes(segment),
            `checkout-payment-routes.ts must not reference ${segment}`,
        );
    }
});

test('the buyer checkout component has no caller for the retired direct order or verify path', () => {
    for (const path of ['/payments/razorpay/order', '/payments/razorpay/verify', "fetch('/api/orders'"]) {
        assert.equal(buyerCheckoutClient.includes(path), false, `buyer checkout must use the hosted session instead of ${path}`);
    }
});

// ─── B. Retained order and legacy Razorpay drain routes remain mounted ────────
// These POST an intentionally incomplete body. If the route were gone, Hono's
// router would 404 before any validation middleware runs; getting a 400
// (schema-validation rejection) instead proves the route matched and its
// `validate('json', ...)` middleware executed — i.e. the route is still wired
// through the real mount chain exactly as before M1.

const SURVIVING_ROUTES = [
    '/storefront/any-subdomain/orders',
    '/storefront/any-subdomain/payments/razorpay/order',
    '/storefront/any-subdomain/payments/razorpay/verify',
];

for (const path of SURVIVING_ROUTES) {
    test(`retained route remains reachable and validates its body: POST ${path}`, async () => {
        const response = await storefrontApp().request(
            path,
            { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
            env(),
        );
        assert.notEqual(response.status, 404, `${path} must still be routed (M1 must not have removed it)`);
        assert.equal(response.status, 400, `${path} should reject an empty body with a validation error, not crash`);
    });
}

// ─── C. The security-critical Razorpay verify sequence is intact ─────────────
// Extends LB-13-B (tests/launch/lb13-security-trio.test.mjs): confirms the exact
// call sequence a signature-forgery/replay defense depends on is still present
// and still ordered signature-verify -> replay-guard -> ledger-confirm, in the
// unedited region of the file (everything M1 touched lives after these calls).

test('razorpay/verify keeps the replay guard before signature verification before ledger confirmation', () => {
    // Real order (matches the source, not an assumption): the cheap local replay
    // check runs before the external Razorpay signature-verification call, which
    // runs before the result is posted to the canonical ledger.
    const replayGuardIndex = currentSource.indexOf('assertProviderPaymentNotReplayed(');
    const verifyIndex = currentSource.indexOf('provider.verify(');
    const confirmIndex = currentSource.indexOf('paymentService.confirmPayment(');

    assert.ok(replayGuardIndex !== -1, 'razorpay/verify must call assertProviderPaymentNotReplayed(...)');
    assert.ok(verifyIndex !== -1, 'razorpay/verify must call provider.verify(...)');
    assert.ok(confirmIndex !== -1, 'razorpay/verify must call paymentService.confirmPayment(...)');
    assert.ok(replayGuardIndex < verifyIndex, 'the replay guard must precede signature verification');
    assert.ok(verifyIndex < confirmIndex, 'signature verification must precede posting to the canonical ledger');
});

test('razorpay/verify still fails closed on a provider_order_id mismatch before any provider call', () => {
    const mismatchIndex = currentSource.indexOf("order.payment_id !== body.razorpay_order_id");
    const verifyIndex = currentSource.indexOf('provider.verify(');
    assert.ok(mismatchIndex !== -1, 'the payment_id / razorpay_order_id mismatch check must still exist');
    assert.ok(mismatchIndex < verifyIndex, 'the mismatch check must run before calling the provider');
});
