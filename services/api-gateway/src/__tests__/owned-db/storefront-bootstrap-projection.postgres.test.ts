// Mounted Worker -> real owned PostgreSQL/PostgREST and pooled SQL. Service-role
// application/transaction proof, not RLS. Named REST faults and one held site
// acknowledgement exercise failure and publication races without replacing data.
import assert from 'node:assert/strict';
import test,{before,after,afterEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {closePooledSqlClients,getPooledSql} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,tapRest,restJson,type RestTap} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,type SyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const j=(v:unknown)=>q(JSON.stringify(v))+'::jsonb';
const migration=readFileSync('database/supabase/migrations/370_public_storefront_sql_readers.sql','utf8');
const rollback=readFileSync('database/supabase/rollback/370_public_storefront_sql_readers.rollback.sql','utf8');
const accessMigration=readFileSync('database/supabase/migrations/371_storefront_access_metadata.sql','utf8');
const accessRollback=readFileSync('database/supabase/rollback/371_storefront_access_metadata.rollback.sql','utf8');
let sql:Gateway,rest:Gateway,proxy:OwnedPooledSqlProxy,tap:RestTap;
let fault='',advance:undefined|(()=>void);
before(async()=>{
 proxy=await startOwnedPooledSqlProxy(owned);const keys=await newIdentityKeys();
 sql=new Gateway(gatewayEnv(owned,keys,proxy.env()));rest=new Gateway(gatewayEnv(owned,keys));
 // Diagnose the real transport principal without changing grants or substituting
 // a privileged connection. Keep the no-REST-fallback assertion below decisive.
 const direct=getPooledSql(proxy.env())!;
 const principal=await direct.unsafe("SELECT current_user AS principal,has_table_privilege(current_user,'public.theme_releases','SELECT') AS release_select");
 let releaseReadCode='OK';try{await direct.unsafe('SELECT id FROM public.theme_releases LIMIT 1');}catch(error){releaseReadCode=String((error as {code?:string}).code??'UNKNOWN');}
 assert.equal(principal[0].principal,'authenticator');assert.equal(principal[0].release_select,false);assert.equal(releaseReadCode,'42501','repair must never grant direct table reads to the transport');
 console.info('OWNED_BOOTSTRAP_SQL_PRINCIPAL',JSON.stringify({principal:principal[0].principal,releaseSelect:principal[0].release_select,releaseReadCode}));
 tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(call.method==='GET'&&call.resource===fault)return restJson(503,{message:'Synthetic private dependency failure'});
  const response=await forward();
  if(call.method==='GET'&&call.resource==='sites'&&advance){const publish=advance;advance=undefined;publish();}
  return response;
 });
});
afterEach(async()=>{fault='';advance=undefined;await Promise.all([sql?.settle(),rest?.settle()]);});
after(async()=>{await Promise.all([sql?.settle(),rest?.settle()]);tap?.restore();await closePooledSqlClients();await proxy?.stop();});
function tenant(tag:string){const t=newSyntheticTenant(tag);seedSyntheticTenant(owned.psql,t);return t;}
function publish(t:SyntheticTenant,config:unknown){return JSON.parse(owned.psql(`SELECT row_to_json(r) FROM public.publish_theme_release(${q(t.siteId)},'letbuyy-core',${j(config)}) r;`)) as {release_id:string;release_version:number};}
const read=(g:Gateway,t:SyntheticTenant,compact=true)=>g.request(`/v1/storefront/${t.subdomain}${compact?'?projection=render-v1':''}`);
const config=(marker:string)=>({marker,themeSettings:{primaryColor:marker},liquidBundle:{files:{'layout/theme.liquid':('Synthetic '+marker+' ').repeat(800)}}});

