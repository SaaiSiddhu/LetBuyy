import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createPayoutTransferAdapter,
    createRazorpayRoutePayoutProviderClient,
    PayoutProviderUnavailable,
} from '@letbuyy/infrastructure/payout-transfer-adapter';

interface FetchInit {
    method: string;
    headers: Record<string, string>;
    body: string;
}

function payoutInput() {
    return {
        statementId: '4d2ad7ad-6d1a-49e0-a7de-416d9a69e3b3',
        siteId: '54c4b8aa-4940-4725-b2a0-3715695389a7',
        amountMinor: 125000,
        currency: 'INR',
        idempotencyKey: 'payout-release:statement-001',
        beneficiaryName: 'Demo Merchant',
        metadata: { statement_number: 'PYT-DEMO-001' },
    };
}

test('Razorpay Route payout client posts an idempotent transfer and maps provider proof', async () => {
    const calls: Array<{ input: string; init: FetchInit }> = [];
    const fetchMock = async (input: string, init: FetchInit) => {
        calls.push({ input, init });
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            async json() {
                return {
                    id: 'trf_Route123',
                    status: 'processed',
                    utr: 'RZPUTR123',
                    created_at: 1_717_171_717,
                };
            },
            async text() {
                return '';
            },
        };
    };

    const adapter = createPayoutTransferAdapter({
        mode: 'sandbox',
        rail: 'razorpay_route',
        credentials: {
            keyId: 'rzp_test_key',
            keySecret: 'route_secret',
            accountId: 'acc_linked_merchant',
        },
        provider: createRazorpayRoutePayoutProviderClient({
            baseUrl: 'https://api.example.test/v1/',
            fetch: fetchMock,
        }),
        now: () => new Date('2026-06-11T00:00:00.000Z'),
    });

    const input = payoutInput();
    const result = await adapter.initiateTransfer(input);
    const replay = await adapter.initiateTransfer(input);

    assert.equal(result.status, 'released');
    assert.deepEqual(replay, result);
    assert.equal(result.providerReference, 'trf_Route123');
    assert.equal(result.utr, 'RZPUTR123');
    assert.equal(result.failureReason, null);
    assert.equal(result.processedAt, '2024-05-31T16:08:37.000Z');
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.input, 'https://api.example.test/v1/transfers');
    assert.equal(calls[0]?.init.method, 'POST');
    assert.equal(calls[0]?.init.headers.Authorization, `Basic ${btoa('rzp_test_key:route_secret')}`);
    const providerKey = calls[0]?.init.headers['X-Transfer-Idempotency'] || '';
    assert.match(providerKey, /^lb_[a-f0-9]{32}$/);
    assert.ok(providerKey.length >= 4 && providerKey.length <= 36);
    assert.equal(calls[1]?.init.headers['X-Transfer-Idempotency'], providerKey);
    assert.deepEqual(calls[1]?.init, calls[0]?.init, 'same release retry must send the same provider payload');
    const payload = JSON.parse(calls[0]?.init.body || '{}') as Record<string, unknown>;
    assert.equal(payload.account, 'acc_linked_merchant');
    assert.equal(payload.amount, 125000);
    assert.equal(payload.currency, 'INR');
    assert.equal('reference_id' in payload, false);
    assert.deepEqual(payload.notes, {
        site_id: '54c4b8aa-4940-4725-b2a0-3715695389a7',
        statement_id: '4d2ad7ad-6d1a-49e0-a7de-416d9a69e3b3',
        beneficiary_name: 'Demo Merchant',
        statement_number: 'PYT-DEMO-001',
    });
});

test('Razorpay Route concurrent idempotent request and server errors remain retryable', async () => {
    for (const status of [409, 429, 503]) {
        const adapter = createPayoutTransferAdapter({
            mode: 'sandbox',
            rail: 'razorpay_route',
            credentials: {
                keyId: 'rzp_test_key',
                keySecret: 'route_secret',
                accountId: 'acc_linked_merchant',
            },
            provider: createRazorpayRoutePayoutProviderClient({
                fetch: async () => ({
                    ok: false,
                    status,
                    statusText: 'Temporary provider response',
                    async json() { return { error: { description: 'transfer may still be processing' } }; },
                    async text() { return ''; },
                }),
            }),
        });

        const result = await adapter.initiateTransfer(payoutInput());
        assert.equal(result.status, 'processing', `HTTP ${status} must not be treated as a definitive transfer failure`);
        assert.equal(result.failureReason, null);
    }
});

test('Razorpay Route payout client records provider rejection as failed, not released', async () => {
    const fetchMock = async (_input: string, _init: FetchInit) => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        async json() {
            return { error: { description: 'invalid api key' } };
        },
        async text() {
            return '';
        },
    });
    const adapter = createPayoutTransferAdapter({
        mode: 'live',
        rail: 'razorpay_route',
        credentials: {
            keyId: 'rzp_live_key',
            keySecret: 'bad_secret',
            accountId: 'acc_linked_merchant',
        },
        provider: createRazorpayRoutePayoutProviderClient({ fetch: fetchMock }),
    });

    const result = await adapter.initiateTransfer(payoutInput());

    assert.equal(result.status, 'failed');
    assert.equal(result.providerReference, null);
    assert.equal(result.utr, null);
    assert.equal(result.failureReason, 'invalid api key');
});

test('payout adapter remains fail-closed without an injected provider client', async () => {
    const adapter = createPayoutTransferAdapter({
        mode: 'sandbox',
        rail: 'razorpay_route',
        credentials: {
            keyId: 'rzp_test_key',
            keySecret: 'route_secret',
            accountId: 'acc_linked_merchant',
        },
    });

    await assert.rejects(
        () => adapter.initiateTransfer(payoutInput()),
        (error: unknown) => error instanceof PayoutProviderUnavailable
            && error.message === 'razorpay_route payout provider client is not configured',
    );
});
