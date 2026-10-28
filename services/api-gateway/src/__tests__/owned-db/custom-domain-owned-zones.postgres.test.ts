// Mounted Gateway + disposable PostgreSQL; domain claims stay local and unverified.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLATFORM_DOMAIN, DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
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
        const denied = await gateway.request(`/v1/custom/domains/${domain}/status?site_id=${foreign.siteId}`, { headers });
        assert.equal(denied.status, 404);
        assert.ok(!denied.text.includes(token));
        assert.equal((await gateway.request(`/v1/custom/domains/${domain}/status?site_id=${site.siteId}`)).status, 401);
        assert.equal(providerMethods.length, calls, 'unauthorized reads must not reach the provider');
        assert.ok(calls > 0 && providerMethods.every(method => method === 'GET'));
    } finally { globalThis.fetch = original; await gateway.settle(); }
});
