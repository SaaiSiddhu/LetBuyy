// Owned synthetic stock only. No hosted credentials, provider or external effects.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy} from './owned-db-support';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
import {prepareWarehouseCommand} from '@letbuyy/commerce-core';
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
  method:'POST',headers:{...await signedIdentityHeaders(who,`syn-wms-${who}@example.invalid`,selected),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify(body),
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
 const down=readFileSync(new URL('../../../../../database/supabase/rollback/415_atomic_warehouse_commands.rollback.sql',import.meta.url),'utf8');
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

test('the real SDK reads canonical partial PO and transfer counters from committed owned commands',async t=>{
 const f=await fixture(t),poKey=randomUUID(),made=await f.request('/purchase-orders',f.create(poKey),poKey);assert.equal(made.status,201,made.text);
 const po=made.json?.data.purchase_order.id,line=made.json?.data.lines[0].id,receiveKey=randomUUID();
 const received=await f.request('/purchase-orders/'+po+'/receive',{lines:[{purchase_order_line_id:line,quantity:2}],idempotency_key:receiveKey},receiveKey);assert.equal(received.status,200,received.text);
 const transferKey=randomUUID(),transfer=await f.request('/transfers',{store_id:f.site.siteId,source_location_id:f.site.locationId,
  destination_location_id:f.destination,lines:[{product_id:f.product,quantity:4}],idempotency_key:transferKey},transferKey);assert.equal(transfer.status,201,transfer.text);
 const id=transfer.json?.data.transfer.id,transferLine=transfer.json?.data.lines[0].id,shipKey=randomUUID(),receiveTransferKey=randomUUID();
 assert.equal((await f.request('/transfers/'+id+'/ship',{idempotency_key:shipKey},shipKey)).status,200);
 assert.equal((await f.request('/transfers/'+id+'/receive',{lines:[{transfer_line_id:transferLine,quantity:1}],idempotency_key:receiveTransferKey},receiveTransferKey)).status,200);
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',storeId:randomUUID(),
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),
  fetch:async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   assert.equal(url.hostname,'owned-gateway.example.invalid');const response=await f.gateway.request(url.pathname+url.search,init);
   return new Response(response.text,{status:response.status,headers:response.headers});}});
 const pos=await api.inventory.purchaseOrders.list({store_id:f.site.siteId}),transfers=await api.inventory.transfers.list({store_id:f.site.siteId});
 assert.equal(pos.data.length,1);assert.equal(pos.data[0].status,'partially_received');assert.equal(pos.data[0].lines[0].quantity_ordered,3);
 assert.equal(pos.data[0].lines[0].quantity_received,2);assert.equal(pos.data[0].total,36.75);assert.equal(pos.data[0].subtotal,36.75);
 assert.equal(transfers.data.length,1);assert.equal(transfers.data[0].status,'partially_received');assert.equal(transfers.data[0].lines[0].quantity_requested,4);
 assert.equal(transfers.data[0].lines[0].quantity_shipped,4);assert.equal(transfers.data[0].lines[0].quantity_received,1);
 owned.psql("INSERT INTO purchase_order_lines(site_id,purchase_order_id,product_id,quantity_ordered,unit_cost,deleted_at)VALUES("+
  quote(f.site.siteId)+","+quote(po)+","+quote(f.product)+",1,0.29,now());");
 assert.equal((await api.inventory.purchaseOrders.list({store_id:f.site.siteId})).data[0].lines.length,1,'soft-deleted lines do not enter receive forms');
 const b=await fixture(t),supplier=randomUUID();owned.psql("INSERT INTO suppliers(id,site_id,name)VALUES("+quote(supplier)+","+quote(b.site.siteId)+",'SYN_PRIVATE_FOREIGN_SUPPLIER');UPDATE purchase_orders SET supplier_id="+quote(supplier)+" WHERE id="+quote(po)+";");
 await assert.rejects(()=>api.inventory.purchaseOrders.list({store_id:f.site.siteId}),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
 owned.psql("UPDATE purchase_orders SET supplier_id=NULL WHERE id="+quote(po)+";UPDATE inventory_transfer_lines SET site_id="+quote(b.site.siteId)+" WHERE id="+quote(transferLine)+";");
 await assert.rejects(()=>api.inventory.transfers.list({store_id:f.site.siteId}),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
});

