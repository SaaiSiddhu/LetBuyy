import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeRazorpayRefundLifecycle,
    reconcileGatewayPaymentRefund,
} from '../../services/webhook-service/src/gateway-refund-transitions';

const refund = {
    providerPaymentId: 'pay_synthetic',
    providerRefundId: 'rfnd_synthetic',
    providerEventId: 'refund.processed:rfnd_synthetic',
    eventType: 'refund.processed' as const,
    status: 'processed' as const,
    amountMinor: 1200,
    currency: 'INR',
};

test('refund event type normalizes Razorpay entity statuses without advancing created refunds', () => {
    for (const status of ['created', 'pending', 'processed']) {
        assert.deepEqual(normalizeRazorpayRefundLifecycle('refund.created', status), {
            eventType: 'refund.created',
            status: 'created',
        });
    }
    assert.equal(normalizeRazorpayRefundLifecycle('refund.created', 'failed'), null);
    assert.equal(normalizeRazorpayRefundLifecycle('refund.created', null), null);
    assert.deepEqual(normalizeRazorpayRefundLifecycle('refund.processed', 'processed'), {
        eventType: 'refund.processed',
        status: 'processed',
    });
    assert.equal(normalizeRazorpayRefundLifecycle('refund.processed', 'pending'), null);
    assert.deepEqual(normalizeRazorpayRefundLifecycle('refund.failed', 'failed'), {
        eventType: 'refund.failed',
        status: 'failed',
    });
    assert.equal(normalizeRazorpayRefundLifecycle('refund.failed', 'processed'), null);
});

test('refund transition uses the bound API Gateway and service authentication', async () => {
    let url = '';
    let headers = new Headers();
    let body: Record<string, unknown> = {};
    const result = await reconcileGatewayPaymentRefund({
        INTERNAL_API_SECRET: 'synthetic-internal-secret',
        API_GATEWAY_SERVICE: {
            async fetch(input, init) {
                url = String(input);
                headers = new Headers(init?.headers);
                body = JSON.parse(String(init?.body)) as Record<string, unknown>;
                return Response.json({ success: true, data: { matched: true } });
            },
        },
    }, refund);
    assert.equal(url, 'https://api-gateway/v1/storefront/internal/payments/refund-event');
    assert.equal(headers.get('X-Internal-API-Secret'), 'synthetic-internal-secret');
    assert.deepEqual(body, { provider: 'razorpay', ...refund });
    assert.equal((result.data as { matched: boolean }).matched, true);
});

test('refund transition fails closed on a non-success Gateway response', async () => {
    await assert.rejects(() => reconcileGatewayPaymentRefund({
        INTERNAL_API_SECRET: 'synthetic-internal-secret',
        API_GATEWAY_SERVICE: { async fetch() { return new Response('unavailable', { status: 503 }); } },
    }, refund), /reconciliation failed: 503/);
});
