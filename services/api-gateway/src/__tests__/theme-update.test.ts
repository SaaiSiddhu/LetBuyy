// Actual production modules with a replaced pool: logic only; native RLS/commit proof remains required.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import ts from 'typescript';
import {Hono} from 'hono';
import type {OwnedStoreScope} from '../lib/tenant-context';
import type {Env} from '../index';
import {AppError,ForbiddenError,ConflictError,NotFoundError,ValidationError} from '../lib/errors';
import {parseLiquidThemePackageBundle,toThemeDocumentV2,fromThemeDocumentV2,planThemeSafeUpdate,UpdateDowngradeError} from '@letbuyy/theme-engine';
import {themeUpdateConfirmationHash} from '../routes/themes/theme-update-route';
const site='a0000000-0000-4000-8000-000000000001',actor='f0000000-0000-4000-8000-000000000001',targetId='c0000000-0000-4000-8000-000000000003',packageId='b0000000-0000-4000-8000-000000000002',priorId='d0000000-0000-4000-8000-000000000001',releaseId='e0000000-0000-4000-8000-000000000001';
const captured=(v:'2.0.0'|'2.0.1')=>parseLiquidThemePackageBundle(JSON.parse(readFileSync(new URL(v==='2.0.0'?'../../../../docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-bloom-2.0.0.json':'../../../../docs/implementation/niche-theme-programme/release-playfield201/proposals/6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c/letbuyy-bloom-2.0.1.json',import.meta.url),'utf8')).document.liquidBundle);
const ownedScope=():OwnedStoreScope=>({siteId:site,storeId:site,db:{} as OwnedStoreScope['db'],authUser:{id:actor,email:'synthetic@example.invalid',storeId:site},customUser:{id:actor,email:'synthetic@example.invalid'},tenant:{siteId:site,userId:actor,requestId:'synthetic-request:123',membershipId:null,roles:['owner'],permissions:['store:owner'],plan:'enterprise',entitlements:{}}});
function profile(){return{row:{prosecdef:true,prokind:'f',pronargs:10,pronargdefaults:7,proretset:true,provolatile:'v',proparallel:'u',proisstrict:false,proleakproof:false,procost:100,prorows:1000,proconfig:['search_path=public'],proargnames:['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']},defaults:'NULL::uuid, NULL::integer, NULL::uuid, NULL::text, true, NULL::text, NULL::uuid',body_md5:'56a6b7b15e8a7ec159341fe0331ac593',owner_matches:true,owner_bypass:true,plpgsql:true,abi_valid:true,allowed_acl:true,service_execute:true,tenant_execute:false,anon_execute:false,authenticated_execute:false,shadows:false};}
function moduleWith(file:string,overrides:Record<string,unknown>){const filename=resolve(file),require=createRequire(filename),loadedModule={exports:{}};const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','module','exports','__filename','__dirname',js)((name:string)=>Object.hasOwn(overrides,name)?overrides[name]:require(name),loadedModule,loadedModule.exports,filename,dirname(filename));return loadedModule.exports;}
function fixture(mode='success'){
 const scope=ownedScope(),old=captured('2.0.0'),next=captured('2.0.1'),plan=planThemeSafeUpdate({currentDocument:toThemeDocumentV2(old),nextBundle:next});
 const input={scope,themeSlug:'letbuyy-bloom',targetPackageVersionId:targetId,currentReleaseId:priorId,mergedBundle:fromThemeDocumentV2(plan.updatedDoc),currentReleaseConfig:{liquidBundle:old},idempotencyKey:'synthetic-key',requestHash:'a'.repeat(64),confirmedDiffHash:'b'.repeat(64),diff:plan.diff,requiresConfirmation:plan.requiresConfirmation,makeStoreLive:true};
 const version={id:targetId,theme_package_id:packageId,version:'2.0.1',version_number:3,schema_version:next.schema_version,renderer_version:next.renderer.renderer_version,release_status:'published',deleted_at:null as string|null,package_manifest:{liquidBundle:next}};
 const pkg={id:packageId,slug:'letbuyy-bloom',status:'active',deleted_at:null as string|null,legacy_theme_id:'7b669c70-0000-4000-8000-000000000008'},catalog={id:pkgId(),slug:'letbuyy-bloom',is_active:true,is_site_private:false,owned_by_site_id:null as string|null};
 function pkgId(){return'7b669c70-0000-4000-8000-000000000008';}
 let role='authenticator',commits=0,rollbacks=0,published=0,profileReads=0;const guc:Record<string,string>={},calls:Array<{query:string;params:unknown[];role:string}>=[];
 const unsafe=async(query:string,params:unknown[]=[])=>{
  calls.push({query,params,role});
  if(query==='SET LOCAL ROLE service_role'){role='service_role';return[];}
  if(query==='SET LOCAL ROLE app_tenant'){if(mode==='restore-fault'&&published)throw new Error('PRIVATE_RESTORE');role='app_tenant';return[];}
  if(query.startsWith('ROLLBACK TO SAVEPOINT')){role='app_tenant';return[];}
  if(query.startsWith('SAVEPOINT')||query.startsWith('RELEASE SAVEPOINT'))return[];
  if(role==='service_role'&&!query.includes('SELECT * FROM public.publish_theme_release')&&!query.includes('to_jsonb(v) AS version')&&!query.includes('SELECT i.id FROM public.theme_instances')&&!query.includes('AS prior_package_version_id'))throw new Error('Privileged tenant query outside fixed capabilities');
  if(query.includes('SELECT current_user::text'))return[{role,site_id:guc['app.site_id'],request_id:guc['app.request_id'],actor_id:guc['app.actor_id'],subject:guc['request.jwt.claim.sub']}];
  if(query.includes('SELECT set_config')){for(let i=0;i<params.length;i+=2)guc[String(params[i])]=String(params[i+1]);return[];}
  if(query.includes('SELECT id FROM public.sites'))return mode==='foreign'?[]:[{id:site}];
  if(query.includes('AS profile FROM pg_proc')){profileReads++;const p=profile();if(mode==='profile-drift'&&profileReads>1)p.body_md5='different';if(mode==='temp-shadow')p.shadows=true;if(mode==='tenant-grant')p.tenant_execute=true;return[{profile:p}];}
  if(query.includes('to_jsonb(v) AS version'))return mode==='missing-target'||version.deleted_at!==null||version.release_status!=='published'?[]:[{version,package:pkg,catalog}];
  if(query.includes('idempotency_key=$3'))return mode==='replay'||mode==='changed-key'?[{id:releaseId,release_version:8,published_at:new Date('2026-10-24T00:00:00Z'),metadata:{theme_version_update:{request_hash:mode==='changed-key'?'different':input.requestHash,diff:plan.diff,requires_confirmation:false}}}]:[];
  if(query.includes('SELECT id,release_config'))return mode==='missing-release'?[]:[{id:priorId,release_config:input.currentReleaseConfig}];
  if(query.includes('SELECT id,theme_instance_id'))return mode==='stale'?[]:[{id:priorId,theme_instance_id:actor}];
  if(query.includes('SELECT id FROM public.theme_instances'))return[{id:actor}];
  if(query.includes('SELECT i.id FROM public.theme_instances'))return[{id:actor}];
  if(query.includes('AS prior_package_version_id'))return mode==='stale-prior'?[]:[{prior_package_version_id:packageId}];
  if(query.includes('SELECT * FROM public.publish_theme_release')){published++;if(mode==='publisher-fault')throw Object.assign(new Error('PRIVATE_SQL_DIAGNOSTIC'),{code:'P0001'});return[{release_id:releaseId,release_version:8,published_at:mode==='string-date'?'2026-10-24T00:00:00Z':new Date('2026-10-24T00:00:00Z')}];}
  if(query.includes('INSERT INTO public.audit_activity_events')){if(mode==='audit-fault')throw new Error('PRIVATE_AUDIT');return[{id:actor}];}
  if(query.includes('UPDATE public.theme_releases')){if(mode==='enrich-fault')throw new Error('PRIVATE_ENRICH');return[{id:releaseId}];}
  return[];
 };
 const sql={begin:async(callback:(tx:{unsafe:typeof unsafe})=>Promise<unknown>)=>{try{if(mode==='concurrency')throw Object.assign(new Error('private concurrency'),{code:'40001'});const result=await callback({unsafe});commits++;return result;}catch(error){rollbacks++;throw error;}finally{role='authenticator';}}};
 const tenant=moduleWith('services/api-gateway/src/lib/tenant-transaction.ts',{'@letbuyy/infrastructure/pooled-sql-adapter':{getPooledSql:()=>{if(mode==='transport-fault')throw Object.assign(new Error('SYNTHETIC_URI_SECRET'),{code:'SYNTHETIC_CODE_SECRET'});return mode==='missing-transport'?null:sql;}}});
 const loaded=moduleWith('services/api-gateway/src/execution/theme-execution.adapter.ts',{'../lib/tenant-transaction':tenant}) as typeof import('../execution/theme-execution.adapter');
 return{adapter:new loaded.ThemeExecutionAdapter(scope.db,site,{} as Env),input,scope,version,pkg,catalog,calls,sql,tenant:tenant as typeof import('../lib/tenant-transaction'),published:()=>published,commits:()=>commits,rollbacks:()=>rollbacks};
}
test('confirmation binds exact diff, base release and target UUID',async()=>{const f=fixture(),hash=await themeUpdateConfirmationHash(f.input.diff,priorId,targetId);assert.match(hash,/^[0-9a-f]{64}$/);assert.equal(await themeUpdateConfirmationHash(f.input.diff,priorId,targetId),hash);assert.notEqual(await themeUpdateConfirmationHash(f.input.diff,actor,targetId),hash);assert.notEqual(await themeUpdateConfirmationHash(f.input.diff,priorId,actor),hash);});
test('canonical resolver precedes adapter; route has no raw pool or body-derived GUC',()=>{const s=readFileSync(new URL('../routes/themes/theme-update-route.ts',import.meta.url),'utf8');assert.equal((s.match(/await resolveOwnedStoreScope\(c,storeId\)/g)||[]).length,2);assert(!/getPooledSql|getSupabaseAdmin|set_config/.test(s));assert(s.indexOf('await resolveOwnedStoreScope')<s.indexOf('new ThemeExecutionAdapter'));assert(s.includes('scope.siteId'));});
test('existing auth middleware and update route mounting remain intact',()=>{const s=readFileSync(new URL('../routes/themes.ts',import.meta.url),'utf8');for(const path of ['update','update-preview']){const auth=s.indexOf(`router.use('/:slug/${path}', authMiddleware)`),editor=s.indexOf("router.use('/:slug/editor', authMiddleware)");assert(auth>=0&&editor>=0);assert(auth<editor);}assert(s.includes('mountThemeUpdateRoutes(router)'));});
for(const kind of ['public','private'])test(`selected ${kind} target has guarded read-only positive control`,async()=>{const f=fixture();if(kind==='private'){f.catalog.is_site_private=true;f.catalog.owned_by_site_id=site;}assert.equal((await f.adapter.loadTargetPackageVersionBundle(targetId,f.scope,'letbuyy-bloom')).package.version,'2.0.1');assert(!f.calls.some(c=>/^UPDATE |INSERT |SELECT \* FROM public.publish/.test(c.query)));assert(f.calls.filter(c=>c.query.includes('to_jsonb(v)')).every(c=>c.role==='service_role'));assert(f.calls.some(c=>c.query==='SET LOCAL ROLE app_tenant'));});
for(const change of ['deleted-version','revoked','disabled-package','deleted-package','wrong-package','identity','unsupported','missing-bundle','foreign-private'])test(`target ${change} refuses without mutation`,async()=>{const f=fixture();if(change==='deleted-version')f.version.deleted_at='2026-10-24';if(change==='revoked')f.version.release_status='revoked';if(change==='disabled-package')f.pkg.status='disabled';if(change==='deleted-package')f.pkg.deleted_at='2026-10-24';if(change==='wrong-package')f.pkg.slug='another';if(change==='identity')f.version.version_number=9;if(change==='unsupported')f.version.package_manifest.liquidBundle.schema_version='unknown';if(change==='missing-bundle')delete (f.version.package_manifest as {liquidBundle?:unknown}).liquidBundle;if(change==='foreign-private'){f.catalog.is_site_private=true;f.catalog.owned_by_site_id=actor;}await assert.rejects(()=>f.adapter.loadTargetPackageVersionBundle(targetId,f.scope,'letbuyy-bloom'),e=>e instanceof NotFoundError||e instanceof ValidationError||e instanceof ForbiddenError);assert(!f.calls.some(c=>/^UPDATE |INSERT |SELECT \* FROM public.publish/.test(c.query)));});
test('missing current release refuses without privileged fallback',async()=>{const f=fixture('missing-release');await assert.rejects(()=>f.adapter.loadCurrentReleaseBundle(f.scope,'letbuyy-bloom'),NotFoundError);assert.equal(f.published(),0);});
for(const mode of ['success','string-date'])test(`${mode}: selected pin, fixed publisher, capability audit and enrichment share canonical transaction`,async()=>{const f=fixture(mode),result=await f.adapter.publishVersionUpdateRelease(f.input);assert.equal(result.published_at,'2026-10-24T00:00:00.000Z');assert.equal(result.release_id,releaseId);assert.equal(f.commits(),1);assert.equal(f.published(),1);assert(f.calls.filter(c=>c.role==='service_role').every(c=>c.query.includes('SELECT * FROM public.publish_theme_release')||c.query.includes('to_jsonb(v) AS version')||c.query.includes('SELECT i.id FROM public.theme_instances')||c.query.includes('AS prior_package_version_id')||c.query==='SET LOCAL ROLE app_tenant'||c.query.startsWith('ROLLBACK TO SAVEPOINT')));assert(f.calls.filter(c=>/^UPDATE |INSERT INTO public.audit/.test(c.query)).every(c=>c.role==='app_tenant'));assert.equal(f.calls.filter(c=>c.query.includes('INSERT INTO public.audit_activity_events')).length,1);const audit=f.calls.find(c=>c.query.includes('INSERT INTO public.audit_activity_events'))!;assert.deepEqual(audit.params,[site,actor,releaseId,f.scope.tenant.requestId,targetId,priorId,f.input.requestHash,packageId]);assert(!f.calls.some(c=>/UPDATE.*theme_(?:editor_drafts|instance_drafts|draft_patches)/.test(c.query)));assert.equal(JSON.parse(String(f.calls.find(c=>c.query.startsWith('UPDATE public.theme_releases'))!.params[4])).theme_package_version_id,targetId);});
for(const mode of ['foreign','stale','changed-key'])test(`${mode} refuses before mutation/capability`,async()=>{const f=fixture(mode);await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),e=>e instanceof ForbiddenError||e instanceof ConflictError);assert(!f.calls.some(c=>/^UPDATE |INSERT |SELECT \* FROM public.publish/.test(c.query)));});
test('response-loss replay reads receipt under app_tenant without publication/audit',async()=>{const f=fixture('replay'),result=await f.adapter.findVersionUpdateReplay(f.scope,'letbuyy-bloom','synthetic-key',f.input.requestHash);assert.equal(result!.idempotent,true);assert.equal(result!.published_at,'2026-10-24T00:00:00.000Z');assert.equal(f.published(),0);const read=f.calls.find(c=>c.query.includes('idempotency_key=$3'))!;assert.equal(read.role,'app_tenant');assert.deepEqual(read.params,[site,'letbuyy-bloom','synthetic-key']);assert(!f.calls.some(c=>/^UPDATE |INSERT /.test(c.query)));});
test('exact replay under mutation lock has one effect',async()=>{const f=fixture('replay');assert.equal((await f.adapter.publishVersionUpdateRelease(f.input)).idempotent,true);assert.equal(f.published(),0);assert(!f.calls.some(c=>/^UPDATE |INSERT /.test(c.query)));});
test('changed receipt request conflicts',async()=>{const f=fixture('changed-key');await assert.rejects(()=>f.adapter.findVersionUpdateReplay(f.scope,'letbuyy-bloom','synthetic-key',f.input.requestHash),ConflictError);assert.equal(f.published(),0);});
test('missing transport remains503 and concurrency remains409',async()=>{for(const mode of ['missing-transport','concurrency']){const f=fixture(mode);await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),e=>e instanceof AppError&&e.statusCode===(mode==='concurrency'?409:503));assert.equal(f.commits(),0);}});
for(const mode of ['publisher-fault','audit-fault','enrich-fault','profile-drift','restore-fault','transport-fault','temp-shadow','tenant-grant'])test(`${mode}: no successful transaction and sanitized INTERNAL_ERROR`,async t=>{const lines:unknown[][]=[];t.mock.method(console,'error',(...args:unknown[])=>{lines.push(args);});const f=fixture(mode);f.scope.tenant.requestId='bad\nSYNTHETIC_SECRET';await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),e=>e instanceof AppError&&e.code==='INTERNAL_ERROR'&&e.statusCode===500);assert.equal(f.commits(),0);assert.equal(lines.length,1);const log=JSON.parse(String(lines[0][0]));assert.equal(log.operation,'theme.version_update');assert(!Object.hasOwn(log,'request_id'));assert.doesNotMatch(JSON.stringify(lines),/PRIVATE_|SYNTHETIC_SECRET|SYNTHETIC_URI_SECRET|SYNTHETIC_CODE_SECRET|liquidBundle|\b(?:SELECT|UPDATE)\s/);if(mode==='temp-shadow'||mode==='tenant-grant')assert.equal(f.published(),0);});
test('scope actor mismatch cannot set actor or publish',async t=>{t.mock.method(console,'error',()=>{});const f=fixture();f.scope.tenant.userId=releaseId;await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input));assert.equal(f.published(),0);assert(!f.calls.some(c=>c.query==='SET LOCAL ROLE service_role'));});
test('package downgrade remains a canonical pure rejection',()=>{assert.throws(()=>planThemeSafeUpdate({currentDocument:toThemeDocumentV2(captured('2.0.1')),nextBundle:captured('2.0.0')}),UpdateDowngradeError);});

