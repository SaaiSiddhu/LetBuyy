// Complete worker / owned database invitation probes. Synthetic verified accounts
// are fixture inputs, not proof of external verification or inbox delivery.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned=requireOwnedDatabase();let sequence=0;
async function fixture() {
 const tenant=newSyntheticTenant('staff-invite-'+(++sequence));seedSyntheticTenant(owned.psql,tenant);
 const owner=crypto.randomUUID(),staff=crypto.randomUUID();const ownerEmail=`syn-invite-owner-${owner}@example.invalid`,staffEmail=`syn-invite-staff-${staff}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${ownerEmail}',true),('${staff}','${staffEmail}',true);
 UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{ENVIRONMENT:'local',STAFF_INVITATION_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),NEXT_PUBLIC_ADMIN_URL:'http://localhost:9001'}));
 const key=crypto.randomUUID();
 const invite=async(overrides:Record<string,unknown>={},retryKey=key)=>gateway.request('/v1/employees/invite',{method:'POST',headers:{...await signedIdentityHeaders(owner,ownerEmail),'X-Idempotency-Key':retryKey},body:JSON.stringify({store_id:tenant.siteId,email:staffEmail,role:'viewer',...overrides})});
 const accept=async(token:string,retryKey=crypto.randomUUID(),actor=staff,email=staffEmail,bound?:string)=>gateway.request('/v1/employees/auth/accept-invite',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,bound),'X-Idempotency-Key':retryKey},body:JSON.stringify({token})});
 const preview=async(token:string,actor=staff,email=staffEmail,bound?:string)=>gateway.request('/v1/employees/invitations/preview',{method:'POST',headers:await signedIdentityHeaders(actor,email,bound),body:JSON.stringify({token})});
 return {tenant,owner,staff,ownerEmail,staffEmail,gateway,invite,accept,preview};
}
test('clean324 rollback/reapply restores predecessor direct-create body and both queue catalog families',()=>{
 const rollback=readFileSync('database/supabase/rollback/324_canonical_merchant_staff_invitations.rollback.sql','utf8');
 const migration=readFileSync('database/supabase/migrations/324_canonical_merchant_staff_invitations.sql','utf8');
 owned.script(rollback);
 assert.equal(owned.psql("SELECT position('STAFF_ACCOUNT_VERIFICATION_REQUIRED' in pg_get_functiondef('mutate_merchant_staff_v1(uuid,uuid,text,jsonb,text,uuid,timestamptz,text,integer,uuid,text)'::regprocedure))>0;"),'f');
 owned.script(migration);
 for(const role of ['anon','authenticated','app_tenant'])for(const call of [
  "create_merchant_staff_invitation_v1(NULL,NULL,'{}','syn-invite-key',NULL,NULL,NULL,NULL,NULL,NULL,NULL)",
  "preview_merchant_staff_invitation_v1(NULL,NULL,NULL)","accept_merchant_staff_invitation_v1(NULL,NULL,NULL,'syn-accept-key')",
  "merchant_staff_invitation_delivery_v1(NULL)","recover_expired_staff_invitation_jobs_v1(1)"]) {
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.${call};`),/permission denied for function/);
 }
});
test('owner invitation and verified account acceptance complete through canonical staff authority',async()=>{
 const j=await fixture();
 const diagnostic=tapRest(owned.restUrl,async(call,forward)=>{
  const response=await forward();if(call.resource==='rpc/create_merchant_staff_invitation_v1' && !response.ok) {
   const body=await response.clone().json() as {code?:string;message?:string};console.info(JSON.stringify({diagnostic:'owned_invitation_sql',code:body.code,message:body.message}));
  }return response;
 });
 let invited;try {invited=await j.invite();}finally{diagnostic.restore();}
 assert.equal(invited.status,201,invited.json?.error?.code);
 assert.equal(invited.json?.data.status,'invited');assert.equal(invited.json?.data.user_id,null);
 const url=new URL(invited.json?.data.invitation.accept_url),token=url.searchParams.get('token')!;
 assert.equal((await j.preview(token)).status,200);
 const before=await j.gateway.request('/v1/stores',{headers:await signedIdentityHeaders(j.staff,j.staffEmail)});
 assert.deepEqual(before.json?.data,[],'an invitation is not an active grant');
 const accepted=await j.accept(token);assert.equal(accepted.status,200,accepted.json?.error?.code);
 assert.equal(accepted.json?.data.employee.user_id,j.staff);assert.equal(accepted.json?.data.accepted,true);
 const after=await j.gateway.request('/v1/stores',{headers:await signedIdentityHeaders(j.staff,j.staffEmail)});
 assert.equal(after.json?.data[0].id,j.tenant.siteId);
 const me=await j.gateway.request('/v1/employees/me',{headers:await signedIdentityHeaders(j.staff,j.staffEmail)});
 assert.equal(me.status,200);assert.deepEqual(me.json?.data.permissions,{granted:['products:read','orders:read','reports:read']});
});
test('ordinary roles cannot read retained invitation token rows',async()=>{
 const j=await fixture();
 owned.psql(`INSERT INTO employee_invites(email,role,token,invited_by,expires_at) VALUES('${j.staffEmail}','manager','syn-private-${crypto.randomUUID()}','${j.owner}',now()+interval '1 hour');`);
 for(const role of ['anon','authenticated','app_tenant']) {
  const query=`SET ROLE ${role}; SET app.site_id='${j.tenant.siteId}'; SET request.jwt.claims='${JSON.stringify({sub:j.owner,role})}'; SELECT count(*) FROM employee_invites WHERE email='${j.staffEmail}';`;
  const error=owned.psqlExpectError(query);
  if(error)assert.match(error,/permission denied/);else assert.match(owned.psql(query),/0$/);
 }
});

