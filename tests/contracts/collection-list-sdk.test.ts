import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLetbuyyApiClient} from '../../packages/typescript/api-client/src/index';
const id='a0000000-0000-4000-8000-000000000001';
const row={id,store_id:id,title:'Owned collection',description:null,image_url:null,is_active:true,created_at:'2026-10-24T00:00:00Z',membership_version:1};
const envelope=(value:unknown)=>({success:true,data:[value],meta:{page:1,per_page:20,total:1,total_pages:1,has_next:false,has_prev:false}});
function client(value:unknown){return createLetbuyyApiClient({baseUrl:'http://example.invalid',fetch:async()=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})});}
for(const [name,count] of [['missing',undefined],['string','2'],['negative',-1],['unsafe',Number.MAX_SAFE_INTEGER+1]] as const)test('canonical SDK refuses '+name+' assignment count',async()=>{await assert.rejects(()=>client(envelope({...row,...(count===undefined?{}:{product_count:count})})).products.collections.list({store_id:id}));});
test('typed paginated list preserves real0/2/1/1 counts',async()=>{const rows=[0,2,1,1].map((product_count,i)=>({...row,id:`d0000000-0000-4000-8000-00000000000${i+1}`,product_count}));const result=await client({success:true,data:rows,meta:{page:1,per_page:20,total:4,total_pages:1,has_next:false,has_prev:false}}).products.collections.list({store_id:id});assert.deepEqual(result.data.map(r=>r.product_count),[0,2,1,1]);assert.equal(result.meta.total,4);});
test('SDK refuses a foreign store row even with a valid count',async()=>{await assert.rejects(()=>client(envelope({...row,store_id:'c0000000-0000-4000-8000-000000000001',product_count:2})).products.collections.list({store_id:id}));});
test('SDK refuses wrong page response instead of accepting stale data',async()=>{await assert.rejects(()=>client(envelope({...row,product_count:2})).products.collections.list({store_id:id,page:2}));});
test('SDK preserves past-end total and validates navigation metadata',async()=>{const result=await client({success:true,data:[],meta:{page:4,per_page:2,total:5,total_pages:3,has_next:false,has_prev:true}}).products.collections.list({store_id:id,page:4,limit:2});assert.equal(result.meta.total,5);assert.equal(result.data.length,0);});
test('SDK validates pagination intent before any transport',async()=>{let calls=0;const c=createLetbuyyApiClient({baseUrl:'http://example.invalid',fetch:async()=>{calls++;throw Error('must not fetch');}});await assert.rejects(()=>c.products.collections.list({store_id:id,page:0}));assert.equal(calls,0);});
