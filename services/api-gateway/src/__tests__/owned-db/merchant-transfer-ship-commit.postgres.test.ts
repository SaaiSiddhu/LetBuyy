// Approved shipment commitment through the real Gateway and owned PostgreSQL.
// Synthetic internal owner assertions; normal web/native auth is a separate gate.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID}from 'node:crypto';
import {closePooledSqlClients}from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy}from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
const owned=requireOwnedDatabase();let ordinal=0;
async function fixture(t:{after(fn:()=>Promise<void>):void}){
 const site=newSyntheticTenant('transfer-ship-'+(++ordinal)),actor=randomUUID(),product=randomUUID(),destination=randomUUID(),email=`syn-transfer-ship-${actor}@example.invalid`;
 seedSyntheticTenant(owned.psql,site);owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic shipped transfer','syn-${product}',100,20,true,'active');
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${product}',NULL,'${site.locationId}',20,NULL) FROM _fixture_inventory_scope436;
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic destination','active');`);
 const proxy=await startOwnedPooledSqlProxy(owned),gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 t.after(async()=>{await gateway.settle();await closePooledSqlClients();await proxy.stop();});
 const post=async(path:string,body:Record<string,unknown>={},key=randomUUID())=>gateway.request('/v1/inventory'+path,{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({...body,idempotency_key:key})});
 const create=()=>post('/transfers',{store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:product,quantity:4}]});
 const state=()=>JSON.parse(owned.psql(`SELECT jsonb_build_object('levels',(SELECT jsonb_agg(to_jsonb(i)ORDER BY location_id)FROM inventory_levels i WHERE store_id='${site.siteId}'),'receipts',(SELECT count(*)FROM warehouse_command_receipts WHERE site_id='${site.siteId}'),'cache',(SELECT stock FROM products WHERE id='${product}'));`));
 return{site,actor,product,destination,email,gateway,post,create,state};
}
test('shipment commits the canonical hold once and partial/final destination receipts conserve stock and immutable replay',async t=>{
 const f=await fixture(t),created=await f.create();assert.equal(created.status,201,created.text);
 const data=created.json?.data,id=data.transfer.id,line=data.lines[0],rid=line.reservation_id;assert.match(rid,/^[a-f0-9-]{36}$/);
 let state=f.state();assert.equal(state.levels[0].available,20);assert.equal(state.levels[0].reserved,4);assert.equal(state.cache,16);
 const key=randomUUID(),shipped=await f.post(`/transfers/${id}/ship`,{},key);assert.equal(shipped.status,200,shipped.text);assert.equal(shipped.json?.data.lines[0].quantity_shipped,4);
 const receipt=owned.psql(`SELECT to_jsonb(r)FROM warehouse_command_receipts r WHERE idempotency_key='${key}'`);
 state=f.state();assert.equal(state.levels[0].available,16);assert.equal(state.levels[0].reserved,0);assert.equal(state.cache,16);
 const again=await f.post(`/transfers/${id}/ship`,{},key);assert.equal(again.status,200,again.text);assert.deepEqual(again.json?.data,shipped.json?.data);assert.deepEqual(f.state(),state);
 for(const quantity of [1,3]){const receiveKey=randomUUID(),body={lines:[{transfer_line_id:line.id,quantity}]},first=await f.post(`/transfers/${id}/receive`,body,receiveKey);assert.equal(first.status,200,first.text);const before=f.state(),replay=await f.post(`/transfers/${id}/receive`,body,receiveKey);assert.equal(replay.status,200,replay.text);assert.deepEqual(replay.json?.data,first.json?.data);assert.deepEqual(f.state(),before);}
 state=f.state();assert.equal(state.levels.find((x:{location_id:string})=>x.location_id===f.site.locationId).available,16);assert.equal(state.levels.find((x:{location_id:string})=>x.location_id===f.destination).available,4);assert.equal(state.levels.reduce((a:number,x:{available:number})=>a+x.available,0),20);assert(state.levels.every((x:{reserved:number})=>x.reserved===0));assert.equal(state.cache,16);assert.equal(state.receipts,4);
 assert.equal(owned.psql(`SELECT to_jsonb(r)FROM warehouse_command_receipts r WHERE idempotency_key='${key}'`),receipt);
 const historical=await f.post(`/transfers/${id}/ship`,{},key);assert.equal(historical.status,200,historical.text);assert.deepEqual(historical.json?.data,shipped.json?.data);
 assert.equal(owned.psql(`SELECT count(*)FROM inventory_events WHERE site_id='${f.site.siteId}'AND event_type='transfer_shipped'`),'1');
});
test('a warehouse hold survives ordinary reservation expiry while an aged temporary hold is released',async t=>{
 const f=await fixture(t),created=await f.create();assert.equal(created.status,201,created.text);const rid=created.json?.data.lines[0].reservation_id;
 assert.equal(owned.psql(`SELECT expires_at::text FROM inventory_reservations WHERE id='${rid}'`),'infinity');
 const control=randomUUID();owned.psql(`BEGIN;SET LOCAL app.site_id='${f.site.siteId}';SELECT reserve_inventory('${f.site.siteId}','${f.product}',NULL,'${f.site.locationId}',2,60,'syn-expiry-${control}');COMMIT;
 UPDATE inventory_reservations SET expires_at=now()-interval '1 second'WHERE idempotency_key='syn-expiry-${control}';`);
 assert.equal(owned.psql(`SELECT expire_inventory_reservations(100,'syn-transfer-expiry-control')`),'1');
 assert.equal(owned.psql(`SELECT status||'|'||expires_at::text FROM inventory_reservations WHERE id='${rid}'`),'active|infinity');
 const source=f.state().levels.find((x:{location_id:string})=>x.location_id===f.site.locationId);assert.equal(source.available,20);assert.equal(source.reserved,4);
 const shipped=await f.post(`/transfers/${created.json?.data.transfer.id}/ship`);assert.equal(shipped.status,200,shipped.text);
});
test('durable reservation reference cannot be forged or bypassed through raw application roles',async t=>{
 const f=await fixture(t),created=await f.create();assert.equal(created.status,201,created.text);const before=f.state();
 for(const role of ['anon','authenticated','app_tenant','service_role']){
  assert.equal(owned.psql(`SELECT has_table_privilege('${role}','public.inventory_transfers','INSERT,UPDATE,DELETE,TRUNCATE')OR has_table_privilege('${role}','public.inventory_transfer_lines','INSERT,UPDATE,DELETE,TRUNCATE')OR has_table_privilege('${role}','public.inventory_reservations','INSERT,UPDATE,DELETE,TRUNCATE')OR has_table_privilege('${role}','public.inventory_levels','INSERT,UPDATE,DELETE,TRUNCATE')`),'f');
 }
 assert.match(owned.psqlExpectError(`BEGIN;INSERT INTO inventory_reservations(store_id,product_id,location_id,quantity,status,expires_at,idempotency_key)VALUES('${f.site.siteId}','${f.product}','${f.site.locationId}',1,'active','infinity','syn-unbound-${randomUUID()}');COMMIT;`),/INVENTORY_TRANSFER_BINDING_REQUIRED/);
 const parent=created.json?.data.transfer.id,rid=created.json?.data.lines[0].reservation_id;
 for(const fault of [
  `UPDATE inventory_transfers SET source_location_id='${f.destination}'WHERE id='${parent}'`,
  `UPDATE inventory_transfers SET status='cancelled'WHERE id='${parent}'`,
  `UPDATE inventory_transfers SET deleted_at=now()WHERE id='${parent}'`,
  `UPDATE inventory_reservations SET status='released'WHERE id='${rid}'`,
  `UPDATE inventory_reservations SET expires_at=now()+interval '20 minutes'WHERE id='${rid}'`,
 ])assert.match(owned.psqlExpectError('BEGIN;'+fault+';COMMIT;'),/INVENTORY_TRANSFER_BINDING_INVALID/);
 assert.deepEqual(f.state(),before);
});
test('private reservation reads expose an explicitly transfer-bound lifetime instead of an invalid date',async t=>{
 const f=await fixture(t),created=await f.create();assert.equal(created.status,201,created.text);
 const read=await f.gateway.request(`/v1/inventory/reservations?store_id=${f.site.siteId}&product_id=${f.product}`,{headers:await signedIdentityHeaders(f.actor,f.email,f.site.siteId)});
 assert.equal(read.status,200,read.text);assert.equal(read.json?.data.length,1);const row=read.json?.data[0];assert.equal(row.expires_at,null);assert.equal(row.transfer?.id,created.json?.data.transfer.id);assert.equal(row.transfer?.line_id,created.json?.data.lines[0].id);assert.equal(row.transfer?.reservation_id,row.id);assert.equal(row.transfer?.site_id,f.site.siteId);assert.equal(row.transfer?.source_location_id,f.site.locationId);
});

