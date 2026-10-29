// Mounted Gateway + disposable PostgreSQL; domain claims stay local and unverified.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLATFORM_DOMAIN, DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Miniflare, createFetchMock } from 'miniflare';
import { buildSync } from 'esbuild';
const owned = requireOwnedDatabase();
test('a real owner may stage an external domain but cannot claim either platform zone when env is omitted', async () => {
    const site = newSyntheticTenant('domain-roots'), actor = crypto.randomUUID();
    const email = `syn-domain-${actor}@example.invalid`;
    seedSyntheticTenant(owned.psql, site);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
        INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${actor}','${site.siteId}','enterprise','active');`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        NEXT_PUBLIC_STORE_ROOT_DOMAIN: DEFAULT_STOREFRONT_DOMAIN, PLATFORM_ROOT_DOMAIN: undefined,
        CUSTOM_DOMAIN_CNAME_TARGET: 'connect.example.test',
    }));
    const claim = async (domain: string) => gateway.request('/v1/custom/domains', {
        method: 'POST', headers: { ...await signedIdentityHeaders(actor,email,site.siteId), 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({site_id:site.siteId,domain}),
    });
    try {
        const external = `syn-${crypto.randomUUID().slice(0,8)}.example.in`;
        const positive = await claim(external);
        assert.equal(positive.status,201,positive.text);
        for (const zone of [DEFAULT_PLATFORM_DOMAIN, DEFAULT_STOREFRONT_DOMAIN]) {
            for (const domain of [zone,`merchant.${zone}`]) {
                const denied = await claim(domain);
                assert.equal(denied.status,400,`Owned zone must be rejected before any claim: ${domain}`);
                assert.equal(denied.json?.error?.code,'INVALID_DOMAIN');
            }
        }
        assert.equal(owned.psql(`SELECT custom_domain FROM sites WHERE id='${site.siteId}';`),external,'denials cannot overwrite the legitimate staged claim');
    } finally { await gateway.settle(); }
});

