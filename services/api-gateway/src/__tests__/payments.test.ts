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
    const storefrontSource = source('routes/storefront.ts');
    const paymentsSource = source('routes/payments.ts');
    const checkoutSchemaSource = repositorySource('packages/checkout-core/src/index.ts');

    assert.match(checkoutSchemaSource, /StorefrontRazorpayOrderSchema[\s\S]*amountMinorUnits/);
    assert.match(checkoutSchemaSource, /RazorpayOrderSchema[\s\S]*amount_minor_units/);
    assert.match(storefrontSource, /paymentService\.loadStorefrontPayableOrder\(body\.orderId,\s*store\.id\)/);
    assert.match(storefrontSource, /function orderAmountMinorUnits/);
    assert.match(storefrontSource, /amountMinor:\s*Math\.round\(Number\(order\.total\) \* 100\)/);
    assert.match(storefrontSource, /requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits/);
    assert.match(storefrontSource, /code:\s*'AMOUNT_MISMATCH'/);
    assert.match(storefrontSource, /,\s*400\s*\)/);
    assert.match(paymentsSource, /const order = await loadPayableOrder\(c,\s*body\.order_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(paymentsSource, /const amountMinorUnits = Math\.round\(order\.total \* 100\)/);
});

test('razorpay order creation stores idempotency before provider calls', () => {
    const storefrontSource = source('routes/storefront.ts');
    const paymentsSource = source('routes/payments.ts');

    assert.match(storefrontSource, /new IdempotencyExecutionAdapter\(db\)/);
    assert.match(storefrontSource, /scope:\s*`storefront\.payment\.razorpay\.order:\$\{body\.orderId\}`/);
    assert.match(storefrontSource, /const claim = await idempotency\.begin\(/);
    assert.match(storefrontSource, /createRazorpayPaymentProvider/);
    assert.match(storefrontSource, /const intent = await provider\.createIntent\(/);
    assert.ok(
        storefrontSource.indexOf('const claim = await idempotency.begin(') <
        storefrontSource.indexOf('const intent = await provider.createIntent(')
    );

    assert.match(paymentsSource, /scope:\s*`payment\.razorpay\.order:\$\{body\.order_id\}`/);
    assert.match(paymentsSource, /const claim = await idempotency\.begin\(/);
    assert.match(paymentsSource, /const razorpayOrder = await createRazorpayOrder/);
    assert.ok(
        paymentsSource.indexOf('const claim = await idempotency.begin(') <
        paymentsSource.indexOf('const razorpayOrder = await createRazorpayOrder')
    );
});

test('razorpay payment verification validates signatures before confirming payment', () => {
    const storefrontSource = source('routes/storefront.ts');

    assert.match(storefrontSource, /createRazorpayPaymentProvider/);
    assert.match(storefrontSource, /const verification = await provider\.verify\(/);
    assert.match(storefrontSource, /signature:\s*body\.razorpay_signature/);
    assert.match(storefrontSource, /!verification\.verified/);
    assert.match(storefrontSource, /paymentService\.confirmPayment\(/);
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
    const runtimeComposition = repositorySource('packages/runtime-composition/checkout-runtime-adapter/index.ts');

    assert.match(webhookSource, /app\.post\("\/razorpay"/);
    assert.match(webhookSource, /app\.post\("\/stripe"/);
    assert.match(webhookSource, /app\.post\("\/paypal"/);
    assert.match(webhookSource, /app\.post\("\/cashfree"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"stripe"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"paypal"/);
    assert.match(webhookSource, /webhookVerify\(\{\s*provider:\s*"cashfree"/);
    assert.match(webhookSource, /emitPaymentDomainEvent/);
    assert.match(webhookSource, /outbox_events/);

    assert.doesNotMatch(stripeAdapter, /constructWebhookEvent/);
    assert.doesNotMatch(paypalAdapter, /export async function verifyWebhookSignature/);
    assert.match(cashfreeAdapter, /x-webhook-timestamp/);
    assert.match(cashfreeAdapter, /x-webhook-signature/);
    assert.doesNotMatch(runtimeComposition, /constructWebhookEvent|verifyWebhookSignature/);
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

    assert.doesNotMatch(checkoutClient, /\/api\/payments/);
    assert.doesNotMatch(paypalReturn, /\/api\/payments/);
    assert.match(checkoutClient, /storefrontWorkerFetch\(subdomain,\s*'\/payments\/razorpay\/order'/);
    assert.match(checkoutClient, /storefrontWorkerFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/);
    assert.match(checkoutClient, /storefrontWorkerFetch\(subdomain,\s*'\/payments\/paypal\/order'/);
    assert.match(paypalReturn, /storefrontWorkerFetch\(subdomain,\s*'\/payments\/paypal\/capture'/);
});
