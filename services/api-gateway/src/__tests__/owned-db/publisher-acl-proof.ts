// Shared owned-db proof, reused by current CI and the explicit historical qualifier only.
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import type {OwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,nextClientAddress} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {assertHttpNoDomainEffects,type HttpSnapshot,type HttpExpectation} from '../../../../../docs/implementation/niche-theme-programme/publisher-acl393/http-attribution-repair/http-request-delta';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const digestSchema=z.string().regex(/^[a-f0-9]{64}$/);
// Parse only the explicit query result; transaction command tags carry no row-count authority.
function parseOwnRowCount(output:string):number{
 const rows:Record<string,unknown>[]=[];
 for(const line of output.split(/\r?\n/)){
  const value=line.trim();if(!value.startsWith('{'))continue;
  let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new Error('Malformed own-row JSON marker');}
  if(parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed)&&'marker'in parsed&&parsed.marker==='ACL393_OWN_ROW_COUNT')rows.push(parsed as Record<string,unknown>);
 }
 assert.equal(rows.length,1,'Exactly one own-row JSON marker is required');
 const count=rows[0].count;assert.equal(typeof count,'number','Own-row count must be a JSON number');
 assert(Number.isSafeInteger(count),'Own-row count must be a safe integer');assert.equal(count,1,'Own-row positive control must see exactly one row');
 return count as number;
}
export interface PublisherAclProofInputs {
 owned:OwnedDatabase;up:string;down:string;entryTenantExecute:boolean;suiteSha256:string;sourceCount?:number;
 verifySource:()=>void;
}
export function registerPublisherAclProof(inputs:PublisherAclProofInputs){
const owned=inputs.owned;
const evidence=mkdtempSync(join(tmpdir(),`letbuyy-publisher-acl393-${owned.runId}-`));let sequence=0;
function proof(name:string,value:unknown){const bytes=JSON.stringify({runId:owned.runId,name,sequence:++sequence,suiteSha256:inputs.suiteSha256,value},null,2)+'\n';const path=join(evidence,`${String(sequence).padStart(3,'0')}-${name}.json`);writeFileSync(path,bytes,{mode:0o600,flag:'wx'});console.info('PUBLISHER_ACL393_PROVENANCE',JSON.stringify({path,sha256:hash(bytes)}));}
// Dedicated test diagnostics only: same owned helper, one attempt, no retry/fallback or shared-helper edit.
function candidateErrorContext(error:unknown):string{
 const message=error instanceof Error?error.message:String(error);
 return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_CONNECTION]')
  .replace(/^\s*(?:authorization|cookie|set-cookie|password|access_token|refresh_token|secret)\s*[:=].*$/gim,'[REDACTED_SENSITIVE_LINE]').slice(0,8000);
}
async function applyCandidate(direction:string,sql:string){
 try{await owned.psqlAsync(sql);}catch(error){const context=candidateErrorContext(error);proof('candidate-sql-error',{direction,context});throw new Error(`ACL393 ${direction} failed: ${context}`);}
}
const q=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const j=(v:unknown)=>q(JSON.stringify(v))+'::jsonb';
const object=(v:unknown):Record<string,unknown>=>{assert(v!==null&&typeof v==='object'&&!Array.isArray(v));return v as Record<string,unknown>;};
const parse=(sql:string):unknown=>JSON.parse(owned.scriptLarge(sql));
const signature='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)';
const publisherSql=`SELECT jsonb_build_object('row',to_jsonb(p),'owner',pg_get_userbyid(p.proowner),'bodyMd5',md5(p.prosrc),
 'defaults',pg_get_expr(p.proargdefaults,0),'identityArguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
 'comment',obj_description(p.oid,'pg_proc'),'roleOid',('app_tenant'::regrole)::oid,
 'acl',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee),'[]') FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),
 'execute',jsonb_build_object('app_tenant',has_function_privilege('app_tenant',p.oid,'EXECUTE'),'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'authenticator',has_function_privilege('authenticator',p.oid,'EXECUTE')),
 'tenantInheritsService',pg_has_role('app_tenant','service_role','USAGE'),
 'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
 'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))) FROM pg_proc p WHERE p.oid=to_regprocedure(${q(signature)})`;
