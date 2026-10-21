import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyApiClient,LetbuyyApiError} from '../../packages/typescript/api-client/src/index';

test('canonical text transport preserves export JSON bytes, decimal spelling, Unicode and final newline',async()=>{
 const raw='{ "total": 9007199254740993.00, "name": "தமிழ் buyer", "escaped": "\\n" }\n';let calls=0;
 const api=createLetbuyyApiClient({baseUrl:'https://api.letbuyy.test',fetch:async()=>{calls++;return new Response(raw,{headers:{'Content-Type':'application/json; charset=utf-8'}});}});
 assert.equal(await api.request<string>('/owned-export',{method:'POST',body:{},responseType:'text'}),raw);assert.equal(calls,1);
});
test('text transport retains HTTP and semantic error validation and never automatically retries a consumed download',async()=>{
 for(const status of [200,410,503]){let calls=0;const api=createLetbuyyApiClient({baseUrl:'https://api.letbuyy.test',fetch:async()=>{calls++;return new Response(JSON.stringify({success:false,error:{code:'EXPORT_ALREADY_RELEASED',message:'Already released'}}),{status,headers:{'Content-Type':'application/json'}});}});
  await assert.rejects(api.request<string>('/owned-export',{method:'POST',body:{},responseType:'text'}),error=>error instanceof LetbuyyApiError&&error.code==='EXPORT_ALREADY_RELEASED');assert.equal(calls,1);
 }
});


test('render bootstrap explicitly opts in without changing legacy or private preview request shapes',async()=>{
 const requests:URL[]=[];
 const api=createLetbuyyApiClient({baseUrl:'https://api.letbuyy.test',fetch:async(input)=>{
  requests.push(new URL(input instanceof Request?input.url:String(input)));
  return new Response(JSON.stringify({success:true,data:{id:'synthetic-store',projection:'render-v1',template_config:{},current_theme_release:null}}),{headers:{'Content-Type':'application/json'}});
 }});
 await api.storefront.getRenderStore('synthetic-store');
 await api.storefront.getStore('synthetic-store');
 await api.storefront.themePreview('synthetic-store','synthetic-test-capability');
 assert.equal(requests[0].pathname,'/v1/storefront/synthetic-store');
 assert.equal(requests[0].searchParams.get('projection'),'render-v1');
 assert.equal(requests[1].search,'');
 assert.equal(requests[2].pathname,'/v1/storefront/synthetic-store/theme-preview');
 assert.equal(requests[2].searchParams.has('projection'),false);
});