test('the actual typed SDK composes all five warehouse effects, exact replay and changed-intent refusal',async t=>{
 const f=await fixture(t);
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',storeId:randomUUID(),
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   const response=await f.gateway.request(url.pathname+url.search,init);return new Response(response.text,{status:response.status,headers:response.headers});}});
 const key=randomUUID(),body=f.create(key),created=await api.inventory.purchaseOrders.create(body);
 assert.deepEqual(await api.inventory.purchaseOrders.create(body),created);assert.equal(created.command_receipt.actor_id,f.actor);
 const po=created.command_receipt.target_id!,line=String(created.lines[0].id),receiveKey=randomUUID();
 const received=await api.inventory.purchaseOrders.receive(po,{lines:[{purchase_order_line_id:line,quantity:1}],idempotency_key:receiveKey},{storeId:f.site.siteId});
 assert.equal(received.purchase_order?.status,'partially_received');
 assert.deepEqual(await api.inventory.purchaseOrders.receive(po,{lines:[{purchase_order_line_id:line,quantity:1}],idempotency_key:receiveKey},{storeId:f.site.siteId}),received);
 await assert.rejects(()=>api.inventory.purchaseOrders.receive(po,{lines:[{purchase_order_line_id:line,quantity:2}],idempotency_key:receiveKey},{storeId:f.site.siteId}),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_KEY_CONFLICT');
 const transferKey=randomUUID(),transfer=await api.inventory.transfers.create({store_id:f.site.siteId,source_location_id:f.site.locationId,
  destination_location_id:f.destination,lines:[{product_id:f.product,quantity:4}],idempotency_key:transferKey});
 const target=transfer.command_receipt.target_id!,shipKey=randomUUID();
 const shipped=await api.inventory.transfers.ship(target,{store_id:f.site.siteId,idempotency_key:shipKey});
 assert.equal(shipped.transfer?.status,'shipped');assert.deepEqual(await api.inventory.transfers.ship(target,{store_id:f.site.siteId,idempotency_key:shipKey}),shipped);
 const transferReceiveKey=randomUUID(),transferLine=String(transfer.lines[0].id),transferBody={store_id:f.site.siteId,lines:[{transfer_line_id:transferLine,quantity:2}],idempotency_key:transferReceiveKey};
 const moved=await api.inventory.transfers.receive(target,transferBody);assert.equal(moved.transfer?.status,'partially_received');
 assert.deepEqual(await api.inventory.transfers.receive(target,transferBody),moved);
 assert.equal(owned.psql("SELECT quantity_received FROM purchase_order_lines WHERE id="+quote(line)+";"),'1');
 assert.equal(owned.psql("SELECT quantity_received FROM inventory_transfer_lines WHERE id="+quote(transferLine)+";"),'2');
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE site_id="+quote(f.site.siteId)+";"),'5');
});

test('typed SDK recovery distinguishes committed lost replies from a stopped unapplied create',async t=>{
 const f=await fixture(t);let lose=true;
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),response=await f.gateway.request(url.pathname+url.search,init);
   if(lose&&url.pathname.endsWith('/purchase-orders')&&response.status===201){lose=false;throw new Error('SYN_LOST_COMMITTED_REPLY');}
   return new Response(response.text,{status:response.status,headers:response.headers});}});
 const key=randomUUID(),body=f.create(key);await assert.rejects(()=>api.inventory.purchaseOrders.create(body));
 const recovered=await api.inventory.stopCommand({store_id:f.site.siteId,idempotency_key:key,...prepareWarehouseCommand('purchase_order.create',null,body)});
 assert.equal(recovered.command_receipt.outcome,'applied');assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'1');
 const stopKey=randomUUID(),unapplied=f.create(stopKey),stop={store_id:f.site.siteId,idempotency_key:stopKey,...prepareWarehouseCommand('purchase_order.create',null,unapplied)};
 const cancelled=await api.inventory.stopCommand(stop);assert.equal(cancelled.command_receipt.outcome,'cancelled');assert.equal(cancelled.command_receipt.target_id,null);
 assert.deepEqual(await api.inventory.stopCommand(stop),cancelled);
 await assert.rejects(()=>api.inventory.purchaseOrders.create(unapplied),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_REQUEST_STOPPED');
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'1');
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE site_id="+quote(f.site.siteId)+";"),'2');
});

test('downlevel warehouse clients are refused before effects or private receipt replay',async t=>{
 const f=await fixture(t),key=randomUUID(),body=f.create(key),positive=await f.request('/purchase-orders',body,key);assert.equal(positive.status,201,positive.text);
 const before=stock(f.site.siteId);
 const paths=['/locations','/suppliers','/purchase-orders','/purchase-orders/'+positive.json?.data.purchase_order.id+'/receive','/transfers',
  '/transfers/'+randomUUID()+'/ship','/transfers/'+randomUUID()+'/receive','/commands/stop'];
 for(const version of [null,'0','1'])for(const path of paths) {
  const headers={...await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId),
   'Idempotency-Key':key,...(version===null?{}:{'X-LetBuyy-Warehouse-Protocol':version})};
  const result=await f.gateway.request('/v1/inventory'+path,{
   method:'POST',headers,body:JSON.stringify(path==='/commands/stop'?stopCreate(f,key):body)});
  assert.equal(result.status,426,result.text);assert.equal(result.json?.error.code,'WAREHOUSE_CLIENT_UPGRADE_REQUIRED');
  assert.equal(result.json?.data,undefined);assert.deepEqual(stock(f.site.siteId),before);
 }
 const read=await f.gateway.request('/v1/inventory/purchase-orders?store_id='+f.site.siteId,{
  headers:await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId)});
 assert.equal(read.status,200,read.text);assert.equal(read.json?.data.length,1);
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE site_id="+quote(f.site.siteId)+";"),'1');
});