test('an ordinary tenant cannot claim another store global worker jobs by choosing a worker ID',async()=>{
 const j=await fixture(),other=newSyntheticTenant('staff-queue-'+(++sequence));seedSyntheticTenant(owned.psql,other);
 owned.psql(`INSERT INTO platform_queue_jobs(site_id,event_id,queue_name,job_type,payload,idempotency_key)
  VALUES('${other.siteId}',gen_random_uuid(),'analytics-events','synthetic.staff-invitation','{}','syn-queue-${crypto.randomUUID()}');`);
 const sql=`SET ROLE app_tenant; SET LOCAL app.site_id='${j.tenant.siteId}'; SELECT count(*) FROM claim_platform_queue_jobs('analytics-events','syn-unconsenting-worker',10,120);`;
 const error=owned.psqlExpectError(sql);
 assert.match(error,/permission denied/,'global worker claim must be private, rather than trusting a caller-chosen worker label');
});

test('identical invitation retries and acceptance races produce one member, intent, delivery job and lifecycle audit',async()=>{
 const j=await fixture();const invited=await Promise.all(Array.from({length:4},()=>j.invite()));
 invited.forEach(r=>assert.equal(r.status,201,r.json?.error?.code));
 assert.equal(new Set(invited.map(r=>r.json?.data.id)).size,1);
 assert.equal(new Set(invited.map(r=>r.json?.data.invitation.accept_url)).size,1);
 assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE store_id='${j.tenant.siteId}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE site_id='${j.tenant.siteId}' AND job_type='email.employee_invite';`),'1');
 const token=new URL(invited[0].json?.data.invitation.accept_url).searchParams.get('token')!,key=crypto.randomUUID();
 const accepted=await Promise.all(Array.from({length:4},()=>j.accept(token,key)));accepted.forEach(r=>assert.equal(r.status,200,r.json?.error?.code));
 const id=invited[0].json?.data.id;
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${id}' AND action='employee.invited';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${id}' AND action='employee.invite.accepted';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`),'2');
 const conflict=await j.invite({role:'manager'});assert.equal(conflict.status,409);assert.equal(conflict.json?.error.code,'IDEMPOTENCY_CONFLICT');
});

test('wrong subject, unverified account, wrong bound store and forged token never activate a membership',async()=>{
 const j=await fixture(),invited=await j.invite();assert.equal(invited.status,201,invited.json?.error?.code);
 const token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!;
 for(const response of [await j.accept(token,crypto.randomUUID(),j.owner,j.staffEmail),
   await j.accept(token,crypto.randomUUID(),j.staff,j.staffEmail,crypto.randomUUID()),
   await j.accept(token.slice(0,-1)+(token.endsWith('0')?'1':'0'))])assert.equal(response.status,403,response.json?.error?.code);
 owned.psql(`UPDATE users_custom SET email_verified=false WHERE id='${j.staff}';`);
 assert.equal((await j.accept(token)).status,403);assert.equal((await j.preview(token)).status,403);
 assert.equal(owned.psql(`SELECT status||'|'||coalesce(user_id::text,'unlinked') FROM employees WHERE id='${invited.json?.data.id}';`),'invited|unlinked');
});

test('owner transfer and changed member grants invalidate an outstanding invitation before acceptance',async()=>{
 for(const change of ['owner','permissions']) {
  const j=await fixture(),invited=await j.invite();assert.equal(invited.status,201,invited.json?.error?.code);
  const token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!;
  if(change==='owner')owned.psql(`UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id='${j.tenant.siteId}';`);
  else owned.psql(`UPDATE employees SET permissions='{"granted":["products:write"]}'::jsonb WHERE id='${invited.json?.data.id}';`);
  const accepted=await j.accept(token);assert.ok([403,409].includes(accepted.status),accepted.json?.error?.code);
  assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE store_id='${j.tenant.siteId}' AND accepted_at IS NOT NULL;`),'0');
 }
});

