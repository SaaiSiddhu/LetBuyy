// Hermetic mechanics of the ACTUAL closed operation with an injected transaction only.
// This does not certify PostgreSQL roles/RLS/permissions or a production route; owned native qualification remains required.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const base=fileURLToPath(new URL('../../../../',import.meta.url));
const site='a0000000-0000-4000-8000-000000000001',actor='b0000000-0000-4000-8000-000000000001',foreign='c0000000-0000-4000-8000-000000000001';
const ids=Array.from({length:4},(_,i)=>`d0000000-0000-4000-8000-00000000000${i+1}`);
const parent=(id:string)=>({id,store_id:site,title:'Owned collection',description:null,image_url:null,is_active:true,created_at:'2026-10-24T00:00:00Z',membership_version:1});
type Options={fault?:string;counts?:unknown[];parents?:unknown[];total?:number;noPool?:boolean;denyOwner?:boolean};
function fixture(o:Options={}) {
 const file=resolve(base,'services/api-gateway/src/execution/collection-membership.adapter.ts');
 const require=createRequire(file);
 const evaluatedModule={exports:{}};const logs:string[]=[];const calls:{q:string,p:unknown[],role:string}[]=[];
 let role='app_tenant',siteGuc=site,window=false,aborted=false,committed=false,profiles=0;
 const scope={siteId:site,storeId:site,customUser:{id:actor},authUser:{id:actor,storeId:site},tenant:{siteId:site,userId:actor,requestId:'owned-test-request'},db:new Proxy({}, {get(){throw Error('REST fallback forbidden');}})};
 const profile=()=>({oid:'100',owner:'postgres',kind:'r',persistence:'p',acl:['existing SELECT'],acl_valid:true,rls:true,force_rls:false,service_select:true,service_write:false,tenant_select:false,parent_oid:'101',product_oid:'102',columns:[['id',2950,true,null],['collection_id',2950,true,null],['product_id',2950,true,null],['position',23,false,null]],constraints:[['p',[1],0,[],true],['u',[2,3],0,[],true],['f',[2],'101',[1],true],['f',[3],'102',[1],true]],roles:['app_tenant','service_role'].map(rolname=>({rolname,rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,rolbypassrls:rolname==='service_role',rolcanlogin:false})),policies:[]});
 const tx={unsafe:async(q:string,p:unknown[]=[])=>{
   calls.push({q,p,role});
   if(q==='SAVEPOINT collection_assignment_count')window=true;
   if(q==='SET LOCAL ROLE service_role'){if(o.fault==='switch')throw Error('PRIVATE_DB_TOKEN');role='service_role';}
   if(q==='SET LOCAL ROLE app_tenant'){if(o.fault==='restore'&&window)throw Error('PRIVATE_DB_TOKEN');role='app_tenant';}
   if(q.startsWith('ROLLBACK TO')){if(o.fault==='rollback')throw Error('PRIVATE_DB_TOKEN');role='app_tenant';siteGuc=site;}
   if(q.includes('collection-list:context'))return[{role,selected_role:role,session_user:'owned_pool',backend:100,site:siteGuc,request:'owned-test-request',actor,subject:actor}];
   if(q.includes('collection-list:owner'))return o.denyOwner?[]:[{id:site}];
   if(q.includes('collection-list:parents'))return[{total:o.total??4,items:o.parents??ids.map(parent)}];
   if(q.includes('collection-list:profile')){profiles++;const p=profile();if(o.fault==='profile'&&profiles>1)p.oid='200';if(o.fault==='acl')p.acl_valid=false;return[{profile:p}];}
   if(q.includes('collection-list:fixed-count')){
     if(o.fault==='query'||o.fault==='rollback')throw Error('PRIVATE_DB_TOKEN');
     if(o.fault==='context')siteGuc=foreign;
     return o.counts??ids.map((id,i)=>({id,product_count:[0,2,1,1][i]}));
   }
   if(q.includes('collection-list:confirm'))return ids.map(id=>({id,membership_version:o.fault==='revision'?2:1}));
   return[];
 }};
 const helper={bindOwnedTenantActor:async()=>{},withTenantTx:async(_env:unknown,_tenant:unknown,fn:(tx:unknown)=>Promise<unknown>)=>{if(o.noPool)throw Error('PRIVATE_DB_TOKEN');try{const result=await fn(tx);committed=true;return result;}catch(e){aborted=true;throw e;}finally{role='pool_base';}},TenantTransactionUnavailableError:class extends Error{}};
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports','__filename','__dirname','console',js)((name:string)=>name==='../lib/tenant-transaction'?helper:require(name),evaluatedModule,evaluatedModule.exports,file,dirname(file),{info:(s:string)=>logs.push(s),error:(s:string)=>logs.push(s)});
 const api=evaluatedModule.exports as {readOwnedCollectionList:(env:unknown,scope:unknown,intent:unknown)=>Promise<{data:{id:string;product_count:number}[];meta:{total:number;page:number}}>};
 return{run:(intent:unknown={page:1,limit:20})=>api.readOwnedCollectionList({},scope,intent),scope,calls,logs,state:()=>({role,aborted,committed})};
}
test('closed operation returns confirmed0/2/1/1 and restores tenant role before any result',async()=>{const f=fixture();const result=await f.run();assert.deepEqual(result.data.map(r=>r.product_count),[0,2,1,1]);assert.equal(f.calls.filter(c=>c.q==='SET LOCAL ROLE service_role').length,1);assert(f.calls.filter(c=>c.role==='service_role').every(c=>c.q.includes('collection-list:context')||c.q.includes('collection-list:fixed-count')||c.q==='SET LOCAL ROLE app_tenant'));assert(f.state().committed);assert(!f.logs.join('').includes(site));});
test('full assignment count above100 is not product-picker truncation',async()=>{const f=fixture({counts:ids.map(id=>({id,product_count:151}))});assert((await f.run()).data.every(row=>row.product_count===151));});
test('parent page and count statement are fixed, parameterized and use only positive parent IDs',async()=>{const f=fixture();await f.run();const p=f.calls.find(c=>c.q.includes('collection-list:parents'))!;assert.equal(p.role,'app_tenant');assert(p.q.includes('FOR SHARE'));assert(p.q.includes('created_at DESC,c.id DESC'));const c=f.calls.find(c=>c.q.includes('collection-list:fixed-count'))!;assert.equal(c.role,'service_role');assert.deepEqual(c.p,[site,ids]);assert(!c.q.includes(site));assert(!c.q.includes('JOIN public.products'));});
test('known owned empty store is successful empty without elevation',async()=>{const f=fixture({parents:[],total:0});assert.deepEqual((await f.run()).data,[]);assert(!f.calls.some(c=>c.q==='SET LOCAL ROLE service_role'));});
test('past-end page keeps exact total rather than fabricating empty count',async()=>{const f=fixture({parents:[],total:4});const r=await f.run({page:5,limit:2});assert.equal(r.meta.total,4);assert.equal(r.meta.page,5);assert(!f.calls.some(c=>c.q==='SET LOCAL ROLE service_role'));});
test('ownership refusal happens before count capability',async()=>{const f=fixture({denyOwner:true});await assert.rejects(f.run,{statusCode:403});assert(!f.calls.some(c=>c.q==='SET LOCAL ROLE service_role'));assert(f.state().aborted);});
test('foreign parent cannot enter the derived witness',async()=>{const f=fixture({parents:ids.map(id=>({...parent(id),store_id:foreign}))});await assert.rejects(f.run,{statusCode:503});assert(!f.calls.some(c=>c.q==='SET LOCAL ROLE service_role'));});
for(const fault of ['switch','query','restore','rollback','context','profile','revision'])test('actual operation aborts/restores or rolls back on '+fault,async()=>{const f=fixture({fault});await assert.rejects(f.run,{statusCode:503});assert(f.state().aborted);assert(!f.state().committed);assert(!f.logs.join('').includes('PRIVATE_DB_TOKEN'));assert(f.calls.some(c=>c.q.startsWith('ROLLBACK TO')));});
for(const [name,counts] of [['missing',[]],['duplicate',ids.map(()=>({id:ids[0],product_count:1}))],['foreign',ids.map(()=>({id:foreign,product_count:1}))],['negative',ids.map(id=>({id,product_count:-1}))],['string',ids.map(id=>({id,product_count:'2'}))]] as const)test('malformed '+name+' count is unavailable rather than0',async()=>{const f=fixture({counts:[...counts]});await assert.rejects(f.run,{statusCode:503});assert(f.state().aborted);});
test('missing pool fails closed without accessing REST',async()=>{const f=fixture({noPool:true});await assert.rejects(f.run,{statusCode:503});assert.equal(f.calls.length,0);});
test('invalid pagination is refused before transaction',async()=>{const f=fixture();await assert.rejects(()=>f.run({page:0,limit:101}));assert.equal(f.calls.length,0);});
test('exported operation has no callback/client/SQL/role or ID batch input; no business/audit write',()=>{const s=readFileSync(resolve(base,'services/api-gateway/src/execution/collection-membership.adapter.ts'),'utf8').split('// Closed read operation:')[1];assert(s.includes('env: Env, scope: OwnedStoreScope, intent: CollectionListPagination)'));assert(!/\b(INSERT INTO|UPDATE public|DELETE FROM)\b/.test(s));assert(!s.includes('scope.db'));assert(s.includes('withTenantTx(env, scope.tenant, async tx'));});

test('unknown ACL expansion fails before elevation',async()=>{const f=fixture({fault:'acl'});await assert.rejects(f.run,{statusCode:503});assert(!f.calls.some(c=>c.q==='SET LOCAL ROLE service_role'));});

test('closed operation binds only its validated actor and subject inside ordinary tenant transaction',async()=>{const f=fixture();await f.run();assert.deepEqual(f.calls[0].p,['app.actor_id',actor,'request.jwt.claim.sub',actor]);assert.equal(f.calls[0].role,'app_tenant');});

test('profile fixes builtin type OID JSON representation explicitly without relaxing pinned UUID/int types',()=>{const s=readFileSync(resolve(base,'services/api-gateway/src/execution/collection-membership.adapter.ts'),'utf8');assert(s.includes('a.attname,a.atttypid::integer,a.attnotnull'));assert(s.includes('i===3?23:2950'));});
