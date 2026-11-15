// Owned real PostgreSQL, tenant transaction and current Gateway. No provider/hosted operations.
import assert from 'node:assert/strict';
import test,{before,after}from'node:test';
import {readFileSync}from'node:fs';
import {closePooledSqlClients}from'@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}from'./gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy}from'./owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant}from'./synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('variant-retire'),foreign=newSyntheticTenant('variant-foreign');
const owner=crypto.randomUUID(),staff=crypto.randomUUID();
let gateway:Gateway,proxy:OwnedPooledSqlProxy;
const email=(id:string)=>`syn-variant-${id}@example.invalid`,q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const up=readFileSync('database/supabase/migrations/438_product_variant_retirement.sql','utf8'),down=readFileSync('database/supabase/rollback/438_product_variant_retirement.rollback.sql','utf8');
const strip=(s:string)=>s.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const down439=readFileSync('database/supabase/rollback/439_catalog_available_quantity.rollback.sql','utf8'),up439=readFileSync('database/supabase/migrations/439_catalog_available_quantity.sql','utf8'),down440=readFileSync('database/supabase/rollback/440_buyer_inventory_projection.rollback.sql','utf8'),up440=readFileSync('database/supabase/migrations/440_buyer_inventory_projection.sql','utf8');
const at438Boundary=(body:string)=>strip(down440)+strip(down439)+body;
before(async()=>{
 seedSyntheticTenant(owned.psql,site);seedSyntheticTenant(owned.psql,foreign);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email(owner)}',true),('${staff}','${email(staff)}',true);UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES('${staff}','${email(staff)}','${site.siteId}','editor','active',true,'{"granted":["products:write"]}');`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
async function headers(actor=owner,selected=site.siteId){return{...await signedIdentityHeaders(actor,email(actor),selected),'X-Store-ID':selected};}
async function product(){
 const response=await gateway.request('/v1/products',{method:'POST',headers:{...await headers(),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:site.siteId,name:'Synthetic retire '+crypto.randomUUID(),price:125,stock:0,images:[],product_options:[{name:'Size',position:0,values:['M','L']}],variants:[{title:'M',options:{Size:'M'},stock:0},{title:'L',options:{Size:'L'},stock:0}]})});
 assert.equal(response.status,201,response.text);return response.json!.data as {id:string;version:number;variants:Array<{id:string;title:string}>};
}
const version=(id:string)=>Number(owned.psql(`SELECT version FROM products WHERE id='${id}'`));
async function retire(p:Awaited<ReturnType<typeof product>>,actor=owner,key=crypto.randomUUID(),expected=version(p.id),selected=site.siteId){return gateway.request(`/v1/products/${p.id}`,{method:'PATCH',headers:{...await headers(actor,selected),'X-Idempotency-Key':key},body:JSON.stringify({version:expected,idempotency_key:key,name:'Synthetic retirement '+p.id,variants:[{id:p.variants[1].id,title:'L'}]})});}
function snap(id:string){return owned.psql(`SELECT jsonb_build_object('p',(SELECT to_jsonb(p)FROM products p WHERE id='${id}'),'v',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM product_variants v WHERE product_id='${id}'),'prices',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM product_price_observations v WHERE product_id='${id}'),'levels',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM inventory_levels v WHERE product_id='${id}'),'receipts',(SELECT jsonb_agg(to_jsonb(v)ORDER BY idempotency_key)FROM product_edit_receipts v WHERE product_id='${id}'),'audit',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM audit_activity_events v WHERE resource_id='${id}'),'outbox',(SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM outbox_events v WHERE aggregate_id='${id}'))`);}
const context=(s:string,actor=owner,tenant=site.siteId)=>`BEGIN;SET LOCAL ROLE app_tenant;SET LOCAL app.site_id='${tenant}';SET LOCAL app.actor_id='${actor}';${s};COMMIT;`;
const row=(id:string)=>JSON.parse(owned.psql(`SELECT to_jsonb(v)FROM product_variants v WHERE id='${id}'`));
const history=(id:string)=>owned.psql(`SELECT jsonb_agg(to_jsonb(v)ORDER BY id)FROM product_price_observations v WHERE product_id='${id}'`);

