// Actual mounted Gateway, owned PG/PostgREST, actual native queue sender. Only DNS/Vercel transports are synthetic.
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {buildSync} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {createBoundDomainReconcileHeaders,createLetbuyyInternalAppHeaders} from '@letbuyy/auth-core';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,tapRest,restJson,INTERNAL_SECRET,signedIdentityHeaders,type RestTap} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),tenant=newSyntheticTenant('domain-job'),actor=randomUUID(),email=`domain-job-${actor}@example.invalid`;
const key='synthetic-dedicated-queue-domain-key-01234567890123456789',caller='queue-workers-domain-reconcile';
const path='/v1/internal/custom-domain-reconcile/run?limit=1',domain=tenant.subdomain+'.example.invalid',target='commerce.synthetic.invalid';
let gateway:Gateway,tap:RestTap,coordinator:Miniflare,priorFetch:typeof fetch,providerCalls=0,fault=false;
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
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{RUNTIME_COORDINATOR:admission,ENVIRONMENT:'production',APP_ENV:'production',NODE_ENV:'production',DEPLOYMENT_ENV:'production',INTERNAL_API_KEYRING:JSON.stringify({[caller]:key}),CUSTOM_DOMAIN_CNAME_TARGET:target,VERCEL_API_TOKEN:'synthetic-vercel-token',VERCEL_STOREFRONT_PROJECT_ID:'synthetic-commerce',VERCEL_TEAM_ID:'synthetic-team',FEATURE_AI_CREDIT_PURCHASE:'false',AI_CREDIT_PURCHASE_MODE:'sandbox',AI_CREDIT_PURCHASE_PROVIDER:'letbuyy_sandbox'}));
 tap=tapRest(owned.restUrl,(call,forward)=>fault&&call.resource==='rpc/consume_internal_auth_replay_jti'?Promise.resolve(restJson(503,{message:'synthetic-private-replay-failure'})):forward());
 priorFetch=globalThis.fetch;globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  if(['cloudflare-dns.com','dns.google'].includes(u.hostname)){providerCalls++;return Response.json({Answer:[{data:target+'.'}]});}
  if(u.hostname==='api.vercel.com'){providerCalls++;return Response.json(u.pathname.endsWith('/config')?{configuredBy:'CNAME',misconfigured:false}:{name:domain,verified:true});}
  return priorFetch(input,init);
 }) as typeof fetch;
});
after(async()=>{globalThis.fetch=priorFetch;tap?.restore();await gateway?.settle();await coordinator?.dispose();});
test('negative control: the original missing-keyring IP gate denies the exact valid job before any provider or DB mutation',async()=>{
 const before=dbStatus(),calls=providerCalls;const result=await run(await signed(),path,'{}',{...gateway.env,INTERNAL_API_KEYRING:undefined});assert.equal(result.status,503);assert.equal(result.json?.error.code,'INTERNAL_PERIMETER_UNCONFIGURED');assert.equal(dbStatus(),before);assert.equal(providerCalls,calls);
});
test('the actual mounted job reconciles a nonempty synthetic domain and preserves route credential authorization',async()=>{
 const calls=providerCalls;const missing=await run(await signed(path,'{}',{'X-Internal-API-Secret':'wrong'}));assert.equal(missing.status,401);assert.equal(providerCalls,calls);assert.equal(dbStatus(),'verifying');
 const result=await run();assert.equal(result.status,200,result.text);assert.equal(result.json?.data.checked,1);assert.equal(result.json?.data.changed,1);assert.equal(dbStatus(),'active');assert.ok(providerCalls>calls);
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
 for(const claimed of [caller,'accounts','unknown']){const result=await gateway.request('/v1/auth/custom/users/by-email',{method:'POST',headers:{...proof.headers,'X-LetBuyy-Internal-Caller':claimed,'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic-denied@example.invalid'})});assert.equal(result.status,401,result.text);}
});
test('missing AI provider placeholder never opens the deferred credit-purchase route',async()=>{
 const h={...await signedIdentityHeaders(actor,email,tenant.siteId),'Content-Type':'application/json','Idempotency-Key':'synthetic-ai-disabled-'+randomUUID()};const result=await gateway.request('/v1/ai/credits/purchase',{method:'POST',headers:h,body:'{}'},{...gateway.env,AI_CREDIT_RAZORPAY_KEY_ID:undefined});assert.equal(result.status,501,result.text);assert.equal(result.json?.error.code,'AI_CREDIT_PURCHASE_NOT_AVAILABLE');
});
test('actual native queue request crosses its service binding into the real mounted Gateway and owned database',async()=>{
 const root=new URL('../../',import.meta.url).pathname;const entry=new URL('../../services/queue-workers/src/index.ts',import.meta.url).pathname;
 const bundled=buildSync({stdin:{contents:`import {triggerCustomDomainReconciler} from ${JSON.stringify(entry)};export default {async fetch(request,env){await triggerCustomDomainReconciler(env,'synthetic-owned-native');return new Response(null,{status:204});}};`,resolveDir:root,sourcefile:'owned-native-domain-job.ts'},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',conditions:['workerd','browser'],external:['node:*'],logLevel:'silent'}).outputFiles[0].text;
 const fetchMock=createFetchMock();fetchMock.disableNetConnect();const responses:Array<{status:number;checked:unknown}>=[];
 const mf=new Miniflare({modules:true,script:bundled,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,fetchMock,bindings:{ENVIRONMENT:'production',APP_ENV:'production',DEPLOYMENT_ENV:'production',INTERNAL_API_SECRET:INTERNAL_SECRET,DOMAIN_RECONCILE_REQUEST_SECRET:key,CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT:'1'},serviceBindings:{API_GATEWAY_SERVICE:async(request:Request)=>{assert.equal(request.headers.get('X-LetBuyy-Internal-App'),'api-gateway:domain-reconcile');const url=new URL(request.url);const result=await gateway.request(url.pathname+url.search,{method:request.method,headers:Object.fromEntries(request.headers),body:await request.text()});responses.push({status:result.status,checked:result.json?.data.checked});return new Response(result.text,{status:result.status,headers:{'Content-Type':'application/json'}});}}});
 try{const response=await mf.dispatchFetch('https://owned-native.invalid/');assert.equal(response.status,204,await response.text());assert.deepEqual(responses,[{status:200,checked:1}]);assert.equal(dbStatus(),'active');}finally{await mf.dispose();}
});
