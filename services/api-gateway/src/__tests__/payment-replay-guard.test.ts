// What assertProviderPaymentNotReplayed decides, against the real function and a fake PostgREST that
// applies the filters the gateway sends. tests/launch/lb13-security-trio.test.mjs pins WHERE the guard is
// called (awaited, before the provider verifies and before confirmPayment); that is a shape check and
// says nothing about whether the guard refuses a replay. This is that proof.
//
// The property the guard exists for: provider payment ids are unique across the provider's whole
// platform, so a payment id already recorded against a DIFFERENT order -- possibly a different tenant's
// -- is a replayed capture and must be refused. The lookup is therefore global by design (no site
// predicate), bounded to one row, and a lookup that fails must refuse rather than assume "no replay".

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../index';
import { ConflictError } from '../lib/errors';
import { assertProviderPaymentNotReplayed } from '../lib/payment-route-support';

const POSTGREST = 'https://replay-guard.fake-postgrest.test';
const PAYMENT_ID = 'pay_replayGuardProbe0001';
const ORDER = '11111111-0000-4000-8000-0000000000a1';
const OTHER_ORDER = '11111111-0000-4000-8000-0000000000a2';
const PROVIDER_ORDER = 'order_replayGuardProbe0001';

type Recorded = { table: string; params: URLSearchParams };

function installFakePostgrest(rows: Record<string, unknown>[], status = 200) {
    const originalFetch = globalThis.fetch;
    const requests: Recorded[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        requests.push({ table: url.pathname.replace('/rest/v1/', ''), params: url.searchParams });
        if (status !== 200) {
            return new Response(JSON.stringify({ code: 'XX000', message: 'database unavailable' }), { status, headers: { 'Content-Type': 'application/json' } });
        }
        const matching = rows.filter((row) => url.searchParams.get('provider_payment_id') === `eq.${row.provider_payment_id}`);
        return new Response(JSON.stringify(matching), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof globalThis.fetch;
    return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

const context = () => ({
    env: { SUPABASE_URL: POSTGREST, SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key', ENVIRONMENT: 'test' } as unknown as Env,
}) as never;

const replay = (overrides: Partial<{ orderId: string; providerOrderId: string | null }> = {}) =>
    assertProviderPaymentNotReplayed(context(), {
        provider: 'razorpay',
        providerPaymentId: PAYMENT_ID,
        providerOrderId: PROVIDER_ORDER,
        orderId: ORDER,
        ...overrides,
    });

const recorded = (order: string, providerOrder: string | null = PROVIDER_ORDER) => ({
    order_id: order, provider_order_id: providerOrder, provider_payment_id: PAYMENT_ID,
});

test('a payment id nobody has used passes', async (t) => {
    const fake = installFakePostgrest([]);
    t.after(fake.restore);
    await assert.doesNotReject(replay());
});

test('re-verifying the same payment for the SAME order passes (a buyer callback after the webhook is not a replay)', async (t) => {
    const fake = installFakePostgrest([recorded(ORDER)]);
    t.after(fake.restore);
    await assert.doesNotReject(replay());
});

test('a payment id already recorded against a DIFFERENT order is refused as a replay', async (t) => {
    const fake = installFakePostgrest([recorded(OTHER_ORDER)]);
    t.after(fake.restore);
    await assert.rejects(replay(), (error) => error instanceof ConflictError && /already verified for another order/.test(error.message));
});

test('the same payment and order with a DIFFERENT provider order reference is refused', async (t) => {
    const fake = installFakePostgrest([recorded(ORDER, 'order_someoneElsesReference')]);
    t.after(fake.restore);
    await assert.rejects(replay(), (error) => error instanceof ConflictError && /reference mismatch/i.test(error.message));
});

test('a lookup that fails is a refusal, never "no replay"', async (t) => {
    const fake = installFakePostgrest([], 500);
    t.after(fake.restore);
    await assert.rejects(replay(), /Failed to check payment replay state/);
});

test('the lookup is global (no tenant predicate), single-row and live-rows-only, so cross-tenant replay is still caught', async (t) => {
    const fake = installFakePostgrest([]);
    t.after(fake.restore);
    await replay();
    assert.equal(fake.requests.length, 1);
    const [{ table, params }] = fake.requests;
    assert.equal(table, 'payment_transactions');
    assert.equal(params.get('gateway'), 'eq.razorpay');
    assert.equal(params.get('provider_payment_id'), `eq.${PAYMENT_ID}`);
    assert.equal(params.get('deleted_at'), 'is.null');
    assert.equal(params.get('limit'), '1');
    for (const column of ['site_id', 'store_id']) {
        assert.equal(params.has(column), false, `${column} must not narrow the replay check to one tenant`);
    }
});
