// Actual canonical helper module, injected pool only. Native role/RLS/rollback acceptance remains mandatory.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import type {OwnedStoreScope} from '../lib/tenant-context';
import type {Env} from '../index';
import type {PooledSqlClient} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {publishThemeReleaseInTenantTx,bindOwnedTenantActor,TenantPublicationContextError} from '../lib/tenant-transaction';
import {createMinimalLiquidThemeBundleFixture} from '@letbuyy/theme-engine';
const id='a0000000-0000-4000-8000-000000000001',actor='f0000000-0000-4000-8000-000000000001';
const scope=():OwnedStoreScope=>({siteId:id,storeId:id,db:{} as OwnedStoreScope['db'],customUser:{id:actor,email:'synthetic@example.invalid'},authUser:{id:actor,email:'synthetic@example.invalid',storeId:id},tenant:{siteId:id,userId:actor,membershipId:null,roles:['owner'],permissions:['store:owner'],plan:'enterprise',entitlements:{},requestId:'synthetic:scope'}});
const intent=()=>({themeSlug:'liquid-starter',releaseConfig:{liquidBundle:createMinimalLiquidThemeBundleFixture()},targetPackageVersionId:id,priorReleaseId:actor,requestHash:'a'.repeat(64),makeStoreLive:true});
test('unregistered transaction cannot bind an actor or invoke the capability',async()=>{let calls=0;const tx={unsafe:async()=>{calls++;return[];}} as unknown as PooledSqlClient;await assert.rejects(()=>bindOwnedTenantActor(tx,scope()),TenantPublicationContextError);await assert.rejects(()=>publishThemeReleaseInTenantTx(tx,scope(),intent()),TenantPublicationContextError);assert.equal(calls,0);});
interface PublicationModelOptions { validProfile?:boolean; shadow?:boolean; changedSelection?:boolean; changedPrior?:boolean; rpcFailure?:boolean; privateCatalog?:boolean; unavailableTarget?:boolean }
function loaded(options:PublicationModelOptions={}){
 const file=resolve('services/api-gateway/src/lib/tenant-transaction.ts'),require=createRequire(file),loadedModule={exports:{}};
 const calls:string[]=[],events:{query:string;role:string}[]=[],guc:Record<string,string>={};let role='authenticator';
 const profile={body_md5:'56a6b7b15e8a7ec159341fe0331ac593',owner_matches:true,owner_bypass:true,plpgsql:true,abi_valid:true,allowed_acl:true,service_execute:true,tenant_execute:false,anon_execute:false,authenticated_execute:false,shadows:options.shadow??false,
  defaults:'NULL::uuid, NULL::integer, NULL::uuid, NULL::text, true, NULL::text, NULL::uuid',dependencies:[],shared_dependencies:[],
  row:{prosecdef:true,prokind:'f',pronargs:10,pronargdefaults:7,proretset:true,provolatile:'v',proparallel:'u',proisstrict:false,proleakproof:false,procost:100,prorows:1000,proconfig:['search_path=public'],proargnames:['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']}};
 const unsafe=async(q:string,p:unknown[]=[])=>{
  calls.push(q);events.push({query:q,role});
  const locks=q.match(/FOR SHARE OF ([a-z,]+)/)?.[1].split(',')||[];
  if(role==='app_tenant'&&(q.includes('public.theme_package_versions')||q.includes('public.theme_releases')||locks.some(alias=>['v','p','t','r'].includes(alias))))throw Object.assign(new Error('permission denied for read-only catalogue row lock'),{name:'PostgresError',code:'42501'});
  if(q==='SET LOCAL ROLE app_tenant')role='app_tenant';
  if(q==='SET LOCAL ROLE service_role')role='service_role';
  if(q.includes('SELECT set_config'))for(let i=0;i<p.length;i+=2)guc[String(p[i])]=String(p[i+1]);
  if(q.includes('SELECT current_user::text'))return[{role,site_id:guc['app.site_id'],request_id:guc['app.request_id'],actor_id:guc['app.actor_id'],subject:guc['request.jwt.claim.sub']}];
  if(q.includes('SELECT id FROM public.sites'))return[{id}];
  if(q.includes('SELECT i.id FROM public.theme_instances'))return role==='service_role'&&options.changedSelection?[]:[{id}];
  if(q.includes('AS prior_package_version_id'))return role==='service_role'&&options.changedPrior?[]:[{prior_package_version_id:id}];
  if(q.includes('AS profile FROM pg_proc'))return options.validProfile?[{profile}]:[];
  if(q.includes('SELECT to_jsonb(v) AS version')){assert.equal(role,'service_role');if(options.unavailableTarget&&q.includes("v.release_status='published'")&&q.includes('v.deleted_at IS NULL'))return[];return[{version:{id},package:{id},catalog:{is_site_private:options.privateCatalog??false,owned_by_site_id:options.privateCatalog?actor:null}}];}
  if(q.includes('SELECT * FROM public.publish_theme_release')){assert.equal(role,'service_role');if(options.rpcFailure)throw new Error('synthetic publisher failure');return[{release_id:id,release_version:1,published_at:'2026-10-24T00:00:00Z'}];}
  if(q.includes('INSERT INTO public.audit_activity_events')){assert.equal(role,'app_tenant');return[{id}];}
  return[];
 };
 let tx:unknown;const pool={begin:async(callback:(c:{unsafe:typeof unsafe})=>Promise<unknown>)=>{tx={unsafe};try{return await callback(tx as {unsafe:typeof unsafe});}finally{role='authenticator';}}};
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports','__filename','__dirname',js)((name:string)=>name==='@letbuyy/infrastructure/pooled-sql-adapter'?{getPooledSql:()=>pool}:require(name),loadedModule,loadedModule.exports,file,dirname(file));
 return{helper:loadedModule.exports as typeof import('../lib/tenant-transaction'),calls,events,lastTx:()=>tx as PooledSqlClient};
}
test('ordinary withTenantTx callback behavior and initial role/GUC setup remain unchanged',async()=>{const f=loaded(),s=scope();assert.equal(await f.helper.withTenantTx({} as Env,s.tenant,async()=>7),7);assert.equal(f.calls[0],'SET LOCAL ROLE app_tenant');assert.equal(f.calls.length,3);await assert.rejects(()=>f.helper.bindOwnedTenantActor(f.lastTx(),s));});
test('invalid resolved actor poisons commit even if callback catches refusal',async()=>{const f=loaded(),s=scope();s.tenant.userId=id;await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{try{await f.helper.bindOwnedTenantActor(tx,s);}catch{/* caller cannot turn refusal into a commit */}return'caught';}));assert(!f.calls.includes('SET LOCAL ROLE service_role'));});
test('unknown publisher profile poisons the full outer update before privilege use',async()=>{const f=loaded(),s=scope(),bundle=createMinimalLiquidThemeBundleFixture();await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);try{await f.helper.publishThemeReleaseInTenantTx(tx,s,{...intent(),themeSlug:bundle.package.slug});}catch{/* deliberately swallowed */}return'caught';}));assert(f.calls.some(q=>q.includes('AS profile FROM pg_proc')));assert(!f.calls.includes('SET LOCAL ROLE service_role'));});
test('governance source guard detects rejected baseline and confines elevation to fixed canonical helpers',()=>{const baseline=readFileSync('docs/implementation/niche-theme-programme/release-playfield201/native-qualification/tenant-correction/services__api-gateway__src__execution__theme-execution.adapter.ts.before.snapshot','utf8');assert(baseline.includes("SET LOCAL ROLE service_role"));const adapter=readFileSync(new URL('../execution/theme-execution.adapter.ts',import.meta.url),'utf8');assert(!adapter.includes('SET LOCAL ROLE service_role'));const helper=readFileSync(new URL('../lib/tenant-transaction.ts',import.meta.url),'utf8');assert.equal((helper.match(/SET LOCAL ROLE service_role/g)||[]).length,2);assert(helper.includes('ROLLBACK TO SAVEPOINT tenant_theme_publication'));assert(helper.includes("'theme.publish.capability_used'"));assert(helper.includes('if(frame.poisoned)throw'));});

