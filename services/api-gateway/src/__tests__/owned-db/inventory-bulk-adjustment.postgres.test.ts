// Actual mounted Gateway and owned PostgreSQL/PostgREST. Synthetic callers only.
import assert from 'node:assert/strict';
import test,{before,after,afterEach}from 'node:test';
import{randomUUID,createHash}from 'node:crypto';
import type{InventoryAdjustmentInput}from '@letbuyy/commerce-core';
import{closePooledSqlClients,getPooledSql,withPooledSqlScope}from '@letbuyy/infrastructure/pooled-sql-adapter';
import{Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,newBarrier}from './gateway-harness';
import{APPLY_INVENTORY_BATCH_ADJUSTMENT_SQL}from '../../execution/inventory-adjustment.adapter';
import{requireOwnedDatabase,startOwnedPooledSqlProxy}from './owned-db-support';
import{newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateway:Gateway,proxy:Awaited<ReturnType<typeof startOwnedPooledSqlProxy>>,keys:Awaited<ReturnType<typeof newIdentityKeys>>;
before(async()=>{keys=await newIdentityKeys();proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,keys,proxy.env()));});
afterEach(async()=>{await gateway.settle();});after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
function world(tag:string){const site=newSyntheticTenant(tag),actor=randomUUID(),product=randomUUID(),email=`syn-bulk-stock-${actor}@example.invalid`;seedSyntheticTenant(owned.psql,site);owned.psql(`BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic batch stock','syn-${product}',100,4,true,'active');SELECT set_inventory_level_available('${product}',NULL,'${site.locationId}',4,'${actor}');COMMIT;`);return{site,actor,product,email};}
type World=ReturnType<typeof world>;
const adjustment=(w:World):InventoryAdjustmentInput=>({product_id:w.product,location_id:w.site.locationId,adjustment:2,reason:'correction',notes:'Synthetic bulk caller qualification'});
function snapshot(w:World){return owned.psql(`SELECT jsonb_build_object('product',(SELECT to_jsonb(p)FROM products p WHERE id='${w.product}'),'levels',(SELECT jsonb_agg(to_jsonb(l)ORDER BY id)FROM inventory_levels l WHERE product_id='${w.product}'),'reservations',(SELECT jsonb_agg(to_jsonb(r)ORDER BY id)FROM inventory_reservations r WHERE product_id='${w.product}'),'adjustments',(SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM inventory_adjustments a WHERE product_id='${w.product}'),'outbox',(SELECT jsonb_agg(to_jsonb(o)ORDER BY id)FROM outbox_events o WHERE aggregate_id='${w.product}'));`);}
async function send(w:World,path:string,body:unknown,key:string=randomUUID()){return gateway.request(path,{method:'POST',headers:{...await signedIdentityHeaders(w.actor,w.email,w.site.siteId),'X-Store-ID':w.site.siteId,'X-Idempotency-Key':key},body:JSON.stringify(body)});}
test('positive control: normal owner single adjustment retains its canonical context and one exact effect',async()=>{const w=world('bulk-positive'),key=randomUUID();const r=await send(w,'/v1/inventory/adjust',adjustment(w),key);assert.equal(r.status,200,r.text);assert.equal(r.json?.data.available,6);const before=snapshot(w);const again=await send(w,'/v1/inventory/adjust',adjustment(w),key);assert.equal(again.status,200,again.text);assert.equal(snapshot(w),before);});
test('an authorized existing bulk caller can adjust its owned level without exempting the raw tenant guard',async()=>{const w=world('bulk-owned'),before=snapshot(w);const r=await send(w,'/v1/inventory/bulk-adjust',{store_id:w.site.siteId,adjustments:[adjustment(w)]});assert.equal(r.status,200,r.text);const result=r.json?.data.results[0];console.info('OWNED_BULK_STOCK_OBSERVATION '+JSON.stringify({authorizedSite:w.site.siteId,status:r.status,itemStatus:result?.status,stockUnchanged:snapshot(w)===before}));assert.equal(result?.status,'adjusted',r.text);assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'AND location_id='${w.site.locationId}'`),'6');});

test('two canonical stock commands sharing a correlation trace retain two mandatory outbox events',()=>{
 const w=world('bulk-trace'),trace=randomUUID(),first=randomUUID(),second=randomUUID();
 const count=(table:string)=>Number(owned.psql(`SELECT count(*)FROM ${table} WHERE ${table==='outbox_events'?'aggregate_id':'product_id'}='${w.product}'`));
 const auditBefore=count('inventory_adjustments'),outboxBefore=count('outbox_events');
 const command=JSON.stringify({...adjustment(w),variant_id:null}).replaceAll("'","''");
 owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${w.site.siteId}',true);SELECT set_config('app.actor_id','${w.actor}',true);SELECT set_config('app.request_id','${trace}',true);SELECT apply_inventory_adjustment_v1('${w.site.siteId}','${w.actor}','${first}','${command}'::jsonb);SELECT apply_inventory_adjustment_v1('${w.site.siteId}','${w.actor}','${second}','${command}'::jsonb);COMMIT;`);
 assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'AND location_id='${w.site.locationId}'`),'8');
 assert.equal(count('inventory_adjustments')-auditBefore,2);
 assert.equal(owned.psql(`SELECT count(*)FROM inventory_adjustment_receipts WHERE product_id='${w.product}'`),'2');
 console.info('OWNED_STOCK_TRACE_OBSERVATION '+JSON.stringify({stockEffects:2,auditEffects:count('inventory_adjustments')-auditBefore,outboxEffects:count('outbox_events')-outboxBefore}));
 assert.equal(count('outbox_events')-outboxBefore,2,'A shared trace is not an effect identity; both actual stock/audit changes require an event');
});

const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const body=(w:World,items=[adjustment(w)])=>({store_id:w.site.siteId,adjustments:items});
const command=(w:World,items=[adjustment(w)])=>({adjustments:items.map(item=>({...item,variant_id:null,notes:item.notes||null}))});
const receipts=(w:World)=>owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY idempotency_key),'[]')FROM inventory_adjustment_receipts r WHERE store_id='${w.site.siteId}'`);
const entireWorld=(w:World)=>JSON.stringify([snapshot(w),receipts(w)]);
const raw=(w:World,key:string,scope=w.site.siteId,actor=w.actor,role='app_tenant',value:object=command(w))=>`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('app.site_id',${quote(scope)},true),set_config('app.actor_id',${quote(actor)},true);SELECT apply_inventory_adjustment_batch_v1('${w.site.siteId}','${w.actor}',${quote(key)},${quote(JSON.stringify(value))}::jsonb);COMMIT;`;
interface ObservedTransaction {unsafe(query:string,parameters:unknown[]):Promise<unknown>}
interface ObservedPool {begin(callback:(tx:ObservedTransaction)=>Promise<unknown>):Promise<unknown>}
async function atBatchQuery<T>(arrive:()=>Promise<void>,work:()=>Promise<T>):Promise<T>{
 return withPooledSqlScope(async()=>{
  const pool=getPooledSql(gateway.env,{purpose:'tenant-transaction',maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})as unknown as ObservedPool;
  const original=pool.begin;
  pool.begin=callback=>original.call(pool,tx=>callback(new Proxy(tx,{get(target,key){
   if(key==='unsafe')return async(query:string,parameters:unknown[])=>{if(query===APPLY_INVENTORY_BATCH_ADJUSTMENT_SQL)await arrive();return target.unsafe(query,parameters);};
   return Reflect.get(target,key,target);
  }})));
  try{return await work();}finally{pool.begin=original;}
 });
}

test('concurrent identical batches and a discarded reply preserve original ordered acknowledgements and exactly one effect per item',async()=>{
 const w=world('batch-race'),key=randomUUID(),items=[adjustment(w),{...adjustment(w),adjustment:3}],request=body(w,items);
 const barrier=newBarrier(4);
 const responses=await Promise.all(Array.from({length:4},()=>atBatchQuery(()=>barrier.arrive(),()=>send(w,'/v1/inventory/bulk-adjust',request,key))));
 assert.equal(barrier.arrived,4,'Four actual tenant SQL invocations reached the batch command together');
 for(const response of responses){assert.equal(response.status,200,response.text);assert.deepEqual(response.json?.data,responses[0].json?.data);}
 assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'`),'9');
 assert.equal(JSON.parse(receipts(w)).length,3,'Two child receipts and one complete batch acknowledgement');
 const saved=entireWorld(w); // Discard every HTTP response, as after a lost reply.
 const retry=await send(w,'/v1/inventory/bulk-adjust',request,key);
 assert.equal(retry.status,200,retry.text);assert.equal(retry.headers.get('X-Idempotent-Replay'),'true');
 assert.deepEqual(retry.json?.data,responses[0].json?.data);assert.equal(entireWorld(w),saved);
});

