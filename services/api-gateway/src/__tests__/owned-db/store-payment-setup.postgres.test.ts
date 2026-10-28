// Real worker -> owned PostgREST -> migrated disposable PostgreSQL. No provider calls leave the process.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('payment setup is explicit, revisioned, tenant-bound and never manufactures live readiness', async t => {
    const tenant = newSyntheticTenant('pay-setup');
    const other = newSyntheticTenant('pay-other');
    seedSyntheticTenant(owned.psql, tenant); seedSyntheticTenant(owned.psql, other);
    const actor = randomUUID(), successor = randomUUID(), email = `pay-${actor}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
        ('${actor}','${email}',true,'Synthetic payment owner'),
        ('${successor}','pay-${successor}@example.invalid',true,'Synthetic successor');
        UPDATE sites SET custom_user_id='${actor}',online_payment_enabled=false,cod_enabled=true WHERE id='${tenant.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), { PAYMENT_CONFIG_ENCRYPTION_KEY: randomUUID() }));
    const path = `/v1/stores/${tenant.siteId}/payment-config`;
    const request = async (method: string, body?: Record<string, unknown>, key = randomUUID(), selected = tenant.siteId) =>
        gateway.request(path, { method, headers: { ...await signedIdentityHeaders(actor, email, selected), 'X-Idempotency-Key': key },
            ...(body ? { body: JSON.stringify(body) } : {}) });
    const originalFetch = globalThis.fetch;
    let providerStatus = 200, verificationCalls = 0;
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.hostname === 'api.razorpay.com') {
            assert.equal(url.pathname, '/v1/payments'); assert.equal(url.search, '?count=1');
            assert.equal(init?.method || 'GET', 'GET'); verificationCalls += 1;
            return new Response(JSON.stringify({ entity: 'collection', items: [] }), { status: providerStatus, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input, init);
    });
    const credentials = { key_id: ['rzp', 'test', randomUUID().replaceAll('-', '')].join('_'),
        key_secret: randomUUID().replaceAll('-', ''), test_mode: true };
    const row = () => owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${tenant.siteId}';`);
    await t.test('positive read: known owner sees unavailable configuration without fabricated environment or approval', async () => {
        const response = await request('GET'); assert.equal(response.status, 200, response.text);
        assert.equal(response.json?.data.provider_mode, null);
        assert.equal(response.json?.data.setup.can_enable_online, false);
        assert.equal(response.json?.data.setup.bank_verification, 'not_confirmed');
        assert.equal(response.json?.data.cod_enabled, true);
    });
    await t.test('online cannot be enabled through dedicated or generic store routes before readiness', async () => {
        const before = row();
        const dedicated = await request('PATCH', { online_payment_enabled: true }); assert.equal(dedicated.status, 409, dedicated.text);
        const generic = await gateway.request(`/v1/stores/${tenant.siteId}`, { method: 'PATCH', headers: {
            ...await signedIdentityHeaders(actor, email, tenant.siteId), 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify({ online_payment_enabled: true }) });
        assert.equal(generic.status, 409, generic.text); assert.equal(row(), before);
    });
    let revision: string;
    await t.test('verified save persists encrypted test connection but does not activate online or alter COD', async () => {
        const response = await request('POST', credentials); assert.equal(response.status, 200, response.text);
        revision = response.json?.data.revision;
        assert.equal(response.json?.data.online_payment_enabled, false); assert.equal(response.json?.data.cod_enabled, true);
        assert.equal(response.json?.data.setup.can_enable_online, true); assert.equal(response.json?.data.setup.status, 'disabled');
        assert.equal(response.json?.data.setup.business_verification, 'not_confirmed');
        assert.ok(!response.text.includes(credentials.key_secret)); assert.ok(!response.text.includes('key_secret_ciphertext'));
        const stored = owned.psql(`SELECT payment_settings->'razorpay'->>'key_secret_ciphertext' FROM sites WHERE id='${tenant.siteId}';`);
        assert.ok(stored); assert.ok(!stored.includes(credentials.key_secret));
    });
    await t.test('rejected credentials and mode mismatch leave existing settings untouched', async () => {
        const before = row(); providerStatus = 401;
        const response = await request('POST', { ...credentials, key_secret: randomUUID().replaceAll('-', '') });
        assert.equal(response.status, 400, response.text); assert.equal(row(), before);
        providerStatus = 200; const calls = verificationCalls;
        const mismatch = await request('POST', { ...credentials, test_mode: false }); assert.equal(mismatch.status, 400, mismatch.text);
        const live = await request('POST', { ...credentials, key_id: credentials.key_id.replace('_test_', '_live_'), test_mode: false });
        assert.equal(live.status, 409, live.text); assert.equal(verificationCalls, calls); assert.equal(row(), before);
    });
    const activationKey = randomUUID();
    await t.test('explicit activation has a stable retry receipt and stale revision conflicts', async () => {
        const activation = { online_payment_enabled: true, expected_revision: revision };
        const first = await request('PATCH', activation, activationKey); assert.equal(first.status, 200, first.text);
        assert.equal(first.json?.data.setup.online_checkout_available, true);
        const after = row(); const retry = await request('PATCH', activation, activationKey);
        assert.equal(retry.status, 200, retry.text); assert.deepEqual(retry.json, first.json); assert.equal(row(), after);
        const stale = await request('PATCH', { cod_enabled: false, expected_revision: revision });
        assert.equal(stale.status, 409, stale.text); assert.equal(row(), after);
    });
    await t.test('CAS refuses a connection replacement raced by a method change', async () => {
        let interposed = false;
        const tap = tapRest(owned.restEnv().SUPABASE_URL as string, async (call, forward) => {
            if (!interposed && call.resource === 'sites' && call.method === 'PATCH') {
                interposed = true;
                owned.psql(`UPDATE sites SET cod_enabled=false,updated_at=clock_timestamp() WHERE id='${tenant.siteId}';`);
            }
            return forward();
        });
        try {
            const result = await request('POST', credentials); assert.equal(result.status, 409, result.text); assert.equal(interposed, true);
            assert.equal(owned.psql(`SELECT online_payment_enabled FROM sites WHERE id='${tenant.siteId}';`), 't', 'failed save cannot disable the active connection');
            assert.equal(owned.psql(`SELECT cod_enabled FROM sites WHERE id='${tenant.siteId}';`), 'f');
        } finally { tap.restore(); }
    });
    await t.test('forged tenant context and non-owner read fail without exposing credentials', async () => {
        const before = row(); const forged = await request('PATCH', { cod_enabled: true }, randomUUID(), other.siteId);
        assert.ok([403, 404].includes(forged.status), forged.text); assert.equal(row(), before);
        const denied = await gateway.request(`/v1/stores/${other.siteId}/payment-config`, { headers: await signedIdentityHeaders(actor, email, other.siteId) });
        assert.ok([403, 404].includes(denied.status), denied.text); assert.ok(!denied.text.includes(credentials.key_id));
    });
    await t.test('revoked owner cannot replay a previously successful payment settings receipt', async () => {
        owned.psql(`UPDATE sites SET custom_user_id='${successor}',updated_at=clock_timestamp() WHERE id='${tenant.siteId}';`);
        const denied = await request('PATCH', { online_payment_enabled: true, expected_revision: revision }, activationKey);
        assert.ok([403, 404].includes(denied.status), denied.text);
    });
});
