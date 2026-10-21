// Mounted Worker -> real owned PostgreSQL/PostgREST and pooled SQL. Service-role
// application/transaction proof, not RLS. Named REST faults and one held site
// acknowledgement exercise failure and publication races without replacing data.
import assert from 'node:assert/strict';
import test,{before,after,afterEach} from 'node:test';
import {closePooledSqlClients,getPooledSql} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,tapRest,restJson,type RestTap} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,type SyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const j=(v:unknown)=>q(JSON.stringify(v))+'::jsonb';
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

test('compact/default SQL and REST representations agree on the pinned publication without duplicate artifacts or draft fallback',async()=>{
 const t=tenant('projection'),published=config('published'),r=publish(t,published);
 owned.psql(`UPDATE sites SET template_config=${j({marker:'private-draft-marker'})} WHERE id=${q(t.siteId)};`);
 for(const [name,g]of [['sql',sql],['rest',rest]] as const){
  const start=tap.calls.length,compact=await read(g,t);assert.equal(compact.status,200,name+': '+compact.text);
  const body=compact.json!.data;assert.equal(body.projection,'render-v1');assert.deepEqual(body.template_config,published);
  assert.equal(body.current_theme_release.id,r.release_id);assert.equal(body.current_theme_release.release_version,r.release_version);
  assert.equal('release_config'in body.current_theme_release,false);assert.equal('template_snapshot'in body.current_theme_release,false);
  assert.equal(compact.headers.get('cache-control'),'no-store');assert.doesNotMatch(compact.text,/private-draft-marker/);
  const releaseCalls=tap.calls.slice(start).filter(c=>c.resource==='theme_releases');
  if(name==='sql')assert.equal(releaseCalls.length,0,'pooled query must succeed rather than silently fall back to REST');
  else {assert.equal(releaseCalls.length,1);const call=releaseCalls[0];assert.equal(call.search.get('store_id'),'eq.'+t.siteId);assert.equal(call.search.get('id'),'eq.'+r.release_id);assert.equal(call.search.get('limit'),'1');assert.doesNotMatch(call.search.get('select')!,/release_config|settings_snapshot|asset_manifest/);}
  const legacy=await read(g,t,false);assert.equal(legacy.status,200,legacy.text);assert.equal(legacy.json!.data.projection,undefined);
  assert.deepEqual(legacy.json!.data.current_theme_release.release_config,published);assert.deepEqual(legacy.json!.data.current_theme_release.template_snapshot,published);
  assert.ok(Buffer.byteLength(compact.text)<Buffer.byteLength(legacy.text)*0.6,'one config transport must materially reduce repeated artifacts');
 }
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
