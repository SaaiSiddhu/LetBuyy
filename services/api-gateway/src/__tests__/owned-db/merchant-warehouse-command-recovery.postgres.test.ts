// Owned synthetic stock only. No hosted credentials, provider or external effects.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
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
 const request=async(path:string,body:unknown,key:string)=>gateway.request('/v1/inventory'+path,{
  method:'POST',headers:{...await signedIdentityHeaders(actor,`syn-wms-${actor}@example.invalid`,site.siteId),'Idempotency-Key':key},body:JSON.stringify(body),
 });
 const create=(key:string,quantity=3)=>({store_id:site.siteId,location_id:site.locationId,lines:[{product_id:product,quantity,unit_cost:12.25}],idempotency_key:key});
 return{site,actor,product,destination,gateway,request,create};
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

