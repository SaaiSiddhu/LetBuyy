import {operatorIdentityKeys,TrustedOperatorGateway as Gateway} from '../../services/api-gateway/src/__tests__/owned-db/operator-identity-fixture';
// Owner-selected per-account factor custody with independently approved reset.
// Actual Gateway/PostgREST/database; trusted issuer credentials are explicit
// fixture inputs, not normal browser factor or provider-delivery proof.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createLetbuyyPlatformSessionToken} from '../../services/api-gateway/src/__tests__/owned-db/operator-identity-fixture';
import {tapRest,newBarrier} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {consumeNotificationJobs} from '../../services/queue-workers/src/platform-queue-consumer';
import { consoleFixture, fixtureConsoleFactorFingerprint, nextFixtureConsoleMfaCounter } from '../../services/api-gateway/src/__tests__/owned-db/console-session-fixture';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';

const owned = requireOwnedDatabase();
let diagnostic:ReturnType<typeof tapRest>;
before(()=>{diagnostic=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{
 const response=await forward();if(call.resource.startsWith('rpc/')&&!response.ok){const raw:unknown=await response.clone().json();const e=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};console.info('OWNED_MFA_RESET_RPC '+JSON.stringify({rpc:call.resource,status:response.status,code:e.code,message:e.message}));}return response;
});});after(()=>diagnostic.restore());

async function journey(makerKind:'super'|'lead'|'viewer'='super',targetKind:'super'|'viewer'='viewer'){
 const f=await consoleFixture(owned),maker=await f.actor(makerKind),checker=await f.actor('super'),target=await f.actor(targetKind);
 const reason='Synthetic independently verified operator authenticator recovery',intent={action:'operator.mfa.reset',resource_id:target.id,reason,request_key:crypto.randomUUID(),configured_fingerprint:fixtureConsoleFactorFingerprint(target.id)};
 const create=(body:Record<string,unknown>=intent,headers:Record<string,string>=maker.headers)=>f.gateway.request('/v1/internal/console/approvals',{method:'POST',headers,body:JSON.stringify(body)});
 const decide=(a:any,decision='approve',headers:Record<string,string>=checker.headers)=>f.gateway.request('/v1/internal/console/approvals/'+a.id+'/decision',{method:'POST',headers,body:JSON.stringify({decision,payload_hash:a.payload_hash})});
 const execute=(a:any,body:Record<string,unknown>={approval_id:a.id,reason},headers:Record<string,string>=maker.headers,actorId=target.id,worker=f.gateway)=>worker.request('/v1/internal/console/sessions/mfa-reset/'+actorId,{method:'POST',headers,body:JSON.stringify(body)});
 const live=(actor=target)=>f.gateway.request('/v1/internal/console/sessions/current',{headers:actor.headers});
 const requested=async()=>{const r=await create();assert.equal(r.status,201,r.text);return r.json!.data.approval;};
 const approved=async()=>{const a=await requested();const r=await decide(a);assert.equal(r.status,200,r.text);return a;};
 const audits=()=>owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${target.id}';`);
 return {...f,maker,checker,target,reason,intent,create,decide,execute,live,requested,approved,audits};
}
async function factorAttempt(j:Awaited<ReturnType<typeof journey>>,fingerprint:string,actor=j.target){
 const pre=await createLetbuyyPlatformSessionToken({email:actor.email,userId:actor.id,mfaVerified:false},j.env.PLATFORM_CONSOLE_SESSION_SECRET);assert.ok(pre);
 const preHeaders={...actor.headers,'X-Platform-Console-Session':pre};assert.equal((await j.gateway.request('/v1/internal/console/sessions/register',{method:'POST',headers:preHeaders,body:'{}'})).status,200);
 const elevated=await createLetbuyyPlatformSessionToken({email:actor.email,userId:actor.id,mfaVerified:true},j.env.PLATFORM_CONSOLE_SESSION_SECRET);assert.ok(elevated);
 const headers={...actor.headers,'X-Platform-Console-Session':elevated,'X-Platform-Console-Previous-Session':pre};
 const response=await j.gateway.request('/v1/internal/console/sessions/mfa',{method:'POST',headers,body:JSON.stringify({counter:await nextFixtureConsoleMfaCounter(owned,actor.id),factor_fingerprint:fingerprint})});
 return {response,headers,token:elevated};
}

