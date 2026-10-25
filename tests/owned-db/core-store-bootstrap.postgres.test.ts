import {readFileSync} from 'node:fs';
// Real canonical Gateway and owned PostgreSQL; only synthetic verified account credentials.
// No theme/package, storefront, editor release, product or buyer is seeded by this suite.
import assert from 'node:assert/strict';
import test, {before,after} from 'node:test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
let proxy:OwnedPooledSqlProxy;
before(async()=>{proxy=await startOwnedPooledSqlProxy(owned);});
after(async()=>{await closePooledSqlClients();await proxy?.stop();});
async function fixture(){
 const id=crypto.randomUUID(),email=`syn-core-bootstrap-${id}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${id}','${email}',true);`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 return {id,email,gateway,create:async(theme:string|null='letbuyy-core',key=crypto.randomUUID())=>{
  const slug='syn-core-'+crypto.randomUUID().slice(0,8);
  const body={name:'Synthetic Core Store',subdomain:slug,site_type:'store',...(theme?{theme_id:theme}:{}),template_config:{survey:{industry:'food'}}};
  const headers=await signedIdentityHeaders(id,email);
  const request=()=>gateway.request('/v1/stores',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify(body)});
  // Identity headers are short lived and carry unique request JTIs; generate on each replay.
  return {slug,body,key,response:await request(),replay:async()=>gateway.request('/v1/stores',{method:'POST',headers:{...await signedIdentityHeaders(id,email),'Content-Type':'application/json','X-Idempotency-Key':key},body:JSON.stringify(body)})};
 }};
}
test('explicit Core web creation stores a validated Liquid document and replays without new rows',async()=>{
 const f=await fixture();try{
 const r=await f.create();assert.equal(r.response.status,201);
 const siteId=String(r.response.json?.data?.id);assert.match(siteId,/^[a-f0-9-]{36}$/);
 const config=JSON.parse(owned.psql(`SELECT template_config::text FROM sites WHERE id='${siteId}';`));
 assert.equal(config.liquidBundle?.package?.slug,'letbuyy-core-liquid','the new store must use the actual catalog Liquid package');
 assert.equal(Object.keys(config.liquidBundle.config.settings_data.presets).length,10);
 assert.equal(config.liquidBundle.templates.header.sections['announcement-default'].settings.text,'Discover our latest products.');
 assert.doesNotMatch(JSON.stringify(config),/Free shipping on fresh drops this week\./);
 assert.equal(config.survey.industry,'food');assert.equal(config.themeId,'letbuyy-core');
 assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${siteId}';`),'draft');
 const replay=await r.replay();assert.equal(replay.status,201);assert.equal(replay.json?.data?.id,siteId);
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'1');
 const legacy=await f.create('modern');assert.equal(legacy.response.status,201,'explicit older-client theme inputs remain supported');
 assert.equal(owned.psql(`SELECT theme_id FROM sites WHERE id='${legacy.response.json?.data?.id}';`),'modern');
 }finally{await f.gateway.settle();}
});
test('unavailable or invalid Core catalog fails before creating a store and can recover',async()=>{
 const f=await fixture();const original=owned.psql("SELECT default_template::text FROM themes WHERE slug='letbuyy-core';");
 try{
 owned.psql("UPDATE themes SET is_active=false WHERE slug='letbuyy-core';");
 const missing=await f.create();assert.equal(missing.response.status,503,'catalog unavailability is not a successful blank store');
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'0');
 owned.psql("UPDATE themes SET is_active=true,default_template='{}'::jsonb WHERE slug='letbuyy-core';");
 const invalid=await f.create();assert.equal(invalid.response.status,503,'malformed canonical Core cannot fall back to portable-only content');
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'0');
 owned.script(`UPDATE themes SET default_template='${original.replace(/'/g,"''")}'::jsonb WHERE slug='letbuyy-core';`);
 const recovered=await f.create();assert.equal(recovered.response.status,201);
 }finally{owned.script(`UPDATE themes SET is_active=true,default_template='${original.replace(/'/g,"''")}'::jsonb WHERE slug='letbuyy-core';`);await f.gateway.settle();}
});
test('publication visibility commits with its release; failures and private access remain protected',async()=>{
 const f=await fixture();const made=await f.create();assert.equal(made.response.status,201);const siteId=String(made.response.json?.data?.id);
 const publish=(live:boolean)=>owned.psql(`SELECT release_id FROM public.publish_theme_release(p_store_id:='${siteId}'::uuid,p_theme_id:='letbuyy-core',p_release_config:=(SELECT template_config FROM sites WHERE id='${siteId}'),p_published_by:='${f.id}'::uuid,p_make_store_live:=${live});`);
 try{
 assert.equal(owned.psql(`SELECT status||'|'||published::text FROM sites WHERE id='${siteId}';`),'draft|false');
 publish(false);assert.equal(owned.psql(`SELECT status||'|'||published::text FROM sites WHERE id='${siteId}';`),'draft|false','install/release-only work must not open a draft store');
 owned.psql(`UPDATE sites SET access_mode='offline' WHERE id='${siteId}';
 CREATE FUNCTION synthetic_theme_visibility_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.store_id='${siteId}'::uuid THEN RAISE EXCEPTION 'synthetic-publication-fault';END IF;RETURN NEW;END$$;
 CREATE TRIGGER synthetic_theme_visibility_fault BEFORE INSERT ON storefront_cache_tags FOR EACH ROW EXECUTE FUNCTION synthetic_theme_visibility_fault();`);
 assert.throws(()=>publish(true),'an injected cache-tag fault must roll back the release and visibility together');
 assert.equal(owned.psql(`SELECT status||'|'||published::text FROM sites WHERE id='${siteId}';`),'draft|false');
 assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${siteId}';`),'1');
 owned.psql('DROP TRIGGER synthetic_theme_visibility_fault ON storefront_cache_tags;DROP FUNCTION synthetic_theme_visibility_fault();');
 publish(true);assert.equal(owned.psql(`SELECT status||'|'||published::text||'|'||access_mode FROM sites WHERE id='${siteId}';`),'published|true|offline','publication opens its live bit without overriding a merchant privacy choice');
 assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${siteId}';`),'2');
 }finally{await f.gateway.settle();}
});

