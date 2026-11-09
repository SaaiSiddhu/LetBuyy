// Actual private Gateway/PostgREST/owned PostgreSQL read projections. Internal
// synthetic owner assertions are not browser/provider/device acceptance.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('warehouse-labels'),foreign=newSyntheticTenant('warehouse-labels-x');
const actor=randomUUID(),product=randomUUID(),variant=randomUUID(),destination=randomUUID(),email=`syn-warehouse-labels-${actor}@example.invalid`;
let gateway:Gateway,proxy:Awaited<ReturnType<typeof startOwnedPooledSqlProxy>>,po:string,transfer:string;
async function request(path:string,method='GET',body?:unknown){
 const key=method==='POST'?randomUUID():undefined;
 return gateway.request('/v1/inventory'+path,{method,headers:{...await signedIdentityHeaders(actor,email,site.siteId),...(key?{'Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'}:{})},...(body?{body:JSON.stringify({...body as Record<string,unknown>,idempotency_key:key})}:{})});
}
before(async()=>{
 for(const tenant of [site,foreign])seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';
 INSERT INTO products(id,store_id,site_id,name,sku,price,stock,is_active,status)VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic warehouse readable product','SYN-READABLE',129.75,20,true,'active');
 INSERT INTO product_variants(id,product_id,title,sku,price)VALUES('${variant}','${product}','Synthetic large','SYN-READABLE-L',129.75);
 INSERT INTO inventory_levels(id,store_id,product_id,variant_id,location_id,available,reserved,incoming,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),'${site.siteId}','${product}','${variant}','${site.locationId}',20,0,0,20,0,20);
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${site.siteId}','Synthetic readable destination','active');`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 const created=await request('/purchase-orders','POST',{store_id:site.siteId,location_id:site.locationId,lines:[{product_id:product,variant_id:variant,quantity:4,unit_cost:12.25}]});assert.equal(created.status,201,created.text);po=created.json?.data.purchase_order.id;
 const moved=await request('/transfers','POST',{store_id:site.siteId,source_location_id:site.locationId,destination_location_id:destination,lines:[{product_id:product,variant_id:variant,quantity:2}]});assert.equal(moved.status,201,moved.text);transfer=moved.json?.data.transfer.id;
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
const receipts=()=>owned.psql(`SELECT jsonb_agg(to_jsonb(r)ORDER BY idempotency_key)FROM warehouse_command_receipts r WHERE site_id='${site.siteId}'`);
for(const kind of ['purchase-orders','transfers']as const)test(`${kind} list/detail expose current scoped product/location names without modifying original receipts`,async()=>{
 const before=receipts(),id=kind==='purchase-orders'?po:transfer;
 for(const detail of [false,true]){
  const result=await request(`/${kind}${detail?'/'+id:''}?store_id=${site.siteId}`);assert.equal(result.status,200,result.text);
  const row=detail?result.json?.data:result.json?.data[0];assert.equal(row.id,id);assert.equal(row.lines.length,1);
  assert.equal(row.lines[0].product?.id,product);assert.equal(row.lines[0].product?.store_id,site.siteId);assert.equal(row.lines[0].product?.name,'Synthetic warehouse readable product');assert.equal(row.lines[0].product?.sku,'SYN-READABLE');assert.equal(row.lines[0].variant?.id,variant);assert.equal(row.lines[0].variant?.product_id,product);assert.equal(row.lines[0].variant?.title,'Synthetic large');assert.equal(row.lines[0].variant?.sku,'SYN-READABLE-L');
  if(kind==='purchase-orders'){assert.equal(row.location?.id,site.locationId);assert.equal(row.location?.store_id,site.siteId);assert.equal(row.location?.name,'Synthetic Default Warehouse');}
  else{assert.equal(row.source_location?.id,site.locationId);assert.equal(row.source_location?.store_id,site.siteId);assert.equal(row.destination_location?.id,destination);assert.equal(row.destination_location?.store_id,site.siteId);assert.equal(row.destination_location?.name,'Synthetic readable destination');}
 }
 assert.equal(receipts(),before,'Private read enrichment must not rewrite immutable command acknowledgements');
});

for(const kind of ['purchase-orders','transfers']as const)test(`${kind} current read refuses foreign or mismatched relation labels and preserves historical absence`,async()=>{
 const id=kind==='purchase-orders'?po:transfer,before=receipts();
 const positive=await request(`/${kind}?store_id=${site.siteId}`);assert.equal(positive.status,200,positive.text);assert.equal(positive.json?.data[0].id,id);assert.equal(positive.json?.data[0].lines[0].variant.id,variant);
 for(const detail of [false,true])for(const relation of ['product-site','product-id','variant-parent','variant-id','location-site','location-id','missing']){
  const resource=kind==='purchase-orders'?'purchase_orders':'inventory_transfers';
  const tap=tapRest(owned.restUrl,async(call,forward)=>{
   const response=await forward();if(call.resource!==resource||call.method!=='GET'||!response.ok)return response;
   const rows=await response.json();const row=Array.isArray(rows)?rows[0]:rows;assert(row);const line=row.lines[0],location=kind==='purchase-orders'?'location':'destination_location';
   if(relation==='product-site')line.product={...line.product,store_id:foreign.siteId,name:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='product-id')line.product={...line.product,id:randomUUID(),name:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='variant-parent')line.variant={...line.variant,product_id:randomUUID(),title:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='variant-id')line.variant={...line.variant,id:randomUUID(),title:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='location-site')row[location]={...row[location],store_id:foreign.siteId,name:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='location-id')row[location]={...row[location],id:randomUUID(),name:'SYN_FOREIGN_PRIVATE_LABEL'};
   if(relation==='missing'){line.product=null;line.variant=null;row[location]=null;}
   const headers=new Headers({'Content-Type':'application/json'}),range=response.headers.get('content-range');if(range)headers.set('content-range',range);
   return Response.json(rows,{status:response.status,headers});
  });
  try{const result=await request(`/${kind}${detail?'/'+id:''}?store_id=${site.siteId}`);assert.equal(result.status,relation==='missing'?200:503,result.text);
   if(relation==='missing'){const row=detail?result.json?.data:result.json?.data[0];assert.equal(row.id,id);assert.equal(row.lines[0].product,null);assert.equal(row.lines[0].variant,null);}
   else{assert.equal(result.json?.data,undefined);assert.doesNotMatch(result.text,/SYN_FOREIGN_PRIVATE_LABEL/);}
  }finally{tap.restore();}
 }
 assert.equal(receipts(),before,'Read validation and historical absence must not mutate original receipts');
});