test('unknown selected version is404 without mutation',async()=>{const f=fixture('missing-target');await assert.rejects(()=>f.adapter.loadTargetPackageVersionBundle(targetId,f.scope,'letbuyy-bloom'),NotFoundError);assert(!f.calls.some(c=>/^UPDATE |INSERT /.test(c.query)));});
test('current release is read under the positively verified tenant',async()=>{const f=fixture();const current=await f.adapter.loadCurrentReleaseBundle(f.scope,'letbuyy-bloom');assert.equal(current.currentDocument.package.version,'2.0.0');const call=f.calls.find(c=>c.query.includes('SELECT id,release_config'))!;assert.equal(call.role,'app_tenant');assert.deepEqual(call.params,[site,'letbuyy-bloom']);});

test('fixed capability rejects a changed active prior release before publication',async t=>{t.mock.method(console,'error',()=>{});const f=fixture('stale-prior');await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),e=>e instanceof AppError&&e.statusCode===500);assert(!f.calls.some(c=>c.query.includes('SELECT * FROM public.publish_theme_release')||c.query.includes('INSERT INTO public.audit_activity_events')));assert.equal(f.commits(),0);assert.equal(f.rollbacks(),1);});

test('route retains both422 mappings and orders reviewed merge, confirmation, conversion before publication',()=>{const s=readFileSync(new URL('../routes/themes/theme-update-route.ts',import.meta.url),'utf8');for(const pair of [['UpdateVersionRejectedError','updateVersionRejectedResponse'],['UpdateDowngradeError','updateDowngradeResponse']]){const pattern=new RegExp(`if \\(err instanceof ${pair[0]}\\) \\{\\s*return c\\.json\\(${pair[1]}\\(err\\), 422\\);`,'g');assert.equal([...s.matchAll(pattern)].length,2);}const post=s.slice(s.indexOf("router.post('/:slug/update'")),plan=post.indexOf('const result = planThemeSafeUpdate('),confirm=post.indexOf('if (computedHash !== confirmDiffHash)'),convert=post.indexOf('const mergedBundle = fromThemeDocumentV2(result.updatedDoc)'),publish=post.indexOf('await adapter.publishVersionUpdateRelease(');assert(plan>=0&&confirm>plan&&convert>confirm&&publish>convert);assert(post.includes("code: 'DIFF_HASH_MISMATCH'"));});
test('current release read refuses changed ownership without privileged fallback',async()=>{const f=fixture('foreign');await assert.rejects(()=>f.adapter.loadCurrentReleaseBundle(f.scope,'letbuyy-bloom'),ForbiddenError);assert(!f.calls.some(c=>c.query==='SET LOCAL ROLE service_role'||c.query.includes('SELECT id,release_config')));});