test('capability descriptors are private current-owner policy reads, never a grant or readiness claim',async t=>{
 const f=await fixture(t),other=await fixture(t);
 const get=async(actor:string,site:string)=>f.gateway.request('/v1/inventory/command-capabilities?store_id='+site,{
  headers:await signedIdentityHeaders(actor,'syn-wms-'+actor+'@example.invalid',site)});
 const positive=await get(f.actor,f.site.siteId);assert.equal(positive.status,200,positive.text);
 assert.equal(new Headers(positive.headers).get('Cache-Control'),'private, no-store');
 assert.deepEqual(positive.json?.data,{store_id:f.site.siteId,actor_id:f.actor,protocol_version:'2',effect_policy:'atomic_receipt_or_unavailable',stop_supported:true});
 assert.equal((await get(other.actor,f.site.siteId)).status,403);assert.equal((await get(f.actor,other.site.siteId)).status,403);
 const staff=randomUUID();owned.psql("INSERT INTO users_custom(id,email,email_verified)VALUES("+quote(staff)+","+quote('syn-wms-'+staff+'@example.invalid')+",true);INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES("+
  quote(staff)+","+quote('syn-wms-'+staff+'@example.invalid')+","+quote(f.site.siteId)+",'editor','active',true,'{\"granted\":[\"products:write\"]}');");
 assert.equal((await get(staff,f.site.siteId)).status,403);
 owned.psql("UPDATE sites SET custom_user_id="+quote(other.actor)+" WHERE id="+quote(f.site.siteId)+";");
 assert.equal((await get(f.actor,f.site.siteId)).status,403);
 const replacement=await get(other.actor,f.site.siteId);assert.equal(replacement.status,200,replacement.text);assert.equal(replacement.json?.data.actor_id,other.actor);
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE site_id="+quote(f.site.siteId)+";"),'0');
});

test('SDK missing-server preflight refuses before a real owned Gateway mutation can run',async t=>{
 const f=await fixture(t);let posts=0;
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   if(url.pathname.endsWith('/command-capabilities'))return Response.json({error:{code:'NOT_FOUND'}},{status:404});
   if(init?.method==='POST')posts++;
   const result=await f.gateway.request(url.pathname+url.search,init);return new Response(result.text,{status:result.status,headers:result.headers});}});
 await assert.rejects(()=>api.inventory.purchaseOrders.create(f.create(randomUUID())),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_SERVER_UPGRADE_REQUIRED');
 assert.equal(posts,0);assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'0');
});

test('a supported guarded protocol still fails closed when atomic execution binding is unavailable',async t=>{
 const f=await fixture(t),gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));t.after(()=>gateway.settle());
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),result=await gateway.request(url.pathname+url.search,init);
   return new Response(result.text,{status:result.status,headers:result.headers});}});
 const capabilities=await api.inventory.capabilities({store_id:f.site.siteId});assert.equal(capabilities.effect_policy,'atomic_receipt_or_unavailable');
 assert.equal('ready' in capabilities,false);
 await assert.rejects(()=>api.inventory.purchaseOrders.create(f.create(randomUUID())),e=>e instanceof LetbuyyApiError&&e.status===503);
 assert.equal(owned.psql("SELECT count(*)FROM purchase_orders WHERE site_id="+quote(f.site.siteId)+";"),'0');
 assert.equal(owned.psql("SELECT count(*)FROM warehouse_command_receipts WHERE site_id="+quote(f.site.siteId)+";"),'0');
});

