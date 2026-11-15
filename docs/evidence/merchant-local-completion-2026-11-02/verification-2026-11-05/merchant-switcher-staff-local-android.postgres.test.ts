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
import {chromium,expect,type Browser} from '@playwright/test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import mobileBff from '../../../../services/mobile-bff/src/index';
import {hashMerchantPassword} from '../../../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
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
test('current StoreSwitcher restores two real memberships and syncs settings while live staff access is revoked',{timeout:1_800_000},async(context)=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit task-owned emulator receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8'))as {root:string;owner:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;adb_port:number;run_root:string;flow?:'membership'|'category'|'settings'|'warehouse';verifyDashboardSettings?:boolean;verifySmart?:boolean;verifyCollectionLifecycle?:boolean;verifyMembershipRetirement?:boolean;verifyStockLifecycle?:boolean;verifyStockAdjustments?:boolean;compiledWorkers?:boolean;diagnosticWarehouseDraft?:boolean;diagnosticReservationView?:boolean;offlineGradle?:boolean};
 const flow=receipt.flow??'membership';assert(['membership','category','settings','warehouse'].includes(flow));const categoryFlow=flow==='category',settingsFlow=flow==='settings',warehouseFlow=flow==='warehouse';
 const diagnosticDraft=receipt.diagnosticWarehouseDraft===true;assert(!diagnosticDraft||warehouseFlow,'Draft diagnostic is local warehouse-only');
 const verifyStock=receipt.verifyStockLifecycle===true;assert(!verifyStock||warehouseFlow,'Stock lifecycle extends the existing warehouse journey only');
 const verifyStockAdjustments=receipt.verifyStockAdjustments===true;assert(!verifyStockAdjustments||verifyStock,'Setter synchronization requires the normal warehouse stock lifecycle');
 const compiledWorkers=receipt.compiledWorkers===true;assert(!compiledWorkers||warehouseFlow,'Compiled Worker verification is currently bounded to warehouse flows');
 const diagnosticReservation=receipt.diagnosticReservationView===true;assert(!diagnosticReservation||(warehouseFlow&&!verifyStock&&!diagnosticDraft),'Reservation diagnostic is a separate read-only warehouse fixture');
 const verifySmart=receipt.verifySmart===true;assert(!verifySmart||flow==='membership','Smart verification extends the membership journey only');
 const verifyLifecycle=receipt.verifyCollectionLifecycle===true;assert(!verifyLifecycle||verifySmart,'Collection lifecycle requires the native/web Smart journey');
 const verifyRetirement=receipt.verifyMembershipRetirement===true;assert(!verifyRetirement||flow==='membership'&&!verifySmart&&!verifyLifecycle,'Retired membership is a distinct bounded membership journey');
 assert.equal(receipt.owner,'merchant-mobile-local-completion');assert.match(receipt.root,/^\/private\/tmp\/letbuyy-merchant-emulator-[a-z0-9]+$/);assert.equal(realpathSync(receipt.root),receipt.root);
 const ownership=JSON.parse(readFileSync(join(receipt.root,'ownership.json'),'utf8'))as {owner:string;root:string;name:string};
 assert.equal(ownership.owner,'merchant-mobile-parity');assert.equal(ownership.root,receipt.root);assert.equal(ownership.name,receipt.avd_name);assert.equal(receipt.serial,'emulator-5580');assert.equal(receipt.adb_port,15038);
 assert.equal(receipt.sdk_root,'/Volumes/Developer Tools/SDKs/android-sdk');process.kill(receipt.emulator_pid,0);
 const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port 5580'));
 const hardware=readFileSync(join(receipt.root,'avds',receipt.avd_name+'.avd','hardware-qemu.ini'),'utf8');
 for(const part of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert(hardware.split('\n').find(l=>l.startsWith(part+' = '))?.split(' = ')[1]?.startsWith(receipt.root+'/avds/'+receipt.avd_name+'.avd/'));
 const adbBinary=join(receipt.sdk_root,'platform-tools/adb');
 const adb=(...args:string[])=>execFileSync(adbBinary,['-P',String(receipt.adb_port),'-s',receipt.serial,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 assert.equal(adb('emu','avd','name').trim().split(/\r?\n/)[0],receipt.avd_name);
 const root=resolve(receipt.run_root);assert.match(root,/^\/private\/tmp\/letbuyy-merchant-local-[a-z0-9-]+\/native-(?:catalog|category|settings|warehouse)-v\d+$/);assert.equal(root.includes('/native-category-'),categoryFlow);assert.equal(root.includes('/native-settings-'),settingsFlow);assert.equal(root.includes('/native-warehouse-'),warehouseFlow);assert.equal(existsSync(root),false,'fresh owned run directory required');mkdirSync(root,{mode:0o700});
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');
 const checkUi=()=>{context.signal.throwIfAborted();if(existsSync(join(root,'ui-attention.json')))throw new Error('The owned normal UI companion failed; private diagnostics retained.');};
 const apiPort=54352,bffPort=54350,identityPort=54351,merchantPort=54353;
 const apiOrigin=`http://127.0.0.1:${apiPort}`,identityWireOrigin=`http://localhost:${identityPort}`,identityOrigin='http://localhost:9002',merchantOrigin=`http://localhost:${merchantPort}`;
 const challenge=await createLocalTurnstileProvider(owned);challenge.enableNativeSdk([identityOrigin]);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=createOwnedProviderFetch(originalFetch,challenge.profile,[9002]);
 const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
 const env=gatewayEnv(owned,keys,{ENVIRONMENT:'development',LETBUYY_IDENTITY_ISSUER:identityOrigin,APP_ENV:'development',...proxy.env()});
 let nativeGateway:NativeGateway|undefined;
 let gateway:Pick<Gateway,'request'|'settle'>|undefined;
 const tenant=newSyntheticTenant('native-catalog'),owner=randomUUID(),email=`syn-native-catalog-${owner}@example.invalid`,password=randomUUID().replaceAll('-','')+String.fromCharCode(65,97,49,33),hash=await hashMerchantPassword(password);
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
 type Call={source:string;path:string;method:string;status:number;wire_status:number;key_digest?:string;body_digest?:string};const calls:Call[]=[];let lost=false,lostSmart=false;let lostSettingsKey:string|undefined;

 const betaTenant=newSyntheticTenant('native-switcher-beta'), betaOwner=randomUUID(), betaEmail=`syn-beta-owner-${betaOwner}@example.invalid`;
 seedSyntheticTenant(owned.psql,betaTenant);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${betaOwner}','${betaEmail}',true,'Synthetic Beta Owner','${hash}');
 UPDATE sites SET name='Synthetic Alpha' WHERE id='${tenant.siteId}';
 UPDATE sites SET name='Synthetic Beta',custom_user_id='${betaOwner}' WHERE id='${betaTenant.siteId}';`);

 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url),body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
  const result=await gateway!.request(url.pathname+url.search,{method:request.method,headers:request.headers,...(body?{body}:{})});
  calls.push({source,path:url.pathname,method:request.method,status:result.status,wire_status:result.status});
  return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body?{body}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_UNAVAILABLE"}}');}
 });
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 let nativeBff:NativeMobileBff|undefined;
 let api:Server|undefined,bff:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Browser|undefined,nativeBrowser:Browser|undefined;
 let nativeForward:number|undefined;
 const reversed:number[]=[];
 try{
  nativeGateway=compiledWorkers?await NativeGateway.create(env as unknown as Record<string,unknown>,async()=>{throw new Error('No email provider call belongs to this owned warehouse story');}):undefined;
  const currentNative=nativeGateway;
  gateway=currentNative?{
  async request(path,init={}){const response=await currentNative.dispatch(path,init);const text=await response.text();let json:Awaited<ReturnType<Gateway['request']>>['json']=null;try{const parsed:unknown=JSON.parse(text);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))json=parsed as NonNullable<Awaited<ReturnType<Gateway['request']>>['json']>;}catch{/* Keep real non-JSON replies available for assertion. */}return{status:response.status,headers:new Headers(Object.fromEntries(response.headers.entries())),text,json};},
  settle:()=>currentNative.settle(),
 }:new Gateway(env);
 if(nativeGateway)writeFileSync(join(root,'compiled-gateway.mjs'),nativeGateway.compiledScript,{mode:0o600,flag:'wx'});

 const provision=await gateway.request('/v1/employees',{method:'POST',headers:{...await signedIdentityHeaders(betaOwner,betaEmail,betaTenant.siteId),'X-Idempotency-Key':randomUUID()},body:JSON.stringify({store_id:betaTenant.siteId,email,full_name:'Synthetic Multi Store Actor',role:'manager',permissions:{granted:['products:read','products:write','settings:read','settings:write']}})});
 assert.equal(provision.status,201,provision.text);const employeeId=provision.json!.data.id;
 const discovery=await gateway.request('/v1/stores?limit=50',{headers:await signedIdentityHeaders(owner,email)});
 assert.equal(discovery.status,200,discovery.text);assert.deepEqual(discovery.json!.data.map((x:{id:string})=>x.id).sort(),[tenant.siteId,betaTenant.siteId].sort());
  if(compiledWorkers){
   nativeBff=await NativeMobileBff.create({INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development'},request=>record(request,'actual-mobile-bff'),globalThis.fetch);
   writeFileSync(join(root,'compiled-mobile-bff.mjs'),nativeBff.compiledScript,{mode:0o600,flag:'wx'});
   writeFileSync(join(root,'compiled-workers.json'),JSON.stringify({run_id:owned.runId,runtime:'workerd',gateway_sha256:digest(nativeGateway!.compiledScript),bff_sha256:digest(nativeBff.compiledScript),entrypoints:['services/api-gateway/src/index.ts','services/mobile-bff/src/index.ts'],transport:'Owned Node HTTP and service-binding observer; no business response stubs',hosted:false})+'\n',{mode:0o600,flag:'wx'});
  }
  api=bridge(req=>record(req,'actual-identity'));bff=bridge(async req=>nativeBff?await nativeBff.dispatch(req) as unknown as Response:mobileBff.fetch(req,bffEnv as never));
  for(const [server,port]of [[api,apiPort],[bff,bffPort]]as const)await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:challenge.profile,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED:'true',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:randomUUID()+randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+360_000;let live=false;while(Date.now()<deadline){if(identity.exitCode!==null)throw new Error('Owned issuer stopped');try{if(!ownedNextListener(identityPort,identity)){await new Promise(r=>setTimeout(r,250));continue;}if((await fetch(identityWireOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(live,'normal issuer readiness');
  const defines={ENVIRONMENT:'local',BFF_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,API_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,IDENTITY_BASE_URL:identityOrigin,ADMIN_BASE_URL:merchantOrigin,STOREFRONT_BASE_URL:'http://localhost:54354',LOCAL_CHALLENGE_SDK_URL:challenge.profile.origin+'/fixtures/turnstile/api.js',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',MOBILE_PUSH_DEVICE_TOKEN:'',SENTRY_DSN:'SKIP_NEEDS_HUMAN_LOCAL_SENTRY_DSN'};
  const definesPath=join(root,'dart-defines.json');writeFileSync(definesPath,JSON.stringify(defines),{mode:0o600,flag:'wx'});
  const source=sourceSnapshot(),sourceBytes=JSON.stringify(source),sourceHash=digest(sourceBytes);
  writeFileSync(join(root,'source-snapshot.json'),sourceBytes+'\n',{mode:0o600,flag:'wx'});
  // The build is source-only and owned; never run this lane concurrently with
  // another heavy qualification. Its resulting APK must be installed read back.
  const buildLog=join(root,'android-build.log'),fd=openSync(buildLog,'wx',0o600);
  try{
   const runBuild=async(command:string,args:string[],cwd:string)=>{
    const child=spawn(command,args,{cwd,env:{...process.env,ANDROID_HOME:receipt.sdk_root,ANDROID_SDK_ROOT:receipt.sdk_root},stdio:['ignore',fd,fd]});
    const exit=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);context.signal.addEventListener('abort',()=>child.kill('SIGTERM'),{once:true});});assert.equal(exit,0,'owned Android build must pass; inspect private build log');
   };
   await runBuild('/Volumes/Developer Tools/SDKs/flutter/bin/flutter',['build','apk','--debug','--no-pub',...(receipt.offlineGradle?['--config-only']:[]),'--target-platform','android-arm64','--dart-define-from-file='+definesPath],resolve('apps/merchant/mobile'));
   if(receipt.offlineGradle){
    // Explicit local-only build using cached dependencies. Flutter performs its
    // normal configuration first; Gradle compiles the same app/defines offline.
    // No TLS bypass, SDK/cache modification, dependency substitution or old APK.
    const encoded=Object.entries(defines).map(([name,value])=>Buffer.from(name+'='+value).toString('base64')).join(',');
    await runBuild(resolve('apps/merchant/mobile/android/gradlew'),['--offline','-q','-Ptarget-platform=android-arm64','-Ptarget=lib/main.dart','-Pbase-application-name=android.app.Application','-Pdart-defines='+encoded,'-Pdart-obfuscation=false','-Ptrack-widget-creation=true','-Ptree-shake-icons=false','assembleDebug'],resolve('apps/merchant/mobile/android'));
   }
  }finally{closeSync(fd);}
  checkSource(source,'native build');
  const builtApk=resolve('apps/merchant/mobile/build/app/outputs/flutter-apk/app-debug.apk');
  const artifactRoot=join(root,'qualified-artifact');mkdirSync(artifactRoot,{mode:0o700});
  const apk=join(artifactRoot,'merchant-local-debug.apk');copyFileSync(builtApk,apk,constants.COPYFILE_EXCL);chmodSync(apk,0o600);
  const apkHash=digest(readFileSync(apk));assert.equal(digest(readFileSync(builtApk)),apkHash,'preserve the original built bytes before installation');
  for(const port of [apiPort,bffPort,Number(new URL(challenge.profile.origin).port)]){adb('reverse','--no-rebind',`tcp:${port}`,`tcp:${port}`);reversed.push(port);}
  //9002 exists only on this emulator. Never bind, probe or stop the Mac's
  // existing9002 listener; all server-process fetches to it are explicitly denied.
  assert(!adb('reverse','--list').split(/\r?\n/).some(line=>line.split(/\s+/).includes('tcp:9002')),'An unrelated emulator9002 mapping must be preserved');
  adb('reverse','--no-rebind','tcp:9002',`tcp:${identityPort}`);reversed.push(9002);
  adb('shell','am','force-stop','com.letbuyy.store');adb('install','-r',apk);
  const installed=adb('shell','pm','path','com.letbuyy.store').trim().replace(/^package:/,'');assert(installed.startsWith('/data/app/'));assert.equal(adb('shell','sha256sum',installed).trim().split(/\s+/)[0],apkHash);
  writeFileSync(join(root,'artifact.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk,source_build_path:builtApk,original_bytes_retained:true,sha256:apkHash,defines,build_method:receipt.offlineGradle?'flutter-config-only-then-offline-gradle-debug':'flutter-build-apk-debug',installed_readback:true,scope:'Local debug artifact only; no hosted/provider/release certification.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  // Start only the task emulator's installed OS browser on an empty page.
  // The local one-use challenge fixture is attached before any Accounts URL
  // opens. Credential entry and callback completion remain ordinary Android UI.
  writeFileSync(join(root,'browser-preflight.json'),JSON.stringify({run_id:owned.runId,serial:receipt.serial,stage:'Preparing task Chrome on about:blank; no credentials entered.'})+'\n',{mode:0o600,flag:'wx'});
  adb('shell','am','start','-a','android.intent.action.VIEW','-d','about:blank','-p','com.android.chrome');
  nativeForward=Number(adb('forward','tcp:0','localabstract:chrome_devtools_remote').trim());assert(Number.isInteger(nativeForward)&&nativeForward>1024);
  const chromeDeadline=Date.now()+120000;let browserConnected=false;
  while(Date.now()<chromeDeadline){
   checkUi();
   try{nativeBrowser=await chromium.connectOverCDP(`http://127.0.0.1:${nativeForward}`,{timeout:1500});browserConnected=true;break;}catch{await new Promise(r=>setTimeout(r,250));}
  }
  assert(browserConnected&&nativeBrowser,'Task Chrome remote fixture not ready; inspect its ordinary first-run UI without bypassing sign-in.');
  const nativeContext=nativeBrowser.contexts()[0];assert(nativeContext,'Task Chrome context required');
  await challenge.attachBrowser(nativeContext,[identityOrigin,merchantOrigin]);
  writeFileSync(join(root,'browser-network-ready.json'),JSON.stringify({run_id:owned.runId,serial:receipt.serial,accounts_origin:identityOrigin,host_wire_origin:identityWireOrigin,host9002Blocked:true,localChallengeFixtureOnly:true})+'\n',{mode:0o600,flag:'wx'});
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,adb_port:receipt.adb_port,email,password,flow,verify_smart:verifySmart,category_id:category,collection_id:collection,store_id:tenant.siteId,expected_ids:[ids[1],ids[0]],beta_store_id:betaTenant.siteId,alpha_name:'Synthetic Alpha',beta_name:'Synthetic Beta',apk_sha256:apkHash},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.info('OWNED_LOCAL_ANDROID_READY '+ready);

 const marker=async(name:string)=>{const deadline=Date.now()+600_000;while(!existsSync(join(root,name))){checkUi();process.kill(receipt.emulator_pid,0);assert(Date.now()<deadline,'Paired native marker unavailable: '+name);await new Promise(r=>setTimeout(r,300));}const value=JSON.parse(readFileSync(join(root,name),'utf8'));assert.equal(value.run_id,owned.runId);return value;};
 await marker('native-two-stores.json');
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  const webDeadline=Date.now()+360_000;let webLive=false;while(Date.now()<webDeadline){if(merchant.exitCode!==null)throw new Error('Owned Merchant stopped');try{if(!ownedNextListener(merchantPort,merchant)){await new Promise(r=>setTimeout(r,250));continue;}if((await fetch(merchantOrigin,{redirect:'manual',signal:AbortSignal.timeout(2000)})).status<500){webLive=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(webLive);
  browser=await chromium.launch({headless:true});const web=await browser.newContext();await challenge.attachBrowser(web,[identityOrigin,merchantOrigin]);
  await web.route(identityOrigin+'/**',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,identityOrigin);
   const response=await route.fetch({url:identityWireOrigin+url.pathname+url.search,maxRedirects:0,headers:{...route.request().headers(),host:new URL(identityOrigin).host}});
   await route.fulfill({response});
  });const page=await web.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(90_000);
  await page.goto(identityOrigin+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL(url=>url.origin===merchantOrigin);

 const settingsPath=`/api/stores/${betaTenant.subdomain}/settings`;
 await page.goto(merchantOrigin+'/'+betaTenant.subdomain+'/settings/general');
 await expect(page.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic Beta mobile');
 assert.equal(owned.psql(`SELECT name FROM sites WHERE id='${tenant.siteId}'`),'Synthetic Alpha');
 await page.getByRole('textbox',{name:'Store name',exact:true}).fill('Synthetic Beta web');
 const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===settingsPath&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);assert.equal(saved.status(),200,await saved.text());
 await expect(page.getByText('Settings saved',{exact:true})).toBeVisible();await page.screenshot({path:join(root,'web-beta-read-native-and-save.png'),fullPage:true});
 writeFileSync(join(root,'web-beta-updated.json'),JSON.stringify({run_id:owned.runId,expected_name:'Synthetic Beta web'})+'\n',{mode:0o600,flag:'wx'});
 await marker('native-beta-web-restart.json');
 const betaWeb=await browser.newContext();await challenge.attachBrowser(betaWeb,[identityOrigin,merchantOrigin]);
 await betaWeb.route(identityOrigin+'/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:identityWireOrigin+url.pathname+url.search,maxRedirects:0,headers:{...route.request().headers(),host:new URL(identityOrigin).host}});await route.fulfill({response});});
 const ownerPage=await betaWeb.newPage();ownerPage.setDefaultTimeout(30_000);ownerPage.setDefaultNavigationTimeout(90_000);
 await ownerPage.goto(identityOrigin+'/login');await expect(ownerPage.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);await ownerPage.getByLabel('Email',{exact:true}).fill(betaEmail);await ownerPage.getByRole('button',{name:'Continue with email',exact:true}).click();await ownerPage.getByLabel('Password',{exact:true}).fill(password);await ownerPage.getByRole('button',{name:'Log in',exact:true}).click();await ownerPage.waitForURL(url=>url.origin===merchantOrigin);
 await ownerPage.goto(merchantOrigin+'/'+betaTenant.subdomain+'/settings/users');
 await expect(ownerPage.getByRole('combobox',{name:`Role for ${email}`,exact:true})).toHaveValue('manager');
 const [downgraded]=await Promise.all([ownerPage.waitForResponse(r=>r.url().endsWith('/users/'+employeeId)&&r.request().method()==='PATCH'),ownerPage.getByRole('combobox',{name:`Role for ${email}`,exact:true}).selectOption('viewer')]);assert.equal(downgraded.status(),200,await downgraded.text());
 writeFileSync(join(root,'web-staff-downgraded.json'),JSON.stringify({run_id:owned.runId})+'\n',{mode:0o600,flag:'wx'});
 await marker('native-downgrade-denied.json');
 assert.equal(owned.psql(`SELECT name FROM sites WHERE id='${betaTenant.siteId}'`),'Synthetic Beta web');
 await ownerPage.getByRole('button',{name:`Remove ${email}`,exact:true}).click();const [removed]=await Promise.all([ownerPage.waitForResponse(r=>r.url().endsWith('/users/'+employeeId)&&r.request().method()==='DELETE'),ownerPage.getByRole('button',{name:'Remove staff',exact:true}).click()]);assert.equal(removed.status(),200,await removed.text());
 const denied=await web.request.get(merchantOrigin+settingsPath);assert.ok([403,404].includes(denied.status()),await denied.text());
 assert.equal((await web.request.get(merchantOrigin+`/api/stores/${tenant.subdomain}/settings`)).status(),200);
 writeFileSync(join(root,'web-staff-removed.json'),JSON.stringify({run_id:owned.runId})+'\n',{mode:0o600,flag:'wx'});
 const proof=await marker('native-revoked-store-retired.json');assert.ok(proof.evidence.length>=1);
 for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
 assert.equal(owned.psql(`SELECT status||'|'||role||'|'||is_active FROM employees WHERE id='${employeeId}'`),'removed|viewer|false');
 for(const action of ['employee.created','employee.updated','employee.removed'])assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='${action}' AND resource_id='${employeeId}'`),'1');
 assert(calls.some(c=>c.source==='actual-mobile-bff'&&c.path===`/v1/stores/${betaTenant.siteId}`&&c.method==='PATCH'&&c.status===200));
 assert(calls.some(c=>c.source==='actual-mobile-bff'&&c.path===`/v1/stores/${betaTenant.siteId}`&&c.method==='PATCH'&&c.status===403));
 checkSource(source,'two-store settings sync and live staff revocation');
 writeFileSync(join(root,'switcher-staff-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,fixture_sha256:digest(readFileSync(new URL(import.meta.url))),apk_sha256:apkHash,calls,scope:'Normal local Android and web Accounts login; two real owned/staff memberships, current switcher, preference restart, bidirectional saved store name, live staff downgrade rejection and removal discovery. No invitation send/consent/inbox, iOS runtime, real provider, hosted, release or full122 acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
 }finally{
  try{writeFileSync(join(root,'observed-calls.json'),JSON.stringify({run_id:owned.runId,calls,challenge_counts:challenge.counts,notice:'Transport observations only. Inspect the runner verdict and UI evidence for acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});}catch{}
  if(existsSync(ready))writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,credentials_retired:true,scope:'Synthetic login inputs removed after this local run.'})+'\n',{mode:0o600});
  // Stop only our foreground package. Retain emulator and all account namespaces.
  try{adb('shell','am','force-stop','com.letbuyy.store');}catch{}
  for(const port of reversed)try{adb('reverse','--remove',`tcp:${port}`);}catch{}
  await nativeBrowser?.close();
  if(nativeForward!==undefined)try{adb('forward','--remove',`tcp:${nativeForward}`);}catch{}
  await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await nativeBff?.settle();await gateway?.settle();await closePooledSqlClients();await proxy.stop();await challenge.close();
  globalThis.fetch=originalFetch;
  for(const server of [api,bff])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
