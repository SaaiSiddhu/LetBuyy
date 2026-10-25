// PREPARATION ONLY until Themes/Root independently admit this exact source,
// proposal and one fresh owned native lane. No discoverable test/migration.
import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import {LiquidThemePackageBundleSchema,qualifiedFirstPartyInlineChildParents,createFirstPartyCatalogBundle} from '@letbuyy/theme-engine';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';

const directory='docs/implementation/niche-theme-programme/completion-2026-10-24/order-heading211-integration01/';
const read=(path:string)=>readFileSync(resolve(path),'utf8'),hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const pin=z.string().regex(/^[a-f0-9]{64}$/);
// This file is deliberately absent from a preparation packet. Only the later
// allocator may write it after reviewing source/profile/effect-budget/cleanup.
const admission=z.object({status:z.literal('ROOT_ONE_FRESH_ORDER_HEADING211_NATIVE'),sourceClosurePath:z.string(),sourceClosureSha256:pin,sourceFiles:z.array(z.object({path:z.string(),sha256:pin})).min(100),proposalUpSha256:pin,proposalDownSha256:pin,migrationCount:z.number().int().positive(),migrationMaximum:z.number().int().positive(),migrationCeiling:z.null(),faithfulBootstrapSha256:pin,setupSql:z.array(z.object({path:z.string(),sha256:pin})).min(2),cohortWallSeconds:z.literal(600),effectBudget:z.literal('EIGHT_NATIVE_SITES_INSTALLS_DRAFTS_RELEASES_FOUR_RPC_ORDERS_NOT_THEME_UI_CASES')}).strict().parse(JSON.parse(read(directory+'NATIVE_ADMISSION.json')));
assert.equal(hash(read(admission.sourceClosurePath)),admission.sourceClosureSha256);
for(const file of admission.sourceFiles)assert.equal(hash(read(file.path)),file.sha256,file.path);
assert.equal(hash(read('scripts/governance/supabase-faithful-bootstrap.mjs')),admission.faithfulBootstrapSha256);
const migrationNames=readdirSync('database/supabase/migrations').filter(name=>/^\d+.*\.sql$/.test(name));
assert.equal(migrationNames.length,admission.migrationCount);assert.equal(Math.max(...migrationNames.map(name=>Number(name.match(/^\d+/)![0]))),admission.migrationMaximum);
const up=read(directory+'heading211.up.proposal.sql'),down=read(directory+'heading211.down.proposal.sql');
assert.equal(hash(up),admission.proposalUpSha256);assert.equal(hash(down),admission.proposalDownSha256);
const setupExpected=["docs/implementation/niche-theme-programme/release-playfield201/proposals394/f5f54a8009732ff71ba248e1f3356f58441e8b2340225c47b19e5ac386ac790e/394_playfield_catalog_201.up.draft.sql", "docs/implementation/niche-theme-programme/completion-2026-10-24/shared-integration01/cart-edit03.qualified-up.proposal.sql", "docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03/UNNUMBERED_circuit_facets.up.proposal.sql", "docs/implementation/niche-theme-programme/completion-2026-10-24/child-customization-integration01/customization210.up.proposal.sql"];
const sharedSetup=z.object({status:z.literal('ROOT_QUALIFIED_SHARED_PROPOSALS_FOR_OWNED_BROWSER_FIXTURE'),upProposals:z.array(z.object({path:z.string(),sha256:pin})).length(4)}).passthrough().parse(JSON.parse(read('docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json')));
assert.deepEqual(admission.setupSql,sharedSetup.upProposals);
assert.deepEqual(admission.setupSql.map(row=>row.path),setupExpected);
for(const row of admission.setupSql)assert.equal(hash(read(row.path)),row.sha256);
const owned=requireOwnedDatabase();
const evidence=mkdtempSync(join(tmpdir(),'letbuyy-heading211-qualification-'+owned.runId+'-'));
const q=(value:string)=>"'"+value.replaceAll("'","''")+"'",ident=(value:string)=>'"'+value.replaceAll('"','""')+'"';
const slugs=['letbuyy-craft','letbuyy-dawn','letbuyy-nova','letbuyy-summit'],slugList=slugs.map(q).join(',');
function proof(name:string,value:unknown){const bytes=JSON.stringify({runId:owned.runId,name,value},null,2)+'\n',path=join(evidence,name+'.json');writeFileSync(path,bytes,{mode:0o600,flag:'wx'});console.info('HEADING211_QUALIFICATION_PROVENANCE',JSON.stringify({path,sha256:hash(bytes)}));}
function tables(){
 const names=z.array(z.string()).parse(JSON.parse(owned.psql("SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p');")));
 assert.ok(names.length>300,'A faithful populated public schema is required, not a narrow replacement database');
 const raw=owned.scriptLarge('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL jit=off;'+names.map(name=>`SELECT jsonb_build_object('table',${q(name)},'count',count(*),'hash',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex')) FROM public.${ident(name)} x;`).join('\n')+'COMMIT;');
 const rows=raw.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>z.object({table:z.string(),count:z.number(),hash:pin}).parse(JSON.parse(line)));assert.deepEqual(rows.map(row=>row.table),names);return rows;
}
const snapshot=(table:string,predicate='true')=>owned.scriptLarge(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.${ident(table)} x WHERE ${predicate};`);
const securityProfile=()=>owned.scriptLarge(`SELECT jsonb_build_object('relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','S')),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')),'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'));`);
const managed=['name','category','version','default_template','section_schemas','block_schemas','settings_schema','renderer_manifest','schema_version','renderer_version','config','updated_at'];
const unmanagedThemes=()=>owned.scriptLarge(`SELECT jsonb_agg(to_jsonb(t)-ARRAY[${managed.map(q).join(',')}] ORDER BY id) FROM public.themes t;`);
const catalog=()=>owned.scriptLarge("SELECT jsonb_agg(to_jsonb(t)-'updated_at' ORDER BY id) FROM public.themes t;");
const captures=['theme_packages','theme_package_versions','theme_schema_manifests','theme_renderer_manifests'];
const transactionBody=(sql:string)=>sql.replace(/(^|\n)BEGIN;(?=\n)/,'$1').replace(/\nCOMMIT;\s*$/,'');
type OperationalRow = Record<string, unknown>;
type OperationalFamily = {base:string;parent:string;leaves:string[]};
type ReadbackObservation = {requestId:string;traceId:string;route:string;status:number;actorId:string;siteId:null;runtimeName:string;ipAddress:string;userAgent:string};
function assertReadbackTelemetry(before:Record<string,OperationalRow[]>,after:Record<string,OperationalRow[]>,requests:ReadbackObservation[],families:OperationalFamily[]){
 assert.equal(requests.length,4,'Exactly four admitted editor readbacks');
 assert.equal(new Set(requests.map(row=>row.requestId)).size,4);assert.equal(new Set(requests.map(row=>row.traceId)).size,4);
 assert.deepEqual(families.map(row=>row.base).sort(),['runtime_telemetry_metrics','worker_request_logs']);
 const names=[...new Set(families.flatMap(row=>[row.base,row.parent,...row.leaves]))].sort();
 assert.deepEqual(Object.keys(before).sort(),names);assert.deepEqual(Object.keys(after).sort(),names);
 const ordered=(rows:OperationalRow[])=>[...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const timestamp=(value:unknown)=>assert(typeof value==='string'&&Number.isFinite(Date.parse(value)),'Bound timestamp');
 const result:Array<{base:string;retainedRows:number;newRows:number}>=[];
 for(const family of families){
  assert.equal(family.parent,family.base+'_partitioned');assert.ok(family.leaves.length>0);
  for(const leaf of family.leaves)assert(new RegExp('^'+family.parent+'_(?:\\d{4}_\\d{2}|default)$').test(leaf));
  for(const source of [before,after]){
   const baseRows=source[family.base];assert.equal(new Set(baseRows.map(row=>row.id)).size,baseRows.length,'No duplicate operational IDs');
   assert.deepEqual(ordered(source[family.parent]),ordered(baseRows),'Exact parent mirror');
   assert.deepEqual(ordered(family.leaves.flatMap(name=>source[name])),ordered(baseRows),'Exact complete leaf mirror');
  }
  const oldRows=before[family.base],all=after[family.base],oldById=new Map(oldRows.map(row=>[row.id,row]));
  const afterById=new Map(all.map(row=>[row.id,row]));
  for(const row of oldRows)assert.deepEqual(afterById.get(row.id),row,'Every pre-existing operational row stays byte/field exact');
  const added=all.filter(row=>!oldById.has(row.id));assert.equal(added.length,4,'Only four exact admitted request records');assert.equal(all.length,oldRows.length+4);
  for(const request of requests){
   assert.equal(request.status,200);assert.equal(request.route,'/v1/themes/:slug/editor');
   const matches=added.filter(row=>row.request_id===request.requestId);assert.equal(matches.length,1,'One row per response request ID');const row=matches[0];
   assert.equal(row.trace_id,request.traceId);assert.equal(row.site_id,request.siteId);assert.equal(row.deleted_at,null);
   assert.match(String(row.id),/^[a-f0-9]{8}-[a-f0-9-]{27}$/i);timestamp(row.created_at);timestamp(row.updated_at);
   if(family.base==='worker_request_logs'){
    assert.deepEqual(Object.keys(row).sort(),['id','site_id','request_id','trace_id','method','path','route','status_code','latency_ms','user_id','auth_source','ip_address','user_agent','error_code','metadata','created_by','updated_by','created_at','updated_at','deleted_at'].sort());
    assert.equal(row.method,'GET');assert.equal(row.path,request.route);assert.equal(row.route,request.route);assert.equal(row.status_code,200);
    assert.equal(row.user_id,request.actorId);assert.equal(row.auth_source,'internal-sso');assert.equal(row.created_by,request.actorId);assert.equal(row.updated_by,request.actorId);
    assert.equal(row.ip_address,request.ipAddress);assert.equal(row.user_agent,request.userAgent);assert.equal(row.error_code,null);
    assert(typeof row.latency_ms==='number'&&Number.isInteger(row.latency_ms)&&row.latency_ms>=0);
    assert.deepEqual(row.metadata,{country:null,colo:null,request_log_sample_reason:'authenticated',request_log_sample_rate:1});
   }else{
    assert.deepEqual(Object.keys(row).sort(),['id','metric_name','metric_value','unit','runtime_name','site_id','dimensions','request_id','correlation_id','trace_id','recorded_at','created_by','updated_by','created_at','updated_at','deleted_at'].sort());
    assert.equal(row.metric_name,'letbuyy.runtime.request');assert.equal(row.metric_value,1);assert.equal(row.unit,'count');assert.equal(row.runtime_name,request.runtimeName);
    assert.equal(row.correlation_id,request.requestId);assert.equal(row.created_by,null);assert.equal(row.updated_by,null);timestamp(row.recorded_at);
    const log=after.worker_request_logs.find(entry=>entry.request_id===request.requestId);assert.ok(log);
    const latency=log.latency_ms;assert(typeof latency==='number'&&Number.isInteger(latency)&&latency>=0);
    assert.deepEqual(row.dimensions,{route:request.route,method:'GET',status_code:200,status_class:'2xx',latency_ms:latency,server_error_count:0,client_error_count:0,success_count:1,auth_source:'internal-sso',country:null,colo:null});
   }
  }
  result.push({base:family.base,retainedRows:oldRows.length,newRows:added.length});
 }
 return result;
}

const observedReadbacks:ReadbackObservation[]=[];
function operationalFamilies(){return z.array(z.object({base:z.string(),parent:z.string(),leaves:z.array(z.string()).min(1)})).length(2).parse(JSON.parse(owned.scriptLarge(`SELECT jsonb_agg(jsonb_build_object('base',v.base,'parent',v.parent,'leaves',(SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_partition_tree(('public.'||v.parent)::regclass) t JOIN pg_class c ON c.oid=t.relid WHERE t.isleaf))) FROM (VALUES ('worker_request_logs','worker_request_logs_partitioned'),('runtime_telemetry_metrics','runtime_telemetry_metrics_partitioned')) v(base,parent);`)));}
function operationalRows(families:OperationalFamily[]){return Object.fromEntries([...new Set(families.flatMap(row=>[row.base,row.parent,...row.leaves]))].map(name=>[name,z.array(z.record(z.string(),z.unknown())).parse(JSON.parse(snapshot(name)))]));}
const cohortStartedAt=Date.now();
function requireCohortBudget(){assert(Date.now()-cohortStartedAt<admission.cohortWallSeconds*1000,'Native600s cohort budget exhausted; later phases remain NOT_RUN');}

let gateway:Gateway|undefined,proxy:OwnedPooledSqlProxy|undefined;
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});