for(const transfer of [false,true])test((transfer?'transfer':'purchase order')+' pages reach beyond 1000 with exact filters, stable ties and current scope',async t=>{
 const f=await fixture(t),table=transfer?'inventory_transfers':'purchase_orders',lines=transfer?'inventory_transfer_lines':'purchase_order_lines',
  parent=transfer?'transfer_id':'purchase_order_id',number=transfer?'transfer_number':'po_number',route=transfer?'transfers':'purchase-orders';
 // Synthetic read fixtures deliberately exceed PostgREST's former implicit row cap.
 const columns=transfer?'source_location_id,destination_location_id':'location_id,status,subtotal,total';
 const values=transfer?quote(f.site.locationId)+','+quote(f.destination):quote(f.site.locationId)+",'ordered',0.29,0.29";
 owned.psql("WITH headers AS(INSERT INTO "+table+"(site_id,"+number+",idempotency_key,created_at,"+columns+") SELECT "+quote(f.site.siteId)+",'SYN_PAGE_'||n,gen_random_uuid()::text,'2026-10-31T00:00:00Z',"+values+" FROM generate_series(1,1005)n RETURNING id,site_id) INSERT INTO "+lines+"(site_id,"+parent+",product_id,"+(transfer?'quantity_requested':'quantity_ordered,unit_cost')+") SELECT site_id,id,"+quote(f.product)+","+(transfer?'1':'1,0.29')+" FROM headers;");
 const get=async(query:string)=>f.gateway.request('/v1/inventory/'+route+'?store_id='+f.site.siteId+'&'+query,{headers:await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId)});
 const first=await get('page=1&limit=100&search=SYN_PAGE_&sort=oldest');assert.equal(first.status,200,first.text);
 assert.equal(first.json?.data.length,100);assert.equal(first.json?.meta.total,1005);assert.equal(first.json?.meta.total_is_exact,true);assert.equal(first.json?.meta.has_next,true);
 assert.equal(new Headers(first.headers).get('Cache-Control'),'private, no-store');
 const last=await get('page=11&limit=100&search=SYN_PAGE_&sort=oldest');assert.equal(last.status,200,last.text);
 assert.equal(last.json?.data.length,5);assert.equal(last.json?.meta.total,1005);assert.equal(last.json?.meta.has_next,false);
 const expected=JSON.parse(owned.psql("SELECT jsonb_agg(id ORDER BY id)::text FROM(SELECT id FROM "+table+" WHERE site_id="+quote(f.site.siteId)+" ORDER BY created_at,id OFFSET 1000 LIMIT 100)t;"));
 assert.deepEqual(last.json?.data.map((row:{id:string})=>row.id),expected);
 const next=await get('page=12&limit=100');assert.equal(next.status,200,next.text);assert.deepEqual(next.json?.data,[]);assert.equal(next.json?.meta.total,1005);
 const blockedCount=tapRest(owned.restUrl,async(call,forward)=>call.resource===table&&call.method==='HEAD'?
  Response.json({code:'SYN_COUNT_UNAVAILABLE'},{status:503}):forward());
 try{const unavailable=await get('page=12&limit=100');assert.equal(unavailable.status,503,unavailable.text);assert.equal(unavailable.json?.data,undefined);assert.equal(unavailable.json?.meta,undefined);}
 finally{blockedCount.restore();}

 for(const query of ['limit=101','page=0','page=1.5','sort=random','status=partial'])assert.equal((await get(query)).status,400,query);
 const filter=await get('status=received');assert.equal(filter.status,200,filter.text);assert.equal(filter.json?.meta.total,0);assert.deepEqual(filter.json?.data,[]);
 owned.psql("UPDATE "+table+" SET "+number+"='SYN%literal' WHERE id="+quote(first.json?.data[0].id)+";UPDATE "+table+" SET "+number+"='SYNxliteral' WHERE id="+quote(first.json?.data[1].id)+";UPDATE "+table+" SET deleted_at=now() WHERE id="+quote(first.json?.data[2].id)+";");
 const literal=await get('search='+encodeURIComponent('%literal'));assert.equal(literal.status,200,literal.text);assert.equal(literal.json?.meta.total,1);assert.equal(literal.json?.data[0][number],'SYN%literal');
 const remaining=await get('limit=100');assert.equal(remaining.json?.meta.total,1004);
 owned.psql("UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id="+quote(f.site.siteId)+";");
 const denied=await get('page=11&limit=100');assert.equal(denied.status,403);assert.equal(denied.json?.data,undefined);
});

for(const transfer of [false,true])test((transfer?'transfer':'PO')+' fresh SDK detail reads bind target/site and expose only current complete documents',async t=>{
 const f=await fixture(t),key=randomUUID();
 const made=transfer?await f.request('/transfers',{store_id:f.site.siteId,source_location_id:f.site.locationId,destination_location_id:f.destination,
  lines:[{product_id:f.product,quantity:4}],idempotency_key:key},key):await f.request('/purchase-orders',f.create(key,4),key);
 assert.equal(made.status,201,made.text);
 const target=made.json?.data[transfer?'transfer':'purchase_order'].id,line=made.json?.data.lines[0].id,route=transfer?'transfers':'purchase-orders';
 const api=createLetbuyyApiClient({baseUrl:'https://owned-gateway.example.invalid/v1',storeId:randomUUID(),
  getHeaders:()=>signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid'),fetch:async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(init&&'cache'in init?init.cache:undefined,'no-store');
   const result=await f.gateway.request(url.pathname+url.search,init);assert.equal(new Headers(result.headers).get('Cache-Control'),'private, no-store');
   return new Response(result.text,{status:result.status,headers:result.headers});}});
 const get=()=>transfer?api.inventory.transfers.get(target,{store_id:f.site.siteId}):api.inventory.purchaseOrders.get(target,{store_id:f.site.siteId});
 const before=await get();assert.equal(before.id,target);assert.equal(before.site_id,f.site.siteId);assert.equal(before.lines[0].quantity_received,0);
 if(transfer){const ship=randomUUID();assert.equal((await f.request('/transfers/'+target+'/ship',{idempotency_key:ship},ship)).status,200);}
 const receive=randomUUID(),received=await f.request('/'+route+'/'+target+'/receive',
  {lines:[{[transfer?'transfer_line_id':'purchase_order_line_id']:line,quantity:2}],idempotency_key:receive},receive);assert.equal(received.status,200,received.text);
 assert.equal((await get()).lines[0].quantity_received,2);assert.equal(before.lines[0].quantity_received,0);
 const ownOther=newSyntheticTenant('detail-other-'+(++fixtureOrdinal));seedSyntheticTenant(owned.psql,ownOther);
 owned.psql("UPDATE sites SET custom_user_id="+quote(f.actor)+" WHERE id="+quote(ownOther.siteId)+";");
 await assert.rejects(()=>transfer?api.inventory.transfers.get(target,{store_id:ownOther.siteId}):api.inventory.purchaseOrders.get(target,{store_id:ownOther.siteId}),e=>e instanceof LetbuyyApiError&&e.status===404);
 const endpoint='/v1/inventory/'+route+'/'+target+'?store_id='+f.site.siteId;
 const foreign=await fixture(t),denied=await f.gateway.request(endpoint,{headers:await signedIdentityHeaders(foreign.actor,'syn-wms-'+foreign.actor+'@example.invalid',f.site.siteId)});
 assert.equal(denied.status,403);assert.equal(denied.json?.data,undefined);
 for(const path of ['/v1/inventory/'+route+'/invalid?store_id='+f.site.siteId,'/v1/inventory/'+route+'/'+target])
  assert.equal((await f.gateway.request(path,{headers:await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId)})).status,400);
 owned.psql("UPDATE "+(transfer?'inventory_transfer_lines':'purchase_order_lines')+" SET site_id="+quote(ownOther.siteId)+" WHERE id="+quote(line)+";");
 await assert.rejects(get,e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_DOCUMENTS_UNVERIFIED');
 owned.psql("UPDATE "+(transfer?'inventory_transfers':'purchase_orders')+" SET deleted_at=now() WHERE id="+quote(target)+";");
 await assert.rejects(get,e=>e instanceof LetbuyyApiError&&e.status===404);
});

