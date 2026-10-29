// Real owned PostgreSQL/PostgREST + production Gateway. Provider responses are
// explicit synthetic fixtures; this is not a hosted DNS/TLS acceptance claim.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Context } from 'hono';
import type { Env } from '../../index';
import { canonicalCheckoutDomainProbePayload, LETBUYY_CHECKOUT_ORIGIN_HEADER, LETBUYY_CHECKOUT_ORIGIN_VERSION_HEADER } from '@letbuyy/checkout-core';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { hmacSha256Hex } from '../../lib/crypto';
import { getSupabaseAdminFromEnv } from '../../lib/supabase';
import { prepareStoreCheckoutDomain, resolveCheckoutDomainSite, checkoutOriginBelongsToSite } from '../../lib/store-checkout-domain';
import { resolveStorefrontSiteByHost } from '../../middleware/store-context';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned=requireOwnedDatabase(),a=newSyntheticTenant('branded-a'),b=newSyntheticTenant('branded-b');
const actor=crypto.randomUUID(),email=`syn-branded-${actor}@example.invalid`,secret='synthetic-checkout-domain-readiness-secret';
const root='shops.example.invalid',project='synthetic-commerce-project',host=`checkout.${a.subdomain}.${root}`;
let env:Env,gateway:Gateway,originalFetch:typeof fetch;
let wrongApplication=false,redirectApplication=false,providerUnavailable=false;
let foreignDomain:string|null=null,lostDeleteAcknowledgement=false;
const dns = new Map<string, string[]>();
let providerNeedsOwnership = false;
const domains=new Set<string>(),providerCalls:Array<{url:string;method:string}>=[];
const c=()=>({env,executionCtx:{waitUntil:()=>undefined}} as unknown as Context<{Bindings:Env}>);
const sqlQuote=(value:string)=>"'"+value.replaceAll("'","''")+"'";

