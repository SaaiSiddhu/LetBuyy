import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const merchantRequire = createRequire(new URL('../package.json', import.meta.url));
const z = merchantRequire('zod').z;
const source = readFileSync(new URL('../src/app/api/stores/[store]/gift-cards/route.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { params: Promise.resolve({ store: 'owned-shop' }) };
const intentId = '761a64cb-d582-4fd0-9fdf-dc6d84f96b83';

function fixture({ denied = false, replayed = false } = {}) {
    const calls = [];
    const issueSchema = z.object({
        store_id: z.string(), idempotency_key: z.string().optional(), initial_value: z.number().positive().max(999999),
        currency: z.string().optional(), expires_at: z.string().optional().nullable(),
        recipient_email: z.email().optional().nullable(), recipient_name: z.string().optional().nullable(), note: z.string().optional().nullable(),
    });
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        zod: { z },
        '@letbuyy/commerce-core': { CreateGiftCardSchema: issueSchema },
        '@/lib/stores/resolve-owned-store': {
            resolveOwnedStoreId: async store => {
                calls.push(['ownership', store]);
                return denied ? { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) } : { storeId: 'owned-site' };
            },
        },
        '@/lib/api/client': {
            createMerchantApiClient: () => ({ products: { giftCards: {
                list: async () => [],
                create: async input => { calls.push(['issue', input]); return { id: 'card-1', replayed, ...(replayed ? {} : { code: 'secret-code' }) }; },
            } } }),
            merchantApiErrorResponse: () => Response.json({ error: 'UPSTREAM_UNAVAILABLE' }, { status: 503 }),
        },
    };
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { route: exports, calls };
}

const request = body => ({ json: async () => body });

test('gift card issue requires a valid persistent intent and never trusts a supplied site', async () => {
    const f = fixture();
    for (const body of [{ initial_value: 500 }, { initial_value: 500, intent_id: 'bad' }, { initial_value: -1, intent_id: intentId }]) {
        assert.equal((await f.route.POST(request(body), context)).status, 400);
    }
    assert.ok(f.calls.every(([kind]) => kind === 'ownership'));
    const response = await f.route.POST(request({ initial_value: 500, intent_id: intentId, recipient_email: 'buyer@example.invalid' }), context);
    assert.equal(response.status, 201);
    const issue = f.calls.at(-1)[1];
    assert.equal(issue.store_id, 'owned-site');
    assert.equal(issue.idempotency_key, `gift_card.issue:owned-site:${intentId}`);
    assert.equal(issue.intent_id, undefined);
});

test('same intent reaches the gateway with the same key; a replay never claims a new code', async () => {
    const f = fixture({ replayed: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await f.route.POST(request({ initial_value: 500, intent_id: intentId }), context);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { data: { id: 'card-1', replayed: true } });
    }
    assert.equal(f.calls[1][1].idempotency_key, f.calls[3][1].idempotency_key);
});

test('denied store cannot issue a card', async () => {
    const f = fixture({ denied: true });
    assert.equal((await f.route.POST(request({ initial_value: 500, intent_id: intentId }), context)).status, 403);
    assert.deepEqual(f.calls, [['ownership', 'owned-shop']]);
});
