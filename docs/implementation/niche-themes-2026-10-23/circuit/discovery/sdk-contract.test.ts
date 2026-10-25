import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyApiClient } from '@letbuyy/api-client';

const id='11111111-1111-4111-8111-111111111111', variant='22222222-2222-4222-8222-222222222222';
const discovery={query:{page:2,limit:1,sort:'price-asc',pack_size:'g:500'},facets:[{key:'pack_size',value:'g:500',label:'500 g',count:3}],matches:[{product_id:id,price:340,variant_ids:[variant]}]};
test('the three canonical storefront pages retain safe discovery metadata, repeated choices and verified-preview controls',async()=>{
 const calls:URL[]=[];
 const client=createLetbuyyApiClient({baseUrl:'https://api.example.invalid/v1',fetch:async input=>{calls.push(new URL(String(input)));return Response.json({success:true,data:[{id,price:999}],meta:{page:2,per_page:1,total:3,has_next:true},discovery});}});
 const query={page:2,limit:1,pack_size:'g:500',connector:['usb-c','hdmi'] as ('usb-c'|'hdmi')[],sort:'price-asc' as const};
 const pages=[await client.storefront.listProducts('synthetic',query),await client.storefront.listProductsByStoreId(id,query),await client.storefront.themePreviewProductPage('synthetic','verified-token',query)];
 for(const page of pages){assert.deepEqual(page.discovery,discovery);assert.equal(page.data[0].price,999);assert.equal(page.total,3);assert.equal(page.page,2);assert.equal(page.limit,1);assert.equal(page.has_more,true);}
 for(const call of calls){assert.deepEqual(call.searchParams.getAll('connector'),['usb-c','hdmi']);assert.equal(call.searchParams.get('pack_size'),'g:500');}
 assert.equal(calls[2].searchParams.get('token'),'verified-token');assert.equal(calls[2].searchParams.get('resource'),'products');assert.equal(calls[2].searchParams.get('pagination'),'1');
});
test('generic clients keep their existing pagination shape and do not acquire storefront metadata',async()=>{
 const client=createLetbuyyApiClient({baseUrl:'https://api.example.invalid/v1',fetch:async()=>Response.json({success:true,data:[],meta:{page:4,per_page:20,total:0,has_next:false},discovery})});
 const result=await client.requestPaginated('/synthetic-reader');
 assert.equal(Object.hasOwn(result,'discovery'),false);assert.equal(result.page,4);assert.equal(result.total,0);assert.equal(result.limit,20);
});
test('signed collection singleton preserves private request controls and uses the existing scoped resource',async()=>{
 let received:RequestInit|undefined,url:URL|undefined;
 const summary={id,title:'Synthetic collection',description:null,image_url:null};
 const client=createLetbuyyApiClient({baseUrl:'https://api.example.invalid/v1',fetch:async(input,init)=>{url=new URL(String(input));received={...init,cache:'no-store'};return Response.json({success:true,data:summary});}});
 assert.deepEqual(await client.storefront.themePreviewCollection('synthetic','signed-preview',id,{headers:{'X-Synthetic-Control':'kept'},signal:new AbortController().signal}),summary);
 assert.equal(url?.searchParams.get('resource'),'collections');assert.equal(url?.searchParams.get('collection_id'),id);assert.equal(url?.searchParams.get('token'),'signed-preview');
 assert.equal(new Headers(received?.headers).get('X-Synthetic-Control'),'kept');assert.equal(received?.cache,'no-store');
});
