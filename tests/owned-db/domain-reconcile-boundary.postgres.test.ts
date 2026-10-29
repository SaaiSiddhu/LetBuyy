// Actual mounted Gateway, owned PG/PostgREST, actual native queue sender. Only DNS/Vercel transports are synthetic.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {createBoundDomainReconcileHeaders,createLetbuyyInternalAppHeaders} from '@letbuyy/auth-core';
import {canonicalCheckoutDomainProbePayload} from '@letbuyy/checkout-core';
import {hmacSha256Hex} from '../../services/api-gateway/src/lib/crypto';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,tapRest,restJson,INTERNAL_SECRET,signedIdentityHeaders,type RestTap} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),tenant=newSyntheticTenant('domain-job'),actor=randomUUID(),email=`domain-job-${actor}@example.invalid`;
const key='synthetic-dedicated-queue-domain-key-01234567890123456789',caller='queue-workers-domain-reconcile';
const path='/v1/internal/custom-domain-reconcile/run?limit=1',domain=tenant.subdomain+'.example.invalid',target='commerce.synthetic.invalid';
let gateway:Gateway,tap:RestTap,coordinator:Miniflare,priorFetch:typeof fetch,providerCalls=0,fault=false;
let dnsCnameTarget=target;
let providerFailure: 'dns' | 'vercel' | 'servfail' | null = null;
let writeFault: 'alert' | 'site' | 'race' | null = null;
const cursorCache = new Map<string,string>();
const dbStatus=()=>owned.psql(`SELECT custom_domain_status FROM sites WHERE id='${tenant.siteId}';`);
const signed=async(targetPath=path,body='{}',extra:Record<string,string>={})=>({...await createBoundDomainReconcileHeaders({secret:key,environment:'production',method:'POST',url:'https://gateway.test'+targetPath,body}),'Content-Type':'application/json','X-Internal-API-Secret':INTERNAL_SECRET,...extra});
const run=async(headers?:Record<string,string>,targetPath=path,body='{}',env=gateway.env)=>gateway.request(targetPath,{method:'POST',headers:headers||await signed(targetPath,body),body},env);
before(async()=>{
 seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic job owner');UPDATE sites SET custom_user_id='${actor}',custom_domain='${domain}',custom_domain_status='verifying',custom_domain_verification_token=NULL WHERE id='${tenant.siteId}';`);
 const coordinatorEntry=new URL('../../services/api-gateway/src/durable/runtime-coordinator.ts',import.meta.url).pathname;
 const coordinatorBundle=buildSync({stdin:{contents:`export {LetbuyyRuntimeDurableObject} from ${JSON.stringify(coordinatorEntry)};export default {fetch(){return new Response('owned coordinator')}};`,resolveDir:new URL('../../',import.meta.url).pathname,sourcefile:'owned-native-admission.ts'},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',conditions:['workerd','browser'],external:['node:*'],logLevel:'silent'}).outputFiles[0].text;
 const admissionNetwork=createFetchMock();admissionNetwork.disableNetConnect();coordinator=new Miniflare({modules:true,script:coordinatorBundle,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,fetchMock:admissionNetwork,durableObjects:{RUNTIME_COORDINATOR:'LetbuyyRuntimeDurableObject'},durableObjectsPersist:false,bindings:{ENVIRONMENT:'production',DEPLOYMENT_ENV:'production'}});
 const admission=await coordinator.getDurableObjectNamespace('RUNTIME_COORDINATOR');
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{RUNTIME_COORDINATOR:admission,ENVIRONMENT:'production',APP_ENV:'production',NODE_ENV:'production',DEPLOYMENT_ENV:'production',INTERNAL_API_KEYRING:JSON.stringify({[caller]:key}),CACHE:{get:async(k:string)=>cursorCache.get(k)||null,put:async(k:string,v:string)=>{cursorCache.set(k,v);}},CUSTOM_DOMAIN_CNAME_TARGET:target,VERCEL_API_TOKEN:'synthetic-vercel-token',VERCEL_STOREFRONT_PROJECT_ID:'synthetic-commerce',VERCEL_TEAM_ID:'synthetic-team',FEATURE_AI_CREDIT_PURCHASE:'false',AI_CREDIT_PURCHASE_MODE:'sandbox',AI_CREDIT_PURCHASE_PROVIDER:'letbuyy_sandbox'}));
 tap=tapRest(owned.restUrl,(call,forward)=>{
  if(fault&&call.resource==='rpc/consume_internal_auth_replay_jti')return Promise.resolve(restJson(503,{message:'synthetic-private-replay-failure'}));
  if((writeFault==='alert'&&call.resource==='platform_queue_jobs'&&call.method==='POST')||(writeFault==='site'&&call.resource==='sites'&&call.method==='PATCH'))return Promise.resolve(restJson(503,{message:'synthetic-private-write-failure'}));
  if(writeFault==='race'&&call.resource==='sites'&&call.method==='PATCH'){assert.equal(call.search.get('id'),'eq.'+tenant.siteId);owned.psql(`UPDATE sites SET custom_domain='changed-${domain}',custom_domain_status='verifying' WHERE id='${tenant.siteId}';`);writeFault=null;}
  return forward();
 });
 priorFetch=globalThis.fetch;globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  if(['cloudflare-dns.com','dns.google'].includes(u.hostname)){providerCalls++;if(providerFailure==='dns')return new Response(null,{status:503});assert.equal(init?.redirect,'manual');assert.ok(init?.signal);return Response.json({Status:providerFailure==='servfail'?2:0,Answer:[{data:u.searchParams.get('type')==='TXT'?'\"example-Domain-Proof\"':dnsCnameTarget+'.'}]});}
 if(u.hostname==='api.vercel.com'){providerCalls++;assert.equal(init?.redirect,'manual');if(providerFailure==='vercel')return new Response(null,{status:503});const parts=u.pathname.split('/');const domainName=decodeURIComponent(parts[parts.indexOf('domains')+1]);return Response.json(u.pathname.endsWith('/config')?{configuredBy:'CNAME',misconfigured:false}:{name:domainName,projectId:'synthetic-commerce',verified:true});}
 if(u.hostname.startsWith('checkout.')&&u.pathname==='/.well-known/letbuyy-checkout-domain'){
  providerCalls++;assert.equal(init?.redirect,'manual');
  const {signature,...proof}=JSON.parse(new Headers(init?.headers).get('X-LetBuyy-Checkout-Probe')!);
  assert.equal(signature,await hmacSha256Hex('synthetic-checkout-application-proof-key',canonicalCheckoutDomainProbePayload('request',proof)));
  return Response.json({...proof,signature:await hmacSha256Hex('synthetic-checkout-application-proof-key',canonicalCheckoutDomainProbePayload('response',proof))});
 }
  return priorFetch(input,init);
 }) as typeof fetch;
});
after(async()=>{globalThis.fetch=priorFetch;tap?.restore();await gateway?.settle();await coordinator?.dispose();});
test('negative control: the original missing-keyring IP gate denies the exact valid job before any provider or DB mutation',async()=>{
 const before=dbStatus(),calls=providerCalls;const result=await run(await signed(),path,'{}',{...gateway.env,INTERNAL_API_KEYRING:undefined});assert.equal(result.status,503);assert.equal(result.json?.error.code,'INTERNAL_PERIMETER_UNCONFIGURED');assert.equal(dbStatus(),before);assert.equal(providerCalls,calls);
});
test('the actual mounted job reconciles a nonempty synthetic domain and preserves route credential authorization',async()=>{
 const calls=providerCalls;const missing=await run(await signed(path,'{}',{'X-Internal-API-Secret':'wrong'}));assert.equal(missing.status,401);assert.equal(providerCalls,calls);assert.equal(dbStatus(),'verifying');
 const result=await run();assert.equal(result.status,200,result.text);assert.equal(result.json?.data.checked,1);assert.equal(result.json?.data.changed,1);assert.equal(dbStatus(),'active');assert.ok(providerCalls>calls);assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE site_id='${tenant.siteId}' AND job_type='custom_domain.status_drift';`),'1');
});
test('the real staging and production deployment configuration can reconcile a nonempty routing candidate',async()=>{
 const wrangler=readFileSync(new URL('../../services/api-gateway/wrangler.toml',import.meta.url),'utf8');
 try{
  for(const environment of ['staging','production']){
   const vars=wrangler.split('[env.'+environment+'.vars]')[1]?.split('\n[')[0]||'';
   const cname=vars.match(/^CUSTOM_DOMAIN_CNAME_TARGET\s*=\s*"([^"]+)"/m)?.[1];
   dnsCnameTarget=cname||target;
   const result=await run(undefined,path,'{}',{...gateway.env,CUSTOM_DOMAIN_CNAME_TARGET:cname,NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET:undefined});
   assert.equal(result.status,200,environment+' actual configured target must reach the real candidate: '+result.text);
   assert.equal(result.json?.data.checked,1);assert.equal(result.json?.data.results[0].status,'active');
  }
 }finally{dnsCnameTarget=target;}
});
test('durable concurrent replay permits exactly one job across fresh Gateway instances',async()=>{
 const h=await signed();const results=await Promise.all(Array.from({length:12},()=>new Gateway(gateway.env).request(path,{method:'POST',headers:h,body:'{}'})));
 assert.equal(results.filter(r=>r.status===200).length,1,results.map(r=>r.text).join('\n'));assert.equal(results.filter(r=>r.status===401).length,11);assert.equal((await run(h)).status,401);
 const replay=tap.calls.filter(c=>c.resource==='rpc/consume_internal_auth_replay_jti');assert.ok(replay.length>=12);
});
test('tampered scope, stale proof, wrong environment/key, query/body budgets and route substitution never reach providers',async()=>{
 const h=await signed(),calls=providerCalls;
 for(const [targetPath,body,headers] of [[path+'&extra=1','{}',h],[path,'{ }',h],[path,'x'.repeat(513),h],[path,'{"unexpected":true}',await signed(path,'{"unexpected":true}')],[path,'{}',{...h,'X-LetBuyy-Internal-Environment':'staging'}],[path,'{}',{...h,'X-LetBuyy-Internal-Caller':'accounts'}]] as const)assert.equal((await run(headers,targetPath,body)).status,401);
 const old=await createBoundDomainReconcileHeaders({secret:key,environment:'production',method:'POST',url:'https://gateway.test'+path,body:'{}',nowMs:Date.now()-120001});assert.equal((await run({...h,...old})).status,401);
 assert.equal((await run(h,path,'{}',{...gateway.env,APP_ENV:'staging'})).status,503);
 assert.equal((await run(h,path,'{}',{...gateway.env,INTERNAL_API_KEYRING:JSON.stringify({[caller]:key+'foreign'})})).status,401);
 assert.equal(providerCalls,calls);assert.equal((await run(h)).status,200,'altered requests did not consume the original valid nonce');
 for(const other of ['/v1/internal/console/anything','/v1/internal/billing/subscriptions/activate','/v1/internal/events/domain','/v1/internal/custom-domain-reconcile/run/extra'])assert.equal((await run(h,other)).json?.error.code,'INTERNAL_PERIMETER_UNCONFIGURED');
 assert.equal((await gateway.request(path,{headers:h})).json?.error.code,'INTERNAL_PERIMETER_UNCONFIGURED');
});
test('replay database outage is sanitized, stops before domain reads, then recovers with the same unconsumed proof',async()=>{
 const h=await signed(),calls=providerCalls,start=tap.calls.length;try{fault=true;const result=await run(h);assert.equal(result.status,503);assert.equal(result.json?.error.code,'DOMAIN_RECONCILE_UNAVAILABLE');assert.doesNotMatch(result.text,/synthetic-private|SQLSTATE|PostgREST/);assert.equal(providerCalls,calls);assert.equal(tap.calls.slice(start).some(c=>c.resource==='sites'),false);}finally{fault=false;}assert.equal((await run(h)).status,200);
});
test('the dedicated queue key cannot become an Accounts credential through the general keyring',async()=>{
 const proof=await createLetbuyyInternalAppHeaders({app:'accounts',secret:key});assert.equal(proof.ok,true);if(!proof.ok)throw new Error('Synthetic proof setup');
 for(const claimed of [caller,'accounts','unknown','__proto__','constructor','toString']){const result=await gateway.request('/v1/auth/custom/users/by-email',{method:'POST',headers:{...proof.headers,'X-LetBuyy-Internal-Caller':claimed,'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic-denied@example.invalid'})});assert.equal(result.status,401,result.text);}
});
test('missing AI provider placeholder never opens the deferred credit-purchase route',async()=>{
 const h={...await signedIdentityHeaders(actor,email,tenant.siteId),'Content-Type':'application/json','Idempotency-Key':'synthetic-ai-disabled-'+randomUUID()};const result=await gateway.request('/v1/ai/credits/purchase',{method:'POST',headers:h,body:'{}'},{...gateway.env,AI_CREDIT_RAZORPAY_KEY_ID:undefined});assert.equal(result.status,501,result.text);assert.equal(result.json?.error.code,'AI_CREDIT_PURCHASE_NOT_AVAILABLE');
});

test('direct route secret, allowed IP and missing/replayed dedicated proofs never construct a candidate query', async()=>{
 const before=tap.calls.length,calls=providerCalls;
 const direct={'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.42'};
 assert.equal((await run(direct)).status,401);
 assert.equal((await run(direct,path,'{}',{...gateway.env,INTERNAL_API_KEYRING:undefined,INTERNAL_GATEWAY_IP_ALLOWLIST:'198.51.100.42'})).status,401);
 assert.equal(providerCalls,calls);
 assert.equal(tap.calls.slice(before).filter(c=>c.resource==='sites').length,0);
});


test('a failed cursor cache cannot authorize a different read or prevent valid work', async()=>{
 const start=tap.calls.length;
 const result=await run(undefined,path,'{}',{...gateway.env,CACHE:{get:async()=>{throw Error('synthetic-cache-outage');},put:async()=>{throw Error('synthetic-cache-outage');}}});
 assert.equal(result.status,200,result.text);assert.equal(result.json?.data.checked,1);
 assert.ok(tap.calls.slice(start).filter(c=>c.resource==='sites'&&c.method==='GET').every(c=>c.search.get('limit')==='1'&&!c.search.get('id')));
});

test('alert and status-write failures recover with one durable observation and no silent status advance',async()=>{
 try{
  for(const fail of ['alert','site'] as const){
   const retryDomain=fail+'-'+domain;cursorCache.clear();owned.psql(`UPDATE sites SET custom_domain='${retryDomain}',custom_domain_status='verifying',custom_domain_verification_token=NULL WHERE id='${tenant.siteId}';`);
   const alertCount=()=>owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE site_id='${tenant.siteId}' AND job_type='custom_domain.status_drift' AND payload->'payload'->>'domain'='${retryDomain}';`);
   writeFault=fail;const refused=await run();assert.equal(refused.status,503,refused.text);assert.doesNotMatch(refused.text,/synthetic-private|SQLSTATE/);assert.equal(dbStatus(),'verifying');assert.equal(alertCount(),fail==='alert'?'0':'1');
   writeFault=null;const retry=await run();assert.equal(retry.status,200,retry.text);assert.equal(dbStatus(),'active');assert.equal(alertCount(),'1');
   assert.equal((await run()).status,200);assert.equal(alertCount(),'1');
  }
 }finally{writeFault=null;owned.psql(`UPDATE sites SET custom_domain='${domain}',custom_domain_status='active',custom_domain_verification_token=NULL WHERE id='${tenant.siteId}';`);cursorCache.clear();}
});