function publisher(){return object(parse(publisherSql));}
const id=(v:string)=>'"'+v.replaceAll('"','""')+'"';
const tables=z.array(z.string()).min(1).parse(parse("SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p');"));
function businessState(){return parse(`SELECT jsonb_object_agg(table_name,table_hash) FROM (VALUES ${tables.map(t=>`(${q(t)},(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') FROM public.${id(t)} x))`).join(',')}) digests(table_name,table_hash);`);}
// Read every table hash, every operational row and the real partition tree. No table is excluded.
// Called only around one settled phase4 HTTP request; SQL-stage full snapshots remain unchanged.
function httpSnapshot():HttpSnapshot{
 const discovered=z.array(z.object({base:z.string(),parent:z.string(),partitions:z.array(z.object({name:z.string(),schema:z.string(),leaf:z.boolean(),level:z.number().int()}))})).parse(parse(`
 SELECT jsonb_agg(jsonb_build_object('base',v.base,'parent',v.parent,'partitions',(
  SELECT jsonb_agg(jsonb_build_object('name',c.relname,'schema',n.nspname,'leaf',t.isleaf,'level',t.level) ORDER BY t.level,c.relname)
  FROM pg_partition_tree(('public.'||v.parent)::regclass) t JOIN pg_class c ON c.oid=t.relid JOIN pg_namespace n ON n.oid=c.relnamespace
  ))) FROM (VALUES ('worker_request_logs','worker_request_logs_partitioned'),('runtime_telemetry_metrics','runtime_telemetry_metrics_partitioned')) v(base,parent);`));
 const families=discovered.map(f=>{
  assert.equal(f.partitions[0]?.name,f.parent);assert.equal(f.partitions[0]?.level,0);assert.equal(f.partitions[0]?.leaf,false);
  for(const p of f.partitions){assert.equal(p.schema,'public');if(p.level!==0){assert.equal(p.level,1);assert.equal(p.leaf,true);}}
  return{base:f.base,parent:f.parent,leaves:f.partitions.filter(p=>p.leaf).map(p=>p.name)};
 });
 const operational=families.flatMap(f=>[f.base,f.parent,...f.leaves]);
 const rows=z.record(z.string(),z.array(z.unknown())).parse(parse(`SELECT jsonb_object_agg(table_name,table_rows) FROM (VALUES
  ('internal_auth_replay_claims',(SELECT coalesce(jsonb_agg(jsonb_build_object('auth_kind',x.auth_kind,'jti_hash',encode(sha256(convert_to(x.jti,'UTF8')),'hex'),'claimed_at',x.claimed_at,'expires_at',x.expires_at,'row_hash',encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')) ORDER BY x.auth_kind,x.jti),'[]') FROM public.internal_auth_replay_claims x)),
  ${operational.map(t=>`(${q(t)},(SELECT coalesce(jsonb_agg(jsonb_build_object('physical_table',c.relname,'row',to_jsonb(x)) ORDER BY to_jsonb(x)::text),'[]') FROM public.${id(t)} x JOIN pg_class c ON c.oid=x.tableoid))`).join(',')}
  ) captured(table_name,table_rows);`));
 const hashes=z.record(z.string(),digestSchema).parse(businessState());
 const at=z.string().parse(parse('SELECT to_jsonb(clock_timestamp());'));
 return{at,hashes,rows,families};
}
function unrelatedCatalog(){return parse(`SELECT jsonb_build_object(
 'functions',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]')::text,'UTF8')),'hex') FROM pg_proc p WHERE p.oid<>to_regprocedure(${q(signature)})),
 'dependencies',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]')::text,'UTF8')),'hex') FROM pg_depend d WHERE NOT(d.classid='pg_proc'::regclass AND d.objid=to_regprocedure(${q(signature)}))),
 'shared',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]')::text,'UTF8')),'hex') FROM pg_shdepend d WHERE d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND NOT(d.classid='pg_proc'::regclass AND d.objid=to_regprocedure(${q(signature)}))),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM pg_roles r),'members',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY to_jsonb(m)::text),'[]') FROM pg_auth_members m),
 'defaults',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_default_acl d),
 'relationAcls',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'comments',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]')::text,'UTF8')),'hex') FROM pg_description d));`);}
function snapshot(){return{publisher:publisher(),business:businessState(),unrelated:unrelatedCatalog()};}
function profile(p:Record<string,unknown>,tenant:boolean){assert.equal(p.owner,'postgres');assert.equal(p.bodyMd5,'56a6b7b15e8a7ec159341fe0331ac593');assert.equal(p.comment,null);assert.equal(p.tenantInheritsService,false);const row=object(p.row);assert.equal(row.prosecdef,true);assert.deepEqual(row.proconfig,['search_path=public']);assert.equal(row.pronargs,10);assert.equal(row.pronargdefaults,7);assert.deepEqual(p.execute,{app_tenant:tenant,service_role:true,anon:false,authenticated:false,authenticator:false});assert(Array.isArray(p.acl));assert.deepEqual(p.acl.map(object).map(a=>a.grantee).sort(),(tenant?['postgres','service_role','app_tenant']:['postgres','service_role']).sort());for(const a of p.acl.map(object)){assert.equal(a.grantor,'postgres');assert.equal(a.grantable,false);assert.equal(a.privilege,'EXECUTE');}}
function withoutTenant(p:Record<string,unknown>){const copy=structuredClone(p);delete object(copy.row).proacl;delete object(copy.execute).app_tenant;assert(Array.isArray(copy.acl));copy.acl=copy.acl.map(object).filter(a=>a.grantee!=='app_tenant');assert(Array.isArray(copy.sharedDependencies));copy.sharedDependencies=copy.sharedDependencies.map(object).filter(d=>!(d.deptype==='a'&&d.refobjid===p.roleOid));return copy;}
function dependencyCount(p:Record<string,unknown>){assert(Array.isArray(p.sharedDependencies));return p.sharedDependencies.map(object).filter(d=>d.deptype==='a'&&d.refobjid===p.roleOid).length;}
let gateway:Gateway|undefined;after(async()=>{await gateway?.settle();});
const body=(sql:string)=>{assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);return sql.replace(/^BEGIN;\n/m,'').replace(/^COMMIT;\s*$/m,'');};
const primary=newSyntheticTenant('acl393-primary'),foreign=newSyntheticTenant('acl393-foreign');
const owner=randomUUID(),other=randomUUID(),email=`acl393-${owner}@example.invalid`,otherEmail=`acl393-${other}@example.invalid`,slug='letbuyy-sense',base=`/v1/themes/${slug}`;
const redact=(v:unknown):unknown=>Array.isArray(v)?v.map(redact):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([key,value])=>[key,/token|secret|cookie|authorization|password/i.test(key)?'[REDACTED]':redact(value)])):v;
interface RequestObservation {requestId:string;traceId:string;ip:string;userAgent:string;jtiHash?:string;actorId?:string}
async function request(path:string,method='GET',payload?:unknown,asForeign=false,observed?:RequestObservation){
 assert(gateway);const headers=new Headers(await signedIdentityHeaders(asForeign?other:owner,asForeign?otherEmail:email,asForeign?foreign.siteId:primary.siteId));
 if(observed){
  assert.equal(observed.jtiHash,undefined,'One observed request only');assert.equal(observed.actorId,undefined);
  const jti=headers.get('X-LetBuyy-Internal-JTI');assert(jti);observed.jtiHash=hash(jti);observed.actorId=asForeign?other:owner;
  headers.set('X-Request-ID',observed.requestId);headers.set('X-Trace-ID',observed.traceId);headers.set('CF-Connecting-IP',observed.ip);headers.set('User-Agent',observed.userAgent);
 }
 const r=await gateway.request(path,{method,headers,...(payload===undefined?{}:{body:JSON.stringify(payload)})});await gateway.settle();proof('mounted-api',{path,method,status:r.status,response:redact(r.json)});return r;
}
const data=(r:Awaited<ReturnType<typeof request>>)=>object(r.json?.data);
const editor=async()=>{const r=await request(base+`/editor?store_id=${primary.siteId}`);assert.equal(r.status,200,r.text);return data(r);};
const draftState=()=>parse(`SELECT jsonb_build_object('instance',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM theme_instance_drafts d WHERE store_id=${q(primary.siteId)}),'editor',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM theme_editor_drafts d WHERE store_id=${q(primary.siteId)}),'patches',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM theme_draft_patches d WHERE store_id=${q(primary.siteId)}));`);
const currentRelease=()=>object(parse(`SELECT to_jsonb(r) FROM sites s JOIN theme_releases r ON r.id=s.current_theme_release_id WHERE s.id=${q(primary.siteId)};`));
const changed=(config:Record<string,unknown>,heading:string)=>{const copy=structuredClone(config),sections=object(object(object(copy.templates).index).sections);const section=Object.values(sections).map(object).find(s=>typeof object(s.settings).heading==='string');assert(section);object(section.settings).heading=heading;return copy;};
let validConfig:Record<string,unknown>;
function assertTenantDenied(){
 for(const target of ['own','foreign','unset'] as const){const prior=businessState();const guc=target==='foreign'?foreign.siteId:target==='unset'?'':primary.siteId;
  const error=owned.psqlScriptExpectError(`\\set VERBOSITY verbose
BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id',${q(primary.siteId)},true);
DO $positive$ BEGIN IF(SELECT count(*) FROM public.sites WHERE id=${q(primary.siteId)}::uuid)<>1 THEN RAISE EXCEPTION 'ACL393 own-row positive control failed';END IF;END $positive$;
SELECT set_config('app.site_id',${q(guc)},true);
SELECT * FROM public.publish_theme_release(${q(target==='foreign'?foreign.siteId:primary.siteId)}::uuid,${q(slug)},${j(validConfig)},NULL,NULL,${q(owner)}::uuid,NULL,true,NULL,NULL);ROLLBACK;`);
  proof('tenant-direct-denial',{target,error,profile:publisher()});assert.match(error,/42501/);assert.match(error,/permission denied for function publish_theme_release/);assert.deepEqual(businessState(),prior);
 }
 for(const role of ['anon','authenticated']){const prior=businessState();const error=owned.psqlScriptExpectError(`\\set VERBOSITY verbose
BEGIN;SET LOCAL ROLE ${role};SELECT * FROM public.publish_theme_release(${q(primary.siteId)}::uuid,${q(slug)},${j(validConfig)},NULL,NULL,${q(owner)}::uuid,NULL,true,NULL,NULL);ROLLBACK;`);proof('public-direct-denial',{role,error});assert.match(error,/42501/);assert.match(error,/permission denied for function publish_theme_release/);assert.deepEqual(businessState(),prior);}
}

test('ACL393: exact publisher privilege closure, service callsites, atomic refusal and reversible isolated ACL proof',async t=>{
 const entry=snapshot();proof('entry-full-profile-before-assertions',entry);profile(entry.publisher,inputs.entryTenantExecute);const immutable=entry.unrelated;
 const stage=async(name:string,work:()=>unknown|Promise<unknown>)=>{let passed=false;await t.test(name,async()=>{proof('before-phase',{name,snapshot:snapshot()});await work();assert.deepEqual(unrelatedCatalog(),immutable);passed=true;});assert(passed,`Stopped after failed phase: ${name}`);};
 await stage('1 own fixture and real selected-theme install positive controls',async()=>{
  for(const site of [primary,foreign])seedSyntheticTenant(owned.psql,site);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES(${q(owner)},${q(email)},true),(${q(other)},${q(otherEmail)},true);
UPDATE sites SET custom_user_id=${q(owner)}::uuid,theme_id='letbuyy-core',status='draft',published=false WHERE id=${q(primary.siteId)}::uuid;
UPDATE sites SET custom_user_id=${q(other)}::uuid,theme_id='letbuyy-core',status='draft',published=false WHERE id=${q(foreign.siteId)}::uuid;
INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES(${q(owner)},${q(primary.siteId)},'enterprise','active'),(${q(other)},${q(foreign.siteId)},'enterprise','active');`);
  gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
  const schema=await request(base+'/schema');assert.equal(schema.status,200,schema.text);const theme=object(data(schema).theme);z.string().uuid().parse(theme.theme_package_id);z.string().uuid().parse(theme.theme_package_version_id);
  const added=await request(base+'/install','POST',{store_id:primary.siteId,expected_version:theme.version,expected_package_id:theme.theme_package_id,expected_package_version_id:theme.theme_package_version_id});assert.equal(added.status,201,added.text);
  const loaded=await editor();validConfig=object(loaded.template_config);assert(Object.keys(validConfig).length>0);
  const ownRows=owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id',${q(primary.siteId)},true);SELECT jsonb_build_object('marker','ACL393_OWN_ROW_COUNT','count',(SELECT count(*) FROM sites WHERE id=${q(primary.siteId)}::uuid))::text;ROLLBACK;`);
  assert.equal(parseOwnRowCount(ownRows),1);
 });
 await stage('2 exact UP and replay preserve business/non-ACL catalog state',async()=>{
  const before=snapshot();proof('pre-up-full-profile',before);await applyCandidate('UP',inputs.up);const afterState=snapshot();proof('post-up-full-profile',afterState);profile(afterState.publisher,false);assert.deepEqual(withoutTenant(afterState.publisher),withoutTenant(before.publisher));assert.equal(dependencyCount(before.publisher),inputs.entryTenantExecute?1:0);assert.equal(dependencyCount(afterState.publisher),0);if(!inputs.entryTenantExecute)assert.deepEqual(afterState,before);assert.deepEqual(afterState.business,before.business);assert.deepEqual(afterState.unrelated,before.unrelated);
  await applyCandidate('UP',inputs.up);const replay=snapshot();proof('up-replay-full-profile',replay);assert.deepEqual(replay,afterState);
 });
 await stage('3 actual app_tenant valid-payload42501 with own-row positive-first and zero effects',()=>{assertTenantDenied();});
 await stage('4 canonical service publish and reviewed rollback retain CAS/retry/private-draft contracts',async()=>{
  const noDomainEffects=async(label:string,route:string,method:string,work:(observed:RequestObservation)=>ReturnType<typeof request>)=>{
   const before=httpSnapshot(),observed:RequestObservation={requestId:randomUUID(),traceId:randomUUID(),ip:nextClientAddress(),userAgent:'LetBuyy-ACL393-owned-native'};
   const r=await work(observed),afterState=httpSnapshot();assert(observed.jtiHash&&observed.actorId);
   // Hono handles AppError before next() returns. The outer errorResponseSanitizer runs
   // after observability, so its final X-Error-Code is not the request-log input here.
   const expected:HttpExpectation={...observed,jtiHash:observed.jtiHash,actorId:observed.actorId,route,method,status:r.status,errorCode:null,siteId:null};
   proof('http-no-domain-effects-before-assertion',{label,expected,before,after:afterState});
   assert.equal(r.headers.get('X-Request-ID'),observed.requestId);assert.equal(r.headers.get('X-Trace-ID'),observed.traceId);
   const attribution=assertHttpNoDomainEffects(before,afterState,expected);proof('http-no-domain-effects-attributed',{label,attribution});return r;
  };
  const save=async(config:Record<string,unknown>,version:unknown,key=randomUUID(),observed?:RequestObservation)=>request(base+'/editor/draft','PUT',{store_id:primary.siteId,template_key:'index',template_config:config,base_version:version,idempotency_key:key},false,observed);
  const publish=async(version:unknown,key=randomUUID(),observed?:RequestObservation)=>request(base+'/publish','POST',{store_id:primary.siteId,template_key:'index',base_version:version,idempotency_key:key,make_store_live:true},false,observed);
  const a=await editor(),configA=changed(object(a.template_config),'Owned ACL393 published A'),saveKey=randomUUID(),saved=await save(configA,a.version,saveKey);assert.equal(saved.status,200,saved.text);
  const saveRetry=await noDomainEffects('save-retry','/v1/themes/:slug/editor/draft','PUT',o=>save(configA,a.version,saveKey,o));assert.equal(saveRetry.status,200,saveRetry.text);assert.equal(data(saveRetry).replayed,true);
  assert.equal((await noDomainEffects('stale-save','/v1/themes/:slug/editor/draft','PUT',o=>save(configA,a.version,randomUUID(),o))).status,409);
  const publishKey=randomUUID(),published=await publish(data(saved).version,publishKey);assert.equal(published.status,200,published.text);const target=currentRelease();assert.match(JSON.stringify(target.release_config),/Owned ACL393 published A/);
  const publishRetry=await noDomainEffects('publish-retry','/v1/themes/:slug/publish','POST',o=>publish(data(saved).version,publishKey,o));assert.equal(publishRetry.status,200,publishRetry.text);assert.equal(object(data(publishRetry).release).release_id,target.id);
  const b=await editor(),savedB=await save(changed(object(b.template_config),'Owned ACL393 published B'),b.version);assert.equal(savedB.status,200,savedB.text);assert.equal((await publish(data(savedB).version)).status,200);const publishedB=currentRelease();assert.notEqual(publishedB.id,target.id);
  const c=await editor(),savedC=await save(changed(object(c.template_config),'Owned ACL393 private C'),c.version);assert.equal(savedC.status,200,savedC.text);const privateBefore=draftState();
  const path=base+`/releases/${String(target.id)}/rollback`,intent={store_id:primary.siteId,expected_current_release_id:publishedB.id,idempotency_key:randomUUID(),make_store_live:true};
  const rollback=await request(path,'POST',intent);assert.equal(rollback.status,200,rollback.text);const restored=currentRelease();assert.equal(restored.rollback_of_release_id,target.id);assert.match(JSON.stringify(restored.release_config),/Owned ACL393 published A/);assert.deepEqual(draftState(),privateBefore);
  const retry=await noDomainEffects('rollback-retry','/v1/themes/:slug/releases/:releaseId/rollback','POST',o=>request(path,'POST',intent,false,o));assert.equal(retry.status,200,retry.text);assert.equal(object(data(retry).rollback).release_id,restored.id);
  assert.equal((await noDomainEffects('stale-rollback','/v1/themes/:slug/releases/:releaseId/rollback','POST',o=>request(path,'POST',{...intent,idempotency_key:randomUUID()},false,o))).status,409);
  assert.equal((await noDomainEffects('foreign-rollback','/v1/themes/:slug/releases/:releaseId/rollback','POST',o=>request(path,'POST',intent,true,o))).status,403);
  assert.equal(owned.psql(`SELECT count(*) FROM audit_activity_events WHERE store_id=${q(primary.siteId)} AND action='theme.rollback';`),'1');assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id=${q(primary.siteId)} AND event_type='theme.release.rollback_published';`),'1');profile(publisher(),false);proof('service-callsite-results',{target:target.id,publishedB:publishedB.id,restored:restored.id,privatePreserved:true,casAndRetry:true});
 });
 await stage('5 unknown publisher profiles refuse both directions atomically through ordinary DDL controls',()=>{
  const variants=[['cost',`ALTER FUNCTION ${signature} COST 101;`],['security',`ALTER FUNCTION ${signature} SECURITY INVOKER;`],['path',`ALTER FUNCTION ${signature} SET search_path=pg_catalog,public;`],['owner',`ALTER FUNCTION ${signature} OWNER TO service_role;`],['extra-grantee',`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`],['grant-option',`GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION;`],['comment',`COMMENT ON FUNCTION ${signature} IS 'Owned unknown profile';`],['dependency',`ALTER FUNCTION ${signature} DEPENDS ON EXTENSION plpgsql;`]];
  for(const[direction,sql]of[['up',inputs.up],['down',inputs.down]])for(const[label,setup]of variants){
   const before=snapshot(),error=owned.psqlScriptExpectError(`BEGIN;${setup}\nDO $full_profile_before_assertion$ BEGIN RAISE NOTICE 'ACL393_MUTANT_PROFILE %',(${publisherSql});END $full_profile_before_assertion$;\n${body(sql)}\nROLLBACK;`);
   const marker='ACL393_MUTANT_PROFILE ',line=error.split('\n').find(l=>l.includes(marker));let captured:unknown;try{captured=line?JSON.parse(line.slice(line.indexOf(marker)+marker.length)):null;}catch{captured=null;}
   proof('unknown-profile-refusal',{direction,label,profileBeforeAssertions:captured,rawDiagnostic:error});assert(captured,'full mutant profile must be captured before assertions');assert.match(error,/ACL393 refuses/);assert.deepEqual(snapshot(),before);
  }
 });
 await stage('6 exact isolated DOWN/replay then re-UP/replay ends denied with complete parity',async()=>{
  const hardened=snapshot();proof('before-down-full-profile',hardened);await applyCandidate('DOWN',inputs.down);const historical=snapshot();proof('after-down-full-profile-unsafe-negative-control',historical);profile(historical.publisher,true);assert.equal(dependencyCount(historical.publisher),1);assert.deepEqual(withoutTenant(historical.publisher),withoutTenant(hardened.publisher));assert.deepEqual(historical.business,hardened.business);assert.deepEqual(historical.unrelated,hardened.unrelated);
  await applyCandidate('DOWN',inputs.down);assert.deepEqual(snapshot(),historical);proof('down-replay-full-profile',snapshot());
  // No app_tenant publisher or updater invocation occurs in the deliberately historical unsafe state.
  await applyCandidate('UP',inputs.up);assert.deepEqual(snapshot(),hardened);await applyCandidate('UP',inputs.up);assert.deepEqual(snapshot(),hardened);proof('final-reup-full-profile',snapshot());assertTenantDenied();
 });
 await stage('7 final hardened profiles and selected SQL input bindings are conserved',()=>{const final=snapshot();proof('final-full-profile-before-assertions',final);profile(final.publisher,false);assert.deepEqual(withoutTenant(final.publisher),withoutTenant(entry.publisher));assert.deepEqual(final.unrelated,entry.unrelated);inputs.verifySource();assert.equal(dependencyCount(final.publisher),0);proof('final-restoration',{tenantExecute:false,serviceExecute:true,migration393Only:true,sourceCount:inputs.sourceCount,selectedSqlInputsExact:true});});
});

}
