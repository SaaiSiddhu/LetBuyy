// Real mounted Worker -> owned PostgREST/PostgreSQL; no restored/developer data.
import assert from 'node:assert/strict';
import test,{before,after,afterEach} from 'node:test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway,gatewayEnv,newIdentityKeys,tapRest,restJson,type RestTap} from './gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
let gateway:Gateway,proxy:OwnedPooledSqlProxy|undefined,tap:RestTap|undefined,failCollectionRead=false;
before(async()=>{proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
 tap=tapRest(owned.restUrl,async(call,forward)=>failCollectionRead&&call.resource==='collections'&&call.method==='GET'?restJson(503,{message:'Synthetic private database failure'}):forward());});
afterEach(async()=>{failCollectionRead=false;await gateway?.settle();});
after(async()=>{await gateway?.settle();tap?.restore();await closePooledSqlClients();await proxy?.stop();});
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
function collection(storeId:string,title:string,options:{active?:boolean;deleted?:boolean}={}){const id=crypto.randomUUID();owned.psql(`INSERT INTO collections(id,store_id,title,description,image_url,is_active,deleted_at)VALUES(${q(id)},${q(storeId)},${q(title)},'Synthetic public description',NULL,${options.active===false?'false':'true'},${options.deleted?'now()':'NULL'});`);return id;}
function tenant(tag:string){const t=newSyntheticTenant(tag);seedSyntheticTenant(owned.psql,t);return t;}
const read=(handle:string)=>gateway.request(`/v1/storefront/${handle}/collections`);

test('public collection discovery is finite, deterministically ordered, projected and tenant isolated',async()=>{
 const a=tenant('discovery-a'),b=tenant('discovery-b');
 const expected=Array.from({length:26},(_,i)=>({id:collection(a.siteId,'Synthetic '+String(i).padStart(2,'0')),title:'Synthetic '+String(i).padStart(2,'0')}));
 collection(a.siteId,'AAA inactive',{active:false});collection(a.siteId,'AAA deleted',{deleted:true});collection(b.siteId,'AAA foreign');
 const before=tap!.calls.length;const result=await read(a.subdomain);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.deepEqual(result.json?.data.map((r:{id:string;title:string})=>({id:r.id,title:r.title})),expected.slice(0,24));
 for(const row of result.json!.data)assert.deepEqual(Object.keys(row).sort(),['description','id','image_url','title']);
 const calls=tap!.calls.slice(before).filter(c=>c.resource==='collections');assert.equal(calls.length,1);
 assert.equal(calls[0].search.get('store_id'),'eq.'+a.siteId);assert.equal(calls[0].search.get('limit'),'24');assert.equal(calls[0].search.get('order'),'title.asc,id.asc');
 assert.equal(tap!.calls.slice(before).filter(c=>c.resource==='collection_products'||c.resource==='products').length,0,'summary list must not fan out into membership/products');
 const foreign=await read(b.subdomain);assert.equal(foreign.status,200);assert.equal(foreign.json?.data.length,1);assert.equal(foreign.json?.data[0].title,'AAA foreign');
});

test('successful empty collections differ from missing or unpublished stores',async()=>{
 const a=tenant('discovery-empty'),draft=tenant('discovery-draft');owned.psql(`UPDATE sites SET status='draft',published=false WHERE id=${q(draft.siteId)};`);collection(draft.siteId,'Private draft collection');
 const empty=await read(a.subdomain);assert.equal(empty.status,200);assert.deepEqual(empty.json?.data,[]);
 assert.equal((await read(draft.subdomain)).status,404);assert.equal((await read('syn-nonexistent-discovery')).status,404);
});

test('collection read outage is sanitized failure and retry returns real rows',async()=>{
 const a=tenant('discovery-fault');const id=collection(a.siteId,'Synthetic retry collection');failCollectionRead=true;
 const unavailable=await read(a.subdomain);assert.equal(unavailable.status,500);assert.doesNotMatch(unavailable.text,/Synthetic private|postgres|SQLSTATE/i);assert.notDeepEqual(unavailable.json?.data,[]);
 failCollectionRead=false;const retry=await read(a.subdomain);assert.equal(retry.status,200);assert.equal(retry.json?.data[0].id,id);
});