test('438 empty rollback/reapply retains original function identity/ACL and live data',async()=>{
 const p=await product(),v=p.variants[0].id,original=row(v),prices=history(p.id);
 const profile=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid))ORDER BY p.oid)FROM pg_proc p WHERE proname IN('apply_product_edit_v1','product_edit_snapshot_v1','create_order_with_inventory_reservations')AND pronamespace='public'::regnamespace`);
 const after=profile();owned.script(down440);owned.script(down439);owned.script(down);assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='438'"),'0');
 const old=row(v);assert.deepEqual(old,Object.fromEntries(Object.entries(original).filter(([k])=>k!=='deleted_at')));assert.equal(history(p.id),prices);
 owned.script(up);owned.script(up439);owned.script(up440);assert.equal(profile(),after);assert.deepEqual(row(v),original);assert.equal(history(p.id),prices);
});
test('438 rollback refuses unreviewed functions, grants, triggers and column dependencies atomically',()=>{
 for(const fault of ["ALTER FUNCTION product_edit_snapshot_v1(uuid)COST 101","COMMENT ON FUNCTION product_edit_snapshot_v1(uuid)IS 'Synthetic drift'","GRANT EXECUTE ON FUNCTION guard_live_variant_reference_v1()TO authenticated","ALTER TABLE product_variants DISABLE TRIGGER product_variant_retirement438","ALTER TABLE product_variants ADD COLUMN unknown_variant_field text","CREATE FUNCTION public.synthetic_variant_dependency438()RETURNS integer LANGUAGE sql AS 'SELECT 1'"]){
  assert.match(owned.psqlScriptExpectError('BEGIN;'+at438Boundary(fault+';'+strip(down))+'COMMIT;'),/rollback438 refuses catalog drift/,fault);
 }
});
test('zero stock/history variant retires effect-once and disappears from fresh owner, staff and canonical cache reads',async()=>{
 const p=await product(),v=p.variants[0].id,original=row(v),prices=history(p.id),key=crypto.randomUUID(),expected=version(p.id);
 const result=await retire(p,owner,key,expected);assert.equal(result.status,200,result.text);assert.deepEqual(result.json?.data.variants.map((x:{id:string})=>x.id),[p.variants[1].id]);
 const kept=row(v);assert.ok(kept.deleted_at);for(const[k,value]of Object.entries(original)){if(!['deleted_at','updated_at'].includes(k))assert.deepEqual(kept[k],value,k);}
 assert.equal(history(p.id),prices);assert.equal(owned.psql(`SELECT variants->0->>'id'FROM products WHERE id='${p.id}'`),p.variants[1].id);
 owned.psql(`UPDATE products SET variants='[{\"id\":\"${v}\",\"title\":\"Must not return\"}]'WHERE id='${p.id}'`);assert.equal(owned.psql(`SELECT variants->0->>'id'FROM products WHERE id='${p.id}'`),p.variants[1].id);
 const committed=snap(p.id),again=await retire(p,owner,key,expected);assert.equal(again.status,200,again.text);assert.deepEqual(again.json,result.json);assert.equal(snap(p.id),committed);
 for(const actor of[owner,staff]){const read=await gateway.request(`/v1/products/${p.id}`,{headers:await headers(actor)});assert.equal(read.status,200,read.text);assert.equal(read.json?.data.variants.some((x:{id:string})=>x.id===v),false);}
 assert.match(owned.psqlScriptExpectError('BEGIN;'+at438Boundary(strip(down))+'COMMIT;'),/rollback438 refuses retained retired variants/);assert.equal(snap(p.id),committed);
});
test('current permission, tenant and version checks precede retirement receipt recovery',async()=>{
 const p=await product(),key=crypto.randomUUID(),expected=version(p.id);assert.equal((await retire(p,staff,key,expected)).status,200);const committed=snap(p.id);
 owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}'WHERE user_id='${staff}'AND store_id='${site.siteId}'`);
 try{for(const response of[await retire(p,staff,key,expected),await retire(p,owner,crypto.randomUUID(),version(p.id),foreign.siteId),await retire(p,owner,crypto.randomUUID(),expected)]){assert.ok([403,404,409].includes(response.status),response.text);assert.equal(snap(p.id),committed);}}
 finally{owned.psql(`UPDATE employees SET permissions='{"granted":["products:write"]}'WHERE user_id='${staff}'AND store_id='${site.siteId}'`);}
 const call=`SELECT apply_product_edit_v1('${site.siteId}','${p.id}','${owner}',${version(p.id)},'${crypto.randomUUID()}','{"fields":{"name":"Synthetic forged"}}')`;
 for(const tenant of['',foreign.siteId])assert.match(owned.psqlExpectError(context(call,owner,tenant)),/PRODUCT_EDIT_FORBIDDEN/);
 assert.equal(snap(p.id),committed);
});
test('every physical, held, safety and incoming stock dimension refuses retirement without partial edits',async()=>{
 for(const field of['available','reserved','incoming','on_hand_quantity','available_quantity','committed_quantity','unavailable_quantity','incoming_quantity','reserved_quantity','safety_stock_quantity']){
  const p=await product(),v=p.variants[0].id;
  // Keep actual stock triggers/constraints active. Positive stock is real input, not a guard bypass.
  owned.psql(`UPDATE inventory_levels SET ${['reserved','reserved_quantity'].includes(field)?'available=1,reserved=1':['on_hand_quantity','available_quantity'].includes(field)?'available=1':field==='incoming_quantity'?'incoming=1':field+'=1'} WHERE variant_id='${v}'`);assert.equal(owned.psql(`SELECT ${field} FROM inventory_levels WHERE variant_id='${v}'`),'1',field);const before=snap(p.id),response=await retire(p);
  assert.equal(response.status,409,field+': '+response.text);assert.equal(response.json?.error?.code??response.json?.code,'PRODUCT_VARIANT_IN_USE');assert.equal(snap(p.id),before);
 }
});
test('retired variants reject resurrection, physical deletion, new stock, reservations and new operational references',async()=>{
 const p=await product(),v=p.variants[0].id;assert.equal((await retire(p)).status,200);const before=snap(p.id);
 for(const sql of[`UPDATE product_variants SET deleted_at=NULL WHERE id='${v}'`,`DELETE FROM product_variants WHERE id='${v}'`,`UPDATE inventory_levels SET available=1 WHERE variant_id='${v}'`,`INSERT INTO inventory_levels(product_id,variant_id,location_id,store_id)VALUES('${p.id}','${v}','${site.locationId}','${site.siteId}')`,`SELECT set_inventory_level_available('${p.id}','${v}','${site.locationId}',1,'${owner}')`,`SELECT adjust_inventory_level('${p.id}','${v}','${site.locationId}',1,'${owner}')`]){
  const directInventory=/^(UPDATE inventory_levels|INSERT INTO inventory_levels)/.test(sql);
  if(directInventory){assert.match(owned.psqlExpectError(context(sql)),/permission denied for table inventory_levels/);assert.equal(snap(p.id),before);}
  const dispatched=directInventory?`BEGIN;SET LOCAL app.site_id='${site.siteId}';SET LOCAL app.actor_id='${owner}';${sql};COMMIT;`:context(sql);
  assert.match(owned.psqlExpectError(dispatched),/PRODUCT_VARIANT_(RETIRED|HISTORY_IMMUTABLE)/,sql);assert.equal(snap(p.id),before);
 }
});
test('open purchase work refuses retirement, then terminal retained purchasing history survives retirement and cannot reopen',async()=>{
 const p=await product(),v=p.variants[0].id,po=crypto.randomUUID();owned.psql(`INSERT INTO purchase_orders(id,site_id,po_number,status,idempotency_key)VALUES('${po}','${site.siteId}','SYN-${po}','ordered','syn-${po}');INSERT INTO purchase_order_lines(site_id,purchase_order_id,product_id,variant_id,quantity_ordered,unit_cost)VALUES('${site.siteId}','${po}','${p.id}','${v}',1,1);`);
 const before=snap(p.id);const denied=await retire(p);assert.equal(denied.status,409,denied.text);assert.equal(snap(p.id),before);
 owned.psql(`UPDATE purchase_orders SET status='closed'WHERE id='${po}'`);assert.equal((await retire(p)).status,200);
 assert.equal(owned.psql(`SELECT count(*)FROM purchase_order_lines WHERE purchase_order_id='${po}'AND variant_id='${v}'`),'1');
 assert.match(owned.psqlExpectError(`UPDATE purchase_orders SET status='ordered'WHERE id='${po}'`),/PRODUCT_VARIANT_RETIRED/);
 assert.match(owned.psqlExpectError(`INSERT INTO purchase_order_lines(site_id,purchase_order_id,product_id,variant_id,quantity_ordered,unit_cost)VALUES('${site.siteId}','${po}','${p.id}','${v}',1,1)`),/PRODUCT_VARIANT_RETIRED/);
});
test('a committed concurrent stock writer blocks retirement instead of allocating or losing its stock',async()=>{
 const p=await product(),v=p.variants[0].id;
 const hold=owned.psqlAsync(`BEGIN;SET LOCAL app.site_id='${site.siteId}';SELECT set_inventory_level_available('${p.id}','${v}','${site.locationId}',1,'${owner}');SELECT pg_sleep(0.8);COMMIT;`);
 // Wait for this exact owned backend's locked row, not an arbitrary elapsed-time assumption.
 let locked=false;for(let n=0;n<100;n++){if(owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database()AND pid<>pg_backend_pid()AND query LIKE '%pg_sleep(0.8)%'AND wait_event='PgSleep')`)==='t'){locked=true;break;}await new Promise(r=>setTimeout(r,10));}assert.ok(locked);
 const response=await retire(p);await hold;assert.equal(response.status,409,response.text);assert.equal(row(v).deleted_at,null);assert.equal(owned.psql(`SELECT available FROM inventory_levels WHERE variant_id='${v}'`),'1');
});
test('terminal buyer order facts survive retirement; historical nonrestocking returns stay possible and stock cannot be revived',async()=>{
 const p=await product(),v=p.variants[0].id,order=crypto.randomUUID(),item=crypto.randomUUID(),ret=crypto.randomUUID();
 owned.psql(`INSERT INTO orders(id,site_id,store_id,order_number,customer_email,shipping_address,items,subtotal,total,status,payment_status,payment_method,financial_state,fulfillment_state)VALUES('${order}','${site.siteId}','${site.siteId}','SYN-${order}','syn-buyer-${order}@example.invalid','{}','[]',125,125,'delivered','paid','cod','paid','delivered');
 INSERT INTO order_items(id,order_id,site_id,store_id,product_id,variant_id,name,title,quantity,price,unit_price,total,fulfillment_status,fulfilled_quantity)VALUES('${item}','${order}','${site.siteId}','${site.siteId}','${p.id}','${v}','Synthetic buyer saved name','Synthetic buyer saved name',1,125,125,125,'fulfilled',1);`);
 const facts=()=>owned.psql(`SELECT jsonb_build_object('order',(SELECT to_jsonb(o)FROM orders o WHERE id='${order}'),'item',(SELECT to_jsonb(i)FROM order_items i WHERE id='${item}'))`),before=facts();
 const response=await retire(p);assert.equal(response.status,200,response.text);assert.equal(facts(),before);
 owned.psql(`INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${site.siteId}','${order}','requested','manual','syn-${ret}');
 INSERT INTO return_lines(site_id,return_id,order_id,order_item_id,product_id,variant_id,quantity,disposition,status)VALUES('${site.siteId}','${ret}','${order}','${item}','${p.id}','${v}',1,'no_restock','requested');`);
 assert.equal(owned.psql(`SELECT count(*)FROM return_lines WHERE return_id='${ret}'`),'1');const committed=snap(p.id);
 assert.match(owned.psqlExpectError(`UPDATE return_lines SET disposition='restock',restock_quantity=1,status='received'WHERE return_id='${ret}'`),/PRODUCT_VARIANT_RETIRED/);assert.equal(snap(p.id),committed);assert.equal(facts(),before);
});
