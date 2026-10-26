import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBoundStorefrontRequestSignature } from '@letbuyy/auth-core';
import { storefrontInternalHeaders } from './storefront-internal-headers';
const names = ['STOREFRONT_INTERNAL_PERIMETER', 'STOREFRONT_INTERNAL_REQUEST_SECRET', 'INTERNAL_API_SECRET'] as const;

test('Commerce signs both callers with only its dedicated key and refuses broken explicit configuration', async () => {
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.STOREFRONT_INTERNAL_PERIMETER = 'bound-request-v1';
    process.env.STOREFRONT_INTERNAL_REQUEST_SECRET = 'synthetic-commerce-dedicated-key-0123456789';
    process.env.INTERNAL_API_SECRET = 'synthetic-shared-key-that-must-not-be-sent';
    for (const [method, path, body] of [['GET', '/resolve?host=syn.example.invalid', ''], ['POST', '/verify', '{"password":"synthetic"}']] as const) {
      const url = 'https://api.letbuyy.test/v1/internal/store-access' + path;
      const headers = new Headers(await storefrontInternalHeaders(method, url, body));
      assert.equal(headers.has('x-internal-api-secret'), false);
      assert.equal((await verifyBoundStorefrontRequestSignature({ secret: process.env.STOREFRONT_INTERNAL_REQUEST_SECRET, method, url, body: new TextEncoder().encode(body), headers })).status, 'accepted');
      assert.notEqual((await verifyBoundStorefrontRequestSignature({ secret: process.env.INTERNAL_API_SECRET, method, url, body: new TextEncoder().encode(body), headers })).status, 'accepted');
    }
    delete process.env.STOREFRONT_INTERNAL_REQUEST_SECRET;
    await assert.rejects(storefrontInternalHeaders('GET', 'https://api.letbuyy.test/v1/internal/store-access/resolve'));
    process.env.STOREFRONT_INTERNAL_PERIMETER = 'unknown-policy';
    await assert.rejects(storefrontInternalHeaders('GET', 'https://api.letbuyy.test/v1/internal/store-access/resolve'));
  } finally { for (const name of names) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; } }
});


test('real Commerce proxy accepts a legitimate store-access response after the former three-second deadline', async () => {
  const envNames = ['STOREFRONT_INTERNAL_PERIMETER','STOREFRONT_INTERNAL_REQUEST_SECRET','LETBUYY_API_BASE_URL','LETBUYY_API_URL','NEXT_PUBLIC_API_URL','NEXT_PUBLIC_STORE_ROOT_DOMAIN','NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES'] as const;
  const before = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  try {
    process.env.STOREFRONT_INTERNAL_PERIMETER='bound-request-v1';
    process.env.STOREFRONT_INTERNAL_REQUEST_SECRET='synthetic-slow-commerce-key-01234567890123456789';
    process.env.LETBUYY_API_BASE_URL='https://api.example.test'; process.env.LETBUYY_API_URL='https://api.example.test'; process.env.NEXT_PUBLIC_API_URL='https://api.example.test';
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN='example.test'; delete process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES;
    let calls=0;
    globalThis.fetch = async (input, init) => {
      calls++; assert.match(String(input), /\/v1\/internal\/store-access\/resolve\?host=shop.example.test$/);
      assert.equal(new Headers(init?.headers).get('X-LetBuyy-Internal-Caller'),'commerce-storefront');
      return await new Promise<Response>((resolve,reject)=> {
        const timer=setTimeout(()=>resolve(Response.json({data:{site_id:'11111111-1111-4111-8111-111111111111',subdomain:'shop',custom_domain:null,custom_domain_status:'none',access_mode:'public',published:true,status:'published'}})),3200);
        init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(init.signal?.reason);},{once:true});
      });
    };
    const {NextRequest}=await import('next/server'); const {proxy}=await import('../proxy');
    const response=await proxy(new NextRequest('https://shop.example.test/',{headers:{host:'shop.example.test'}}));
    assert.equal(response.status,200,'a valid slower response must reach the store rather than the unavailable holding page');
    assert.equal(response.headers.get('x-middleware-rewrite'),'https://shop.example.test/store/shop'); assert.equal(calls,1);
  } finally { globalThis.fetch=originalFetch;for(const name of envNames){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];} }
});


test('real Commerce proxy still fails closed when its finite store-access deadline expires', async () => {
  const envNames = ['STOREFRONT_INTERNAL_PERIMETER','STOREFRONT_INTERNAL_REQUEST_SECRET','LETBUYY_API_BASE_URL','LETBUYY_API_URL','NEXT_PUBLIC_API_URL','NEXT_PUBLIC_STORE_ROOT_DOMAIN'] as const;
  const before=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));const originalFetch=globalThis.fetch;
  try {
    process.env.STOREFRONT_INTERNAL_PERIMETER='bound-request-v1';process.env.STOREFRONT_INTERNAL_REQUEST_SECRET='synthetic-hung-commerce-key-01234567890123456789';
    process.env.LETBUYY_API_BASE_URL='https://api.example.test';process.env.LETBUYY_API_URL='https://api.example.test';process.env.NEXT_PUBLIC_API_URL='https://api.example.test';process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN='example.test';
    globalThis.fetch=async(_input,init)=>await new Promise<Response>((_resolve,reject)=>{
      assert.ok(init?.signal,'every store-access request must have a finite signal');
      const guard=setTimeout(()=>reject(new Error('Missing request deadline')),14000);
      init.signal.addEventListener('abort',()=>{clearTimeout(guard);reject(init.signal?.reason);},{once:true});
    });
    const {NextRequest}=await import('next/server');const {proxy}=await import('../proxy');const started=Date.now();
    const response=await proxy(new NextRequest('https://shop.example.test/',{headers:{host:'shop.example.test'}}));
    assert.equal(response.status,503,'an unresolved access gate must never admit the storefront');
    assert.match(response.headers.get('x-middleware-rewrite')||'',/\/preview\/coming-soon/);assert.ok(Date.now()-started<13000,'the request must terminate within its finite budget');
  } finally {globalThis.fetch=originalFetch;for(const name of envNames){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
});
