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

test('cursor browsing covers every eligible collection, supports previous pages, and never uses offset or count',async()=>{
 const a=tenant('browse-a'),b=tenant('browse-b');
 const ids=Array.from({length:53},(_,i)=>collection(a.siteId,'Synthetic browse '+String(i).padStart(2,'0'))).sort();
 collection(a.siteId,'Synthetic hidden',{active:false});collection(a.siteId,'Synthetic deleted',{deleted:true});const foreign=collection(b.siteId,'Synthetic foreign browse');
 const browse=(query='')=>gateway.request(`/v1/storefront/${a.subdomain}/collections?browse=1${query}`);
 const before=tap!.calls.length,first=await browse();assert.equal(first.status,200,first.text);const firstPage=first.json!.data;
 assert.deepEqual(firstPage.items.map((x:{id:string})=>x.id),ids.slice(0,24));assert.equal(firstPage.previousCursor,null);assert.equal(firstPage.nextCursor,ids[23]);
 const second=await browse('&after='+firstPage.nextCursor);assert.equal(second.status,200);const secondPage=second.json!.data;
 assert.deepEqual(secondPage.items.map((x:{id:string})=>x.id),ids.slice(24,48));assert.equal(secondPage.previousCursor,ids[24]);
 const third=await browse('&after='+secondPage.nextCursor);assert.equal(third.status,200);assert.deepEqual(third.json!.data.items.map((x:{id:string})=>x.id),ids.slice(48));assert.equal(third.json!.data.nextCursor,null);
 const previous=await browse('&before='+secondPage.previousCursor);assert.equal(previous.status,200);assert.deepEqual(previous.json!.data,firstPage);
 for(const call of tap!.calls.slice(before).filter(c=>c.resource==='collections')){assert.equal(call.search.get('store_id'),'eq.'+a.siteId);assert.equal(call.search.get('limit'),'25');assert.equal(call.search.get('offset'),null);assert.equal(call.search.get('select'),'id,title,description,image_url');}
 const foreignRead=await gateway.request(`/v1/storefront/${b.subdomain}/collections?browse=1&after=${ids[0]}`);assert.equal(foreignRead.status,200);assert.ok(foreignRead.json!.data.items.every((x:{id:string})=>x.id===foreign));
 for(const query of ['browse=bad','browse=1&after=bad','browse=1&before=bad',`browse=1&after=${ids[0]}&before=${ids[1]}`,`after=${ids[0]}`]){const callStart=tap!.calls.length;assert.equal((await gateway.request(`/v1/storefront/${a.subdomain}/collections?${query}`)).status,400);assert.equal(tap!.calls.slice(callStart).filter(c=>c.resource==='collections').length,0);}
 const empty=await browse('&after='+ids[ids.length-1]);assert.equal(empty.status,200);assert.deepEqual(empty.json!.data,{items:[],nextCursor:null,previousCursor:null});
});
