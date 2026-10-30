// Real worker -> owned PostgREST -> migrated disposable PostgreSQL. No provider calls leave the process.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('payment setup is explicit, revisioned, tenant-bound and never manufactures live readiness', async t => {
    owned.script(readFileSync('database/supabase/rollback/416_merchant_razorpay_webhook_secret.rollback.sql','utf8'));
    owned.script(readFileSync('database/supabase/migrations/416_merchant_razorpay_webhook_secret.sql','utf8'));
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
        key_secret: randomUUID().replaceAll('-', ''), webhook_secret: randomUUID().replaceAll('-', ''), test_mode: true };
    const row = () => owned.psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${tenant.siteId}';`);
    await t.test('atomic receipt rejects a public projection containing the webhook secret', () => {
        const publicResponse=JSON.stringify({success:true,data:{store_id:tenant.siteId,webhook_secret:credentials.webhook_secret}}).replaceAll("'","''");
        assert.match(owned.psqlExpectError(`SELECT commit_store_payment_configuration_v1('${tenant.siteId}','${actor}',NULL,NULL,NULL,'save','{}'::jsonb,true,'${publicResponse}'::jsonb);`),/PAYMENT_CONFIG_INVALID/);
    });
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
        assert.equal(response.json?.data.payment_settings.razorpay.webhook_secret_configured, true);
        assert.ok(!response.text.includes(credentials.key_secret)); assert.ok(!response.text.includes(credentials.webhook_secret));
        assert.ok(!response.text.includes('key_secret_ciphertext'));
        const stored = owned.psql(`SELECT c.encrypted_credentials->>'key_secret_ciphertext' FROM payment_credentials c JOIN sites s ON s.id=c.site_id AND s.payment_settings->'razorpay'->>'credential_id'=c.id::text WHERE s.id='${tenant.siteId}';`);
        const webhookStored = owned.psql(`SELECT c.encrypted_credentials->>'webhook_secret_ciphertext' FROM payment_credentials c JOIN sites s ON s.id=c.site_id AND s.payment_settings->'razorpay'->>'credential_id'=c.id::text WHERE s.id='${tenant.siteId}';`);
        assert.equal(owned.psql(`SELECT (payment_settings->'razorpay') ? 'key_secret_ciphertext' FROM sites WHERE id='${tenant.siteId}';`),'f','the site stores only the canonical credential pointer');
        assert.equal(owned.psql(`SELECT (payment_settings->'razorpay') ? 'webhook_secret_ciphertext' FROM sites WHERE id='${tenant.siteId}';`),'f');
        assert.match(stored,/^v3:/);
        assert.ok(stored); assert.ok(!stored.includes(credentials.key_secret));
        assert.match(webhookStored,/^v3:/); assert.ok(!webhookStored.includes(credentials.webhook_secret));
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
    await t.test('a lost committed RPC reply recovers the exact receipt without re-verification or a second credential version', async () => {
        const count = () => owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${tenant.siteId}';`);
        const beforeCount = Number(count()), beforeCalls=verificationCalls, key=randomUUID();
        const command={...credentials,expected_revision:revision};
        let lost=false;
        const tap=tapRest(owned.restEnv().SUPABASE_URL as string,async(call,forward)=>{
            const reply=await forward();
            if(!lost && call.resource==='rpc/commit_store_payment_configuration_v1' && call.method==='POST' && reply.ok){
                lost=true; return Response.json({message:'Synthetic committed response loss'},{status:503});
            }
            return reply;
        });
        try {
            const first=await request('POST',command,key); assert.equal(first.status,503,first.text); assert.equal(lost,true);
            assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND key='${key}';`),'completed','failure handling cannot downgrade a committed receipt');
            const recovered=await request('POST',command,key); assert.equal(recovered.status,200,recovered.text);
            revision=recovered.json?.data.revision;
            assert.equal(Number(count()),beforeCount+1); assert.equal(verificationCalls,beforeCalls+1);
            const read=await request('GET');assert.equal(read.status,200,read.text);assert.equal(read.json?.data.setup.can_enable_online,true);
        } finally {tap.restore();}
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
            if (!interposed && call.resource === 'rpc/commit_store_payment_configuration_v1' && call.method === 'POST') {
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
    await t.test('receipt persistence failure rolls back both the site update and immutable version insert', async () => {
        const key=randomUUID(),before=row();
        const count=owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${tenant.siteId}';`);
        owned.script(`CREATE FUNCTION synthetic_payment_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $f$
          BEGIN IF NEW.key='${key}' AND NEW.status='completed' THEN RAISE EXCEPTION 'Synthetic receipt persistence fault'; END IF; RETURN NEW; END $f$;
          CREATE TRIGGER synthetic_payment_receipt_failure BEFORE UPDATE ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION synthetic_payment_receipt_failure();`);
        try {
            const result=await request('POST',credentials,key);assert.equal(result.status,503,result.text);
            assert.equal(row(),before);assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${tenant.siteId}';`),count);
            assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${tenant.siteId}' AND key='${key}';`),'failed');
        } finally {owned.script('DROP TRIGGER synthetic_payment_receipt_failure ON idempotency_keys;DROP FUNCTION synthetic_payment_receipt_failure();');}
    });
    await t.test('a recorded key cannot be connected to a second store even under the same owner', async () => {
        const second=newSyntheticTenant('pay-same-owner');seedSyntheticTenant(owned.psql,second);
        owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${second.siteId}';`);
        const result=await gateway.request(`/v1/stores/${second.siteId}/payment-config`,{method:'POST',headers:{
            ...await signedIdentityHeaders(actor,email,second.siteId),'X-Idempotency-Key':randomUUID()},body:JSON.stringify(credentials)});
        assert.equal(result.status,409,result.text);assert.equal(result.json?.error.code,'PAYMENT_CONNECTION_OWNERSHIP_CONFLICT');
        assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${second.siteId}';`),'0');
        assert.equal(owned.psql(`SELECT payment_settings->'razorpay'->>'credential_id' FROM sites WHERE id='${second.siteId}';`),'');
    });
    await t.test('forged tenant context and non-owner read fail without exposing credentials', async () => {
        const before = row(); const forged = await request('PATCH', { cod_enabled: true }, randomUUID(), other.siteId);
        assert.ok([403, 404].includes(forged.status), forged.text); assert.equal(row(), before);
        const denied = await gateway.request(`/v1/stores/${other.siteId}/payment-config`, { headers: await signedIdentityHeaders(actor, email, other.siteId) });
        assert.ok([403, 404].includes(denied.status), denied.text); assert.ok(!denied.text.includes(credentials.key_id));
    });
    await t.test('405 rollback waits for active commands and preserves all completed receipts and credential history', async () => {
        const webhookDown=readFileSync('database/supabase/rollback/416_merchant_razorpay_webhook_secret.rollback.sql','utf8');
        assert.match(owned.psqlScriptExpectError(webhookDown),/Cannot roll back merchant webhook secret configuration after use/);
        const key=randomUUID();
        owned.psql(`INSERT INTO idempotency_keys(site_id,key,scope,request_hash,status,locked_until,expires_at)
          VALUES('${tenant.siteId}','${key}','http:POST:/stores/${tenant.siteId}/payment-config','synthetic-rollback-control','processing',now()+interval '1 minute',now()+interval '1 day');`);
        const down=readFileSync('database/supabase/rollback/405_atomic_store_payment_configuration.rollback.sql','utf8');
        assert.match(owned.psqlScriptExpectError(down),/405 rollback requires/);
        owned.psql(`UPDATE idempotency_keys SET status='failed',locked_until=NULL WHERE site_id='${tenant.siteId}' AND key='${key}';`);
        const snapshot=()=>owned.psql(`SELECT md5(jsonb_build_object(
          'credentials',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM payment_credentials c WHERE site_id='${tenant.siteId}'),
          'receipts',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM idempotency_keys i WHERE site_id='${tenant.siteId}'),
          'site',(SELECT to_jsonb(s) FROM sites s WHERE id='${tenant.siteId}'))::text);`);
        const before=snapshot();owned.script(down);
        assert.equal(snapshot(),before);
        owned.script(readFileSync('database/supabase/migrations/405_atomic_store_payment_configuration.sql','utf8'));
        assert.equal(snapshot(),before);
        for(const role of ['anon','authenticated','app_tenant']) {
          assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT commit_store_payment_configuration_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`),/permission denied/);
        }
    });
    await t.test('revoked owner cannot replay a previously successful payment settings receipt', async () => {
        owned.psql(`UPDATE sites SET custom_user_id='${successor}',updated_at=clock_timestamp() WHERE id='${tenant.siteId}';`);
        const denied = await request('PATCH', { online_payment_enabled: true, expected_revision: revision }, activationKey);
        assert.ok([403, 404].includes(denied.status), denied.text);
    });
});
