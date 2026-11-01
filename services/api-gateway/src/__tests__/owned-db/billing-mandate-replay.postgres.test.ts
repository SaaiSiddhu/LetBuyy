import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before, afterEach } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';

// Every write in this suite goes to its disposable owned Postgres/PostgREST pair.
const owned = requireOwnedDatabase();
const tenant = newSyntheticTenant('mandate-replay');
const ownerId = randomUUID();
const ownerEmail = `syn-mandate-owner-${ownerId}@example.invalid`;
let gateway: Gateway;

before(async () => {
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ('${ownerId}','${ownerEmail}',true);
        UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${tenant.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        RAZORPAY_KEY_ID: 'rzp_live_synthetic_never_contacted',
        RAZORPAY_KEY_SECRET: 'synthetic-never-contacted',
    }));
});
afterEach(async () => { await gateway.settle(); });

function issue(key: string, plan: 'launch' | 'growth' = 'launch', providerMode: 'sandbox' | 'live' = 'sandbox') {
    return signedIdentityHeaders(ownerId, ownerEmail, tenant.siteId).then(headers => gateway.request('/v1/billing/mandate', {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: JSON.stringify({ store_id: tenant.siteId, plan_slug: plan, billing_period: 'monthly', provider_mode: providerMode, idempotency_key: key }),
    }));
}

test('concurrent sandbox mandate retries have one durable winner and conflicting intent is refused', async () => {
    const key = `mandate:${tenant.siteId}:${randomUUID()}`;
    const responses = await Promise.all([issue(key), issue(key)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 201], responses.map(response => response.text).join('\n'));
    assert.equal(responses[0].json?.data?.mandate?.id, responses[1].json?.data?.mandate?.id);
    assert.equal(owned.psql(`SELECT count(*) FROM billing_mandates WHERE site_id='${tenant.siteId}' AND idempotency_key='${key}';`), '1');
    const changed = await issue(key, 'growth');
    assert.equal(changed.status, 409, changed.text);
});

test('configured credentials do not turn a synthetic mandate into live provider evidence', async () => {
    const key = `mandate:${tenant.siteId}:${randomUUID()}`;
    const response = await issue(key, 'launch', 'live');
    assert.equal(response.status, 503, response.text);
    assert.equal(response.json?.error?.code, 'AUTOPAY_PROVIDER_SETUP_REQUIRED');
    assert.equal(owned.psql(`SELECT count(*) FROM billing_mandates WHERE site_id='${tenant.siteId}' AND idempotency_key='${key}';`), '0');
});