test('version update plans from published merchant templates and settings rather than captured defaults',async()=>{
 const f=fixture(),original=captured('2.0.0'),templates=structuredClone(original.templates);
 const edited=Object.values(templates.index.sections).find(section=>typeof section.settings.heading==='string');assert(edited);
 edited.settings.heading='Published merchant heading';edited.disabled=true;
 Object.assign(f.input.currentReleaseConfig,{templates,themeSettings:{primaryColor:'#123456'}});
 const before=JSON.stringify(f.input.currentReleaseConfig);
 const current=await f.adapter.loadCurrentReleaseBundle(f.scope,'letbuyy-bloom');
 const effective=fromThemeDocumentV2(current.currentDocument);
 const actual=Object.values(effective.templates.index.sections).find(section=>section.settings.heading==='Published merchant heading');
 assert(actual,'published heading must enter the safe update planner');assert.equal(actual.disabled,true);
 assert.equal(effective.config.settings_data.current.primaryColor,'#123456');
 assert.deepEqual(effective.layout,original.layout);assert.deepEqual(effective.sections,original.sections);
 assert.equal(JSON.stringify(f.input.currentReleaseConfig),before,'reading published overrides must not mutate its immutable snapshot');
 const updated=fromThemeDocumentV2(planThemeSafeUpdate({currentDocument:current.currentDocument,nextBundle:captured('2.0.1')}).updatedDoc);
 assert.match(JSON.stringify(updated.templates),/Published merchant heading/);
 assert.equal(updated.config.settings_data.current.primaryColor,'#123456');
});

