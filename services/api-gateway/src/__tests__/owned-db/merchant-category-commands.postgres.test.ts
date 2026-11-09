// Canonical owned runner only. Mounted Gateway and real database; the signed
// owner is an explicit synthetic identity fixture, not browser auth evidence.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('category-command');
const actor=randomUUID(),email=`syn-category-${actor}@example.invalid`;
const outsider=randomUUID(),outsiderEmail=`syn-category-${outsider}@example.invalid`,other=newSyntheticTenant('category-other');
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway;
const migration=(dir:string,name:string)=>readFileSync(new URL(`../../../../../database/supabase/${dir}/${name}`,import.meta.url),'utf8');
const up=()=>migration('migrations','433_product_category_commands.sql');
const down=()=>migration('rollback','433_product_category_commands.rollback.sql');
function fingerprint(){return owned.psql(`SELECT md5(jsonb_build_object(
 'functions',(SELECT jsonb_agg(pg_get_functiondef(object_oid)ORDER BY object_signature)FROM migration_privilege_journal WHERE migration='433'AND privilege='CATEGORY FUNCTION PROFILE'),
 'journal',(SELECT jsonb_agg(to_jsonb(j)ORDER BY object_signature)FROM migration_privilege_journal j WHERE migration='433'),
 'categories',(SELECT jsonb_agg(to_jsonb(c)ORDER BY id)FROM product_categories c))::text)`);}
before(async()=>{
 for(let cycle=0;cycle<2;cycle++){
  assert.equal(owned.psql("SELECT count(*)FROM migration_privilege_journal WHERE migration='433'"),'14');
  owned.script(down());assert.equal(owned.psql("SELECT to_regclass('public.product_categories')IS NULL"),'t');
  owned.script(up());
 }
 for(const drift of [
  'GRANT EXECUTE ON FUNCTION public.product_category_snapshot_v1(uuid)TO authenticated;',
  'ALTER FUNCTION public.read_product_category_v1(uuid,uuid,uuid)SET search_path=public;',
  'ALTER TABLE public.product_categories ADD COLUMN synthetic_drift text;',
  'ALTER TABLE public.products DISABLE TRIGGER products_category_label;',
  "UPDATE migration_privilege_journal SET action='revoked'WHERE migration='433'AND object_signature='public.product_categories';",
 ]){
  const before=fingerprint();assert.match(owned.psqlScriptExpectError('BEGIN;'+drift+down()),/rollback433 refuses changed/);
  assert.equal(fingerprint(),before,'Rejected rollback must preserve the original schema and provenance.');
 }
 seedSyntheticTenant(owned.psql,site);
 seedSyntheticTenant(owned.psql,other);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true),('${outsider}','${outsiderEmail}',true);
 UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}';UPDATE sites SET custom_user_id='${outsider}'WHERE id='${other.siteId}';`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