test('clean329/326 rollback and reapply preserve all rows and retain the original private-role boundary',()=>{
 const count=()=>owned.psql('SELECT (SELECT count(*) FROM principals),(SELECT count(*) FROM sessions_v2),(SELECT count(*) FROM sensitive_action_approvals),(SELECT count(*) FROM audit_logs),(SELECT count(*) FROM platform_queue_jobs);');const before=count();
 for(const rel of ['rollback/329_approved_operator_mfa_reset.rollback.sql','rollback/326_durable_console_mfa_verification.rollback.sql','migrations/326_durable_console_mfa_verification.sql','migrations/329_approved_operator_mfa_reset.sql'])owned.script(readFileSync(new URL('../../database/supabase/'+rel,import.meta.url),'utf8'));
 assert.equal(count(),before);
 const calls=['complete_console_mfa_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','console_mfa_reset_target_v1(NULL)','read_console_mfa_reset_targets_v1(NULL,NULL,NULL,NULL,NULL)','create_console_mfa_reset_approval_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL)','execute_console_mfa_reset_v1(NULL,NULL,NULL,NULL,NULL,NULL)','console_mfa_reset_delivery_v1(NULL,NULL,NULL)','recover_expired_console_security_email_jobs_v1(25)'];
 for(const role of ['anon','authenticated','app_tenant'])for(const call of calls)assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${call};`),/permission denied for function/);
});


test('a separately approved operator MFA reset revokes the target Console sessions once; consent alone has no effect', async () => {
    const f = await consoleFixture(owned);
    const maker = await f.actor('super'), checker = await f.actor('super'), target = await f.actor('viewer');
    const reason = 'Synthetic verified lost authenticator administrator recovery';
    const intent = { configured_fingerprint:fixtureConsoleFactorFingerprint(target.id), action: 'operator.mfa.reset', resource_id: target.id, reason, request_key: crypto.randomUUID() };
    const created = await f.gateway.request('/v1/internal/console/approvals', {
        method: 'POST', headers: maker.headers, body: JSON.stringify(intent),
    });
    assert.equal(created.status, 201, created.text);
    const approval = created.json?.data.approval;
    assert.ok(approval?.id && approval?.payload_hash);
    const live = () => f.gateway.request('/v1/internal/console/sessions/current', { headers: target.headers });
    assert.equal((await live()).status, 200, 'a request must not invalidate a factor or session');
    const consent = await f.gateway.request('/v1/internal/console/approvals/' + approval.id + '/decision', {
        method: 'POST', headers: checker.headers, body: JSON.stringify({ decision: 'approve', payload_hash: approval.payload_hash }),
    });
    assert.equal(consent.status, 200, consent.text);
    assert.equal((await live()).status, 200, 'approval alone must not execute the reset');
    const execute = () => f.gateway.request('/v1/internal/console/sessions/mfa-reset/' + target.id, {
        method: 'POST', headers: maker.headers, body: JSON.stringify({ approval_id: approval.id, reason }),
    });
    const applied = await execute();
    assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.json?.data.actor_id, target.id);
    assert.equal(applied.json?.data.reset_required, true, 'configuration/factor replacement must remain required, not an MFA bypass');
    assert.equal((await live()).status, 401, 'the old target Console session must be revoked');
    const retry = await execute();
    assert.equal(retry.status, 200, retry.text);
    assert.equal(retry.json?.data.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${target.id}';`), '1');
});


test('limited/pre-MFA requesters, typed authority and mismatched configured factor are denied before intent',async()=>{
 const j=await journey(),viewer=await j.actor('viewer'),pre=await j.actor('super',false);
 assert.equal((await j.create(j.intent,viewer.headers)).status,403);
 assert.equal((await j.create(j.intent,pre.headers)).status,428);
 assert.equal((await j.create({...j.intent,secondary_approver_id:j.checker.id})).status,400);
 assert.equal((await j.create({...j.intent,configured_fingerprint:'a'.repeat(64)})).status,409);
 assert.equal((await j.create({...j.intent,resource_id:crypto.randomUUID()})).status,404);
 assert.equal(j.audits(),'0');assert.equal((await j.live()).status,200);
});

