import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const merchantRequire = createRequire(new URL('../package.json', import.meta.url));
const source = readFileSync(new URL('../src/app/api/stores/[store]/billing/route.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { params: Promise.resolve({ store: 'owned-shop' }) };

function fixture({ denied = false, malformedBilling = false, mismatchedReplay = false, replayed = false } = {}) {
    const calls = [];
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        zod: merchantRequire('zod'),
        '@/lib/stores/resolve-owned-store': {
            resolveOwnedStoreId: async store => {
                calls.push(['ownership', store]);
                return denied ? { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) } : { storeId: 'owned-site' };
            },
        },
        '@/lib/api/client': {
            createMerchantApiClient: () => ({
                payments: { subscription: { get: async () => ({ subscription: { amount_paid: 49900, current_period_end: '2026-11-30', billing_period: 'monthly', plan: 'growth' }, store: {} }) } },
                stores: { get: async () => ({ currency: 'INR' }) },
                billing: {
                    invoices: { list: async () => malformedBilling ? {} : { invoices: [] } },
                    mandates: {
                        list: async () => ({ mandates: [] }),
                        create: async input => { calls.push(['create', input]); return { mandate: { id: 'mandate-1', status: 'active', plan_slug: mismatchedReplay ? 'launch' : input.plan_slug, billing_period: input.billing_period }, ...(replayed ? { replayed: true } : {}) }; },
                    },
                },
            }),
            merchantApiErrorResponse: () => Response.json({ error: 'UPSTREAM_UNAVAILABLE' }, { status: 503 }),
        },
    };
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { route: exports, calls };
}

function request(body) { return { json: async () => body }; }
const intent_id = '761a64cb-d582-4fd0-9fdf-dc6d84f96b83';

test('billing mandate rejects missing or malformed plan context without a write', async () => {
    for (const body of [{}, { billing_period: 'monthly' }, { plan_slug: 'starter' }, { plan_slug: 'unknown', billing_period: 'monthly', intent_id }, { plan_slug: 'launch', billing_period: 'monthly' }, { plan_slug: 'launch', billing_period: 'monthly', intent_id, upi_vpa: 'buyer@upi' }]) {
        const f = fixture();
        const response = await f.route.POST(request(body), context);
        assert.equal(response.status, 400);
        assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
    }
});

test('billing mandate forwards an explicit plan after ownership', async () => {
    const f = fixture();
    const response = await f.route.POST(request({ plan_slug: 'growth', billing_period: 'yearly', intent_id }), context);
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { data: { mandate: { id: 'mandate-1', status: 'active', plan_slug: 'growth', billing_period: 'yearly' } } });
    assert.deepEqual(f.calls[0], ['ownership', 'owned-shop']);
    assert.equal(f.calls[1][1].store_id, 'owned-site');
    assert.equal(f.calls[1][1].plan_slug, 'growth');
    assert.equal(f.calls[1][1].billing_period, 'yearly');
    assert.equal(f.calls[1][1].idempotency_key, `mandate:owned-site:${intent_id}`);
});

test('the same billing intent keeps its idempotency key across retries', async () => {
    const f = fixture();
    for (let attempt = 0; attempt < 2; attempt += 1) {
        assert.equal((await f.route.POST(request({ plan_slug: 'growth', billing_period: 'yearly', intent_id }), context)).status, 201);
    }
    assert.equal(f.calls[1][1].idempotency_key, f.calls[3][1].idempotency_key);
});

test('a replay for a different selection is reported as a conflict', async () => {
    const f = fixture({ mismatchedReplay: true });
    assert.equal((await f.route.POST(request({ plan_slug: 'growth', billing_period: 'yearly', intent_id }), context)).status, 409);
});

test('a recovered mandate is labeled as a replay', async () => {
    const f = fixture({ replayed: true });
    const response = await f.route.POST(request({ plan_slug: 'growth', billing_period: 'yearly', intent_id }), context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.replayed, true);
});

test('denied store never reaches billing mandate creation', async () => {
    const f = fixture({ denied: true });
    assert.equal((await f.route.POST(request({ plan_slug: 'growth', billing_period: 'yearly', intent_id }), context)).status, 403);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
});

test('billing read never treats last payment as the next bill', async () => {
    const f = fixture();
    const response = await f.route.GET({}, context);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.upcoming.amount_minor, null);
    assert.equal(body.data.upcoming.due_date, '2026-11-30');
    assert.deepEqual(body.data.invoices, []);
    assert.deepEqual(body.data.mandates, []);
});

test('incomplete billing history fails visibly rather than looking empty', async () => {
    const f = fixture({ malformedBilling: true });
    assert.equal((await f.route.GET({}, context)).status, 503);
});