test('mandatory invitation audit and job faults roll back every membership/invitation/receipt write, then recover by same key',async()=>{
 for(const table of ['audit_logs','platform_queue_jobs']) {
  const j=await fixture();
  const predicate=table==='audit_logs'?`NEW.action='employee.invited' AND NEW.metadata->>'store_id'='${j.tenant.siteId}'`:`NEW.site_id='${j.tenant.siteId}' AND NEW.job_type='email.employee_invite'`;
  owned.psql(`CREATE FUNCTION syn_invite_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${predicate} THEN RAISE EXCEPTION 'Synthetic invitation atomic fault'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER syn_invite_fault BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION syn_invite_fault();`);
  try {
   const failed=await j.invite();assert.equal(failed.status,503,failed.json?.error?.code);
   assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`),'0');
   assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE store_id='${j.tenant.siteId}';`),'0');
   assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${j.tenant.siteId}';`),'0');
  } finally {owned.psql(`DROP TRIGGER syn_invite_fault ON ${table};DROP FUNCTION syn_invite_fault();`);}
  assert.equal((await j.invite()).status,201);
 }
});

test('acceptance audit failure rolls back the grant and consent; same-key retry recovers without duplicate audit',async()=>{
 const j=await fixture(),invited=await j.invite();assert.equal(invited.status,201,invited.json?.error?.code);
 const token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!,key=crypto.randomUUID(),id=invited.json?.data.id;
 owned.psql(`CREATE FUNCTION syn_accept_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='employee.invite.accepted' AND NEW.resource_id='${id}' THEN RAISE EXCEPTION 'Synthetic accept audit fault'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER syn_accept_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_accept_fault();`);
 try {assert.equal((await j.accept(token,key)).status,503);
  assert.equal(owned.psql(`SELECT status FROM employees WHERE id='${id}';`),'invited');
  assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE store_id='${j.tenant.siteId}' AND accepted_at IS NOT NULL;`),'0');
 } finally {owned.psql('DROP TRIGGER syn_accept_fault ON audit_logs;DROP FUNCTION syn_accept_fault();');}
 assert.equal((await j.accept(token,key)).status,200);
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='employee.invite.accepted' AND resource_id='${id}';`),'1');
});

test('a real short-expiry database fixture denies expired proof and immutable invite intent cannot be retargeted',async()=>{
 const j=await fixture();const tap=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/create_merchant_staff_invitation_v1'
   ?forward({body:JSON.stringify({...call.json as object,p_expires_at:new Date(Date.now()+400).toISOString()})}):forward());
 let invited;try {invited=await j.invite();}finally{tap.restore();}
 assert.equal(invited.status,201,invited.json?.error?.code);
 const id=invited.json?.data.invitation.id,token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!;
 assert.match(owned.psqlExpectError(`UPDATE employee_invites SET email='syn-wrong@example.invalid' WHERE id='${id}';`),/immutable/);
 await new Promise(r=>setTimeout(r,450));assert.equal((await j.accept(token)).status,403);
 assert.equal(owned.psql(`SELECT status FROM employees WHERE id='${invited.json?.data.id}';`),'invited');
});

test('invitation reissue preserves one member, revokes the previous token and binds fresh grants/version',async()=>{
 const j=await fixture(),first=await j.invite();assert.equal(first.status,201,first.json?.error?.code);
 const oldToken=new URL(first.json?.data.invitation.accept_url).searchParams.get('token')!,key=crypto.randomUUID();
 const intent={employee_id:first.json?.data.id,expected_updated_at:first.json?.data.updated_at,role:'editor'};
 const next=await j.invite(intent,key);assert.equal(next.status,201,next.json?.error?.code);assert.equal(next.json?.data.id,first.json?.data.id);
 const replay=await j.invite(intent,key);assert.equal(replay.status,201,replay.json?.error?.code);
 assert.equal(replay.json?.data.invitation.accept_url,next.json?.data.invitation.accept_url);
 assert.equal((await j.accept(oldToken)).status,403);
 const newToken=new URL(next.json?.data.invitation.accept_url).searchParams.get('token')!;
 const accepted=await j.accept(newToken);assert.equal(accepted.status,200,accepted.json?.error?.code);
 assert.deepEqual(accepted.json?.data.employee.permissions,{granted:['products:write','content:write','reports:read']});
 assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}';`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM employee_invites WHERE store_id='${j.tenant.siteId}' AND revoked_at IS NOT NULL;`),'1');
});

