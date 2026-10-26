import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../index';
import { provisionFirstPartyStorefrontDomain } from '../lib/first-party-storefront-domain';
import { StorefrontDomainProvisioningSchema } from '@letbuyy/shared-types';
const env = { ENVIRONMENT:'production',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.store',VERCEL_API_TOKEN:'synthetic-commerce-only',VERCEL_STOREFRONT_PROJECT_ID:'synthetic-commerce',VERCEL_TEAM_ID:'synthetic-team' } as Env;
const domain='synthetic-owned.letbuyy.store';
const store={subdomain:'synthetic-owned'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function provider(attached=false,postOutcome:'success'|'lost'|'failed'='success') {
 const calls:Array<{url:URL;method:string;body:unknown}>=[];
 const fetchImpl=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const method=init?.method||'GET';calls.push({url,method,body:init?.body?JSON.parse(String(init.body)):null});
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-commerce-only');
  assert.equal(url.searchParams.get('teamId'),'synthetic-team');
  if(method==='POST'){
   assert.deepEqual(JSON.parse(String(init?.body)),{name:domain});assert.match(url.pathname,/synthetic-commerce\/domains$/);
   if(postOutcome==='failed')return response({error:{code:'provider_fault'}},500);
   attached=true;if(postOutcome==='lost')throw new TypeError('synthetic lost write response');
   return response({name:domain,verified:true});
  }
  if(url.pathname.endsWith('/config'))return response({configuredBy:'CNAME',misconfigured:false});
  assert.equal(url.pathname,`/v9/projects/synthetic-commerce/domains/${domain}`);
  return attached?response({name:domain,verified:true}):response({error:{code:'not_found'}},404);
 }) as typeof fetch;
 return {calls,fetchImpl};
}
test('existing verified same-project host is read without another registration',async()=>{
 const p=provider(true);assert.deepEqual(await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl),{hostname:domain,status:'ready'});assert.equal(p.calls.filter(x=>x.method==='POST').length,0);
});
test('new persisted host is registered once and read back before it is ready',async()=>{
 const p=provider();const result=await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl);assert.equal(result.status,'ready');assert.ok(StorefrontDomainProvisioningSchema.safeParse(result).success);assert.equal(p.calls.filter(x=>x.method==='POST').length,1);
});
test('a committed POST with a lost acknowledgement is reconciled without duplicate writes',async()=>{
 const p=provider(false,'lost');assert.equal((await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl)).status,'ready');assert.equal(p.calls.filter(x=>x.method==='POST').length,1);
});
test('an uncommitted provider error stays pending without falsely promising a working host',async()=>{
 const p=provider(false,'failed');assert.deepEqual(await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl),{hostname:domain,status:'pending',reason:'provider_pending'});assert.equal(p.calls.filter(x=>x.method==='POST').length,1);
});
test('reserved, arbitrary and path-injected labels never reach the provider',async()=>{
 for(const subdomain of ['admin','checkout','storefront','../outside','shop.example.com','synthetic-owned/other']){
  let calls=0;const result=await provisionFirstPartyStorefrontDomain(env,{subdomain},(async()=>{calls++;throw new Error('must not fetch');}) as typeof fetch);assert.equal(result.status,'pending');assert.equal(calls,0);
 }
});
test('missing credentials remain pending; a production flag cannot enter the local lane',async()=>{
 assert.equal((await provisionFirstPartyStorefrontDomain({...env,VERCEL_API_TOKEN:undefined},store)).reason,'provider_not_configured');
 assert.equal((await provisionFirstPartyStorefrontDomain({...env,ENVIRONMENT:'test',NODE_ENV:'production',VERCEL_API_TOKEN:undefined},store)).status,'pending');
 assert.equal((await provisionFirstPartyStorefrontDomain({...env,ENVIRONMENT:'test',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',VERCEL_API_TOKEN:undefined},store)).status,'local');
});
test('provider authorization failures are sanitized and do not trigger another credential or project',async()=>{
 let calls=0;const result=await provisionFirstPartyStorefrontDomain(env,store,(async()=>{calls++;return response({error:{code:'forbidden',message:'synthetic private provider detail'}},403);}) as typeof fetch);assert.equal(calls,1);assert.equal(result.reason,'provider_unavailable');assert.doesNotMatch(JSON.stringify(result),/private|synthetic-commerce-only/);
});
test('a hung request aborts within the shared finite deadline',async(t)=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});let signal:AbortSignal|undefined;
 const result=provisionFirstPartyStorefrontDomain(env,store,((_input:RequestInfo|URL,init?:RequestInit)=>{signal=init?.signal||undefined;return new Promise<Response>(()=>{});}) as typeof fetch);
 t.mock.timers.tick(6001);assert.equal((await result).reason,'provider_unavailable');assert.equal(signal?.aborted,true);
});
test('a response naming a different host never admits publication',async()=>{
 const p=provider(true);const result=await provisionFirstPartyStorefrontDomain(env,store,(async(input,init)=>{const r=await p.fetchImpl(input,init);if(String(input).includes('/v9/'))return response({name:'another.letbuyy.store',verified:true});return r;}) as typeof fetch);assert.equal(result.status,'pending');
});

test('existing published stores retain successful replay through a provider outage',async()=>{
 const {assertReadyFirstPartyStorefrontDomain}=await import('../lib/first-party-storefront-domain');
 await assertReadyFirstPartyStorefrontDomain({...env,VERCEL_API_TOKEN:undefined},{...store,published:true,status:'published'});
 await assert.rejects(()=>assertReadyFirstPartyStorefrontDomain({...env,VERCEL_API_TOKEN:undefined},{...store,published:true,status:'draft'}),{code:'STOREFRONT_DOMAIN_PENDING'});
});