before(async()=>{
  seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true);UPDATE sites SET custom_user_id='${actor}' WHERE id='${a.siteId}';`);
  const keys=await newIdentityKeys();
  env=gatewayEnv(owned,keys,{ENVIRONMENT:'production',APP_ENV:'production',NODE_ENV:'production',DEPLOYMENT_ENV:'production',NEXT_PUBLIC_STORE_ROOT_DOMAIN:root,
    CHECKOUT_ORIGIN:'https://checkout.letbuyy.com',CHECKOUT_SIGNING_SECRET:'synthetic-checkout-only-signing-key',STORE_ACCESS_SIGNING_KEY:secret,
    VERCEL_API_TOKEN:'synthetic-provider-only-token',VERCEL_STOREFRONT_PROJECT_ID:project,CUSTOM_DOMAIN_CNAME_TARGET:'synthetic-cname.vercel-dns.test'});
  gateway=new Gateway({...env,ENVIRONMENT:'test',APP_ENV:undefined,NODE_ENV:undefined,DEPLOYMENT_ENV:undefined});
  originalFetch=globalThis.fetch;
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(input instanceof Request?input.url:String(input)),method=init?.method||(input instanceof Request?input.method:'GET');
    if(['cloudflare-dns.com','dns.google'].includes(url.hostname)){
      const name=url.searchParams.get('name')!,type=url.searchParams.get('type')!;
      const values=type==='NS'?['synthetic.ns.cloudflare.com']:dns.get(type+':'+name)||[];
      return Response.json({Status:0,Answer:values.map(data=>({data}))});
    }
    if(url.hostname==='api.vercel.com'){
      providerCalls.push({url:url.toString(),method});assert.equal(init?.redirect,'manual');
      if(providerUnavailable)return Response.json({error:{code:'unavailable',message:'Synthetic provider outage'}},{status:503});
      if(url.pathname.endsWith('/verify'))return providerNeedsOwnership?Response.json({error:{code:'verification_failed'}},{status:400}):Response.json({verified:true});
      if(method==='POST'){const body=JSON.parse(String(init?.body));domains.add(body.name);return Response.json({name:body.name,projectId:project,verified:true});}
      if(url.pathname.endsWith('/config'))return Response.json({configuredBy:'CNAME',misconfigured:false});
      const name=decodeURIComponent(url.pathname.split('/').at(-1)!);
      if(method==='DELETE'){domains.delete(name);return lostDeleteAcknowledgement?Response.json({error:{code:'synthetic_lost_delete_ack'}},{status:503}):Response.json({});}
      return domains.has(name)?Response.json({name,projectId:name===foreignDomain?'synthetic-foreign-project':project,verified:!providerNeedsOwnership,verification:providerNeedsOwnership?[{type:'TXT',domain:'_vercel.example.invalid',value:'synthetic-exact-provider-claim'}]:[]}):Response.json({error:{code:'not_found'}},{status:404});
    }
    if(url.hostname.startsWith('checkout.')&&url.pathname==='/.well-known/letbuyy-checkout-domain'){
      providerCalls.push({url:url.toString(),method});assert.equal(init?.redirect,'manual');
      if(redirectApplication)return new Response(null,{status:302,headers:{Location:'https://do-not-follow.example.invalid/'}});
      const {signature,...proof}=JSON.parse(new Headers(init?.headers).get('X-LetBuyy-Checkout-Probe')!);
      assert.equal(proof.hostname,url.hostname);assert.equal(signature,await hmacSha256Hex(secret,canonicalCheckoutDomainProbePayload('request',proof)));
      return Response.json({...proof,signature:await hmacSha256Hex(wrongApplication?'synthetic-wrong-app-key':secret,canonicalCheckoutDomainProbePayload('response',proof))});
    }
    assert.equal(url.origin,new URL(owned.restUrl).origin,'only owned REST and explicit synthetic provider/application fixtures are allowed');
    return originalFetch(input,init);
  }) as typeof fetch;
});
after(async()=>{await gateway?.settle();globalThis.fetch=originalFetch;});

test('exact provider plus application proof activates one checkout host without publishing/changing the store',async()=>{
  const before=owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id='${a.siteId}';`);
  wrongApplication=true;const pending=await prepareStoreCheckoutDomain(c(),a.siteId,{force:true});assert.equal(pending.status,'verifying');assert.equal(pending.checkout_origin,'https://checkout.letbuyy.com');
  wrongApplication=false;redirectApplication=true;assert.equal((await prepareStoreCheckoutDomain(c(),a.siteId,{force:true})).status,'verifying');redirectApplication=false;
  const setup=await prepareStoreCheckoutDomain(c(),a.siteId,{force:true});assert.equal(setup.status,'active');assert.equal(setup.checkout_origin,'https://'+host);assert.equal(setup.hostname,host);
  assert.equal(owned.psql(`SELECT count(*) FROM site_domains WHERE site_id='${a.siteId}' AND purpose='checkout' AND checkout_retired_at IS NULL AND deleted_at IS NULL;`),'1');
  assert.equal(owned.psql(`SELECT to_jsonb(s)::text FROM sites s WHERE id='${a.siteId}';`),before);
  assert.ok(await checkoutOriginBelongsToSite(getSupabaseAdminFromEnv(env),env,a.siteId,'https://'+host));
  assert.equal(await checkoutOriginBelongsToSite(getSupabaseAdminFromEnv(env),env,b.siteId,'https://'+host),false);
  assert.equal(await resolveStorefrontSiteByHost(createSupabaseServiceClient(env),host,root),null,'checkout hosts cannot become storefront/OAuth callback hosts');
  const reads=providerCalls.length;await prepareStoreCheckoutDomain(c(),a.siteId);assert.equal(providerCalls.length,reads,'fresh readiness is not polled on every buyer request');
});

test('Merchant setup reads and mutations require the owned site and bounded idempotent input',async()=>{
  const headers=await signedIdentityHeaders(actor,email,a.siteId);
  assert.equal((await gateway.request(`/v1/custom/checkout-domain?site_id=${a.siteId}`,{headers})).status,200);
  assert.equal((await gateway.request(`/v1/custom/checkout-domain?site_id=${b.siteId}`,{headers:await signedIdentityHeaders(actor,email,b.siteId)})).status,404);
  assert.equal((await gateway.request('/v1/custom/checkout-domain',{method:'POST',headers:await signedIdentityHeaders(actor,email,a.siteId),body:JSON.stringify({site_id:a.siteId})})).status,400);
  assert.equal((await gateway.request('/v1/custom/checkout-domain',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,b.siteId),'Idempotency-Key':'synthetic-denied-domain'},body:JSON.stringify({site_id:b.siteId})})).status,404);
  const accepted=await gateway.request('/v1/custom/checkout-domain',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,a.siteId),'X-Idempotency-Key':'synthetic-sdk-domain-key'},body:JSON.stringify({site_id:a.siteId})});
  assert.ok([200,202].includes(accepted.status),accepted.text);
});

