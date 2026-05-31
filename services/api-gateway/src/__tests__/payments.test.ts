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
    assert.match(storefrontSource, /const amountMinorUnits = Math\.round\(Number\(order\.total\) \* 100\)/);
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
    assert.match(storefrontSource, /const providerOrder = await createRazorpayOrder/);
    assert.ok(
        storefrontSource.indexOf('const claim = await idempotency.begin(') <
        storefrontSource.indexOf('const providerOrder = await createRazorpayOrder')
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

    assert.match(storefrontSource, /hmacSha256Hex\(\s*c\.env\.RAZORPAY_KEY_SECRET,\s*`\$\{body\.razorpay_order_id\}\|\$\{body\.razorpay_payment_id\}`/);
    assert.match(storefrontSource, /!timingSafeEqualHex\(expected,\s*body\.razorpay_signature\)/);
    assert.match(storefrontSource, /code:\s*'PAYMENT_SIGNATURE_INVALID'/);
    assert.match(storefrontSource, /paymentService\.confirmPayment\(/);
});

test('razorpay webhook verifies raw-body signatures, persists event ids, and deduplicates retries', () => {
    const webhookSource = repositorySource('services/webhook-service/src/index.ts');

    assert.match(webhookSource, /const body = await c\.req\.text\(\)/);
    assert.match(webhookSource, /hmacSha256Hex\(c\.env\.RAZORPAY_WEBHOOK_SECRET,\s*body\)/);
    assert.match(webhookSource, /return c\.json\(\{ error:\s*"Invalid signature" \},\s*400\)/);
    assert.match(webhookSource, /writeWebhookEvent\(c\.env,\s*\{/);
    assert.match(webhookSource, /onConflict:\s*"provider,provider_event_id"/);
    assert.match(webhookSource, /if \(recorded\.duplicate\)/);
    assert.match(webhookSource, /case "payment\.captured"/);
    assert.match(webhookSource, /await markOrderPaid\(c\.env,\s*order,/);
    assert.match(webhookSource, /await markWebhookEvent\(c\.env,\s*"razorpay",\s*providerEventId,\s*"processed"\)/);
});

test('payment provider adapters implement the unified payments contract', () => {
    const razorpayAdapter = repositorySource('packages/infrastructure/razorpay-adapter/index.ts');
    const cashfreeAdapter = repositorySource('packages/infrastructure/cashfree-adapter/index.ts');
    const phonePeAdapter = repositorySource('packages/infrastructure/phonepe-adapter/index.ts');
    const upiAdapter = repositorySource('packages/infrastructure/upi-adapter/index.ts');
    const codAdapter = repositorySource('packages/infrastructure/cod-adapter/index.ts');

    assert.match(razorpayAdapter, /createRazorpayPaymentProvider/);
    assert.match(razorpayAdapter, /PaymentProvider/);
    assert.match(razorpayAdapter, /normalizeIdempotencyKey/);
    assert.match(razorpayAdapter, /webhookVerify/);
    assert.match(razorpayAdapter, /hmacSha256Hex\(credentials\.keySecret,\s*`\$\{input\.providerOrderId\}\|\$\{input\.providerPaymentId\}`/);

    for (const adapter of [cashfreeAdapter, phonePeAdapter, upiAdapter, codAdapter]) {
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