test('direct verified creation and an invitation race for the same final seat using the shared site lock',async()=>{
 const j=await fixture(),other=crypto.randomUUID(),email=`syn-direct-${other}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${other}','${email}',true);`);
 const direct=j.gateway.request('/v1/employees',{method:'POST',headers:{...await signedIdentityHeaders(j.owner,j.ownerEmail),'X-Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify({store_id:j.tenant.siteId,email,role:'viewer'})});
 const results=await Promise.all([direct,j.invite()]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 assert.equal(owned.psql(`SELECT count(*) FROM employees WHERE store_id='${j.tenant.siteId}' AND deleted_at IS NULL;`),'1');
});

test('remove versus accept is serialized; stale owner intent conflicts and a current removal blocks every old acceptance retry',async()=>{
 const j=await fixture(),invited=await j.invite();assert.equal(invited.status,201,invited.json?.error?.code);
 const token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!,key=crypto.randomUUID(),id=invited.json?.data.id;
 const remove=async(version:string)=>j.gateway.request('/v1/employees/'+id,{method:'DELETE',headers:{...await signedIdentityHeaders(j.owner,j.ownerEmail),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expected_updated_at:version})});
 const [accepted,removed]=await Promise.all([j.accept(token,key),remove(invited.json?.data.updated_at)]);
 assert.ok([200,403].includes(accepted.status),accepted.json?.error?.code);assert.ok([200,409].includes(removed.status),removed.json?.error?.code);
 if(removed.status===409){const roster=await j.gateway.request('/v1/employees?store_id='+j.tenant.siteId,{headers:await signedIdentityHeaders(j.owner,j.ownerEmail)});
  assert.equal((await remove(roster.json?.data.find((e:any)=>e.id===id).updated_at)).status,200);}
 assert.equal((await j.accept(token,key)).status,403);
 assert.equal(owned.psql(`SELECT status||'|'||is_active FROM employees WHERE id='${id}';`),'removed|false');
});

test('invitation proof is not a login credential and token/intent are absent from durable delivery payloads',async()=>{
 const j=await fixture(),invited=await j.invite();assert.equal(invited.status,201,invited.json?.error?.code);
 const token=new URL(invited.json?.data.invitation.accept_url).searchParams.get('token')!;
 const denied=await j.gateway.request('/v1/stores',{headers:{Authorization:'Bearer '+token}});assert.equal(denied.status,401);
 const payload=owned.psql(`SELECT payload::text FROM platform_queue_jobs WHERE event_id='${invited.json?.data.invitation.id}';`);
 assert.doesNotMatch(payload,/lb-staff-invite|@example|accept-invite/);assert.match(owned.psql(`SELECT token FROM employee_invites WHERE id='${invited.json?.data.invitation.id}';`),/^[a-f0-9]{64}$/);
});

test('retained invitation/effect/job records refuse324 rollback without changing source or actor data',()=>{
 const before=owned.psql('SELECT count(*) FROM employee_invites WHERE store_id IS NOT NULL;');
 assert.throws(()=>owned.script(readFileSync('database/supabase/rollback/324_canonical_merchant_staff_invitations.rollback.sql','utf8')),/retained merchant invitations/);
 assert.equal(owned.psql('SELECT count(*) FROM employee_invites WHERE store_id IS NOT NULL;'),before);
});

test('an accepted invitation previews current permissions after a live owner downgrade',async()=>{
 const j=await fixture(),created=await j.invite({role:'manager'});assert.equal(created.status,201);
 const token=new URL(created.json?.data.invitation.accept_url).searchParams.get('token')!;
 const accepted=await j.accept(token);assert.equal(accepted.status,200);
 const employee=accepted.json?.data.employee;
 const downgraded=await j.gateway.request('/v1/employees/'+employee.id,{method:'PATCH',
  headers:{...await signedIdentityHeaders(j.owner,j.ownerEmail),'X-Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify({role:'viewer',store_id:j.tenant.siteId,expected_updated_at:employee.updated_at})});
 assert.equal(downgraded.status,200,downgraded.json?.error?.code);
 const current=await j.preview(token);assert.equal(current.status,200);assert.equal(current.json?.data.role,'viewer');
 assert.deepEqual(current.json?.data.permissions,{granted:['products:read','orders:read','reports:read']});
});