test('tenant SQL can read its exact domain but cannot forge readiness, retirement or remove the hostname reservation',()=>{
  const scope=`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${a.siteId}',true);`;
  assert.match(owned.psql(`${scope}SELECT 'owned-domain-count='||count(*) FROM site_domains WHERE site_id='${a.siteId}' AND purpose='checkout';ROLLBACK;`),/owned-domain-count=1/,'positive control: the tenant can see its own real domain');
  for(const change of [
    "UPDATE site_domains SET status='active',ssl_status='active'",
    "UPDATE site_domains SET checkout_retired_at=now(),metadata=metadata||'{\"checkout_retire_reason\":\"address_changed\"}'::jsonb",
    'DELETE FROM site_domains',
  ])assert.match(owned.psqlExpectError(`${scope}${change} WHERE site_id='${a.siteId}' AND purpose='checkout';COMMIT;`),/server managed|server lifecycle/);
  assert.equal(owned.psql(`SELECT count(*) FROM site_domains WHERE site_id='${a.siteId}' AND purpose='checkout' AND deleted_at IS NULL AND checkout_retired_at IS NULL;`),'1');
});

test('real cart mint/verification binds origin and refuses host, site and downgrade substitutions',async()=>{
  const id=crypto.randomUUID(),product=crypto.randomUUID(),token='ct_'+crypto.randomUUID().replaceAll('-','');
  const items=JSON.stringify([{id:product,product_id:product,variant_id:null,title:'Synthetic branded product',quantity:1,unit_price:1,currency:'INR',properties:{},line_total:1}]);
  owned.psql(`INSERT INTO products(id,store_id,name,price,sku,is_active,stock) VALUES('${product}','${a.siteId}','Synthetic branded product',1,'SYN-${product}',true,25);INSERT INTO carts(id,store_id,session_id,items,status,channel,expires_at) VALUES('${id}','${a.siteId}','${token}',${sqlQuote(items)}::jsonb,'active','web',now()+interval '1 day');`);
  const minted=await gateway.request(`/v1/storefront/${a.subdomain}/cart/${token}/checkout-url`,{method:'POST',headers:{[LETBUYY_CHECKOUT_ORIGIN_VERSION_HEADER]:'2'}});
  assert.equal(minted.status,200,minted.text);const link=new URL(minted.json!.data.checkout_url);assert.equal(link.origin,'https://'+host);assert.equal(link.searchParams.get('checkout_origin'),link.origin);
  const verify=(query=link.searchParams,origin=link.origin)=>gateway.request(`/v1/checkout/${id}/verify-handoff?${query}`,{headers:{[LETBUYY_CHECKOUT_ORIGIN_HEADER]:origin}});
  assert.equal((await verify()).status,200);
  assert.equal((await verify(link.searchParams,'https://checkout.other.shops.example.invalid')).status,401);
  for(const [key,value] of [['checkout_origin','https://checkout.other.shops.example.invalid'],['site_id',b.siteId],['checkout_origin',null]] as const){const query=new URLSearchParams(link.searchParams);if(value===null)query.delete(key);else query.set(key,value);assert.equal((await verify(query)).status,401);}
  const legacy=await gateway.request(`/v1/storefront/${a.subdomain}/cart/${token}/checkout-url`,{method:'POST'});assert.equal(legacy.status,200,legacy.text);const old=new URL(legacy.json!.data.checkout_url);assert.equal(old.origin,'https://checkout.letbuyy.com');assert.equal(old.searchParams.has('checkout_origin'),false);
  assert.equal((await gateway.request(`/v1/checkout/${id}/verify-handoff?${old.searchParams}`)).status,200,'previous central adapters remain compatible during the rolling deployment');
});

