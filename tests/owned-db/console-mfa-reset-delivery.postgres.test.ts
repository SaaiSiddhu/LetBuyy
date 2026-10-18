// Actual Gateway/canonical worker/owned database. Resend HTTP is an explicit
// synthetic transport fixture; no approved provider or inbox proof is claimed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { consumeNotificationJobs } from '../../services/queue-workers/src/platform-queue-consumer';
import { consoleFixture, fixtureConsoleFactorFingerprint } from '../../services/api-gateway/src/__tests__/owned-db/console-session-fixture';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
async function fixture(){
 const f=await consoleFixture(owned),maker=await f.actor('super'),checker=await f.actor('super'),target=await f.actor('viewer'),reason='Synthetic independently confirmed operator recovery';
 const request=await f.gateway.request('/v1/internal/console/approvals',{method:'POST',headers:maker.headers,body:JSON.stringify({action:'operator.mfa.reset',resource_id:target.id,reason,request_key:crypto.randomUUID(),configured_fingerprint:fixtureConsoleFactorFingerprint(target.id)})});assert.equal(request.status,201,request.text);const approval=request.json!.data.approval;
 const consent=await f.gateway.request('/v1/internal/console/approvals/'+approval.id+'/decision',{method:'POST',headers:checker.headers,body:JSON.stringify({decision:'approve',payload_hash:approval.payload_hash})});assert.equal(consent.status,200,consent.text);
 const reset=await f.gateway.request('/v1/internal/console/sessions/mfa-reset/'+target.id,{method:'POST',headers:maker.headers,body:JSON.stringify({approval_id:approval.id,reason})});assert.equal(reset.status,200,reset.text);const job=reset.json!.data.notification_job_id as string;
 const env={...owned.restEnv(),ENVIRONMENT:'development' as const,RESEND_API_KEY:'synthetic-owned-operator-email-'+crypto.randomUUID(),RESEND_FROM_EMAIL:'Synthetic Operator <operator-sender@example.invalid>'};
 return {...f,maker,checker,target,approval,job,env};
}

