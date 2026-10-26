// Actual mounted Gateway with real owned PostgreSQL; Vercel transport is the only synthetic provider.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();
test('owned creation/replay provisions one persisted host; publication waits for real provider acknowledgement and foreign users never reach it',async()=>{
 const a=newSyntheticTenant('domain-owner'),b=newSyntheticTenant('domain-other');seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
 const actor=randomUUID(),other=randomUUID(),email=`domain-${actor}@example.invalid`,otherEmail=`domain-${other}@example.invalid`;
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic domain owner'),('${other}','${otherEmail}',true,'Synthetic other owner');UPDATE sites SET custom_user_id='${actor}',published=false,status='draft' WHERE id='${a.siteId}';UPDATE sites SET custom_user_id='${other}' WHERE id='${b.siteId}';INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${actor}','${a.siteId}','enterprise','active');`);
 const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{NODE_ENV:'production',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'letbuyy.store',VERCEL_API_TOKEN:'synthetic-commerce-only',VERCEL_STOREFRONT_PROJECT_ID:'synthetic-commerce',VERCEL_TEAM_ID:'synthetic-team'}));
 const attached=new Set<string>(),registrations:string[]=[];let failing=true,calls=0;const original=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));if(url.hostname!=='api.vercel.com')return original(input,init);calls++;
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-commerce-only');assert.equal(url.searchParams.get('teamId'),'synthetic-team');
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  if(failing)return reply({error:{code:'synthetic_unavailable'}},503);
  if(init?.method==='POST'){
   assert.equal(url.pathname,'/v10/projects/synthetic-commerce/domains');const body=JSON.parse(String(init.body)) as {name:string};assert.match(body.name,/^[a-z0-9-]+\.letbuyy\.store$/);attached.add(body.name);registrations.push(body.name);return reply({name:body.name,verified:true});
  }
  if(url.pathname.endsWith('/config'))return reply({configuredBy:'CNAME',misconfigured:false});
  assert.match(url.pathname,/^\/v9\/projects\/synthetic-commerce\/domains\//);const name=decodeURIComponent(url.pathname.split('/').at(-1)!);return attached.has(name)?reply({name,verified:true}):reply({error:{code:'not_found'}},404);
 }) as typeof fetch;
 const headers=async()=>({...await signedIdentityHeaders(actor,email,a.siteId),'Idempotency-Key':'synthetic-domain-operation-'+randomUUID()});
 const stored=()=>owned.psql(`SELECT jsonb_build_object('published',published,'status',status,'config',template_config,'theme',theme_id,'updated_at',updated_at) FROM sites WHERE id='${a.siteId}';`);
 try {
  const before=stored();
  const unavailable=await gateway.request(`/v1/stores/${a.siteId}/publish`,{method:'POST',headers:await headers()});assert.equal(unavailable.status,503,unavailable.text);assert.equal(unavailable.json?.error.code,'STOREFRONT_DOMAIN_PENDING');assert.equal(stored(),before,'no publication or draft mutation before hosting admission');
  const called=calls;
  const foreign=await gateway.request(`/v1/stores/${a.siteId}/publish`,{method:'POST',headers:{...await signedIdentityHeaders(other,otherEmail,b.siteId),'Idempotency-Key':'synthetic-domain-foreign-'+randomUUID()}});assert.ok([401,403,404].includes(foreign.status),foreign.text);assert.equal(calls,called,'foreign users cannot register any host');
  const anonymous=await gateway.request(`/v1/stores/${a.siteId}/publish`,{method:'POST',headers:{'Idempotency-Key':'synthetic-domain-anon-'+randomUUID()}});assert.equal(anonymous.status,401);assert.equal(calls,called);
  failing=false;
  const publish=await gateway.request(`/v1/stores/${a.siteId}/publish`,{method:'POST',headers:await headers()});assert.equal(publish.status,200,publish.text);assert.equal(publish.json?.data.published,true);assert.equal(registrations.filter(host=>host===`${a.subdomain}.letbuyy.store`).length,1);
  assert.equal((await gateway.request(`/v1/stores/${a.siteId}/publish`,{method:'POST',headers:await headers()})).status,200);assert.equal(registrations.length,1,'publication retry does not register a duplicate');
  const handle='syn-domain-'+randomUUID().slice(0,8),key='synthetic-domain-create-'+randomUUID();const body={name:'Synthetic domain creation',subdomain:handle,site_type:'store'};
  const createHeaders={...await headers(),'Content-Type':'application/json','Idempotency-Key':key};
  failing=true;
  const create=await gateway.request('/v1/stores',{method:'POST',headers:createHeaders,body:JSON.stringify(body)});assert.equal(create.status,201,create.text);assert.equal(create.json?.data.status,'draft');assert.equal(create.json?.data.published,false);assert.equal(create.json?.data.theme_id,'letbuyy-forge');assert.equal(create.json?.meta.storefront_domain.status,'pending');
  const storeId=create.json!.data.id;failing=false;
  const replay=await gateway.request('/v1/stores',{method:'POST',headers:await headers().then(h=>({...h,'Content-Type':'application/json','Idempotency-Key':key})),body:JSON.stringify(body)});assert.equal(replay.status,201,replay.text);assert.equal(replay.json?.data.id,storeId);assert.equal(replay.json?.data.published,false);assert.equal(replay.json?.meta.storefront_domain.status,'ready');assert.equal(registrations.filter(host=>host===`${handle}.letbuyy.store`).length,1);
  assert.equal(owned.psql(`SELECT count(*) FROM sites WHERE subdomain='${handle}';`),'1');
 } finally {globalThis.fetch=original;await gateway.settle();}
});
