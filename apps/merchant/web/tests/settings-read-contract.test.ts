import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
const site='00000000-0000-4000-8000-000000000001';
const foreign='00000000-0000-4000-8000-000000000002';
for(const resource of ['zones','rates','profiles','taxes'] as const) {
 function client(fetcher: typeof fetch) {
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',storeId:foreign,fetch:fetcher,maxRetries:0});
  return resource==='taxes'?()=>api.taxes.list({store_id:site}):()=>api.shipping[resource].list({store_id:site});
 }
 test(resource+' settings compose pages with one pinned store and reject unverified counts', async()=>{
  const pages:number[]=[];
  const read=client(async(input,init)=>{
   const url=new URL(String(input)),page=Number(url.searchParams.get('page'));
   pages.push(page); assert.equal(new Headers(init?.headers).get('X-Store-ID'),site);
   assert.equal(url.searchParams.get('store_id'),site);
   return Response.json({data:Array.from({length:page===1?100:1},(_,n)=>({id:'row-'+(n+(page-1)*100),site_id:site})),
    meta:{store_id:site,page,per_page:100,total:101,total_pages:2,has_next:page===1,has_prev:page>1}});
  });
  assert.equal((await read()).length,101);assert.deepEqual(pages,[1,2]);
  const missing=client(async()=>Response.json({data:[],meta:{}}));
  await assert.rejects(missing,error=>error instanceof LetbuyyApiError&&error.code==='SETTINGS_PAGE_UNVERIFIED');
 });
 test(resource+' settings reject foreign scope, duplicates and changing totals',async()=>{
  for(const fault of ['foreign','duplicate','count'] as const) {
   const read=client(async input=>{
    const page=Number(new URL(String(input)).searchParams.get('page'));
    const total=fault==='count'&&page===2?102:101;
    return Response.json({data:Array.from({length:page===1?100:total-100},(_,n)=>({
     id:'row-'+(n+(page-1)*100*(fault==='duplicate'?0:1)),site_id:fault==='foreign'?foreign:site,
    })),meta:{store_id:site,page,per_page:100,total,total_pages:2,has_next:page===1,has_prev:page>1}});
   });
   await assert.rejects(read,error=>error instanceof LetbuyyApiError&&['SETTINGS_PAGE_UNVERIFIED','SETTINGS_SCOPE_UNVERIFIED'].includes(error.code??''));
  }
 });
}

