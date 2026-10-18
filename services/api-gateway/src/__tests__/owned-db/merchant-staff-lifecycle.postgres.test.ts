// Actual worker/identity assertion -> owned PostgREST/database. These initial
// transport/ownership probes are not a normal browser login or provider-delivery
// verdict; the complete own-login/invitation/device journeys remain required.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(); let sequence = 0;
async function fixture() {
    const tenant = newSyntheticTenant('staff-life-' + (++sequence)); seedSyntheticTenant(owned.psql, tenant);
    const owner = crypto.randomUUID(), staff = crypto.randomUUID();
    const ownerEmail = `syn-staff-owner-${owner}@example.invalid`, staffEmail = `syn-staff-member-${staff}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${ownerEmail}',true),('${staff}','${staffEmail}',true);
        UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const createKey = crypto.randomUUID();
    const create = async (overrides: Record<string, unknown> = {}, key = createKey) => gateway.request('/v1/employees', { method: 'POST', headers: { ...await signedIdentityHeaders(owner, ownerEmail), 'X-Idempotency-Key': key },
        body: JSON.stringify({ store_id: tenant.siteId, email: staffEmail, role: 'viewer', permissions: { granted: ['products:read'] }, ...overrides }) });
    const staffRequest = async (path: string) => gateway.request(path, { headers: await signedIdentityHeaders(staff, staffEmail) });
    return { tenant, owner, staff, ownerEmail, staffEmail, gateway, create, createKey, staffRequest };
}
test('new private staff/navigation functions support clean rollback and reapply with exact ordinary-role denial', () => {
    for(const file of ['rollback/324_canonical_merchant_staff_invitations.rollback.sql','rollback/322_atomic_merchant_staff_lifecycle.rollback.sql','rollback/321_merchant_accessible_store_discovery.rollback.sql',
      'migrations/321_merchant_accessible_store_discovery.sql','migrations/322_atomic_merchant_staff_lifecycle.sql','migrations/324_canonical_merchant_staff_invitations.sql']) {
      owned.script(readFileSync(new URL('../../../../../database/supabase/'+file,import.meta.url),'utf8'));
    }
    for(const role of ['anon','authenticated','app_tenant']) {
      for(const expression of ["list_merchant_accessible_sites_v1(NULL,1,10,NULL)","merchant_staff_policy_snapshot_v1(NULL,NULL,NULL)",
        "mutate_merchant_staff_v1(NULL,NULL,'create','{}'::jsonb,'synthetic-key')"]) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; SELECT public.${expression};`),/permission denied for function/);
      }
    }
});
test('a real owner provisions a verified limited staff identity and that identity reads its own employee record', async () => {
    const j = await fixture(), created = await j.create(); assert.equal(created.status, 201, created.text);
    assert.equal(created.json?.data.user_id, j.staff); assert.equal(created.json?.data.status, 'active');
    const me = await j.staffRequest('/v1/employees/me'); assert.equal(me.status, 200, me.text);
    assert.equal(me.json?.data.id, created.json?.data.id);
});
test('direct provisioning rejects unverified or unknown accounts without an unclaimable pending record', async () => {
    for(const unverified of [true,false]) {
      const j=await fixture();if(unverified)owned.psql(`UPDATE users_custom SET email_verified=false WHERE id='${j.staff}';`);
      const c=await j.create(unverified?{}:{email:`syn-unknown-${crypto.randomUUID()}@example.invalid`});
      assert.equal(c.status,409,c.json?.error?.code);assert.equal(c.json?.error.code,'STAFF_ACCOUNT_VERIFICATION_REQUIRED');
      assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`),'0');
    }
});
test('an unknown canonical subject cannot inherit a store owner by asserting the owner email', async () => {
    const j = await fixture(); assert.equal((await j.create()).status, 201);
    const unknown = crypto.randomUUID();
    const response = await j.gateway.request('/v1/employees?store_id=' + j.tenant.siteId,
        { headers: await signedIdentityHeaders(unknown, j.ownerEmail) });
    assert.equal(response.status, 403, response.text);
});
test('an active-text but disabled staff membership cannot enter its store shell', async () => {
    const j = await fixture(); assert.equal((await j.create()).status, 201);
    const before = await j.staffRequest('/v1/stores/handle/' + j.tenant.subdomain); assert.equal(before.status, 200, before.text);
    owned.psql(`UPDATE employees SET is_active=false WHERE store_id='${j.tenant.siteId}' AND user_id='${j.staff}';`);
    const after = await j.staffRequest('/v1/stores/handle/' + j.tenant.subdomain);
    assert.ok([403,404].includes(after.status), after.text);
});
test('the independently provisioned staff identity can discover its accessible store for normal navigation', async () => {
    const j = await fixture(); assert.equal((await j.create()).status, 201);
    const response = await j.staffRequest('/v1/stores?limit=50'); assert.equal(response.status, 200, response.text);
    assert.ok(response.json?.data.some((row: { id: string }) => row.id === j.tenant.siteId), 'the normal store picker must include the active staff membership');
});
test('failure of a mandatory staff lifecycle audit rolls back membership and receipt; the same key can retry', async () => {
    const j = await fixture();
    owned.psql(`CREATE FUNCTION syn_staff_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='employee.created' AND NEW.metadata->>'store_id'='${j.tenant.siteId}' THEN RAISE EXCEPTION 'Synthetic mandatory staff audit fault'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER syn_staff_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_staff_audit_fault();`);
    try {
        const response = await j.create(); assert.equal(response.status, 503, response.text);
        assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`), '0');
        assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`), '0');
    } finally { owned.psql('DROP TRIGGER syn_staff_audit_fault ON audit_logs; DROP FUNCTION syn_staff_audit_fault();'); }
    const retried = await j.create(); assert.equal(retried.status, 201, retried.text);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${retried.json?.data.id}' AND action='employee.created';`), '1');
});

