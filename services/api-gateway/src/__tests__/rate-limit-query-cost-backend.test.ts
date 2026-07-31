import assert from 'node:assert/strict';
import test from 'node:test';
import { checkQueryCostRateLimitKey } from '../middleware/rateLimit';

// Query-cost rate limiting backend selection.
//
// Regression cover for the 2026-08-01 production incident: every /v1 data route
// returned 503 RATE_LIMIT_UNAVAILABLE. Unlike the fixed-window limiters — whose KV
// fallback is `Boolean(env.CACHE) && (isProduction || kvRateLimitFallbackEnabled(env))`
// — the query-cost limiter has no `isProduction ||` clause, so with no Upstash Redis
// and no explicit flag it correctly fails CLOSED in production.
//
// The production fix is configuration only (RATE_LIMIT_KV_FALLBACK="on" in
// [env.production.vars]); the limiter itself is deliberately unchanged. These tests
// pin both the fail-closed contract and the fact that enabling the KV backend selects
// a backend WITHOUT weakening the limit.

interface StubKv {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

function createStubKv(): StubKv {
    const store = new Map<string, string>();
    return {
        async get(key) {
            return store.has(key) ? (store.get(key) as string) : null;
        },
        async put(key, value) {
            store.set(key, value);
        },
    };
}

const PRODUCTION = { ENVIRONMENT: 'production', APP_ENV: 'production', NODE_ENV: 'production' };
const STAGING = { ENVIRONMENT: 'staging', APP_ENV: 'staging', NODE_ENV: 'production' };

test('production with no Redis and no KV flag fails closed (the incident)', async () => {
    const result = await checkQueryCostRateLimitKey(
        { ...PRODUCTION } as never,
        { key: 'no-backend', cost: 1 },
    );

    assert.equal(result.unavailable, true, 'must fail closed when no approved backend exists');
    assert.equal(result.allowed, false, 'fail-closed must not admit traffic');
});

test('production with CACHE bound but the flag off still fails closed', async () => {
    const result = await checkQueryCostRateLimitKey(
        { ...PRODUCTION, CACHE: createStubKv() } as never,
        { key: 'kv-flag-off', cost: 1 },
    );

    assert.equal(result.unavailable, true, 'KV must not be used for query-cost unless explicitly enabled');
});

test('production with CACHE + RATE_LIMIT_KV_FALLBACK=on serves the check (the fix)', async () => {
    const result = await checkQueryCostRateLimitKey(
        { ...PRODUCTION, CACHE: createStubKv(), RATE_LIMIT_KV_FALLBACK: 'on' } as never,
        { key: 'kv-flag-on', cost: 1 },
    );

    assert.notEqual(result.unavailable, true, 'approved KV backend must service the check');
    assert.equal(result.allowed, true, 'a single cheap request must be admitted');
});

test('enabling the KV backend selects a backend without weakening the limit', async () => {
    const env = { ...PRODUCTION, CACHE: createStubKv(), RATE_LIMIT_KV_FALLBACK: 'on' } as never;
    const options = { key: 'kv-enforced', cost: 1, pointsPerSecond: 1, capacity: 3 };

    for (let i = 0; i < 3; i += 1) {
        const allowed = await checkQueryCostRateLimitKey(env, options);
        assert.equal(allowed.allowed, true, `request ${i + 1} should be within capacity`);
    }

    const exceeded = await checkQueryCostRateLimitKey(env, options);
    assert.equal(exceeded.allowed, false, 'requests beyond capacity must still be rate limited');
    assert.notEqual(exceeded.unavailable, true, 'a real limit decision is not a backend outage');
});

test('non-production without a backend degrades to in-memory rather than failing closed', async () => {
    const result = await checkQueryCostRateLimitKey(
        { ...STAGING } as never,
        { key: 'staging-no-backend', cost: 1 },
    );

    assert.equal(result.allowed, true, 'staging must not fail closed');
    assert.notEqual(result.unavailable, true, 'staging uses the in-memory limiter');
});