test('ambiguous provider response recovers one stable security message through canonical worker retry and immutable sender binding',async()=>{
 const j=await fixture(),original=globalThis.fetch,messages=new Map<string,{id:string;hash:string}>(),calls:{key:string;hash:string;recipient:string;sender:string}[]=[];let replyAvailable=false;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
  if(url.origin!=='https://api.resend.com')return original(input,init);
  assert.equal(url.pathname,'/emails');const request=new Request(input,init),raw=await request.text(),body=JSON.parse(raw),key=request.headers.get('idempotency-key');assert.ok(key);
  assert.deepEqual(Array.isArray(body.to)?body.to:[body.to],[j.target.email]);assert.equal(body.from,j.env.RESEND_FROM_EMAIL);assert.doesNotMatch(raw,/fingerprint|counter|otpauth|cookie_sha256/);
  const hash=createHash('sha256').update(raw).digest('hex'),existing=messages.get(key);if(existing)assert.equal(hash,existing.hash,'ambiguous retry message must remain identical');else messages.set(key,{id:'email_syn_'+crypto.randomUUID(),hash});
  calls.push({key,hash,recipient:body.to,sender:body.from});
  if(!replyAvailable)throw new Error('Synthetic provider response lost after accepting message');
  return new Response(JSON.stringify({id:messages.get(key)!.id}),{headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 try{
  const failed=await consumeNotificationJobs(j.env,'syn-security-email-first');assert.equal(failed[0].failed,1,JSON.stringify(failed));assert.equal(failed[0].succeeded,0);assert.equal(messages.size,1);
  assert.equal(owned.psql(`SELECT status||'|'||attempts||'|'||coalesce(result->>'provider_message_id','unsent') FROM platform_queue_jobs WHERE id='${j.job}';`),'failed|1|unsent');
  owned.psql(`UPDATE platform_queue_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id='${j.job}';`);replyAvailable=true;
  const recovered=await consumeNotificationJobs({...j.env,RESEND_FROM_EMAIL:'Synthetic Different Sender <changed@example.invalid>'},'syn-security-email-retry');assert.equal(recovered[0].succeeded,1,JSON.stringify(recovered));assert.equal(messages.size,1);
  assert.ok(calls.length>=2);assert.equal(new Set(calls.map(c=>c.hash)).size,1);assert.equal(new Set(calls.map(c=>c.key)).size,1);assert.equal(calls[0].key,'operator-mfa-reset-email:'+j.approval.id);
  assert.equal(owned.psql(`SELECT status||'|'||attempts FROM platform_queue_jobs WHERE id='${j.job}';`),'succeeded|2');
  assert.equal(owned.psql(`SELECT result->>'provider_message_id' FROM platform_queue_jobs WHERE id='${j.job}';`),[...messages.values()][0].id);
  const receipt=await j.gateway.request('/v1/internal/console/approvals/'+j.approval.id,{headers:j.maker.headers});assert.equal(receipt.status,200,receipt.text);assert.equal(receipt.json?.data.approval.notification_delivery.status,'succeeded');assert.equal(receipt.json?.data.approval.result.notification_status,'queued','the committed receipt is immutable; current status comes from its job');
  const empty=await consumeNotificationJobs(j.env,'syn-security-email-committed-retry');assert.equal(empty[0].claimed,0);assert.equal(messages.size,1);
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${j.target.id}';`),'1');
 }finally{globalThis.fetch=original;}
});

test('private notification source requires a current exact lease, ignores payload recipients and recovers expired worker ownership',async()=>{
 const j=await fixture(),worker='syn-security-email-lease';
 owned.script(`SET ROLE service_role;SELECT count(*) FROM claim_platform_queue_jobs('notification-jobs','${worker}',25,120);`);
 assert.equal(owned.script('SET ROLE service_role;SELECT recover_expired_console_security_email_jobs_v1(25);'),'0');
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT console_mfa_reset_delivery_v1('${j.job}','syn-wrong-worker','Synthetic <sender@example.invalid>');`),/current operator notification lease/);
 owned.psql(`UPDATE platform_queue_jobs SET payload=payload||'{"email":"syn-wrong-recipient@example.invalid"}'::jsonb WHERE id='${j.job}';`);
 const source=JSON.parse(owned.script(`SET ROLE service_role;SELECT console_mfa_reset_delivery_v1('${j.job}','${worker}','Synthetic <sender@example.invalid>');`));assert.equal(source.email,j.target.email);assert.equal(source.approval_id,j.approval.id);assert.equal(source.fingerprint,undefined);
 owned.psql(`UPDATE platform_queue_jobs SET locked_at=clock_timestamp()-interval '121 seconds' WHERE id='${j.job}';`);
 assert.equal(owned.script('SET ROLE service_role;SELECT recover_expired_console_security_email_jobs_v1(25);'),'1');
 assert.equal(owned.psql(`SELECT status||'|'||(result->>'lease_recovered')||'|'||(available_at>now())::text FROM platform_queue_jobs WHERE id='${j.job}';`),'failed|true|true');
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT complete_platform_queue_job('${j.job}','${worker}','{}');`),/not claimable/);
});

test('missing provider never becomes sent proof and exhausted retries retain a dead-letter without repeating the security reset',async()=>{
 const j=await fixture();const result=await consumeNotificationJobs({...j.env,RESEND_API_KEY:undefined},'syn-security-provider-unavailable');assert.equal(result[0].failed,1);assert.equal(result[0].succeeded,0);
 assert.equal(owned.psql(`SELECT status||'|'||coalesce(result->>'provider_message_id','unsent') FROM platform_queue_jobs WHERE id='${j.job}';`),'failed|unsent');
 owned.psql(`UPDATE platform_queue_jobs SET attempts=max_attempts-1,available_at=clock_timestamp()-interval '1 second' WHERE id='${j.job}';`);
 const exhausted=await consumeNotificationJobs({...j.env,RESEND_API_KEY:undefined},'syn-security-provider-exhausted');assert.equal(exhausted[0].failed,1);
 assert.equal(owned.psql(`SELECT status||'|'||attempts||'|'||coalesce(result->>'provider_message_id','unsent') FROM platform_queue_jobs WHERE id='${j.job}';`),'dead|10|unsent');
 assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${j.target.id}';`),'1');
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT console_mfa_reset_delivery_v1('${j.job}','syn-security-provider-exhausted','Synthetic <sender@example.invalid>');`),/permission denied for function/);
});
