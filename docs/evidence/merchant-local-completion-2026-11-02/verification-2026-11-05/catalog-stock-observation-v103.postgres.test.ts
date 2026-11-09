// Real current Gateway + app_tenant pooled SQL, owned Postgres and PostgREST.
// No session/UI/provider injection; this suite proves API/DB creation and current permissions.
import assert from 'node:assert/strict';
import test,{before,after}from'node:test';
import {writeFileSync}from'node:fs';
import {closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy}from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('create-products'),foreign=newSyntheticTenant('create-foreign');
const owner=crypto.randomUUID(),staff=crypto.randomUUID(),reader=crypto.randomUUID();
const email=(id:string)=>`syn-product-create-${id}@example.invalid`;
let gateway:Gateway,proxy:OwnedPooledSqlProxy;
before(async()=>{
 seedSyntheticTenant(owned.psql,site);seedSyntheticTenant(owned.psql,foreign);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES${[owner,staff,reader].map(id=>`('${id}','${email(id)}',true)`).join(',')};UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';
 INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES('${staff}','${email(staff)}','${site.siteId}','editor','active',true,'{"granted":["products:write"]}'),('${reader}','${email(reader)}','${site.siteId}','viewer','active',true,'{"granted":["products:read"]}');`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
const input=()=>({store_id:site.siteId,name:'Synthetic native product '+crypto.randomUUID(),price:125,stock:0,images:[],metadata:{specifications:{Code:'M'}},product_options:[{name:'Code',position:0,values:['M']}],variants:[{title:'M',stock:0,options:{Code:'M'}}]});
async function create(body:object,key=crypto.randomUUID(),actor=owner,selected=site.siteId,signed=selected){return gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email(actor),signed),'X-Store-ID':selected,'X-Idempotency-Key':key},body:JSON.stringify(body)});}
function effects(){return JSON.parse(owned.psql(`SELECT jsonb_build_object('products',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM products t WHERE store_id='${site.siteId}'),'variants',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM product_variants t WHERE product_id IN(SELECT id FROM products WHERE store_id='${site.siteId}')),'levels',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM inventory_levels t WHERE store_id='${site.siteId}'),'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY idempotency_key),'[]')FROM product_edit_receipts t WHERE store_id='${site.siteId}'),'prices',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM product_price_observations t WHERE store_id='${site.siteId}'),'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM outbox_events t WHERE site_id='${site.siteId}'))::text`));}
test('minimal image/description-free creation inherits variant price and original replay has one effect',async()=>{
 const body=input(),key=crypto.randomUUID(),first=await create(body,key);assert.equal(first.status,201,first.text);
 const product=first.json?.data;assert.ok(product.id&&product.version);assert.deepEqual(product.images,[]);assert.equal(product.variants.length,1);assert.equal(Number(product.variants[0].price),125);assert.equal(product.variants[0].stock,0);
 const committed=effects(),replay=await create(body,key);assert.equal(replay.status,201,replay.text);assert.deepEqual(replay.json,first.json);assert.deepEqual(effects(),committed);
});
test('a real products-write staff create is admitted then its old receipt and fresh creation are denied after downgrade',async()=>{
 const body=input(),key=crypto.randomUUID(),first=await create(body,key,staff);assert.equal(first.status,201,first.text);const committed=effects();
 owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}'WHERE user_id='${staff}'AND store_id='${site.siteId}';`);
 try{for(const [next,k]of [[body,key],[input(),crypto.randomUUID()]]as const){const denied=await create(next,k,staff);assert.equal(denied.status,403,denied.text);assert.notEqual(denied.headers.get('X-Idempotent-Replay'),'true');assert.deepEqual(effects(),committed);}}
 finally{owned.psql(`UPDATE employees SET permissions='{"granted":["products:write"]}'WHERE user_id='${staff}'AND store_id='${site.siteId}';`);}
});
test('reader, foreign selected store and missing body tenant cannot create rows',async()=>{
 const committed=effects();assert.ok(committed.products.length>0,'nonempty positive control required');
 for(const response of [await create(input(),crypto.randomUUID(),reader),await create(input(),crypto.randomUUID(),owner,foreign.siteId),await create({...input(),store_id:foreign.siteId}),await create({...input(),store_id:undefined})]){assert.ok([400,403,404].includes(response.status),response.text);assert.deepEqual(effects(),committed);}
});
test('same-key changed body refuses instead of creating a second product',async()=>{
 const body=input(),key=crypto.randomUUID(),first=await create(body,key);assert.equal(first.status,201,first.text);const committed=effects();const conflict=await create({...body,price:999},key);assert.equal(conflict.status,409,conflict.text);assert.deepEqual(effects(),committed);
});
test('saved zero-stock variant retires while its UUID, canonical price and inventory history survive',async()=>{
 const first=await create(input());assert.equal(first.status,201,first.text);const p=first.json?.data,v=p.variants[0].id,before=effects(),key=crypto.randomUUID();
 const response=await gateway.request(`/v1/products/${p.id}`,{method:'PATCH',headers:{...await signedIdentityHeaders(owner,email(owner),site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({version:p.version,idempotency_key:key,variants:[],product_options:[]})});
 assert.equal(response.status,200,response.text);assert.deepEqual(response.json?.data.variants,[]);
 const after=effects();assert.ok(after.variants.find((row:{id:string;deleted_at?:string})=>row.id===v)?.deleted_at);assert.deepEqual(after.prices,before.prices);assert.deepEqual(after.levels,before.levels);
});

test('record actual parent and variant availability read contracts for inventory parity audit',async()=>{
 const body={...input(),name:'Synthetic availability observation '+crypto.randomUUID(),stock:0,variants:[{title:'M',stock:3,options:{Code:'M'}}]};const response=await create(body);assert.equal(response.status,201,response.text);const p=response.json!.data;
 const summary=await gateway.request('/v1/products?store_id='+site.siteId+'&view=summary&limit=100',{headers:await signedIdentityHeaders(owner,email(owner),site.siteId)});assert.equal(summary.status,200,summary.text);const row=summary.json!.data.find((r:{id:string})=>r.id===p.id);assert.ok(row);
 const levels=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('variant_id',variant_id,'available',available,'reserved',reserved,'free',free_quantity)ORDER BY id)FROM inventory_levels WHERE product_id='${p.id}'`));
 writeFileSync('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/inventory-parent-variant-availability-observation.json',JSON.stringify({run_id:owned.runId,parent_response_stock:p.stock,summary_stock:row.stock,summary_fields:Object.keys(row),variant_stock:p.variants.map((v:{stock:number})=>v.stock),levels,scope:'Read contract observation, not whole-feature or UI acceptance'},null,2)+'\n',{flag:'wx',mode:0o600});
});
