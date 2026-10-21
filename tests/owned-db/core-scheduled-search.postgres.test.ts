// Real owned PostgreSQL privileges and actual native scheduled Gateway. No
// seeded search success: indexes must be produced from durable source events.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {gatewayEnv,newIdentityKeys} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {getSupabaseAdminFromEnv} from '../../services/api-gateway/src/lib/supabase';
import {QueueExecutionAdapter} from '../../services/api-gateway/src/execution/queue-execution.adapter';
import {consumePlatformQueuesForCloudflareQueue} from '../../services/queue-workers/src/platform-queue-consumer';
const owned=requireOwnedDatabase();
const forward=readFileSync('database/supabase/migrations/369_scheduled_dispatch_preflight.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/369_scheduled_dispatch_preflight.rollback.sql','utf8');
const signature='public.scheduled_dispatch_has_pending_work(text[],boolean)';
const snapshot=()=>owned.psql(`SELECT jsonb_build_object('body',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner)::text FROM pg_proc p WHERE p.oid='${signature}'::regprocedure;`);
const probe="public.scheduled_dispatch_has_pending_work(ARRAY['search-indexing']::text[],false)";

test('backend-only pending-work RPC denies ordinary roles and preserves exact recovery/drift boundaries',async()=>{
 const before=snapshot();owned.script(forward);assert.equal(snapshot(),before);
 for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT ${probe};ROLLBACK;`),/permission denied for function/);
 assert.equal(owned.script(`BEGIN;SET LOCAL ROLE service_role;SELECT ${probe}->>'hasWork';ROLLBACK;`),'false');
 for(const drift of [`ALTER FUNCTION ${signature} STABLE;ALTER FUNCTION ${signature} VOLATILE;`,`ALTER FUNCTION ${signature} OWNER TO service_role;`,`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`,`GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION;`,`ALTER FUNCTION ${signature} SET search_path TO public;`])for(const source of [forward,rollback]){
  assert.match(owned.psqlScriptExpectError('BEGIN;'+drift+source),/Migration369 refuses/);assert.equal(snapshot(),before);
 }
 owned.script(rollback);owned.script(rollback);assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`),'t');
 await Promise.all([owned.psqlAsync(forward),owned.psqlAsync(forward)]);assert.equal(snapshot(),before);
 assert.match(owned.psqlExpectError(`SELECT public.scheduled_dispatch_has_pending_work(ARRAY['arbitrary-queue'],false);`),/Invalid scheduled queue selection/);
});

test('preflight reports eligible existence without counting, mutating or admitting future/exhausted/leased jobs',()=>{
 const site=newSyntheticTenant('sched-eligibility');seedSyntheticTenant(owned.psql,site);const id=crypto.randomUUID();
 const result=owned.script(`BEGIN;
 INSERT INTO platform_queue_jobs(id,site_id,event_id,queue_name,job_type,payload,idempotency_key,available_at)
 VALUES('${id}','${site.siteId}',gen_random_uuid(),'search-indexing','product.created','{}','syn-${id}',now()+interval '1 hour');
 SELECT ${probe}->>'hasWork';
 UPDATE platform_queue_jobs SET available_at=now(),attempts=max_attempts WHERE id='${id}';SELECT ${probe}->>'hasWork';
 UPDATE platform_queue_jobs SET attempts=0,locked_at=now() WHERE id='${id}';SELECT ${probe}->>'hasWork';
 UPDATE platform_queue_jobs SET locked_at=now()-interval '121 seconds' WHERE id='${id}';SELECT ${probe}->>'hasWork';
 SELECT status||'|'||attempts FROM platform_queue_jobs WHERE id='${id}';ROLLBACK;`);
 assert.equal(result,'false\nfalse\nfalse\ntrue\nqueued|0');
});

function emit(siteId:string,kind:'product'|'order',id:string){const eventId=crypto.randomUUID();owned.psql(`INSERT INTO outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key) VALUES('${siteId}','${siteId}','${kind}','${id}','${kind}.created','{}','syn-${eventId}');`);}
function injectWrongSiteJob(siteId:string,kind:'product'|'order',id:string){const eventId=crypto.randomUUID();owned.psql(`INSERT INTO platform_queue_jobs(site_id,event_id,queue_name,job_type,payload,idempotency_key) VALUES('${siteId}','${eventId}','search-indexing','${kind}.updated','{"aggregate":{"type":"${kind}","id":"${id}"}}','syn-${eventId}');`);}