for(const name of ['sql','rest'] as const)test(`compact/default ${name} representations agree on the pinned publication without duplicate artifacts or draft fallback`,async()=>{
 const g=name==='sql'?sql:rest;
 const t=tenant('projection-'+name),published=config('published'),r=publish(t,published);
 owned.psql(`UPDATE sites SET template_config=${j({marker:'private-draft-marker'})} WHERE id=${q(t.siteId)};`);
  const start=tap.calls.length,compact=await read(g,t);assert.equal(compact.status,200,name+': '+compact.text);
  const body=compact.json!.data;assert.equal(body.projection,'render-v1');assert.deepEqual(body.template_config,published);
  assert.equal(body.current_theme_release.id,r.release_id);assert.equal(body.current_theme_release.release_version,r.release_version);
  assert.equal('release_config'in body.current_theme_release,false);assert.equal('template_snapshot'in body.current_theme_release,false);
  assert.equal(compact.headers.get('cache-control'),'no-store');assert.doesNotMatch(compact.text,/private-draft-marker/);
  const releaseCalls=tap.calls.slice(start).filter(c=>c.resource==='theme_releases');
  if(name==='sql'){
   assert.equal(releaseCalls.length,0,'pooled query must succeed rather than silently fall back to REST');
   assert.equal(tap.calls.slice(start).filter(c=>c.resource==='sites').length,0,'public site resolution also runs through the authorized SQL routine');
  }
  else {assert.equal(releaseCalls.length,1);const call=releaseCalls[0];assert.equal(call.search.get('store_id'),'eq.'+t.siteId);assert.equal(call.search.get('id'),'eq.'+r.release_id);assert.equal(call.search.get('limit'),'1');assert.doesNotMatch(call.search.get('select')!,/release_config|settings_snapshot|asset_manifest/);}
  const legacy=await read(g,t,false);assert.equal(legacy.status,200,legacy.text);assert.equal(legacy.json!.data.projection,undefined);
  assert.deepEqual(legacy.json!.data.current_theme_release.release_config,published);assert.deepEqual(legacy.json!.data.current_theme_release.template_snapshot,published);
  assert.ok(Buffer.byteLength(compact.text)<Buffer.byteLength(legacy.text)*0.6,'one config transport must materially reduce repeated artifacts');
});

test('verified legacy absence and manifest-only snapshots preserve existing configuration precedence',async()=>{
 const legacy=tenant('legacy-fallback');owned.psql(`UPDATE sites SET template_config=${j({legacy:true})} WHERE id=${q(legacy.siteId)};`);
 const manifest=tenant('manifest-fallback'),id=crypto.randomUUID();
 // Explicit historical fixture, not a normal merchant publication. Empty snapshot
 // is truthy in the existing mapper and therefore wins over release_config.
 owned.psql(`INSERT INTO theme_releases(id,store_id,theme_id,release_version,is_current,release_config,template_snapshot,release_manifest) VALUES(${q(id)},${q(manifest.siteId)},'letbuyy-core',1,true,${j({ignored:true})},'{}',${j({templateConfig:{manifest:true},renderer_engine:'liquid',customMetadata:{keep:true}})});UPDATE sites SET current_theme_release_id=${q(id)},storefront_release_version=1 WHERE id=${q(manifest.siteId)};`);
 for(const g of [sql,rest]){
  const a=await read(g,legacy);assert.equal(a.status,200,a.text);assert.deepEqual(a.json!.data.template_config,{legacy:true});assert.equal(a.json!.data.current_theme_release,null);
  const b=await read(g,manifest);assert.equal(b.status,200,b.text);assert.deepEqual(b.json!.data.template_config,{manifest:true});assert.deepEqual(b.json!.data.current_theme_release.release_manifest,{renderer_engine:'liquid',customMetadata:{keep:true}});
 }
});

test('publication pins refuse foreign releases and mismatched versions without leaking another tenant or mutable config',async()=>{
 const a=tenant('pin-a'),b=tenant('pin-b'),own=publish(a,config('own')),foreign=publish(b,config('foreign-private'));
 for(const g of [sql,rest]){
  owned.psql(`UPDATE sites SET current_theme_release_id=${q(foreign.release_id)} WHERE id=${q(a.siteId)};`);
  const wrong=await read(g,a);assert.equal(wrong.status,503,wrong.text);assert.doesNotMatch(wrong.text,/foreign-private|liquidBundle/);
  owned.psql(`UPDATE sites SET current_theme_release_id=${q(own.release_id)},storefront_release_version=999 WHERE id=${q(a.siteId)};`);
  assert.equal((await read(g,a)).status,503);
  owned.psql(`UPDATE sites SET storefront_release_version=${own.release_version} WHERE id=${q(a.siteId)};`);assert.equal((await read(g,a)).status,200);
 }
});