test('changed, extended and truncated commands and another authorized actor/site cannot reuse a batch identity',async()=>{
 const w=world('batch-binding'),key=randomUUID(),items=[adjustment(w),{...adjustment(w),adjustment:3}],request=body(w,items);
 assert.equal((await send(w,'/v1/inventory/bulk-adjust',request,key)).status,200);
 const saved=entireWorld(w);
 for(const changed of [[{...items[0],adjustment:4},items[1]],[...items,adjustment(w)],[items[0]]]){
  const response=await send(w,'/v1/inventory/bulk-adjust',body(w,changed),key);assert.equal(response.status,409,response.text);assert.equal(entireWorld(w),saved);
 }
 const other=world('batch-other'),otherBefore=entireWorld(other);
 const cross=await send(other,'/v1/inventory/bulk-adjust',body(other),key);assert.equal(cross.status,409,cross.text);assert.equal(entireWorld(other),otherBefore);
 // A currently valid replacement owner must not inherit the former actor's receipt.
 owned.psql(`UPDATE sites SET custom_user_id='${other.actor}'WHERE id='${w.site.siteId}'`);
 try{
  const replacement={...w,actor:other.actor,email:other.email};
  const denied=await send(replacement,'/v1/inventory/bulk-adjust',request,key);assert.equal(denied.status,409,denied.text);assert.equal(entireWorld(w),saved);
 }finally{owned.psql(`UPDATE sites SET custom_user_id='${w.actor}'WHERE id='${w.site.siteId}'`);}
});