test('actual native cron indexes products/orders; both consumers conserve tenant ownership and idle cron does no work',async()=>{
 const a=newSyntheticTenant('sched-a'),b=newSyntheticTenant('sched-b');seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
 const {productId,orderId}=seedSyntheticOrder(owned.psql,a);
 owned.psql(`UPDATE products SET status='active' WHERE id='${productId}' AND store_id='${a.siteId}';`);
 const env=gatewayEnv(owned,await newIdentityKeys());
 const db=getSupabaseAdminFromEnv(env);
 await assert.rejects(async()=>await db.from('outbox_events').select('id').limit(1),/requires a tenant\/owner predicate/,'ordinary global query guard stays enabled');
 const native=await NativeGateway.create(env as unknown as Record<string,unknown>,async()=>{throw new Error('Unexpected provider call in scheduled search test');});
 try{
  assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${a.siteId}';`),'0');
  emit(a.siteId,'product',productId);emit(a.siteId,'order',orderId);
  const pendingRows=()=>owned.psql("SELECT jsonb_agg(to_jsonb(e) ORDER BY id)::text FROM outbox_events e;");const pendingBefore=pendingRows();
  owned.script(rollback);
  try{await native.runScheduled();assert.equal(pendingRows(),pendingBefore,'unavailable preflight must not claim or mutate durable events');assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${a.siteId}';`),'0');}
  finally{owned.script(forward);}
  let ready=false;for(let attempt=0;attempt<50;attempt++){const reply=await db.rpc('scheduled_dispatch_has_pending_work',{p_queue_names:['search-indexing'],p_include_webhook_deliveries:false});if(!reply.error){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(ready,true,'owned REST schema reload observes restored preflight RPC');
  await native.runScheduled();
  assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${a.siteId}' AND status='active' AND object_id IN('${productId}','${orderId}');`),'2');
  const response=await native.dispatch(`/v1/storefront/${a.subdomain}/products?search=Synthetic%20Seed&limit=50`,{method:'GET'});assert.equal(response.status,200);const json=await response.json() as {data:{id:string}[]};assert.deepEqual(json.data.map(p=>p.id),[productId]);
  const docs=()=>owned.psql(`SELECT jsonb_agg(to_jsonb(d) ORDER BY object_id)::text FROM search_documents d WHERE site_id='${a.siteId}';`);
  const before=docs();
  for(const consumer of ['gateway','queue-worker']){
   injectWrongSiteJob(b.siteId,'product',productId);injectWrongSiteJob(b.siteId,'order',orderId);
   if(consumer==='gateway'){const result=await new QueueExecutionAdapter(db).consumeQueue('syn-scope-'+crypto.randomUUID(),'search-indexing',50);assert.equal(result.failed,0);assert.equal(result.succeeded,2);}
   else{const result=await consumePlatformQueuesForCloudflareQueue({...owned.restEnv(),ENVIRONMENT:'test'},{cloudflareQueueName:'syn-search',workerId:'syn-scope-'+crypto.randomUUID(),limit:50});assert.equal(result[0].failed,0);assert.equal(result[0].succeeded,2);}
   assert.equal(docs(),before,'wrong-site job cannot read or rewrite the original tenant document');
   assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${b.siteId}' AND status<>'deleted';`),'0','no foreign product/order content enters the wrong site');
  }
  const jobs=owned.psql('SELECT jsonb_agg(to_jsonb(j) ORDER BY id)::text FROM platform_queue_jobs j;');
  await native.runScheduled();assert.equal(docs(),before);assert.equal(owned.psql('SELECT jsonb_agg(to_jsonb(j) ORDER BY id)::text FROM platform_queue_jobs j;'),jobs,'idle scheduled invocation does not reclaim or fabricate queue work');
  console.info('OWNED_CORE_SCHEDULED_SEARCH '+JSON.stringify({nativeWorkerd:true,ordinaryGuardEnabled:true,indexedProductAndOrder:true,bothConsumerWrongSiteDenied:true,unavailablePreflightConserved:true,idleConserved:true}));
 }finally{await native.settle();}
});