test('visibility migration and rollback preserve the publisher ABI/profile and refuse unexpected reapplication',()=>{
 owned.script(readFileSync('database/supabase/rollback/376_atomic_theme_instance_switch.rollback.sql','utf8'));
 const signature="'public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)'::regprocedure";
 const profile=()=>owned.psql(`SELECT jsonb_build_object('owner',proowner,'acl',proacl::text,'args',proargnames,'defaults',pronargdefaults,'default_expressions',pg_catalog.pg_get_expr(proargdefaults,0),'all_types',proallargtypes,'modes',proargmodes,'result',pg_catalog.pg_get_function_result(oid),'definer',prosecdef,'config',proconfig,'volatile',provolatile,'strict',proisstrict,'leakproof',proleakproof,'parallel',proparallel,'cost',procost,'rows',prorows,'support',prosupport,'binary',probin,'sql_body',prosqlbody,'transforms',protrftypes)::text FROM pg_catalog.pg_proc WHERE oid=${signature};`);
 const body=()=>owned.psql(`SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=${signature};`);
 const before=profile(),forward=readFileSync('database/supabase/migrations/366_theme_publication_visibility.sql','utf8'),rollback=readFileSync('database/supabase/rollback/366_theme_publication_visibility.rollback.sql','utf8');
 try{
  const refuseOverload=(sql:string)=>{
   owned.psql("CREATE FUNCTION public.publish_theme_release(p_synthetic_unknown integer) RETURNS integer LANGUAGE sql AS 'SELECT 1';");
   try { assert.throws(()=>owned.psql(sql),'an unknown sibling overload must refuse before publication function changes');assert.equal(profile(),before); }
   finally { owned.psql('DROP FUNCTION public.publish_theme_release(integer);'); }
  };
  assert.equal(body(),'8a1479af8ced3bbdb3cd6cc21d957f42');refuseOverload(rollback);owned.psql(rollback);assert.equal(body(),'fa4fae1749dc226ed066e5bf27020c84');assert.equal(profile(),before);
  refuseOverload(forward);
  const definition=owned.psql(`SELECT pg_catalog.pg_get_functiondef(${signature});`).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
  assert.match(definition,/p_make_store_live boolean DEFAULT true/);
  owned.psql(definition.replace('p_make_store_live boolean DEFAULT true','p_make_store_live boolean DEFAULT false'));
  try { assert.throws(()=>owned.psql(forward),'a same-count changed default must refuse the repair');assert.equal(body(),'fa4fae1749dc226ed066e5bf27020c84'); }
  finally { owned.psql(definition); }
  const allTypes=owned.psql(`SELECT proallargtypes::text FROM pg_catalog.pg_proc WHERE oid=${signature};`);
  owned.psql(`UPDATE pg_catalog.pg_proc SET proallargtypes=proallargtypes[1:12]||ARRAY['text'::regtype::oid] WHERE oid=${signature};`);
  try { assert.throws(()=>owned.psql(forward),'a changed output ABI must refuse the repair');assert.equal(body(),'fa4fae1749dc226ed066e5bf27020c84'); }
  finally { owned.psql(`UPDATE pg_catalog.pg_proc SET proallargtypes='${allTypes}'::oid[] WHERE oid=${signature};`); }
  for(const [field,expression,cast]of [['provolatile',"'i'",'"char"'],['proisstrict','true','boolean'],['proparallel',"'s'",'"char"'],['procost','101','real'],['prorows','2','real']]){
   const original=owned.psql(`SELECT ${field}::text FROM pg_catalog.pg_proc WHERE oid=${signature};`);
   owned.psql(`UPDATE pg_catalog.pg_proc SET ${field}=${expression} WHERE oid=${signature};`);
   try { assert.throws(()=>owned.psql(forward),'changed execution profile '+field+' must refuse before replacement'); }
   finally { owned.psql(`UPDATE pg_catalog.pg_proc SET ${field}='${original}'::${cast} WHERE oid=${signature};`); }
  }
  assert.equal(profile(),before);
  owned.psql(`GRANT EXECUTE ON FUNCTION public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid) TO anon;`);
  assert.throws(()=>owned.psql(forward),'unexpected public actor execution must be rejected before the repair');assert.equal(body(),'fa4fae1749dc226ed066e5bf27020c84');
  owned.psql(`REVOKE EXECUTE ON FUNCTION public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid) FROM anon;`);
  owned.psql(forward);assert.equal(body(),'8a1479af8ced3bbdb3cd6cc21d957f42');assert.equal(profile(),before);
  assert.throws(()=>owned.psql(forward),'a second forward invocation is not permission to replace an unknown live function');assert.equal(body(),'8a1479af8ced3bbdb3cd6cc21d957f42');
 }finally{if(body()==='fa4fae1749dc226ed066e5bf27020c84')owned.psql(forward);owned.script(readFileSync('database/supabase/migrations/376_atomic_theme_instance_switch.sql','utf8'));}
});