test('a merchant domain change between observation and status save is never overwritten',async()=>{
 try{
  cursorCache.clear();owned.psql(`UPDATE sites SET custom_domain_status='verifying' WHERE id='${tenant.siteId}';`);writeFault='race';
  const response=await run();assert.equal(response.status,200,response.text);assert.equal(response.json?.data.changed,0);assert.equal(response.json?.data.results[0].reason,'STATE_CHANGED');assert.equal(response.json?.data.results[0].status,null);
  assert.equal(owned.psql(`SELECT custom_domain||':'||custom_domain_status FROM sites WHERE id='${tenant.siteId}';`),'changed-'+domain+':verifying');
 }finally{writeFault=null;owned.psql(`UPDATE sites SET custom_domain='${domain}',custom_domain_status='active' WHERE id='${tenant.siteId}';`);cursorCache.clear();}
});

test('two-store candidates advance and wrap a validated hint; deleted, pending and null domains stay excluded', async()=>{
 const other=newSyntheticTenant('domain-job-second'),deleted=newSyntheticTenant('domain-job-deleted'),pending=newSyntheticTenant('domain-job-pending'),blank=newSyntheticTenant('domain-job-blank');
 for(const t of [other,deleted,pending,blank])seedSyntheticTenant(owned.psql,t);
 const otherDomain=other.subdomain+'.example.invalid';
 owned.psql(`UPDATE sites SET custom_domain='${otherDomain}',custom_domain_status='verifying',custom_domain_verification_token='example-Domain-Proof' WHERE id='${other.siteId}';UPDATE sites SET custom_domain='${deleted.subdomain}.example.invalid',custom_domain_status='verifying',deleted_at=now() WHERE id='${deleted.siteId}';UPDATE sites SET custom_domain='${pending.subdomain}.example.invalid',custom_domain_status='pending' WHERE id='${pending.siteId}';UPDATE sites SET custom_domain=NULL,custom_domain_status='verifying' WHERE id='${blank.siteId}';`);
 cursorCache.clear();const start=tap.calls.length;
 const seen:string[]=[];
 for(let i=0;i<3;i++){const response=await run();assert.equal(response.status,200,response.text);assert.equal(response.json?.data.checked,1);seen.push(response.json?.data.results[0].domain);assert.doesNotMatch(response.text,/verification_token|example-Domain-Proof/);}
 assert.notEqual(seen[0],seen[1]);assert.equal(seen[0],seen[2]);assert.deepEqual(new Set(seen),new Set([domain,otherDomain]));
 for(const call of tap.calls.slice(start).filter(c=>c.resource==='sites'&&c.method==='GET')){
  assert.equal(call.search.get('select')?.replace(/\s/g,''),'id,custom_domain,custom_domain_status,custom_domain_verification_token');
  assert.equal(call.search.get('deleted_at'),'is.null');assert.equal(call.search.get('limit'),'1');assert.equal(call.search.get('order'),'id.asc');
 }
 for(const call of tap.calls.slice(start).filter(c=>c.resource==='sites'&&c.method==='PATCH')){
  assert.ok([`eq.${tenant.siteId}`,`eq.${other.siteId}`].includes(call.search.get('id')||''));assert.ok(call.search.get('custom_domain'));assert.ok(call.search.get('custom_domain_status'));
 }
 cursorCache.set('custom-domain-reconcile:v1:production',"';SELECT * FROM users_custom;--");
 const before=tap.calls.length;assert.equal((await run()).status,200);
 assert.ok(tap.calls.slice(before).filter(c=>c.resource==='sites'&&c.method==='GET').every(c=>!c.search.get('id')),'invalid cursor is ignored, never sent to SQL');
 cursorCache.clear();
});

