// Continuous owned-Postgres regression. Execute only through the canonical owned runner.
// Actual worker, ordinary owned SQL transport and synthetic tenants. No SQL migration/ACL/role changes.
// Direct-operation conservation and mounted HTTP attribution are deliberately separate oracles.
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import type {Env} from '../../index';
import {readOwnedCollectionList} from '../../execution/collection-membership.adapter';
import {getSupabaseAdminFromEnv} from '../../lib/supabase';
import {resolveCustomUser,verifySiteOwnership} from '../../lib/auth-user';
import type {OwnedStoreScope} from '../../lib/tenant-context';
import {withTenantTx} from '../../lib/tenant-transaction';
import {getPooledSql,closePooledSqlClients,type PooledSqlClient} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {CollectionListPageSchema,type CollectionListPage} from '@letbuyy/shared-types';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,nextClientAddress,tapRest,type RestTap} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant,type SyntheticTenant} from './synthetic-tenant';
import {assertHttpNoDomainEffects,type HttpSnapshot,type HttpExpectation} from '../../../../../docs/implementation/niche-theme-programme/collection-count-native/http-attribution-v2/http-request-delta';

const root=new URL('../../../../../',import.meta.url);
const suitePath='services/api-gateway/src/__tests__/owned-db/collection-list-read.postgres.test.ts';
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const hash=(bytes:string)=>createHash('sha256').update(bytes).digest('hex');
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');
// Standard continuous owned test: the canonical guard and the runner's CURRENT default migrations are authoritative.
// Exact Root qualification is external to this test, never a stale per-source grant or fixed migration maximum.
const owned=requireOwnedDatabase();
const suiteSha256=hash(read(suitePath));
const migrationSources=()=>['migrations','rollback'].flatMap(kind=>readdirSync(new URL('database/supabase/'+kind+'/',root)).filter(p=>p.endsWith('.sql')).map(p=>({path:kind+'/'+p,sha256:hash(read('database/supabase/'+kind+'/'+p))}))).sort((a,b)=>a.path.localeCompare(b.path));
const initialMigrationSources=migrationSources();
const evidence=mkdtempSync(join(tmpdir(),`letbuyy-count-native-${owned.runId}-`));let sequence=0;
function proof(name:string,value:unknown){const bytes=JSON.stringify({runId:owned.runId,name,sequence:++sequence,suiteSha256,value},null,2)+'\n';const path=join(evidence,`${String(sequence).padStart(3,'0')}-${name}.json`);writeFileSync(path,bytes,{mode:0o600,flag:'wx'});console.info('COLLECTION_COUNT_NATIVE_PROVENANCE',JSON.stringify({path,sha256:hash(bytes)}));}
const q=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const ident=(v:string)=>'"'+v.replaceAll('"','""')+'"';
const parse=(sql:string):unknown=>JSON.parse(owned.scriptLarge('SET jit=off;'+sql));
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,sql:PooledSqlClient|undefined,restTap:RestTap|undefined;
after(async()=>{await gateway?.settle();restTap?.restore();await closePooledSqlClients();await proxy?.stop();});
const actors=[randomUUID(),randomUUID()];
const email=(actor:string)=>`syn-count-${actor}@example.invalid`;
const a=newSyntheticTenant('count-a'),b=newSyntheticTenant('count-b'),empty=newSyntheticTenant('count-empty');
const collections=Array.from({length:4},()=>randomUUID()),bCollection=randomUUID(),deletedCollection=randomUUID();
const products=Array.from({length:4},()=>randomUUID()),bProduct=randomUUID(),largeCollection=randomUUID();
const largeProducts=Array.from({length:151},()=>randomUUID()),padding=Array.from({length:22},()=>randomUUID());
const tie='2026-10-24T00:00:00.000000Z';
function seedProducts(site:string,ids:string[]){owned.script(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) VALUES ${ids.map(id=>`(${q(id)},${q(site)},${q(site)},${q('Synthetic count '+id)},${q('syn-count-'+id)},10,4,true,'active')`).join(',')};`);}
function seedCollections(site:string,ids:string[],deleted=false){owned.script(`INSERT INTO collections(id,store_id,title,is_active,created_at,deleted_at) VALUES ${ids.map(id=>`(${q(id)},${q(site)},${q('Synthetic count '+id)},true,${q(tie)}::timestamptz,${deleted?'now()':'NULL'})`).join(',')};`);}
function assign(collection:string,ids:string[]){if(ids.length)owned.script(`INSERT INTO collection_products(collection_id,product_id,position) VALUES ${ids.map((id,i)=>`(${q(collection)},${q(id)},${i})`).join(',')};`);}
// Direct-operation inputs only. Accounts and current ownership are checked through real canonical readers.
// This is not a second router, bypass of Gateway authentication, or proof of resolveOwnedStoreScope's full access profile.
async function directScope(site:SyntheticTenant,actor:string):Promise<OwnedStoreScope>{
 assert(gateway);const db=getSupabaseAdminFromEnv(gateway.env),authUser={id:actor,email:email(actor),storeId:site.siteId,role:'owner'};
 const customUser=await resolveCustomUser(db,authUser);assert(customUser);assert(await verifySiteOwnership(db,site.siteId,customUser.id,site.siteId));
 return{siteId:site.siteId,storeId:site.siteId,db,authUser,customUser,tenant:{siteId:site.siteId,userId:actor,membershipId:null,roles:['owner'],permissions:['store:owner'],plan:'free',entitlements:{},requestId:randomUUID()}};
}
function allPublicHashes():Record<string,string>{
 const tables=z.array(z.string()).min(1).parse(parse("SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p');"));
 const output=owned.scriptLarge('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL jit=off;'+tables.map(t=>`SELECT jsonb_build_object('table',${q(t)},'hash',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex')) FROM public.${ident(t)} x;`).join('\n')+'COMMIT;');
 const rows=output.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>z.object({table:z.string(),hash:digest}).strict().parse(JSON.parse(line)));
 assert.equal(rows.length,tables.length);assert.deepEqual(rows.map(r=>r.table),tables);return Object.fromEntries(rows.map(r=>[r.table,r.hash]));
}
function nonpublicMigrationHashes(){
 const tables=z.array(z.tuple([z.string(),z.string()])).parse(parse("SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname !~ '^pg_' AND n.nspname NOT IN('public','information_schema') AND c.relname ILIKE '%migration%';"));
 return Object.fromEntries(tables.map(([schema,table])=>[schema+'.'+table,z.string().parse(parse(`SELECT to_jsonb(encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex')) FROM ${ident(schema)}.${ident(table)} x;`))]));
}
function authority(){return {catalog:parse(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relkind,c.relpersistence) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'columnAcls',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attacl) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]') FROM pg_policy p),
 'procedures',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM pg_roles r),
 'members',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY to_jsonb(m)::text),'[]') FROM pg_auth_members m),
 'defaults',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_default_acl d),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t),
 'eventTriggers',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.oid),'[]') FROM pg_event_trigger e),
 'junctionPrivileges',jsonb_build_object('tenant_select',has_table_privilege('app_tenant','public.collection_products','SELECT'),'tenant_write',has_table_privilege('app_tenant','public.collection_products','INSERT,UPDATE,DELETE,TRUNCATE'),'service_select',has_table_privilege('service_role','public.collection_products','SELECT'),'service_write',has_table_privilege('service_role','public.collection_products','INSERT,UPDATE,DELETE,TRUNCATE'),'private_rpc_tenant',has_function_privilege('app_tenant','public.collection_membership_snapshot_v1(uuid,uuid)','EXECUTE'),'private_rpc_service',has_function_privilege('service_role','public.collection_membership_snapshot_v1(uuid,uuid)','EXECUTE')));`),nonpublicMigrationHistoryHashes:nonpublicMigrationHashes()};}
function httpSnapshot():HttpSnapshot{
 const families=z.array(z.object({base:z.string(),parent:z.string(),partitions:z.array(z.object({name:z.string(),schema:z.string(),leaf:z.boolean(),level:z.number().int()}))})).length(2).parse(parse(`SELECT jsonb_agg(jsonb_build_object('base',v.base,'parent',v.parent,'partitions',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'schema',n.nspname,'leaf',t.isleaf,'level',t.level) ORDER BY t.level,c.relname) FROM pg_partition_tree(('public.'||v.parent)::regclass) t JOIN pg_class c ON c.oid=t.relid JOIN pg_namespace n ON n.oid=c.relnamespace))) FROM (VALUES ('worker_request_logs','worker_request_logs_partitioned'),('runtime_telemetry_metrics','runtime_telemetry_metrics_partitioned')) v(base,parent);`)).map(f=>{
  assert.equal(f.partitions[0]?.name,f.parent);assert.equal(f.partitions[0]?.level,0);assert.equal(f.partitions[0]?.leaf,false);for(const p of f.partitions){assert.equal(p.schema,'public');if(p.level!==0){assert.equal(p.level,1);assert.equal(p.leaf,true);}}return{base:f.base,parent:f.parent,leaves:f.partitions.filter(p=>p.leaf).map(p=>p.name)};
 });
 const operational=families.flatMap(f=>[f.base,f.parent,...f.leaves]);
 const rows=z.record(z.string(),z.array(z.unknown())).parse(parse(`SELECT jsonb_object_agg(table_name,table_rows) FROM (VALUES ('internal_auth_replay_claims',(SELECT coalesce(jsonb_agg(jsonb_build_object('auth_kind',x.auth_kind,'jti_hash',encode(sha256(convert_to(x.jti,'UTF8')),'hex'),'claimed_at',x.claimed_at,'expires_at',x.expires_at,'row_hash',encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')) ORDER BY x.auth_kind,x.jti),'[]') FROM public.internal_auth_replay_claims x)),${operational.map(t=>`(${q(t)},(SELECT coalesce(jsonb_agg(jsonb_build_object('physical_table',c.relname,'row',to_jsonb(x)) ORDER BY to_jsonb(x)::text),'[]') FROM public.${ident(t)} x JOIN pg_class c ON c.oid=x.tableoid))`).join(',')}) captured(table_name,table_rows);`));
 return{at:z.string().parse(parse('SELECT to_jsonb(clock_timestamp());')),hashes:allPublicHashes(),rows,families};
}
const stateSql=`SELECT pg_backend_pid() AS pid,current_user::text AS role,session_user::text AS login,
 nullif(current_setting('app.site_id',true),'') AS site,nullif(current_setting('app.request_id',true),'') AS request,
 nullif(current_setting('app.actor_id',true),'') AS actor,nullif(current_setting('request.jwt.claim.sub',true),'') AS subject`;
async function baseState(expectedPid?:number){assert(sql);const row=(await sql.unsafe(stateSql))[0];assert.equal(row.login,'authenticator');assert.equal(row.role,row.login);for(const key of ['site','request','actor','subject'])assert.equal(row[key],null,'Leaked pooled context '+key);assert(Number.isSafeInteger(row.pid));if(expectedPid!==undefined)assert.equal(row.pid,expectedPid,'Sequential direct operations must reuse the actual session');return row.pid as number;}
async function bind(tx:PooledSqlClient,scope:OwnedStoreScope){await tx.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)',['app.actor_id',scope.customUser.id,'request.jwt.claim.sub',scope.authUser.id]);}
const forbidden=(status:number,code:string)=>(error:unknown)=>{assert(error!==null&&typeof error==='object');const e=error as{statusCode?:number;code?:string};assert.equal(e.statusCode,status);assert.equal(e.code,code);return true;};
async function directRead(scope:OwnedStoreScope,page=1,limit=20):Promise<CollectionListPage>{assert(gateway);return readOwnedCollectionList(gateway.env,{...scope,tenant:{...scope.tenant,requestId:randomUUID()}},{page,limit});}
async function observedHttp(site:SyntheticTenant,actor:string,status:number,expectedSite:string|null,env?:Env){
 assert(gateway);await gateway.settle();const before=httpSnapshot(),headers=new Headers(await signedIdentityHeaders(actor,email(actor),actor===actors[0]?a.siteId:b.siteId));
 const jti=headers.get('X-LetBuyy-Internal-JTI');assert(jti);const expected:HttpExpectation={requestId:randomUUID(),traceId:randomUUID(),jtiHash:hash(jti),actorId:actor,method:'GET',route:'/v1/products/collections',status,errorCode:null,siteId:expectedSite,ip:nextClientAddress(),userAgent:'LetBuyy-collection-count-owned-native'};
 for(const [key,value] of Object.entries({'X-Request-ID':expected.requestId,'X-Trace-ID':expected.traceId,'CF-Connecting-IP':expected.ip,'User-Agent':expected.userAgent}))headers.set(key,value);
 const result=await gateway.request('/v1/products/collections?store_id='+site.siteId+'&page=1&limit=20',{headers},env);await gateway.settle();const after=httpSnapshot();
 proof('mounted-http-before-attribution',{expected,before,after,status:result.status,response:{status:result.status,text:result.text,json:result.json,headers:{requestId:result.headers.get('X-Request-ID'),traceId:result.headers.get('X-Trace-ID')}},restResources:restTap?.calls.map(call=>({method:call.method,resource:call.resource}))??null});assert.equal(result.status,status,result.text);assert.equal(result.headers.get('X-Request-ID'),expected.requestId);assert.equal(result.headers.get('X-Trace-ID'),expected.traceId);
 const attribution=assertHttpNoDomainEffects(before,after,expected);proof('mounted-http-attributed',{expected,attribution});
 if(status===200){const body=CollectionListPageSchema.parse(result.json);assert(body.data.length>0);assert(body.data.every(row=>row.store_id===site.siteId));}
 else{assert.equal(result.json?.data,undefined);assert.doesNotMatch(result.text,/app\.site_id|request\.jwt|current_user|service_role|postgres(?:ql)?:\/\/|SELECT\s|stack/i);}
 return result;
}

test('owned collection list counts preserve tenant authority, complete assignments and all classified state',{timeout:540_000},async()=>{
 async function stage(name:string,work:()=>unknown|Promise<unknown>){proof('stage-start',{name});await work();proof('stage-pass',{name});}
 await stage('0 synthetic fixture and exact current authority baseline',async()=>{
  for(const site of [a,b,empty])seedSyntheticTenant(owned.psql,site);
  owned.script(`INSERT INTO users_custom(id,email,email_verified) VALUES ${actors.map(id=>`(${q(id)},${q(email(id))},true)`).join(',')};UPDATE sites SET custom_user_id=${q(actors[0])} WHERE id IN(${q(a.siteId)},${q(empty.siteId)});UPDATE sites SET custom_user_id=${q(actors[1])} WHERE id=${q(b.siteId)};`);
  seedProducts(a.siteId,products);seedProducts(b.siteId,[bProduct]);seedCollections(a.siteId,collections);seedCollections(a.siteId,[deletedCollection],true);seedCollections(b.siteId,[bCollection]);assign(collections[1],products.slice(0,2));assign(collections[2],[products[2]]);assign(collections[3],[products[3]]);assign(bCollection,[bProduct]);
  owned.script(`UPDATE products SET deleted_at=now() WHERE id=${q(products[0])};UPDATE products SET is_active=false,status='archived' WHERE id=${q(products[2])};`);
  proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));sql=getPooledSql(gateway.env,{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;assert(sql);
 });
 assert(gateway);const aScope=await directScope(a,actors[0]),bScope=await directScope(b,actors[1]),emptyScope=await directScope(empty,actors[0]);
 const authorityBefore=authority(),privileges=z.object({junctionPrivileges:z.unknown()}).passthrough().parse(authorityBefore.catalog).junctionPrivileges;
 assert.deepEqual(privileges,{tenant_select:false,tenant_write:false,service_select:true,service_write:false,private_rpc_tenant:false,private_rpc_service:false});
 proof('authority-baseline',authorityBefore);
 await stage('1 actual A and B own positives first, true 0/2/1/1 includes unavailable, foreign owner denied',async()=>{
  const before=allPublicHashes(),pid=await baseState();
  const own=await directRead(aScope);assert.equal(own.meta.total,4);assert.deepEqual(new Map(own.data.map(row=>[row.id,row.product_count])),new Map(collections.map((id,i)=>[id,[0,2,1,1][i]])));assert(!own.data.some(row=>row.id===deletedCollection));
  assert.equal((await directRead(bScope)).data[0]?.product_count,1);await baseState(pid);
  const forged:OwnedStoreScope={...bScope,siteId:a.siteId,storeId:a.siteId,authUser:{...bScope.authUser,storeId:a.siteId},tenant:{...bScope.tenant,siteId:a.siteId}};
  await assert.rejects(()=>directRead(forged),forbidden(403,'FORBIDDEN'));await baseState(pid);
  assert.deepEqual(allPublicHashes(),before);assert.deepEqual(authority(),authorityBefore);proof('own-positive-first-counts',{counts:collections.map(id=>({id,count:own.data.find(row=>row.id===id)?.product_count})),unavailableProduct:products[0],backendPid:pid,allPublicTableHashes:before});
 });
 await stage('2 all 151 assigned members count beyond the first 100 picker choices',async()=>{
  seedProducts(a.siteId,largeProducts);seedCollections(a.siteId,[largeCollection]);assign(largeCollection,largeProducts);
  const before=allPublicHashes(),result=await directRead(aScope);assert.equal(result.data.find(row=>row.id===largeCollection)?.product_count,151);assert.deepEqual(allPublicHashes(),before);proof('untruncated-count',{collectionId:largeCollection,count:151,total:result.meta.total});
 });
 await stage('3 more than 20 tied parents page without duplicates/loss; true empty and past-end retain exact totals',async()=>{
  seedCollections(a.siteId,padding);const ids=[...collections,largeCollection,...padding].sort((x,y)=>x<y?1:x>y?-1:0),before=allPublicHashes();
  const first=await directRead(aScope,1,20),second=await directRead(aScope,2,20);assert.equal(first.meta.total,27);assert.equal(second.meta.total,27);assert.equal(first.meta.has_next,true);assert.equal(second.meta.has_prev,true);assert.equal(second.meta.has_next,false);assert.deepEqual([...first.data,...second.data].map(row=>row.id),ids);
  const past=await directRead(aScope,3,20);assert.deepEqual(past.data,[]);assert.equal(past.meta.total,27);assert.equal(past.meta.total_pages,2);assert.equal(past.meta.has_prev,true);assert.equal(past.meta.has_next,false);
  const zero=await directRead(emptyScope);assert.deepEqual(zero.data,[]);assert.equal(zero.meta.total,0);assert.equal(zero.meta.total_pages,0);assert.equal(zero.meta.has_prev,false);assert.equal(zero.meta.has_next,false);assert.deepEqual(allPublicHashes(),before);proof('pagination',{first:first.meta,second:second.meta,past:past.meta,empty:zero.meta,orderedIds:ids});
 });
 await stage('4 app_tenant junction SELECT, valid DML and private snapshot RPC still give actual 42501',async()=>{
  const statements:[string,string[]][]=[['SELECT id FROM public.collection_products WHERE collection_id=$1::uuid',[collections[1]]],['INSERT INTO public.collection_products(collection_id,product_id,position) VALUES($1::uuid,$2::uuid,0)',[collections[0],products[3]]],['UPDATE public.collection_products SET position=position WHERE collection_id=$1::uuid',[collections[1]]],['DELETE FROM public.collection_products WHERE collection_id=$1::uuid',[collections[1]]],['TRUNCATE public.collection_products',[]],['SELECT public.collection_membership_snapshot_v1($1::uuid,$2::uuid)',[a.siteId,collections[1]]]];
  const before=allPublicHashes();for(const [statement,params] of statements){let code:string|undefined;await assert.rejects(()=>withTenantTx(gateway!.env,aScope.tenant,async tx=>{await bind(tx,aScope);assert.equal((await tx.unsafe('SELECT id FROM public.sites WHERE id=$1::uuid',[a.siteId])).length,1,'own-row positive before denial');assert.equal((await tx.unsafe('SELECT id FROM public.sites WHERE id=$1::uuid',[b.siteId])).length,0,'real foreign-site RLS denial');await tx.unsafe(statement,params);}),error=>{const e=error as{code?:string;message?:string};code=e.code;assert.equal(e.code,'42501');assert.match(e.message??'',/permission denied/);return true;});proof('ordinary-role-denial',{statement,code});await baseState();assert.deepEqual(allPublicHashes(),before);}
  assert.deepEqual(authority(),authorityBefore);
 });
 // Tenant transactions intentionally ignore the optional storefront-read flag.
 // Remove every real connection source to exercise an actually absent pool.
 await stage('5 known missing pool returns sanitized 503 without any REST count fallback',async()=>{
  const before=allPublicHashes();assert(gateway);const noPool={...gateway.env,HYPERDRIVE:undefined,DATABASE_URL:undefined,SUPABASE_DB_URL:undefined} as Env;restTap=tapRest(owned.restUrl,async(_call,forward)=>forward());
  try{await assert.rejects(()=>readOwnedCollectionList(noPool,aScope,{page:1,limit:20}),forbidden(503,'COLLECTION_LIST_UNAVAILABLE'));assert.equal(restTap.calls.length,0,'direct operation must not reach REST at all');}finally{restTap.restore();restTap=undefined;}
  assert.deepEqual(allPublicHashes(),before);proof('missing-pool',{status:503,code:'COLLECTION_LIST_UNAVAILABLE',restCalls:0});
 });
 await stage('6 actual SQL failure aborts and clears role/actor/subject/site/request before same-backend B then A reads',async()=>{
  const before=allPublicHashes(),pid=await baseState();await assert.rejects(()=>withTenantTx(gateway!.env,aScope.tenant,async tx=>{await bind(tx,aScope);const row=(await tx.unsafe(stateSql))[0];assert.equal(row.pid,pid);assert.equal(row.role,'app_tenant');assert.equal(row.site,a.siteId);assert.equal(row.actor,actors[0]);assert.equal(row.subject,actors[0]);await tx.unsafe('SELECT 1/0');}),error=>{assert.equal((error as{code?:string}).code,'22012');return true;});await baseState(pid);
  const nextB=await directRead(bScope);assert.equal(nextB.data.length,1);assert(nextB.data.every(row=>row.store_id===b.siteId));await baseState(pid);const nextA=await directRead(aScope);assert.equal(nextA.meta.total,27);assert(nextA.data.every(row=>row.store_id===a.siteId));await baseState(pid);assert.deepEqual(allPublicHashes(),before);assert.deepEqual(authority(),authorityBefore);proof('after-error-same-backend-reuse',{backendPid:pid,sqlState:'22012',bTotal:nextB.meta.total,aTotal:nextA.meta.total,allPublicTableHashes:before,limit:'This is a real ordinary tenant SQL error, not an injected count-window switch/restore fault. Hermetic restore-fault assertions remain unit claims.'});
 });
 await stage('7 mounted Gateway own A/B positive before foreign denial; legitimate request records exactly classified',async()=>{
  await observedHttp(a,actors[0],200,a.siteId);await observedHttp(b,actors[1],200,b.siteId);const foreign=await observedHttp(a,actors[1],403,null);assert.equal(foreign.json?.error?.code,'FORBIDDEN');
  const noPool={...gateway!.env,HYPERDRIVE:undefined,DATABASE_URL:undefined,SUPABASE_DB_URL:undefined} as Env;restTap=tapRest(owned.restUrl,async(_call,forward)=>forward());try{const unavailable=await observedHttp(a,actors[0],503,a.siteId,noPool);assert.equal(unavailable.json?.error?.code,'COLLECTION_LIST_UNAVAILABLE');assert(!restTap.calls.some(call=>call.resource==='collection_products'||call.resource==='rpc/collection_membership_snapshot_v1'),'no REST count fallback after pooled refusal');}finally{restTap.restore();restTap=undefined;}
  assert.deepEqual(authority(),authorityBefore);assert.deepEqual(migrationSources(),initialMigrationSources,'Migration source changed during suite');proof('final-scope',{migrationSourcesExact:true,authorityExact:true,notProven:['Normal merchant UI count retest M05','All-ten-theme acceptance','Injected count-window role/restore/rollback native faults','Normal merchant/browser authentication']});
 });
});