for(const supplier of [false,true])test((supplier?'supplier':'location')+' choices are exact bounded owner reads beyond 1000, with literal search and revoked access',async t=>{
 const f=await fixture(t),other=await fixture(t),table=supplier?'suppliers':'inventory_locations',column=supplier?'site_id':'store_id',route=supplier?'suppliers':'locations';
 owned.psql("INSERT INTO "+table+"("+column+",name,status)SELECT "+quote(f.site.siteId)+",'SYN_OPTION_'||lpad(n::text,4,'0'),'active' FROM generate_series(1,1005)n;");
 const get=async(query:string,actor=f.actor,site=f.site.siteId)=>f.gateway.request('/v1/inventory/'+route+'?store_id='+site+'&'+query,{headers:await signedIdentityHeaders(actor,'syn-wms-'+actor+'@example.invalid',site)});
 const first=await get('page=1&limit=100&search=SYN_OPTION_&status=active');assert.equal(first.status,200,first.text);
 assert.equal(first.json?.data.length,100);assert.equal(first.json?.meta.total,1005);assert.equal(first.json?.meta.total_is_exact,true);
 assert.equal(new Headers(first.headers).get('Cache-Control'),'private, no-store');
 const last=await get('page=11&limit=100&search=SYN_OPTION_&status=active');assert.equal(last.status,200,last.text);assert.equal(last.json?.data.length,5);assert.equal(last.json?.meta.has_next,false);
 const expected=JSON.parse(owned.psql("SELECT jsonb_agg(id ORDER BY name,id)::text FROM(SELECT id,name FROM "+table+" WHERE "+column+"="+quote(f.site.siteId)+" AND name LIKE 'SYN_OPTION_%' ORDER BY name,id OFFSET 1000 LIMIT 100)t;"));
 assert.deepEqual(last.json?.data.map((row:{id:string})=>row.id),expected);
 const far=await get('page=12&limit=100&search=SYN_OPTION_');assert.equal(far.status,200,far.text);assert.deepEqual(far.json?.data,[]);assert.equal(far.json?.meta.total,1005);
 const blocked=tapRest(owned.restUrl,async(call,forward)=>call.resource===table&&call.method==='HEAD'?Response.json({code:'SYN_OPTION_COUNT_FAILED'},{status:503}):forward());
 try {const result=await get('page=12&limit=100&search=SYN_OPTION_');assert.equal(result.status,503,result.text);assert.equal(result.json?.data,undefined);}finally{blocked.restore();}
 const ids=first.json?.data.map((row:{id:string})=>row.id);
 owned.psql("UPDATE "+table+" SET name='SYN%literal' WHERE id="+quote(ids[0])+";UPDATE "+table+" SET name='SYNxliteral' WHERE id="+quote(ids[1])+";UPDATE "+table+" SET status='inactive' WHERE id="+quote(ids[2])+";UPDATE "+table+" SET deleted_at=now() WHERE id="+quote(ids[3])+";");
 const literal=await get('search='+encodeURIComponent('%literal'));assert.equal(literal.status,200,literal.text);assert.equal(literal.json?.meta.total,1);assert.equal(literal.json?.data[0].name,'SYN%literal');
 const inactive=await get('search=SYN_OPTION_&status=inactive');assert.equal(inactive.json?.meta.total,1);
 const current=await get('search=SYN_OPTION_&status=active&sort=name_desc');assert.equal(current.json?.meta.total,1001);
 owned.psql("UPDATE "+table+" SET name='SYN_OPTION_TIE' WHERE id IN("+quote(ids[4])+","+quote(ids[5])+");"+(!supplier?"UPDATE inventory_locations SET is_default=true WHERE id="+quote(ids[5])+";":""));
 const tied=await get('search=SYN_OPTION_TIE&limit=1');assert.equal(tied.status,200,tied.text);assert.equal(tied.json?.meta.total,2);
 const tieFirst=owned.psql("SELECT id FROM "+table+" WHERE "+column+"="+quote(f.site.siteId)+" AND name='SYN_OPTION_TIE' ORDER BY "+(supplier?'':'is_default DESC,')+"name,id LIMIT 1;");assert.equal(tied.json?.data[0].id,tieFirst);
 const noCount=tapRest(owned.restUrl,async(call,forward)=>{const response=await forward();if(call.resource!==table||call.method!=='GET'||!response.ok)return response;const headers=new Headers(response.headers);headers.delete('Content-Range');return new Response(await response.text(),{status:response.status,headers});});
 try{const result=await get('');assert.equal(result.status,503,result.text);assert.equal(result.json?.data,undefined);}finally{noCount.restore();}

 assert.equal((await get('',other.actor)).status,403);assert.equal((await get('',f.actor,other.site.siteId)).status,403);
 const staff=randomUUID();owned.psql("INSERT INTO users_custom(id,email,email_verified)VALUES("+quote(staff)+","+quote('syn-wms-'+staff+'@example.invalid')+",true);INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES("+quote(staff)+","+quote('syn-wms-'+staff+'@example.invalid')+","+quote(f.site.siteId)+",'editor','active',true,'{\"granted\":[\"products:write\"]}');");
 assert.equal((await get('',staff)).status,403);
 const malformed=tapRest(owned.restUrl,async(call,forward)=>call.resource===table?Response.json({code:'42P01',message:'SYN_SCHEMA_UNAVAILABLE'},{status:404}):forward());
 try{const result=await get('');assert.ok(result.status>=500,result.text);assert.equal(result.json?.data,undefined);assert.ok(!result.text.includes('SYN_SCHEMA_UNAVAILABLE'));}finally{malformed.restore();}
 for(const query of ['limit=101','page=0','page=1.5','sort=random','status=deleted'])assert.equal((await get(query)).status,400,query);
 owned.psql("UPDATE sites SET custom_user_id=NULL,user_id=NULL WHERE id="+quote(f.site.siteId)+";");const denied=await get('page=11&limit=100');assert.equal(denied.status,403);assert.equal(denied.json?.data,undefined);
});

