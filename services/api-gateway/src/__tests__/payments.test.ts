import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

function repositoryPathExists(path: string): boolean {
    return existsSync(join(repositoryRoot, path));
}

// D-16 (owner, 2026-09-05): the retired non-canonical rails were SAFE_DELETEd. Their assertions
// below changed from "exists but is inert" to "is absent" — the DEL-R3 ordering, retargeted before
// the source was removed.
const RETIRED_ADAPTER_PATHS = [
    'packages/infrastructure/stripe-adapter/index.ts',
    'packages/infrastructure/paypal-adapter/index.ts',
    'packages/infrastructure/cashfree-adapter/index.ts',
];

test('razorpay order creation rejects stale client amounts and recalculates totals server-side', () => {
    const internalPaymentSource = source('routes/storefront/internal-payment-routes.ts');
    const paymentsSource = source('routes/payments.ts');
    const paymentSupportSource = source('lib/payment-route-support.ts');
    const checkoutSchemaSource = repositorySource('packages/checkout-core/src/index.ts');

    assert.match(checkoutSchemaSource, /StorefrontRazorpayOrderSchema[\s\S]*amountMinorUnits/);
    assert.match(checkoutSchemaSource, /RazorpayOrderSchema[\s\S]*amount_minor_units/);
    assert.match(internalPaymentSource, /new PaymentExecutionAdapter\(db\)\.loadStorefrontPayableOrder\(orderId,\s*storeId\)/);
    assert.match(paymentsSource, /const order = await loadPayableOrder\(c,\s*body\.order_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(paymentsSource, /const amountMinorUnits = Math\.round\(order\.total \* 100\)/);
    assert.match(paymentsSource, /requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits/);
    assert.match(paymentSupportSource, /code:\s*'AMOUNT_MISMATCH'/);
});

test('razorpay order creation stores idempotency before provider calls', () => {
    const internalPaymentSource = source('routes/storefront/internal-payment-routes.ts');
    const paymentsSource = source('routes/payments.ts');

    assert.match(internalPaymentSource, /idempotencyKey: body\.idempotencyKey \|\| null/);

    assert.match(paymentsSource, /scope:\s*`payment\.razorpay\.order:\$\{body\.order_id\}`/);
    assert.match(paymentsSource, /const claim = await idempotency\.begin\(/);
    assert.match(paymentsSource, /const razorpayOrder = await createRazorpayOrder/);
    assert.ok(
        paymentsSource.indexOf('const claim = await idempotency.begin(') <
        paymentsSource.indexOf('const razorpayOrder = await createRazorpayOrder')
    );
});

test('razorpay payment verification validates signatures before confirming payment', () => {
    const paymentsSource = source('routes/payments.ts');
    const paymentSupportSource = source('lib/payment-route-support.ts');
    const hardeningMigration = repositorySource('database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql');

    // D-PLATFORM-CHARGE: the route no longer hand-rolls WebCrypto. These four assertions used to pin
    // the HMAC construction INSIDE routes/payments.ts; they now pin it in the one verifier both the
    // storefront-order and platform-charge paths call. The property is identical — Razorpay's
    // `${order_id}|${payment_id}` payload, HMAC-SHA256 with the key secret, compared in constant
    // time — and it is now asserted once for every caller instead of once per copy.
    const verifierSource = repositorySource('services/api-gateway/src/lib/provider-payment-verification.ts');
    assert.match(verifierSource, /return `\$\{providerOrderId\}\|\$\{providerPaymentId\}`/);
    assert.match(verifierSource, /await hmacSha256Hex\(keySecret, razorpaySignaturePayload\(/);
    assert.match(verifierSource, /!timingSafeEqualHex\(expected, input\.signature\)/);
    // And the route must NOT have kept a second copy: two HMAC constructions for one provider is how
    // a fix gets applied to one of them.
    assert.ok(!/crypto\.subtle\.importKey\(/.test(paymentsSource),
        'the route must delegate signature verification rather than hand-roll a second copy');
    assert.match(paymentSupportSource, /export async function assertProviderPaymentNotReplayed/);
    assert.match(paymentSupportSource, /\.from\('payment_transactions'\)/);
    assert.match(paymentSupportSource, /\.eq\('gateway',\s*params\.provider\)/);
    assert.match(paymentSupportSource, /\.eq\('provider_payment_id',\s*params\.providerPaymentId\)/);
    assert.match(paymentSupportSource, /replay\.order_id && replay\.order_id !== params\.orderId/);
    assert.match(paymentSupportSource, /Payment already verified for another order/);
    // GW-1: the first argument is the CONTEXT, not a client. cfd1ad03 moved client construction
    // inside assertProviderPaymentNotReplayed so it could use the unguarded service client — the
    // replay question is "has this payment id been used by ANYONE", which the tenant query guard
    // rejects outright on payment_transactions. Asserting the old `(db,` spelling made this test red
    // while the protection itself was correct and wired.
    assert.match(paymentsSource, /await assertProviderPaymentNotReplayed\(c,\s*\{/);
    // ...and the reason it takes the context: it builds the UNGUARDED client itself. Without this the
    // signature change above would look like a cosmetic rename.
    assert.match(paymentSupportSource, /const db = getSupabaseAdminUnguarded\(c\);/);
    assert.match(paymentsSource, /paymentService\.confirmPayment\(\{/);
    assert.match(hardeningMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment_global/);
    assert.match(hardeningMigration, /ON public\.payment_transactions \(gateway, provider_payment_id\)/);
    assert.match(hardeningMigration, /WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL/);
    // D-PLATFORM-CHARGE moved the signature check AND the fail-closed reference binding into one
    // shared verifier, so platform charges are checked by the same code with a different stored
    // reference. This assertion moved with them and got STRONGER rather than looser: it now pins the
    // ordering across both files, and pins the binding's existence in its new home. Anchoring on the
    // old inline text would have gone quietly green-by-absence the moment the code moved.
    const verifySource = repositorySource('services/api-gateway/src/lib/provider-payment-verification.ts');
    const verifyCallIndex = paymentsSource.indexOf('await verifyRazorpayPayment(c.env.RAZORPAY_KEY_SECRET, {');
    const replayGuardIndex = paymentsSource.indexOf('await assertProviderPaymentNotReplayed(c,');
    const confirmAdapterIndex = paymentsSource.indexOf('const paymentService = new PaymentExecutionAdapter(db)', replayGuardIndex);
    assert.ok(verifyCallIndex > -1, 'the route must verify through the shared verifier');
    assert.ok(replayGuardIndex > verifyCallIndex, 'replay protection runs after verification');
    assert.ok(confirmAdapterIndex > replayGuardIndex, 'and confirmation after replay protection');
    // The route must pass the SERVER-stored reference, not anything from the request body.
    assert.match(paymentsSource, /storedProviderOrderId:\s*order\.payment_id/);

    // The verifier itself: signature BEFORE binding, and the binding fails closed on a null stored
    // reference — the two properties that used to be inline here.
    const signatureIndex = verifySource.indexOf('timingSafeEqualHex(expected, input.signature)');
    const bindingIndex = verifySource.indexOf('!input.storedProviderOrderId || input.storedProviderOrderId !== input.providerOrderId');
    assert.ok(signatureIndex > -1, 'the verifier compares signatures in constant time');
    assert.ok(bindingIndex > signatureIndex, 'signature is checked before the reference binding');
    assert.match(verifySource, /if \(!keySecret\) return \{ ok: false, reason: 'provider_not_configured' \}/,
        'and it fails closed when the provider is not configured');
});

test('razorpay webhook verifies raw-body signatures, persists event ids, and deduplicates retries', () => {
    const webhookSource = repositorySource('services/webhook-service/src/index.ts');

    assert.match(webhookSource, /const body = await c\.req\.text\(\)/);
    assert.match(webhookSource, /createRazorpayPaymentProvider/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"razorpay"/);
    assert.match(webhookSource, /secret:\s*c\.env\.RAZORPAY_WEBHOOK_SECRET/);
    // F-WEBHOOKTEST-1. This was a literal match on
    //   return c.json({ error: "Invalid signature" }, 400)
    // and it had been failing for a long time — not because the guard weakened, but because it was
    // STRENGTHENED. The rejection now requires TWO independent checks and the body became a ternary so
    // a missing signature is distinguished from an invalid one, which is what stopped the literal
    // matching. A guard sensitive to WORDING rather than to REMOVAL is worse than no guard: this one
    // sat in the ambient red set for nine phases, and had the rejection actually been deleted it would
    // have failed in exactly the same way. What follows pins the property instead.
    //
    // Both flags are required in ONE guard. Dropping either one must fail here.
    assert.match(
        webhookSource,
        /if \(!timingSafeSignatureValid \|\| !verification\.verified\) \{/,
        'the rejection must require BOTH the timing-safe HMAC comparison and the provider verification',
    );
    // The guard answers 400, and "Invalid signature" is still what a bad signature gets.
    const rejection = webhookSource.slice(webhookSource.indexOf('if (!timingSafeSignatureValid'));
    assert.match(rejection.slice(0, 600), /return c\.json\(\{ error:[^}]*"Invalid signature"[^}]*\},\s*400\)/);
    // The comparison is constant-time and fails CLOSED when either input is absent — the property that
    // makes the first flag worth requiring at all.
    assert.match(webhookSource, /async function verifyRazorpayWebhookSignature\(/);
    assert.match(webhookSource, /if \(!signature \|\| !secret\) return false;/);
    assert.match(webhookSource, /return timingSafeEqual\(expected, signature\)/);
    assert.match(webhookSource, /writeWebhookEvent\(c\.env,\s*\{/);
    assert.match(webhookSource, /onConflict:\s*"provider,provider_event_id"/);
    assert.match(webhookSource, /if \(recorded\.duplicate\)/);
    assert.match(webhookSource, /case "payment\.captured"/);
    assert.match(webhookSource, /await markOrderPaid\(c\.env,\s*order,/);
    assert.match(webhookSource, /await markWebhookEvent\(c\.env,\s*"razorpay",\s*providerEventId,\s*"processed"\)/);
});

test('the razorpay webhook is centralized in webhook-service; retired provider webhooks are gone (Phase M1, DOC 03 row 11)', () => {
    const webhookSource = repositorySource('services/webhook-service/src/index.ts');

    assert.match(webhookSource, /app\.post\("\/razorpay"/);
    // Phase M1 retired the Stripe/PayPal/Cashfree webhook ingress: after the
    // live routes that could create those sessions were cut, nothing could
    // ever generate a legitimate event for these endpoints, so the ingress
    // itself was pure attack surface. See
    // services/webhook-service/test/payment-webhook-retirement.test.mjs.
    assert.doesNotMatch(webhookSource, /app\.post\("\/stripe"/);
    assert.doesNotMatch(webhookSource, /app\.post\("\/paypal"/);
    assert.doesNotMatch(webhookSource, /app\.post\("\/cashfree"/);
    assert.doesNotMatch(webhookSource, /webhookVerify\(\{\s*provider:\s*"stripe"/);
    assert.doesNotMatch(webhookSource, /webhookVerify\(\{\s*provider:\s*"paypal"/);
    assert.doesNotMatch(webhookSource, /webhookVerify\(\{\s*provider:\s*"cashfree"/);
    assert.match(webhookSource, /emitPaymentDomainEvent/);
    assert.match(webhookSource, /emitGatewayDomainEvent/);
    assert.doesNotMatch(webhookSource, /["']outbox_events["']/);

    // That SAFE_DELETE has since happened (D-16, phase F-INFRA-2), so the adapters are no longer
    // read here at all — their absence is asserted once, below.
});

test('the retired Stripe/PayPal/Cashfree adapters are gone, not merely unreachable (D-16, DEL-R2 SAFE_DELETE)', () => {
    // Phase M1 cut the live routes that could reach these rails and left the adapters in place,
    // recording that deleting them was "a separate SAFE_DELETE gated on zero importers". F-INFRA-1
    // measured that gate at zero and the owner authorised the delete (D-16). Unreachable code that
    // still compiles is one import away from being reachable again, and these 29 type errors were
    // also cancelling the typecheck of every package downstream of @letbuyy/infrastructure —
    // including the gateway.
    for (const path of RETIRED_ADAPTER_PATHS) {
        assert.ok(!repositoryPathExists(path), `${path} must not exist: it was SAFE_DELETEd under D-16`);
    }

    // The package surface must not offer them either. A subpath export or a barrel re-export that
    // outlives the file is a broken specifier at best and a resurrection target at worst.
    const infrastructurePackage = repositorySource('packages/infrastructure/package.json');
    const infrastructureBarrel = repositorySource('packages/infrastructure/src/index.ts');
    for (const rail of ['stripe', 'paypal', 'cashfree']) {
        assert.ok(
            !infrastructurePackage.includes(`${rail}-adapter`),
            `packages/infrastructure/package.json must not export ./${rail}-adapter`,
        );
        assert.ok(
            !infrastructureBarrel.includes(`${rail}-adapter`),
            `packages/infrastructure/src/index.ts must not re-export ${rail}-adapter`,
        );
    }

    // The Stripe SDK entered the dependency tree only for the deleted adapter; nothing else imports
    // it, so it leaves with it. A payment SDK nobody calls is pure supply-chain surface.
    assert.doesNotMatch(
        infrastructurePackage,
        /"stripe"\s*:/,
        'the stripe npm dependency existed only for the deleted adapter and must go with it',
    );

    // The canonical rails are untouched — this test proves a deletion, never an erosion.
    assert.ok(repositoryPathExists('packages/infrastructure/razorpay-adapter/index.ts'));
    assert.ok(repositoryPathExists('packages/infrastructure/cod-adapter/index.ts'));
});

test('payment provider adapters implement the unified payments contract', () => {
    const razorpayAdapter = repositorySource('packages/infrastructure/razorpay-adapter/index.ts');
    const codAdapter = repositorySource('packages/infrastructure/cod-adapter/index.ts');

    assert.match(razorpayAdapter, /createRazorpayPaymentProvider/);
    assert.match(razorpayAdapter, /PaymentProvider/);
    assert.match(razorpayAdapter, /normalizeIdempotencyKey/);
    assert.match(razorpayAdapter, /webhookVerify/);
    assert.match(razorpayAdapter, /hmacSha256Hex\(credentials\.keySecret,\s*`\$\{input\.providerOrderId\}\|\$\{input\.providerPaymentId\}`/);

    // Only the two CANONICAL rails have adapters now (D-16). The contract this test names is the
    // one they implement; a retired rail cannot implement it because it does not exist.
    for (const adapter of [codAdapter]) {
        assert.match(adapter, /PaymentProvider/);
        assert.match(adapter, /createIntent/);
        assert.match(adapter, /verify/);
        assert.match(adapter, /capture/);
        assert.match(adapter, /refund/);
        assert.match(adapter, /webhookVerify/);
    }

    assert.match(codAdapter, /COD requires OTP\/call verification/);
});

test('Task 004 generic payment sessions are persisted, tenant-scoped, sandbox-first, and live-gated', () => {
    const paymentsSource = source('routes/payments.ts');
    const paymentSupportSource = source('lib/payment-route-support.ts');
    const paymentPackage = repositorySource('packages/payments/src/index.ts');
    const migration = repositorySource('database/supabase/migrations/142_executable_payment_sessions.sql');
    const rollback = repositorySource('database/supabase/rollback/142_executable_payment_sessions.rollback.sql');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');
    const liveSkips = repositorySource('tests/executable/human-required-live-paths.test.mjs');

    assert.match(paymentPackage, /export type PaymentProviderMode = 'sandbox' \| 'live'/);
    assert.match(paymentPackage, /buildSandboxPaymentSessionPlan/);
    assert.match(paymentPackage, /livePaymentCredentialsAreRequired/);
    assert.match(paymentsSource, /router\.post\('\/sessions'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/capture'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/void'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/refund'/);
    assert.match(paymentsSource, /requireLivePaymentCredential/);
    assert.match(paymentSupportSource, /HR-MERCHANT-PSP-LIVE/);
    assert.match(paymentsSource, /paymentSetupRequiredResponse/);
    assert.match(paymentsSource, /buildSandboxPaymentSessionPlan/);
    assert.match(paymentsSource, /new IdempotencyExecutionAdapter\(db\)/);
    assert.match(paymentsSource, /emitPaymentEvent/);
    assert.match(paymentsSource, /eventType:\s*'payment\.captured'/);
    assert.match(paymentsSource, /eventType:\s*'payment\.refunded'/);

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payment_credentials/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payment_tokens/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payments/);
    assert.match(migration, /encrypted_credentials jsonb NOT NULL/);
    assert.match(migration, /CHECK \(mode IN \('sandbox', 'live'\)\)/);
    assert.doesNotMatch(migration, /DEFAULT 'mock'|mock-kms/);
    assert.match(migration, /'upi'::text/);
    assert.match(migration, /payment_transactions_provider_payment_id_v1_uniq/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /payments_tenant_site_guc/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.payments/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.payment_credentials/);
    assert.match(humanRequired, /HR-MERCHANT-PSP-LIVE/);
    assert.match(liveSkips, /\[HUMAN-REQUIRED\] HR-MERCHANT-PSP-LIVE/);
});

test('storefront runtime no longer owns payment route handlers', () => {
    const removedRoutes = [
        'apps/customer_web/src/app/api/payments/paypal/capture/route.ts',
        'apps/customer_web/src/app/api/payments/paypal/create/route.ts',
        'apps/customer_web/src/app/api/payments/paypal/webhook/route.ts',
        'apps/customer_web/src/app/api/payments/razorpay/create/route.ts',
        'apps/customer_web/src/app/api/payments/razorpay/verify/route.ts',
        'apps/customer_web/src/app/api/payments/stripe/checkout/route.ts',
        'apps/customer_web/src/app/api/payments/stripe/webhook/route.ts',
    ];

    for (const route of removedRoutes) {
        assert.throws(() => repositorySource(route), /ENOENT/);
    }

    const checkoutClient = repositorySource('apps/customer_web/src/app/store/[subdomain]/checkout/checkout-client.tsx');
    const paypalReturn = repositorySource('apps/customer_web/src/app/store/[subdomain]/checkout/paypal-return/page.tsx');
    const browserClient = repositorySource('apps/customer_web/src/lib/api/browser-client.ts');

    assert.doesNotMatch(checkoutClient, /\/api\/payments/);
    assert.doesNotMatch(paypalReturn, /\/api\/payments/);
    assert.doesNotMatch(browserClient, /NEXT_PUBLIC_API_BASE_URL|NEXT_PUBLIC_API_URL|LETBUYY_PRODUCTION_API_BASE_URL/);
    assert.match(browserClient, /apiClientInputToLetbuyyApiPath/);
    assert.match(browserClient, /resolveLetbuyyApiBaseUrl/);
    assert.match(browserClient, /`\/api\/storefront\/\$\{encodeURIComponent\(subdomain\)\}\$\{apiPath\}`/);
    assert.match(checkoutClient, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/razorpay\/order'/);
    assert.match(checkoutClient, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/razorpay\/verify'/);
});

test('gateway no longer owns an authenticated Stripe checkout route (Phase M1, DOC 03 row 11)', () => {
    const paymentsSource = source('routes/payments.ts');

    assert.doesNotMatch(paymentsSource, /router\.post\(\s*'\/stripe\/checkout'/);
    assert.doesNotMatch(paymentsSource, /StripeCheckoutSchema/);
    assert.doesNotMatch(paymentsSource, /createStripeCheckoutSessionWithFetch/);
    assert.doesNotMatch(paymentsSource, /@letbuyy\/infrastructure\/stripe-adapter/);

    // The authenticated-mount Next.js proxy for this endpoint is already gone (asserted
    // above); this closes the corresponding gateway-side handler the prior test's
    // ENOENT list did not cover, per PROMPTS.md CANONICAL-* handoff W2.
    assert.throws(
        () => repositorySource('apps/customer_web/src/app/api/payments/stripe/checkout/route.ts'),
        /ENOENT/,
    );

    // Razorpay routes on the same authenticated router are untouched.
    assert.match(paymentsSource, /router\.post\(\s*'\/razorpay\/order'/);
    assert.match(paymentsSource, /router\.post\(\s*'\/razorpay\/verify'/);
});
