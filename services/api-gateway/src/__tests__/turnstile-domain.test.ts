import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeTurnstileHostname, readTurnstileCoverage } from '@letbuyy/infrastructure/cloudflare-adapter';
import { customDomainCustomerVerification } from '../lib/turnstile-domain';
import { LetbuyyRuntimeDurableObject } from '../durable/runtime-coordinator';
import type { Env } from '../index';

const config = { accountId: 'a'.repeat(32), siteKey: 'synthetic-widget', apiToken: 'synthetic-management-token-for-tests' };
const management = JSON.stringify({ ...config, configurationId: '11111111-1111-4111-8111-111111111111' });
const site = '22222222-2222-4222-8222-222222222222';
const base = () => ({ sitekey: config.siteKey, name: 'Synthetic owned widget', mode: 'managed', clearance_level: 'no_clearance', domains: ['accounts.example.in'], bot_fight_mode: false, offlabel: false, ephemeral_id: false, region: 'world', secret: 'synthetic-provider-secret-never-return' });
function provider(initial: Record<string, unknown> = base()) {
    let row = structuredClone(initial);
    const writes: Record<string, unknown>[] = [];
    const fetcher = (async (url, init) => {
        const destination = new URL(String(url));
        assert.equal(destination.protocol, 'https:'); assert.equal(destination.host, 'api.cloudflare.com');
        assert.equal(destination.pathname, `/client/v4/accounts/${config.accountId}/challenges/widgets/${config.siteKey}`);
        assert.equal(destination.search, ''); assert.equal(destination.username + destination.password + destination.hash, '');
        assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal);
        if (init?.method === 'PUT') {
            const update = JSON.parse(String(init.body)); writes.push(update);
            await new Promise(resolve => setTimeout(resolve, 3));
            row = { ...row, ...update };
        }
        return Response.json({ success: true, result: row });
    }) as typeof fetch;
    return { fetcher, writes, row: () => row };
}
test('verified hostname registration preserves every existing hostname and security setting, then reads back', async () => {
    const p = provider();
    assert.deepEqual(await authorizeTurnstileHostname(config, 'shop.example.org', p.fetcher), { status: 'ready' });
    assert.deepEqual(p.writes[0], { domains: ['accounts.example.in', 'shop.example.org'], name: 'Synthetic owned widget', mode: 'managed', clearance_level: 'no_clearance', bot_fight_mode: false, offlabel: false, ephemeral_id: false, region: 'world' });
    assert.ok(!JSON.stringify(p.writes).includes('secret'));
    assert.deepEqual(await readTurnstileCoverage(config, 'checkout.shop.example.org', p.fetcher), { status: 'ready' });
    await authorizeTurnstileHostname(config, 'checkout.shop.example.org', p.fetcher);
    assert.equal(p.writes.length, 1, 'covered child hosts never consume another slot');
});
test('capacity is explicit and never triggers another widget or a destructive overwrite', async () => {
    const p = provider({ ...base(), domains: Array.from({ length: 10 }, (_, index) => `shop${index}.example.org`) });
    assert.deepEqual(await authorizeTurnstileHostname(config, 'new.example.in', p.fetcher), { status: 'capacity_reached' });
    assert.equal(p.writes.length, 0);
});
for (const host of ['https://shop.example.org', '*.example.org', '127.0.0.1', 'localhost', 'shop.example.org/path', 'SHOP.example.org']) {
    test(`reject malformed registration ${host} before provider access`, async () => {
        let calls = 0;
        const result = await authorizeTurnstileHostname(config, host, (async () => { calls++; throw Error('unreachable'); }) as typeof fetch);
        assert.equal(result.status, 'configuration_required'); assert.equal(calls, 0);
    });
}
for (const changed of [{ mode: 'invisible' }, { clearance_level: 'managed' }, { sitekey: 'foreign-widget' }, { domains: [] }]) {
    test(`refuse provider security/configuration drift ${Object.keys(changed)[0]} without writing`, async () => {
        const p = provider({ ...base(), ...changed });
        assert.equal((await authorizeTurnstileHostname(config, 'shop.example.org', p.fetcher)).status, 'configuration_required');
        assert.equal(p.writes.length, 0);
    });
}
test('provider HTTP, malformed JSON and pre-write network failures never grant readiness or expose details', async () => {
    for (const fetcher of [async () => new Response('private diagnostic', { status: 503 }), async () => new Response('invalid json'), async () => { throw Error('private diagnostic'); }]) {
        assert.deepEqual(await authorizeTurnstileHostname(config, 'shop.example.org', fetcher as typeof fetch), { status: 'unavailable' });
    }
});
test('unknown PUT outcome and mismatched readback are retained as uncertain, not success', async () => {
    for (const mode of ['lost', 'changed']) {
        const p = provider();
        const fetcher = (async (url, init) => {
            if (init?.method === 'PUT') {
                if (mode === 'lost') throw Error('synthetic lost acknowledgement');
                return Response.json({ success: true, result: { ...base(), domains: ['foreign.example.org'] } });
            }
            return p.fetcher(url, init);
        }) as typeof fetch;
        assert.deepEqual(await authorizeTurnstileHostname(config, 'shop.example.org', fetcher), { status: 'unavailable', uncertain: true });
    }
});
test('ownership, DNS and HTTPS are all required before a coordinator mutation', async () => {
    let calls = 0;
    const env = { TURNSTILE_DOMAIN_MANAGEMENT: management, RUNTIME_COORDINATOR: { idFromName: () => 'one-configured-widget', get: () => ({ fetch: async () => { calls++; return Response.json({ status: 'ready' }); } }) } as unknown as DurableObjectNamespace };
    for (const facts of [{ txt_verified: false, cname_verified: true, ssl_active: true }, { txt_verified: true, cname_verified: false, ssl_active: true }, { txt_verified: true, cname_verified: true, ssl_active: false }]) {
        assert.deepEqual(await customDomainCustomerVerification(env, site, 'shop.example.org', facts), { status: 'pending' });
    }
    assert.equal(calls, 0);
    assert.equal((await customDomainCustomerVerification(env, site, 'shop.example.org', { txt_verified: true, cname_verified: true, ssl_active: true })).status, 'ready');
    assert.equal(calls, 1);
});
test('the existing coordinator serializes concurrent adds and holds later writes after uncertainty', async () => {
    let chain = Promise.resolve<unknown>(undefined);
    const values = new Map<string, unknown>();
    const state = {
        blockConcurrencyWhile<T>(callback: () => Promise<T>) { const next = chain.then(callback); chain = next.catch(() => undefined); return next; },
        storage: { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); }, delete: async (key: string) => values.delete(key) },
    } as unknown as DurableObjectState;
    const p = provider(), original = globalThis.fetch;
    globalThis.fetch = p.fetcher;
    try {
        const coordinator = new LetbuyyRuntimeDurableObject(state, { TURNSTILE_DOMAIN_MANAGEMENT: management } as Env);
        const run = (hostname: string) => coordinator.fetch(new Request('https://runtime.internal/turnstile-hostnames/ensure', { method: 'POST', body: JSON.stringify({ site_id: site, hostname }) }));
        const responses = await Promise.all([run('one.example.org'), run('two.example.org')]);
        for (const response of responses) assert.equal((await response.json() as { status: string }).status, 'ready');
        assert.deepEqual(p.row().domains, ['accounts.example.in', 'one.example.org', 'two.example.org']);
        globalThis.fetch = (async (url, init) => { if (init?.method === 'PUT') throw Error('synthetic lost PUT'); return p.fetcher(url, init); }) as typeof fetch;
        assert.equal((await (await run('three.example.org')).json() as { status: string }).status, 'unavailable');
        globalThis.fetch = p.fetcher;
        assert.equal((await (await run('four.example.org')).json() as { status: string }).status, 'unavailable');
        assert.equal(p.writes.length, 2, 'no blind overwrite after an uncertain mutation');
    } finally { globalThis.fetch = original; }
});
