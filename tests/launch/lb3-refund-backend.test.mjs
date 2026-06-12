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

function repoFile(relativePath) {
    return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function adapterSource() {
    return readFileSync(
        join(repoRoot, 'packages/infrastructure/razorpay-adapter/index.ts'),
        'utf8',
    );
}

// ─── LB-3-A: refund route no longer unconditionally requires provider_refund_id ─
test('LB-3-A: payments.ts refund route initiates Razorpay refund when provider_refund_id absent', () => {
    const src = source('routes/payments.ts');

    // The old unconditional throw must be gone
    assert.doesNotMatch(
        src,
        /Provider refund id is required before refund can be recorded'\s*\)/,
        'Old unconditional provider_refund_id required throw must be replaced',
    );

    // The new conditional throw for non-razorpay must be present
    assert.match(
        src,
        /Provider refund id is required before refund can be recorded for non-Razorpay payments/,
        'Non-Razorpay provider_refund_id check must be present',
    );

    // createRazorpayPaymentProvider must be imported and called
    assert.match(
        src,
        /createRazorpayPaymentProvider/,
        'createRazorpayPaymentProvider must be imported in payments.ts',
    );

    // The Razorpay refund call must use the provider's refund method
    assert.match(
        src,
        /razorpayProvider\.refund\(/,
        'razorpayProvider.refund() must be called in the refund route',
    );

    // 502 error returned on provider failure, with no ledger write
    assert.match(
        src,
        /RAZORPAY_REFUND_FAILED/,
        'RAZORPAY_REFUND_FAILED error code must be present for provider failure path',
    );

    // Provider call must precede ledger post within the refund route block
    // Isolate the refund route block starting at the router.post('/:paymentId/refund') declaration
    const refundRouteStart = src.indexOf("router.post('/:paymentId/refund'");
    assert.ok(refundRouteStart > -1, 'refund route must be present');
    const refundRouteBlock = src.slice(refundRouteStart);
    const providerCallIndex = refundRouteBlock.indexOf('razorpayProvider.refund(');
    const ledgerCallIndex = refundRouteBlock.indexOf('postPaymentLedger(');
    assert.ok(providerCallIndex > -1, 'razorpayProvider.refund call must exist in refund route block');
    assert.ok(ledgerCallIndex > -1, 'postPaymentLedger call must exist in refund route block');
    assert.ok(
        providerCallIndex < ledgerCallIndex,
        'Razorpay provider refund call must appear before postPaymentLedger (no ledger write on provider failure)',
    );
});

// ─── LB-3-B: step-up gate and ledger still present in refund route ────────────
test('LB-3-B: payments.ts refund route still contains step-up gate and ledger posting', () => {
    const src = source('routes/payments.ts');

    assert.match(
        src,
        /verifySensitiveActionStepUp/,
        'verifySensitiveActionStepUp must be called in payments.ts',
    );

    assert.match(
        src,
        /action: 'refund\.approve'/,
        "step-up action must be 'refund.approve'",
    );

    // Step-up must come before ledger post within the refund route block
    const refundRouteStart = src.indexOf("router.post('/:paymentId/refund'");
    assert.ok(refundRouteStart > -1, 'refund route must be present');
    const refundRouteBlock = src.slice(refundRouteStart);
    const stepUpIndex = refundRouteBlock.indexOf("action: 'refund.approve'");
    const ledgerIndex = refundRouteBlock.indexOf('buildPaymentRefundLedgerPosting(');
    assert.ok(stepUpIndex > -1, 'step-up call must be present in refund route');
    assert.ok(ledgerIndex > -1, 'buildPaymentRefundLedgerPosting call must be present in refund route');
    assert.ok(
        stepUpIndex < ledgerIndex,
        'step-up verification must appear before ledger posting',
    );

    // Ledger call is still there
    assert.match(
        src,
        /postPaymentLedger\(/,
        'postPaymentLedger must be called in refund route',
    );

    // payment.refunded event emission must still be present
    assert.match(
        src,
        /eventType: 'payment\.refunded'/,
        "payment.refunded domain event must still be emitted",
    );
});

// ─── LB-3-C: production-deploy.yml must NOT provision provider-money secrets ──
// Governance law A4 (deployment-safety-validator): "production go-live atom must
// not require or provision provider-money secret". Razorpay production secrets
// are provisioned by a HUMAN via `wrangler secret put` per the
// EXECUTABLE_HUMAN_REQUIRED.md runbook (HR-MERCHANT-PSP-LIVE), never by the
// deploy workflow. The scope-lock's "prod-deploy Razorpay patch" suggestion was
// rejected by this higher law during Batch 2.
test('LB-3-C: production-deploy.yml does not require or provision Razorpay secrets (A4)', () => {
    const yml = repoFile('.github/workflows/production-deploy.yml');

    assert.doesNotMatch(
        yml,
        /wrangler secret put RAZORPAY_KEY_ID --env production/,
        'A4: production deploy workflow must not provision RAZORPAY_KEY_ID',
    );

    assert.doesNotMatch(
        yml,
        /wrangler secret put RAZORPAY_KEY_SECRET --env production/,
        'A4: production deploy workflow must not provision RAZORPAY_KEY_SECRET',
    );

    assert.doesNotMatch(
        yml,
        /wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production/,
        'A4: production deploy workflow must not provision RAZORPAY_WEBHOOK_SECRET',
    );

    assert.doesNotMatch(
        yml,
        /HAS_PRODUCTION_RAZORPAY_KEY_ID/,
        'A4: release-preflight must not hard-require provider-money secrets',
    );
});

// ─── LB-3-D: razorpay adapter exposes refund method ─────────────────────────
test('LB-3-D: razorpay-adapter exposes a refund method in the PaymentProvider', () => {
    const src = adapterSource();

    // The provider object must have a refund method
    assert.match(
        src,
        /async refund\(/,
        'razorpay adapter PaymentProvider must expose an async refund() method',
    );

    // The method must call Razorpay payments/:id/refund endpoint
    assert.match(
        src,
        /payments\/\$\{[^}]+\}\/refund/,
        'razorpay adapter refund must call the payments/{id}/refund endpoint',
    );

    // The result must expose providerRefundId in references
    assert.match(
        src,
        /providerRefundId/,
        'razorpay adapter refund result must include providerRefundId in references',
    );
});
