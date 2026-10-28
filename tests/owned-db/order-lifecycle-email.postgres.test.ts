import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { renderOrderLifecycleEmail } from '@letbuyy/notification-core';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { OutboxExecutionAdapter } from '../../services/api-gateway/src/execution/outbox-execution.adapter';
import { sendOrderLifecycleEmail } from '../../services/queue-workers/src/order-lifecycle-email';
import { consumeNotificationJobs } from '../../services/queue-workers/src/platform-queue-consumer';

const owned = requireOwnedDatabase();
const db = createSupabaseServiceClient(owned.restEnv());
const env = { RESEND_API_KEY: 're_synthetic_test_only_email_provider', RESEND_FROM_EMAIL: 'noreply@letbuyy.com' };
let sequence = 0;
function fixture() {
  const tenant = newSyntheticTenant('order-mail-'+(++sequence)); seedSyntheticTenant(owned.psql, tenant);
  const { orderId } = seedSyntheticOrder(owned.psql, tenant);
  return { tenant, orderId };
}
function logs(orderId: string) {
  return JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY created_at,id),'[]') FROM email_logs l WHERE metadata->>'order_id'='${orderId}' AND template_key='order_lifecycle_v1';`));
}
async function claimed(orderId: string) {
  const siteId=owned.psql(`SELECT store_id FROM orders WHERE id='${orderId}';`);
  await new OutboxExecutionAdapter(db).dispatchOrderEmails(siteId,orderId);
  const id = owned.psql(`SELECT j.id FROM platform_queue_jobs j JOIN outbox_events e ON e.id=j.outbox_event_id WHERE e.aggregate_id='${orderId}' AND j.job_type='order.lifecycle_email_queued' ORDER BY j.created_at DESC LIMIT 1;`);
  const worker = 'synthetic-order-mail-'+randomUUID();
  const { data, error } = await db.rpc('claim_platform_queue_jobs', { p_queue_name:'notification-jobs',p_worker_id:worker,p_limit:100,p_lock_seconds:120 });
  assert.ifError(error); const job = data.find((j: {id:string}) => j.id===id); assert.ok(job, 'the actual outbox fanout and queue claim must reach this intent');
  return { job, worker };
}
async function provider<T>(reply: (request: Request) => Promise<Response>, work: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const request = input instanceof Request ? input : new Request(input, init);
    return new URL(request.url).hostname==='api.resend.com' ? reply(request) : original(input,init); };
  try { return await work(); } finally { globalThis.fetch=original; }
}

test('canonical checkout commits one private intent with its relational items; rollback and unrelated edits emit none', () => {
  const f=fixture(),saved=logs(f.orderId); assert.equal(saved.length,1); assert.equal(saved[0].metadata.snapshot.kind,'placed');
  assert.equal(saved[0].metadata.snapshot.order.line_items.length,1); assert.equal(saved[0].metadata.snapshot.order.total,199);
  assert.equal(saved[0].recipient_hash,createHash('sha256').update('email:'+saved[0].recipient_email.trim().toLowerCase()).digest('hex'),'use the existing email router suppression fingerprint');
  const event=JSON.parse(owned.psql(`SELECT payload FROM outbox_events WHERE aggregate_id='${f.orderId}' AND event_type='order.lifecycle_email_queued';`));
  assert.deepEqual(Object.keys(event).sort(),['email_log_id','order_id','site_id']);
  owned.script(`BEGIN;UPDATE orders SET status='processing' WHERE id='${f.orderId}';ROLLBACK;UPDATE orders SET notes='Synthetic note only' WHERE id='${f.orderId}';`);
  assert.equal(logs(f.orderId).length,1);
  owned.script(`BEGIN;UPDATE orders SET status='confirmed' WHERE id='${f.orderId}';UPDATE orders SET status='processing' WHERE id='${f.orderId}';COMMIT;`);
  const processed=logs(f.orderId); assert.equal(processed.length,2); assert.equal(processed.at(-1).metadata.snapshot.kind,'processing');
  assert.equal(processed.at(-1).metadata.snapshot.order.payment_status,'pending');
});

test('immutable saved coupon receipt renders escaped branded light/dark email without inventing refund/payment facts', () => {
  const f=fixture(); owned.script(`UPDATE orders SET status='shipped',subtotal=2,discount=1,coupon_code='OFF50',coupon_discount=1,total=1,tracking_number='SYN-TRACK' WHERE id='${f.orderId}';`);
  const snapshot=logs(f.orderId).at(-1).metadata.snapshot, rendered=renderOrderLifecycleEmail(snapshot);
  assert.match(rendered.text,/Coupon \(OFF50\): −INR 1.00/); assert.match(rendered.text,/Final total: INR 1.00/);
  assert.match(rendered.text,/Payment status: pending/); assert.match(rendered.html,/#6A436B/); assert.match(rendered.html,/prefers-color-scheme/);
  snapshot.store_name='<img src=x onerror=bad()> '; snapshot.order.customer_name='<script>bad()</script>';
  const escaped=renderOrderLifecycleEmail(snapshot); assert.doesNotMatch(escaped.html,/<script>|<img src=x/); assert.match(escaped.html,/&lt;script&gt;/);
  owned.script(`UPDATE orders SET status='delivered',total=3 WHERE id='${f.orderId}';`);
  assert.equal(snapshot.order.total,1,'a later order change cannot rewrite a queued receipt');
  assert.equal(logs(f.orderId).at(-1).metadata.snapshot.order.payment_status,'pending');
});

test('actual provider failure retries one stable intent; receipt is durable before job completion and replay never resends', async () => {
  const f=fixture(),{job,worker}=await claimed(f.orderId),requests: Array<{key:string|null;body:unknown}>=[];
  await assert.rejects(sendOrderLifecycleEmail(db,{},job,worker),/not configured/);
  let accept=false;
  await provider(async request=>{requests.push({key:request.headers.get('idempotency-key'),body:await request.json()});
    return accept ? Response.json({id:'synthetic-provider-accepted'}) : Response.json({message:'Synthetic outage'},{status:503});},async()=>{
    await assert.rejects(sendOrderLifecycleEmail(db,env,job,worker),/did not accept/);
    assert.equal(logs(f.orderId)[0].status,'pending'); accept=true;
    const sent=await sendOrderLifecycleEmail(db,{...env,RESEND_FROM_EMAIL:'support@letbuyy.com'},job,worker); assert.equal(sent.processed,true);
    assert.equal(logs(f.orderId)[0].status,'sent'); assert.equal(logs(f.orderId)[0].provider_message_id,'synthetic-provider-accepted');
    assert.equal((await sendOrderLifecycleEmail(db,env,job,worker)).processed,false);
  });
  assert.equal(requests.length,2); assert.equal(requests[0].key,requests[1].key); assert.deepEqual(requests[0].body,requests[1].body);
});

test('source binding, active lease and private RPC grants reject forged cross-store and ordinary-role delivery', async () => {
  const f=fixture(),{job,worker}=await claimed(f.orderId),other=fixture();
  assert.ok((await db.rpc('order_lifecycle_email_delivery_v1',{p_job_id:job.id,p_worker_id:'wrong-worker'})).error);
  owned.script(`UPDATE platform_queue_jobs SET site_id='${other.tenant.siteId}' WHERE id='${job.id}';`);
  assert.ok((await db.rpc('order_lifecycle_email_delivery_v1',{p_job_id:job.id,p_worker_id:worker})).error);
  owned.script(`UPDATE platform_queue_jobs SET site_id='${f.tenant.siteId}',locked_at=now()-interval '3 minutes' WHERE id='${job.id}';`);
  assert.ok((await db.rpc('order_lifecycle_email_delivery_v1',{p_job_id:job.id,p_worker_id:worker})).error);
  for(const role of ['anon','authenticated','app_tenant']) for(const rpc of [
    `order_lifecycle_email_delivery_v1('${job.id}','${worker}')`,
    `complete_order_lifecycle_email_v1('${job.id}','${worker}','${logs(f.orderId)[0].id}','fake','fake')`,
    `seal_order_lifecycle_email_message_v1('${job.id}','${worker}','${logs(f.orderId)[0].id}','{}')`,
    `claim_order_email_outbox_v1('${f.tenant.siteId}','${f.orderId}','synthetic-worker')`,
    'recover_expired_order_email_jobs_v1(1)']) assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT public.${rpc};`),/permission denied/);
  assert.equal(owned.psql(`SELECT recover_expired_order_email_jobs_v1(100);`),'1');
  assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${job.id}';`),'failed','expired leases enter the existing bounded retry state');
});

