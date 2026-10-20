// Actual Gateway workerd + owned PostgreSQL wire transport. No production service.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire,builtinModules} from 'node:module';
import {Miniflare} from 'miniflare';
import {chromium,expect} from '@playwright/test';
import {requireOwnedDatabase,startOwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {gatewayEnv,newIdentityKeys,nextClientAddress,signedIdentityHeaders,type GatewayResponse} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
const owned=requireOwnedDatabase();
class NativeGateway {
 private constructor(readonly mf: Miniflare, readonly restOrigin: string, readonly tap: { beforeFinish?: () => Promise<void>; loseFinishReply?: boolean }) {}
 static async create(env: Record<string, unknown>, predecessor = false, smallBudget = false) {
  // Reuse the already locked Gateway Wrangler compiler; no added compiler package,
  // downloads, subprocess command, synthetic route, or Node crypto polyfill.
  const gatewayRequire = createRequire(new URL('../../services/api-gateway/package.json', import.meta.url));
  const compiler = createRequire(gatewayRequire.resolve('wrangler'))('esbuild') as { build(options: unknown): Promise<{ outputFiles?: { text: string }[] }> };
  const bundle = await compiler.build({ entryPoints: [new URL('../../services/api-gateway/src/index.ts', import.meta.url).pathname], absWorkingDir: new URL('../..', import.meta.url).pathname,
   bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
   banner: {js: "import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-owned-gateway.mjs');"}, tsconfig: 'services/api-gateway/tsconfig.json', external: ['cloudflare:*','node:*'], conditions: ['workerd','worker','browser'], logLevel: 'silent',
   // Match Wrangler's Node compatibility resolution while retaining native
   // implementations. No crypto, storage or route implementation is replaced.
   plugins: [...((predecessor || smallBudget) ? [{name:'sql-predecessor-entry',setup(build: any){build.onLoad({filter:/api-gateway\/src\/index\.ts$/},()=>({contents:readFileSync(new URL('../../services/api-gateway/src/index.ts',import.meta.url),'utf8').replace(predecessor ? /    fetch\(request(?:: Request)?, env(?:: Env)?, ctx(?:: ExecutionContext)?\) \{[\s\S]*?    \},\n    scheduled/ : /NEVER_MATCH_SCOPE/, '    fetch: app.fetch,\n    scheduled').replace(smallBudget ? /pointsPerSecond: 20,\n    capacity: 200,/ : /NEVER_MATCH_BUDGET/, 'pointsPerSecond: 0.001,\n    capacity: 2,'),loader:'ts'}));}}] : []), { name: 'native-node-builtins', setup(build: {onResolve(options: {filter: RegExp}, handler: (args: {path:string}) => {path:string;external:true}|undefined):void}) {
    const native = new Set(builtinModules);
    build.onResolve({filter:/^[a-z][\w/]*$/}, args => native.has(args.path) ? {path:'node:'+args.path,external:true} : undefined);
   }}] });
  assert.equal(bundle.outputFiles?.length, 1);
  if(predecessor)assert.ok(bundle.outputFiles![0].text.includes('fetch: app.fetch') || /fetch:\s*app\.fetch/.test(bundle.outputFiles![0].text),'negative compiled entry must actually omit the SQL invocation wrapper');
  const origin = new URL(String(env.SUPABASE_URL)).origin;
  const tap: { beforeFinish?: () => Promise<void>; loseFinishReply?: boolean } = {};
  const mf = new Miniflare({ modules: true, script: bundle.outputFiles![0].text, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false,
   durableObjects: {RUNTIME_COORDINATOR:{className:'LetbuyyRuntimeDurableObject',useSQLite:true}}, durableObjectsPersist:false,
   bindings: env as never, r2Buckets: ['REEL_ORIGINALS_BUCKET','R2_BUCKET'], r2Persist: false,
   outboundService: async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.origin, origin, 'only this verified owned PostgREST origin is reachable');
    let finish = false;
    if(url.pathname.endsWith('/rpc/reel_upload_v1')) {
     const command = await request.clone().json() as { p_action?: string }; finish = command.p_action === 'finish';
     if(finish && tap.beforeFinish) { const barrier=tap.beforeFinish;tap.beforeFinish=undefined;await barrier(); }
    }
    const response=await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:'error'} as RequestInit);
    if(finish && tap.loseFinishReply && response.ok) { tap.loseFinishReply=false;return new Response('{"error":{"code":"SYNTHETIC_COMMITTED_REPLY_LOSS"}}',{status:503,headers:{'Content-Type':'application/json'}}) as never; }
    return response as never;
   },
  });
  try { await mf.ready; return new NativeGateway(mf, origin, tap); }
  catch(error) {
   try { await mf.dispose(); }
   catch(cleanupError) { throw new AggregateError([error,cleanupError],'Owned native Gateway startup and disposal both failed'); }
   throw error;
  }
 }
 async request(path: string, init: RequestInit = {}, origin = 'https://gateway.test'): Promise<GatewayResponse> {
  const headers = new Headers(init.headers); if(!headers.has('CF-Connecting-IP'))headers.set('CF-Connecting-IP', nextClientAddress());
  const response = await this.mf.dispatchFetch(origin+path, { ...init, headers } as never), text = await response.text();
  let parsed: Record<string, any> | null = null; try { parsed = JSON.parse(text); } catch { /* negative response */ }
  return { status: response.status, text, json: parsed, headers: new Headers(response.headers) };
 }
 async settle() { await this.mf.dispose(); }
}
test('Gateway SQL belongs to each native Worker invocation; exact predecessor reproduces warm-request failure',{timeout:120000},async()=>{
 const tenants=[newSyntheticTenant('native-sql-a'),newSyntheticTenant('native-sql-b')];
 const actors=[randomUUID(),randomUUID()]; const products=[randomUUID(),randomUUID()];
 for(let i=0;i<2;i++) {const tenant=tenants[i];seedSyntheticTenant(owned.psql,tenant);owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actors[i]}','syn-native-${actors[i]}@example.invalid',true);UPDATE sites SET custom_user_id='${actors[i]}' WHERE id='${tenant.siteId}';INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${products[i]}','${tenant.siteId}','${tenant.siteId}','Native SQL original','native-${products[i]}',100,5,true,'active');`);}
 const proxy=await startOwnedPooledSqlProxy(owned);
 const base=gatewayEnv(owned,await newIdentityKeys(),{...proxy.env(),ASSET_PUBLIC_BASE_URL:'https://cdn.letbuyy.com',UPLOAD_PUBLIC_BASE_URL:'https://gateway.test/assets'});
 const env={...base,DATABASE_URL:proxy.env().HYPERDRIVE.connectionString};delete (env as any).HYPERDRIVE;
 const mutate=async(g:NativeGateway,i:number,label:string,extra:Record<string,unknown>={})=>{
  const version=Number(owned.psql(`SELECT version FROM products WHERE id='${products[i]}';`));const key=randomUUID();
  return g.request('/v1/products/'+products[i],{method:'PATCH',headers:{...await signedIdentityHeaders(actors[i],`syn-native-${actors[i]}@example.invalid`,tenants[i].siteId),'X-Store-ID':tenants[i].siteId},body:JSON.stringify({name:label,...extra,version,idempotency_key:key})});
 };
 let g:NativeGateway|undefined,negative:NativeGateway|undefined,admission:NativeGateway|undefined;
 try {
  g=await NativeGateway.create(env);
  for(let k=0;k<6;k++){const i=k%2;const reply=await mutate(g,i,'Native SQL updated '+k);assert.equal(reply.status,200,reply.text);}
  const simultaneous=await Promise.all([mutate(g,0,'Concurrent A'),mutate(g,1,'Concurrent B')]);assert.deepEqual(simultaneous.map(x=>x.status),[200,200]);
  const denied=await g.request('/v1/products/'+products[1],{headers:await signedIdentityHeaders(actors[0],`syn-native-${actors[0]}@example.invalid`,tenants[0].siteId)});assert.ok([403,404].includes(denied.status));
  const image=new Uint8Array(readFileSync(new URL('../fixtures/week1-synthetic-product.png',import.meta.url)));
  const form=new FormData();form.set('file',new Blob([image],{type:'image/png'}),'synthetic.png');form.set('folder','products');form.set('store_id',tenants[0].siteId);
  const uploadHeaders=new Headers(await signedIdentityHeaders(actors[0],`syn-native-${actors[0]}@example.invalid`,tenants[0].siteId));uploadHeaders.delete('Content-Type');uploadHeaders.set('Idempotency-Key',randomUUID());
  const encodedUpload=new Request('https://gateway.test/v1/upload',{method:'POST',headers:uploadHeaders,body:form});
  const uploaded=await g.request('/v1/upload',{method:'POST',headers:encodedUpload.headers,body:await encodedUpload.arrayBuffer()});assert.equal(uploaded.status,201,uploaded.text);
  assert.equal(new URL(uploaded.json!.data.url).origin,'https://gateway.test','uploaded URL must use the registered Worker, not the configured legacy CDN');
  const serviceHeaders=new Headers(await signedIdentityHeaders(actors[0],`syn-native-${actors[0]}@example.invalid`,tenants[0].siteId));serviceHeaders.delete('Content-Type');
  const serviceUpload=new Request('https://api-gateway.internal/v1/upload',{method:'POST',headers:serviceHeaders,body:form});
  const serviceReply=await g.request('/v1/upload',{method:'POST',headers:serviceUpload.headers,body:await serviceUpload.arrayBuffer()},'https://api-gateway.internal');
  assert.equal(serviceReply.status,201,serviceReply.text);
  assert.equal(new URL(serviceReply.json!.data.url).origin,'https://gateway.test','service-bound upload never persists the internal gateway hostname');
  const path=new URL(uploaded.json!.data.url).pathname;
  const imageResponse=await g.mf.dispatchFetch('https://gateway.test'+path);assert.equal(imageResponse.status,200);assert.deepEqual(new Uint8Array(await imageResponse.arrayBuffer()),image);
  assert.equal(imageResponse.headers.get('Content-Type'),'image/png');assert.equal(imageResponse.headers.get('X-Content-Type-Options'),'nosniff');
  const head=await g.mf.dispatchFetch('https://gateway.test'+path,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('Content-Length'),String(image.length));
  assert.equal((await g.mf.dispatchFetch('https://gateway.test'+path,{headers:{'If-None-Match':head.headers.get('ETag')!}})).status,304);
  const bucket=await g.mf.getR2Bucket('R2_BUCKET');await bucket.put('public-media/unmarked-secret.png',image,{httpMetadata:{contentType:'image/png'}});await bucket.put('private-reel-originals/synthetic-secret.png',image,{httpMetadata:{contentType:'image/png'},customMetadata:{visibility:'public',delivery:'letbuyy-public-v1'}});
  for(const key of ['public-media/unmarked-secret.png','private-reel-originals/synthetic-secret.png'])assert.equal((await g.mf.dispatchFetch('https://gateway.test/assets/'+key)).status,404);
  const attached=await mutate(g,0,'Product with served image',{images:[uploaded.json!.data.url]});assert.equal(attached.status,200,attached.text);
  const persisted=JSON.parse(owned.psql(`SELECT to_jsonb(images) FROM products WHERE id='${products[0]}';`));assert.deepEqual(persisted,[uploaded.json!.data.url]);
  const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();const origin=(await g.mf.ready).origin;await page.goto(origin+path);await expect(page.locator('img')).toBeVisible();assert.ok(await page.locator('img').evaluate((el:any)=>el.naturalWidth>0),'the delivered PNG actually decodes in Chromium');}finally{await browser.close();}
  console.log('WEEK1_NATIVE_MEDIA_PASS',JSON.stringify({uploadStatus:uploaded.status,configuredLegacyCdnBypassed:true,internalServiceUploadUsesPublicOrigin:true,deliveredExactBytes:image.length,head:true,conditional304:true,productAttachmentPersisted:true,browserImageDecoded:true,unmarkedDenied:true,privateNamespaceDenied:true,runtime:'native local R2/workerd',hostedCdn:false}));
  negative=await NativeGateway.create(env,true);
  const statuses=[];for(let k=0;k<4;k++)statuses.push((await mutate(negative,0,'Predecessor '+k)).status);
  assert.equal(statuses[0],200,'predecessor first request positive control');assert.ok(statuses.slice(1).some(x=>x>=500),'unscoped predecessor must reproduce warm Worker SQL failure');
  admission=await NativeGateway.create({...env,ENVIRONMENT:'production',APP_ENV:'production',NODE_ENV:'production'},false,true);
  const limitedRead=async(i:number)=>admission!.request('/v1/products/'+products[i],{headers:{...await signedIdentityHeaders(actors[i],`syn-native-${actors[i]}@example.invalid`,tenants[i].siteId),'CF-Connecting-IP':'2001:db8::1234'}});
  const sharedProxy=[(await limitedRead(0)).status,(await limitedRead(0)).status,(await limitedRead(0)).status,(await limitedRead(1)).status];
  assert.deepEqual(sharedProxy,[200,200,429,200],'verified actors sharing one proxy have independent atomic budgets');
  const parallel=await Promise.all([limitedRead(1),limitedRead(1)]);assert.deepEqual(parallel.map(x=>x.status).sort(),[200,429],'concurrent last permit is charged only once');
  const spoofed=await admission.request('/v1/products/'+products[0],{headers:{'X-LetBuyy-Internal-User-ID':actors[0],'X-LetBuyy-Internal-Email':`syn-native-${actors[0]}@example.invalid`,'CF-Connecting-IP':'2001:db8::5678'}});assert.equal(spoofed.status,401);
  const namespace=await admission.mf.getDurableObjectNamespace('RUNTIME_COORDINATOR');
  const limiter=namespace.get(namespace.idFromName('synthetic-auth-fixed-window'));
  const fixed=await Promise.all(Array.from({length:4},()=>limiter.fetch('https://coordinator.internal/fixed-window',{method:'POST',body:JSON.stringify({windowMs:3600000,max:1})}).then(r=>r.json()) as Promise<{allowed:boolean}>));
  assert.equal(fixed.filter(x=>x.allowed).length,1,'native authentication-window concurrent check admits only one permit');
  console.log('WEEK1_NATIVE_ADMISSION_PASS',JSON.stringify({sharedProxy,parallelLastPermit:parallel.map(x=>x.status),spoofedIdentityStatus:spoofed.status,atomicAuthWindow:true,backend:'native SQLite Durable Object',budget:'synthetic2points at0.001points/second; production default unchanged',hosted:false}));
  console.log('WEEK1_NATIVE_SQL_PASS',JSON.stringify({sequentialWrites:6,concurrentIndependentTenants:2,crossTenantDenied:true,predecessorStatuses:statuses,runtime:'local workerd',database:'owned PostgreSQL16',hosted:false}));
 }finally {await g?.settle();await negative?.settle();await admission?.settle();await proxy.stop();}
});