test('four211 exact captures: positive installed/history conservation, replay/refusal, paired DOWN and final replay',{timeout:600_000},async()=>{
 requireCohortBudget();
 for(const row of admission.setupSql)owned.scriptLarge(read(row.path));
 assert.equal(owned.psql("SELECT count(*) FROM themes WHERE slug LIKE 'letbuyy-%' AND id::text LIKE '7b669c70-%' AND version='2.1.0';"),'10');
 // Positive catalog population precedes direct role denials, so an empty
 // schema cannot make isolation appear green. Keep the qualified393/404 fence.
 for(const table of ['themes','theme_package_versions','theme_schema_manifests','theme_renderer_manifests']){
  assert.equal(owned.psql(`SELECT has_table_privilege('app_tenant',${q('public.'+table)},'SELECT');`),'f');
  assert.equal(owned.psql(`SELECT has_table_privilege('app_tenant',${q('public.'+table)},'UPDATE');`),'f');
  assert.equal(owned.psql(`SELECT has_table_privilege('service_role',${q('public.'+table)},'SELECT');`),'t');
 }
 assert.equal(owned.psql("SELECT has_table_privilege('service_role','public.themes','UPDATE');"),'t');
 assert.match(owned.psqlExpectError('SET ROLE app_tenant;SELECT id FROM public.themes LIMIT 1;'),/permission denied/);
 assert.match(owned.psqlExpectError("SET ROLE app_tenant;UPDATE public.themes SET name=name WHERE slug='letbuyy-craft';"),/permission denied/);
 const draftSignature='public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)';
 for(const role of ['anon','authenticated','app_tenant'])assert.equal(owned.psql(`SELECT has_function_privilege(${q(role)},${q(draftSignature)},'EXECUTE');`),'f');
 // Positive conservation controls are created through the existing native
 // tenant/RPC and signed canonical Worker routes. They are NOT primary buyer
 // browser orders, actual PSP purchases or original HI15/HI17 acceptance.
 proxy=await startOwnedPooledSqlProxy(owned);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{...proxy.env(),NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.com'}));
 const makeControls=async(expectedVersion:'2.1.0'|'2.1.1',withOrders:boolean)=>{
 const controls:Array<{slug:string;siteId:string;orderId:string|null}>=[],readbacks:Array<()=>Promise<void>>=[];
 for(const [i,slug] of slugs.entries()){
  const tenant=newSyntheticTenant('heading'+expectedVersion.replaceAll('.','')+'-'+i);seedSyntheticTenant(owned.psql,tenant,{gst:true,taxRates:true});
  const actor=randomUUID(),email=`heading211-${actor}@example.invalid`;
  owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES(${q(actor)},${q(email)},true,'Synthetic211 owner');UPDATE sites SET custom_user_id=${q(actor)},theme_id='letbuyy-core' WHERE id=${q(tenant.siteId)};INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES(${q(actor)},${q(tenant.siteId)},'enterprise','active');`);
  const request=async(path:string,body?:unknown,method=body?'POST':'GET',extraHeaders:Record<string,string>={})=>{requireCohortBudget();return gateway!.request(path,{method,headers:{...await signedIdentityHeaders(actor,email,tenant.siteId),...extraHeaders},...(body?{body:JSON.stringify(body)}:{})});};
  const descriptor=await request(`/v1/themes/${slug}/schema?store_id=${tenant.siteId}`);assert.equal(descriptor.status,200,descriptor.text);
  const selected=descriptor.json!.data.theme;
  const installed=await request(`/v1/themes/${slug}/install`,{store_id:tenant.siteId,config_overrides:{},expected_version:expectedVersion,expected_package_id:selected.theme_package_id,expected_package_version_id:selected.theme_package_version_id});assert.equal(installed.status,201,installed.text);
  const editor=await request(`/v1/themes/${slug}/editor?store_id=${tenant.siteId}`);assert.equal(editor.status,200,editor.text);
  const config=structuredClone(editor.json!.data.template_config),version=editor.json!.data.version;
  config.themeSettings.primaryColor='#1E4060';
  const saved=await request(`/v1/themes/${slug}/editor/draft`,{store_id:tenant.siteId,template_config:config,base_version:version,idempotency_key:randomUUID()},'PUT');assert.equal(saved.status,200,saved.text);
  const published=await request(`/v1/themes/${slug}/publish`,{store_id:tenant.siteId,base_version:saved.json!.data.version,idempotency_key:randomUUID(),make_store_live:true});assert.equal(published.status,200,published.text);
  const order=withOrders?seedSyntheticOrder(owned.psql,tenant):null;if(order)assert.match(order.orderId,/^[a-f0-9-]{36}$/);
  controls.push({slug,siteId:tenant.siteId,orderId:order?.orderId??null});
  readbacks.push(async()=>{const requestId=randomUUID(),traceId=randomUUID(),ipAddress='192.0.2.211',userAgent='heading211-native-readback';const result=await request(`/v1/themes/${slug}/editor?store_id=${tenant.siteId}`,undefined,'GET',{'X-Request-ID':requestId,'X-Trace-ID':traceId,'CF-Connecting-IP':ipAddress,'User-Agent':userAgent});await gateway!.settle();assert.equal(result.headers.get('X-Request-ID'),requestId);assert.equal(result.headers.get('X-Trace-ID'),traceId);observedReadbacks.push({requestId,traceId,route:'/v1/themes/:slug/editor',status:result.status,actorId:actor,siteId:null,runtimeName:gateway!.env.RUNTIME_NAME||'api-gateway',ipAddress,userAgent});assert.equal(result.status,200,result.text);assert.equal(result.json!.data.template_config.liquidBundle.package.version,expectedVersion);});
 }
 return {controls,recheck:async()=>{for(const readback of readbacks)await readback();}};
 };
 const priorControls=await makeControls('2.1.0',true),controls=priorControls.controls;
 await gateway.settle();
 const baseline=tables(),priorCatalog=catalog(),priorUnmanaged=unmanagedThemes(),security=securityProfile();
 assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE id=ANY(ARRAY[${controls.map(row=>q(row.siteId)).join(',')}]::uuid[]) AND current_theme_release_id IS NOT NULL;`),'4');
 for(const row of controls){assert.equal(owned.psql(`SELECT count(*) FROM theme_editor_drafts WHERE store_id=${q(row.siteId)} AND theme_id=${q(row.slug)};`),'1');assert.equal(owned.psql(`SELECT count(*) FROM orders WHERE id=${q(row.orderId!)} AND store_id=${q(row.siteId)};`),'1');}
 for(const table of ['themes',...captures,'sites','theme_instances','theme_editor_drafts','theme_releases','orders','order_items'])assert.ok((baseline.find(row=>row.table===table)?.count??0)>0,'Positive baseline '+table);
 const beforeCaptures=Object.fromEntries(captures.map(name=>[name,JSON.parse(snapshot(name)) as Array<{id:string}>]));
 proof('phase1-positive-current-profile-and-installed-history',{tables:baseline,securityProfileSha256:hash(security),controls,nativeControlsNotThemeUiCases:true});
 requireCohortBudget();owned.scriptLarge(up);const promoted=tables();
 assert.deepEqual(promoted.filter(row=>!['themes',...captures].includes(row.table)),baseline.filter(row=>!['themes',...captures].includes(row.table)));
 assert.equal(unmanagedThemes(),priorUnmanaged);assert.equal(securityProfile(),security);
 for(const name of captures){const ids=beforeCaptures[name].map(row=>q(row.id)).join(',');assert.deepEqual(JSON.parse(snapshot(name,`id=ANY(ARRAY[${ids}]::uuid[])`)),beforeCaptures[name]);assert.equal(promoted.find(row=>row.table===name)!.count,baseline.find(row=>row.table===name)!.count+(name==='theme_packages'?0:4));}
 assert.equal(owned.psql(`SELECT count(*) FROM themes WHERE slug IN(${slugList}) AND version='2.1.1';`),'4');
 assert.equal(owned.psql(`SELECT count(*) FROM themes WHERE id::text LIKE '7b669c70-%' AND slug NOT IN(${slugList}) AND version='2.1.0';`),'6');
 proof('phase2-four-package-up-conservation',{tables:promoted,oldCaptureRowsUnchanged:true,otherSixUnchanged:true});
 // Positive211 installed drafts/releases must also survive DOWN, not merely
 // unused captures. This explicitly admitted setup is a separate effect stage.
 const installed211=await makeControls('2.1.1',false);await gateway.settle();
 const controlledPromoted=tables();
 assert.equal(owned.psql(`SELECT count(*) FROM theme_instances i JOIN theme_package_versions v ON v.id=i.theme_package_version_id WHERE i.store_id=ANY(ARRAY[${installed211.controls.map(row=>q(row.siteId)).join(',')}]::uuid[]) AND v.version='2.1.1';`),'4');
 proof('phase2b-positive211-installed-work',{tables:controlledPromoted,controls:installed211.controls,explicitSetupOnlyNotMigrationDelta:true});
 requireCohortBudget();owned.scriptLarge(up);assert.deepEqual(tables(),controlledPromoted);assert.equal(securityProfile(),security);proof('phase3-strict-up-replay',{tables:controlledPromoted});
 const one=q(slugs[0]);
 // Conflicting incoming capture bodies are safer negative fixtures than
 // attempting to UPDATE an append-only capture table or disabling a trigger.
 const alterPayload=(path:string[],value:unknown)=>{const match=up.match(/\$heading211\$([\s\S]*?)\$heading211\$::jsonb/);assert.ok(match);const rows=JSON.parse(match[1]) as Array<Record<string,unknown>>;let node=rows[0];for(const key of path.slice(0,-1))node=node[key] as Record<string,unknown>;node[path.at(-1)!]=value;return up.replace(match[1],JSON.stringify(rows));};
 const refusalBaseline=tables();let refusedControls=0;
 const refuse=(name:string,mutation:string,sql:string,expected:RegExp)=>{requireCohortBudget();const before=refusalBaseline;const error=owned.psqlScriptExpectError('BEGIN;'+mutation+'\n'+transactionBody(sql)+'\nROLLBACK;');assert.match(error,expected,name);assert.deepEqual(tables(),before,name+' must roll back all effects');assert.equal(securityProfile(),security);refusedControls++;};
 refuse('stale prior',`UPDATE themes SET version='2.1.2' WHERE slug=${one};`,up,/Heading211 stale prior catalog version/);
 refuse('changed prior catalog',`UPDATE themes SET version='2.1.0',default_template=jsonb_set(default_template,'{rendererEngine}','"foreign"') WHERE slug=${one};`,up,/Heading211 prior catalog differs/);
 refuse('immutable prior version','',alterPayload(["previousPersistence", "themePackageVersion", "checksum"],'conflict'),/Immutable heading211 previousPersistence version conflict/);
 refuse('immutable new version','',alterPayload(["persistence", "themePackageVersion", "checksum"],'conflict'),/Immutable heading211 persistence version conflict/);
 refuse('immutable new schema','',alterPayload(["persistence", "schemaManifest", "schema_manifest"],{unapproved211:true}),/Immutable heading211 persistence schema conflict/);
 refuse('immutable new renderer','',alterPayload(["persistence", "rendererManifest", "renderer_manifest"],{unapproved211:true}),/Immutable heading211 persistence renderer conflict/);
 refuse('checkpoint replay',`UPDATE themes SET config=jsonb_set(config,'{firstPartyOrderHeading211,payloadSha256}','"conflict"') WHERE slug=${one};`,up,/Heading211 checkpoint or replay conflict/);
 refuse('stale DOWN',`UPDATE themes SET version='2.1.2' WHERE slug=${one};`,down,/Heading211 stale rollback conflict/);
 // Saved checkpoint corruption changes no accepted current catalog/capture.
 // Each nested field must be refused by BOTH replay and paired DOWN.
 const corruptions:Array<{name:string;expression:string}>=[
 ...['name','category','version','schema_version','renderer_version'].map(field=>({name:field,expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous,${field}}','"forged211"')`})),
 ...['section_schemas','block_schemas','settings_schema','renderer_manifest'].map(field=>({name:field,expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous,${field}}','{}')`})),
 {name:'nested-default-document',expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous,default_template,rendererEngine}','"forged211"')`},
 {name:'nested-original-config',expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous,config,forged211}','true')`},
 {name:'missing-prior-name',expression:`config#-'{firstPartyOrderHeading211,previous,name}'`},
 {name:'extra-prior-field',expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous,forged211}','true')`},
 {name:'extra-journal-field',expression:`jsonb_set(config,'{firstPartyOrderHeading211,forged211}','true')`},
 {name:'null-prior',expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous}','null')`},
 {name:'array-prior',expression:`jsonb_set(config,'{firstPartyOrderHeading211,previous}','[]')`},
 {name:'null-journal',expression:`jsonb_set(config,'{firstPartyOrderHeading211}','null')`},
 ];
 for(const corruption of corruptions)for(const [direction,script]of [['replay',up],['DOWN',down]])refuse(`checkpoint ${corruption.name} ${direction}`,`UPDATE themes SET config=${corruption.expression} WHERE slug=${one};`,script,/Heading211 checkpoint or replay conflict/);
 proof('phase4-transactional-refusal-controls',{controls:refusedControls,nestedCheckpointCases:corruptions.length*2,tables:tables(),noAcceptedMutation:true});
 const afterCaptures=Object.fromEntries(captures.map(name=>[name,snapshot(name)]));
 requireCohortBudget();owned.scriptLarge(down);assert.equal(catalog(),priorCatalog);assert.equal(unmanagedThemes(),priorUnmanaged);assert.equal(securityProfile(),security);
 const restored=tables();for(const name of captures)assert.equal(snapshot(name),afterCaptures[name]);assert.deepEqual(restored.filter(row=>row.table!=='themes'),controlledPromoted.filter(row=>row.table!=='themes'));
 // Full-public SQL conservation above remains strict. HTTP has its own
 // immediate baseline and allows ONLY exact attributed append-only telemetry.
 requireCohortBudget();const families=operationalFamilies(),beforeHttp=tables(),beforeOperational=operationalRows(families);
 assert.deepEqual(beforeHttp,restored);assert.equal(observedReadbacks.length,0);
 await installed211.recheck();await gateway.settle();requireCohortBudget();
 const afterHttp=tables(),afterOperational=operationalRows(families),operationalNames=new Set(families.flatMap(row=>[row.base,row.parent,...row.leaves]));
 proof('phase5-readback-raw-before-assertions',{requests:observedReadbacks,families,beforeOperational,afterOperational,beforeHttp,afterHttp});
 const attributed=assertReadbackTelemetry(beforeOperational,afterOperational,observedReadbacks,families);
 assert.deepEqual(afterHttp.filter(row=>!operationalNames.has(row.table)),beforeHttp.filter(row=>!operationalNames.has(row.table)),'Every business and unclassified table stays exact across HTTP');assert.equal(securityProfile(),security);
 proof('phase5-paired-down',{tables:afterHttp,priorMetadataRestored:true,capturesInstalledWorkAndOrdersRetained:true,attributed});
 // Subsequent SQL uses the settled complete POST-readback witness, including
 // every newly attributed operational row and its exact partition mirrors.
 requireCohortBudget();owned.scriptLarge(down);assert.deepEqual(tables(),afterHttp);assert.equal(securityProfile(),security);proof('phase6-strict-down-replay',{tables:afterHttp});
 requireCohortBudget();owned.scriptLarge(up);const final=tables();requireCohortBudget();owned.scriptLarge(up);assert.deepEqual(tables(),final);for(const name of captures)assert.equal(snapshot(name),afterCaptures[name]);assert.equal(unmanagedThemes(),priorUnmanaged);
 for(const slug of slugs){const captured=LiquidThemePackageBundleSchema.parse(JSON.parse(owned.scriptLarge(`SELECT default_template->'liquidBundle' FROM themes WHERE slug=${q(slug)};`)));assert.deepEqual(captured,createFirstPartyCatalogBundle(slug,{customizationVersion:'2.1.1'}));for(const section of Object.keys(captured.sections))assert.deepEqual(qualifiedFirstPartyInlineChildParents(captured,section),qualifiedFirstPartyInlineChildParents(createFirstPartyCatalogBundle(slug,{customizationVersion:'2.1.0'}),section));}
 proof('phase7-final-up-replay-and-captured-definitions',{tables:final,exactFour211Definitions:true});
 assert.equal(securityProfile(),security);for(const file of admission.sourceFiles)assert.equal(hash(read(file.path)),file.sha256,file.path);
 requireCohortBudget();proof('phase8-final-security-source-and-full-conservation',{tables:tables(),securityProfileSha256:hash(security),sourcePinsExact:true,allPhaseProofsRetained:true,cleanupOwner:'Future exclusively owned runner; no resource created by preparation'});
});