test('suppression and expired ambiguous delivery never reach the provider', async () => {
  const f=fixture(),{job,worker}=await claimed(f.orderId);
  owned.script(`INSERT INTO email_suppressions(site_id,email_hash,reason,idempotency_key) SELECT site_id,recipient_hash,'complaint','syn-suppressed-${f.orderId}' FROM email_logs WHERE metadata->>'order_id'='${f.orderId}';`);
  await provider(async()=>{throw new Error('Suppressed email reached the provider');},async()=>{
    const result=await sendOrderLifecycleEmail(db,env,job,worker); assert.equal(result.processed,false); assert.equal(result.reason,'suppressed');
  });
  const g=fixture(),c=await claimed(g.orderId);
  owned.script(`UPDATE email_logs SET metadata=metadata||jsonb_build_object('first_send_attempt_at',(now()-interval '24 hours')::text) WHERE metadata->>'order_id'='${g.orderId}';`);
  await provider(async()=>{throw new Error('Uncertain email reached the provider');},async()=>{
    await assert.rejects(sendOrderLifecycleEmail(db,env,c.job,c.worker),/reconcile provider receipt/);
  });
});

test('402 DOWN/UP preserves all delivery receipts and outbox rows without backfilling past orders', () => {
  const fingerprint=()=>owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(l)::text,'|' ORDER BY id),'')) FROM email_logs l;`)+owned.psql(`SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'|' ORDER BY id),'')) FROM outbox_events e;`);
  const down=readFileSync('database/supabase/rollback/402_atomic_order_lifecycle_email.rollback.sql','utf8');
  assert.match(owned.psqlExpectError(down),/must drain or be explicitly reconciled/);
  // This is an isolated synthetic fixture, with no external delivery. Reconcile
  // deliberately before testing DOWN; production must never silently lose jobs.
  owned.script(`UPDATE email_logs SET status='suppressed' WHERE template_key='order_lifecycle_v1' AND status IN('pending','failed');UPDATE platform_queue_jobs SET status='cancelled' WHERE job_type='order.lifecycle_email_queued' AND status IN('queued','running','failed');`);
  const before=fingerprint(); owned.script(down);
  assert.equal(fingerprint(),before); owned.script(readFileSync('database/supabase/migrations/402_atomic_order_lifecycle_email.sql','utf8')); assert.equal(fingerprint(),before);
});

test('concurrent exact-order dispatches create one notification job; partial/refund/return changes retain payment truth',async()=>{
  const f=fixture(),outbox=new OutboxExecutionAdapter(db);
  await Promise.all(Array.from({length:4},()=>outbox.dispatchOrderEmails(f.tenant.siteId,f.orderId)));
  assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs j JOIN outbox_events e ON e.id=j.outbox_event_id WHERE e.aggregate_id='${f.orderId}' AND j.job_type='order.lifecycle_email_queued';`),'1');
  for(const [column,value,kind] of [['fulfillment_status','partial','fulfilment_updated'],['refund_status','partially_refunded','refund_updated'],['return_status','requested','return_updated']]){
    owned.script(`UPDATE orders SET ${column}='${value}' WHERE id='${f.orderId}';`);
    const snapshot=logs(f.orderId).at(-1).metadata.snapshot;
    assert.equal(snapshot.kind,kind);assert.equal(snapshot.order.payment_status,'pending');
    assert.equal(snapshot.order.total,199);assert.doesNotMatch(renderOrderLifecycleEmail(snapshot).text,/refund of INR/);
  }
});

