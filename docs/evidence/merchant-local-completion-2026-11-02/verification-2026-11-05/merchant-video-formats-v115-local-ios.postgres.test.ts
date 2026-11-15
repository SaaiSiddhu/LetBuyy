// Explicit local-only emulator lane, selected outside normal CI. Normal native
// sign-in is required; this fixture never supplies an APK session or JWT.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync,openSync,closeSync,copyFileSync,chmodSync,constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {exportJWK} from 'jose';
import {chromium,expect,type Browser,type Page} from '@playwright/test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import mobileBff from '../../../../services/mobile-bff/src/index';
import {hashMerchantPassword} from '../../../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticProductInventory} from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from '../../../../tests/fixtures/local-turnstile-provider';
import {createOwnedProviderFetch} from '../../../../scripts/governance/owned-provider-network.mjs';
import {validateOwnedNextDirectoryReceipt} from '../../../../scripts/governance/owned-next-directory.mjs';
import {NativeGateway} from '../../../../tests/helpers/native-owned-gateway';
import {NativeMobileBff} from '../../../../tests/helpers/native-owned-mobile-bff';
const owned=requireOwnedDatabase();
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
function sourceSnapshot(){
 const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','apps/merchant/mobile','apps/merchant/web','apps/platform/identity','services/api-gateway','services/mobile-bff','packages','database/supabase/migrations','database/supabase/rollback','database/supabase/config.toml','scripts/governance','tests/fixtures','tests/helpers','tests/owned-device/merchant-catalog-local-android.postgres.test.ts','pubspec.yaml','pubspec.lock'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
 return paths.filter(path=>{
  const marker=/^apps\/(?:merchant\/web|platform\/identity)\/\.next-session-runtime-(\d+)-((?:identity|merchant)-next-production)\.owner\.json$/.exec(path);
  if(!marker)return true;
  // This is the canonical supervisor's private generated marker, never source.
  // Validate the exact current run, parent, PID, root and on-disk receipt before
  // excluding it; do not broadly ignore JSON or arbitrary hidden paths.
  validateOwnedNextDirectoryReceipt(JSON.parse(readFileSync(path,'utf8')),{root:process.cwd(),kind:marker[2],runId:owned.runId,supervisorPid:Number(marker[1]),parentPid:process.pid});
  return false;
 }).map(path=>({path,sha256:existsSync(path)?digest(readFileSync(path)):null}));
}
function checkSource(source:ReturnType<typeof sourceSnapshot>,phase:string){
 const current=sourceSnapshot(),before=new Map(source.map(x=>[x.path,x.sha256])),after=new Map(current.map(x=>[x.path,x.sha256]));
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(path=>before.get(path)!==after.get(path));
 assert.equal(digest(JSON.stringify(current)),digest(JSON.stringify(source)),`Source changed during ${phase}: ${changed.slice(0,10).join(', ')}`);
}
function ownedNextListener(port:number,runtime:OwnedClientProcess):boolean {
 assert(runtime.pid,'Owned supervisor PID required');let output:string;
 try{output=execFileSync('lsof',['-nP',`-iTCP:${port}`,'-sTCP:LISTEN','-Fp'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
 catch(error){if((error as {status?:number}).status===1)return false;throw error;}
 const pids=[...new Set(output.split(/\r?\n/).filter(line=>/^p[0-9]+$/.test(line)).map(line=>Number(line.slice(1))))];
 // The supervisor intentionally launches the approved client in a separate
 // process group. Prove actual ancestry to that exact live supervisor instead
 // of mistaking its detached group for an unrelated listener.
 for(const pid of pids){
  let ancestor=pid;const visited=new Set<number>();
  for(let depth=0;depth<12&&ancestor!==runtime.pid;depth++){
   assert(ancestor>1&&!visited.has(ancestor),'OWNED_LISTENER_SCOPE_MISMATCH');visited.add(ancestor);
   ancestor=Number(execFileSync('ps',['-p',String(ancestor),'-o','ppid='],{encoding:'utf8'}).trim());
  }
  assert.equal(ancestor,runtime.pid,'OWNED_LISTENER_SCOPE_MISMATCH');
 }
 return pids.length>0;
}
test('owned iOS MOV WebM Files uploads native playback and web sync',{timeout:1_800_000},async(context)=>{
 const receiptPath=process.env.LETBUYY_IOS_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit task-owned simulator receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8'))as {owner:string;udid:string;run_root:string};
 assert.equal(receipt.owner,'merchant-mobile-local-completion');assert.equal(receipt.udid,'B907B390-5B08-490F-BC6A-8900667B2D94');
 const devices=JSON.parse(execFileSync('xcrun',['simctl','list','devices','available','--json'],{encoding:'utf8'}));
 const simulator=(Object.values(devices.devices).flat()as {udid:string;name:string;state:string}[]).find(v=>v.udid===receipt.udid)as {name:string;state:string}|undefined;
 assert(simulator);assert.equal(simulator.name,'LetBuyy Merchant Local 20261103 br1jhgh8');assert.equal(simulator.state,'Booted');
 const root=resolve(receipt.run_root);assert.match(root,/^\/private\/tmp\/letbuyy-ios-ui-20261107-[a-z0-9]+\/native-ios-v115$/);assert(!existsSync(root));mkdirSync(root,{mode:0o700});
 const categoryFlow=false,settingsFlow=false,warehouseFlow=false,diagnosticDraft=false,verifyStock=false,diagnosticReservation=false,compiledWorkers=true;
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');
 const checkUi=()=>{context.signal.throwIfAborted();if(existsSync(join(root,'ui-attention.json')))throw new Error('The owned normal UI companion failed; private diagnostics retained.');};
 const apiPort=54352,bffPort=54350,identityPort=54351,merchantPort=54353;
 const apiOrigin=`http://127.0.0.1:${apiPort}`,identityWireOrigin=`http://localhost:${identityPort}`,identityOrigin=identityWireOrigin,merchantOrigin=`http://localhost:${merchantPort}`;
 const challenge=await createLocalTurnstileProvider(owned);challenge.enableNativeSdk([identityOrigin]);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=createOwnedProviderFetch(originalFetch,challenge.profile,[9002]);
 const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
 const env=gatewayEnv(owned,keys,{ENVIRONMENT:'test',KYC_UPLOAD_ENABLED:'true',UPLOAD_PUBLIC_BASE_URL:apiOrigin+'/assets',LETBUYY_IDENTITY_ISSUER:identityOrigin,APP_ENV:'development',...proxy.env()});
 let nativeGateway:NativeGateway|undefined;
 let gateway:Pick<Gateway,'request'|'settle'>|undefined;
 const tenant=newSyntheticTenant('native-catalog'),owner=randomUUID(),email=`syn-native-catalog-${owner}@example.invalid`,password=randomUUID()+String.fromCharCode(65,97,49),hash=await hashMerchantPassword(password);
 const collection=randomUUID(),ids=[randomUUID(),randomUUID()];
 seedSyntheticTenant(owned.psql,tenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic Native Catalog Owner','${hash}');UPDATE sites SET custom_user_id='${owner}'WHERE id='${tenant.siteId}';
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${ids[0]}','${tenant.siteId}','${tenant.siteId}','Synthetic cotton tote','syn-native-${ids[0]}',100,4,true,'active'),('${ids[1]}','${tenant.siteId}','${tenant.siteId}','Synthetic blue shirt','syn-native-${ids[1]}',200,3,true,'active');
 INSERT INTO collections(id,store_id,title,is_active)VALUES('${collection}','${tenant.siteId}','Synthetic native collection',true);INSERT INTO collection_products(collection_id,product_id,position)VALUES('${collection}','${ids[0]}',0),('${collection}','${ids[1]}',1);`);
 if(verifyStock)owned.psql(`UPDATE products SET stock=0 WHERE store_id='${tenant.siteId}';`);
 if(diagnosticDraft)owned.psql(`UPDATE products SET stock=3 WHERE id='${ids[0]}';
 INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,incoming,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),'${tenant.siteId}','${ids[0]}','${tenant.locationId}',3,0,0,3,0,3);
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES(gen_random_uuid(),'${tenant.siteId}','Synthetic diagnostic destination','active');`);
 if(settingsFlow)owned.psql(`UPDATE sites SET business_profile=coalesce(business_profile,'{}'::jsonb)||'{"email":"synthetic-contact@example.invalid","trade_name":"Retained synthetic trade"}'::jsonb,invoice_address=coalesce(invoice_address,'{}'::jsonb)||'{"attention":"Retained synthetic attention"}'::jsonb WHERE id='${tenant.siteId}';`);
 if(categoryFlow)owned.psql(`UPDATE products SET category='Synthetic native cotton'WHERE store_id='${tenant.siteId}';`);
 const category=categoryFlow?owned.psql(`SELECT id FROM product_categories WHERE store_id='${tenant.siteId}'AND name='Synthetic native cotton'AND deleted_at IS NULL`):null;
 const restObservations:{method:string;table:string;status:number;latency_ms:number}[]=[];
 const wireIngress:{at:number;phase:string;port?:number;method?:string;path:string;status?:number}[]=[];
 type Call={source:string;path:string;method:string;status:number;wire_status:number;error_code?:string;key_digest?:string;body_digest?:string;data_count?:number;requested_store?:string;scope_hint?:string;beta_product_present?:boolean;range?:string;content_range?:string;asset_kind?:string;store_page?:number;store_total?:number;beta_store_present?:boolean;staff_page?:number;staff_total?:number};const calls:Call[]=[];let lost=false,lostSmart=false;let lostModelUpload=false;let lostSettingsKey:string|undefined;

 const betaProduct=randomUUID(),betaTenant=newSyntheticTenant('native-switcher-beta'), betaOwner=randomUUID(), betaEmail=`syn-beta-owner-${betaOwner}@example.invalid`;
 seedSyntheticTenant(owned.psql,betaTenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${betaOwner}','${betaEmail}',true,'Synthetic Beta Owner','${hash}');
 UPDATE sites SET name='Synthetic Alpha' WHERE id='${tenant.siteId}';
 UPDATE sites SET name='Synthetic Beta',custom_user_id='${betaOwner}' WHERE id='${betaTenant.siteId}';
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,images,metadata)
 VALUES('${betaProduct}','${betaTenant.siteId}','${betaTenant.siteId}','Synthetic Beta product','syn-beta-${betaProduct}',100,3,true,'active',ARRAY['http://127.0.0.1:54352/__owned__/product.png']::text[],'{"specifications":{"Numeric":42,"Boolean":true,"Empty":"","Null":null},"retained":"Synthetic unmanaged metadata"}'::jsonb);`);
 owned.psql(`INSERT INTO employees(id,store_id,email,role,status,is_active,created_at) SELECT gen_random_uuid(),'${tenant.siteId}','syn-native-roster-'||n||'@example.invalid','viewer','invited',false,now()-n*interval '1 day' FROM generate_series(1,53)n;`);
 const alphaRoster=()=>owned.psql(`SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM employees e WHERE store_id='${tenant.siteId}'`);const initialAlphaRoster=alphaRoster();

 // Positive canonical stock control; a name edit must preserve real free,
 // held, committed and on-hand quantities, not only the products cache column.
 seedSyntheticProductInventory(owned.psql,betaTenant.siteId);
 const betaInventory=()=>JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'available',available_quantity,'reserved',reserved_quantity,'committed',committed_quantity,'on_hand',on_hand_quantity)ORDER BY id),'[]'::jsonb)
  FROM inventory_levels WHERE store_id='${betaTenant.siteId}'AND product_id='${betaProduct}'AND deleted_at IS NULL`));
 const initialBetaInventory=betaInventory();assert.equal(initialBetaInventory.length,1);assert.equal(initialBetaInventory[0].available,3);assert.equal(initialBetaInventory[0].on_hand,3);assert.equal(initialBetaInventory[0].reserved,0);assert.equal(initialBetaInventory[0].committed,0);

 // Fifty-one additional real sites put the Staff store beyond the server's
 // first50 page. Keep Alpha first and Beta last using canonical created_at order.
 const extraSites=Array.from({length:51},()=>newSyntheticTenant('switcher-page'));
 owned.psql(`INSERT INTO sites(id,name,store_name,site_type,subdomain,status,published,currency,locale,custom_user_id,created_at,updated_at)VALUES
 ${extraSites.map((site,index)=>`('${site.siteId}','Synthetic membership ${index+1}','Synthetic membership ${index+1}','store','${site.subdomain}','published',true,'INR','en-IN','${owner}',now()-interval '${index+1} day',now())`).join(',')};
 UPDATE sites SET created_at=now() WHERE id='${tenant.siteId}';
 UPDATE sites SET created_at=now()-interval '100 day' WHERE id='${betaTenant.siteId}';`);

 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url), body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
  assert(nativeGateway,'This upload lane requires the actual compiled Worker');
  const response=await nativeGateway.dispatch(url.pathname+url.search,{method:request.method,headers:request.headers,...(body&&body.byteLength?{body}:{})});
  const bytes=await response.arrayBuffer();let json:{data?:unknown[];meta?:{total?:number};error?:{code?:unknown}|string}|undefined;
  if((response.headers.get('Content-Type')||'').includes('application/json')){try{json=JSON.parse(Buffer.from(bytes).toString());}catch{}}
  const uploadData=json?.data&&!Array.isArray(json.data)?json.data as {content_type?:string}:undefined;
  const loseModel=source==='actual-mobile-bff'&&url.pathname==='/v1/upload'&&request.method==='POST'&&response.status===201&&uploadData?.content_type==='model/gltf+json'&&!lostModelUpload;if(loseModel)lostModelUpload=true;
  calls.push({source,range:request.headers.get('Range')||undefined,content_range:response.headers.get('Content-Range')||undefined,asset_kind:/\.(mp4|mov|webm)$/.test(url.pathname)?'video':url.pathname.endsWith('.gltf')?'model':undefined,key_digest:request.headers.get('X-Idempotency-Key')?digest(request.headers.get('X-Idempotency-Key')!):undefined,path:url.pathname,method:request.method,status:response.status,wire_status:loseModel?503:response.status,error_code:json?.error&&typeof json.error==='object'&&typeof json.error.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(json.error.code)?json.error.code:undefined,data_count:Array.isArray(json?.data)?json.data.length:undefined,requested_store:url.searchParams.get('store_id')||undefined,scope_hint:request.headers.get('X-Store-ID')||undefined,beta_product_present:Array.isArray(json?.data)?json.data.some(item=>!!item&&typeof item==='object'&&'id'in item&&item.id===betaProduct):undefined,staff_page:url.pathname==='/v1/employees'?Number(url.searchParams.get('page')||'1'):undefined,staff_total:url.pathname==='/v1/employees'?json?.meta?.total:undefined,store_page:url.pathname==='/v1/stores'?Number(url.searchParams.get('page')||'1'):undefined,store_total:url.pathname==='/v1/stores'?json?.meta?.total:undefined,beta_store_present:url.pathname==='/v1/stores'&&Array.isArray(json?.data)?json.data.some(item=>!!item&&typeof item==='object'&&'id'in item&&item.id===betaTenant.siteId):undefined});
  if(loseModel)return new Response(JSON.stringify({error:{code:'OWNED_LOST_MODEL_RESPONSE',message:'Synthetic transport response lost after actual R2 upload committed'}}),{status:503,headers:{'Content-Type':'application/json'}});
  return new Response(bytes,{status:response.status,headers:new Headers(Object.fromEntries(response.headers.entries()))});
 };
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  const path=(req.url||'/').split('?')[0],port=req.socket.localPort;wireIngress.push({at:Date.now(),phase:'arrived',port,method:req.method,path});res.once('finish',()=>wireIngress.push({at:Date.now(),phase:'finished',port,method:req.method,path,status:res.statusCode}));res.once('close',()=>{if(!res.writableFinished)wireIngress.push({at:Date.now(),phase:'closed-before-finish',port,method:req.method,path});});
  const inputs=[{kind:'video',ext:'mov',mime:'video/quicktime',file:'synthetic-owned-video.mov'},{kind:'webm',ext:'webm',mime:'video/webm',file:'synthetic-owned-video.webm'}];
  if(path==='/__owned__/downloads'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><title>Owned synthetic media</title><h1>Owned synthetic media</h1>'+inputs.map(item=>`<p><a href="/__owned__/download/${item.kind}">Download synthetic ${item.kind}</a></p>`).join(''));return;}
  const input=inputs.find(item=>path==='/__owned__/download/'+item.kind);
  if(input){const bytes=readFileSync(join(resolve(root,'..'),input.file));res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':String(bytes.length),'Content-Disposition':`attachment; filename="synthetic-owned-${input.kind}-${owned.runId}.${input.ext}"`,'Cache-Control':'no-store'});res.end(bytes);return;}
  if(req.url==='/__owned__/product.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGOYNH3Rf2TMQLoAAOM/LKFDq3imAAAAAElFTkSuQmCC','base64'));return;}
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks);const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body.byteLength?{body}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_UNAVAILABLE"}}');}
 });
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 let nativeBff:NativeMobileBff|undefined;
 let api:Server|undefined,bff:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Browser|undefined,nativeBrowser:Browser|undefined;
 const webDiagnostics:{kind:string;path?:string;status?:number;error?:string}[]=[];
 let nativeForward:number|undefined;
 const reversed:number[]=[];
 try{
  nativeGateway=await NativeGateway.create(env as unknown as Record<string,unknown>,async()=>{throw new Error('No email provider call belongs to this owned iOS story');});
  const currentNative=nativeGateway;
  gateway=currentNative?{
  async request(path,init={}){const response=await currentNative.dispatch(path,init);const text=await response.text();let json:Awaited<ReturnType<Gateway['request']>>['json']=null;try{const parsed:unknown=JSON.parse(text);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))json=parsed as NonNullable<Awaited<ReturnType<Gateway['request']>>['json']>;}catch{/* Keep real non-JSON replies available for assertion. */}return{status:response.status,headers:new Headers(Object.fromEntries(response.headers.entries())),text,json};},
  settle:()=>currentNative.settle(),
 }:new Gateway(env);
 if(nativeGateway)writeFileSync(join(root,'compiled-gateway.mjs'),nativeGateway.compiledScript,{mode:0o600,flag:'wx'});

 const provision=await gateway.request('/v1/employees',{method:'POST',headers:{...await signedIdentityHeaders(betaOwner,betaEmail,betaTenant.siteId),'X-Idempotency-Key':randomUUID()},body:JSON.stringify({store_id:betaTenant.siteId,email,full_name:'Synthetic Multi Store Actor',role:'manager'})});
 assert.equal(provision.status,201,provision.text);const employeeId=provision.json!.data.id;
 const staffCatalog=await gateway.request('/v1/products?store_id='+betaTenant.siteId,{headers:await signedIdentityHeaders(owner,email,betaTenant.siteId)});
 assert.equal(staffCatalog.status,200,staffCatalog.text);
 assert.ok(Array.isArray(staffCatalog.json?.data)&&staffCatalog.json.data.some(item=>!!item&&typeof item==='object'&&'id'in item&&item.id===betaProduct),'Positive control: actual manager API catalog must include the real Beta fixture product before native admission');
 const discovery=await gateway.request('/v1/stores?limit=50',{headers:await signedIdentityHeaders(owner,email)});
 assert.equal(discovery.status,200,discovery.text);assert.equal(discovery.json!.data.length,50);assert.equal(discovery.json!.meta.total,53);
 assert(!discovery.json!.data.some((item:{id:string})=>item.id===betaTenant.siteId),'Staff Beta must be beyond page one');
 const tail=await gateway.request('/v1/stores?page=2&limit=50',{headers:await signedIdentityHeaders(owner,email)});assert.equal(tail.status,200,tail.text);assert.equal(tail.json!.data.length,3);
 assert.deepEqual([...discovery.json!.data,...tail.json!.data].map((x:{id:string})=>x.id).sort(),[tenant.siteId,betaTenant.siteId,...extraSites.map(site=>site.siteId)].sort());
  if(compiledWorkers){
   nativeBff=await NativeMobileBff.create({INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development'},request=>record(request,'actual-mobile-bff'),globalThis.fetch);
   writeFileSync(join(root,'compiled-mobile-bff.mjs'),nativeBff.compiledScript,{mode:0o600,flag:'wx'});
   writeFileSync(join(root,'compiled-workers.json'),JSON.stringify({run_id:owned.runId,runtime:'workerd',gateway_sha256:digest(nativeGateway!.compiledScript),bff_sha256:digest(nativeBff.compiledScript),entrypoints:['services/api-gateway/src/index.ts','services/mobile-bff/src/index.ts'],transport:'Owned Node HTTP and service-binding observer; no business response stubs',hosted:false})+'\n',{mode:0o600,flag:'wx'});
  }
  api=bridge(req=>record(req,'actual-identity'));bff=bridge(async req=>nativeBff?await nativeBff.dispatch(req) as unknown as Response:mobileBff.fetch(req,bffEnv as never));
  for(const [server,port]of [[api,apiPort],[bff,bffPort]]as const)await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:challenge.profile,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED:'true',NEXT_PUBLIC_LOCAL_CHALLENGE_SDK_URL:challenge.profile.origin+'/fixtures/turnstile/api.js',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:randomUUID()+randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+360_000;let live=false;while(Date.now()<deadline){if(identity.exitCode!==null)throw new Error('Owned issuer stopped');try{if(!ownedNextListener(identityPort,identity)){await new Promise(r=>setTimeout(r,250));continue;}if((await fetch(identityWireOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(live,'normal issuer readiness');
  const defines={ENVIRONMENT:'local',BFF_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,API_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,IDENTITY_BASE_URL:identityOrigin,ADMIN_BASE_URL:merchantOrigin,STOREFRONT_BASE_URL:'http://localhost:54354',LOCAL_CHALLENGE_SDK_URL:challenge.profile.origin+'/fixtures/turnstile/api.js',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',MOBILE_PUSH_DEVICE_TOKEN:'',SENTRY_DSN:'SKIP_NEEDS_HUMAN_LOCAL_SENTRY_DSN'};
  const definesPath=join(root,'dart-defines.json');writeFileSync(definesPath,JSON.stringify(defines),{mode:0o600,flag:'wx'});
  const source=sourceSnapshot(),sourceBytes=JSON.stringify(source),sourceHash=digest(sourceBytes);
  writeFileSync(join(root,'source-snapshot.json'),sourceBytes+'\n',{mode:0o600,flag:'wx'});
  const buildLog=join(root,'ios-build.log');const buildFd=openSync(buildLog,'wx',0o600);
  const build=spawn('/Users/saai_mithra/Library/Developer/flutter/bin/flutter',['build','ios','--device-id='+receipt.udid,'--simulator','--debug','--no-pub','--dart-define-from-file='+definesPath],{cwd:resolve('apps/merchant/mobile'),stdio:['ignore',buildFd,buildFd],env:process.env});
  const buildExit=await new Promise<number|null>((resolve,reject)=>{build.once('error',reject);build.once('close',resolve);});closeSync(buildFd);assert.equal(buildExit,0,'current iOS build must pass');checkSource(source,'iOS build');
  const app=resolve('apps/merchant/mobile/build/ios/iphonesimulator/Runner.app');
  const artifactRoot=join(root,'qualified-artifact');mkdirSync(artifactRoot,{mode:0o700});
  execFileSync('ditto',[app,join(artifactRoot,'Runner.app')]);
  execFileSync('xcrun',['simctl','install',receipt.udid,join(artifactRoot,'Runner.app')]);
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,LETBUYY_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_BASE_URL:apiOrigin+'/v1'}});
  const webDeadline=Date.now()+360000;let webLive=false;while(Date.now()<webDeadline){if(merchant.exitCode!==null)throw new Error('Owned Merchant stopped');try{if(ownedNextListener(merchantPort,merchant)&&(await fetch(merchantOrigin,{redirect:'manual',signal:AbortSignal.timeout(2000)})).status<500){webLive=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(webLive);
  browser=await chromium.launch({headless:true});const web=await browser.newContext();await challenge.attachBrowser(web,[identityOrigin,merchantOrigin,apiOrigin,challenge.profile.origin]);
const page=await web.newPage();page.on('requestfailed',request=>{const url=new URL(request.url());if(webDiagnostics.length<40)webDiagnostics.push({kind:'requestfailed',path:url.pathname,error:request.failure()?.errorText});});page.on('console',message=>{if(message.type()==='error'&&webDiagnostics.length<40)webDiagnostics.push({kind:message.text().includes('Content Security Policy')||message.text().includes('Content-Security-Policy')?'csp-error':'browser-error'});});page.on('response',response=>{const url=new URL(response.url());if(url.origin===challenge.profile.origin&&webDiagnostics.length<40)webDiagnostics.push({kind:'local-provider-response',path:url.pathname,status:response.status()});});page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
  await page.goto(identityOrigin+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.waitForURL(url=>url.origin===merchantOrigin||(url.origin===identityOrigin&&url.pathname==='/select'));
  if(new URL(page.url()).origin===identityOrigin){const choice=page.getByRole('button').filter({hasText:tenant.subdomain});await expect(choice).toHaveCount(1);await choice.click();}
  await page.waitForURL(url=>url.origin===merchantOrigin&&url.pathname.startsWith('/'+tenant.subdomain+'/'));
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/'+ids[0]);await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic cotton tote');
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,udid:receipt.udid,email,password,store_id:tenant.siteId,product_id:ids[0],subdomain:tenant.subdomain,download_url:apiOrigin+'/__owned__/downloads',model_filename:`synthetic-owned-model-${owned.runId}.gltf`,binary_model_filename:`synthetic-owned-binarymodel-${owned.runId}.glb`,video_filename:`synthetic-owned-video-${owned.runId}.mov`,webm_filename:`synthetic-owned-webm-${owned.runId}.webm`,source_sha256:sourceHash},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.info('OWNED_LOCAL_IOS_READY '+ready);
  const marker=async(name:string)=>{const end=Date.now()+1200000;while(!existsSync(join(root,name))&&Date.now()<end){checkUi();await new Promise(r=>setTimeout(r,300));}assert(existsSync(join(root,name)),'Missing normal iOS phase '+name);const value=JSON.parse(readFileSync(join(root,name),'utf8'));assert.equal(value.run_id,owned.runId);return value;};
  await marker('native-ios-auth-verified.json');assert(calls.some(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/stores'&&c.status===200),'Normal native cookie must reach the BFF and Gateway');
  await marker('native-media-imported.json');
  const mediaRows=()=>JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(m ORDER BY created_at),'[]'::jsonb)FROM media m WHERE store_id='${tenant.siteId}'AND deleted_at IS NULL`));
  const rows=mediaRows();assert.equal(rows.length,2);const mov=rows.find((m:{mime_type:string})=>m.mime_type==='video/quicktime'),webm=rows.find((m:{mime_type:string})=>m.mime_type==='video/webm');assert(mov&&webm);
  assert.equal(mov.original_name,`synthetic-owned-video-${owned.runId}.mov`);assert.equal(webm.original_name,`synthetic-owned-webm-${owned.runId}.webm`);assert.equal(mov.caption,'Synthetic native MOV caption');assert.equal(webm.caption,'Synthetic native WebM caption');
  const bucket=await nativeGateway!.mf.getR2Bucket('R2_BUCKET'),objects=await bucket.list();assert.equal(objects.objects.length,2);const hashes:Record<string,string>={};
  for(const [row,file]of [[mov,'synthetic-owned-video.mov'],[webm,'synthetic-owned-video.webm']]as const){const obj=objects.objects.find(o=>row.url.endsWith(o.key));assert(obj);const bytes=Buffer.from(await(await bucket.get(obj.key))!.arrayBuffer());assert.equal(bytes.length,Number(row.size_bytes));hashes[row.mime_type]=digest(bytes);assert.equal(digest(bytes),digest(readFileSync(join(resolve(root,'..'),file))));}
  const uploads=calls.filter(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/upload'&&c.method==='POST');assert.equal(uploads.length,2);assert(uploads.every(c=>c.status===201&&c.wire_status===201));assert.equal(calls.filter(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/media'&&c.method==='POST'&&c.status===201).length,2);assert.equal(calls.filter(c=>c.asset_kind==='video'&&c.method==='GET').length,0,'No video byte fetch in passive listing');
  writeFileSync(join(root,'video-preview-ready.json'),JSON.stringify({run_id:owned.runId,accepted:true})+'\n',{mode:0o600,flag:'wx'});
  const preview=await marker('native-video-previewed.json');assert(preview.accepted);const ranges=calls.filter(c=>c.asset_kind==='video'&&c.method==='GET');assert(ranges.some(c=>c.path.endsWith('.mov'))&&ranges.some(c=>c.path.endsWith('.webm')));assert(ranges.every(c=>c.range?c.status===206&&!!c.content_range:c.status===200));
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/gallery');const card=page.locator('article').filter({hasText:webm.filename});await expect(card).toHaveCount(1);await card.getByRole('button',{name:'Edit details',exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit media details',exact:true});await expect(editor.getByLabel('Caption',{exact:true})).toHaveValue('Synthetic native WebM caption');await editor.getByLabel('Caption',{exact:true}).fill('Synthetic web WebM caption');await editor.getByRole('button',{name:'Save media details',exact:true}).click();await expect(editor).toBeHidden();await page.screenshot({path:join(root,'web-native-video-formats-readback.png'),fullPage:true});
  writeFileSync(join(root,'web-formats-updated.json'),JSON.stringify({run_id:owned.runId,accepted:true})+'\n',{mode:0o600,flag:'wx'});const ui=await marker('journey-done.json');assert(ui.accepted);assert.equal(mediaRows().find((m:{id:string})=>m.id===webm.id).caption,'Synthetic web WebM caption');assert.deepEqual(betaInventory(),initialBetaInventory);assert.equal(alphaRoster(),initialAlphaRoster);
  writeFileSync(join(root,'ios-video-formats-readback.json'),JSON.stringify({run_id:owned.runId,rows:mediaRows(),hashes,uploads:uploads.length,objects:objects.objects.length,video_requests:ranges,preview,ui,whole_features_accepted:0,scope:'Actual iOS Safari download and native Files MOV H264 and WebM VP8 imports, compiled BFF/Gateway/owned SQL/R2 byte equality, actual iOS AVPlayer MOV and in-app WebKit WebM playback controls and web-to-native caption readback. Not all codecs, physical device or full122 acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  checkSource(source,'iOS UI readback');
 }finally{
  writeFileSync(join(root,'web-diagnostics.json'),JSON.stringify({run_id:owned.runId,webDiagnostics})+'\n',{mode:0o600,flag:'wx'});
  writeFileSync(join(root,'owned-rest-status-observed.json'),JSON.stringify({run_id:owned.runId,scope:'Table/method/status/latency only; no headers,queries,payloads,credentials,object keys or private URLs',restObservations})+'\n',{mode:0o600,flag:'wx'});
  try{writeFileSync(join(root,'observed-calls.json'),JSON.stringify({run_id:owned.runId,calls,challenge_counts:challenge.counts,notice:'Transport observations only. Inspect the runner verdict and UI evidence for acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});}catch{}
  if(existsSync(ready))writeFileSync(ready,JSON.stringify({run_id:owned.runId,udid:receipt.udid,credentials_retired:true,scope:'Synthetic login inputs removed after this local run.'})+'\n',{mode:0o600});
  writeFileSync(join(root,'wire-ingress-observed.json'),JSON.stringify({run_id:owned.runId,scope:'Exact owned loopback HTTP request-arrival/status observations;no credentials,headers or payloads',wireIngress})+'\n',{mode:0o600,flag:'wx'});
  try{execFileSync('xcrun',['simctl','terminate',receipt.udid,'com.letbuyy.store'],{stdio:'ignore'});}catch{}
  await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await nativeBff?.settle();await gateway?.settle();await closePooledSqlClients();await proxy.stop();await challenge.close();
  globalThis.fetch=originalFetch;
  for(const server of [api,bff])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