test('new custom derivation conserves old verified capabilities through a finite drain and forbids new old-style rows',async()=>{
  const tenant=newSyntheticTenant('legacy-drain');seedSyntheticTenant(owned.psql,tenant);
  const parent=crypto.randomUUID(),custom='store.'+tenant.subdomain+'.example.invalid',oldHost=`checkout.${tenant.subdomain}.${custom}`;
  const down=readFileSync(new URL('../../../../../database/supabase/rollback/410_checkout_custom_host_derivation.rollback.sql',import.meta.url),'utf8');
  const up=readFileSync(new URL('../../../../../database/supabase/migrations/410_checkout_custom_host_derivation.sql',import.meta.url),'utf8');
  owned.script(down);
  owned.psql(`INSERT INTO site_domains(id,site_id,domain,purpose,role,status,ssl_status) VALUES('${parent}','${tenant.siteId}','${custom}','storefront','primary','active','active');UPDATE sites SET custom_domain='${custom}',custom_domain_status='active' WHERE id='${tenant.siteId}';INSERT INTO site_domains(site_id,domain,purpose,role,status,ssl_status,checkout_parent_domain_id,last_checked_at,metadata) VALUES('${tenant.siteId}','${oldHost}','checkout','redirect','active','active','${parent}',now(),jsonb_build_object('managed_by','letbuyy-checkout-v1','checkout_store_handle','${tenant.subdomain}','checkout_base_host','${custom}'));`);
  domains.add(oldHost);
  const before=owned.psql(`SELECT to_jsonb(d)::text FROM site_domains d WHERE site_id='${tenant.siteId}' AND purpose='checkout';`);
  owned.script(up);
  assert.equal(owned.psql(`SELECT to_jsonb(d)::text FROM site_domains d WHERE site_id='${tenant.siteId}' AND purpose='checkout';`),before,'UP does not rewrite domains or their history');
  const db=getSupabaseAdminFromEnv(env);
  assert.ok(await resolveCheckoutDomainSite(db,oldHost,root,tenant.siteId),'a previously issued, still-leased capability can finish');
  const next=await prepareStoreCheckoutDomain(c(),tenant.siteId,{force:true});assert.equal(next.hostname,`checkout.${custom}`);assert.equal(next.status,'active');
  assert.ok(await resolveCheckoutDomainSite(db,oldHost,root,tenant.siteId));
  assert.match(owned.psqlExpectError(down),/history must be retained/,'DOWN refuses to erase new custom checkout history');
  assert.match(owned.psqlExpectError(`INSERT INTO site_domains(site_id,domain,purpose,role,status,ssl_status,checkout_parent_domain_id) VALUES('${tenant.siteId}','checkout.${tenant.subdomain}.other.example.invalid','checkout','redirect','pending','pending','${parent}');`),/does not match/);
  owned.psql(`UPDATE site_domains SET metadata=metadata||jsonb_build_object('checkout_retire_after',now()-interval '1 second') WHERE site_id='${tenant.siteId}' AND domain='${oldHost}';`);
  assert.equal(await resolveCheckoutDomainSite(db,oldHost,root,tenant.siteId),null,'expired drain never becomes another checkout origin');
});

test('owned custom-domain setup returns both records before any provider claim and starts checkout only after the parent is verified',async()=>{
  const custom='shop.'+b.subdomain+'.example.invalid';
  owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${b.siteId}';`);
  const body=JSON.stringify({site_id:b.siteId,domain:custom});
  // Drive the real route with a new signed owner context on each request.
  const connect=await gateway.request('/v1/custom/domains',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,b.siteId),'X-Idempotency-Key':crypto.randomUUID()},body});
  assert.equal(connect.status,201,connect.text);
  assert.equal(connect.json!.data.checkout.hostname,`checkout.${custom}`);
  assert.equal(connect.json!.data.checkout.reason,'PARENT_NOT_VERIFIED');
  assert.equal(connect.json!.data.checkout.dns_records[0].value,env.CUSTOM_DOMAIN_CNAME_TARGET);
  assert.equal(domains.has(custom),false);assert.equal(domains.has(`checkout.${custom}`),false);
  const token=connect.json!.data.records.txt.value;
  dns.set('TXT:_letbuyy-challenge.'+custom,[token]);dns.set('CNAME:'+custom,[String(env.CUSTOM_DOMAIN_CNAME_TARGET)]);
  const verified=await gateway.request('/v1/custom/domains/verify',{method:'POST',headers:{...await signedIdentityHeaders(actor,email,b.siteId),'X-Idempotency-Key':crypto.randomUUID()},body});
  assert.equal(verified.status,200,verified.text);assert.equal(verified.json!.data.status,'active');
  // Provider side effects finish asynchronously; the durable row exists now.
  await gateway.settle();
  assert.equal(owned.psql(`SELECT domain FROM site_domains WHERE site_id='${b.siteId}' AND purpose='checkout' AND checkout_retired_at IS NULL AND deleted_at IS NULL;`),`checkout.${custom}`);
  assert.equal(owned.psql(`SELECT published::text FROM sites WHERE id='${b.siteId}';`),'false','certificate setup does not publish a private store');
  providerNeedsOwnership=true;
  const pending=await prepareStoreCheckoutDomain(c(),b.siteId,{force:true});
  assert.equal(pending.status,'verifying');assert.equal(pending.reason,'PROVIDER_OWNERSHIP_PENDING');
  assert.ok(pending.dns_records.some(record=>record.type==='TXT'&&record.value==='synthetic-exact-provider-claim'));
  assert.equal(pending.checkout_origin,'https://checkout.letbuyy.com');
  providerNeedsOwnership=false;
  assert.equal((await prepareStoreCheckoutDomain(c(),b.siteId,{force:true})).status,'active');
});

