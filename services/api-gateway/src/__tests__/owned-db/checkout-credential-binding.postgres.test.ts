import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const up = readFileSync('database/supabase/migrations/406_checkout_credential_version_binding.sql', 'utf8');
const down = readFileSync('database/supabase/rollback/406_checkout_credential_version_binding.rollback.sql', 'utf8');
const tenant = newSyntheticTenant('checkout-key'), other = newSyntheticTenant('checkout-foreign');
const credentialId = randomUUID(), replacementId = randomUUID(), foreignId = randomUUID();
const keyId = (id: string) => ['rzp', 'test', id.replaceAll('-', '')].join('_');
const intent = (id = credentialId) => ({ credential_id: id, key_id: keyId(id), provider: 'razorpay', mode: 'sandbox',
    status: 'creating_local_order', payment_intent_id: randomUUID() });
const json = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
function credential(id: string, siteId = tenant.siteId) {
    return `INSERT INTO payment_credentials(id,site_id,provider,mode,status,provider_key_id,last_verified_at,encrypted_credentials)
        VALUES('${id}','${siteId}','razorpay','sandbox','active','${keyId(id)}',now(),'{"synthetic":"test-only"}');`;
}
function session(id: string, snapshot: unknown = {}) {
    const cart = randomUUID();
    return `INSERT INTO carts(id,store_id,session_id,items,status) VALUES('${cart}','${tenant.siteId}','syn-${cart}','[]','active');
        INSERT INTO checkout_sessions(id,site_id,cart_id,idempotency_key,status,checkout_state,payment_intent)
        VALUES('${id}','${tenant.siteId}','${cart}','syn-${id}','payment_intent','payment_intent',${json(snapshot)});`;
}