test('an unpublished Core catalog is available only through a valid store-bound, unexpired preview capability',async()=>{
 const f=await fixture();try{
 const a=await f.create(),b=await f.create();assert.equal(a.response.status,201);assert.equal(b.response.status,201);const siteId=String(a.response.json?.data?.id);
 const headers=()=>signedIdentityHeaders(f.id,f.email,siteId);
 const created=await f.gateway.request('/v1/products',{method:'POST',headers:{...await headers(),'X-Store-ID':siteId,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:siteId,name:'Synthetic private Core product',price:199,stock:5,status:'active',is_active:true})});assert.equal(created.status,201,created.text);const productId=created.json?.data?.id;
 const loaded=await f.gateway.request(`/v1/themes/letbuyy-core/editor?store_id=${siteId}`,{headers:await headers()});assert.equal(loaded.status,200);
 const saved=await f.gateway.request('/v1/themes/letbuyy-core/editor/draft',{method:'PUT',headers:await headers(),body:JSON.stringify({store_id:siteId,template_config:loaded.json?.data?.template_config,base_version:loaded.json?.data?.version,idempotency_key:crypto.randomUUID(),template_key:'index'})});assert.equal(saved.status,200);
 const minted=await f.gateway.request('/v1/themes/letbuyy-core/preview-session',{method:'POST',headers:{...await headers(),'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:siteId,template_key:'index',ttl_seconds:60})});assert.equal(minted.status,201);const token=String(minted.json?.data?.preview_token);assert.equal(token.length>20,true);
 const request=(slug:string,capability:string,ids?:string)=>f.gateway.request(`/v1/storefront/${slug}/theme-preview?token=${encodeURIComponent(capability)}&resource=products${ids?'&ids='+encodeURIComponent(ids):''}`);
 const anonymous=await f.gateway.request(`/v1/storefront/${a.slug}/products`);assert.equal(anonymous.status,404);
 const preview=await request(a.slug,token);assert.equal(preview.status,200);assert.equal(Array.isArray(preview.json?.data),true,'preview product response is an array, not a silently substituted store document');assert.deepEqual(preview.json?.data?.map((row:{id:string})=>row.id),[productId]);assert.match(preview.headers.get('Cache-Control')||'',/private.*no-store/);
 const selected=await request(a.slug,token,String(productId));assert.equal(selected.status,200);assert.equal(selected.json?.data?.length,1);
 assert.equal((await request(a.slug,token,'invalid-id')).status,400);
 assert.equal((await request(a.slug,token,Array(101).fill(productId).join(','))).status,400,'preview selection has a finite 100-ID contract');
 assert.deepEqual((await request(a.slug,token,crypto.randomUUID())).json?.data,[]);
 assert.equal((await f.gateway.request(`/v1/storefront/${a.slug}/theme-preview?token=${encodeURIComponent(token)}&resource=unknown`)).status,400);
 assert.equal((await request(b.slug,token)).status,404);assert.equal((await request(a.slug,crypto.randomUUID()+'.'+crypto.randomUUID())).status,404);
 owned.psql(`UPDATE theme_preview_sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE store_id='${siteId}';`);assert.equal((await request(a.slug,token)).status,404,'a repeated preview read cannot reuse data after its capability expires');
 assert.equal(owned.psql(`SELECT published FROM sites WHERE id='${siteId}';`),'f','private preview must not open the public store');
 }finally{await f.gateway.settle();}
});

test('public catalog and canonical cart retain option names, variant identity and variant price', async()=>{
 const f=await fixture();try{
 const made=await f.create();assert.equal(made.response.status,201);const siteId=String(made.response.json?.data?.id);
 const created=await f.gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(f.id,f.email,siteId),'X-Store-ID':siteId,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:siteId,name:'Synthetic public variant product',price:199,status:'active',is_active:true,product_options:[{name:'Size',position:0,values:['Small','Large']}],variants:[{title:'Small',price:199,stock:3,options:{Size:'Small'}},{title:'Large',price:249,stock:4,options:{Size:'Large'}}]})});assert.equal(created.status,201,created.text);const productId=created.json?.data?.id;
 owned.psql(`SELECT release_id FROM public.publish_theme_release(p_store_id:='${siteId}'::uuid,p_theme_id:='letbuyy-core',p_release_config:=(SELECT template_config FROM sites WHERE id='${siteId}'),p_published_by:='${f.id}'::uuid,p_make_store_live:=true);`);
 const catalog=await f.gateway.request(`/v1/storefront/${made.slug}/products`);assert.equal(catalog.status,200);const product=catalog.json?.data?.[0];assert.deepEqual(product.product_options,[{name:'Size',position:0,values:['Small','Large']}]);const large=product.variants.find((v:{title:string})=>v.title==='Large');assert.equal(large.price,249);
 const cart=(variantId:string)=>f.gateway.request(`/v1/storefront/${made.slug}/cart`,{method:'POST',body:JSON.stringify({lines:[{product_id:productId,variant_id:variantId,quantity:1,properties:{Size:'Large'}}]})});
 const accepted=await cart(large.id);assert.equal(accepted.status,201,accepted.text);assert.equal(accepted.json?.data?.lines[0].variant_id,large.id);assert.equal(accepted.json?.data?.lines[0].unit_price,249);assert.equal(accepted.json?.data?.subtotal,249);
 const rejected=await cart(crypto.randomUUID());assert.equal(rejected.status,400);assert.equal(rejected.json?.error?.code,'VARIANT_NOT_FOUND');
 const other=await f.create();assert.equal(other.response.status,201);const otherSiteId=String(other.response.json?.data?.id);
 const foreignProduct=await f.gateway.request('/v1/products',{method:'POST',headers:{...await signedIdentityHeaders(f.id,f.email,otherSiteId),'X-Store-ID':otherSiteId,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({store_id:otherSiteId,name:'Synthetic foreign variant product',price:399,status:'active',product_options:[{name:'Size',position:0,values:['Foreign']}],variants:[{title:'Foreign',price:399,stock:2,options:{Size:'Foreign'}}]})});assert.equal(foreignProduct.status,201);
 const foreignVariant=owned.psql(`SELECT id FROM product_variants WHERE product_id='${foreignProduct.json?.data?.id}';`);
 assert.equal((await cart(foreignVariant)).status,400,'an existing variant from another tenant cannot be attached to this product');
 }finally{await f.gateway.settle();}
});