test('version update preserves an explicit published setting clear',async()=>{
 const f=fixture(),templates=structuredClone(captured('2.0.0').templates);
 const sectionId=Object.keys(templates.index.sections).find(id=>typeof templates.index.sections[id].settings.heading==='string');assert(sectionId);
 templates.index.sections[sectionId].settings.heading='';
 Object.assign(f.input.currentReleaseConfig,{templates});
 const current=await f.adapter.loadCurrentReleaseBundle(f.scope,'letbuyy-bloom');
 const effective=fromThemeDocumentV2(current.currentDocument);
 assert.equal(effective.templates.index.sections[sectionId].settings.heading,'');
});
test('safe trace survives unexpected transport logs without arbitrary error codes',async t=>{const lines:unknown[][]=[];t.mock.method(console,'error',(...args:unknown[])=>{lines.push(args);});const f=fixture('transport-fault');await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),e=>e instanceof AppError&&e.code==='INTERNAL_ERROR');assert.equal(lines.length,1);const log=JSON.parse(String(lines[0][0]));assert.equal(log.request_id,f.scope.tenant.requestId);assert(!Object.hasOwn(log,'sqlstate'));assert.doesNotMatch(JSON.stringify(log),/SYNTHETIC_URI_SECRET|SYNTHETIC_CODE_SECRET/);});
test('known conflict remains409 without unexpected-error logging',async t=>{let lines=0;t.mock.method(console,'error',()=>{lines++;});const f=fixture('concurrency');await assert.rejects(()=>f.adapter.publishVersionUpdateRelease(f.input),ConflictError);assert.equal(lines,0);});

