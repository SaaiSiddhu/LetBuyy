import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBoundStorefrontRequestSignature } from '@letbuyy/auth-core';
import { resolveStorefrontAccessContext, verifyStorePassword } from './storefront-access';

test('both server store-access callers use valid bound signatures and end a hung upstream request', async()=>{
  const names=['STOREFRONT_INTERNAL_PERIMETER','STOREFRONT_INTERNAL_REQUEST_SECRET','LETBUYY_API_BASE_URL','LETBUYY_API_URL','NEXT_PUBLIC_API_URL'] as const;
  const before=Object.fromEntries(names.map(n=>[n,process.env[n]]));const originalFetch=globalThis.fetch;
  try{
    process.env.STOREFRONT_INTERNAL_PERIMETER='bound-request-v1';process.env.STOREFRONT_INTERNAL_REQUEST_SECRET='synthetic-server-caller-key-01234567890123456789';
    process.env.LETBUYY_API_BASE_URL='https://api.example.test';process.env.LETBUYY_API_URL='https://api.example.test';process.env.NEXT_PUBLIC_API_URL='https://api.example.test';
    let calls=0;
    globalThis.fetch=async(input,init)=>{
      calls++;assert.ok(init?.signal,'server callers must also bound their request');
      const checked=await verifyBoundStorefrontRequestSignature({secret:process.env.STOREFRONT_INTERNAL_REQUEST_SECRET,method:init.method||'GET',url:String(input),body:new TextEncoder().encode(String(init.body||'')),headers:new Headers(init.headers)});
      assert.equal(checked.status,'accepted');
      return await new Promise<Response>((_resolve,reject)=>{const guard=setTimeout(()=>reject(new Error('Missing request deadline')),14000);init.signal!.addEventListener('abort',()=>{clearTimeout(guard);reject(init.signal?.reason);},{once:true});});
    };
    const start=Date.now();const results=await Promise.allSettled([resolveStorefrontAccessContext('shop.example.test'),verifyStorePassword({siteId:'11111111-1111-4111-8111-111111111111',host:'shop.example.test',password:'synthetic-not-a-real-password',ip:'192.0.2.10'})]);
    assert.equal(calls,2);for(const result of results){assert.equal(result.status,'rejected');if(result.status==='rejected')assert.equal(result.reason.name,'TimeoutError');}assert.ok(Date.now()-start<13000);
  }finally{globalThis.fetch=originalFetch;for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
});
