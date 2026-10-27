// Real Gateway + canonical queue consumer and actual owned DB. No provider API
// is contacted: missing access must remain a retryable failure, never sent proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {consumeStaffInvitationJobs} from '../../services/queue-workers/src/platform-queue-consumer';
import queueWorker from '../../services/queue-workers/src/index';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase();let sequence=0;
async function fixture() {
 const tenant=newSyntheticTenant('invite-delivery-'+(++sequence));seedSyntheticTenant(owned.psql,tenant);
 const owner=crypto.randomUUID(),email=`syn-delivery-owner-${owner}@example.invalid`,target=`syn-delivery-${crypto.randomUUID()}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 const messages:unknown[]=[];let wakeupFails=false;
 const secret=crypto.randomUUID()+crypto.randomUUID();
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{ENVIRONMENT:'local',STAFF_INVITATION_SIGNING_SECRET:secret,NEXT_PUBLIC_ADMIN_URL:'http://localhost:9001',
  NOTIFICATION_QUEUE:{async send(value:unknown){if(wakeupFails)throw new Error('Synthetic queue wakeup outage');messages.push(value);}} as never}));
 const create=async()=>gateway.request('/v1/employees/invite',{method:'POST',headers:{...await signedIdentityHeaders(owner,email),'X-Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify({store_id:tenant.siteId,email:target,role:'viewer'})});
 const env={...owned.restEnv(),ENVIRONMENT:'development' as const,INTERNAL_API_SECRET:INTERNAL_SECRET,STAFF_INVITATION_SIGNING_SECRET:secret};
 return {tenant,owner,email,target,gateway,messages,env,create,failWakeup:()=>{wakeupFails=true;}};
}
test('a lost native wakeup leaves a durable job and scheduled catch-up records missing provider as retryable failure',async()=>{
 const j=await fixture();j.failWakeup();const created=await j.create();assert.equal(created.status,201,created.json?.error?.code);
 assert.equal(created.json?.data.invitation.wakeup,'retry_pending');assert.equal(j.messages.length,0);
 const id=created.json?.data.invitation.id;
 assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE event_id='${id}';`),'queued');
 const results=await consumeStaffInvitationJobs(j.env,'syn-scheduled-invite-catchup');
 assert.equal(results[0].failed,1);assert.equal(results[0].succeeded,0);
 assert.equal(owned.psql(`SELECT status||'|'||attempts||'|'||coalesce(result->>'provider_message_id','unsent') FROM platform_queue_jobs WHERE event_id='${id}';`),'failed|1|unsent');
 assert.equal(owned.psql(`SELECT status FROM employees WHERE id='${created.json?.data.id}';`),'invited');
});
test('actual queue entry acknowledges only the wakeup while the unsent invitation remains a failed durable job',async()=>{
 const j=await fixture(),created=await j.create();assert.equal(created.status,201,created.json?.error?.code);assert.equal(j.messages.length,1);
 let acked=0,retried=0;
 const message={id:'syn-wake-'+crypto.randomUUID(),timestamp:new Date(),body:j.messages[0],attempts:1,ack:()=>{acked++;},retry:()=>{retried++;}};
 await queueWorker.queue!({queue:'letbuyy-notifications-queue-synthetic',messages:[message],ackAll(){},retryAll(){}} as never,j.env as never);
 assert.equal(acked,1);assert.equal(retried,0);
 assert.equal(owned.psql(`SELECT status||'|'||coalesce(result->>'provider_message_id','unsent') FROM platform_queue_jobs WHERE event_id='${created.json?.data.invitation.id}';`),'failed|unsent');
});
test('expired invitation leases recover through canonical failure/backoff; active leases are not stolen',async()=>{
 const j=await fixture(),created=await j.create();assert.equal(created.status,201,created.json?.error?.code);
 const id=created.json?.data.invitation.id;
 owned.script(`SET ROLE service_role;SELECT count(*) FROM claim_platform_queue_jobs('notification-jobs','syn-crashed-worker',25,120);`);
 assert.equal(owned.script('SET ROLE service_role;SELECT recover_expired_staff_invitation_jobs_v1(25);'),'0');
 owned.psql(`UPDATE platform_queue_jobs SET locked_at=now()-interval '121 seconds' WHERE event_id='${id}';`);
 assert.equal(owned.script('SET ROLE service_role;SELECT recover_expired_staff_invitation_jobs_v1(25);'),'1');
 assert.equal(owned.psql(`SELECT status||'|'||(result->>'lease_recovered')||'|'||(available_at>now())::text FROM platform_queue_jobs WHERE event_id='${id}';`),'failed|true|true');
 assert.match(owned.psqlExpectError(`SET ROLE service_role;SELECT complete_platform_queue_job((SELECT id FROM platform_queue_jobs WHERE event_id='${id}'),'syn-crashed-worker','{}');`),/not claimable/);
});

test('the dedicated minute cron recovers a missing wakeup without running unrelated sweepers',async()=>{
 const j=await fixture(),created=await j.create();assert.equal(created.status,201);
 const frozen=crypto.randomUUID();
 owned.psql(`INSERT INTO platform_queue_jobs(id,site_id,event_id,queue_name,job_type,payload,idempotency_key)
 VALUES('${frozen}','${j.tenant.siteId}','${crypto.randomUUID()}','payment-events','app.charge.activated','{}','syn-invite-frozen-${frozen}');`);
 const tasks:Promise<unknown>[]=[];
 await queueWorker.scheduled!({cron:'* * * * *',scheduledTime:Date.UTC(2026,9,27,12,1),noRetry(){}} as never,j.env as never,
  {waitUntil(task:Promise<unknown>){tasks.push(task);},passThroughOnException(){}} as never);
 assert.equal(tasks.length,2,'the minute tick dispatches notification recovery and canonical loyalty refunds only');
 await Promise.all(tasks);
 assert.equal(owned.psql(`SELECT status||'|'||attempts::text FROM platform_queue_jobs WHERE event_id='${created.json?.data.invitation.id}';`),'failed|1');
 assert.equal(owned.psql(`SELECT status||'|'||attempts::text FROM platform_queue_jobs WHERE id='${frozen}';`),'queued|0','the invitation tick must not execute frozen app/payment jobs');
});