test('published site and release REST failures are unavailable, sanitized and recoverable rather than false absence',async()=>{
 const t=tenant('read-fault');publish(t,config('retry'));
 for(const resource of ['sites','theme_releases']){
  fault=resource;const failed=await read(rest,t);assert.equal(failed.status,503,resource+': '+failed.text);assert.doesNotMatch(failed.text,/Synthetic private|postgres|SQLSTATE|liquidBundle/i);
  fault='';const recovered=await read(rest,t);assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json!.data.template_config.marker,'retry');
 }
});

test('a publish between the real site read and release read returns a coherent superseded pinned snapshot, then the new publication',async()=>{
 const t=tenant('publish-race'),old=publish(t,config('old-published'));let next:{release_id:string;release_version:number}|undefined;
 advance=()=>{next=publish(t,config('new-published'));};
 const during=await read(rest,t);assert.equal(during.status,200,during.text);assert.ok(next);assert.equal(during.json!.data.current_theme_release.id,old.release_id);assert.equal(during.json!.data.current_theme_release.release_version,old.release_version);assert.equal(during.json!.data.template_config.marker,'old-published');
 const after=await read(rest,t);assert.equal(after.status,200,after.text);assert.equal(after.json!.data.current_theme_release.id,next!.release_id);assert.equal(after.json!.data.template_config.marker,'new-published');
 assert.equal(owned.psql(`SELECT release_status FROM theme_releases WHERE id=${q(old.release_id)};`),'superseded');
});

test('current visibility refuses unpublished/draft/suspended stores and malformed projections never read business data',async()=>{
 const t=tenant('visibility');publish(t,config('visible'));
 for(const g of [sql,rest]){
  for(const change of ["published=false","status='draft'","status='suspended'"]){owned.psql(`UPDATE sites SET status='published',published=true WHERE id=${q(t.siteId)};UPDATE sites SET ${change} WHERE id=${q(t.siteId)};`);for(const compact of [false,true])assert.equal((await read(g,t,compact)).status,404);}
  owned.psql(`UPDATE sites SET status='published',published=true WHERE id=${q(t.siteId)};`);
  for(const query of ['projection=unknown','projection=render-v1&projection=render-v1','projection=render-v1&unbounded=1']){
   const start=tap.calls.length;assert.equal((await g.request(`/v1/storefront/${t.subdomain}?${query}`)).status,400);assert.equal(tap.calls.slice(start).filter(c=>['sites','theme_releases'].includes(c.resource)).length,0);
  }
 }
 assert.equal((await rest.request('/v1/storefront/syn-missing-bootstrap?projection=render-v1')).status,404);
});

