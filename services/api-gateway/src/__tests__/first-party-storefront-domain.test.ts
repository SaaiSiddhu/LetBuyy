import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import type { Env } from '../index';
import { provisionFirstPartyStorefrontDomain } from '../lib/first-party-storefront-domain';
import { StorefrontDomainProvisioningSchema } from '@letbuyy/shared-types';
const root = readFileSync(new URL('../../wrangler.toml',import.meta.url),'utf8').split('[env.production.vars]')[1].match(/^NEXT_PUBLIC_STORE_ROOT_DOMAIN = "([^"]+)"/m)![1];
const env = { ENVIRONMENT:'production',NEXT_PUBLIC_STORE_ROOT_DOMAIN:root,VERCEL_API_TOKEN:'synthetic-commerce-only',VERCEL_STOREFRONT_PROJECT_ID:'synthetic-commerce',VERCEL_TEAM_ID:'synthetic-team' } as Env;
const domain='synthetic-owned.'+root;
const store={subdomain:'synthetic-owned'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function provider(overrides: Record<string, unknown> = {}, config: Record<string, unknown> = {configuredBy:'CNAME',misconfigured:false}) {
 const calls:Array<{url:URL;method:string}>=[];
 const fetchImpl=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const method=init?.method||'GET';calls.push({url,method});
  assert.equal(method,'GET','first-party provisioning must never register per-store domains');
  assert.equal(init?.redirect,'manual','provider credentials must not follow redirects');
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-commerce-only');
  assert.equal(url.searchParams.get('teamId'),'synthetic-team');
  if(url.pathname.endsWith('/config')) {
   assert.ok(url.pathname.includes(domain));
   return response(config);
  }
  assert.equal(decodeURIComponent(url.pathname),`/v9/projects/synthetic-commerce/domains/*.${root}`);
  return response({name:'*.'+root,verified:true,projectId:'synthetic-commerce',gitBranch:null,customEnvironmentId:null,redirect:null,...overrides});
 }) as typeof fetch;
 return {calls,fetchImpl};
}
test('a new persisted store uses the verified same-project production wildcard with zero domain writes',async()=>{
 const p=provider();const result=await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl);
 assert.deepEqual(result,{hostname:domain,status:'ready'});assert.ok(StorefrontDomainProvisioningSchema.safeParse(result).success);
 assert.equal(p.calls.length,2);assert.ok(p.calls.every(call=>call.method==='GET'));
});
test('missing ownership, wrong project, wrong wildcard, preview target and redirects never admit a store',async()=>{
 for(const invalid of [{verified:false},{projectId:'different-project'},{name:'*.different.invalid'},{gitBranch:'develop'},{customEnvironmentId:'other-environment'},{redirect:'https://elsewhere.invalid'}]) {
  const p=provider(invalid);assert.equal((await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl)).status,'pending');
  assert.ok(p.calls.every(call=>call.method==='GET'));
 }
});
test('unavailable or incorrect wildcard DNS never falsely promises a ready host',async()=>{
 for(const config of [{configuredBy:null,misconfigured:false},{configuredBy:'CNAME',misconfigured:true}]) {
  const p=provider({},config);assert.equal((await provisionFirstPartyStorefrontDomain(env,store,p.fetchImpl)).status,'pending');
 }
 const p=provider();const absent=(async(input:RequestInfo|URL,init?:RequestInit)=>String(input).includes('/v9/')?response({error:{code:'not_found'}},404):p.fetchImpl(input,init)) as typeof fetch;
 assert.equal((await provisionFirstPartyStorefrontDomain(env,store,absent)).status,'pending');
});
test('staging cannot claim readiness from a production wildcard',async()=>{
 const p=provider();assert.equal((await provisionFirstPartyStorefrontDomain({...env,ENVIRONMENT:'staging',NODE_ENV:'production'},store,p.fetchImpl)).status,'pending');
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
 let calls=0;const result=await provisionFirstPartyStorefrontDomain(env,store,(async()=>{calls++;return response({error:{code:'forbidden',message:'synthetic private provider detail'}},403);}) as typeof fetch);assert.equal(calls,2);assert.equal(result.reason,'provider_unavailable');assert.doesNotMatch(JSON.stringify(result),/private|synthetic-commerce-only/);
});
test('a hung request aborts within the shared finite deadline',async(t)=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});let signal:AbortSignal|undefined;
 const result=provisionFirstPartyStorefrontDomain(env,store,((_input:RequestInfo|URL,init?:RequestInit)=>{signal=init?.signal||undefined;return new Promise<Response>(()=>{});}) as typeof fetch);
 t.mock.timers.tick(6001);assert.equal((await result).reason,'provider_unavailable');assert.equal(signal?.aborted,true);
});
test('a response naming a different host never admits publication',async()=>{
 const p=provider();const result=await provisionFirstPartyStorefrontDomain(env,store,(async(input,init)=>{const r=await p.fetchImpl(input,init);if(String(input).includes('/v9/'))return response({name:'another.'+root,verified:true});return r;}) as typeof fetch);assert.equal(result.status,'pending');
});

test('existing published stores retain successful replay through a provider outage',async()=>{
 const {assertReadyFirstPartyStorefrontDomain}=await import('../lib/first-party-storefront-domain');
 await assertReadyFirstPartyStorefrontDomain({...env,VERCEL_API_TOKEN:undefined},{...store,published:true,status:'published'});
 await assert.rejects(()=>assertReadyFirstPartyStorefrontDomain({...env,VERCEL_API_TOKEN:undefined},{...store,published:true,status:'draft'}),{code:'STOREFRONT_DOMAIN_PENDING'});
});
