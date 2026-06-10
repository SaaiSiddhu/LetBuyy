import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

    assert.match(paymentsSource, /crypto\.subtle\.importKey\(/);
    assert.match(paymentsSource, /encoder\.encode\(c\.env\.RAZORPAY_KEY_SECRET\)/);
    assert.match(paymentsSource, /const payload = `\$\{body\.razorpay_order_id\}\|\$\{body\.razorpay_payment_id\}`/);
    assert.match(paymentsSource, /crypto\.subtle\.sign\('HMAC',\s*key,\s*encoder\.encode\(payload\)\)/);
    assert.match(paymentsSource, /!timingSafeEqualHex\(expectedSig,\s*body\.razorpay_signature\)/);
    assert.match(paymentsSource, /if \(!order\.payment_id \|\| order\.payment_id !== body\.razorpay_order_id\)/);
    assert.match(paymentSupportSource, /export async function assertProviderPaymentNotReplayed/);
    assert.match(paymentSupportSource, /\.from\('payment_transactions'\)/);
    assert.match(paymentSupportSource, /\.eq\('gateway',\s*params\.provider\)/);
    assert.match(paymentSupportSource, /\.eq\('provider_payment_id',\s*params\.providerPaymentId\)/);
    assert.match(paymentSupportSource, /replay\.order_id && replay\.order_id !== params\.orderId/);
    assert.match(paymentSupportSource, /Payment already verified for another order/);
    assert.match(paymentsSource, /await assertProviderPaymentNotReplayed\(db,\s*\{/);
    assert.match(paymentsSource, /paymentService\.confirmPayment\(\{/);
    assert.match(hardeningMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment_global/);
    assert.match(hardeningMigration, /ON public\.payment_transactions \(gateway, provider_payment_id\)/);
    assert.match(hardeningMigration, /WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL/);
    const bindingGuardIndex = paymentsSource.indexOf('if (!order.payment_id || order.payment_id !== body.razorpay_order_id)');
    const replayGuardIndex = paymentsSource.indexOf('await assertProviderPaymentNotReplayed(db,');
    const confirmAdapterIndex = paymentsSource.indexOf('const paymentService = new PaymentExecutionAdapter(db)', replayGuardIndex);
    assert.ok(bindingGuardIndex > -1);
    assert.ok(replayGuardIndex > bindingGuardIndex);
    assert.ok(confirmAdapterIndex > replayGuardIndex);
});

test('razorpay webhook verifies raw-body signatures, persists event ids, and deduplicates retries', () => {
    const webhookSource = repositorySource('services/webhook-service/src/index.ts');

    assert.match(webhookSource, /const body = await c\.req\.text\(\)/);
    assert.match(webhookSource, /createRazorpayPaymentProvider/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"razorpay"/);
    assert.match(webhookSource, /secret:\s*c\.env\.RAZORPAY_WEBHOOK_SECRET/);
    assert.match(webhookSource, /return c\.json\(\{ error:\s*"Invalid signature" \},\s*400\)/);
    assert.match(webhookSource, /writeWebhookEvent\(c\.env,\s*\{/);
    assert.match(webhookSource, /onConflict:\s*"provider,provider_event_id"/);
    assert.match(webhookSource, /if \(recorded\.duplicate\)/);
    assert.match(webhookSource, /case "payment\.captured"/);
    assert.match(webhookSource, /await markOrderPaid\(c\.env,\s*order,/);
    assert.match(webhookSource, /await markWebhookEvent\(c\.env,\s*"razorpay",\s*providerEventId,\s*"processed"\)/);
});

test('provider webhooks are centralized in webhook-service', () => {
    const webhookSource = repositorySource('services/webhook-service/src/index.ts');
    const stripeAdapter = repositorySource('packages/infrastructure/stripe-adapter/index.ts');
    const paypalAdapter = repositorySource('packages/infrastructure/paypal-adapter/index.ts');
    const cashfreeAdapter = repositorySource('packages/infrastructure/cashfree-adapter/index.ts');

    assert.match(webhookSource, /app\.post\("\/razorpay"/);
    assert.match(webhookSource, /app\.post\("\/stripe"/);
    assert.match(webhookSource, /app\.post\("\/paypal"/);
    assert.match(webhookSource, /app\.post\("\/cashfree"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"stripe"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"paypal"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"cashfree"/);
    assert.match(webhookSource, /emitPaymentDomainEvent/);
    assert.match(webhookSource, /emitGatewayDomainEvent/);
    assert.doesNotMatch(webhookSource, /["']outbox_events["']/);

    assert.doesNotMatch(stripeAdapter, /constructWebhookEvent/);
    assert.doesNotMatch(paypalAdapter, /export async function verifyWebhookSignature/);
    assert.match(cashfreeAdapter, /x-webhook-timestamp/);
    assert.match(cashfreeAdapter, /x-webhook-signature/);
});

test('payment provider adapters implement the unified payments contract', () => {
    const razorpayAdapter = repositorySource('packages/infrastructure/razorpay-adapter/index.ts');
    const stripeAdapter = repositorySource('packages/infrastructure/stripe-adapter/index.ts');
    const paypalAdapter = repositorySource('packages/infrastructure/paypal-adapter/index.ts');
    const cashfreeAdapter = repositorySource('packages/infrastructure/cashfree-adapter/index.ts');
    const phonePeAdapter = repositorySource('packages/infrastructure/phonepe-adapter/index.ts');
    const upiAdapter = repositorySource('packages/infrastructure/upi-adapter/index.ts');
    const codAdapter = repositorySource('packages/infrastructure/cod-adapter/index.ts');

    assert.match(razorpayAdapter, /createRazorpayPaymentProvider/);
    assert.match(razorpayAdapter, /PaymentProvider/);
    assert.match(razorpayAdapter, /normalizeIdempotencyKey/);
    assert.match(razorpayAdapter, /webhookVerify/);
    assert.match(razorpayAdapter, /hmacSha256Hex\(credentials\.keySecret,\s*`\$\{input\.providerOrderId\}\|\$\{input\.providerPaymentId\}`/);

    assert.match(stripeAdapter, /createStripePaymentProvider/);
    assert.match(paypalAdapter, /createPayPalPaymentProvider/);
    assert.match(cashfreeAdapter, /createCashfreePaymentProvider/);
    assert.match(cashfreeAdapter, /x-client-id/);
    assert.match(cashfreeAdapter, /payment_session_id/);
    assert.doesNotMatch(cashfreeAdapter, /scaffolded|cashfreeUnavailable/);

    for (const adapter of [stripeAdapter, paypalAdapter, cashfreeAdapter, phonePeAdapter, upiAdapter, codAdapter]) {
        assert.match(adapter, /PaymentProvider/);
        assert.match(adapter, /createIntent/);
        assert.match(adapter, /verify/);
        assert.match(adapter, /capture/);
        assert.match(adapter, /refund/);
        assert.match(adapter, /webhookVerify/);
    }

    assert.match(upiAdapter, /upi_autopay_supported/);
    assert.match(codAdapter, /COD requires OTP\/call verification/);
});

test('Task 004 generic payment sessions are persisted, tenant-scoped, mock-first, and live-gated', () => {
    const paymentsSource = source('routes/payments.ts');
    const paymentSupportSource = source('lib/payment-route-support.ts');
    const paymentPackage = repositorySource('packages/payments/src/index.ts');
    const migration = repositorySource('database/supabase/migrations/142_executable_payment_sessions.sql');
    const rollback = repositorySource('database/supabase/rollback/142_executable_payment_sessions.rollback.sql');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');
    const liveSkips = repositorySource('tests/executable/human-required-live-paths.test.mjs');

    assert.match(paymentPackage, /export type PaymentProviderMode = 'mock' \| 'sandbox' \| 'live'/);
    assert.match(paymentPackage, /buildMockPaymentSessionPlan/);
    assert.match(paymentPackage, /livePaymentCredentialsAreRequired/);
    assert.match(paymentsSource, /router\.post\('\/sessions'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/capture'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/void'/);
    assert.match(paymentsSource, /router\.post\('\/:paymentId\/refund'/);
    assert.match(paymentsSource, /requireLivePaymentCredential/);
    assert.match(paymentSupportSource, /HR-MERCHANT-PSP-LIVE/);
    assert.match(paymentsSource, /paymentSetupRequiredResponse/);
    assert.match(paymentsSource, /buildMockPaymentSessionPlan/);
    assert.match(paymentsSource, /new IdempotencyExecutionAdapter\(db\)/);
    assert.match(paymentsSource, /emitPaymentEvent/);
    assert.match(paymentsSource, /eventType:\s*'payment\.captured'/);
    assert.match(paymentsSource, /eventType:\s*'payment\.refunded'/);

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payment_credentials/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payment_tokens/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payments/);
    assert.match(migration, /encrypted_credentials jsonb NOT NULL/);
    assert.match(migration, /CHECK \(mode IN \('mock', 'sandbox', 'live'\)\)/);
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
        'apps/storefront-runtime/src/app/api/payments/paypal/capture/route.ts',
        'apps/storefront-runtime/src/app/api/payments/paypal/create/route.ts',
        'apps/storefront-runtime/src/app/api/payments/paypal/webhook/route.ts',
        'apps/storefront-runtime/src/app/api/payments/razorpay/create/route.ts',
        'apps/storefront-runtime/src/app/api/payments/razorpay/verify/route.ts',
        'apps/storefront-runtime/src/app/api/payments/stripe/checkout/route.ts',
        'apps/storefront-runtime/src/app/api/payments/stripe/webhook/route.ts',
    ];

    for (const route of removedRoutes) {
        assert.throws(() => repositorySource(route), /ENOENT/);
    }

    const checkoutClient = repositorySource('apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx');
    const paypalReturn = repositorySource('apps/storefront-runtime/src/app/store/[subdomain]/checkout/paypal-return/page.tsx');
    const browserClient = repositorySource('apps/storefront-runtime/src/lib/api/browser-client.ts');

    assert.doesNotMatch(checkoutClient, /\/api\/payments/);
    assert.doesNotMatch(paypalReturn, /\/api\/payments/);
    assert.doesNotMatch(browserClient, /NEXT_PUBLIC_API_BASE_URL|NEXT_PUBLIC_API_URL|LETBUYY_PRODUCTION_API_BASE_URL/);
    assert.match(browserClient, /apiClientInputToLetbuyyApiPath/);
    assert.match(browserClient, /resolveLetbuyyApiBaseUrl/);
    assert.match(browserClient, /`\/api\/storefront\/\$\{encodeURIComponent\(subdomain\)\}\$\{apiPath\}`/);
    assert.match(checkoutClient, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/razorpay\/order'/);
    assert.match(checkoutClient, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/);
    assert.match(checkoutClient, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/paypal\/order'/);
    assert.match(paypalReturn, /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/paypal\/capture'/);
});
