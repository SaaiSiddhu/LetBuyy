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