test('live owner access is rechecked before replay, and selected-store mismatch cannot read an acknowledgement',async()=>{
 const w=world('batch-revoke'),replacement=world('batch-new-owner'),key=randomUUID();
 const accepted=await send(w,'/v1/inventory/bulk-adjust',body(w),key);assert.equal(accepted.status,200,accepted.text);
 const saved=entireWorld(w);
 owned.psql(`UPDATE sites SET custom_user_id='${replacement.actor}'WHERE id='${w.site.siteId}'`);
 try{const denied=await send(w,'/v1/inventory/bulk-adjust',body(w),key);assert.equal(denied.status,403,denied.text);assert.equal(entireWorld(w),saved);}
 finally{owned.psql(`UPDATE sites SET custom_user_id='${w.actor}'WHERE id='${w.site.siteId}'`);}
 const mismatch=await gateway.request('/v1/inventory/bulk-adjust',{method:'POST',headers:{...await signedIdentityHeaders(w.actor,w.email,w.site.siteId),'X-Store-ID':replacement.site.siteId,'X-Idempotency-Key':key},body:JSON.stringify(body(w))});
 assert.equal(mismatch.status,403,mismatch.text);assert.equal(entireWorld(w),saved);
 const again=await send(w,'/v1/inventory/bulk-adjust',body(w),key);assert.equal(again.status,200);assert.deepEqual(again.json?.data,accepted.json?.data);
});

test('bulk role and tenant fences deny wrong/missing context and actor while authorized SQL actually changes stock',()=>{
 const w=world('batch-raw'),other=world('batch-raw-other');
 owned.psql(raw(w,randomUUID()));assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'`),'6');
 const saved=entireWorld(w);
 for(const scope of ['',other.site.siteId])assert.match(owned.psqlScriptExpectError(raw(w,randomUUID(),scope)),/tenant|site|FORBIDDEN/i);
 assert.match(owned.psqlScriptExpectError(raw(w,randomUUID(),w.site.siteId,other.actor)),/FORBIDDEN/);
 for(const role of ['service_role','authenticated','anon'])assert.match(owned.psqlScriptExpectError(raw(w,randomUUID(),w.site.siteId,w.actor,role)),/permission denied|FORBIDDEN/i);
 assert.equal(entireWorld(w),saved);
});