test('read-only tenant catalogue permissions permit the guarded publisher without global UPDATE grants',async()=>{
 const f=loaded({validProfile:true}),s=scope();
 const result=await f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.publishThemeReleaseInTenantTx(tx,s,intent());});
 assert.equal(result.release_id,id);
 const locks=f.events.filter(event=>event.query.includes('FOR SHARE OF'));
 assert.equal(locks.length,3);
 assert(locks.filter(event=>event.role==='app_tenant').every(event=>/FOR SHARE OF [is]$/.test(event.query)));
 assert(locks.filter(event=>event.role==='service_role').some(event=>event.query.endsWith('FOR SHARE OF v,p,t')));
 assert(locks.filter(event=>event.role==='service_role').some(event=>event.query.endsWith('FOR SHARE OF r')));
 assert.equal(f.calls.filter(q=>q.includes('SELECT * FROM public.publish_theme_release')).length,1);
});
test('shadow profile refusal precedes global locking and privilege use even with read-only tenant captures',async()=>{
 const f=loaded({validProfile:true,shadow:true}),s=scope();
 await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.publishThemeReleaseInTenantTx(tx,s,intent());}),f.helper.TenantPublicationContextError);
 assert(!f.calls.includes('SET LOCAL ROLE service_role'));
});
for(const change of ['changedSelection','changedPrior'] as const)test(`${change}: trusted recheck refuses a changed publication target before the RPC`,async()=>{
 const f=loaded({validProfile:true,[change]:true}),s=scope();
 await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.publishThemeReleaseInTenantTx(tx,s,intent());}),f.helper.TenantPublicationContextError);
 assert(f.calls.includes('ROLLBACK TO SAVEPOINT tenant_theme_publication'));
 assert(!f.calls.some(q=>q.includes('SELECT * FROM public.publish_theme_release')));
 assert(f.events.some(event=>event.query.includes('SELECT current_user::text')&&event.role==='app_tenant'));
});
test('publisher failure restores tenant context and cannot be swallowed into an outer commit',async()=>{
 const f=loaded({validProfile:true,rpcFailure:true}),s=scope();
 await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);try{await f.helper.publishThemeReleaseInTenantTx(tx,s,intent());}catch{/* poisoned outer frame still refuses commit */}return'caught';}),f.helper.TenantPublicationContextError);
 assert(f.calls.includes('ROLLBACK TO SAVEPOINT tenant_theme_publication'));
 assert(!f.calls.some(q=>q.includes('INSERT INTO public.audit_activity_events')));
});