for(const transfer of [false,true])test((transfer?'transfer':'PO')+' two-variant creation and full receipt preserve every line and effect exactly once',async t=>{
 const f=await fixture(t),variants=[randomUUID(),randomUUID()],key=randomUUID();
 for(const [index,variant]of variants.entries())owned.psql("INSERT INTO product_variants(id,product_id,title,sku,price)VALUES("+quote(variant)+","+quote(f.product)+","+quote(index?'Large':'Small')+","+quote('SYN-'+variant)+",12.25);INSERT INTO inventory_levels(id,store_id,product_id,variant_id,location_id,available,reserved,incoming,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),"+quote(f.site.siteId)+","+quote(f.product)+","+quote(variant)+","+quote(f.site.locationId)+",20,0,0,20,0,20);");
 const api=createLetbuyyApiClient({baseUrl:'https://owned.synthetic.invalid/v1',storeId:f.site.siteId,fetch:async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url),headers=new Headers(request.headers);
  for(const[name,value]of Object.entries(await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId)))headers.set(name,value);
  const result=await f.gateway.request(url.pathname+url.search,{method:request.method,headers,body:request.method==='GET'?undefined:await request.text()});return new Response(result.text,{status:result.status,headers:result.headers});
 }});
 const lines=variants.map((variant,index)=>({product_id:f.product,variant_id:variant,quantity:index?3:2,...(!transfer?{unit_cost:index?12.25:0.29}:{})}));
 const input={store_id:f.site.siteId,idempotency_key:key,lines,...(transfer?{source_location_id:f.site.locationId,destination_location_id:f.destination}:{location_id:f.site.locationId})};
 const create=()=>transfer?api.inventory.transfers.create(input as Parameters<typeof api.inventory.transfers.create>[0]):api.inventory.purchaseOrders.create(input as Parameters<typeof api.inventory.purchaseOrders.create>[0]);
 const other=await fixture(t),foreign=randomUUID();owned.psql("INSERT INTO product_variants(id,product_id,title,sku)VALUES("+quote(foreign)+","+quote(other.product)+",'Foreign variant',"+quote('SYN-'+foreign)+");");
 for(const variant of [foreign,randomUUID()]){const bad=randomUUID(),before=stock(f.site.siteId);const denied=await f.request(transfer?'/transfers':'/purchase-orders',{...input,idempotency_key:bad,lines:[{...lines[0],variant_id:variant}]},bad);assert.equal(denied.status,404,denied.text);assert.deepEqual(stock(f.site.siteId),before);}
 const first=await create();assert.equal(first.lines.length,2);assert.deepEqual(first.lines.map(line=>line.variant_id).sort(),[...variants].sort());
 const before=stock(f.site.siteId),again=await create();assert.deepEqual(again,first);assert.deepEqual(stock(f.site.siteId),before);
 const target=first.command_receipt.target_id!;
 if(transfer){const shipKey=randomUUID();await api.inventory.transfers.ship(target,{store_id:f.site.siteId,idempotency_key:shipKey},{storeId:f.site.siteId});}
 const receiveKey=randomUUID(),transferReceipt={store_id:f.site.siteId,idempotency_key:receiveKey,lines:first.lines.map(line=>{assert.ok(typeof line.id==='string');return {transfer_line_id:line.id,quantity:lines.find(input=>input.variant_id===line.variant_id)!.quantity};})};
 const received=transfer?await api.inventory.transfers.receive(target,transferReceipt,{storeId:f.site.siteId}):await api.inventory.purchaseOrders.receive(target,{idempotency_key:receiveKey},{storeId:f.site.siteId});
 assert.equal(received.lines.length,2);assert.deepEqual(received.lines.map(line=>line.quantity_received).sort(),[2,3]);
 const after=stock(f.site.siteId),replay=transfer?await api.inventory.transfers.receive(target,transferReceipt,{storeId:f.site.siteId}):await api.inventory.purchaseOrders.receive(target,{idempotency_key:receiveKey},{storeId:f.site.siteId});assert.deepEqual(replay,received);assert.deepEqual(stock(f.site.siteId),after);
 if(!transfer){const detail=await api.inventory.purchaseOrders.get(target,{store_id:f.site.siteId});assert.equal(detail.subtotal,37.33);assert.equal(detail.total,37.33);}
 for(const [index,variant]of variants.entries()){
  const values=owned.psql("SELECT available||'|'||reserved||'|'||incoming FROM inventory_levels WHERE store_id="+quote(f.site.siteId)+" AND variant_id="+quote(variant)+" AND location_id="+quote(transfer?f.destination:f.site.locationId)+";");
  assert.equal(values,transfer?(index?'3|0|0':'2|0|0'):(index?'23|0|0':'22|0|0'));
 }
});