// Actual route control flow with injected scope/adapter; no authentication or DB acceptance claim.
test('exact retry survives a commit between its first receipt read and current baseline read',async()=>{
 const f=fixture(),next=captured('2.0.1');let receipts=0,publishes=0;
 const route=moduleWith('services/api-gateway/src/routes/themes/theme-update-route.ts',{
  '../../lib/tenant-context':{resolveOwnedStoreScope:async()=>f.scope},
  '../../execution/theme-execution.adapter':{ThemeExecutionAdapter:class{
   async loadTargetPackageVersionBundle(){return next;}
   async findVersionUpdateReplay(){return ++receipts===1?null:{release_id:releaseId,release_version:8,published_at:'2026-10-24T00:00:00.000Z',idempotent:true,diff:f.input.diff,requiresConfirmation:false};}
   async loadCurrentReleaseBundle(){return{currentDocument:toThemeDocumentV2(next),currentReleaseConfig:{liquidBundle:next},currentReleaseId:releaseId};}
   async publishVersionUpdateRelease(){publishes++;throw new Error('Exact retry must not republish');}
  }}
 }) as typeof import('../routes/themes/theme-update-route');
 const app=new Hono<{Bindings:Env}>();route.mountThemeUpdateRoutes(app);
 const confirm=await themeUpdateConfirmationHash(f.input.diff,priorId,targetId);
 const response=await app.request('/letbuyy-bloom/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({store_id:site,target_package_version_id:targetId,confirm_diff_hash:confirm,idempotency_key:'synthetic-key',make_store_live:true})},{} as Env);
 assert.equal(response.status,200,await response.clone().text());const body=await response.json();assert(body!==null&&typeof body==='object'&&'release_id'in body&&'idempotent'in body);assert.equal(body.release_id,releaseId);assert.equal(body.idempotent,true);assert.equal(receipts,2);assert.equal(publishes,0);
});
