// Real public Gateway/SQL/REST -> canonical pure buyer mapper -> Liquid/Offer.
// No provider, browser or hosted acceptance is inferred from this database suite.
import assert from 'node:assert/strict';
import test,{before,after}from'node:test';
import{readFileSync}from'node:fs';
import{closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import{Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from'../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import{requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy}from'../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import{newSyntheticTenant,seedSyntheticTenant}from'../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import{mapStorefrontProduct}from'../../apps/commerce/web/src/lib/product-model';
import{productToLiquidDrop}from'../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import{toPublicProduct}from'../../services/api-gateway/src/lib/public-product-view';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('buyer-inventory'),foreign=newSyntheticTenant('buyer-foreign'),actor=crypto.randomUUID(),email=`syn-buyer-inventory-${actor}@example.invalid`;
let gateway:Gateway,restOnly:Gateway,proxy:OwnedPooledSqlProxy;
before(async()=>{for(const t of[site,foreign])seedSyntheticTenant(owned.psql,t);owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}'`);const keys=await newIdentityKeys();proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,keys,proxy.env()));restOnly=new Gateway(gatewayEnv(owned,keys));});
after(async()=>{await gateway?.settle();await restOnly?.settle();await closePooledSqlClients();await proxy?.stop();});
async function create(name:string,stock=0,variantStock:number[]=[],metadata:object={}){
 const r=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:site.siteId,name,price:125,stock,images:[],is_active:true,status:'active',metadata,...(variantStock.length?{product_options:[{name:'Code',position:0,values:variantStock.map((_,i)=>'S'+i)}],variants:variantStock.map((stock,i)=>({title:'S'+i,stock,options:{Code:'S'+i}}))}:{})})});assert.equal(r.status,201,r.text);return r.json!.data;
}
async function detail(id:string,g=gateway,subdomain=site.subdomain){return g.request('/v1/storefront/'+subdomain+'/products/'+id);}
async function browse(search:string,extra:Record<string,string>={},g=gateway){return g.request('/v1/storefront/'+site.subdomain+'/products?'+new URLSearchParams({search,limit:'20',...extra}));}
function assertProjection(row:Record<string,unknown>,expected:number|null){assert.equal(row.catalog_available_quantity,expected);const model=mapStorefrontProduct(row),drop=productToLiquidDrop(model);assert.equal(model.stock,expected);assert.equal(drop?.stock,expected);assert.equal(drop?.inventory_known,expected!==null);assert.equal(drop?.available,expected!==null&&expected>0);}
test('both public detail transports and canonical discovery provide numeric live variant quantities',async()=>{
 const p=await create('Synthetic public SKU quantity',0,[3,4]);
 for(const g of[gateway,restOnly]){const r=await detail(p.id,g);assert.equal(r.status,200,r.text);assert.equal(r.json!.data.stock,0);assertProjection(r.json!.data,7);const list=await browse('Synthetic public SKU quantity',{},g);assert.equal(list.status,200,list.text);assert.equal(list.json!.data.length,1);assertProjection(list.json!.data[0],7);}
 assert.equal(toPublicProduct({id:p.id,catalog_available_quantity:'7'}).catalog_available_quantity,7);
});
test('real canonical holds change buyer availability without rewriting base quantity or exposing private columns',async()=>{
 const p=await create('Synthetic held buyer SKU',0,[3,4]),v=p.variants[0].id;
 owned.psql(`BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);SELECT reserve_inventory('${site.siteId}','${p.id}','${v}','${site.locationId}',2,1200,'syn-buyer-hold-${p.id}','${actor}');COMMIT;`);
 const r=await detail(p.id);assert.equal(r.status,200,r.text);assertProjection(r.json!.data,5);assert.equal(r.json!.data.stock,0);
 for(const field of['cost_price','cost_per_item','created_by','updated_by','version','deleted_at'])assert.equal(Object.hasOwn(r.json!.data,field),false);
});
test('missing authoritative inventory is unknown while a real zero remains an out-of-stock value',async()=>{
 const zero=await create('Synthetic real buyer zero',0);const r=await detail(zero.id);assert.equal(r.status,200);assertProjection(r.json!.data,0);
 const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,stock,is_active,status)VALUES('${id}','${site.siteId}','Synthetic unknown buyer inventory',125,99,true,'active')`);
 const unknown=await detail(id);assert.equal(unknown.status,200,unknown.text);assert.equal(unknown.json!.data.stock,99);assertProjection(unknown.json!.data,null);const list=await browse('Synthetic unknown buyer inventory');assert.equal(list.status,200,list.text);assertProjection(list.json!.data[0],null);
});
test('retired SKU rows cannot suppress the active base witness in availability-filtered discovery',async()=>{
 const p=await create('Synthetic retired base witness',9,[0]);const first=await browse('Synthetic retired base witness',{min_price:'100'});assert.equal(first.status,200,first.text);assert.deepEqual(first.json!.data,[]);
 const key=crypto.randomUUID(),retire=await gateway.request('/v1/products/'+p.id,{method:'PATCH',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({version:p.version,idempotency_key:key,variants:[],product_options:[]})});assert.equal(retire.status,200,retire.text);
 const current=await browse('Synthetic retired base witness',{min_price:'100'});assert.equal(current.status,200,current.text);assert.equal(current.json!.data.length,1);assertProjection(current.json!.data[0],9);assert.deepEqual(current.json!.data[0].variants,[]);assert.equal(owned.psql(`SELECT count(*)FROM product_variants WHERE product_id='${p.id}'AND deleted_at IS NOT NULL`),'1');
});
test('public product reads keep store/visibility admission and cannot expose a foreign SKU under this host',async()=>{
 const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,stock,is_active,status)VALUES('${id}','${foreign.siteId}','Synthetic foreign inventory',125,13,true,'active')`);
 const wrong=await detail(id);assert.equal(wrong.status,404,wrong.text);assert.doesNotMatch(wrong.text,/Synthetic foreign|catalog_available_quantity/);
 const p=await create('Synthetic private buyer quantity',2);owned.psql(`UPDATE products SET is_active=false,status='draft'WHERE id='${p.id}'`);assert.equal((await detail(p.id)).status,404);
});
test('440 rollback preserves reader OID/grants/retained rows and prevents premature439 removal',async()=>{
 await gateway.settle();await restOnly.settle();
 const down=readFileSync('database/supabase/rollback/440_buyer_inventory_projection.rollback.sql','utf8'),up=readFileSync('database/supabase/migrations/440_buyer_inventory_projection.sql','utf8'),down439=readFileSync('database/supabase/rollback/439_catalog_available_quantity.rollback.sql','utf8');const strip=(s:string)=>s.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const data=()=>owned.psql(`SELECT jsonb_build_object(${['products','product_variants','product_options','inventory_levels','inventory_locations','inventory_reservations','product_edit_receipts','product_price_observations','outbox_events'].map(t=>`'${t}',(SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r)ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex'))FROM ${t} r)`).join(',')})::text`);
 const identity=()=>owned.psql(`SELECT jsonb_build_array(oid,proowner,proacl)::text FROM pg_proc WHERE oid='public.browse_storefront_products_v1(uuid,jsonb,uuid[])'::regprocedure`),before=data(),profile=identity();
 assert.throws(()=>owned.script(down439),/rollback439 refuses changed function profile/);
 for(const fault of["ALTER FUNCTION browse_storefront_products_v1(uuid,jsonb,uuid[])COST 101","GRANT EXECUTE ON FUNCTION browse_storefront_products_v1(uuid,jsonb,uuid[])TO anon"]){assert.match(owned.psqlScriptExpectError('BEGIN;'+fault+';'+strip(down)+'COMMIT;'),/rollback440 refuses changed reader or dependency profile/);assert.equal(data(),before);assert.equal(identity(),profile);}
 owned.script(down);assert.equal(data(),before);assert.equal(identity(),profile);assert.equal(owned.psql(`SELECT count(*)FROM migration_privilege_journal WHERE migration='440'`),'0');
 owned.script(up);assert.equal(data(),before);assert.equal(identity(),profile);assert.throws(()=>owned.script(up),/migration440 refuses unreviewed migration state/);
 const r=await browse('Synthetic public SKU quantity');assert.equal(r.status,200,r.text);assertProjection(r.json!.data[0],7);
});