test('known per-item business failures retain input order and replay the original complete outcome',async()=>{
 const w=world('batch-partial'),missing=randomUUID(),key=randomUUID();
 const items=[adjustment(w),{...adjustment(w),product_id:missing},{...adjustment(w),adjustment:-99},{...adjustment(w),adjustment:1}];
 const response=await send(w,'/v1/inventory/bulk-adjust',body(w,items),key);assert.equal(response.status,200,response.text);
 assert.deepEqual(response.json?.data.results.map((row:{status:string})=>row.status),['adjusted','not_found','failed','adjusted']);
 assert.equal(response.json?.data.total,4);assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'`),'7');
 const saved=entireWorld(w);assert.equal(JSON.parse(receipts(w)).length,3);
 // A previously missing product appearing later must never turn a replay into new work.
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,price,stock,is_active,status)VALUES('${missing}','${w.site.siteId}','${w.site.siteId}','Synthetic later product',100,0,true,'active')`);
 const retry=await send(w,'/v1/inventory/bulk-adjust',body(w,items),key);assert.equal(retry.status,200,retry.text);assert.deepEqual(retry.json?.data,response.json?.data);assert.equal(entireWorld(w),saved);
 assert.equal(owned.psql(`SELECT count(*)FROM inventory_levels WHERE product_id='${missing}'`),'0');
});

test('audit, outbox, child receipt and final batch receipt faults abort every item and recover with the original key',async()=>{
 for(const failure of ['audit','outbox','child','parent']as const){
  const w=world('batch-fault-'+failure),key=randomUUID(),request=body(w,[adjustment(w),{...adjustment(w),adjustment:1}]),saved=entireWorld(w);
  const table=failure==='audit'?'inventory_adjustments':failure==='outbox'?'outbox_events':'inventory_adjustment_receipts';
  // Fail the second item's mandatory write, after the first item's stock and
  // child acknowledgement have run, or fail the final parent acknowledgement.
  const condition=failure==='outbox'?`NEW.aggregate_id='${w.product}'AND NEW.event_type='inventory.level.adjusted'AND NEW.payload->>'adjustment'='1'`:failure==='parent'?`NEW.store_id='${w.site.siteId}'AND NEW.operation='inventory.adjustment.batch.v1'`:failure==='child'?`NEW.product_id='${w.product}'::uuid AND NEW.command->>'adjustment'='1'`:`NEW.product_id='${w.product}'::uuid AND NEW.quantity_change=1`;
  owned.psql(`CREATE FUNCTION public.synthetic_batch_failure()RETURNS trigger LANGUAGE plpgsql AS $fault$BEGIN IF ${condition} THEN RAISE EXCEPTION 'Synthetic mandatory batch ${failure} failure';END IF;RETURN NEW;END$fault$;CREATE TRIGGER synthetic_batch_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION public.synthetic_batch_failure();`);
  try{const failed=await send(w,'/v1/inventory/bulk-adjust',request,key);assert.equal(failed.status,500,failed.text);assert(!failed.text.includes('Synthetic mandatory'));}
  finally{owned.psql(`DROP TRIGGER synthetic_batch_failure ON ${table};DROP FUNCTION public.synthetic_batch_failure()`);}
  assert.equal(entireWorld(w),saved,failure+' must roll back stock/cache/audit/outbox/child and parent receipts');
  const retry=await send(w,'/v1/inventory/bulk-adjust',request,key);assert.equal(retry.status,200,retry.text);assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'`),'7');
  const committed=entireWorld(w);assert.equal((await send(w,'/v1/inventory/bulk-adjust',request,key)).status,200);assert.equal(entireWorld(w),committed);
 }
});

test('legacy HTTP receipts and an independently used derived child key cannot silently become new batch work',async()=>{
 const w=world('batch-legacy'),key=randomUUID(),saved=entireWorld(w);
 owned.psql(`INSERT INTO idempotency_keys(site_id,key,scope,request_hash,status,status_code,response_body,expires_at,deleted_at)VALUES('${w.site.siteId}','${key}','http:POST:/inventory/bulk-adjust','synthetic-unbound','completed',200,'{}',now()-interval '1 day',now())`);
 const denied=await send(w,'/v1/inventory/bulk-adjust',body(w),key);assert.equal(denied.status,409,denied.text);assert.equal(entireWorld(w),saved);
 const collision=randomUUID(),child='inventory.batch.v1:'+createHash('sha256').update(collision).digest('hex')+':0';
 assert.equal((await send(w,'/v1/inventory/adjust',adjustment(w),child)).status,200);
 const current=entireWorld(w),response=await send(w,'/v1/inventory/bulk-adjust',body(w),collision);
 assert.equal(response.status,409,response.text);assert.equal(entireWorld(w),current);
});