test('request replay preserves one immutable platform intent and changed terms conflict',async()=>{
 const j=await journey(),a=await j.requested(),retry=await j.create();assert.equal(retry.status,200,retry.text);assert.equal(retry.json?.data.replayed,true);assert.equal(retry.json?.data.approval.id,a.id);
 assert.equal(a.site_id,null);assert.equal(a.resource_type,'platform_operator');
 assert.equal((await j.create({...j.intent,reason:'Synthetic changed recovery reason'})).status,409);
 assert.match(owned.psqlExpectError(`UPDATE sensitive_action_approvals SET reason='Synthetic forged modified reason' WHERE id='${a.id}';`),/immutable/);
 assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE maker_actor_id='${j.maker.id}' AND action='operator.mfa.reset';`),'1');assert.equal(j.audits(),'0');
});

test('requester, target super-admin, ordinary and pre-MFA consent never substitute for an independent active super admin',async()=>{
 const j=await journey('super','super'),a=await j.requested(),viewer=await j.actor('viewer'),pre=await j.actor('super',false);
 for(const actor of [j.maker,j.target,viewer])assert.equal((await j.decide(a,'approve',actor.headers)).status,403);
 assert.equal((await j.decide(a,'approve',pre.headers)).status,428);
 const wrong=await j.gateway.request('/v1/internal/console/approvals/'+a.id+'/decision',{method:'POST',headers:j.checker.headers,body:JSON.stringify({decision:'approve',payload_hash:'a'.repeat(64)})});assert.equal(wrong.status,409);
 assert.equal(owned.psql(`SELECT status FROM sensitive_action_approvals WHERE id='${a.id}';`),'pending');assert.equal(j.audits(),'0');
});

for(const decision of ['reject','cancel'])test(decision+' leaves the target live and prevents reset execution',async()=>{
 const j=await journey(),a=await j.requested(),r=await j.decide(a,decision,decision==='cancel'?j.maker.headers:j.checker.headers);assert.equal(r.status,200,r.text);
 assert.equal((await j.execute(a)).status,428);assert.equal((await j.live()).status,200);assert.equal(j.audits(),'0');
});

test('exact target, reason, requester session and current independent consent remain mandatory at execution',async()=>{
 const j=await journey(),a=await j.approved(),another=await j.actor('super');
 assert.equal((await j.execute(a,undefined,j.maker.headers,j.checker.id)).status,409);
 assert.equal((await j.execute(a,{approval_id:a.id,reason:'Synthetic wrong reason'})).status,409);
 assert.equal((await j.execute(a,undefined,another.headers)).status,403);
 assert.equal((await j.execute(a,{approval_id:a.id,reason:j.reason,secondary_approver_id:j.checker.id})).status,400);
 const rotated=await j.reauthenticate(j.maker);assert.equal((await j.execute(a,undefined,rotated.headers)).status,403);assert.equal(j.audits(),'0');assert.equal((await j.live()).status,200);
});

test('expiry, checker revoke/re-add and target change invalidate approved evidence before effects',async()=>{
 for(const mode of ['expiry','checker','target']){
  const j=await journey(),a=await j.requested();
  if(mode==='expiry'){
   const aged=await j.seedAgedSession(j.checker,598);const consent=await j.decide(a,'approve',aged.headers);assert.equal(consent.status,200,consent.text);
   await new Promise(resolve=>setTimeout(resolve,2500));
  }else assert.equal((await j.decide(a)).status,200);
  if(mode==='checker')owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.checker.id}';UPDATE super_admin_allowlist SET is_active=true WHERE user_id='${j.checker.id}';`);
  if(mode==='target')owned.psql(`UPDATE users_custom SET full_name='Synthetic changed recovery subject' WHERE id='${j.target.id}';`);
  const r=await j.execute(a);assert.equal(r.status,mode==='target'?409:428,r.text);assert.equal(j.audits(),'0');assert.equal((await j.live()).status,200);
 }
});

