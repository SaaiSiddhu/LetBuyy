// Real mounted Gateway and ordinary RLS/GUC SQL transport. Signed caller is a
// synthetic identity fixture; this suite does not claim browser authentication.
import assert from 'node:assert/strict';
import test, {before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {CollectionListPageSchema} from '@letbuyy/shared-types';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase(),a=newSyntheticTenant('collection-filter'),b=newSyntheticTenant('collection-foreign');
const actor=randomUUID(),email=`syn-collection-${actor}@example.invalid`,wanted:string[]=[randomUUID(),randomUUID()],foreign=randomUUID();
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway;
before(async()=>{
 seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}'WHERE id IN('${a.siteId}','${b.siteId}');
 INSERT INTO collections(id,store_id,title,description,is_active,created_at) VALUES
 ${Array.from({length:26},(_,i)=>`('${randomUUID()}','${a.siteId}','Synthetic ordinary ${i}',NULL,${i%2===0},'2026-11-01T00:00:00Z')`).join(',')},
 ('${wanted[0]}','${a.siteId}','Rare%_ Cotton tote',NULL,true,'2026-01-01T00:00:00Z'),
 ('${wanted[1]}','${a.siteId}','Synthetic archive','rare%_ in description',false,'2026-01-02T00:00:00Z'),
 ('${foreign}','${b.siteId}','Rare%_ foreign private',NULL,true,'2026-11-01T00:00:00Z'),
 ('${randomUUID()}','${a.siteId}','RareXYZ should not match wildcard',NULL,true,'2026-11-01T00:00:00Z');`);
 proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),proxy.env()));
});
after(async()=>{await gateway?.settle();await closePooledSqlClients();await proxy?.stop();});
async function list(query:Record<string,string>={},site=a.siteId){return gateway.request('/v1/products/collections?'+new URLSearchParams({store_id:site,...query}),{headers:{...await signedIdentityHeaders(actor,email,site),'X-Store-ID':site}});}
test('search covers the complete population beyond the first page and treats wildcard characters literally',async()=>{
 const ordinary=await list();assert.equal(ordinary.status,200,ordinary.text);assert.equal(ordinary.json?.data.length,20);assert(!ordinary.json?.data.some((r:{id:string})=>wanted.includes(r.id)));
 const response=await list({search:'  RARE%_  '});assert.equal(response.status,200,response.text);const parsed=CollectionListPageSchema.parse(response.json);assert.equal(parsed.meta.total,2);assert.deepEqual(parsed.data.map(r=>r.id),[wanted[1],wanted[0]]);assert(parsed.data.every(r=>r.store_id===a.siteId));
 const foreignPositive=await list({search:'rare%_'},b.siteId);assert.equal(foreignPositive.status,200,foreignPositive.text);assert.equal(foreignPositive.json?.meta.total,1);assert.equal(foreignPositive.json?.data[0].id,foreign);
});
test('filtered totals, pages, empty past-page results and active state describe the same population',async()=>{
 for(const [status,id]of [['active',wanted[0]],['inactive',wanted[1]]]as const){const r=await list({search:'rare%_',status});assert.equal(r.status,200,r.text);const p=CollectionListPageSchema.parse(r.json);assert.equal(p.meta.total,1);assert.equal(p.data[0].id,id);}
 const second=await list({search:'rare%_',limit:'1',page:'2'});assert.equal(second.status,200,second.text);assert.equal(second.json?.meta.total,2);assert.equal(second.json?.meta.has_prev,true);assert.equal(second.json?.meta.has_next,false);assert.equal(second.json?.data[0].id,wanted[0]);
 const past=await list({search:'rare%_',limit:'1',page:'3'});assert.equal(past.status,200,past.text);assert.equal(past.json?.meta.total,2);assert.deepEqual(past.json?.data,[]);
 const none=await list({search:'Definitely missing synthetic'});assert.equal(none.status,200,none.text);assert.equal(none.json?.meta.total,0);assert.deepEqual(none.json?.data,[]);
});
test('invalid filters are refused without reading another population',async()=>{
 const queries:Record<string,string>[]=[{status:'draft'},{search:'a'.repeat(201)},{limit:'101'}];
 for(const query of queries){const r=await list(query);assert.equal(r.status,400,r.text);assert.equal(r.json?.data,undefined);}
});
