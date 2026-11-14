// F-BILL-1 — /billing/subscribe must not fabricate a paid subscription in live mode.
//
// What the route did, and still does in sandbox: it reads `sandbox_payment_status` from the REQUEST
// BODY — a client-supplied field that defaults to 'paid' — and activates the subscription with a
// fabricated provider reference, `sandbox_autopay_payment:<idempotency_key>`. No provider call, no
// signature check, no amount verification. `assertAutopayReady` guards /mandate and nothing else, so
// none of this changed with LETBUYY_AUTOPAY_MODE.
//
// In sandbox that is a deliberate simulation. In live it lets an authenticated merchant activate any
// purchasable plan without paying. Live mode now refuses.
//
// The test that carries the weight is the one proving the refusal happens BEFORE any database
// access: the env below has no Supabase configuration at all, so a 503 can only mean nothing
// downstream ran. A guard placed after `getSupabaseAdmin` would throw instead.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import billingRouter from '../routes/billing';

const billingSource = readFileSync(new URL('../routes/billing.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../../../packages/billing-core/src/index.ts', import.meta.url), 'utf8');

const STORE = 'aaaaaaaa-0000-4000-8000-00000000000a';

function app(env: Record<string, unknown>) {
    const root = new Hono();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = env;
        // The route resolves an owned store from the auth context; nothing below the guard should run
        // in the live case, and this keeps the sandbox case from failing for the wrong reason.
        c.set('auth' as never, { user: { id: 'user-1', email: 'm@example.com', storeId: STORE } } as never);
        await next();
    });
    root.route('/billing', billingRouter);
    return root;
}

const body = {
    store_id: STORE,
    plan_slug: 'business',
    billing_period: 'monthly',
    idempotency_key: 'bill1-test-key-0001',
};
const post = (payload: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

test('live mode refuses, and does so before touching the database', async () => {
    // No SUPABASE_URL, no service key, no Razorpay credentials: if anything downstream ran, this
    // would throw rather than answer.
    const res = await app({ LETBUYY_AUTOPAY_MODE: 'live' }).request('/billing/subscribe', post(body), {});
    assert.equal(res.status, 503);
    const parsed = (await res.json()) as { error: { code: string } };
    assert.equal(parsed.error.code, 'AUTOPAY_PROVIDER_SETUP_REQUIRED');
});

test('live mode refuses even with Razorpay credentials present', async () => {
    // assertAutopayReady passes once credentials exist. That is exactly why it is not sufficient on
    // its own here: with credentials configured, the old path would have fabricated a reference —
    // strictly worse, because the deployment looks production-ready.
    const res = await app({
        LETBUYY_AUTOPAY_MODE: 'live',
        RAZORPAY_KEY_ID: 'rzp_test_id',
        RAZORPAY_KEY_SECRET: 'secret',
    }).request('/billing/subscribe', post(body), {});
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'AUTOPAY_PROVIDER_SETUP_REQUIRED');
});

test('a client cannot re-enable the path by declaring the payment succeeded', async () => {
    // sandbox_payment_status is the field the whole finding is about. It must not influence the live
    // refusal in either direction.
    for (const status of ['paid', 'failed']) {
        const res = await app({ LETBUYY_AUTOPAY_MODE: 'live' })
            .request('/billing/subscribe', post({ ...body, sandbox_payment_status: status }), {});
        assert.equal(res.status, 503, `sandbox_payment_status=${status} must not bypass the refusal`);
    }
});

test('sandbox mode is untouched — the request gets past the guard', async () => {
    // Deliberately not asserting a 200: without a database this cannot complete. What matters is that
    // it is NOT the live refusal, i.e. development behaviour did not change.
    let status = 0;
    let code: string | undefined;
    try {
        const res = await app({ LETBUYY_AUTOPAY_MODE: 'sandbox' }).request('/billing/subscribe', post(body), {});
        status = res.status;
        try { code = ((await res.json()) as { error?: { code?: string } }).error?.code; } catch { /* not json */ }
    } catch {
        // Throwing on the missing database IS getting past the guard.
        return;
    }
    assert.notEqual(code, 'AUTOPAY_PROVIDER_SETUP_REQUIRED', `sandbox must not hit the live refusal (status ${status})`);
});

test('SOURCE: the guard precedes every database call in the handler', () => {
    const handler = billingSource.slice(
        billingSource.indexOf("router.post('/subscribe'"),
        billingSource.indexOf("router.get('/mandates'"),
    );
    const guard = handler.indexOf("autopayMode(c.env) === 'live'");
    const db = handler.indexOf('getSupabaseAdmin(c)');
    assert.ok(guard > 0, 'the live-mode guard must exist in the subscribe handler');
    assert.ok(db > 0, 'sanity: the handler does use the admin client');
    assert.ok(guard < db, 'a guard after the first database call is a guard that already let work happen');
});

test('SOURCE: the finding itself is still true of the schema, and is documented', () => {
    // If this ever stops matching, the client-supplied field was removed and this whole guard should
    // be revisited rather than left as folklore.
    assert.match(
        schemaSource,
        /sandbox_payment_status:\s*z\.enum\(\['paid', 'failed'\]\)\.default\('paid'\)/,
        'the payment status is still client-supplied and still defaults to paid',
    );
    const code = billingSource.replace(/\/\/[^\n]*/g, ' ');
    assert.match(code, /sandbox_autopay_payment:/, 'the fabricated reference is still what sandbox writes');
});