test('variant shipment and multiline failure use the same allocator without affecting base stock',async t=>{
 const f=await fixture(t),variant=randomUUID(),empty=randomUUID();
 owned.psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty)VALUES('${variant}','${f.product}','Synthetic large','SYN-${variant}',100,5);
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${f.site.siteId}',true)) SELECT set_inventory_level_available('${f.product}','${variant}','${f.site.locationId}',5,NULL) FROM _fixture_inventory_scope436;
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${empty}','${f.site.siteId}','${f.site.siteId}','Synthetic empty','syn-${empty}',100,0,true,'active');
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${f.site.siteId}',true)) SELECT set_inventory_level_available('${empty}',NULL,'${f.site.locationId}',0,NULL) FROM _fixture_inventory_scope436;`);
 const before=f.state(),bad=await f.post('/transfers',{store_id:f.site.siteId,source_location_id:f.site.locationId,destination_location_id:f.destination,lines:[{product_id:f.product,variant_id:variant,quantity:3},{product_id:empty,quantity:1}]});
 assert.equal(bad.status,409,bad.text);assert.deepEqual(f.state(),before,'A later failed line cannot retain the first line hold, cache or receipt');
 const made=await f.post('/transfers',{store_id:f.site.siteId,source_location_id:f.site.locationId,destination_location_id:f.destination,lines:[{product_id:f.product,variant_id:variant,quantity:3}]});assert.equal(made.status,201,made.text);
 const id=made.json?.data.transfer.id,line=made.json?.data.lines[0].id;
 assert.equal(owned.psql(`SELECT inventory_qty FROM product_variants WHERE id='${variant}'`),'2');assert.equal(owned.psql(`SELECT stock FROM products WHERE id='${f.product}'`),'20');
 const shipped=await f.post(`/transfers/${id}/ship`);assert.equal(shipped.status,200,shipped.text);
 const received=await f.post(`/transfers/${id}/receive`,{lines:[{transfer_line_id:line,quantity:3}]});assert.equal(received.status,200,received.text);
 const levels=JSON.parse(owned.psql(`SELECT jsonb_agg(to_jsonb(i)ORDER BY location_id)FROM inventory_levels i WHERE product_id='${f.product}'AND variant_id='${variant}'`));
 assert.equal(levels.find((x:{location_id:string})=>x.location_id===f.site.locationId).available,2);assert.equal(levels.find((x:{location_id:string})=>x.location_id===f.destination).available,3);
 assert(levels.every((x:{reserved:number})=>x.reserved===0));assert.equal(owned.psql(`SELECT stock FROM products WHERE id='${f.product}'`),'20');
});

