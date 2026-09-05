// RL-1 — a store-less auth call must still get a PER-ACCOUNT rate limit, not just a per-IP one.
//
// customerAuthIdentityKey() returned null whenever storeId was absent, and enforceCustomerAuthRateLimit
// only adds the identity check when that key exists. A store-less caller was therefore protected by
// the per-IP limit alone, so an attacker rotating IPs could grind one account's password with no
// account-level throttle — precisely what the per-identity limit exists to stop.
//
// This is behavioural, not a source-shape assertion: it drives the real limiter. In non-production
// with no Redis and no KV binding, checkRateLimitKeys falls back to an in-memory fixed window, so the
// limit can be exercised for real without mocking anything.
//
// Each test uses its own operation name because that in-memory window is module-global and would
// otherwise leak counts between tests.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { enforceCustomerAuthRateLimit } from '../middleware/rateLimit';

const IDENTITY_MAX = 5; // enforceCustomerAuthRateLimit's maxPerIdentity default
const EMAIL = 'target@example.com';

function appFor(identity: { storeId?: string | null; email?: string | null; operation: string }) {
    const app = new Hono<{ Bindings: Env }>();
    app.post('/probe', async (c) => {
        const limited = await enforceCustomerAuthRateLimit(c, identity);
        return limited ?? c.json({ ok: true });
    });
    return app;
}

/// Each call comes from a DIFFERENT IP, so the per-IP limit (30) can never be what stops us —
/// anything that blocks here is the per-identity limit doing its job.
async function callFromDistinctIps(app: Hono<{ Bindings: Env }>, times: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < times; i += 1) {
        const res = await app.request(
            '/probe',
            { method: 'POST', headers: { 'CF-Connecting-IP': `203.0.113.${i + 1}` } },
            {} as Env,
        );
        statuses.push(res.status);
    }
    return statuses;
}

test('a STORE-LESS auth call is throttled per account, not only per IP', async () => {
    const app = appFor({ email: EMAIL, operation: 'rl1-storeless-probe' });
    const statuses = await callFromDistinctIps(app, IDENTITY_MAX + 1);

    assert.deepEqual(
        statuses.slice(0, IDENTITY_MAX),
        Array(IDENTITY_MAX).fill(200),
        'the first five attempts on a fresh identity should be allowed',
    );
    assert.equal(
        statuses[IDENTITY_MAX],
        429,
        'the sixth attempt must be blocked by the per-identity limit even though every request came from a different IP — before RL-1 this returned 200, because no identity key was produced without a store',
    );
});

test('a store-scoped auth call keeps the behaviour it already had', async () => {
    // The fix must be purely additive. This is the shape every existing caller uses.
    const app = appFor({
        storeId: '11111111-1111-1111-1111-111111111111',
        email: EMAIL,
        operation: 'rl1-scoped-probe',
    });
    const statuses = await callFromDistinctIps(app, IDENTITY_MAX + 1);

    assert.deepEqual(statuses.slice(0, IDENTITY_MAX), Array(IDENTITY_MAX).fill(200));
    assert.equal(statuses[IDENTITY_MAX], 429);
});

test('two different accounts do not share a store-less identity bucket', async () => {
    // A single shared bucket for every store-less caller would be a denial-of-service on every
    // buyer at once: one attacker could lock out the whole realm.
    const first = appFor({ email: 'a@example.com', operation: 'rl1-separation-probe' });
    const second = appFor({ email: 'b@example.com', operation: 'rl1-separation-probe' });

    await callFromDistinctIps(first, IDENTITY_MAX + 1);
    const secondStatuses = await callFromDistinctIps(second, 1);

    assert.equal(
        secondStatuses[0],
        200,
        'exhausting one account must not throttle a different one',
    );
});

test('an identity with no email and no contact still gets the per-IP limit', async () => {
    // Nothing to key an account limit on here, so only the IP check applies. That is a real limit,
    // not an absence of one — asserted so a future change cannot quietly drop it too.
    const app = appFor({ operation: 'rl1-anonymous-probe' });
    const res = await app.request(
        '/probe',
        { method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.7' } },
        {} as Env,
    );
    assert.equal(res.status, 200);

    let blocked = false;
    for (let i = 0; i < 40; i += 1) {
        const repeat = await app.request(
            '/probe',
            { method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.7' } },
            {} as Env,
        );
        if (repeat.status === 429) { blocked = true; break; }
    }
    assert.ok(blocked, 'the per-IP limit must still stop a flood from one address');
});