test('only the actual backend transport can execute fixed public readers, and direct tables and unpublished/foreign artifacts stay inaccessible',async()=>{
 const t=tenant('sql-acl'),foreign=tenant('sql-acl-foreign'),release=publish(t,config('sql-public')),other=publish(foreign,config('foreign'));
 const direct=getPooledSql(proxy.env())!;
 const query="SELECT public.read_published_storefront_release_v1($1,$2,$3,$4) AS payload";
 const actual=await direct.unsafe(query,[t.siteId,release.release_id,release.release_version,'render-v1']);assert.equal(actual[0].payload.template_snapshot.marker,'sql-public');
 for(const values of [[t.siteId,other.release_id,other.release_version,'render-v1'],[t.siteId,release.release_id,999,'render-v1'],[t.siteId,release.release_id,release.release_version,'unknown']])assert.equal((await direct.unsafe(query,values))[0].payload,null);
 owned.psql(`UPDATE sites SET published=false WHERE id=${q(t.siteId)};`);
 assert.equal((await direct.unsafe(query,[t.siteId,release.release_id,release.release_version,'render-v1']))[0].payload,null);
 assert.equal((await direct.unsafe('SELECT public.read_published_storefront_site_v1($1,false) AS payload',[t.subdomain]))[0].payload,null);
 for(const role of ['anon','authenticated','app_tenant','service_role']){
  for(const call of [`public.read_published_storefront_site_v1(${q(foreign.subdomain)},false)`,`public.read_published_storefront_release_v1(${q(foreign.siteId)},NULL,NULL,'legacy')`])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT ${call};ROLLBACK;`),/permission denied for function/);
 }
 const backendKey=owned.restEnv().SUPABASE_SERVICE_ROLE_KEY;
 const dataApi=await fetch(owned.restUrl+'/rest/v1/rpc/read_published_storefront_site_v1',{method:'POST',headers:{apikey:backendKey,Authorization:'Bearer '+backendKey,'Content-Type':'application/json'},body:JSON.stringify({p_handle:foreign.subdomain,p_id_only:false})});
 assert.ok([401,403,404].includes(dataApi.status),'Data API role switching must not inherit backend-login EXECUTE');
 const denied:unknown=await dataApi.json();assert.ok(denied&&typeof denied==='object');assert.equal('data'in denied,false);
 for(const table of ['sites','theme_releases']){
  assert.equal(owned.psql(`SELECT has_table_privilege('authenticator','public.${table}','SELECT');`),'f');
  await assert.rejects(direct.unsafe(`SELECT id FROM public.${table} LIMIT 1`),(error:{code?:string})=>error.code==='42501');
 }
});

test('reader replay and paired rollback preserve existing authority; altered body/owner/ACL refuse before retirement',async()=>{
 const signature='public.read_published_storefront_site_v1(text,boolean)';
 const authority=()=>owned.psql(`SELECT jsonb_build_object('tables',(SELECT jsonb_agg(jsonb_build_object('name',relname,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) ORDER BY relname) FROM pg_class WHERE oid IN('public.sites'::regclass,'public.theme_releases'::regclass)), 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY rolname) FROM pg_roles r WHERE rolname IN('authenticator','app_tenant','anon','authenticated','service_role')), 'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m));`);
 const currentAuthority=authority();
 // Historical370 is deliberately fail-closed against its successor371. Prove
 // that refusal before restoring370 through371's supported paired rollback.
 for(const operation of [migration,rollback])assert.match(owned.psqlExpectError(operation),/refuses changed public reader/);
 assert.equal(authority(),currentAuthority);
 owned.script(accessRollback);
 try {
 const before=authority();owned.script(migration);assert.equal(authority(),before);
 for(const alteration of [`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`,`ALTER FUNCTION ${signature} OWNER TO service_role;`,`CREATE OR REPLACE FUNCTION public.read_published_storefront_site_v1(p_handle text,p_id_only boolean) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $$SELECT '{}'::jsonb;$$;`]){
  for(const operation of [migration,rollback])assert.match(owned.psqlExpectError('BEGIN;'+alteration+operation),/refuses changed public reader/);
  assert.equal(authority(),before,'failed guard must leave all prior authority unchanged');
 }
 const t=tenant('reader-rollback');publish(t,config('rollback-real'));
 owned.script(rollback);assert.equal(owned.psql(`SELECT to_regprocedure('${signature}') IS NULL;`),'t');assert.equal(authority(),before);
 const start=tap.calls.length,fallback=await read(sql,t);assert.equal(fallback.status,200,fallback.text);assert.equal(fallback.json!.data.template_config.marker,'rollback-real');assert.ok(tap.calls.slice(start).some(c=>c.resource==='theme_releases'),'old schema uses bounded real REST compatibility');
 owned.script(migration);assert.equal(authority(),before);const retried=tap.calls.length;assert.equal((await read(sql,t)).status,200);assert.equal(tap.calls.slice(retried).filter(c=>['sites','theme_releases'].includes(c.resource)).length,0,'recovered authorized SQL executes with no REST substitute');
 } finally {owned.script(accessMigration);}
 assert.equal(authority(),currentAuthority);
});