test('concurrent identical creation and lost committed reply retry yield one member, audit and receipt', async () => {
    const j = await fixture();
    const replies = await Promise.all(Array.from({ length: 4 }, () => j.create()));
    replies.forEach(r => assert.equal(r.status, 201, r.text));
    assert.equal(new Set(replies.map(r => r.json?.data.id)).size, 1);
    const again = await j.create(); assert.equal(again.status, 201, again.text);
    assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${again.json?.data.id}' AND action='employee.created';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`), '1');
    const different = await j.create({ role: 'manager' }); assert.equal(different.status, 409, different.text);
    assert.equal(different.json?.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('different requests racing for the last free-plan staff seat cannot overbook it', async () => {
    const j = await fixture();
    // This suite uses the actual free tier's one-seat policy, no mock cap.
    const extraId=crypto.randomUUID(), extraEmail=`syn-extra-${extraId}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${extraId}','${extraEmail}',true);`);
    const replies = await Promise.all([j.create(), j.create({ email: extraEmail }, crypto.randomUUID())]);
    assert.deepEqual(replies.map(r => r.status).sort(), [201,409], replies.map(r => r.text).join('\n'));
    assert.equal(replies.find(r => r.status === 409)?.json?.error.code, 'STAFF_LIMIT_REACHED');
    assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}' AND deleted_at IS NULL;`), '1');
});

test('role-only downgrade replaces old grants; stale writes cannot overwrite it and removal replay succeeds', async () => {
    const j = await fixture(), c = await j.create({ role: 'manager', permissions: { granted: ['products:write','settings:write'] } });
    assert.equal(c.status, 201, c.text);
    const id = c.json?.data.id, version = c.json?.data.updated_at;
    const ownerRequest = async (method: string, body: Record<string,unknown>, key = crypto.randomUUID()) => j.gateway.request('/v1/employees/' + id,
      { method, headers: { ...await signedIdentityHeaders(j.owner,j.ownerEmail), 'X-Idempotency-Key': key }, body: JSON.stringify(body) });
    const downgraded = await ownerRequest('PATCH',{ role: 'viewer', expected_updated_at: version });
    assert.equal(downgraded.status,200,downgraded.text);
    assert.deepEqual(downgraded.json?.data.permissions.granted, ['products:read','orders:read','reports:read']);
    const stale = await ownerRequest('PATCH',{ role:'manager',expected_updated_at:version });
    assert.equal(stale.status,409,stale.text); assert.equal(stale.json?.error.code,'STAFF_VERSION_CONFLICT');
    const removeKey = crypto.randomUUID(), removeBody = { expected_updated_at:downgraded.json?.data.updated_at };
    assert.equal((await ownerRequest('DELETE',removeBody,removeKey)).status,200);
    assert.equal((await ownerRequest('DELETE',removeBody,removeKey)).status,200);
    const me = await j.staffRequest('/v1/employees/me'); assert.equal(me.status,404,me.text);
    const stores = await j.staffRequest('/v1/stores'); assert.equal(stores.status,200,stores.text); assert.deepEqual(stores.json?.data,[]);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${id}' AND action='employee.removed';`),'1');
});

test('a staff member cannot grant privileges; a former owner cannot replay a committed receipt', async () => {
    const j = await fixture(), c = await j.create(); assert.equal(c.status,201,c.text);
    const denial = await j.gateway.request('/v1/employees/' + c.json?.data.id,{ method:'PATCH',
      headers:{ ...await signedIdentityHeaders(j.staff,j.staffEmail),'X-Idempotency-Key':crypto.randomUUID() },
      body:JSON.stringify({ role:'manager',expected_updated_at:c.json?.data.updated_at }) });
    assert.equal(denial.status,403,denial.text);
    owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${j.tenant.siteId}';`);
    const replay = await j.create(); assert.equal(replay.status,403,replay.text);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${c.json?.data.id}' AND action='employee.created';`),'1');
});

test('store discovery exposes only staff shell data and honors bound-store credentials, UUID navigation and invalid pagination', async () => {
    const j = await fixture(); assert.equal((await j.create()).status,201);
    owned.psql(`UPDATE sites SET payment_settings='{"synthetic_private_secret":"must-not-leak"}'::jsonb WHERE id='${j.tenant.siteId}';`);
    const list = await j.staffRequest('/v1/stores?limit=1'); assert.equal(list.status,200,list.text);
    assert.equal(list.json?.meta.total,1); assert.doesNotMatch(list.text,/synthetic_private_secret|payment_settings/);
    const byId = await j.staffRequest('/v1/stores/' + j.tenant.siteId); assert.equal(byId.status,200,byId.text);
    assert.doesNotMatch(byId.text,/synthetic_private_secret|payment_settings/);
    const other = newSyntheticTenant('staff-bound-' + (++sequence)); seedSyntheticTenant(owned.psql,other);
    for(const path of ['/v1/stores','/v1/stores/handle/'+j.tenant.subdomain,'/v1/stores/'+j.tenant.siteId]) {
      const res = await j.gateway.request(path,{headers:await signedIdentityHeaders(j.staff,j.staffEmail,other.siteId)});
      if(path==='/v1/stores') { assert.equal(res.status,200,res.text); assert.deepEqual(res.json?.data,[]); }
      else assert.equal(res.status,404,res.text);
    }
    for(const query of ['page=0','page=NaN','limit=100','limit=-1']) assert.equal((await j.staffRequest('/v1/stores?'+query)).status,400);
});

test('ordinary database roles cannot invoke private staff or navigation RPCs', () => {
    for(const role of ['anon','authenticated','app_tenant']) {
      for(const fn of ['public.list_merchant_accessible_sites_v1(uuid,integer,integer,uuid)',
        'public.merchant_staff_policy_snapshot_v1(uuid,uuid,uuid)',
        'public.mutate_merchant_staff_v1(uuid,uuid,text,jsonb,text,uuid,timestamptz,text,integer,uuid,text)']) {
        assert.equal(owned.psql(`SELECT has_function_privilege('${role}','${fn}','EXECUTE');`),'f',role+' '+fn);
      }
    }
});

test('rollback refuses retained staff receipts and leaves the live private transaction intact', () => {
    assert.throws(()=>owned.script(readFileSync(new URL('../../../../../database/supabase/rollback/322_atomic_merchant_staff_lifecycle.rollback.sql',import.meta.url),'utf8')),/retained staff lifecycle receipts/);
    assert.equal(owned.psql("SELECT to_regprocedure('public.mutate_merchant_staff_v1(uuid,uuid,text,jsonb,text,uuid,timestamptz,text,integer,uuid,text)') IS NOT NULL;"),'t');
});

test('mandatory update and removal audit failures roll back the effect and receipt before same-key recovery', async () => {
    for(const operation of ['update','remove']) {
      const j=await fixture(),created=await j.create();assert.equal(created.status,201,created.text);
      const id=created.json?.data.id,version=created.json?.data.updated_at,key=crypto.randomUUID();
      const body={expected_updated_at:version,...(operation==='update'?{role:'editor'}:{})};
      const send=async()=>j.gateway.request('/v1/employees/'+id,{method:operation==='update'?'PATCH':'DELETE',
        headers:{...await signedIdentityHeaders(j.owner,j.ownerEmail),'X-Idempotency-Key':key},body:JSON.stringify(body)});
      owned.psql(`CREATE FUNCTION syn_staff_change_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.resource_id='${id}' AND NEW.action='employee.${operation==='update'?'updated':'removed'}' THEN RAISE EXCEPTION 'Synthetic mandatory audit fault'; END IF;
        RETURN NEW; END $$; CREATE TRIGGER syn_staff_change_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_staff_change_fault();`);
      try {
        const failed=await send();assert.equal(failed.status,503,failed.text);
        assert.equal(owned.psql(`SELECT role||'|'||status||'|'||is_active FROM employees WHERE id='${id}';`),'viewer|active|true');
        assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`),'1');
      } finally {owned.psql('DROP TRIGGER syn_staff_change_fault ON audit_logs; DROP FUNCTION syn_staff_change_fault();');}
      const retry=await send();assert.equal(retry.status,200,retry.text);
      assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`),'2');
    }
});