test('missing acknowledged entities refuse replay; missing SQL and missing keys never fall back to raw REST writes',async()=>{
 const w=world('batch-unavailable'),key=randomUUID(),request=body(w);
 assert.equal((await send(w,'/v1/inventory/bulk-adjust',request,key)).status,200);
 owned.psql(`UPDATE products SET deleted_at=now()WHERE id='${w.product}'`);
 const saved=entireWorld(w),missing=await send(w,'/v1/inventory/bulk-adjust',request,key);assert.equal(missing.status,404,missing.text);assert.equal(entireWorld(w),saved);
 const fresh=world('batch-no-pool'),before=entireWorld(fresh),unavailable=new Gateway(gatewayEnv(owned,keys));
 try{
  const response=await unavailable.request('/v1/inventory/bulk-adjust',{method:'POST',headers:{...await signedIdentityHeaders(fresh.actor,fresh.email,fresh.site.siteId),'X-Idempotency-Key':randomUUID()},body:JSON.stringify(body(fresh))});assert.equal(response.status,503,response.text);assert.equal(entireWorld(fresh),before);
 }finally{await unavailable.settle();}
 const noKey=await gateway.request('/v1/inventory/bulk-adjust',{method:'POST',headers:await signedIdentityHeaders(fresh.actor,fresh.email,fresh.site.siteId),body:JSON.stringify(body(fresh))});assert.equal(noKey.status,400,noKey.text);assert.equal(noKey.json?.error.code,'IDEMPOTENCY_KEY_REQUIRED');assert.equal(entireWorld(fresh),before);
});

test('the bounded100-item batch has100 mandatory effects; empty, oversized and malformed envelopes write nothing',async()=>{
 const w=world('batch-bounds'),key=randomUUID(),items=Array.from({length:100},()=>({...adjustment(w),adjustment:1}));
 const baseline=Number(owned.psql(`SELECT count(*)FROM inventory_adjustments WHERE product_id='${w.product}'`));
 const accepted=await send(w,'/v1/inventory/bulk-adjust',body(w,items),key);assert.equal(accepted.status,200,accepted.text);assert.equal(accepted.json?.data.total,100);
 assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE product_id='${w.product}'`),'104');
 assert.equal(Number(owned.psql(`SELECT count(*)FROM inventory_adjustments WHERE product_id='${w.product}'`))-baseline,100);
 assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE aggregate_id='${w.product}'AND event_type='inventory.level.adjusted'`),'100');
 assert.equal(JSON.parse(receipts(w)).length,101);
 const saved=entireWorld(w);
 for(const invalid of [[],[...items,items[0]],[{...adjustment(w),adjustment:0.5}]]){const rejected=await send(w,'/v1/inventory/bulk-adjust',body(w,invalid),randomUUID());assert.equal(rejected.status,400,rejected.text);assert.equal(entireWorld(w),saved);}
 const malformed={adjustments:[command(w).adjustments[0],{...command(w).adjustments[0],notes:'x'.repeat(501)}]};
 assert.match(owned.psqlScriptExpectError(raw(w,randomUUID(),w.site.siteId,w.actor,'app_tenant',malformed)),/INVENTORY_BATCH_INVALID/);assert.equal(entireWorld(w),saved);
 const replay=await send(w,'/v1/inventory/bulk-adjust',body(w,items),key);assert.equal(replay.status,200,replay.text);assert.deepEqual(replay.json?.data,accepted.json?.data);assert.equal(entireWorld(w),saved);
});

test('schema-valid uppercase product/location UUIDs confirm and replay their same canonical records',async()=>{
 const w=world('batch-uuid-case'),key=randomUUID(),item={...adjustment(w),product_id:w.product.toUpperCase(),location_id:w.site.locationId.toUpperCase()},request=body(w,[item]);
 const first=await send(w,'/v1/inventory/bulk-adjust',request,key);assert.equal(first.status,200,first.text);assert.equal(first.json?.data.results[0].status,'adjusted');
 const saved=entireWorld(w),again=await send(w,'/v1/inventory/bulk-adjust',request,key);assert.equal(again.status,200,again.text);assert.deepEqual(again.json?.data,first.json?.data);assert.equal(entireWorld(w),saved);
});
