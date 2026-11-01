import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {compilePortableToLiquidBundle} from '../../packages/theme-engine/src/portable-to-liquid';
import {getDefaultStorefrontThemeTemplate} from '../../packages/theme-engine/src/theme-registry';
import {createLetbuyyCoreLiquidThemeBundleFixture} from '../../packages/theme-engine/src/theme-bundle-core';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
test('fully migrated Core catalog carries current canonical section definitions',()=>{
 const actual=JSON.parse(owned.psql("SELECT (default_template->'liquidBundle')::text FROM themes WHERE slug='letbuyy-core';"));
 const expected=createLetbuyyCoreLiquidThemeBundleFixture();
 // Compare canonicalized JSON too: PostgreSQL jsonb sorts keys differently from TS insertion order.
 const stable=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 const differences=Object.keys(expected.sections).filter(key=>stable(actual.sections[key])!==stable(expected.sections[key]));
 console.info('OWNED_CORE_CATALOG '+JSON.stringify({sectionCount:Object.keys(actual.sections).length,differences,renderer:actual.renderer.engine,package:actual.package.slug}));
 assert.deepEqual(differences,[],'fresh installations must use the actual current canonical section definitions');
});

test('public-contact footer catalog migration is exact, reversible, and leaves merchant documents intact',()=>{
 const forward=readFileSync('database/supabase/migrations/426_core_public_contact_footer.sql','utf8');
 const rollback=readFileSync('database/supabase/rollback/426_core_public_contact_footer.rollback.sql','utf8');
 const catalog=()=>owned.psql("SELECT default_template::text FROM themes WHERE slug='letbuyy-core';");
 const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
 const restore=(value:string)=>owned.script(`UPDATE themes SET default_template=${quote(value)}::jsonb WHERE slug='letbuyy-core';`);
 const merchantDocuments=()=>owned.psql("SELECT jsonb_build_object('sites',(SELECT count(*) FROM sites),'drafts',(SELECT count(*) FROM theme_editor_drafts),'releases',(SELECT count(*) FROM theme_releases))::text;");
 const current=catalog(), documents=merchantDocuments();
 try{
  owned.script(forward);assert.equal(catalog(),current,'repeat forward preserves exact catalog');
  owned.script(rollback);const previous=catalog();assert.notEqual(previous,current);
  assert.equal(JSON.parse(previous).liquidBundle.sections.footer.source.includes('shop.contact_email'),false);
  owned.script(rollback);assert.equal(catalog(),previous,'repeat rollback is harmless');
  const drift=JSON.parse(previous);drift.liquidBundle.sections.footer.source+='\n<!-- unknown merchant edit -->';
  restore(JSON.stringify(drift));const unknown=catalog();
  assert.throws(()=>owned.script(forward),/Unexpected Core catalog footer/);
  assert.equal(catalog(),unknown,'unknown footer is untouched');
  restore(previous);owned.script(forward);assert.equal(catalog(),current);
  assert.equal(merchantDocuments(),documents,'site, draft, and release counts are unchanged');
 }finally{restore(current);}
});