test('real owner verification provisions one serialized widget through the native coordinator; unverified and foreign claims cannot write it', async () => {
    const sites = [newSyntheticTenant('turnstile-a'), newSyntheticTenant('turnstile-b')];
    const actor = crypto.randomUUID(), email = `syn-turnstile-${actor}@example.invalid`;
    const domains = sites.map(site => `${site.subdomain}.example.in`);
    const proof = 'synthetic-domain-owner-proof', target = 'connect.synthetic.invalid';
    for (const site of sites) seedSyntheticTenant(owned.psql, site);
    owned.script(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);`);
    for (const [index, site] of sites.entries()) owned.script(`
        UPDATE sites SET custom_user_id='${actor}',custom_domain='${domains[index]}',custom_domain_status='verifying',custom_domain_verification_token='${proof}' WHERE id='${site.siteId}';
        INSERT INTO site_domains(site_id,domain,role,status,ssl_status,verification_token) VALUES('${site.siteId}','${domains[index]}','primary','verifying','pending','${proof}');`);
    const config = { accountId: 'a'.repeat(32), siteKey: 'synthetic-owned-widget', apiToken: 'synthetic-owned-management-token', configurationId: crypto.randomUUID() };
    let widget = { sitekey: config.siteKey, name: 'Synthetic native widget', mode: 'managed', clearance_level: 'no_clearance', domains: ['accounts.example.in'], secret: 'synthetic-never-return-provider-secret' };
    const providerWrites: string[][] = [];
    const network = createFetchMock(); network.disableNetConnect();
    const providerPath = `/client/v4/accounts/${config.accountId}/challenges/widgets/${config.siteKey}`;
    network.get('https://api.cloudflare.com').intercept({ path: providerPath, method: 'GET' }).reply(() => ({ statusCode: 200, data: JSON.stringify({ success: true, result: widget }) })).persist();
    network.get('https://api.cloudflare.com').intercept({ path: providerPath, method: 'PUT' }).reply(options => {
        const update = JSON.parse(String(options.body));
        assert.equal(update.mode, 'managed'); assert.equal(update.clearance_level, 'no_clearance');
        assert.deepEqual(widget.domains.filter(domain => !update.domains.includes(domain)), []);
        providerWrites.push(update.domains); widget = { ...widget, ...update };
        return { statusCode: 200, data: JSON.stringify({ success: true, result: widget }) };
    }).persist();
    const entry = new URL('../../durable/runtime-coordinator.ts', import.meta.url).pathname;
    const bundle = buildSync({ stdin: { contents: `export {LetbuyyRuntimeDurableObject} from ${JSON.stringify(entry)};export default {fetch(){return new Response('synthetic native coordinator')}};`, resolveDir: process.cwd(), sourcefile: 'owned-turnstile-coordinator.ts' }, bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', conditions: ['workerd', 'browser'], external: ['node:*'], logLevel: 'silent' }).outputFiles[0].text;
    const native = new Miniflare({ modules: true, script: bundle, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false, fetchMock: network, durableObjects: { RUNTIME_COORDINATOR: 'LetbuyyRuntimeDurableObject' }, durableObjectsPersist: false, bindings: { ENVIRONMENT: 'production', TURNSTILE_DOMAIN_MANAGEMENT: JSON.stringify(config) } });
    const admission = await native.getDurableObjectNamespace('RUNTIME_COORDINATOR');
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { TURNSTILE_DOMAIN_MANAGEMENT: JSON.stringify(config), RUNTIME_COORDINATOR: admission, CUSTOM_DOMAIN_CNAME_TARGET: target, VERCEL_API_TOKEN: 'synthetic-unit-only', VERCEL_STOREFRONT_PROJECT_ID: 'synthetic-commerce' }));
    const original = globalThis.fetch; let txtVisible = false;
    globalThis.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (['cloudflare-dns.com', 'dns.google'].includes(url.hostname)) {
            const type = url.searchParams.get('type');
            return Response.json({ Status: 0, Answer: type === 'TXT' ? txtVisible ? [{ data: `"${proof}"` }] : [] : type === 'CNAME' ? [{ data: `"${target}"` }] : [] });
        }
        if (url.hostname === 'api.vercel.com') {
            const match = url.pathname.match(/\/domains\/([^/]+)/);
            return Response.json(url.pathname.endsWith('/config') ? { configuredBy: 'CNAME', misconfigured: false } : { name: decodeURIComponent(match?.[1] || ''), projectId: 'synthetic-commerce', verified: true });
        }
        if (url.origin !== new URL(owned.restUrl).origin) throw new Error('Unexpected synthetic provider destination');
        return original(input, init);
    };
    const verify = async (index: number, suppliedDomain = domains[index]) => gateway.request('/v1/custom/domains/verify', { method: 'POST', headers: { ...await signedIdentityHeaders(actor, email, sites[index].siteId), 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ site_id: sites[index].siteId, domain: suppliedDomain }) });
    try {
        assert.equal((await verify(0)).status, 202);
        assert.equal(providerWrites.length, 0, 'missing ownership proof cannot authorize a widget hostname');
        txtVisible = true;
        assert.equal((await verify(0, domains[1])).status, 409, 'a domain from another store cannot be substituted');
        assert.equal(providerWrites.length, 0);
        const responses = await Promise.all([verify(0), verify(1)]);
        for (const result of responses) { assert.equal(result.status, 200, result.text); assert.equal(result.json?.data.customer_verification.status, 'ready'); assert.ok(!result.text.includes(config.apiToken)); assert.ok(!result.text.includes(widget.secret)); }
        assert.deepEqual(new Set(widget.domains), new Set(['accounts.example.in', ...domains]));
        assert.equal(providerWrites.length, 2, 'concurrent stores keep both additions');
        const status = await gateway.request(`/v1/custom/domains/${domains[0]}/status?site_id=${sites[0].siteId}`, { headers: await signedIdentityHeaders(actor, email, sites[0].siteId) });
        assert.equal(status.status, 200, status.text); assert.equal(status.json?.data.customer_verification.status, 'ready');
        assert.equal(providerWrites.length, 2, 'status GET cannot update provider configuration');
        assert.equal((await gateway.request('/v1/custom/domains/verify', { method: 'POST', body: JSON.stringify({ site_id: sites[0].siteId, domain: domains[0] }) })).status, 401);
        assert.equal(providerWrites.length, 2);
    } finally { globalThis.fetch = original; await gateway.settle(); await native.dispose(); }
});

test('mounted domain health returns the owner TXT and CNAME without unrelated apex advice', async () => {
    const site = newSyntheticTenant('domain-records'), foreign = newSyntheticTenant('domain-private'), actor = crypto.randomUUID();
    const email = `syn-domain-${actor}@example.invalid`, domain = 'store.synthetic.example.in', token = 'synthetic-domain-ownership';
    for (const tenant of [site, foreign]) seedSyntheticTenant(owned.psql, tenant);
    owned.script(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);
        UPDATE sites SET custom_user_id='${actor}',custom_domain='${domain}',custom_domain_status='active',custom_domain_verification_token='${token}' WHERE id='${site.siteId}';
        INSERT INTO site_domains(site_id,domain,role,status,ssl_status,verification_token) VALUES('${site.siteId}','${domain}','redirect','active','active','${token}');`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        CUSTOM_DOMAIN_CNAME_TARGET: 'connect.synthetic.invalid',
        VERCEL_API_TOKEN: 'synthetic-unit-only', VERCEL_STOREFRONT_PROJECT_ID: 'synthetic-commerce',
    }));
    const original = globalThis.fetch, providerMethods: string[] = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (['cloudflare-dns.com', 'dns.google'].includes(url.hostname)) {
            const name = url.searchParams.get('name'), type = url.searchParams.get('type');
            const answer = type === 'TXT' && name === `_letbuyy-challenge.${domain}` ? token
                : type === 'CNAME' && name === domain ? 'connect.synthetic.invalid' : '';
            return Response.json({ Status: 0, Answer: answer ? [{ data: `"${answer}"` }] : [] });
        }
        if (url.hostname === 'api.vercel.com') {
            providerMethods.push(init?.method ?? 'GET');
            return Response.json(url.pathname.endsWith('/config') ? { configuredBy: 'CNAME', misconfigured: false }
                : { name: domain, verified: true });
        }
        return original(input, init);
    };
    try {
        const headers = await signedIdentityHeaders(actor, email, site.siteId);
        const health = await gateway.request(`/v1/custom/domains/${domain}/status?site_id=${site.siteId}`, { headers });
        assert.equal(health.status, 200, health.text);
        assert.equal(health.json?.data.ssl_active, true);
        assert.equal(health.json?.data.status, 'active');
        assert.deepEqual(health.json?.data.records.map((record: { type: string; host: string }) => [record.type, record.host]), [
            ['TXT', `_letbuyy-challenge.${domain}`], ['CNAME', domain],
        ]);
        const calls = providerMethods.length;
        const denied = await gateway.request(`/v1/custom/domains/${domain}/status?site_id=${foreign.siteId}`, {
            headers: await signedIdentityHeaders(actor, email, site.siteId),
        });
        assert.equal(denied.status, 404);
        assert.ok(!denied.text.includes(token));
        assert.equal((await gateway.request(`/v1/custom/domains/${domain}/status?site_id=${site.siteId}`)).status, 401);
        assert.equal(providerMethods.length, calls, 'unauthorized reads must not reach the provider');
        assert.ok(calls > 0 && providerMethods.every(method => method === 'GET'));
    } finally { globalThis.fetch = original; await gateway.settle(); }
});