test('fixed catalogue read uses service permissions and restores its resolved tenant without writes',async()=>{
 const f=loaded({validProfile:true}),s=scope();
 const rows=await f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.readThemeUpdateTargetInTenantTx(tx,s,id);});
 assert.equal((rows[0].version as {id:string}).id,id);
 assert(!f.calls.some(q=>q.includes('SELECT * FROM public.publish_theme_release')||q.includes('INSERT INTO public.audit_activity_events')));
 assert(f.calls.includes('RELEASE SAVEPOINT tenant_theme_catalog_read'));
});
test('catalogue read refuses a foreign private theme before returning its data',async()=>{
 const f=loaded({validProfile:true,privateCatalog:true}),s=scope();
 await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.readThemeUpdateTargetInTenantTx(tx,s,id,true);}),/not available/);
 assert(f.calls.includes('ROLLBACK TO SAVEPOINT tenant_theme_catalog_read'));
 assert(!f.calls.some(q=>q.includes('SELECT * FROM public.publish_theme_release')));
});
test('catalogue read refuses an unbound actor before entering trusted permissions',async()=>{
 const f=loaded({validProfile:true}),s=scope();
 await assert.rejects(()=>f.helper.withTenantTx({} as Env,s.tenant,tx=>f.helper.readThemeUpdateTargetInTenantTx(tx,s,id)),f.helper.TenantPublicationContextError);
 assert(!f.calls.includes('SET LOCAL ROLE service_role'));
});

test('trusted selector preserves unavailable-version invisibility instead of exposing its metadata',async()=>{
 const f=loaded({validProfile:true,unavailableTarget:true}),s=scope();
 const rows=await f.helper.withTenantTx({} as Env,s.tenant,async tx=>{await f.helper.bindOwnedTenantActor(tx,s);return f.helper.readThemeUpdateTargetInTenantTx(tx,s,id,true);});
 assert.deepEqual(rows,[]);
 assert(!f.calls.some(q=>q.includes('SELECT * FROM public.publish_theme_release')));
});