async function command(operation:'create'|'update'|'delete',changes:Record<string,unknown>,id?:string,key=randomUUID(),selected=site.siteId,who=actor){
 return gateway.request(`/v1/categories${id?`/${id}`:''}`,{method:operation==='create'?'POST':operation==='update'?'PATCH':'DELETE',
 headers:{...await signedIdentityHeaders(who,who===actor?email:outsiderEmail,selected),'X-Store-ID':selected,'X-Idempotency-Key':key},
 body:JSON.stringify({...changes,store_id:selected,idempotency_key:key})});
}
async function create(name:string,changes:Record<string,unknown>={},selected=site.siteId,who=actor){
 const result=await command('create',{name,...changes},undefined,randomUUID(),selected,who);
 assert.equal(result.status,201,JSON.stringify(result.json));return result.json!.data;
}
async function read(id:string,selected=site.siteId,who=actor){return gateway.request(`/v1/categories/${id}?store_id=${selected}`,{headers:await signedIdentityHeaders(who,who===actor?email:outsiderEmail,selected)});}
test('current owner creates one durable category with exact original-key replay',async()=>{
 const stores=await gateway.request('/v1/stores',{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 assert.equal(stores.status,200,'positive current-owner control must succeed before category admission');
 assert(stores.json?.data.some((row:{id:string})=>row.id===site.siteId));
 const key=randomUUID(),body={store_id:site.siteId,name:'Synthetic cotton products',slug:'synthetic-cotton-products',parent_id:null,is_visible:true,display_order:0,idempotency_key:key};
 const create=async()=>gateway.request('/v1/categories',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,site.siteId),'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify(body)});
 const first=await create();
 assert.equal(first.status,201,`A valid current-owner category must persist: ${JSON.stringify(first.json)}`);
 assert.equal(first.json?.data.store_id,site.siteId);assert.equal(first.json?.data.name,body.name);assert.equal(typeof first.json?.data.id,'string');
 const replay=await create();assert.equal(replay.status,201);assert.deepEqual(replay.json?.data,first.json?.data);
 assert.equal(owned.psql(`SELECT count(*)FROM product_categories WHERE store_id='${site.siteId}'AND deleted_at IS NULL;`),'1');
});
test('complete pagination and literal search preserve counts beyond the first page',async()=>{
 for(const name of ['Synthetic page alpha','Synthetic page beta','Synthetic page gamma','Synthetic page 10%_off'])await create(name);
 const page=async(n:number,search='')=>gateway.request(`/v1/categories?store_id=${site.siteId}&limit=2&page=${n}&search=${encodeURIComponent(search)}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 const first=await page(1),second=await page(2),third=await page(3),past=await page(4);
 for(const result of [first,second,third,past]){assert.equal(result.status,200,JSON.stringify(result.json));assert.equal(result.json?.meta.total,5);}
 const ids=[...first.json!.data,...second.json!.data,...third.json!.data].map(row=>row.id);
 assert.equal(new Set(ids).size,5);assert.equal(past.json!.data.length,0);
 const literal=await page(1,'%_');assert.equal(literal.status,200);assert.equal(literal.json?.meta.total,1);assert.match(literal.json!.data[0].name,/%_/);
});
test('hierarchy changes rebase descendant paths and reject cycles and cross-store parents',async()=>{
 const root=await create('Synthetic root'),child=await create('Synthetic child',{parent_id:root.id}),leaf=await create('Synthetic leaf',{parent_id:child.id});
 assert.equal(leaf.path,`${root.slug}/${child.slug}/${leaf.slug}`);
 const moved=await command('update',{version:root.version,slug:'synthetic-new-root'},root.id);
 assert.equal(moved.status,200,JSON.stringify(moved.json));
 const current=await read(child.id),currentLeaf=await read(leaf.id);
 assert.equal(current.json?.data.path,`synthetic-new-root/${child.slug}`);assert(current.json!.data.version>child.version);
 assert.equal(currentLeaf.json?.data.path,`synthetic-new-root/${child.slug}/${leaf.slug}`);
 const cycle=await command('update',{version:moved.json!.data.version,parent_id:leaf.id},root.id);assert.equal(cycle.status,400);
 const remote=await create('Synthetic other root',{},other.siteId,outsider);
 assert.equal((await command('update',{version:current.json!.data.version,parent_id:remote.id},child.id)).status,400);
 assert.equal((await command('delete',{version:moved.json!.data.version},root.id)).status,409);
 const empty=await create('Synthetic empty');const deleted=await command('delete',{version:empty.version},empty.id);
 assert.equal(deleted.status,200,JSON.stringify(deleted.json));assert(deleted.json!.data.deleted_at);assert.equal((await read(empty.id)).status,404);
});
test('rename uses the canonical product writer, with one atomic receipt and replay',async()=>{
 const category=await create('Synthetic rename source'),product=randomUUID();
 owned.psql(`INSERT INTO products(id,store_id,name,price,category,is_active)VALUES('${product}','${site.siteId}','Synthetic categorized product',99,'${category.name}',true);`);
 assert.equal((await read(category.id)).json?.data.products_count,1);
 const oldVersion=Number(owned.psql(`SELECT version FROM products WHERE id='${product}'`)),key=randomUUID();
 const payload={version:category.version,name:'Synthetic renamed cotton'};
 const renamed=await command('update',payload,category.id,key);assert.equal(renamed.status,200,JSON.stringify(renamed.json));assert.equal(renamed.json?.data.affected_products,1);
 assert.equal(owned.psql(`SELECT category FROM products WHERE id='${product}'`),payload.name);
 assert(Number(owned.psql(`SELECT version FROM products WHERE id='${product}'`))>oldVersion);
 assert.equal(owned.psql(`SELECT count(*)FROM product_edit_receipts WHERE product_id='${product}'`),'1');
 const replay=await command('update',payload,category.id,key);assert.equal(replay.status,200);assert.deepEqual(replay.json!.data,renamed.json!.data);
 assert.equal(owned.psql(`SELECT count(*)FROM product_edit_receipts WHERE product_id='${product}'`),'1');
 assert.equal((await command('delete',{version:renamed.json!.data.version},category.id)).status,409);
 assert.equal((await command('update',{...payload,name:'Synthetic conflicting intent'},category.id,key)).status,409);
 assert.equal((await command('update',{version:category.version,description:'stale edit'},category.id)).status,409);
});
test('product label observation preserves exact labels and complete product counts',async()=>{
 const label='Synthetic 100%_ cotton',product=randomUUID();
 owned.psql(`INSERT INTO products(id,store_id,name,price,category,is_active)VALUES('${product}','${site.siteId}','Synthetic observed label product',12,'${label}',false);`);
 const result=await gateway.request(`/v1/categories?store_id=${site.siteId}&search=${encodeURIComponent(label)}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 assert.equal(result.status,200);assert.equal(result.json?.meta.total,1);assert.equal(result.json!.data[0].name,label);assert.equal(result.json!.data[0].products_count,1);
 assert.equal(owned.psql(`SELECT category FROM products WHERE id='${product}'`),label);
});
test('concurrent original-key creates and competing versions have one durable effect',async()=>{
 const key=randomUUID(),body={name:'Synthetic concurrent create'};
 const pair=await Promise.all([command('create',body,undefined,key),command('create',body,undefined,key)]);
 for(const r of pair)assert.equal(r.status,201,JSON.stringify(r.json));assert.deepEqual(pair[0].json!.data,pair[1].json!.data);
 const row=pair[0].json!.data;
 const edits=await Promise.all([command('update',{version:row.version,description:'writer A'},row.id),command('update',{version:row.version,description:'writer B'},row.id)]);
 assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
 assert.equal(owned.psql(`SELECT count(*)FROM product_category_command_receipts WHERE category_id='${row.id}'`),'2');
});
test('category, product rename, audit and receipt roll back together on outbox failure',async()=>{
 const row=await create('Synthetic rollback source'),product=randomUUID(),key=randomUUID();
 owned.psql(`INSERT INTO products(id,store_id,name,price,category,is_active)VALUES('${product}','${site.siteId}','Synthetic rollback product',12,'${row.name}',true);
 CREATE FUNCTION public.synthetic_category_outbox_fault()RETURNS trigger LANGUAGE plpgsql AS $f$BEGIN
 IF NEW.event_type='category.metadata.updated'AND NEW.aggregate_id='${row.id}'THEN RAISE EXCEPTION 'synthetic category outbox unavailable';END IF;RETURN NEW;END$f$;
 CREATE TRIGGER synthetic_category_outbox_fault BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_category_outbox_fault();`);
 const before=fingerprint(),snapshot=owned.psql(`SELECT to_jsonb(p)::text FROM products p WHERE id='${product}'`);
 let failed;
 try{failed=await command('update',{version:row.version,name:'Synthetic rollback target'},row.id,key);}
 finally{owned.psql('DROP TRIGGER synthetic_category_outbox_fault ON public.outbox_events;DROP FUNCTION public.synthetic_category_outbox_fault();');}
 assert.equal(failed.status,503);assert(!JSON.stringify(failed.json).includes('synthetic category outbox'));
 assert.equal(fingerprint(),before);assert.equal(owned.psql(`SELECT to_jsonb(p)::text FROM products p WHERE id='${product}'`),snapshot);
 assert.equal(owned.psql(`SELECT count(*)FROM product_edit_receipts WHERE product_id='${product}'`),'0');
 assert.equal(owned.psql(`SELECT count(*)FROM product_category_command_receipts WHERE idempotency_key='${key}'`),'0');
 assert.equal((await command('update',{version:row.version,name:'Synthetic rollback target'},row.id,key)).status,200);
});
test('a real category read failure is unavailable and sanitized, never an invented empty page',async()=>{
 const original=owned.psql("SELECT pg_get_functiondef('public.read_product_category_page_v1(uuid,uuid,integer,integer,text)'::regprocedure)");
 owned.script(`CREATE OR REPLACE FUNCTION public.read_product_category_page_v1(p_site uuid,p_actor uuid,p_page integer,p_limit integer,p_search text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $f$BEGIN RAISE EXCEPTION 'synthetic private category SQL fault';END$f$;`);
 try{
  const result=await gateway.request(`/v1/categories?store_id=${site.siteId}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
  assert.equal(result.status,503);assert(!JSON.stringify(result.json).includes('synthetic private category SQL fault'));assert(!Object.hasOwn(result.json!,'data'));
 }finally{owned.script(original+';');}
 const recovered=await gateway.request(`/v1/categories?store_id=${site.siteId}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 assert.equal(recovered.status,200);assert(recovered.json!.meta.total>0);
});
test('positive owner control precedes direct-role, cross-store, revoked-owner and immutable-history denials',async()=>{
 const row=await create('Synthetic private record'),key=randomUUID(),payload={version:row.version,description:'Synthetic retained original'};
 assert.equal((await read(row.id)).status,200);
 const success=await command('update',payload,row.id,key);assert.equal(success.status,200);
 for(const role of ['anon','authenticated','app_tenant','service_role']){
  assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM product_categories;ROLLBACK;`),/permission denied/);
  assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM product_category_command_receipts;ROLLBACK;`),/permission denied/);
  if(role!=='app_tenant')assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE ${role};SET LOCAL app.site_id='${site.siteId}';SET LOCAL app.actor_id='${actor}';SET LOCAL request.jwt.claim.sub='${actor}';SELECT read_product_category_v1('${site.siteId}','${actor}','${row.id}');ROLLBACK;`),/permission denied|PRODUCT_CATEGORY_FORBIDDEN/);
 }
 assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE app_tenant;SELECT read_product_category_v1('${site.siteId}','${actor}','${row.id}');ROLLBACK;`),/PRODUCT_CATEGORY_FORBIDDEN/);
 assert.equal((await read(row.id,other.siteId,outsider)).status,404);
 assert.match(owned.psqlScriptExpectError(`BEGIN;SET LOCAL ROLE app_tenant;SET LOCAL app.site_id='${site.siteId}';SET LOCAL app.actor_id='${outsider}';SET LOCAL request.jwt.claim.sub='${actor}';SELECT read_product_category_v1('${site.siteId}','${actor}','${row.id}');ROLLBACK;`),/PRODUCT_CATEGORY_FORBIDDEN/);
 for(const sql of [
  `UPDATE product_category_command_receipts SET operation='update'WHERE idempotency_key='${key}';`,
  `DELETE FROM product_category_command_receipts WHERE idempotency_key='${key}';`,
  `UPDATE audit_activity_events SET action='synthetic.rewrite'WHERE resource_type='product_category'AND resource_id='${row.id}';`,
  'TRUNCATE product_category_command_receipts;',
  'TRUNCATE audit_activity_events;',
 ])assert.match(owned.psqlScriptExpectError(sql),/immutable|PRODUCT_CATEGORY_AUDIT_RETAINED/);
 owned.psql(`UPDATE sites SET custom_user_id='${outsider}'WHERE id='${site.siteId}'`);
 try{assert([403,404].includes((await command('update',payload,row.id,key)).status),'A former owner cannot replay an old successful receipt.');}
 finally{owned.psql(`UPDATE sites SET custom_user_id='${actor}'WHERE id='${site.siteId}'`);}
 const before=fingerprint();assert.match(owned.psqlScriptExpectError(down()),/rollback433 refuses retained category history/);assert.equal(fingerprint(),before);
});