test('actual SDK location and supplier creation return canonical stored records and scoped readback',async t=>{
 const f=await fixture(t),api=createLetbuyyApiClient({baseUrl:'https://owned.synthetic.invalid/v1',storeId:f.site.siteId,fetch:async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url),headers=new Headers(request.headers);
  for(const[name,value]of Object.entries(await signedIdentityHeaders(f.actor,'syn-wms-'+f.actor+'@example.invalid',f.site.siteId)))headers.set(name,value);
  const result=await f.gateway.request(url.pathname+url.search,{method:request.method,headers,body:request.method==='GET'?undefined:await request.text()});return new Response(result.text,{status:result.status,headers:result.headers});
 }});
 const supplierAck=await api.inventory.suppliers.create({store_id:f.site.siteId,name:'Synthetic new supplier',contact_name:'Synthetic contact',email:'warehouse@example.invalid',address:{line1:'Synthetic supplier address'}},{storeId:f.site.siteId,idempotencyKey:randomUUID()});
 const supplier=supplierAck.supplier!;
 assert.equal(supplier.site_id,f.site.siteId);assert.equal(supplier.name,'Synthetic new supplier');assert.deepEqual(supplier.address,{line1:'Synthetic supplier address'});
 const locationAck=await api.inventory.locations.create({store_id:f.site.siteId,name:'Synthetic new location',address:'Synthetic road',city:'Chennai',state:'Tamil Nadu',country:'IN',pincode:'600001',is_default:false},{storeId:f.site.siteId,idempotencyKey:randomUUID()});
 const location=locationAck.location!;
 assert.equal(location.store_id,f.site.siteId);assert.deepEqual(location.address,{address:'Synthetic road',city:'Chennai',state:'Tamil Nadu',country:'IN',pincode:'600001'});
 const page=await api.inventory.locations.list({store_id:f.site.siteId,search:'Synthetic new location',status:'active'});assert.equal(page.total,1);assert.equal(page.data[0].id,location.id);assert.deepEqual(page.data[0].address,location.address);
 assert.equal(owned.psql("SELECT count(*)FROM inventory_locations WHERE store_id="+quote(f.site.siteId)+" AND name='Synthetic new location';"),'1');
});

