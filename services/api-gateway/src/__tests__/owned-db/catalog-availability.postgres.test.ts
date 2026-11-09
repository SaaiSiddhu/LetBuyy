// Real Gateway/PostgREST and invoker-RLS catalog availability; no hosted state.
import assert from 'node:assert/strict';
import test,{before,after}from'node:test';
import {readFileSync}from'node:fs';
import {closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest}from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy}from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from './synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('avail-prototype'),other=newSyntheticTenant('availability-foreign');
const actor=crypto.randomUUID(),email=`syn-availability-${actor}@example.invalid`;let gateway:Gateway,proxy:OwnedPooledSqlProxy,product:string;
before(async()=>{
 for(const t of[site,other])seedSyntheticTenant(owned.psql,t);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 const key=crypto.randomUUID(),r=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({store_id:site.siteId,name:'Synthetic variant availability',price:125,stock:0,images:[],product_options:[{name:'Code',position:0,values:['M','L']}],variants:[{title:'M',stock:3,options:{Code:'M'}},{title:'L',stock:4,options:{Code:'L'}}]})});assert.equal(r.status,201,r.text);product=r.json!.data.id;
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
async function read(params:Record<string,string>={}){const q=new URLSearchParams({select:'id,stock,catalog_available_quantity',store_id:'eq.'+site.siteId,id:'eq.'+product,...params});const env=owned.restEnv();return fetch(owned.restUrl+'/rest/v1/products?'+q,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});}
async function readRows(response:Response):Promise<Record<string,unknown>[]>{const value:unknown=await response.json();assert.ok(Array.isArray(value));return value as Record<string,unknown>[];}
test('computed field uses actual variant inventory while preserving base stock and works in PostgREST predicates/order',async()=>{
 let r=await read();for(let i=0;!r.ok&&i<30;i++){await new Promise(r=>setTimeout(r,100));r=await read();}assert.equal(r.status,200,await r.clone().text());assert.deepEqual(await r.json(),[{id:product,stock:0,catalog_available_quantity:7}]);
 for(const filter of['eq.7','gt.0']){const r=await read({catalog_available_quantity:filter,order:'catalog_available_quantity.desc,id.asc'});assert.equal(r.status,200,await r.clone().text());assert.equal((await readRows(r)).length,1);}
 const none=await read({catalog_available_quantity:'lte.0'});assert.equal(none.status,200);assert.deepEqual(await none.json(),[]);
});
test('invoker function obeys positive/wrong/unset RLS context and has no public/buyer execute grant',()=>{
 const composite=`jsonb_populate_record(NULL::public.products,'{"id":"${product}","store_id":"${site.siteId}"}'::jsonb)`;
 for(const [context,expected]of[[site.siteId,'7'],[other.siteId,'unknown'],['','unknown']]){
 owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${context}',true);DO $check$BEGIN IF coalesce(public.catalog_available_quantity(${composite})::text,'unknown') IS DISTINCT FROM '${expected}' THEN RAISE EXCEPTION 'computed read RLS result differs';END IF;END$check$;ROLLBACK;`);
 }
 assert.equal(owned.psql(`SELECT has_function_privilege('anon','public.catalog_available_quantity(public.products)','EXECUTE')OR has_function_privilege('authenticated','public.catalog_available_quantity(public.products)','EXECUTE');`),'f');
});
test('missing authoritative inventory is unknown rather than the parent cache quantity',async()=>{
 const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,price,stock)VALUES('${id}','${site.siteId}','Synthetic missing level',125,99);`);const r=await read({id:'eq.'+id});assert.equal(r.status,200);assert.deepEqual(await r.json(),[{id,stock:99,catalog_available_quantity:null}]);
});

async function list(params:Record<string,string>={},user=actor,selected=site.siteId){
 return gateway.request('/v1/products?'+new URLSearchParams({store_id:selected,view:'summary',...params}),{
  headers:{...await signedIdentityHeaders(user,user===actor?email:`syn-availability-${user}@example.invalid`,site.siteId),'X-Store-ID':selected},
 });
}
async function createProduct(name:string,stock:number,variants:{title:string;stock:number;options:Record<string,string>}[]=[]){
 const r=await gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:site.siteId,name,price:125,stock,images:[],...(variants.length?{product_options:[{name:'Code',position:0,values:variants.map(v=>v.title)}],variants}:{})})});
 assert.equal(r.status,201,r.text);return r.json!.data;
}
test('real full and summary worker projections use live SKU inventory in both supported variant modes',async()=>{
 for(const view of['summary','full'])for(const mode of['on','off']){
  const env={...gateway.env,PRODUCT_VARIANTS_RELATIONAL_READS:mode};
  // The route/environment branch is exercised through the same real worker.
  const g=new Gateway(env),r=await g.request('/v1/products?'+new URLSearchParams({store_id:site.siteId,view,search:'Synthetic variant availability'}),{headers:await signedIdentityHeaders(actor,email,site.siteId)});
  await g.settle();assert.equal(r.status,200,r.text);assert.equal(r.json!.data.length,1);assert.equal(r.json!.data[0].stock,0);assert.equal(r.json!.data[0].catalog_available_quantity,7);
 }
});
test('stock filtering, counts and tied known/unknown cursor pages match the complete scoped population',async()=>{
 const prefix='Synthetic availability matrix ';const known:{id:string;quantity:number}[]=[];
 for(const [suffix,stock]of[['zero',0],['twoA',2],['twoB',2],['seven',7]]as const){const p=await createProduct(prefix+suffix,stock);known.push({id:p.id as string,quantity:stock});}
 const unknown=[crypto.randomUUID(),crypto.randomUUID()];
 owned.psql(`INSERT INTO products(id,store_id,name,price,stock)VALUES${unknown.map((id,i)=>`('${id}','${site.siteId}','${prefix}unknown${i}',125,99)`).join(',')};`);
 const low=await list({search:prefix,stock_filter:'low_stock',withCount:'true',limit:'1',sort:'stock'});assert.equal(low.status,200,low.text);assert.equal(low.json!.meta.total,2);assert.equal(low.json!.data[0].catalog_available_quantity,2);
 const far=await list({search:prefix,stock_filter:'low_stock',withCount:'true',page:'99'});assert.equal(far.status,200,far.text);assert.deepEqual(far.json!.data,[]);assert.equal(far.json!.meta.total,2);
 const zero=await list({search:prefix,stock_filter:'out_of_stock',withCount:'true'});assert.equal(zero.status,200,zero.text);assert.equal(zero.json!.meta.total,1);assert.equal(zero.json!.data[0].id,known[0].id);
 for(const order of['asc','desc']){
  const expected:string[]=[...known].sort((a,b)=>(a.quantity-b.quantity||a.id.localeCompare(b.id))*(order==='asc'?1:-1)).map(p=>p.id).concat([...unknown].sort((a,b)=>a.localeCompare(b)*(order==='asc'?1:-1)));
  const observed:string[]=[];let cursor:string|undefined;
  for(let page=0;page<10;page++){
   const r=await list({search:prefix,sort:'stock',order,limit:'1',...(cursor?{cursor}:{})});assert.equal(r.status,200,r.text);observed.push(...r.json!.data.map((p:{id:string})=>p.id));cursor=r.json!.meta.next_cursor??undefined;if(!cursor)break;
  }
  assert.deepEqual(observed,expected,'all equal-quantity and unknown rows must appear exactly once');
 }
 const invalid=await list({sort:'stock',cursor:btoa(JSON.stringify({id:known[0].id,value:'untrusted-stock'}))});assert.equal(invalid.status,400,invalid.text);
});
test('canonical reservations reduce free SKU stock without counting the parent or other locations',async()=>{
 const p=await createProduct('Synthetic held variant inventory',11,[{title:'M',stock:3,options:{Code:'M'}},{title:'L',stock:4,options:{Code:'L'}}]),variant=p.variants.find((v:{title:string})=>v.title==='M').id;
 owned.psql(`BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);SELECT reserve_inventory('${site.siteId}','${p.id}','${variant}','${site.locationId}',2,1200,'syn-catalog-hold-${p.id}','${actor}');COMMIT;`);
 const location=crypto.randomUUID();owned.psql(`INSERT INTO inventory_locations(id,store_id,name,status,is_default)VALUES('${location}','${site.siteId}','Synthetic extra warehouse','active',false);INSERT INTO inventory_levels(store_id,product_id,variant_id,location_id,available,reserved)VALUES('${site.siteId}','${p.id}','${variant}','${location}',999,0);`);
 const r=await list({search:'Synthetic held variant inventory'});assert.equal(r.status,200,r.text);assert.equal(r.json!.data[0].stock,11);assert.equal(r.json!.data[0].catalog_available_quantity,5);
 assert.equal(owned.psql(`SELECT reserved FROM inventory_levels WHERE product_id='${p.id}'AND variant_id='${variant}'AND location_id='${site.locationId}'`),'2');
});
test('retiring the last zero-stock SKU exposes the unchanged base quantity and retains its history',async()=>{
 const p=await createProduct('Synthetic retired SKU base inventory',9,[{title:'M',stock:0,options:{Code:'M'}}]);
 const before=await list({search:'Synthetic retired SKU base inventory'});assert.equal(before.status,200);assert.equal(before.json!.data[0].catalog_available_quantity,0);
 const key=crypto.randomUUID(),r=await gateway.request('/v1/products/'+p.id,{method:'PATCH',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'X-Store-ID':site.siteId,'X-Idempotency-Key':key},body:JSON.stringify({version:p.version,idempotency_key:key,variants:[],product_options:[]})});assert.equal(r.status,200,r.text);
 const after=await list({search:'Synthetic retired SKU base inventory'});assert.equal(after.status,200);assert.equal(after.json!.data[0].stock,9);assert.equal(after.json!.data[0].catalog_available_quantity,9);
 assert.equal(owned.psql(`SELECT count(*) FROM product_variants WHERE id='${p.variants[0].id}'AND deleted_at IS NOT NULL`),'1');
});
test('live staff permission, bound tenant and missing projection failures remain fail closed and sanitized',async()=>{
 const staff=crypto.randomUUID();owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${staff}','syn-availability-${staff}@example.invalid',true);INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES('${staff}','syn-availability-${staff}@example.invalid','${site.siteId}','viewer','active',true,'{"granted":["products:read"]}');`);
 const positive=await list({},staff);assert.equal(positive.status,200,positive.text);assert.ok(positive.json!.data.some((p:{id:string;catalog_available_quantity:number})=>p.id===product&&p.catalog_available_quantity===7));
 owned.psql(`UPDATE employees SET permissions='{"granted":[]}'WHERE user_id='${staff}'AND store_id='${site.siteId}'`);assert.equal((await list({},staff)).status,403);assert.ok([403,404].includes((await list({},actor,other.siteId)).status));
 let attempted=0;const tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='products'){attempted++;return Response.json({code:'42703',message:'column catalog_available_quantity does not exist; synthetic private fault'},{status:500});}return forward();});
 try{const r=await list();assert.equal(r.status,503,r.text);assert.equal(r.json!.error.code,'PRODUCTS_UNAVAILABLE');assert.doesNotMatch(r.text,/42703|does not exist|private fault/);assert.equal(attempted,1,'the required read field must never be silently omitted');}finally{tap.restore();}
});
test('the largest admitted SKU matrix has a bounded current read and oversized legacy matrices stay unknown',async()=>{
 const variants=Array.from({length:100},(_,i)=>({title:'S'+i,stock:1,options:{Code:'S'+i}}));
 const p=await createProduct('Synthetic maximum availability matrix',0,variants);
 const r=await list({search:'Synthetic maximum availability matrix'});assert.equal(r.status,200,r.text);assert.equal(r.json!.data[0].catalog_available_quantity,100);assert.equal(r.json!.data[0].stock,0);
 const plans=JSON.parse(owned.psql(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)SELECT catalog_available_quantity(p)FROM products p WHERE id='${p.id}'`))as Array<{'Execution Time':number}>;
 assert.ok(Number.isFinite(plans[0]['Execution Time'])&&plans[0]['Execution Time']<2500,'a single admitted matrix must complete within the local read budget');
 console.info('OWNED_CATALOG_AVAILABILITY_PROFILE '+JSON.stringify({active_skus:100,sql_execution_ms:plans[0]['Execution Time'],scope:'Owned Postgres lab, one maximum-size product; not hosted or whole-catalog performance'}));
 owned.psql(`INSERT INTO product_variants(product_id,title,price,inventory_qty)VALUES('${p.id}','Synthetic oversized legacy row',125,1);`);
 const unknown=await list({search:'Synthetic maximum availability matrix'});assert.equal(unknown.status,200,unknown.text);assert.equal(unknown.json!.data[0].catalog_available_quantity,null);
});
test('guarded439 down and forward preserve retained rows and refuse changed function authority',async()=>{
 const down=readFileSync(new URL('../../../../../database/supabase/rollback/439_catalog_available_quantity.rollback.sql',import.meta.url),'utf8'),forward=readFileSync(new URL('../../../../../database/supabase/migrations/439_catalog_available_quantity.sql',import.meta.url),'utf8');
 const down440=readFileSync(new URL('../../../../../database/supabase/rollback/440_buyer_inventory_projection.rollback.sql',import.meta.url),'utf8'),up440=readFileSync(new URL('../../../../../database/supabase/migrations/440_buyer_inventory_projection.sql',import.meta.url),'utf8');
 const retained=()=>owned.psql(`SELECT jsonb_build_object(${['products','product_variants','inventory_levels','inventory_locations','inventory_reservations','inventory_adjustments','inventory_events','product_edit_receipts','product_price_observations','outbox_events'].map(table=>`'${table}',(SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text,'UTF8')),'hex'))FROM public.${table} t)`).join(',')})::text`);
 await gateway.settle();
 assert.throws(()=>owned.psql(down),/rollback439 refuses changed function profile/,'Dependent440 must unwind first');owned.psql(down440);
 const before=retained(),comment=owned.psql(`SELECT obj_description('public.catalog_available_quantity(public.products)'::regprocedure,'pg_proc')`);
 owned.psql(`COMMENT ON FUNCTION public.catalog_available_quantity(public.products)IS 'Synthetic unreviewed drift'`);assert.throws(()=>owned.psql(down),/rollback439 refuses changed function profile/);assert.equal(retained(),before);
 owned.psql(`COMMENT ON FUNCTION public.catalog_available_quantity(public.products)IS '${comment.replaceAll("'","''")}'`);
 owned.psql(`GRANT EXECUTE ON FUNCTION public.catalog_available_quantity(public.products)TO anon`);assert.throws(()=>owned.psql(down),/rollback439 refuses changed function profile/);owned.psql(`REVOKE EXECUTE ON FUNCTION public.catalog_available_quantity(public.products)FROM anon`);
 owned.psql(down);assert.equal(owned.psql(`SELECT to_regprocedure('public.catalog_available_quantity(public.products)')IS NULL`),'t');assert.equal(retained(),before);
 owned.psql(forward);owned.psql(up440);assert.equal(retained(),before);const r=await read();assert.equal(r.status,200,await r.clone().text());assert.equal((await readRows(r))[0].catalog_available_quantity,7);
 assert.throws(()=>owned.psql(forward),/migration439 refuses an existing unreviewed projection/);assert.equal(retained(),before);
});