test('the real scheduled notification consumer retries provider failure and completes only after its saved acceptance receipt',async()=>{
  const f=fixture();await new OutboxExecutionAdapter(db).dispatchOrderEmails(f.tenant.siteId,f.orderId);
  const id=owned.psql(`SELECT j.id FROM platform_queue_jobs j JOIN outbox_events e ON e.id=j.outbox_event_id WHERE e.aggregate_id='${f.orderId}' AND j.job_type='order.lifecycle_email_queued';`);
  const subjectOrder=owned.psql(`SELECT order_number FROM orders WHERE id='${f.orderId}';`),requests: Array<{key:string|null;body:{subject:string}}>=[];
  let accepted=false;
  await provider(async request=>{
    requests.push({key:request.headers.get('idempotency-key'),body:await request.json()});
    return accepted?Response.json({id:'synthetic-scheduled-accepted'}):Response.json({message:'Synthetic outage'},{status:503});
  },async()=>{
    await consumeNotificationJobs({...owned.restEnv(),...env},'synthetic-real-email-worker');
    assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${id}';`),'failed');
    assert.equal(logs(f.orderId)[0].status,'pending');
    owned.script(`UPDATE platform_queue_jobs SET available_at=now() WHERE id='${id}';`);accepted=true;
    await consumeNotificationJobs({...owned.restEnv(),...env},'synthetic-real-email-worker-retry');
    assert.equal(owned.psql(`SELECT status FROM platform_queue_jobs WHERE id='${id}';`),'succeeded');
    assert.equal(logs(f.orderId)[0].provider_message_id,'synthetic-scheduled-accepted');
    await consumeNotificationJobs({...owned.restEnv(),...env},'synthetic-real-email-worker-replay');
  });
  const own=requests.filter(r=>r.body.subject.includes(subjectOrder));assert.equal(own.length,2);assert.equal(own[0].key,own[1].key);
});