test('371 metadata is bounded, revision-bound and selector-safe; replay/rollback guards preserve full projection and authority',async()=>{
 const t=tenant('access-meta'),collision=tenant('access-collision');
 const hash='synthetic-backend-only-password-hash';
 owned.psql(`UPDATE sites SET access_mode='password',access_password_hash=${q(hash)},template_config=${j(config('large-private-hash-absent'))} WHERE id=${q(t.siteId)};UPDATE sites SET subdomain=${q(t.siteId)} WHERE id=${q(collision.siteId)};`);
 const direct=getPooledSql(proxy.env())!;
 const call=async(selector:string,idOnly:boolean)=>(await direct.unsafe('SELECT public.read_published_storefront_site_v1($1,$2) AS payload',[selector,idOnly]))[0].payload;
 const full=await call(t.subdomain,false);
 const metadata=await call(t.subdomain,true);
 assert.deepEqual(Object.keys(metadata).sort(),['id','subdomain','custom_domain','custom_domain_status','access_mode','published','status','access_revision'].sort());
 const revision=owned.psql(`SELECT encode(sha256(convert_to(${q(hash)},'UTF8')),'hex');`);
 assert.equal(metadata.access_revision,revision);assert.equal(metadata.id,t.siteId);
 assert.equal(JSON.stringify(metadata).includes(hash),false);assert.equal('template_config'in metadata,false);
 assert.equal('access_password_hash'in full,false);assert.equal('access_revision'in full,false);
 assert.deepEqual(await call('id:'+t.siteId,true),metadata);
 assert.equal((await call(t.siteId,true)).id,collision.siteId,'UUID-shaped legitimate handle is distinct from id: selector');
 for(const invalid of ['id:invalid','id:'+t.siteId+':tail','id:'+t.siteId.toUpperCase(),"id:' OR true --"]){assert.equal(await call(invalid,true),null);}
 const signature='public.read_published_storefront_site_v1(text,boolean)';
 const state=()=>owned.psql(`SELECT jsonb_build_object('tables',(SELECT jsonb_agg(jsonb_build_object('id',oid,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN('public.sites'::regclass,'public.theme_releases'::regclass)),'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY rolname) FROM pg_roles r WHERE rolname IN('authenticator','anon','authenticated','service_role','app_tenant')),'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m),'function',(SELECT jsonb_build_object('owner',proowner,'acl',proacl,'config',proconfig,'args',proargnames,'return',prorettype) FROM pg_proc WHERE oid='${signature}'::regprocedure));`);
 const before=state();owned.script(accessMigration);assert.equal(state(),before);assert.deepEqual(await call(t.subdomain,false),full);
 for(const alteration of [`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`,`ALTER FUNCTION ${signature} OWNER TO service_role;`,`ALTER FUNCTION ${signature} SET search_path TO public;`,`ALTER FUNCTION ${signature} IMMUTABLE;`,`CREATE OR REPLACE FUNCTION public.read_published_storefront_site_v1(p_handle text,p_id_only boolean) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $$SELECT '{}'::jsonb;$$;`]){
  for(const operation of [accessMigration,accessRollback])assert.match(owned.psqlExpectError('BEGIN;'+alteration+operation),/refuses changed public reader/);
  assert.equal(state(),before);
 }
 owned.script(accessRollback);assert.equal(state(),before);assert.deepEqual(await call(t.subdomain,true),{id:t.siteId});assert.deepEqual(await call(t.subdomain,false),full);assert.equal(await call('id:'+t.siteId,true),null);
 owned.script(accessRollback);owned.script(accessMigration);assert.equal(state(),before);assert.deepEqual(await call(t.subdomain,true),metadata);assert.deepEqual(await call(t.subdomain,false),full);
 owned.psql(`UPDATE sites SET access_password_hash='synthetic-new-password-hash' WHERE id=${q(t.siteId)};`);assert.notEqual((await call(t.subdomain,true)).access_revision,revision);
 for(const alteration of ["published=false","status='draft'","deleted_at=now()"]){
  owned.psql(`UPDATE sites SET published=true,status='published',deleted_at=NULL WHERE id=${q(t.siteId)};UPDATE sites SET ${alteration} WHERE id=${q(t.siteId)};`);
  for(const selector of [t.subdomain,'id:'+t.siteId])assert.equal(await call(selector,true),null);
 }
});