test('provider outage does not invent drift, and large requested pages stay within a finite per-invocation budget',async()=>{
 const extras=[newSyntheticTenant('domain-budget-a'),newSyntheticTenant('domain-budget-b')];for(const t of extras){seedSyntheticTenant(owned.psql,t);owned.psql(`UPDATE sites SET custom_domain='${t.subdomain}.example.invalid',custom_domain_status='active',custom_domain_verification_token='example-Domain-Proof' WHERE id='${t.siteId}';`);}
 owned.psql(`UPDATE sites SET custom_domain_status='active',custom_domain_verification_token='example-Domain-Proof' WHERE custom_domain IS NOT NULL AND deleted_at IS NULL AND custom_domain_status IN('active','verifying','error');`);
 const before=owned.psql(`SELECT id||':'||custom_domain_status FROM sites WHERE custom_domain IS NOT NULL AND deleted_at IS NULL ORDER BY id;`);
 try{
  for(const failure of ['dns','servfail','vercel'] as const){
   providerFailure=failure;cursorCache.clear();const calls=providerCalls,start=tap.calls.length;
   const response=await run(undefined,'/v1/internal/custom-domain-reconcile/run?limit=100');assert.equal(response.status,200,response.text);assert.equal(response.json?.data.checked,2);assert.equal(response.json?.data.changed,0);assert.equal(response.json?.data.deferred,true);assert.ok(response.json?.data.results.every((r:{reason:string;status:unknown})=>r.reason==='PROVIDER_UNAVAILABLE'&&r.status===null));
   assert.ok(providerCalls-calls+tap.calls.length-start<50,'real route provider/replay/metadata calls leave Free-plan headroom');
   assert.equal(owned.psql(`SELECT id||':'||custom_domain_status FROM sites WHERE custom_domain IS NOT NULL AND deleted_at IS NULL ORDER BY id;`),before);
  }
 }finally{providerFailure=null;cursorCache.clear();}
});