test('Core section refresh refuses unknown catalog state and preserves real merchant draft/release documents',async()=>{
 const forward=readFileSync('database/supabase/migrations/368_core_section_catalog_refresh.sql','utf8');
 const rollback=readFileSync('database/supabase/rollback/368_core_section_catalog_refresh.rollback.sql','utf8');
 const catalog=()=>owned.psql("SELECT default_template::text FROM themes WHERE slug='letbuyy-core';");
 const quote=(text:string)=>"'"+text.replaceAll("'","''")+"'";
 const restore=(text:string)=>owned.script(`UPDATE themes SET default_template=${quote(text)}::jsonb,is_site_private=false WHERE slug='letbuyy-core';`);
 const owner=crypto.randomUUID(),email=`syn-core-catalog-${owner}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','${email}',true);`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 let current='';
 try{
  const created=await gateway.request('/v1/stores',{method:'POST',headers:{...await signedIdentityHeaders(owner,email),'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({name:'Synthetic Catalog Conservation',subdomain:'syn-catalog-'+crypto.randomUUID().slice(0,8),site_type:'store',theme_id:'letbuyy-core'})});assert.equal(created.status,201);
  const siteId=String(created.json?.data?.id);
  owned.psql(`SELECT release_id FROM publish_theme_release(p_store_id:='${siteId}'::uuid,p_theme_id:='letbuyy-core',p_release_config:=(SELECT template_config FROM sites WHERE id='${siteId}'),p_published_by:='${owner}'::uuid,p_make_store_live:=false);`);
  const loaded=await gateway.request(`/v1/themes/letbuyy-core/editor?store_id=${siteId}`,{headers:await signedIdentityHeaders(owner,email,siteId)});assert.equal(loaded.status,200);
  const saved=await gateway.request('/v1/themes/letbuyy-core/editor/draft',{method:'PUT',headers:await signedIdentityHeaders(owner,email,siteId),body:JSON.stringify({store_id:siteId,template_key:'index',template_config:loaded.json!.data.template_config,base_version:loaded.json!.data.version,idempotency_key:crypto.randomUUID(),client:'api'})});assert.equal(saved.status,200);
  await gateway.settle();
  assert.equal(owned.psql(`SELECT count(*) FROM theme_editor_drafts WHERE store_id='${siteId}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id='${siteId}';`),'1');
  const snapshot=()=>owned.psql(`SELECT jsonb_build_object('site',(SELECT to_jsonb(s) FROM sites s WHERE id='${siteId}'),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d WHERE store_id='${siteId}'),'releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM theme_releases r WHERE store_id='${siteId}'))::text;`);
  const documents=snapshot();current=catalog();
  const outsideSections=(text:string)=>{const data=JSON.parse(text);delete data.liquidBundle.sections;return data;};
  owned.script(forward);assert.equal(catalog(),current,'repeat forward preserves exact template');
  owned.script(rollback);const prior=catalog();assert.notEqual(prior,current);assert.deepEqual(outsideSections(prior),outsideSections(current));
  owned.script(rollback);assert.equal(catalog(),prior,'repeat rollback is harmless');
  const drift=JSON.parse(prior);drift.liquidBundle.sections['product-grid'].source+='\n<!-- synthetic unknown section revision -->';restore(JSON.stringify(drift));const changed=catalog();
  assert.throws(()=>owned.script(forward),/Unexpected Core catalog section/);assert.equal(catalog(),changed,'unknown section refuses the entire update');
  restore(prior);owned.psql("UPDATE themes SET is_site_private=true WHERE slug='letbuyy-core';");
  assert.throws(()=>owned.script(forward),/Unowned canonical Core catalog is unavailable/);assert.equal(catalog(),prior,'private catalog is not changed');
  restore(prior);owned.script(forward);assert.equal(catalog(),current,'exact current bundle restored');
  const next=JSON.parse(current);next.liquidBundle.sections['customer-account'].source+='\n<!-- synthetic later section revision -->';restore(JSON.stringify(next));const later=catalog();
  assert.throws(()=>owned.script(rollback),/Unexpected Core catalog section/);assert.equal(catalog(),later,'rollback refuses unknown later section');restore(current);
  assert.equal(snapshot(),documents,'existing site, saved draft and immutable publication bytes are conserved');
 }finally{if(current)restore(current);await gateway.settle();}
});


test('actual PostgreSQL jsonb ordering preserves recognition of untouched legacy Core category defaults',()=>{
 const old=getDefaultStorefrontThemeTemplate('letbuyy-core',{});
 const category=old.sections.template.find(s=>s.id==='category-grid-default')!;
 const template={templates:{index:{sections:{'category-grid-default':{type:category.type,settings:category.settings,blocks:Object.fromEntries(category.blocks!.map(b=>[b.id,{type:b.type,settings:b.settings}])),block_order:category.blocks!.map(b=>b.id)}},order:['category-grid-default']}}};
 const stored=JSON.parse(owned.psql("SELECT '"+JSON.stringify(template).replaceAll("'","''")+"'::jsonb::text;"));
 const block=stored.templates.index.sections['category-grid-default'];assert.notDeepEqual(Object.keys(block.blocks),block.block_order,'the actual database has reordered object keys');
 const base=JSON.parse(owned.psql("SELECT (default_template->'liquidBundle')::text FROM themes WHERE slug='letbuyy-core';"));
 const before=JSON.stringify(stored),compiled=compilePortableToLiquidBundle(stored,{baseBundle:base});assert.equal(Object.keys(compiled.bundle.templates.index.sections['category-grid-default'].blocks).length,0);assert.equal(JSON.stringify(stored),before);
 block.blocks['category-apparel'].settings.name='Synthetic merchant customization';assert.throws(()=>compilePortableToLiquidBundle(stored,{baseBundle:base}),/Block.*category.*not allowed/);
});
