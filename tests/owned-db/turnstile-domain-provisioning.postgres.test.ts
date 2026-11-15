import { fileURLToPath } from 'node:url';
// Real Gateway/PostgreSQL/native coordinator; provider HTTP is an isolated fixture.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { buildSync } from 'esbuild';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned = requireOwnedDatabase();
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
    const providerPath = `/client/v4/accounts/${config.accountId}/challenges/widgets/${config.siteKey}`;
    const provider = async (request: Request) => {
        const url = new URL(request.url);
        assert.equal(url.origin, 'https://api.cloudflare.com'); assert.equal(url.pathname, providerPath);
        assert.ok(['GET', 'PUT'].includes(request.method), 'only this synthetic widget is reachable');
        if (request.method === 'PUT') {
            const update = await request.json() as typeof widget;
            assert.equal(update.mode, 'managed'); assert.equal(update.clearance_level, 'no_clearance');
            assert.deepEqual(widget.domains.filter(domain => !update.domains.includes(domain)), []);
            providerWrites.push(update.domains); widget = { ...widget, ...update };
        }
        return Response.json({ success: true, result: widget }) as never;
    };
    const entry = fileURLToPath(new URL('../../services/api-gateway/src/durable/runtime-coordinator.ts', import.meta.url));
    const bundle = buildSync({ stdin: { contents: `export {LetbuyyRuntimeDurableObject} from ${JSON.stringify(entry)};export default {fetch(){return new Response('synthetic native coordinator')}};`, resolveDir: process.cwd(), sourcefile: 'owned-turnstile-coordinator.ts' }, bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', conditions: ['workerd', 'browser'], external: ['node:*'], logLevel: 'silent' }).outputFiles[0].text;
    const native = new Miniflare({ modules: true, script: bundle, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false, outboundService: provider, durableObjects: { RUNTIME_COORDINATOR: { className: 'LetbuyyRuntimeDurableObject', useSQLite: true } }, durableObjectsPersist: false, bindings: { ENVIRONMENT: 'production', TURNSTILE_DOMAIN_MANAGEMENT: JSON.stringify(config) } });
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