test('actual native queue request crosses its service binding into the real mounted Gateway and owned database',async()=>{
 const root=new URL('../../',import.meta.url).pathname;const entry=new URL('../../services/queue-workers/src/index.ts',import.meta.url).pathname;
 const bundled=buildSync({stdin:{contents:`import {triggerCustomDomainReconciler} from ${JSON.stringify(entry)};export default {async fetch(request,env){await triggerCustomDomainReconciler(env,'synthetic-owned-native');return new Response(null,{status:204});}};`,resolveDir:root,sourcefile:'owned-native-domain-job.ts'},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',conditions:['workerd','browser'],external:['node:*'],logLevel:'silent'}).outputFiles[0].text;
 const fetchMock=createFetchMock();fetchMock.disableNetConnect();const responses:Array<{status:number;checked:unknown}>=[];
 let redirectReply=false,serviceCalls=0;
 const mf=new Miniflare({modules:true,script:bundled,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,fetchMock,bindings:{ENVIRONMENT:'production',APP_ENV:'production',DEPLOYMENT_ENV:'production',INTERNAL_API_SECRET:INTERNAL_SECRET,DOMAIN_RECONCILE_REQUEST_SECRET:key,CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT:'1'},serviceBindings:{API_GATEWAY_SERVICE:async(request:Request)=>{serviceCalls++;if(redirectReply)return new Response(null,{status:302,headers:{Location:'https://synthetic-do-not-follow.invalid/'}});assert.equal(request.headers.get('X-LetBuyy-Internal-App'),'api-gateway:domain-reconcile');const url=new URL(request.url);const result=await gateway.request(url.pathname+url.search,{method:request.method,headers:Object.fromEntries(request.headers),body:await request.text()});responses.push({status:result.status,checked:result.json?.data.checked});return new Response(result.text,{status:result.status,headers:{'Content-Type':'application/json'}});}}});
 try{const response=await mf.dispatchFetch('https://owned-native.invalid/');assert.equal(response.status,204,await response.text());assert.deepEqual(responses,[{status:200,checked:1}]);assert.equal(dbStatus(),'active');redirectReply=true;const refused=await mf.dispatchFetch('https://owned-native.invalid/');assert.equal(refused.status,204,await refused.text());assert.equal(serviceCalls,2);assert.equal(responses.length,1,'the redirect did not reach a second Gateway or external host');}finally{await mf.dispose();}
});

test('mixed storefront and checkout candidates advance fairly under the real signed job and Free request budget',async()=>{
 const platform=newSyntheticTenant('job-platform'),custom=newSyntheticTenant('job-custom'),deleted=newSyntheticTenant('job-deleted');
 for(const site of [platform,custom,deleted])seedSyntheticTenant(owned.psql,site);
 const customHost=custom.subdomain+'.example.invalid',parent=randomUUID();
 owned.psql(`UPDATE sites SET custom_domain='${customHost}',custom_domain_status='active' WHERE id='${custom.siteId}';
  INSERT INTO site_domains(id,site_id,domain,purpose,role,status,ssl_status) VALUES('${parent}','${custom.siteId}','${customHost}','storefront','primary','active','active');
  INSERT INTO site_domains(site_id,domain,purpose,role,status,ssl_status,checkout_parent_domain_id,metadata) VALUES
   ('${platform.siteId}','checkout.${platform.subdomain}.shops.example.invalid','checkout','redirect','pending','pending',NULL,'{"managed_by":"letbuyy-checkout-v1"}'),
   ('${custom.siteId}','checkout.${customHost}','checkout','redirect','pending','pending','${parent}','{"managed_by":"letbuyy-checkout-v1"}'),
   ('${deleted.siteId}','checkout.${deleted.subdomain}.shops.example.invalid','checkout','redirect','pending','pending',NULL,'{"managed_by":"letbuyy-checkout-v1"}');
  UPDATE sites SET deleted_at=now() WHERE id='${deleted.siteId}';`);
 const seen=new Set<string>();cursorCache.clear();
 const configured={...gateway.env,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'shops.example.invalid',STORE_ACCESS_SIGNING_KEY:'synthetic-checkout-application-proof-key'};
 for(let attempt=0;attempt<16&&seen.size<2;attempt++){
  const start=tap.calls.length,calls=providerCalls;
  const response=await run(undefined,path,'{}',configured);assert.equal(response.status,200,response.text);
  assert.ok(response.json?.data.checked<=2);assert.ok(response.json?.data.checkout_results.length<=1);
  for(const result of response.json?.data.checkout_results||[]){assert.notEqual(result.site_id,deleted.siteId);assert.equal(result.status,'active',JSON.stringify(result));seen.add(result.site_id);}
  assert.ok(tap.calls.length-start+providerCalls-calls<50,'all actual PostgREST, durable replay and provider calls leave Free-plan headroom');
  const candidate=tap.calls.slice(start).find(call=>call.resource==='site_domains'&&call.search.get('select')==='site_id,id,sites!inner(id)');
  assert.ok(candidate);assert.equal(candidate.search.get('sites.deleted_at'),'is.null');assert.equal(candidate.search.get('limit'),'1');
 }
 assert.deepEqual(seen,new Set([platform.siteId,custom.siteId]));
 for(const site of [platform,custom])assert.equal(owned.psql(`SELECT status||':'||ssl_status FROM site_domains WHERE site_id='${site.siteId}' AND purpose='checkout' AND deleted_at IS NULL;`),'active:active');
 assert.equal(owned.psql(`SELECT status FROM site_domains WHERE site_id='${deleted.siteId}' AND purpose='checkout';`),'pending');
});
