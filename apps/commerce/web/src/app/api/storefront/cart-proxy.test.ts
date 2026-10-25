import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { BUYER_TOKEN, SITE_ID, buyerCookieHeader, installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as route from './[subdomain]/cart/[cartToken]/route';
import config from '../../../../next.config';

const origin='http://snaz.localhost:9000',token='ct_1234567890abcdef';
const context=(subdomain='snaz')=>({params:Promise.resolve({subdomain,cartToken:token})});
function request(options:{cookie?:string|null;origin?:string;body?:string;contentType?:string;method?:string;forged?:boolean}={}){
 const method=options.method??'PATCH',headers=new Headers({host:new URL(origin).host,origin:options.origin??origin,'content-type':options.contentType??'application/json'});
 if(options.cookie!==null)headers.set('cookie',options.cookie??buyerCookieHeader());
 if(options.forged){headers.set('x-letbuyy-storefront-session','forged.token.value');headers.set('authorization','Bearer forged');}
 return new NextRequest(origin+'/api/storefront/snaz/cart/'+token,{method,headers,...(method==='GET'?{}:{body:options.body??'{"lines":[]}'})});
}
async function gateway(run:(calls:RecordedGatewayRequest[])=>Promise<void>,options:{throwResolve?:boolean;status?:number;payload?:unknown}={}){
 const previous=process.env.INTERNAL_API_SECRET;process.env.INTERNAL_API_SECRET='synthetic-cart-proxy-only';
 const calls:RecordedGatewayRequest[]=[];const fake=installGatewayFake(r=>{
  if(r.url.pathname.endsWith('/internal/store-access/resolve')){if(options.throwResolve)throw Error('private DB internals');assert.equal(r.url.searchParams.get('host'),new URL(origin).host);return jsonResponse({data:{site_id:SITE_ID,subdomain:'snaz'}});}
  calls.push(r);return jsonResponse(options.payload??{success:true,data:{lines:[],updated_at:'2026-10-25T00:00:00Z'}},{status:options.status??200,headers:{'set-cookie':'must-not-relay=1','x-internal-debug':'private'}});
 });try{await run(calls);}finally{fake.restore();if(previous===undefined)delete process.env.INTERNAL_API_SECRET;else process.env.INTERNAL_API_SECRET=previous;}
}

test('signed-in cart PATCH forwards only the host-bound buyer session and retains acknowledged response',async()=>{
 await gateway(async calls=>{const r=await route.PATCH(request({forged:true}),context());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('x-internal-debug'),null);assert.deepEqual(await r.json(),{success:true,data:{lines:[],updated_at:'2026-10-25T00:00:00Z'}});assert.equal(calls.length,1);assert.equal(calls[0].url.pathname,'/v1/storefront/snaz/cart/'+token);assert.equal(calls[0].method,'PATCH');assert.equal(calls[0].headers.get('x-letbuyy-storefront-session'),BUYER_TOKEN);assert.equal(calls[0].headers.has('cookie'),false);assert.equal(calls[0].headers.has('authorization'),false);assert.equal(calls[0].body,'{"lines":[]}');});
});
test('guest cart writes keep capability flow without caller-supplied identity',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request({cookie:null,forged:true}),context())).status,200);assert.equal(calls.length,1);assert.equal(calls[0].headers.has('x-letbuyy-storefront-session'),false);});
});
test('cart GET remains available and never forwards identity or response cookies',async()=>{
 await gateway(async calls=>{const r=await route.GET(request({method:'GET',forged:true}),context());assert.equal(r.status,200);assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers.has('x-letbuyy-storefront-session'),false);assert.equal(r.headers.get('set-cookie'),null);});
});
test('cross-site mutation is refused before any upstream write',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request({origin:'https://attacker.test'}),context())).status,403);assert.equal(calls.length,0);});
});
test('malformed buyer cookie fails closed instead of downgrading to guest',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request({cookie:'__Host-lb_store_buyer=malformed'}),context())).status,401);assert.equal(calls.length,0);});
});
test('foreign cookie site cannot be forwarded to the current store',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request({cookie:buyerCookieHeader(BUYER_TOKEN,'11111111-1111-4111-8111-111111111111')}),context())).status,403);assert.equal(calls.length,0);});
});
test('a valid cookie cannot target another storefront path',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request(),context('other-store'))).status,403);assert.equal(calls.length,0);});
});
test('failed host resolution returns sanitized unavailable without a write',async()=>{
 await gateway(async calls=>{const r=await route.PATCH(request(),context());assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await r.json()),/DB internals/);assert.equal(calls.length,0);},{throwResolve:true});
});
test('invalid route, body and content type never reach cart authority',async()=>{
 await gateway(async calls=>{assert.equal((await route.PATCH(request(),context('../other'))).status,400);assert.equal((await route.PATCH(request({body:'[]'}),context())).status,400);assert.equal((await route.PATCH(request({body:'{'}),context())).status,400);assert.equal((await route.PATCH(request({contentType:'text/plain'}),context())).status,415);assert.equal((await route.PATCH(request({body:'x'.repeat(1024*1024+1)}),context())).status,413);assert.equal(calls.length,0);});
});
test('canonical stale and checkout-lock refusals pass through without retry',async()=>{
 for(const code of ['CART_REVISION_CONFLICT','CART_ALREADY_CHECKING_OUT','CART_OWNER_CONFLICT'])await gateway(async calls=>{const r=await route.PATCH(request(),context());assert.equal(r.status,409);assert.deepEqual(await r.json(),{success:false,error:{code}});assert.equal(calls.length,1);},{status:409,payload:{success:false,error:{code}}});
});
test('upstream internal failures are sanitized without diagnostic leakage',async()=>{
 await gateway(async()=>{const r=await route.PATCH(request(),context());assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await r.json()),/private SQL/);},{status:500,payload:{error:'private SQL'}});
});
test('public rewrite is fallback so the dynamic cart handler executes first',async()=>{
 const rewrites=await config.rewrites!();assert(!Array.isArray(rewrites));assert.equal(rewrites.fallback?.length,1);assert.equal(rewrites.fallback?.[0].source,'/api/storefront/:subdomain/:path*');
});