test('receipt storage failure rolls back the member and lifecycle audit, not merely the response', async () => {
    const j=await fixture();
    owned.psql(`CREATE FUNCTION syn_staff_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.site_id='${j.tenant.siteId}' AND NEW.scope LIKE 'merchant-staff-v1:%' THEN RAISE EXCEPTION 'Synthetic receipt fault'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER syn_staff_receipt_fault BEFORE INSERT ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION syn_staff_receipt_fault();`);
    try {
      const failed=await j.create();assert.equal(failed.status,503,failed.text);
      assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`),'0');
      assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='employee.created' AND metadata->>'store_id'='${j.tenant.siteId}';`),'0');
    } finally {owned.psql('DROP TRIGGER syn_staff_receipt_fault ON idempotency_keys; DROP FUNCTION syn_staff_receipt_fault();');}
    assert.equal((await j.create()).status,201);
});

test('bound credentials cannot read an out-of-scope employee profile and malformed mutation JSON is refused', async () => {
    const j=await fixture();assert.equal((await j.create()).status,201);
    const res=await j.gateway.request('/v1/employees/me',{headers:await signedIdentityHeaders(j.staff,j.staffEmail,crypto.randomUUID())});
    assert.equal(res.status,404,res.text);
    for(const body of ['null','[]','{']) {
      const invalid=await j.gateway.request('/v1/employees',{method:'POST',
        headers:{...await signedIdentityHeaders(j.owner,j.ownerEmail),'X-Idempotency-Key':crypto.randomUUID()},body});
      assert.equal(invalid.status,400,invalid.text);
    }
});

test('account and store discovery outages return explicit 503 rather than empty success or another account', async () => {
    const j=await fixture();
    for(const resource of ['users_custom','rpc/list_merchant_accessible_sites_v1']) {
      const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource===resource
        ? new Response(JSON.stringify({code:'SYNTHETIC_UNAVAILABLE',message:'Synthetic unavailable'}),{status:503,headers:{'content-type':'application/json'}}):forward());
      try {const res=await j.staffRequest('/v1/stores');assert.equal(res.status,503,res.text);}
      finally {tap.restore();}
    }
});

test('the private transaction itself refuses absent/null grant arrays without creating membership or receipt', async () => {
    const j=await fixture();
    for(const permissions of [{},{granted:null}]) {
      const intent=JSON.stringify({email:j.staffEmail,full_name:'Synthetic Staff',role:'viewer',permissions});
      const reply=owned.psql(`SET ROLE service_role; SELECT public.mutate_merchant_staff_v1('${j.owner}','${j.tenant.siteId}','create','${intent}'::jsonb,'${crypto.randomUUID()}')->>'status';`);
      assert.match(reply,/400$/);
    }
    assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`),'0');
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`),'0');
});
