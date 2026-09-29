import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const apiGatewaySrc = join(repoRoot, 'services/api-gateway/src');

function source(relativePath) {
    return readFileSync(join(apiGatewaySrc, relativePath), 'utf8');
}

// ─── LB-13-A: Directory PII leak removed ─────────────────────────────────────
test('LB-13-A: public-routes.ts directory route no longer joins users_custom or leaks owner PII', () => {
    const src = source('routes/storefront/public-routes.ts');

    // Confirm the PII join is gone from the directory route block
    assert.doesNotMatch(
        src,
        /users_custom!sites_custom_user_id_fkey/,
        'users_custom!sites_custom_user_id_fkey join must be removed from the directory route',
    );

    // Confirm the directory route no longer selects email
    // (check within the directory route block — locate it and check no bare 'email' appears in the select)
    const directoryRouteStart = src.indexOf("router.get('/directory'");
    assert.ok(directoryRouteStart > -1, "directory route must still exist");
    const directoryRouteBlock = src.slice(directoryRouteStart, directoryRouteStart + 1200);
    assert.doesNotMatch(
        directoryRouteBlock,
        /\bemail\b/,
        'directory route block must not contain email field selection',
    );

    // Confirm public-safe fields are still present
    assert.match(src, /store_name/, 'store_name must still be selected');
    assert.match(src, /logo_url/, 'logo_url must still be selected');
    assert.match(src, /status/, 'status must still be selected');
});

// ─── LB-13-B: Replay guard in storefront checkout verify ─────────────────────
// c96e443e (2026-08-26) changed the guard's first argument from the database client to the request
// context: it must read payment_transactions by a claimed-globally-unique provider id BEFORE any tenant
// is known, which only the unguarded client may do, and every call with the guarded one had been
// throwing so no Razorpay payment could ever verify. The invariant this test protects did not change --
// the guard is awaited on the verify path, with the same argument shape payments.ts uses, before the
// provider is asked to verify and before the payment is confirmed -- so the pins follow the new shape.
// What the guard DECIDES is proved against the real function in
// services/api-gateway/src/__tests__/payment-replay-guard.test.ts.
test('LB-13-B: checkout-payment-routes.ts storefront razorpay verify contains assertProviderPaymentNotReplayed', () => {
    const src = source('routes/storefront/checkout-payment-routes.ts');
    const payments = source('routes/payments.ts');

    assert.match(
        src,
        /assertProviderPaymentNotReplayed/,
        'assertProviderPaymentNotReplayed must be imported and called in checkout-payment-routes.ts',
    );

    // Verify the call uses the same argument shape as payments.ts
    const callShape = /await assertProviderPaymentNotReplayed\(c,\s*\{/;
    assert.match(src, callShape, 'assertProviderPaymentNotReplayed must be awaited with (c, { ... }) signature');
    assert.match(payments, callShape, 'payments.ts must use the same (c, { ... }) signature');
    assert.doesNotMatch(src, /assertProviderPaymentNotReplayed\(db,/, 'the guarded database client must not be passed back in');

    // Confirm it is placed before the provider verifies and before confirmPayment (replay guard first)
    const replayGuardIndex = src.indexOf('await assertProviderPaymentNotReplayed(c,');
    const providerVerifyIndex = src.indexOf('provider.verify(');
    const confirmPaymentIndex = src.indexOf('paymentService.confirmPayment(');
    assert.ok(replayGuardIndex > -1, 'replay guard call must be present');
    assert.ok(providerVerifyIndex > -1, 'provider.verify call must be present');
    assert.ok(confirmPaymentIndex > -1, 'confirmPayment call must be present');
    assert.ok(
        replayGuardIndex < providerVerifyIndex,
        'assertProviderPaymentNotReplayed must appear before the provider verifies in the verify route',
    );
    assert.ok(
        replayGuardIndex < confirmPaymentIndex,
        'assertProviderPaymentNotReplayed must appear before confirmPayment in the verify route',
    );
});

// ─── LB-13-C: Rate limiters applied to storefront customer login ──────────────
test('LB-13-C: public-routes.ts applies sensitiveRateLimit to storefront customer login paths', () => {
    const src = source('routes/storefront/public-routes.ts');

    // sensitiveRateLimit must be imported
    assert.match(src, /sensitiveRateLimit/, 'sensitiveRateLimit must be imported in public-routes.ts');

    // sensitiveRateLimit must be applied to /customer/login path
    assert.match(
        src,
        /\/customer\/login[\s\S]{0,200}sensitiveRateLimit/,
        'sensitiveRateLimit must be applied to /customer/login route',
    );
});

// ─── LB-13-D: Rate limiters applied to checkout payment POST routes ───────────
test('LB-13-D: public-routes.ts applies authRateLimit to checkout payment POST routes', () => {
    const src = source('routes/storefront/public-routes.ts');

    // authRateLimit must be imported
    assert.match(src, /authRateLimit/, 'authRateLimit must be imported in public-routes.ts');

    // authRateLimit must be applied before checkout payment route registrations
    const authRateLimitIndex = src.indexOf('authRateLimit');
    const checkoutRegistrationIndex = src.indexOf('registerStorefrontCheckoutPaymentRoutes');
    assert.ok(authRateLimitIndex > -1, 'authRateLimit must appear in public-routes.ts');
    assert.ok(
        authRateLimitIndex < checkoutRegistrationIndex,
        'authRateLimit must be applied before checkout payment routes are registered',
    );

    // Confirm both payment POST paths have the limiter
    assert.match(src, /\/payments\/razorpay\/order[\s\S]{0,200}authRateLimit/, 'authRateLimit must cover razorpay order path');
    assert.match(src, /\/payments\/razorpay\/verify[\s\S]{0,200}authRateLimit/, 'authRateLimit must cover razorpay verify path');
});
