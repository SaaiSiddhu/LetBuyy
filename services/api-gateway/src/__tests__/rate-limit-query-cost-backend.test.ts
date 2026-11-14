import assert from 'node:assert/strict';
import test from 'node:test';
import { checkQueryCostRateLimitKey } from '../middleware/rateLimit';

// KV is eventually consistent and cannot enforce atomic query-cost admission.
// A missing configured atomic backend remains unavailable in production.

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

test('legacy KV flag cannot activate a non-atomic production admission backend', async () => {
    let writes=0;
    const result = await checkQueryCostRateLimitKey(
        { ...PRODUCTION, CACHE: { ...createStubKv(), put: async()=>{writes++;} }, RATE_LIMIT_KV_FALLBACK: 'on' } as never,
        { key: 'kv-no-longer-authoritative', cost: 1 },
    );
    assert.equal(result.unavailable, true);
    assert.equal(result.allowed, false);
    assert.equal(writes,0,'no hot-key counter writes');
});

test('a coordinator failure does not poison an unrelated subject', async () => {
    let calls=0;
    const env={...PRODUCTION,RUNTIME_COORDINATOR:{idFromName:(name:string)=>name,get:(name:string)=>({fetch:async()=>{
        if(++calls===1)throw new Error('Synthetic subject-specific unavailable response');
        return Response.json({allowed:true,remaining:199,resetAt:Date.now()+1000,cost:1,limit:200,policy:'synthetic',retryAfterMs:0});
    }})}} as never;
    const failed=await checkQueryCostRateLimitKey(env,{key:'failed-subject',cost:1});assert.equal(failed.unavailable,true);
    const result=await checkQueryCostRateLimitKey(env,{key:'healthy',cost:1});assert.equal(result.allowed,true);
});

test('non-production without a backend degrades to in-memory rather than failing closed', async () => {
    const result = await checkQueryCostRateLimitKey(
        { ...STAGING } as never,
        { key: 'staging-no-backend', cost: 1 },
    );

    assert.equal(result.allowed, true, 'staging must not fail closed');
    assert.notEqual(result.unavailable, true, 'staging uses the in-memory limiter');
});