for(const supplier of [false,true]) {
 const operation=supplier?'supplier.create':'location.create',path=supplier?'/suppliers':'/locations',table=supplier?'suppliers':'inventory_locations',entity=supplier?'supplier':'location';
 const input=(site:string,key:string)=>({store_id:site,idempotency_key:key,name:'Synthetic recoverable '+entity,
  ...(supplier?{contact_name:'Synthetic contact',address:{line1:'Synthetic road'}}:{address:'Synthetic road',city:'Chennai',state:'Tamil Nadu',country:'IN',pincode:'600001',is_default:false})});
 test(entity+' concurrent create and same-key replay commit one entity with one immutable acknowledgement',async t=>{
  const f=await fixture(t),key=randomUUID(),body=input(f.site.siteId,key);
  const results=await Promise.all([f.request(path,body,key),f.request(path,body,key)]);
  for(const result of results)assert.equal(result.status,201,result.text);
  assert.deepEqual(results[0].json?.data,results[1].json?.data);
  const data=results[0].json?.data;
  assert.equal(data.command_receipt.operation,operation);assert.equal(data[entity].created_by,f.actor);
  assert.equal(owned.psql(`SELECT count(*) FROM ${table} WHERE id='${data[entity].id}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM warehouse_command_receipts WHERE idempotency_key='${key}';`),'1');
  const conflict=await f.request(path,{...body,name:'Changed details'},key);assert.equal(conflict.status,409,conflict.text);
  const read=await f.gateway.request('/v1/inventory'+path+'?store_id='+f.site.siteId+'&search='+encodeURIComponent(body.name),{headers:await signedIdentityHeaders(f.actor,'syn@example.invalid',f.site.siteId)});
  assert.equal(read.status,200,read.text);assert.equal(read.json?.data.length,1);assert.equal(read.json?.data[0].id,data[entity].id);
 });
 test(entity+' receipt insertion fault rolls back the entity and original key recovers',async t=>{
  const f=await fixture(t),key=randomUUID(),body=input(f.site.siteId,key);
  const count=()=>owned.psql(`SELECT count(*) FROM ${table} WHERE ${supplier?'site_id':'store_id'}='${f.site.siteId}';`),before=count();
  owned.psql(`CREATE FUNCTION public.syn_metadata_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.idempotency_key='${key}' THEN RAISE EXCEPTION 'SYN_METADATA_RECEIPT_FAILURE';END IF;RETURN NEW;END$$;
  CREATE TRIGGER syn_metadata_receipt_failure BEFORE INSERT ON public.warehouse_command_receipts FOR EACH ROW EXECUTE FUNCTION public.syn_metadata_receipt_failure();`);
  try {const failed=await f.request(path,body,key);assert.ok(failed.status>=500,failed.text);assert.ok(!failed.text.includes('SYN_METADATA_RECEIPT_FAILURE'));assert.equal(count(),before);}
  finally {owned.psql('DROP TRIGGER syn_metadata_receipt_failure ON public.warehouse_command_receipts;DROP FUNCTION public.syn_metadata_receipt_failure();');}
  const recovered=await f.request(path,body,key);assert.equal(recovered.status,201,recovered.text);assert.equal(Number(count()),Number(before)+1);
 });
 test(entity+' SDK recovers a lost committed response without a duplicate and stop resolves either outcome',async t=>{
  const f=await fixture(t),key=randomUUID(),body=input(f.site.siteId,key);let lose=true;
  const api=createLetbuyyApiClient({baseUrl:'https://synthetic.invalid/v1',storeId:f.site.siteId,fetch:async(url,init)=>{
   const u=new URL(String(url)),headers={...Object.fromEntries(new Headers(init?.headers)),...await signedIdentityHeaders(f.actor,'syn@example.invalid',f.site.siteId)};
   const result=await f.gateway.request(u.pathname+u.search,{...init,headers});
   if(init?.method==='POST'&&lose&&result.status===201){lose=false;throw new Error('Synthetic lost response after commit');}
   return new Response(result.text,{status:result.status,headers:result.headers});
  }});
  const create=()=>supplier?api.inventory.suppliers.create({...body,address:{line1:'Synthetic road'}}):api.inventory.locations.create({...body,address:'Synthetic road'});
  await assert.rejects(create);const recovered=await create();assert.equal(recovered.command_receipt.outcome,'applied');
  const original=prepareWarehouseCommand(operation,null,body),stopped=await api.inventory.stopCommand({store_id:f.site.siteId,idempotency_key:key,...original});
  assert.deepEqual(stopped,recovered);
  const nextKey=randomUUID(),next=input(f.site.siteId,nextKey),intent=prepareWarehouseCommand(operation,null,next);
  const cancelled=await api.inventory.stopCommand({store_id:f.site.siteId,idempotency_key:nextKey,...intent});assert.equal(cancelled.command_receipt.outcome,'cancelled');
  const later=await f.request(path,next,nextKey);assert.equal(later.status,409,later.text);assert.equal(later.json?.error.code,'WAREHOUSE_REQUEST_STOPPED');
 });
 test(entity+' current owner and tenant checks precede private replay, including retired records',async t=>{
  const f=await fixture(t),other=await fixture(t),key=randomUUID(),body=input(f.site.siteId,key);
  const created=await f.request(path,body,key);assert.equal(created.status,201,created.text);
  const denied=await f.requestAs(other.actor,f.site.siteId,path,body,key);assert.ok(denied.status>=400);assert.equal(denied.json?.data,undefined);
  const crossSite=await other.request(path,{...input(other.site.siteId,key)},key);assert.equal(crossSite.status,409,crossSite.text);
  const id=created.json?.data[entity].id;
  owned.psql(`UPDATE ${table} SET deleted_at=now() WHERE id='${id}';`);
  const replay=await f.request(path,body,key);assert.equal(replay.status,404,replay.text);
  const intent=prepareWarehouseCommand(operation,null,body),stop=await f.request('/commands/stop',{store_id:f.site.siteId,idempotency_key:key,...intent},key);
  assert.equal(stop.status,200,stop.text);assert.equal(stop.json?.data.command_receipt.outcome,'applied');
 });
 test(entity+' raw inserts are fenced for every Data API role while canonical creation remains usable',async t=>{
  const f=await fixture(t),key=randomUUID(),body=input(f.site.siteId,key),positive=await f.request(path,body,key);assert.equal(positive.status,201,positive.text);
  for(const role of ['anon','authenticated','app_tenant','service_role']) {
   assert.equal(owned.psql(`SELECT has_table_privilege('${role}','public.${table}','INSERT');`),'f',role);
   assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE ${role};INSERT INTO public.${table}(${supplier?'site_id':'store_id'},name)VALUES('${f.site.siteId}','Synthetic bypass');COMMIT;`),/permission denied/);
  }
 });
}