test('406 expand/down/up conserves legacy checkouts before any binding, including existing grants', () => {
    owned.script(down);
    seedSyntheticTenant(owned.psql, tenant); seedSyntheticTenant(owned.psql, other);
    const id = randomUUID(); owned.psql(session(id));
    const before = owned.psql(`SELECT to_jsonb(c)::text FROM checkout_sessions c WHERE id='${id}';`);
    const grants = owned.psql("SELECT has_table_privilege('app_tenant','checkout_sessions','UPDATE')||':'||has_table_privilege('service_role','checkout_sessions','SELECT');");
    owned.script(up);
    assert.equal(owned.psql(`SELECT (to_jsonb(c)-'payment_credential_id')::text FROM checkout_sessions c WHERE id='${id}';`), before);
    owned.script(down);
    assert.equal(owned.psql(`SELECT to_jsonb(c)::text FROM checkout_sessions c WHERE id='${id}';`), before);
    assert.equal(owned.psql("SELECT has_table_privilege('app_tenant','checkout_sessions','UPDATE')||':'||has_table_privilege('service_role','checkout_sessions','SELECT');"), grants);
    owned.script(up);
    owned.psql(credential(credentialId)); owned.psql(credential(replacementId)); owned.psql(credential(foreignId, other.siteId));
    owned.psql(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${credentialId}';
        UPDATE sites SET online_payment_enabled=true,payment_settings=${json({mode:'ownAccount',razorpay:{credential_id:credentialId}})} WHERE id='${tenant.siteId}';`);
});

test('admission binds the selected exact same-site sandbox version and refuses buyer-style scope/key forgery', () => {
    for (const snapshot of [intent(replacementId), intent(foreignId), {...intent(),key_id:keyId(replacementId)},
        {...intent(),mode:'live'}, {...intent(),provider:'another-provider'}]) {
        assert.match(owned.psqlExpectError(session(randomUUID(), snapshot)), /connection is not selected|credential scope mismatch/);
    }
    const id = randomUUID(), snapshot = intent(); owned.psql(session(id, snapshot));
    assert.equal(owned.psql(`SELECT payment_credential_id FROM checkout_sessions WHERE id='${id}';`), credentialId);
    const completed = {...snapshot,status:'requires_action',order_id:randomUUID(),provider_order_id:'order_synthetic',amount_minor:19900,currency:'INR',receipt:'synthetic-cart'};
    owned.psql(`UPDATE checkout_sessions SET payment_intent=${json(completed)} WHERE id='${id}';`);
    for (const field of ['credential_id','key_id','provider','mode','payment_intent_id','order_id','provider_order_id','amount_minor','currency','receipt']) {
        const changed = {...completed,[field]:field==='amount_minor'?20000:'synthetic-changed'};
        assert.match(owned.psqlExpectError(`UPDATE checkout_sessions SET payment_intent=${json(changed)} WHERE id='${id}';`), /binding is immutable/);
    }
    for (const patch of [`site_id='${other.siteId}'`,`cart_id=NULL`,`payment_credential_id='${replacementId}'`,`payment_intent='{}'`]) {
        assert.match(owned.psqlExpectError(`UPDATE checkout_sessions SET ${patch} WHERE id='${id}';`), /scope is immutable|binding is immutable/);
    }
    owned.psql(`UPDATE sites SET online_payment_enabled=false WHERE id='${tenant.siteId}';
        UPDATE payment_credentials SET selected_for_checkout=false WHERE id='${credentialId}';
        UPDATE checkout_sessions SET status='completed',checkout_state='completed',payment_intent=${json({...completed,status:'captured'})} WHERE id='${id}';`);
    assert.equal(owned.psql(`SELECT status||':'||payment_credential_id::text FROM checkout_sessions WHERE id='${id}';`), `completed:${credentialId}`);
    assert.match(owned.psqlExpectError(session(randomUUID(), intent())), /connection is not selected/);
    const fingerprint = owned.psql("SELECT md5(string_agg(to_jsonb(c)::text,'|' ORDER BY id)) FROM checkout_sessions c;");
    assert.match(owned.psqlScriptExpectError(down), /406 rollback requires/);
    assert.equal(owned.psql("SELECT md5(string_agg(to_jsonb(c)::text,'|' ORDER BY id)) FROM checkout_sessions c;"), fingerprint);
});

test('a committed Settings switch wins against stale admission waiting on the same site lock', async () => {
    owned.psql(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${credentialId}';
        UPDATE sites SET online_payment_enabled=true WHERE id='${tenant.siteId}';`);
    const lock = owned.psqlAsync(`BEGIN;SELECT id FROM sites WHERE id='${tenant.siteId}' FOR UPDATE;
        UPDATE sites SET online_payment_enabled=false WHERE id='${tenant.siteId}';SELECT pg_sleep(1.5);COMMIT;`);
    const deadline = Date.now()+10_000;
    while (owned.psql(`SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE '%${tenant.siteId}%' AND pid<>pg_backend_pid();`) !== '1') {
        assert.ok(Date.now()<deadline,'the competing transaction actually owns the site lock');
        await new Promise(resolve=>setTimeout(resolve,25));
    }
    const id = randomUUID();
    const results = await Promise.allSettled([lock, owned.psqlAsync(session(id,intent()))]);
    assert.equal(results[0].status,'fulfilled'); assert.equal(results[1].status,'rejected');
    assert.match(String(results[1].status==='rejected' && results[1].reason),/connection is not selected/);
    assert.equal(owned.psql(`SELECT count(*) FROM checkout_sessions WHERE id='${id}';`),'0');
});

test('positive tenant visibility remains, while foreign/unset GUC cannot read checkout binding history', () => {
    const read = (siteId: string|null) => `BEGIN;SET LOCAL ROLE app_tenant;${siteId?`SELECT set_config('app.site_id','${siteId}',true);`:''}
        SELECT count(*) FROM checkout_sessions WHERE site_id='${tenant.siteId}' AND payment_credential_id IS NOT NULL;ROLLBACK;`;
    assert.ok(Number(owned.psql(read(tenant.siteId)).split('\n').at(-2))>0);
    assert.equal(owned.psql(read(other.siteId)).split('\n').at(-2),'0');
    assert.equal(owned.psql(read(null)).split('\n').at(-2),'0');
    for (const role of ['anon','authenticated','app_tenant']) assert.equal(owned.psql(`SELECT has_function_privilege('${role}','guard_checkout_payment_credential_v1()','EXECUTE');`),'f');
});