test('a prepared level lock makes a transfer compete with a customer hold and only one allocation can commit',async t=>{
 const f=await fixture(t),gid='syn-transfer436-'+randomUUID(),key='syn-customer436-'+randomUUID();
 owned.psql(`BEGIN;SELECT id FROM inventory_levels WHERE product_id='${f.product}'AND variant_id IS NULL FOR UPDATE;PREPARE TRANSACTION '${gid}';`);
 const transfer=f.create(),customer=owned.psqlAsync(`BEGIN;SET LOCAL app.site_id='${f.site.siteId}';SELECT reserve_inventory('${f.site.siteId}','${f.product}',NULL,'${f.site.locationId}',18,1200,'${key}');COMMIT;`).then(value=>({ok:true as const,value}),error=>({ok:false as const,error:String(error)}));
 try {
  const deadline=Date.now()+7000;let waiting=0,prepared=false;
  while(Date.now()<deadline){const observed=JSON.parse(owned.psql("SELECT jsonb_build_object('waiting',count(*),'prepared',coalesce(bool_or(0=ANY(pg_blocking_pids(pid))),false))FROM pg_stat_activity WHERE datname=current_database()AND wait_event_type='Lock'AND query~'(reserve_inventory|apply_warehouse_command_v1)'"));waiting=observed.waiting;prepared=observed.prepared;if(waiting>=2&&prepared)break;await new Promise(resolve=>setTimeout(resolve,30));}
  assert(waiting>=2&&prepared,'Both actual transactions must contend in the prepared level-lock chain: '+JSON.stringify({waiting,prepared}));
 }finally{owned.psql(`ROLLBACK PREPARED '${gid}'`);}
 const [made,held]=await Promise.all([transfer,customer]);
 assert.equal((made.status===201?1:0)+(held.ok?1:0),1,JSON.stringify({transfer:made.json,held}));
 const source=f.state().levels.find((x:{location_id:string})=>x.location_id===f.site.locationId);
 assert.equal(source.available,20);assert.equal(source.reserved,made.status===201?4:18);
 assert.equal(owned.psql(`SELECT count(*)FROM inventory_transfers WHERE site_id='${f.site.siteId}'`),made.status===201?'1':'0');
 assert.equal(f.state().receipts,made.status===201?1:0);
 if(made.status!==201)assert.equal(made.status,409,made.text);
 if(!held.ok)assert.match(held.error??'',/insufficient|deadlock|INSUFFICIENT_INVENTORY/i);
});