test('membership removal between Gateway permission evaluation and SQL effect denies the reset',async()=>{
 const j=await journey(),a=await j.approved();let changed=false;
 const fault=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/execute_console_mfa_reset_v1'&&!changed){changed=true;owned.psql(`UPDATE super_admin_allowlist SET is_active=false WHERE user_id='${j.maker.id}';`);}return forward();});
 try{const r=await j.execute(a);assert.equal(r.status,401,r.text);}finally{fault.restore();}
 assert.ok(changed);assert.equal(j.audits(),'0');assert.equal((await j.live()).status,200);
});

test('separate-worker duplicate executions commit one reset, one email intent and one mandatory audit',async()=>{
 const j=await journey(),a=await j.approved();const r=await Promise.all([j.execute(a),j.execute(a,undefined,j.maker.headers,j.target.id,new Gateway(j.env))]);
 r.forEach(x=>assert.equal(x.status,200,x.text));assert.deepEqual(r.map(x=>x.json?.data.replayed).sort(),[false,true]);assert.equal(j.audits(),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='email.operator_mfa_reset' AND event_id='${a.id}';`),'1');
 assert.equal((await j.live(j.maker)).status,200);assert.equal((await j.live(j.checker)).status,200);assert.equal((await j.live()).status,401);
});

test('competing approved intents for the same factor cannot execute two recovery generations',async()=>{
 const j=await journey(),a=await j.approved();j.intent.request_key=crypto.randomUUID();const b=await j.approved();
 const r=await Promise.all([j.execute(a),j.execute(b,undefined,j.maker.headers,j.target.id,new Gateway(j.env))]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409],r.map(x=>x.text).join(' '));assert.equal(j.audits(),'1');
});

for(const step of ['audit','notification','receipt'])test('mandatory '+step+' fault rolls back reset, revocation and delivery intent; the same approved effect recovers',async()=>{
 const j=await journey(),a=await j.approved(),table=step==='audit'?'audit_logs':step==='notification'?'platform_queue_jobs':'sensitive_action_approvals';
 const condition=step==='audit'?`NEW.action='operator.mfa.reset' AND NEW.resource_id='${j.target.id}'`:step==='notification'?`NEW.job_type='email.operator_mfa_reset' AND NEW.event_id='${a.id}'`:`NEW.id='${a.id}' AND NEW.consumed_at IS NOT NULL AND OLD.consumed_at IS NULL`;
 owned.psql(`CREATE FUNCTION syn_mfa_reset_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic-private-mfa-reset-fault';END IF;RETURN NEW;END $$;CREATE TRIGGER syn_mfa_reset_fault BEFORE ${step==='receipt'?'UPDATE':'INSERT'} ON ${table} FOR EACH ROW EXECUTE FUNCTION syn_mfa_reset_fault();`);
 try{const r=await j.execute(a);assert.equal(r.status,503,r.text);assert.doesNotMatch(r.text,/synthetic-private-mfa-reset-fault/);assert.equal((await j.live()).status,200);assert.equal(j.audits(),'0');assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='email.operator_mfa_reset' AND event_id='${a.id}';`),'0');}
 finally{owned.psql(`DROP TRIGGER syn_mfa_reset_fault ON ${table};DROP FUNCTION syn_mfa_reset_fault();`);}
 const retry=await j.execute(a);assert.equal(retry.status,200,retry.text);assert.equal((await j.live()).status,401);assert.equal(j.audits(),'1');
});

test('a retired configured factor cannot elevate a fresh session; approved replacement preserves counters and cannot silently rotate again',async()=>{
 const j=await journey(),a=await j.approved(),old=fixtureConsoleFactorFingerprint(j.target.id),before=owned.psql(`SELECT metadata->'console_mfa_guard' FROM principals WHERE realm='admin' AND legacy_user_id='${j.target.id}';`);
 assert.equal((await j.execute(a)).status,200);
 const oldAttempt=await factorAttempt(j,old);assert.equal(oldAttempt.response.status,200,oldAttempt.response.text);assert.equal(oldAttempt.response.json?.data.verified,false);assert.equal(oldAttempt.response.json?.data.reason,'reset_required');
 assert.equal(owned.psql(`SELECT metadata->'console_mfa_guard' FROM principals WHERE realm='admin' AND legacy_user_id='${j.target.id}';`),before,'reset must not erase OTP one-use or attempt history');
 const replacement=createHash('sha256').update('synthetic-new-factor:'+j.target.id).digest('hex'),good=await factorAttempt(j,replacement);assert.equal(good.response.json?.data.verified,true,good.response.text);
 assert.equal((await j.gateway.request('/v1/internal/console/sessions/current',{headers:good.headers})).status,200);
 const unapproved=await factorAttempt(j,createHash('sha256').update('synthetic-unapproved-factor:'+j.target.id).digest('hex'));assert.equal(unapproved.response.json?.data.verified,false);assert.equal(unapproved.response.json?.data.reason,'reset_required');
 const retired=await factorAttempt(j,old);assert.equal(retired.response.json?.data.verified,false);assert.equal(retired.response.json?.data.reason,'reset_required');
});

test('never-elevated and never-signed-in operators recover through the same canonical principal without an old-factor bypass',async()=>{
 const j=await journey(),target=crypto.randomUUID(),email=`syn-never-mfa-${target}@example.invalid`,fingerprint=fixtureConsoleFactorFingerprint(target);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${target}','${email}',true);INSERT INTO employees(user_id,email,role,store_id,status,is_active) VALUES('${target}','${email}','viewer',NULL,'active',true);`);
 const created=await j.create({...j.intent,resource_id:target,configured_fingerprint:fingerprint});assert.equal(created.status,201,created.text);const a=created.json!.data.approval;assert.equal((await j.decide(a)).status,200);assert.equal((await j.execute(a,undefined,j.maker.headers,target)).status,200);
 assert.equal(owned.psql(`SELECT count(*) FROM principals WHERE realm='admin' AND legacy_user_id='${target}';`),'1');
 const actor={...j.target,id:target,email},denied=await factorAttempt(j,fingerprint,actor);assert.equal(denied.response.json?.data.verified,false);assert.equal(denied.response.json?.data.reason,'reset_required');
 const good=await factorAttempt(j,createHash('sha256').update('synthetic-first-replacement:'+target).digest('hex'),actor);assert.equal(good.response.json?.data.verified,true,good.response.text);
});

test('unrelated merchant realm sessions survive operator recovery and retained security evidence refuses downgrade',async()=>{
 const j=await journey(),a=await j.approved(),principal=crypto.randomUUID(),session=crypto.randomUUID();
 owned.psql(`INSERT INTO principals(id,realm,actor_type,legacy_user_id,email,status) VALUES('${principal}','merchant','merchant','${j.target.id}','${j.target.email}','active');INSERT INTO sessions_v2(id,principal_id,realm,sid,status,issued_at,absolute_expires_at) VALUES('${session}','${principal}','merchant','syn-other-realm-${session}','active',now(),now()+interval '1 hour');`);
 assert.equal((await j.execute(a)).status,200);assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${session}';`),'active');
 assert.match(owned.psqlExpectError(readFileSync(new URL('../../database/supabase/rollback/329_approved_operator_mfa_reset.rollback.sql',import.meta.url),'utf8')),/refuses retained Console factor or reset evidence/);
 assert.equal((await j.live()).status,401);assert.equal(j.audits(),'1');
});


test('operator discovery is live-permission-scoped and ordinary database claims cannot rewrite security metadata',async()=>{
 const j=await journey(),viewer=await j.actor('viewer'),target=j.target;
 const listed=await j.gateway.request('/v1/internal/console/sessions/mfa-reset/targets?actor_id='+target.id,{headers:j.maker.headers});assert.equal(listed.status,200,listed.text);assert.equal(listed.json?.data.items.length,1);assert.equal(listed.json?.data.items[0].actor_id,target.id);assert.equal(listed.json?.data.items[0].email,target.email);assert.equal(listed.json?.data.items[0].fingerprint,undefined);
 const denied=await j.gateway.request('/v1/internal/console/sessions/mfa-reset/targets?actor_id='+target.id,{headers:viewer.headers});assert.equal(denied.status,403,denied.text);assert.doesNotMatch(denied.text,new RegExp(target.email));
 const before=owned.psql(`SELECT metadata->'console_mfa_factor' FROM principals WHERE realm='admin' AND legacy_user_id='${target.id}';`);
 for(const role of ['anon','authenticated','app_tenant']){
  // A transaction-local self claim is not update authority. Either SQL rejects
  // the write or RLS changes zero rows; neither result may alter the factor.
  try{owned.script(`SET ROLE ${role};SELECT set_config('request.jwt.claim.sub','${target.id}',false);UPDATE principals SET metadata=metadata-'console_mfa_factor' WHERE realm='admin' AND legacy_user_id='${target.id}';`);}catch(error){assert.match(String(error),/permission denied|row-level security/);}
  assert.equal(owned.psql(`SELECT metadata->'console_mfa_factor' FROM principals WHERE realm='admin' AND legacy_user_id='${target.id}';`),before);
 }
 const pre=await j.actor('super',false);const raw=await j.gateway.request('/v1/internal/console/sessions/mfa',{method:'POST',headers:pre.headers,body:JSON.stringify({counter:Math.floor(Date.now()/30000)})});assert.equal(raw.status,400,'a legacy bare matched-counter body cannot bypass configured-factor proof');
 assert.equal(owned.psql("SELECT complete_console_mfa_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)->>'code';"),'CONSOLE_FACTOR_PROOF_REQUIRED');
});


test('reciprocal resets serialize actor authority without a deadlock or two mutually revoked requesters',async()=>{
 const j=await journey('super','super'),a=await j.approved(),fourth=await j.actor('super');
 const created=await j.create({...j.intent,resource_id:j.maker.id,configured_fingerprint:fixtureConsoleFactorFingerprint(j.maker.id),request_key:crypto.randomUUID()},j.target.headers);assert.equal(created.status,201,created.text);const b=created.json!.data.approval;
 assert.equal((await j.decide(b,'approve',fourth.headers)).status,200);
 const barrier=newBarrier(2),tap=tapRest(owned.restEnv().SUPABASE_URL,async(call,forward)=>{if(call.resource==='rpc/execute_console_mfa_reset_v1')await barrier.arrive();return forward();});
 try{
  const replies=await Promise.all([j.execute(a),j.execute(b,undefined,j.target.headers,j.maker.id,new Gateway(j.env))]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,401],replies.map(r=>r.text).join(' '));
 }finally{tap.restore();}
 assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE id IN ('${a.id}','${b.id}') AND consumed_at IS NOT NULL;`),'1');
 assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE event_id IN ('${a.id}','${b.id}') AND job_type='email.operator_mfa_reset';`),'1');
});