test('Core starter copy patch is catalog-only, owner-safe, idempotent and reversible',()=>{
 const forward=readFileSync('database/supabase/migrations/367_core_starter_announcement.sql','utf8');
 const rollback=readFileSync('database/supabase/rollback/367_core_starter_announcement.rollback.sql','utf8');
 const core=()=>owned.psql("SELECT default_template::text FROM themes WHERE slug='letbuyy-core';");
 const sites=()=>owned.psql("SELECT coalesce(json_agg(to_jsonb(s) ORDER BY id),'[]'::json)::text FROM sites s;");
 const releases=()=>owned.psql("SELECT coalesce(json_agg(to_jsonb(r) ORDER BY id),'[]'::json)::text FROM theme_releases r;");
 const before=core(),oldSites=sites(),oldReleases=releases();
 try{
  owned.psql(rollback);assert.match(core(),/Free shipping on fresh drops this week\./);
  const legacy=core();owned.psql(rollback);assert.equal(core(),legacy);
  owned.psql("UPDATE themes SET is_site_private=true WHERE slug='letbuyy-core';");
  owned.psql(forward);assert.equal(core(),legacy,'private catalog is not rewritten');
  owned.psql("UPDATE themes SET is_site_private=false WHERE slug='letbuyy-core';");
  owned.psql(forward);assert.equal(core(),before,'only intended copy changes, exact bundle is conserved');
  owned.psql(forward);assert.equal(core(),before,'repeated application is harmless');
  assert.equal(sites(),oldSites,'existing merchant drafts are unchanged');
  assert.equal(releases(),oldReleases,'published snapshots are unchanged');
  const custom=before.replaceAll('Discover our latest products.','Merchant-defined announcement');
  owned.script(`UPDATE themes SET default_template='${custom.replaceAll("'","''")}'::jsonb WHERE slug='letbuyy-core';`);
  owned.psql(rollback);owned.psql(forward);assert.equal(core(),custom,'unrecognized custom copy is retained');
 }finally{owned.script(`UPDATE themes SET is_site_private=false,default_template='${before.replaceAll("'","''")}'::jsonb WHERE slug='letbuyy-core';`);}
});


