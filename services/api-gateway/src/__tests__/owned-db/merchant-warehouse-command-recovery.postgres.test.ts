// Owned synthetic stock only. No hosted credentials, provider or external effects.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy} from './owned-db-support';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
let fixtureOrdinal=0;
async function fixture(t:{after(fn:()=>Promise<void>):void}) {
 const site=newSyntheticTenant('wms-cmd-'+(++fixtureOrdinal)),actor=randomUUID(),product=randomUUID(),destination=randomUUID();
 seedSyntheticTenant(owned.psql,site);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','syn-wms-${actor}@example.invalid',true);
 UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';
 INSERT INTO products(id,store_id,site_id,name,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic WMS product',129.75,20,true,'active');
 INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),'${site.siteId}','${product}','${site.locationId}',20,0,20,0,20);
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic destination','active');`);
 const proxy=await startOwnedPooledSqlProxy(owned);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 t.after(async()=>{await gateway.settle();await closePooledSqlClients();await proxy.stop();});
 const requestAs=async(who:string,selected:string,path:string,body:unknown,key:string)=>gateway.request('/v1/inventory'+path,{
  method:'POST',headers:{...await signedIdentityHeaders(who,`syn-wms-${who}@example.invalid`,selected),'Idempotency-Key':key},body:JSON.stringify(body),
 });
 const request=(path:string,body:unknown,key:string)=>requestAs(actor,site.siteId,path,body,key);
 const create=(key:string,quantity=3)=>({store_id:site.siteId,location_id:site.locationId,lines:[{product_id:product,quantity,unit_cost:12.25}],idempotency_key:key});
 return{site,actor,product,destination,gateway,request,requestAs,create};
}
test('warehouse receipt failure rolls back stock, document, audit and outbox together and same intent recovers',async t=>{
 const f=await fixture(t),control=randomUUID();
 const positive=await f.request('/purchase-orders',f.create(control),control);assert.equal(positive.status,201,positive.text);
 assert.equal(positive.json?.data.purchase_order.site_id,f.site.siteId);
 const key=randomUUID(),atomic=owned.psql("SELECT to_regclass('public.warehouse_command_receipts') IS NOT NULL;")==='t';
 const before=owned.psql(`SELECT jsonb_build_object('incoming',(SELECT incoming FROM inventory_levels WHERE product_id='${f.product}'),'events',(SELECT count(*)FROM inventory_events WHERE site_id='${f.site.siteId}'),'outbox',(SELECT count(*)FROM outbox_events WHERE site_id='${f.site.siteId}'))::text;`);
 let effectCommitted=false;
 const tap=atomic?null:tapRest(owned.restUrl,async(call,forward)=>{
  if(call.resource==='rpc/create_purchase_order_with_lines') {const result=await forward();if(result.ok)effectCommitted=true;return result;}
  const body=call.json as Record<string,unknown>|null;
  if(effectCommitted&&call.resource==='idempotency_keys'&&call.method==='PATCH'&&body?.status==='completed')
   return Response.json({message:'SYN_RECEIPT_WRITE_FAILED'},{status:500});
  return forward();
 });
 if(atomic)owned.psql(`CREATE FUNCTION public.syn_warehouse_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.idempotency_key='${key}' THEN RAISE EXCEPTION 'SYN_RECEIPT_WRITE_FAILED';END IF;RETURN NEW;END$$;
 CREATE TRIGGER syn_warehouse_receipt_failure BEFORE INSERT ON public.warehouse_command_receipts FOR EACH ROW EXECUTE FUNCTION public.syn_warehouse_receipt_failure();`);
 let failure: Awaited<ReturnType<typeof f.request>>;
 try {failure=await f.request('/purchase-orders',f.create(key),key);}
 finally {tap?.restore();if(atomic)owned.psql('DROP TRIGGER syn_warehouse_receipt_failure ON public.warehouse_command_receipts;DROP FUNCTION public.syn_warehouse_receipt_failure();');}
 assert.ok(failure.status>=500,failure.text);assert.ok(!failure.text.includes('SYN_RECEIPT_WRITE_FAILED'));
 assert.equal(owned.psql(`SELECT count(*) FROM purchase_orders WHERE site_id='${f.site.siteId}'AND idempotency_key='${key}';`),'0','a failed mandatory acknowledgement cannot leave a committed PO');
 assert.equal(owned.psql(`SELECT jsonb_build_object('incoming',(SELECT incoming FROM inventory_levels WHERE product_id='${f.product}'),'events',(SELECT count(*)FROM inventory_events WHERE site_id='${f.site.siteId}'),'outbox',(SELECT count(*)FROM outbox_events WHERE site_id='${f.site.siteId}'))::text;`),before);
 const recovered=await f.request('/purchase-orders',f.create(key),key);assert.equal(recovered.status,201,recovered.text);
 assert.equal(recovered.json?.data.lines.length,1);
 assert.equal(owned.psql(`SELECT count(*) FROM warehouse_command_receipts WHERE site_id='${f.site.siteId}'AND idempotency_key='${key}';`),'1');
});
const effects=[
 'public.create_purchase_order_with_lines(uuid,uuid,uuid,jsonb,timestamptz,text,uuid,text,text)',
 'public.receive_purchase_order(uuid,jsonb,uuid,text,text)',
 'public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)',
 'public.ship_inventory_transfer(uuid,uuid,text,text)',
 'public.receive_inventory_transfer(uuid,jsonb,uuid,text,text)',
 'public.receive_purchase_order_line(public.purchase_orders,public.purchase_order_lines,integer,uuid,text,text)',
 'public.receive_inventory_transfer_line(public.inventory_transfers,public.inventory_transfer_lines,integer,uuid,text,text)',
];
test('the guarded warehouse owner replaces raw Data API execution of every stock effect and line helper',async t=>{
 const f=await fixture(t),key=randomUUID();const positive=await f.request('/purchase-orders',f.create(key),key);assert.equal(positive.status,201,positive.text);
 const bypasses:string[]=[];
 for(const signature of effects)for(const role of ['anon','authenticated','app_tenant','service_role']) {
  if(owned.psql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`)==='t')bypasses.push(role+':'+signature);
 }
 assert.deepEqual(bypasses,[],'no Data API role may bypass the guarded warehouse command owner');
 assert.equal(owned.psql("SELECT has_function_privilege('app_tenant','public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE');"),'t');
});


const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
function stock(site:string) {return JSON.parse(owned.psql(
 "SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY location_id,id),'[]')::text FROM inventory_levels t WHERE store_id="+quote(site)+";")) as Array<Record<string,unknown>>;}
test('concurrent same-key creates return one durable response and changed intent cannot add incoming stock',async t=>{
 const f=await fixture(t),key=randomUUID(),body=f.create(key,5);
 const replies=await Promise.all([f.request('/purchase-orders',body,key),f.request('/purchase-orders',body,key)]);
 for(const r of replies)assert.equal(r.status,201,r.text);
 assert.deepEqual(replies[0].json?.data,replies[1].json?.data);
 assert.equal(owned.psql("SELECT incoming FROM inventory_levels WHERE product_id="+quote(f.product)+";"),'5');
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'1');
 const conflict=await f.request('/purchase-orders',f.create(key,6),key);assert.equal(conflict.status,409,conflict.text);
 assert.equal(conflict.json?.error.code,'WAREHOUSE_KEY_CONFLICT');
 assert.equal(owned.psql("SELECT incoming FROM inventory_levels WHERE product_id="+quote(f.product)+";"),'5');
});
test('partial and terminal PO receipts replay exactly without receiving units again',async t=>{
 const f=await fixture(t),key=randomUUID(),created=await f.request('/purchase-orders',f.create(key,5),key);assert.equal(created.status,201,created.text);
 const id=created.json?.data.purchase_order.id as string,line=created.json?.data.lines[0].id as string;
 const receive=async(quantity:number,k:string)=>f.request('/purchase-orders/'+id+'/receive',{lines:[{purchase_order_line_id:line,quantity}],idempotency_key:k},k);
 const partialKey=randomUUID(),partial=await receive(2,partialKey);assert.equal(partial.status,200,partial.text);assert.equal(partial.json?.data.lines[0].quantity_received,2);
 const before=stock(f.site.siteId),replay=await receive(2,partialKey);assert.equal(replay.status,200,replay.text);assert.deepEqual(replay.json?.data,partial.json?.data);assert.deepEqual(stock(f.site.siteId),before);
 const finalKey=randomUUID(),final=await receive(3,finalKey);assert.equal(final.status,200,final.text);assert.equal(final.json?.data.purchase_order.status,'received');assert.equal(final.json?.data.lines[0].quantity_received,5);
 assert.equal(owned.psql("SELECT available||'|'||incoming FROM inventory_levels WHERE product_id="+quote(f.product)+";"),'25|0');
 const oldReplay=await receive(2,partialKey);assert.equal(oldReplay.status,200,oldReplay.text);assert.deepEqual(oldReplay.json?.data,partial.json?.data);
 const tooLate=await receive(1,randomUUID());assert.equal(tooLate.status,409,tooLate.text);
 assert.equal(owned.psql("SELECT available||'|'||incoming FROM inventory_levels WHERE product_id="+quote(f.product)+";"),'25|0');
});
test('transfer create ship and partial receipts keep stock conserved and every replay includes full lines',async t=>{
 const f=await fixture(t),key=randomUUID(),body={store_id:f.site.siteId,source_location_id:f.site.locationId,destination_location_id:f.destination,lines:[{product_id:f.product,quantity:4}],idempotency_key:key};
 const create=await f.request('/transfers',body,key);assert.equal(create.status,201,create.text);
 const id=create.json?.data.transfer.id as string,line=create.json?.data.lines[0].id as string;
 const shipKey=randomUUID(),shipBody={idempotency_key:shipKey},ship=await f.request('/transfers/'+id+'/ship',shipBody,shipKey);
 assert.equal(ship.status,200,ship.text);assert.equal(ship.json?.data.lines.length,1);assert.equal(ship.json?.data.lines[0].quantity_shipped,4);
 const before=stock(f.site.siteId),shipAgain=await f.request('/transfers/'+id+'/ship',shipBody,shipKey);assert.equal(shipAgain.status,200,shipAgain.text);assert.deepEqual(shipAgain.json?.data,ship.json?.data);assert.deepEqual(stock(f.site.siteId),before);
 for(let n=0;n<2;n++){const k=randomUUID(),body={lines:[{transfer_line_id:line,quantity:2}],idempotency_key:k};const first=await f.request('/transfers/'+id+'/receive',body,k);assert.equal(first.status,200,first.text);const after=stock(f.site.siteId),again=await f.request('/transfers/'+id+'/receive',body,k);assert.equal(again.status,200,again.text);assert.deepEqual(again.json?.data,first.json?.data);assert.deepEqual(stock(f.site.siteId),after);}
 assert.equal(owned.psql("SELECT available||'|'||reserved FROM inventory_levels WHERE product_id="+quote(f.product)+" AND location_id="+quote(f.site.locationId)+";"),'16|0');
 assert.equal(owned.psql("SELECT available FROM inventory_levels WHERE product_id="+quote(f.product)+" AND location_id="+quote(f.destination)+";"),'4');
 const historical=await f.request('/transfers/'+id+'/ship',shipBody,shipKey);assert.equal(historical.status,200,historical.text);assert.deepEqual(historical.json?.data,ship.json?.data);
 const newKey=randomUUID(),late=await f.request('/transfers/'+id+'/ship',{idempotency_key:newKey},newKey);assert.equal(late.status,409,late.text);
});
test('receive-all freezes its first accepted quantities and concurrent explicit receivers cannot over-receive',async t=>{
 const f=await fixture(t),key=randomUUID(),created=await f.request('/purchase-orders',f.create(key,5),key);assert.equal(created.status,201,created.text);
 const id=created.json?.data.purchase_order.id as string,line=created.json?.data.lines[0].id as string;
 const requests=[randomUUID(),randomUUID()].map(k=>f.request('/purchase-orders/'+id+'/receive',{lines:[{purchase_order_line_id:line,quantity:3}],idempotency_key:k},k));
 const replies=await Promise.all(requests);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
 const allKey=randomUUID(),body={idempotency_key:allKey},all=await f.request('/purchase-orders/'+id+'/receive',body,allKey);
 assert.equal(all.status,200,all.text);assert.equal(all.json?.data.command_receipt.command.lines,null);assert.equal(all.json?.data.command_receipt.effective_lines[0].quantity,2);
 const again=await f.request('/purchase-orders/'+id+'/receive',body,allKey);assert.equal(again.status,200,again.text);assert.deepEqual(again.json?.data,all.json?.data);
 assert.equal(owned.psql("SELECT available||'|'||incoming FROM inventory_levels WHERE product_id="+quote(f.product)+";"),'25|0');
});
test('revoked owners and a replacement owner cannot replay another actor acknowledgement',async t=>{
 const f=await fixture(t),key=randomUUID(),body=f.create(key),first=await f.request('/purchase-orders',body,key);assert.equal(first.status,201,first.text);
 const next=randomUUID();owned.psql("INSERT INTO users_custom(id,email,email_verified)VALUES("+quote(next)+","+quote('syn-wms-'+next+'@example.invalid')+",true);UPDATE sites SET custom_user_id="+quote(next)+" WHERE id="+quote(f.site.siteId)+";");
 const denied=await f.request('/purchase-orders',body,key);assert.equal(denied.status,403,denied.text);
 const changed=await f.requestAs(next,f.site.siteId,'/purchase-orders',body,key);assert.equal(changed.status,409,changed.text);assert.equal(changed.json?.error.code,'WAREHOUSE_KEY_CONFLICT');
 const control=randomUUID(),allowed=await f.requestAs(next,f.site.siteId,'/purchase-orders',f.create(control),control);assert.equal(allowed.status,201,allowed.text);
});
test('foreign locations products and receiving lines cannot change either populated tenant',async t=>{
 const a=await fixture(t),b=await fixture(t),positive=randomUUID();assert.equal((await a.request('/purchase-orders',a.create(positive),positive)).status,201);
 const bkey=randomUUID(),bpo=await b.request('/purchase-orders',b.create(bkey),bkey);assert.equal(bpo.status,201,bpo.text);
 const beforeA=stock(a.site.siteId),beforeB=stock(b.site.siteId);
 for(const target of ['product','location']) {
  const key=randomUUID(),body=target==='product'?{...a.create(key),lines:[{product_id:b.product,quantity:1,unit_cost:1}]}:{...a.create(key),location_id:b.site.locationId};
  const denied=await a.request('/purchase-orders',body,key);assert.equal(denied.status,404,denied.text);
 }
 const id=owned.psql("SELECT id FROM purchase_orders WHERE site_id="+quote(a.site.siteId)+" LIMIT 1;"),key=randomUUID();
 const denied=await a.request('/purchase-orders/'+id+'/receive',{lines:[{purchase_order_line_id:bpo.json?.data.lines[0].id,quantity:1}],idempotency_key:key},key);
 assert.equal(denied.status,404,denied.text);assert.deepEqual(stock(a.site.siteId),beforeA);assert.deepEqual(stock(b.site.siteId),beforeB);
});
test('opaque acknowledgements deny raw reads, updates and deletes and retained evidence blocks rollback',async t=>{
 const f=await fixture(t),key=randomUUID(),positive=await f.request('/purchase-orders',f.create(key),key);assert.equal(positive.status,201,positive.text);
 assert.equal(owned.psql("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.warehouse_command_receipts'::regclass;"),'t');
 for(const role of ['anon','authenticated','app_tenant','service_role'])assert.match(owned.psqlExpectError("BEGIN;SET LOCAL ROLE "+role+";SELECT *FROM warehouse_command_receipts;ROLLBACK;"),/permission denied/);
 assert.match(owned.psqlExpectError("UPDATE warehouse_command_receipts SET request_id='changed'WHERE idempotency_key="+quote(key)+";"),/immutable/);
 assert.match(owned.psqlExpectError("DELETE FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),/immutable/);
 await f.gateway.settle();
 const before=owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')::text FROM warehouse_command_receipts t;");
 const down=readFileSync(new URL('../../../../../database/supabase/rollback/414_atomic_warehouse_commands.rollback.sql',import.meta.url),'utf8');
 assert.match(owned.psqlScriptExpectError(down),/rollback414 refuses retained warehouse command receipts/);
 assert.equal(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')::text FROM warehouse_command_receipts t;"),before);
 const replay=await f.request('/purchase-orders',f.create(key),key);assert.equal(replay.status,201,replay.text);assert.deepEqual(replay.json?.data,positive.json?.data);
});

test('tenant SQL context and temporary-shadow attacks fail after a populated positive control',async t=>{
 const f=await fixture(t),control=randomUUID(),made=await f.request('/purchase-orders',f.create(control),control);assert.equal(made.status,201,made.text);
 const key=randomUUID(),command={supplier_id:null,location_id:f.site.locationId,expected_at:null,notes:null,lines:[{product_id:f.product,variant_id:null,quantity:1,unit_cost:12.25}]};
 const invoke="SELECT public.apply_warehouse_command_v1("+quote(f.site.siteId)+"::uuid,"+quote(f.actor)+"::uuid,"+quote(key)+",'purchase_order.create',NULL,"+quote(JSON.stringify(command))+"::jsonb,'synthetic-tenant-probe');";
 const gucs=(site:string,actor:string)=>"SELECT set_config('app.site_id',"+quote(site)+",true),set_config('app.actor_id',"+quote(actor)+",true);";
 const before=stock(f.site.siteId);
 for(const setup of [
  'SET LOCAL ROLE app_tenant;',
  'SET LOCAL ROLE app_tenant;'+gucs(randomUUID(),f.actor),
  'SET LOCAL ROLE app_tenant;'+gucs(f.site.siteId,randomUUID()),
 ]) assert.match(owned.psqlExpectError('BEGIN;'+setup+invoke+'ROLLBACK;'),/PRODUCT_EDIT_FORBIDDEN|WAREHOUSE_FORBIDDEN/);
 assert.match(owned.psqlExpectError('BEGIN;SET LOCAL ROLE service_role;'+gucs(f.site.siteId,f.actor)+invoke+'ROLLBACK;'),/permission denied for function|WAREHOUSE_FORBIDDEN/);
 assert.match(owned.psqlExpectError('BEGIN;SET LOCAL ROLE app_tenant;'+gucs(f.site.siteId,f.actor)+'CREATE TEMP TABLE inventory_levels(id uuid);'+invoke+'ROLLBACK;'),/WAREHOUSE_FORBIDDEN|permission denied/);
 assert.deepEqual(stock(f.site.siteId),before);
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),'0');
});
test('product-write staff still cannot acquire owner-only warehouse mutation or replay authority',async t=>{
 const f=await fixture(t),key=randomUUID(),positive=await f.request('/purchase-orders',f.create(key),key);assert.equal(positive.status,201,positive.text);
 const staff=randomUUID(),email='syn-wms-'+staff+'@example.invalid';
 owned.psql("INSERT INTO users_custom(id,email,email_verified)VALUES("+quote(staff)+","+quote(email)+",true);INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES("+quote(staff)+","+quote(email)+","+quote(f.site.siteId)+",'editor','active',true,'{\"granted\":[\"products:write\"]}');");
 const before=stock(f.site.siteId),fresh=randomUUID();
 const denied=await f.requestAs(staff,f.site.siteId,'/purchase-orders',f.create(fresh),fresh);
 assert.ok([403,404].includes(denied.status),denied.text);
 const replay=await f.requestAs(staff,f.site.siteId,'/purchase-orders',f.create(key),key);
 assert.ok([403,404].includes(replay.status),replay.text);
 assert.deepEqual(stock(f.site.siteId),before);
});
test('an actual legacy committed PO is quarantined rather than reissued under an uncertain old key',async t=>{
 const f=await fixture(t),key=randomUUID();
 const lines=[{product_id:f.product,quantity:3,unit_cost:12.25}];
 owned.psql("SELECT public.create_purchase_order_with_lines("+quote(f.site.siteId)+"::uuid,NULL,"+quote(f.site.locationId)+"::uuid,"+quote(JSON.stringify(lines))+"::jsonb,NULL,NULL,"+quote(f.actor)+"::uuid,'synthetic-legacy-witness',"+quote(key)+");");
 const before=stock(f.site.siteId),retry=await f.request('/purchase-orders',f.create(key),key);
 assert.equal(retry.status,409,retry.text);assert.equal(retry.json?.error.code,'WAREHOUSE_LEGACY_KEY');
 assert.deepEqual(stock(f.site.siteId),before);
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+" AND idempotency_key="+quote(key)+";"),'1');
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),'0');
});
test('a receive key cannot be moved to a second owned parent',async t=>{
 const f=await fixture(t),a=randomUUID(),b=randomUUID(),one=await f.request('/purchase-orders',f.create(a),a),two=await f.request('/purchase-orders',f.create(b),b);
 assert.equal(one.status,201,one.text);assert.equal(two.status,201,two.text);
 const key=randomUUID(),first=await f.request('/purchase-orders/'+one.json?.data.purchase_order.id+'/receive',{idempotency_key:key,lines:[{purchase_order_line_id:one.json?.data.lines[0].id,quantity:1}]},key);
 assert.equal(first.status,200,first.text);const before=stock(f.site.siteId);
 const other=await f.request('/purchase-orders/'+two.json?.data.purchase_order.id+'/receive',{idempotency_key:key,lines:[{purchase_order_line_id:two.json?.data.lines[0].id,quantity:1}]},key);
 assert.equal(other.status,409,other.text);assert.equal(other.json?.error.code,'WAREHOUSE_KEY_CONFLICT');assert.deepEqual(stock(f.site.siteId),before);
});

function stopCreate(f:Awaited<ReturnType<typeof fixture>>,key:string,quantity=3) {
 return {store_id:f.site.siteId,idempotency_key:key,operation:'purchase_order.create',target_id:null,
  command:{supplier_id:null,location_id:f.site.locationId,expected_at:null,notes:null,
   lines:[{product_id:f.product,variant_id:null,quantity,unit_cost:12.25}]}};
}
test('stopping an unapplied request retains a cancellation that prevents every delayed apply',async t=>{
 const f=await fixture(t),control=randomUUID();assert.equal((await f.request('/purchase-orders',f.create(control,1),control)).status,201);
 const key=randomUUID(),before=stock(f.site.siteId),body=stopCreate(f,key),stopped=await f.request('/commands/stop',body,key);
 assert.equal(stopped.status,200,stopped.text);assert.equal(stopped.json?.data.command_receipt.outcome,'cancelled');
 assert.equal(stopped.json?.data.command_receipt.target_id,null);assert.deepEqual(stopped.json?.data.lines,[]);
 const late=await f.request('/purchase-orders',f.create(key),key);assert.equal(late.status,409,late.text);assert.equal(late.json?.error.code,'WAREHOUSE_REQUEST_STOPPED');
 const again=await f.request('/commands/stop',body,key);assert.equal(again.status,200,again.text);assert.deepEqual(again.json?.data,stopped.json?.data);
 assert.deepEqual(stock(f.site.siteId),before);
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE idempotency_key="+quote(key)+";"),'0');
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),'1');
});
test('stop after a committed lost reply recovers the applied acknowledgement rather than claiming it was undone',async t=>{
 const f=await fixture(t),key=randomUUID(),made=await f.request('/purchase-orders',f.create(key),key);assert.equal(made.status,201,made.text);
 const before=stock(f.site.siteId),recovered=await f.request('/commands/stop',stopCreate(f,key),key);
 assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json?.data.command_receipt.outcome,'applied');
 assert.deepEqual(recovered.json?.data,made.json?.data);assert.deepEqual(stock(f.site.siteId),before);
 const changed=await f.request('/commands/stop',stopCreate(f,key,4),key);assert.equal(changed.status,409,changed.text);
 assert.equal(changed.json?.error.code,'WAREHOUSE_KEY_CONFLICT');assert.deepEqual(stock(f.site.siteId),before);
});
test('racing stop and apply produces one immutable outcome and at most one stock effect',async t=>{
 const f=await fixture(t);
 for(let n=0;n<5;n++){
  const key=randomUUID(),[apply,stop]=await Promise.all([f.request('/purchase-orders',f.create(key),key),f.request('/commands/stop',stopCreate(f,key),key)]);
  assert.equal(stop.status,200,stop.text);const outcome=stop.json?.data.command_receipt.outcome;
  assert.ok(['applied','cancelled'].includes(outcome),stop.text);
  assert.equal(apply.status,outcome==='applied'?201:409,apply.text);
  assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE idempotency_key="+quote(key)+";"),outcome==='applied'?'1':'0');
  assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),'1');
  if(outcome==='cancelled')assert.equal(apply.json?.error.code,'WAREHOUSE_REQUEST_STOPPED');
  else assert.deepEqual(apply.json?.data,stop.json?.data);
 }
});
test('an inapplicable terminal receive can be stopped without ever clearing its key for future reapplication',async t=>{
 const f=await fixture(t),key=randomUUID(),made=await f.request('/purchase-orders',f.create(key),key);assert.equal(made.status,201,made.text);
 const id=made.json?.data.purchase_order.id as string,line=made.json?.data.lines[0].id as string,receivedKey=randomUUID();
 const done=await f.request('/purchase-orders/'+id+'/receive',{idempotency_key:receivedKey},receivedKey);assert.equal(done.status,200,done.text);
 const pending=randomUUID(),command={lines:[{purchase_order_line_id:line,quantity:3}]},body={...command,idempotency_key:pending};
 const rejected=await f.request('/purchase-orders/'+id+'/receive',body,pending);assert.equal(rejected.status,409,rejected.text);
 const before=stock(f.site.siteId),stopped=await f.request('/commands/stop',{store_id:f.site.siteId,idempotency_key:pending,operation:'purchase_order.receive',target_id:id,command},pending);
 assert.equal(stopped.status,200,stopped.text);assert.equal(stopped.json?.data.command_receipt.outcome,'cancelled');
 const late=await f.request('/purchase-orders/'+id+'/receive',body,pending);assert.equal(late.status,409,late.text);
 assert.equal(late.json?.error.code,'WAREHOUSE_REQUEST_STOPPED');assert.deepEqual(stock(f.site.siteId),before);
});
test('stop validates the complete original normalized intent before writing any acknowledgement',async t=>{
 const f=await fixture(t),control=randomUUID();assert.equal((await f.request('/purchase-orders',f.create(control),control)).status,201);
 for(const fault of ['missing-notes','missing-cost','unknown-field','wrong-target']){
  const key=randomUUID(),body=stopCreate(f,key);
  const bad=JSON.parse(JSON.stringify(body)) as Record<string,unknown>,command=bad.command as Record<string,unknown>;
  if(fault==='missing-notes')delete command.notes;
  if(fault==='missing-cost')delete (command.lines as Array<Record<string,unknown>>)[0].unit_cost;
  if(fault==='unknown-field')command.extra='synthetic';
  if(fault==='wrong-target')bad.target_id=randomUUID();
  const result=await f.request('/commands/stop',bad,key);assert.equal(result.status,400,result.text);
  assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(key)+";"),'0');
 }
});

test('stop preserves live owner authority and cannot convert legacy evidence into a false cancellation',async t=>{
 const f=await fixture(t),key=randomUUID(),made=await f.request('/purchase-orders',f.create(key),key);assert.equal(made.status,201,made.text);
 const stranger=randomUUID();owned.psql("INSERT INTO users_custom(id,email,email_verified)VALUES("+quote(stranger)+","+quote('syn-wms-'+stranger+'@example.invalid')+",true);");
 const foreign=await f.requestAs(stranger,f.site.siteId,'/commands/stop',stopCreate(f,key),key);assert.ok([403,404].includes(foreign.status),foreign.text);
 owned.psql("UPDATE sites SET custom_user_id="+quote(stranger)+" WHERE id="+quote(f.site.siteId)+";");
 const revoked=await f.request('/commands/stop',stopCreate(f,key),key);assert.equal(revoked.status,403,revoked.text);
 const replacement=await f.requestAs(stranger,f.site.siteId,'/commands/stop',stopCreate(f,key),key);assert.equal(replacement.status,409,replacement.text);assert.equal(replacement.json?.error.code,'WAREHOUSE_KEY_CONFLICT');
 owned.psql("UPDATE sites SET custom_user_id="+quote(f.actor)+" WHERE id="+quote(f.site.siteId)+";");
 const legacy=randomUUID(),lines=[{product_id:f.product,quantity:3,unit_cost:12.25}];
 owned.psql("SELECT public.create_purchase_order_with_lines("+quote(f.site.siteId)+"::uuid,NULL,"+quote(f.site.locationId)+"::uuid,"+quote(JSON.stringify(lines))+"::jsonb,NULL,NULL,"+quote(f.actor)+"::uuid,"+quote(randomUUID())+","+quote(legacy)+");");
 const before=stock(f.site.siteId),denied=await f.request('/commands/stop',stopCreate(f,legacy),legacy);
 assert.equal(denied.status,409,denied.text);assert.equal(denied.json?.error.code,'WAREHOUSE_LEGACY_KEY');assert.deepEqual(stock(f.site.siteId),before);
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE idempotency_key="+quote(legacy)+";"),'0');
});

test('purchase costs preserve whole paise and reject rounding drift before any stock effect',async t=>{
 const f=await fixture(t),key=randomUUID(),body=f.create(key);
 body.lines[0].unit_cost=0.005;
 const rejected=await f.request('/purchase-orders',body,key);assert.equal(rejected.status,400,rejected.text);
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'0');
 const normalized={supplier_id:null,location_id:f.site.locationId,expected_at:null,notes:null,lines:[{...body.lines[0],variant_id:null}]};
 assert.match(owned.psqlExpectError("BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id',"+quote(f.site.siteId)+",true),set_config('app.actor_id',"+quote(f.actor)+",true);SELECT public.apply_warehouse_command_v1("+
  quote(f.site.siteId)+"::uuid,"+quote(f.actor)+"::uuid,"+quote(key)+",'purchase_order.create',NULL,"+quote(JSON.stringify(normalized))+"::jsonb,"+quote(randomUUID())+");COMMIT;"),/WAREHOUSE_INVALID/);
 for(const cost of [0.29,12.25]) {
  const acceptedKey=randomUUID(),valid=f.create(acceptedKey,3);valid.lines[0].unit_cost=cost;
  const accepted=await f.request('/purchase-orders',valid,acceptedKey);assert.equal(accepted.status,201,accepted.text);
  const id=accepted.json?.data.purchase_order.id;
  assert.equal(owned.psql("SELECT (p.subtotal=sum(l.quantity_ordered*l.unit_cost))::text FROM purchase_orders p JOIN purchase_order_lines l ON l.purchase_order_id=p.id WHERE p.id="+quote(id)+" GROUP BY p.id;"),'true');
 }
});
