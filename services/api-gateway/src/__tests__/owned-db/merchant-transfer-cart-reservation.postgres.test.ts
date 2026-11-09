// Domain/canonical-kernel and public cart interaction, owned synthetic stock.
// Direct SQL kernel probes are not normal Merchant-auth or tenant-isolation proof.
import assert from 'node:assert/strict';
import test,{before,after}from 'node:test';
import {randomUUID}from 'node:crypto';
import {closePooledSqlClients}from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy}from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
import {loadCartFactSources}from '../../lib/cart-product-facts';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('transfer-cart'),actor=randomUUID(),destination=randomUUID(),email=`syn-transfer-${actor}@example.invalid`;
let gateway:Gateway,proxy:Awaited<ReturnType<typeof startOwnedPooledSqlProxy>>;
before(async()=>{
 seedSyntheticTenant(owned.psql,site);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic transfer destination','active');`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
function product(){const id=randomUUID();owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,sku,stock,is_active,status)VALUES('${id}','${site.siteId}','${site.siteId}','Synthetic transfer cart product','syn-${id}',100,'SYN-${id}',20,true,'active');
 WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT public.set_inventory_level_available('${id}',NULL,'${site.locationId}',20,NULL) FROM _fixture_inventory_scope436;`);return id;}
const state=(id:string)=>JSON.parse(owned.psql(`SELECT to_jsonb(i)FROM inventory_levels i WHERE product_id='${id}'AND location_id='${site.locationId}'`));
const reserve=(id:string,quantity:number)=>owned.psql(`BEGIN;SET LOCAL app.site_id='${site.siteId}';SELECT public.reserve_inventory('${site.siteId}','${id}',NULL,'${site.locationId}',${quantity},1200,'syn-reserve-${randomUUID()}','${actor}','synthetic-combined-reserve');COMMIT;`);
const cart=(id:string,quantity:number)=>gateway.request(`/v1/storefront/${site.subdomain}/cart`,{method:'POST',body:JSON.stringify({lines:[{product_id:id,variant_id:null,quantity,properties:{}}],coupon_codes:[]})});
async function transfer(id:string){const key=randomUUID(),r=await gateway.request('/v1/inventory/transfers',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:id,quantity:4}],idempotency_key:key})});assert.equal(r.status,201,r.text);return r.json?.data;}
test('canonical reservation positive control holds4 and allows remaining16 in the actual public cart',async()=>{
 const id=product();assert.equal((await cart(id,20)).status,201);reserve(id,4);const row=state(id);assert.equal(row.available,20);assert.equal(row.reserved,4);
 const sources=await loadCartFactSources(gateway.env,site.siteId,'syn-reserve-control',[id]);assert.equal(Number((sources.get(id)?.inventory as Array<{available:number}>)[0].available),16);
 const result=await cart(id,16);assert.equal(result.status,201,result.text);assert.equal(result.json?.data.lines[0].quantity,16);
 const denied=await cart(id,17);assert.equal(denied.status,409,denied.text);
});
test('an outbound transfer hold4 leaves the remaining16 eligible in the actual public cart',async()=>{
 const id=product();assert.equal((await cart(id,20)).status,201);await transfer(id);const before=state(id);
 const sources=await loadCartFactSources(gateway.env,site.siteId,'syn-transfer-cart',[id]);
 const available=Number((sources.get(id)?.inventory as Array<{available:number}>)[0].available);
 const result=await cart(id,16);assert.equal(result.status,201,JSON.stringify({result:result.json,available,level:{available:before.available,reserved:before.reserved}}));
 assert.equal(available,16);assert.equal(result.json?.data.lines[0].quantity,16);
 assert.equal(JSON.stringify(state(id)),JSON.stringify(before),'A cart observation creates no stock hold/effect');
});
test('an outbound transfer hold4 does not subtract it twice from the canonical reserve kernel',async()=>{
 const id=product();await transfer(id);const before=state(id);reserve(id,16);const after=state(id);
 assert.equal(after.reserved-before.reserved,16);assert.equal(after.available,before.available);
});
test('a transfer cannot consume stock already held by the canonical reservation owner',async()=>{
 const id=product();reserve(id,18);const before=state(id),key=randomUUID();
 const beforeDocs=owned.psql(`SELECT count(*)FROM inventory_transfers WHERE site_id='${site.siteId}'`),beforeReceipts=owned.psql(`SELECT count(*)FROM warehouse_command_receipts WHERE site_id='${site.siteId}'`);
 const denied=await gateway.request('/v1/inventory/transfers',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:id,quantity:4}],idempotency_key:key})});
 assert.equal(denied.status,409,denied.text);assert.equal(denied.json?.error.code,'WAREHOUSE_CONFLICT');
 assert.deepEqual(state(id),before);assert.equal(owned.psql(`SELECT count(*)FROM inventory_transfers WHERE site_id='${site.siteId}'`),beforeDocs);assert.equal(owned.psql(`SELECT count(*)FROM warehouse_command_receipts WHERE site_id='${site.siteId}'`),beforeReceipts);
});
test('the private inventory read exposes20on-hand,4reserved and16free after the canonical hold',async()=>{
 const id=product();reserve(id,4);
 const read=await gateway.request(`/v1/inventory/levels?store_id=${site.siteId}&product_id=${id}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 assert.equal(read.status,200,read.text);assert.equal(read.json?.data.length,1);const row=read.json?.data[0];
 assert.equal(row.on_hand,20,read.text);assert.equal(row.reserved,4,read.text);assert.equal(row.available,16,read.text);assert.equal(row.sellable,16,read.text);
});
test('receiving at another location cannot replace the default-fulfilment catalog cache',async()=>{
 const id=product(),key=randomUUID();
 const create=await gateway.request('/v1/inventory/purchase-orders',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({store_id:site.siteId,location_id:destination,lines:[{product_id:id,quantity:2,unit_cost:12.25}],idempotency_key:key})});assert.equal(create.status,201,create.text);
 const receiveKey=randomUUID(),received=await gateway.request(`/v1/inventory/purchase-orders/${create.json?.data.purchase_order.id}/receive`,{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Idempotency-Key':receiveKey,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({idempotency_key:receiveKey})});assert.equal(received.status,200,received.text);
 const actual=await cart(id,20);assert.equal(actual.status,201,actual.text);
 assert.equal(owned.psql(`SELECT stock FROM products WHERE id='${id}'`),'20','The existing cart selects the active default location; another-location receipt cannot replace its catalog availability cache');
});