test('receiving into an already reserved destination records physical and free quantities accurately',async t=>{
 const f=await fixture(t);
 owned.psql(`WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${f.site.siteId}',true)) SELECT set_inventory_level_available('${f.product}',NULL,'${f.destination}',10,NULL) FROM _fixture_inventory_scope436;
 BEGIN;SET LOCAL app.site_id='${f.site.siteId}';SELECT reserve_inventory('${f.site.siteId}','${f.product}',NULL,'${f.destination}',6,1200,'syn-destination-${randomUUID()}');COMMIT;`);
 const made=await f.create();assert.equal(made.status,201,made.text);const id=made.json?.data.transfer.id,line=made.json?.data.lines[0].id;
 assert.equal((await f.post(`/transfers/${id}/ship`)).status,200);
 const receipt=await f.post(`/transfers/${id}/receive`,{lines:[{transfer_line_id:line,quantity:1}]});assert.equal(receipt.status,200,receipt.text);
 const event=JSON.parse(owned.psql(`SELECT to_jsonb(e)FROM inventory_events e WHERE source_id='${id}'AND event_type='transfer_received'`));
 assert.equal(event.on_hand_quantity,11);assert.equal(event.reserved_quantity,6);assert.equal(event.available_quantity,5,'Historical operational events must describe free stock, not raw physical stock');
 const source=f.state().levels.find((x:{location_id:string})=>x.location_id===f.site.locationId);
 assert.equal(source.available,16);assert.equal(source.on_hand_quantity,16,'The compatibility physical-stock mirror must agree with the canonical raw level');
});

test('low-stock filters and counts use free stock before paging and match the operational summary',async t=>{
 const f=await fixture(t),held=randomUUID(),plain=randomUUID();
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES
 ('${held}','${f.site.siteId}','${f.site.siteId}','Synthetic held low','syn-${held}',100,12,true,'active'),
 ('${plain}','${f.site.siteId}','${f.site.siteId}','Synthetic plain low','syn-${plain}',100,9,true,'active');
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${f.site.siteId}',true)) SELECT set_inventory_level_available('${held}',NULL,'${f.site.locationId}',12,NULL) FROM _fixture_inventory_scope436;WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${f.site.siteId}',true)) SELECT set_inventory_level_available('${plain}',NULL,'${f.site.locationId}',9,NULL) FROM _fixture_inventory_scope436;
 BEGIN;SET LOCAL app.site_id='${f.site.siteId}';SELECT reserve_inventory('${f.site.siteId}','${held}',NULL,'${f.site.locationId}',4,1200,'syn-low-${randomUUID()}');COMMIT;`);
 const headers=()=>signedIdentityHeaders(f.actor,f.email,f.site.siteId);
 for(const page of [1,2]){const read=await f.gateway.request(`/v1/inventory/levels?store_id=${f.site.siteId}&low_stock=true&limit=1&page=${page}`,{headers:await headers()});assert.equal(read.status,200,read.text);assert.equal(read.json?.meta.total,2);assert.equal(read.json?.data[0].product_id,page===1?held:plain);assert.equal(read.json?.data[0].available,page===1?8:9);}
 const summary=await f.gateway.request(`/v1/commerce-analytics/operations-summary?store_id=${f.site.siteId}`,{headers:await headers()});assert.equal(summary.status,200,summary.text);assert.equal(summary.json?.data.low_stock_sku_count,2,summary.text);
 const analytics=await f.gateway.request(`/v1/inventory/analytics?store_id=${f.site.siteId}`,{headers:await headers()});assert.equal(analytics.status,200,analytics.text);assert.equal(analytics.json?.data.low_stock_count,2,analytics.text);
});