test('new stores default to the captured Circuit catalog document without rewriting existing Core stores',async()=>{
 const f=await fixture();
 try {
  const before=owned.psql("SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]'::jsonb)::text) FROM sites s;");
  const made=await f.create(null);assert.equal(made.response.status,201,made.response.text);
  const siteId=String(made.response.json?.data?.id);
  assert.equal(made.response.json?.data?.theme_id,'letbuyy-forge');
  const config=JSON.parse(owned.psql(`SELECT template_config::text FROM sites WHERE id='${siteId}';`));
  assert.equal(config.themeId,'letbuyy-forge');assert.equal(config.liquidBundle?.package?.slug,'letbuyy-forge');
  assert.equal(config.liquidBundle.package.name,'Circuit');assert.equal(config.survey.industry,'food');
  assert.deepEqual(config.themeSettings,JSON.parse(owned.psql("SELECT default_template->'themeSettings' FROM themes WHERE slug='letbuyy-forge';")),'survey metadata cannot restyle the selected niche design');
  assert.equal(owned.psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]'::jsonb)::text) FROM sites s WHERE id<>'${siteId}';`),before);
  const replay=await made.replay();assert.equal(replay.status,201,replay.text);assert.equal(replay.json?.data?.id,siteId);
  owned.psql("UPDATE themes SET is_active=false WHERE slug='letbuyy-forge';");
  try {const blocked=await f.create(null);assert.equal(blocked.response.status,503,blocked.response.text);}
  finally {owned.psql("UPDATE themes SET is_active=true WHERE slug='letbuyy-forge';");}
  assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE custom_user_id='${f.id}';`),'1');
 }finally{await f.gateway.settle();}
});