test('domain change reserves the old address through its finite drain and never trusts a historical reassignment',async()=>{
  const parent=crypto.randomUUID(),custom=`syn-${crypto.randomUUID().slice(0,8)}.example.invalid`;
  owned.psql(`INSERT INTO site_domains(id,site_id,domain,purpose,role,status,ssl_status) VALUES('${parent}','${a.siteId}','${custom}','storefront','primary','active','active');UPDATE sites SET custom_domain='${custom}',custom_domain_status='active' WHERE id='${a.siteId}';`);
  const setup=await prepareStoreCheckoutDomain(c(),a.siteId,{force:true});assert.equal(setup.status,'active');assert.equal(setup.hostname,`checkout.${custom}`);
  const db=getSupabaseAdminFromEnv(env);assert.ok(await resolveCheckoutDomainSite(db,host,root,a.siteId));
  assert.match(owned.psqlExpectError(`INSERT INTO site_domains(site_id,domain,purpose,role,status,ssl_status) VALUES('${b.siteId}','${host}','storefront','redirect','active','active');`),/duplicate|unique/i);
  assert.match(owned.psqlExpectError(`UPDATE site_domains SET checkout_retired_at=NULL WHERE site_id='${a.siteId}' AND domain='${host}';`),/cannot be reactivated/);
  owned.psql(`UPDATE site_domains SET metadata=metadata||jsonb_build_object('checkout_retire_after',now()-interval '1 second') WHERE site_id='${a.siteId}' AND domain='${host}';`);
  assert.equal(await resolveCheckoutDomainSite(db,host,root,a.siteId),null);
  foreignDomain=host;const deletes=()=>providerCalls.filter(call=>call.method==='DELETE').length;
  const before=deletes();await assert.rejects(prepareStoreCheckoutDomain(c(),a.siteId,{force:true}));assert.equal(deletes(),before,'a foreign provider assignment is never deleted');
  foreignDomain=null;lostDeleteAcknowledgement=true;await prepareStoreCheckoutDomain(c(),a.siteId,{force:true});lostDeleteAcknowledgement=false;
  assert.equal(deletes(),before+1);assert.equal(domains.has(host),false);
  assert.equal(owned.psql(`SELECT (deleted_at IS NOT NULL)::text FROM site_domains WHERE site_id='${a.siteId}' AND domain='${host}';`),'true','uncertain provider deletion releases the reservation only after absent readback');
  owned.psql(`INSERT INTO site_domains(site_id,domain,purpose,role,status,ssl_status) VALUES('${b.siteId}','${host}','storefront','redirect','active','active');`);
  assert.equal(await resolveCheckoutDomainSite(db,host,root,a.siteId),null);
  owned.psql(`UPDATE site_domains SET status='verifying',ssl_status='pending' WHERE site_id='${a.siteId}' AND id='${parent}';`);
  assert.equal(await checkoutOriginBelongsToSite(db,env,a.siteId,setup.checkout_origin),false,'revoking the verified parent revokes child checkout immediately');
});

test('paired DOWN archives checkout fields and conserves every ordinary storefront domain through UP',()=>{
  const before=owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(d) - 'purpose' - 'checkout_parent_domain_id' - 'checkout_retired_at' ORDER BY id),'[]'::jsonb)::text FROM site_domains d WHERE purpose='storefront';");
  const checkoutCount=Number(owned.psql("SELECT count(*) FROM site_domains WHERE purpose='checkout';"));
  const down=readFileSync(new URL('../../../../../database/supabase/rollback/400_store_bound_checkout_domains.rollback.sql',import.meta.url),'utf8'),up=readFileSync(new URL('../../../../../database/supabase/migrations/400_store_bound_checkout_domains.sql',import.meta.url),'utf8');
  owned.script(down);
  assert.equal(Number(owned.psql("SELECT count(*) FROM site_domains WHERE metadata?'checkout_rollback_archive_v1' AND deleted_at IS NOT NULL AND status='error';")),checkoutCount);
  assert.equal(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY id),'[]'::jsonb)::text FROM site_domains d WHERE NOT(metadata?'checkout_rollback_archive_v1');"),before);
  owned.script(up);
  assert.equal(owned.psql("SELECT count(*) FROM site_domains WHERE purpose='checkout' AND deleted_at IS NULL;"),'0','rollback never implicitly reactivates a checkout hostname');
});