test('a requester may recover their own configured factor only with independent consent; execution signs them out and re-authenticated receipt recovery cannot execute again',async()=>{
 const j=await journey(),own=j.maker,created=await j.create({...j.intent,resource_id:own.id,configured_fingerprint:fixtureConsoleFactorFingerprint(own.id)});assert.equal(created.status,201,created.text);const a=created.json!.data.approval;
 assert.equal((await j.decide(a,'approve',own.headers)).status,403);assert.equal((await j.decide(a)).status,200);
 const first=await j.execute(a,undefined,own.headers,own.id);assert.equal(first.status,200,first.text);assert.equal(first.json?.data.reset_required,true);
 assert.equal((await j.live(own)).status,401);assert.equal((await j.execute(a,undefined,own.headers,own.id)).status,401,'a committed reset must not revive its revoked requester for a retry');
 const read=await j.gateway.request('/v1/internal/console/approvals/'+a.id,{headers:j.checker.headers});assert.equal(read.status,200,read.text);assert.ok(read.json?.data.approval.consumed_at);
 const old=await factorAttempt(j,fixtureConsoleFactorFingerprint(own.id),own);assert.equal(old.response.json?.data.verified,false);
 const restored=await factorAttempt(j,createHash('sha256').update('synthetic-self-replacement:'+own.id).digest('hex'),own);assert.equal(restored.response.json?.data.verified,true,restored.response.text);
 const receipt=await j.gateway.request('/v1/internal/console/approvals/'+a.id,{headers:restored.headers});assert.equal(receipt.status,200,receipt.text);assert.ok(receipt.json?.data.approval.consumed_at);
 assert.equal((await j.execute(a,undefined,restored.headers,own.id)).status,403,'a new requester session cannot repurpose an earlier approval');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${own.id}';`),'1');
});
