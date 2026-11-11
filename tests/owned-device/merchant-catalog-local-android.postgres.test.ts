// Explicit local-only emulator/Simulator lane, selected outside normal CI. Normal native
// sign-in is required; this fixture never supplies an APK session or JWT.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync,openSync,closeSync,copyFileSync,chmodSync,constants,readdirSync,lstatSync,readlinkSync} from 'node:fs';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {exportJWK} from 'jose';
import {chromium,expect,type Browser} from '@playwright/test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {merchantNativeCallback} from '@letbuyy/auth-core';
import mobileBff from '../../services/mobile-bff/src/index';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from '../fixtures/local-turnstile-provider';
import {createOwnedProviderFetch} from '../../scripts/governance/owned-provider-network.mjs';
import {validateOwnedNextDirectoryReceipt} from '../../scripts/governance/owned-next-directory.mjs';
import {NativeGateway} from '../helpers/native-owned-gateway';
import {NativeMobileBff} from '../helpers/native-owned-mobile-bff';
const owned=requireOwnedDatabase();
const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
function nativeBundleSnapshot(root:string){
 const entries:Array<{path:string;kind:'file';sha256:string}|{path:string;kind:'symlink';target:string}>=[];
 const visit=(folder:string)=>{for(const name of readdirSync(join(root,folder)).sort()){
  const path=folder?folder+'/'+name:name,absolute=join(root,path),stat=lstatSync(absolute);
  if(stat.isSymbolicLink()){
   const target=readlinkSync(absolute);assert(!isAbsolute(target)&&resolve(dirname(absolute),target).startsWith(root+'/'),'native bundle links must remain inside the delivered app');
   entries.push({path,kind:'symlink',target});
  }else if(stat.isDirectory())visit(path);
  else{assert(stat.isFile(),'the delivered native bundle contains only regular files and internal links');entries.push({path,kind:'file',sha256:digest(readFileSync(absolute))});}
 }};
 visit('');return entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function sourceSnapshot(){
 const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','apps/merchant/mobile','apps/commerce/web','apps/merchant/web','apps/platform/identity','services/api-gateway','services/mobile-bff','packages','database/supabase/migrations','database/supabase/rollback','database/supabase/config.toml','scripts/governance','tests/fixtures','tests/helpers','tests/owned-device/merchant-catalog-local-android.postgres.test.ts','pubspec.yaml','pubspec.lock'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
 return paths.filter(path=>{
  const marker=/^apps\/(?:commerce\/web|merchant\/web|platform\/identity)\/\.next-session-runtime-(\d+)-((?:identity|merchant|commerce)-next-production)\.owner\.json$/.exec(path);
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
// The ten-theme native lane includes ten real demo/editor journeys plus the
// saved-design release journey. Keep that interactive gate bounded at one hour.
test('normal local Merchant owned-device journey verifies authoritative results through actual BFF',{timeout:3_600_000},async(context)=>{
 const receiptPath=process.env.LETBUYY_IOS_DEVICE_RECEIPT??process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit task-owned device receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8'))as {root:string;owner:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;adb_port:number;run_root:string;platform?:'android'|'ios';simulator_udid?:string;simulator_name?:string;device_receipt?:string;flow?:'membership'|'category'|'settings'|'warehouse'|'kyc'|'camera'|'themes'|'ios-auth'|'ios-kyc'|'ios-themes';verifyDashboardSettings?:boolean;verifySmart?:boolean;verifyCollectionLifecycle?:boolean;verifyMembershipRetirement?:boolean;verifyStockLifecycle?:boolean;verifyStockAdjustments?:boolean;compiledWorkers?:boolean;diagnosticWarehouseDraft?:boolean;diagnosticReservationView?:boolean;offlineGradle?:boolean};
 const flow=receipt.flow??'membership';assert(['membership','category','settings','warehouse','kyc','camera','themes','ios-auth','ios-kyc','ios-themes'].includes(flow));const iosThemesFlow=flow==='ios-themes',iosKycFlow=flow==='ios-kyc',iosFlow=flow==='ios-auth'||iosKycFlow||iosThemesFlow;assert.equal(receipt.platform==='ios',iosFlow,'iOS requires its explicit bounded flow');const themeFlow=flow==='themes'||iosThemesFlow,categoryFlow=flow==='category',settingsFlow=flow==='settings',warehouseFlow=flow==='warehouse',kycFlow=flow==='kyc',cameraFlow=flow==='camera',privateKycFlow=kycFlow||iosKycFlow;
 const diagnosticDraft=receipt.diagnosticWarehouseDraft===true;assert(!diagnosticDraft||warehouseFlow,'Draft diagnostic is local warehouse-only');
 const verifyStock=receipt.verifyStockLifecycle===true;assert(!verifyStock||warehouseFlow,'Stock lifecycle extends the existing warehouse journey only');
 const verifyStockAdjustments=receipt.verifyStockAdjustments===true;assert(!verifyStockAdjustments||verifyStock,'Setter synchronization requires the normal warehouse stock lifecycle');
 const compiledWorkers=receipt.compiledWorkers===true;assert(!compiledWorkers||warehouseFlow,'Compiled Worker verification is currently bounded to warehouse flows');
 const diagnosticReservation=receipt.diagnosticReservationView===true;assert(!diagnosticReservation||(warehouseFlow&&!verifyStock&&!diagnosticDraft),'Reservation diagnostic is a separate read-only warehouse fixture');
 const verifySmart=receipt.verifySmart===true;assert(!verifySmart||flow==='membership','Smart verification extends the membership journey only');
 const verifyLifecycle=receipt.verifyCollectionLifecycle===true;assert(!verifyLifecycle||verifySmart,'Collection lifecycle requires the native/web Smart journey');
 const verifyRetirement=receipt.verifyMembershipRetirement===true;assert(!verifyRetirement||flow==='membership'&&!verifySmart&&!verifyLifecycle,'Retired membership is a distinct bounded membership journey');
 assert.equal(receipt.owner,'merchant-mobile-local-completion');
 const sim=(...args:string[])=>execFileSync('xcrun',['simctl',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(iosFlow){
  assert.match(receipt.root,/^\/private\/tmp\/letbuyy-merchant-ios-[a-z0-9]+$/);assert.equal(realpathSync(receipt.root),receipt.root);
  assert(receipt.simulator_udid&&receipt.simulator_name&&receipt.device_receipt,'explicit owned Simulator identity required');
  const ownerReceipt=JSON.parse(readFileSync(receipt.device_receipt,'utf8'))as {udid:string;name:string;owner:string};
  const owner=JSON.parse(readFileSync(join(receipt.root,'ownership.json'),'utf8'))as {mission:string;udid:string;name:string};
  assert.equal(ownerReceipt.owner,'LetBuyy mission-211355');assert.equal(owner.mission,'mission-211355');
  assert.equal(ownerReceipt.udid,receipt.simulator_udid);assert.equal(owner.udid,receipt.simulator_udid);assert.equal(ownerReceipt.name,receipt.simulator_name);assert.equal(owner.name,receipt.simulator_name);
  const devices=JSON.parse(sim('list','devices','--json'))as {devices:Record<string,Array<{udid:string;name:string;state:string}>>};
  const found=Object.values(devices.devices).flat().filter(device=>device.udid===receipt.simulator_udid);assert.equal(found.length,1);assert.equal(found[0].name,receipt.simulator_name);assert.equal(found[0].state,'Booted');
 }else{
 assert.match(receipt.root,/^\/private\/tmp\/letbuyy-merchant-emulator-[a-z0-9]+$/);assert.equal(realpathSync(receipt.root),receipt.root);
 const ownership=JSON.parse(readFileSync(join(receipt.root,'ownership.json'),'utf8'))as {owner:string;root:string;name:string};
 assert.equal(ownership.owner,'merchant-mobile-parity');assert.equal(ownership.root,receipt.root);assert.equal(ownership.name,receipt.avd_name);assert.equal(receipt.serial,'emulator-5580');assert.equal(receipt.adb_port,15038);
 assert.equal(receipt.sdk_root,'/Volumes/Developer Tools/SDKs/android-sdk');process.kill(receipt.emulator_pid,0);
 const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port 5580'));
 const hardware=readFileSync(join(receipt.root,'avds',receipt.avd_name+'.avd','hardware-qemu.ini'),'utf8');
 for(const part of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert(hardware.split('\n').find(l=>l.startsWith(part+' = '))?.split(' = ')[1]?.startsWith(receipt.root+'/avds/'+receipt.avd_name+'.avd/'));
 assert.equal(execFileSync(join(receipt.sdk_root,'platform-tools/adb'),['-P',String(receipt.adb_port),'-s',receipt.serial,'emu','avd','name'],{encoding:'utf8'}).trim().split(/\r?\n/)[0],receipt.avd_name);
 }
 const adbBinary=join(receipt.sdk_root??'','platform-tools/adb');
 const adb=(...args:string[])=>{assert(!iosFlow,'Android operations are forbidden in the iOS lane');return execFileSync(adbBinary,['-P',String(receipt.adb_port),'-s',receipt.serial,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});};
 const root=resolve(receipt.run_root);assert.match(root,/^\/private\/tmp\/letbuyy-merchant-local-[a-z0-9-]+\/native-(?:catalog|category|settings|warehouse|kyc|camera|themes|ios-auth|ios-kyc|ios-themes)-v\d+$/);assert.equal(root.includes('/native-category-'),categoryFlow);assert.equal(root.includes('/native-settings-'),settingsFlow);assert.equal(root.includes('/native-warehouse-'),warehouseFlow);assert.equal(root.includes('/native-kyc-'),kycFlow);assert.equal(root.includes('/native-camera-'),cameraFlow);assert.equal(root.includes('/native-themes-')||root.includes('/native-ios-themes-'),themeFlow);assert.equal(root.includes('/native-ios-auth-'),iosFlow&&!iosKycFlow&&!iosThemesFlow);assert.equal(root.includes('/native-ios-kyc-'),iosKycFlow);assert.equal(existsSync(root),false,'fresh owned run directory required');mkdirSync(root,{mode:0o700});
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');
 if(kycFlow||(iosFlow&&!iosThemesFlow))writeFileSync(join(root,'kyc-outage-active.json'),JSON.stringify({run_id:owned.runId,scope:'Owned synthetic KYC read fault only'})+'\n',{mode:0o600,flag:'wx'});
 const checkUi=()=>{context.signal.throwIfAborted();if(existsSync(join(root,'ui-attention.json')))throw new Error('The owned normal UI companion failed; private diagnostics retained.');};
 const apiPort=54352,bffPort=54350,identityPort=54351,merchantPort=54353;
 const apiOrigin=`http://127.0.0.1:${apiPort}`,identityWireOrigin=`http://localhost:${identityPort}`,identityOrigin=iosFlow?identityWireOrigin:'http://localhost:9002',merchantOrigin=`http://localhost:${merchantPort}`;
 const challenge=await createLocalTurnstileProvider(owned);challenge.enableNativeSdk([identityOrigin]);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=createOwnedProviderFetch(originalFetch,challenge.profile,[9002]);
 const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
 //Private R2 objects are permitted only by the existing ENVIRONMENT=test
 //fence, in this proven-owned synthetic database. No hosted intake is enabled.
 type PrivateKycDocument={id:string;document_type:string;status:string;metadata:{private_object_key:string;sha256:string;byte_size:number|string;[key:string]:unknown}};
 const privateObjects=new Map<string,Uint8Array>();
 const publicObjects=new Map<string,{bytes:Uint8Array;options?:R2PutOptions}>();
 let publicAssetReads=0,publicAssetCredentialAttempts=0;
 const publicBucket={
  put:async(key:string,value:ReadableStream<Uint8Array>,options?:R2PutOptions)=>{
   const bytes=new Uint8Array(await new Response(value).arrayBuffer());
   if(typeof options?.sha256==='string')assert.equal(digest(bytes),options.sha256);
   if(options?.onlyIf instanceof Headers&&options.onlyIf.get('if-none-match')==='*'&&publicObjects.has(key))return null;
   publicObjects.set(key,{bytes,options});return null;
  },
  head:async(key:string)=>{const object=publicObjects.get(key);return object?{key,size:object.bytes.length,customMetadata:object.options?.customMetadata,httpMetadata:object.options?.httpMetadata}:null;},
  delete:async(key:string)=>{publicObjects.delete(key);},
 };
 const env=gatewayEnv(owned,keys,{ENVIRONMENT:privateKycFlow||cameraFlow?'test':'development',LETBUYY_IDENTITY_ISSUER:identityOrigin,APP_ENV:'development',...proxy.env(),
  ...(cameraFlow?{R2_BUCKET:publicBucket,UPLOAD_PUBLIC_BASE_URL:'http://127.0.0.1:54355/assets'}:{}),
  ...(privateKycFlow?{KYC_UPLOAD_ENABLED:'true',KYC_PRIVATE_BUCKET:{
   put:async(key:string,bytes:Uint8Array)=>{privateObjects.set(key,new Uint8Array(bytes));},
   delete:async(key:string)=>{privateObjects.delete(key);},
  }}:{})});
 let nativeGateway:NativeGateway|undefined;
 let gateway:Pick<Gateway,'request'|'settle'>|undefined;
 const tenant=newSyntheticTenant('native-catalog'),owner=randomUUID(),email=`syn-native-catalog-${owner}@example.invalid`,password='Synthetic-native-catalog-'+randomUUID(),hash=await hashMerchantPassword(password);
 const collection=randomUUID(),ids=[randomUUID(),randomUUID()];
 seedSyntheticTenant(owned.psql,tenant);
 if(themeFlow)owned.psql(`UPDATE sites SET published=false,status='draft'WHERE id='${tenant.siteId}';`);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic Native Catalog Owner','${hash}');UPDATE sites SET custom_user_id='${owner}'WHERE id='${tenant.siteId}';
 INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${ids[0]}','${tenant.siteId}','${tenant.siteId}','Synthetic cotton tote','syn-native-${ids[0]}',100,4,true,'active'),('${ids[1]}','${tenant.siteId}','${tenant.siteId}','Synthetic blue shirt','syn-native-${ids[1]}',200,3,true,'active');
 INSERT INTO collections(id,store_id,title,is_active)VALUES('${collection}','${tenant.siteId}','Synthetic native collection',true);INSERT INTO collection_products(collection_id,product_id,position)VALUES('${collection}','${ids[0]}',0),('${collection}','${ids[1]}',1);`);
 if(verifyStock)owned.psql(`UPDATE products SET stock=0 WHERE store_id='${tenant.siteId}';`);
 if(diagnosticDraft)owned.psql(`UPDATE products SET stock=3 WHERE id='${ids[0]}';
 INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,incoming,available_quantity,reserved_quantity,on_hand_quantity)VALUES(gen_random_uuid(),'${tenant.siteId}','${ids[0]}','${tenant.locationId}',3,0,0,3,0,3);
 INSERT INTO inventory_locations(id,store_id,name,status)VALUES(gen_random_uuid(),'${tenant.siteId}','Synthetic diagnostic destination','active');`);
 if(settingsFlow)owned.psql(`UPDATE sites SET business_profile=coalesce(business_profile,'{}'::jsonb)||'{"email":"synthetic-contact@example.invalid","trade_name":"Retained synthetic trade"}'::jsonb,invoice_address=coalesce(invoice_address,'{}'::jsonb)||'{"attention":"Retained synthetic attention"}'::jsonb WHERE id='${tenant.siteId}';`);
 const originalCameraProducts=cameraFlow||iosFlow||themeFlow?owned.psql(`SELECT jsonb_agg(to_jsonb(p)ORDER BY id)::text FROM products p WHERE store_id='${tenant.siteId}'`):null;
 if(categoryFlow)owned.psql(`UPDATE products SET category='Synthetic native cotton'WHERE store_id='${tenant.siteId}';`);
 const category=categoryFlow?owned.psql(`SELECT id FROM product_categories WHERE store_id='${tenant.siteId}'AND name='Synthetic native cotton'AND deleted_at IS NULL`):null;
 type Call={source:string;path:string;method:string;status:number;wire_status:number;key_digest?:string;body_digest?:string};const calls:Call[]=[];const nativeThemeBaselines=new Map<string,Record<string,unknown>>();let lost=false,lostSmart=false;let lostSettingsKey:string|undefined,restartCallIndex:number|undefined;
 const record=async(request:Request,source:string)=>{
  assert(gateway,'The selected real Gateway runtime must be initialized');
  if((kycFlow||iosFlow)&&existsSync(join(root,'native-session-restart-started.json'))){
   assert.equal(JSON.parse(readFileSync(join(root,'native-session-restart-started.json'),'utf8')).run_id,owned.runId);restartCallIndex??=calls.length;
  }
  const url=new URL(request.url),bytes=['GET','HEAD'].includes(request.method)?undefined:new Uint8Array(await request.arrayBuffer());
  if(iosFlow&&source==='actual-mobile-bff'&&url.pathname.startsWith('/v1/kyc'))assert.equal(request.headers.get('X-Store-ID'),tenant.siteId,'actual native KYC transport must retain the selected store after account-scoped sign-in');
  const body=bytes?new TextDecoder().decode(bytes):undefined;
  if((kycFlow||iosFlow)&&source==='actual-mobile-bff'&&request.method==='GET'&&url.pathname==='/v1/kyc'&&existsSync(join(root,'kyc-outage-active.json'))){
   assert.equal(JSON.parse(readFileSync(join(root,'kyc-outage-active.json'),'utf8')).run_id,owned.runId);
   calls.push({source,path:url.pathname,method:request.method,status:503,wire_status:503});
   writeFileSync(join(root,'kyc-outage-served.json'),JSON.stringify({run_id:owned.runId,attempts:calls.filter(call=>call.source===source&&call.path==='/v1/kyc'&&call.status===503).length})+'\n',{mode:0o600});
   return Response.json({error:{code:'OWNED_KYC_READ_UNAVAILABLE',message:'Synthetic verification status unavailable. Retry loading.'}},{status:503});
  }
  const result=await gateway.request(url.pathname+url.search,{method:request.method,headers:request.headers,...(bytes?{body:bytes as BodyInit}:{})});
  if(themeFlow&&source==='actual-mobile-bff'&&request.method==='GET'&&result.status===200){
   const match=/^\/v1\/themes\/(letbuyy-[a-z0-9-]+)\/editor$/.exec(url.pathname);
   if(match&&!nativeThemeBaselines.has(match[1])){
    const data=JSON.parse(result.text).data as {template_config?:Record<string,unknown>};
    assert(data.template_config&&typeof data.template_config==='object');
    nativeThemeBaselines.set(match[1],structuredClone(data.template_config));
   }
  }

  const membership=warehouseFlow?request.method==='POST'&&['/v1/inventory/locations','/v1/inventory/suppliers'].includes(url.pathname):settingsFlow?request.method==='PATCH'&&url.pathname===`/v1/stores/${tenant.siteId}`:categoryFlow?request.method==='PATCH'&&url.pathname===`/v1/categories/${category}`:request.method==='PUT'&&url.pathname===`/v1/products/collections/${collection}/products`;
  const released=warehouseFlow&&existsSync(join(root,'release-native-replies.json'));
  if(released)assert.equal(JSON.parse(readFileSync(join(root,'release-native-replies.json'),'utf8')).run_id,owned.runId);
  const smartCreate=verifySmart&&request.method==='POST'&&url.pathname==='/v1/smart-collections';
  const metadataCommand=verifyLifecycle&&['POST','PATCH','DELETE'].includes(request.method)&&(/^\/v1\/products\/collections(?:\/[a-f0-9-]{36})?$/.test(url.pathname)||/^\/v1\/smart-collections(?:\/[a-f0-9-]{36})?$/.test(url.pathname));
  const themeCommand=themeFlow&&['POST','PUT','PATCH','DELETE'].includes(request.method)&&url.pathname.startsWith('/v1/themes/');
  const cameraCommand=cameraFlow&&request.method==='POST'&&['/v1/upload','/v1/media'].includes(url.pathname);
  const retiredMembershipCommand=verifyRetirement&&request.method==='PUT'&&/^\/v1\/products\/collections\/[a-f0-9-]{36}\/products$/.test(url.pathname);
  const loseMembership=source==='actual-mobile-bff'&&membership&&[200,201].includes(result.status)&&!released&&((settingsFlow||warehouseFlow)?(!lost||digest(request.headers.get('X-Idempotency-Key')||'')===lostSettingsKey):!lost);
  const loseSmart=source==='actual-mobile-bff'&&smartCreate&&result.status===201&&!lostSmart;
  const stockCommand=verifyStock&&request.method==='POST'&&/^\/v1\/inventory\/(?:purchase-orders|transfers)(?:\/[a-f0-9-]{36}\/(?:receive|ship))?$/.test(url.pathname);
  const loseStock=source==='actual-mobile-bff'&&stockCommand&&url.pathname.startsWith('/v1/inventory/purchase-orders/')&&url.pathname.endsWith('/receive')&&result.status===200&&!existsSync(join(root,'stock-release-native-replies.json'));
  const setterCommand=verifyStockAdjustments&&((request.method==='POST'&&url.pathname==='/v1/inventory/adjust')||(request.method==='PATCH'&&url.pathname===`/v1/products/${ids[0]}`));
  const loseAdjustment=source==='actual-mobile-bff'&&setterCommand&&url.pathname==='/v1/inventory/adjust'&&result.status===200&&!existsSync(join(root,'setter-release-native-replies.json'));
  const lose=loseMembership||loseSmart||loseStock||loseAdjustment;
  if(loseMembership){lost=true;if(settingsFlow||warehouseFlow)lostSettingsKey??=digest(request.headers.get('X-Idempotency-Key')||'');}
  if(loseSmart)lostSmart=true;
  calls.push({source,path:url.pathname,method:request.method,status:result.status,wire_status:lose?503:result.status,...(membership||smartCreate||metadataCommand||retiredMembershipCommand||stockCommand||setterCommand||cameraCommand||themeCommand?{key_digest:digest(request.headers.get('X-Idempotency-Key')||''),body_digest:digest(cameraCommand&&bytes?bytes:body||'')}:{})});
  if(lose)return Response.json({error:{code:'OWNED_REPLY_LOST',message:'Synthetic committed response lost. Retry the original request.'}},{status:503});
  return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=new Uint8Array(Buffer.concat(chunks));const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body.length?{body:body as BodyInit}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_UNAVAILABLE"}}');}
 });
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 let nativeBff:NativeMobileBff|undefined;
 let api:Server|undefined,bff:Server|undefined,assetServer:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,commerce:OwnedClientProcess|undefined,browser:Browser|undefined,nativeBrowser:Browser|undefined;
 let nativeForward:number|undefined;
 const reversed:number[]=[];
 const initial=JSON.parse(owned.psql(`SELECT json_build_object('site_version',(SELECT version FROM sites WHERE id='${tenant.siteId}'),'version',membership_version,'ids',(SELECT json_agg(product_id ORDER BY position,id)FROM collection_products WHERE collection_id='${collection}'))FROM collections WHERE id='${collection}';`));
 const diagnosticInventoryState=()=>owned.psql(`SELECT jsonb_build_object('levels',(SELECT jsonb_agg(to_jsonb(x)ORDER BY id)FROM inventory_levels x WHERE store_id='${tenant.siteId}'),'reservations',(SELECT jsonb_agg(to_jsonb(x)ORDER BY id)FROM inventory_reservations x WHERE store_id='${tenant.siteId}'),'transfers',(SELECT jsonb_agg(to_jsonb(x)ORDER BY id)FROM inventory_transfers x WHERE site_id='${tenant.siteId}'),'lines',(SELECT jsonb_agg(to_jsonb(x)ORDER BY id)FROM inventory_transfer_lines x WHERE site_id='${tenant.siteId}'),'receipts',(SELECT jsonb_agg(to_jsonb(x)ORDER BY id)FROM warehouse_command_receipts x WHERE site_id='${tenant.siteId}'),'stock',(SELECT stock FROM products WHERE id='${ids[0]}'));`);
 let diagnosticBefore:string|undefined;
 try{
  if(cameraFlow){
   //A public provider fixture serves only bytes actually written by the real
   //upload route. It has no source-filesystem access and never accepts sessions.
   assetServer=createServer((request,response)=>{
    if(request.headers.authorization||request.headers.cookie){publicAssetCredentialAttempts++;response.writeHead(403);response.end();return;}
    const path=new URL(request.url??'/','http://127.0.0.1:54355').pathname;
    const object=path.startsWith('/assets/')?publicObjects.get(decodeURIComponent(path.slice('/assets/'.length))):undefined;
    if(request.method!=='GET'||!object){response.writeHead(404);response.end();return;}
    publicAssetReads++;response.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':object.bytes.length,'Cache-Control':'no-store'});response.end(Buffer.from(object.bytes));
   });
   await new Promise<void>((resolve,reject)=>{assetServer!.once('error',reject);assetServer!.listen(54355,'127.0.0.1',resolve);});
  }
  nativeGateway=compiledWorkers?await NativeGateway.create(env as unknown as Record<string,unknown>,async()=>{throw new Error('No email provider call belongs to this owned warehouse story');}):undefined;
  const currentNative=nativeGateway;
  gateway=currentNative?{
  async request(path,init={}){const response=await currentNative.dispatch(path,init);const text=await response.text();let json:Awaited<ReturnType<Gateway['request']>>['json']=null;try{const parsed:unknown=JSON.parse(text);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))json=parsed as NonNullable<Awaited<ReturnType<Gateway['request']>>['json']>;}catch{/* Keep real non-JSON replies available for assertion. */}return{status:response.status,headers:new Headers(Object.fromEntries(response.headers.entries())),text,json};},
  settle:()=>currentNative.settle(),
 }:new Gateway(env);
 if(nativeGateway)writeFileSync(join(root,'compiled-gateway.mjs'),nativeGateway.compiledScript,{mode:0o600,flag:'wx'});
  if(diagnosticReservation){
   const destination=randomUUID(),key=randomUUID();
   owned.psql(`WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${tenant.siteId}',true)) SELECT set_inventory_level_available('${ids[0]}',NULL,'${tenant.locationId}',3,NULL) FROM _fixture_inventory_scope436;INSERT INTO inventory_locations(id,store_id,name,status)VALUES('${destination}','${tenant.siteId}','Synthetic diagnostic destination','active');`);
   const created=await record(new Request('http://127.0.0.1/v1/inventory/transfers',{method:'POST',headers:{...await signedIdentityHeaders(owner,email,tenant.siteId),'Content-Type':'application/json','Idempotency-Key':key,'X-LetBuyy-Warehouse-Protocol':'2'},body:JSON.stringify({store_id:tenant.siteId,source_location_id:tenant.locationId,destination_location_id:destination,lines:[{product_id:ids[0],quantity:2}],idempotency_key:key})}),'diagnostic-owned-prerequisite');
   assert.equal(created.status,201,await created.clone().text());diagnosticBefore=diagnosticInventoryState();
  }
  if(compiledWorkers){
   nativeBff=await NativeMobileBff.create({INTERNAL_API_SECRET:INTERNAL_SECRET,TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,ENVIRONMENT:'development'},request=>record(request,'actual-mobile-bff'),globalThis.fetch);
   writeFileSync(join(root,'compiled-mobile-bff.mjs'),nativeBff.compiledScript,{mode:0o600,flag:'wx'});
   writeFileSync(join(root,'compiled-workers.json'),JSON.stringify({run_id:owned.runId,runtime:'workerd',gateway_sha256:digest(nativeGateway!.compiledScript),bff_sha256:digest(nativeBff.compiledScript),entrypoints:['services/api-gateway/src/index.ts','services/mobile-bff/src/index.ts'],transport:'Owned Node HTTP and service-binding observer; no business response stubs',hosted:false})+'\n',{mode:0o600,flag:'wx'});
  }
  api=bridge(req=>record(req,'actual-identity'));bff=bridge(async req=>nativeBff?await nativeBff.dispatch(req) as unknown as Response:mobileBff.fetch(req,bffEnv as never));
  for(const [server,port]of [[api,apiPort],[bff,bffPort]]as const)await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:challenge.profile,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',...(iosFlow?{NEXT_PUBLIC_LOCAL_CHALLENGE_SDK_URL:challenge.profile.origin+'/fixtures/turnstile/api.js'}:{}),LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED:'true',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:randomUUID()+randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+360_000;let live=false;while(Date.now()<deadline){if(identity.exitCode!==null)throw new Error('Owned issuer stopped');try{if(!ownedNextListener(identityPort,identity)){await new Promise(r=>setTimeout(r,250));continue;}if((await fetch(identityWireOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(live,'normal issuer readiness');
  const defines={ENVIRONMENT:'local',BFF_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,API_BASE_URL:`http://127.0.0.1:${bffPort}/v1`,IDENTITY_BASE_URL:identityOrigin,ADMIN_BASE_URL:merchantOrigin,STOREFRONT_BASE_URL:'http://localhost:54354',LOCAL_CHALLENGE_SDK_URL:challenge.profile.origin+'/fixtures/turnstile/api.js',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',MOBILE_PUSH_DEVICE_TOKEN:'',SENTRY_DSN:'SKIP_NEEDS_HUMAN_LOCAL_SENTRY_DSN'};
  const definesPath=join(root,'dart-defines.json');writeFileSync(definesPath,JSON.stringify(defines),{mode:0o600,flag:'wx'});
  if(themeFlow){
   // Use the same actual Merchant artwork host and Commerce Liquid renderer as
   // web. No renderer substitution, injected session or hosted mutation.
   merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{LETBUYY_API_BASE_URL:apiOrigin+'/v1',INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,NEXT_PUBLIC_STOREFRONT_URL:'http://localhost:54354',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}});
   commerce=startOwnedClientRuntime(owned,'commerce-next-production',{port:54354,env:{INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_API_BASE_URL:apiOrigin+'/v1',LETBUYY_API_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_URL:apiOrigin+'/v1',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
   for(const child of [merchant,commerce]){child.stdout.resume();child.stderr.resume();}
   writeFileSync(join(root,'theme-catalog.json'),owned.psql("SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name,'version',version)ORDER BY sort_order,slug)FROM themes WHERE slug IN('letbuyy-forge','letbuyy-sense','letbuyy-aura','letbuyy-craft','letbuyy-refresh','letbuyy-ride','letbuyy-bloom','letbuyy-nova','letbuyy-dawn','letbuyy-summit')AND is_active=true")+'\n',{mode:0o600,flag:'wx'});
  }
  const source=sourceSnapshot(),sourceBytes=JSON.stringify(source),sourceHash=digest(sourceBytes);
  writeFileSync(join(root,'source-snapshot.json'),sourceBytes+'\n',{mode:0o600,flag:'wx'});
  type ThemeNativeArtifact={platform:'android';apk_sha256:string}|{platform:'ios';app_executable_sha256:string;app_bundle_sha256:string};
  const verifyNativeThemes=async(proof:{run_id:string;steps:string[];evidence:string[]},artifact:ThemeNativeArtifact)=>{
   const themeGateway=gateway;assert(themeGateway,'the owned Gateway must be initialized before native theme verification');
   checkSource(source,'native theme journey');
   assert(calls.some(call=>call.source==='actual-identity'&&call.path==='/v1/auth/custom/mobile/exchange'&&call.status===200),'a fresh normal native PKCE exchange is required');
   if(artifact.platform==='ios'){
    const mobile=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('client',client_id,'callback',callback_id,'environment',environment,'redirect',redirect_uri,'consumed',consumed_at IS NOT NULL,'cancelled',cancelled_at IS NOT NULL,'account_scope',site_id IS NULL))FROM merchant_mobile_requests WHERE authorized_user_id='${owner}'`))as Array<{client:string;callback:string;environment:string;redirect:string;consumed:boolean;cancelled:boolean;account_scope:boolean}>;
    assert.equal(mobile.length,1);assert.deepEqual(mobile[0],{client:'merchant_ios',callback:'ios_session',environment:'development',redirect:merchantNativeCallback('merchant_ios','ios_session','development'),consumed:true,cancelled:false,account_scope:true});
   }
   for(const step of ['normal-native-browser-accounts-login','native-theme-library','native-ten-theme-marketplace','native-ten-theme-demos','native-ten-theme-installed-editors','native-liquid-save-preview-publish-reopen','native-real-collection-selection','native-library-draft-preview-publish-discard'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=12);for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   const catalog=JSON.parse(readFileSync(join(root,'theme-catalog.json'),'utf8'))as Array<{slug:string;name:string;version:string}>;
   assert.equal(catalog.length,10);
   // Internal identity assertions are single-use. Every independent read must
   // carry its own signed JTI; replay protection must stay enabled here.
   const headers=()=>signedIdentityHeaders(owner,email,tenant.siteId);
   const library=await themeGateway.request('/v1/themes/library?store_id='+tenant.siteId,{headers:await headers()});assert.equal(library.status,200,library.text);
   const rows=(library.json?.data as {themes:Array<{slug:string;instance_id:string;version:string}>}).themes;
   for(const theme of catalog){
    assert(rows.some(row=>row.slug===theme.slug&&row.version===theme.version),'the exact selected package must be present in the real owned library: '+theme.slug);
    assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path===`/v1/themes/${theme.slug}/install`&&call.method==='POST'&&call.status===201),'native install must reach the canonical route: '+theme.slug);
    assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path===`/v1/themes/${theme.slug}/editor`&&call.method==='GET'&&call.status===200),'the actual installed native editor must load: '+theme.slug);
   }
   for(const [suffix,method,status] of [['/editor/draft','PUT',200],['/preview-session','POST',201],['/publish','POST',200]]as const)assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path.startsWith('/v1/themes/')&&call.path.endsWith(suffix)&&call.method===method&&call.status===status),'the native saved-design journey must complete: '+suffix);
   const before=nativeThemeBaselines.get('letbuyy-summit');assert(before,'actual pre-edit native payload required');
   const reopened=await themeGateway.request('/v1/themes/letbuyy-summit/editor?store_id='+tenant.siteId,{headers:await headers()});assert.equal(reopened.status,200,reopened.text);
   const current=(reopened.json?.data as {template_config:Record<string,unknown>}).template_config;
   const stable=(value:unknown):string=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,JSON.parse(stable(v))])):Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):value);
   assert.equal(digest(stable(current.liquidBundle)),digest(stable(before.liquidBundle)),'the installed immutable Liquid source must survive native editing and publication');
   const expected=structuredClone(before.templates??(before.liquidBundle as Record<string,unknown>).templates)as Record<string,{sections:Record<string,{type:string;settings:Record<string,unknown>}>}>;
   const hero=Object.values(expected.index.sections).filter(section=>section.type==='hero-banner');assert.equal(hero.length,1);hero[0].settings.heading='Native Kindred journey verified';const occasions=Object.values(expected.index.sections).filter(section=>section.type==='category-grid');assert.equal(occasions.length,1);occasions[0].settings.collection1=collection;
   const conserved=(actual:unknown,wanted:unknown,path:string)=>{
    if(wanted&&typeof wanted==='object'&&!Array.isArray(wanted)){
     assert(actual&&typeof actual==='object'&&!Array.isArray(actual),'portable document unavailable: '+path);
     for(const [key,value]of Object.entries(wanted))conserved((actual as Record<string,unknown>)[key],value,path+'.'+key);
    }else assert.deepEqual(actual,wanted,'existing portable value changed: '+path);
   };
   conserved(current.templates,expected,'templates');if(before.themeSettings!==undefined)conserved(current.themeSettings,before.themeSettings,'themeSettings');
   assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/themes/resource-search'&&call.method==='GET'&&call.status===200),'the native resource picker must read the actual owned collection');
   assert(calls.filter(call=>call.source==='actual-mobile-bff'&&call.path.endsWith('/preview-session')&&call.method==='POST'&&call.status===201).length>=2,'editor and library previews must both obtain signed saved-design sessions');
   assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/themes/letbuyy-summit/editor/draft'&&call.method==='DELETE'&&call.status===200),'the library discard must receive a canonical receipt');
   assert.equal(owned.psql(`SELECT published::text||'|'||status FROM sites WHERE id='${tenant.siteId}'`),'false|draft','publishing a design must not silently open a closed store');
   assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(p)ORDER BY id)::text FROM products p WHERE store_id='${tenant.siteId}'`),originalCameraProducts,'theme installation must not import demo products or alter inventory');
   writeFileSync(join(root,'themes-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,...artifact,catalog,library:rows,calls,productsUnchanged:true,closedStoreRetained:true,portableConservation:true,immutableBundleSha256:digest(stable(current.liquidBundle)),reopenedHeading:'Native Kindred journey verified',scope:(artifact.platform==='ios'?'Owned iOS Simulator debug app':'Owned Android debug APK')+', normal Accounts PKCE, ten actual installed catalog versions and native editors; actual saved-draft, Commerce preview and publication routes. Requires reviewed native screenshots for visual acceptance. No hosted/provider, physical-device or signed-release acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  };
  if(iosFlow){
   //Use the existing iOS development client/callback and OS authentication
   //session. The Simulator talks directly to our owned issuer port; the Mac's
   //unrelated9002 listener remains blocked. No native session is injected.
   const udid=receipt.simulator_udid!;
   const fd=openSync(join(root,'ios-build.log'),'wx',0o600);
   try{
    const child=spawn('/Volumes/Developer Tools/SDKs/flutter/bin/flutter',['build','ios','--simulator','--debug','--no-pub','--dart-define-from-file='+definesPath,'-d',udid],{cwd:resolve('apps/merchant/mobile'),env:process.env,stdio:['ignore',fd,fd]});
    const exit=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);context.signal.addEventListener('abort',()=>child.kill('SIGTERM'),{once:true});});
    assert.equal(exit,0,'owned Simulator build must pass; inspect private build log');
   }finally{closeSync(fd);}
   checkSource(source,'iOS Simulator build');
   const builtApp=resolve('apps/merchant/mobile/build/ios/iphonesimulator/Runner.app');
   const artifactRoot=join(root,'qualified-artifact');mkdirSync(artifactRoot,{mode:0o700});
   const app=join(artifactRoot,'Runner.app');assert(!existsSync(app));execFileSync('/bin/cp',['-R',builtApp,app]);
   const executableHash=digest(readFileSync(join(app,'Runner')));assert.equal(digest(readFileSync(join(builtApp,'Runner'))),executableHash);
   const bundle=nativeBundleSnapshot(builtApp),bundleHash=digest(JSON.stringify(bundle));assert.deepEqual(nativeBundleSnapshot(app),bundle,'retained iOS bundle must match all built payload bytes and links');
   const bundleManifest=join(artifactRoot,'ios-bundle-manifest.json');writeFileSync(bundleManifest,JSON.stringify(bundle,null,2)+'\n',{mode:0o600,flag:'wx'});
   sim('install',udid,app);const installed=sim('get_app_container',udid,'com.letbuyy.store','app').trim();
   assert(installed.includes('/'+udid+'/data/Containers/Bundle/Application/'));assert.equal(digest(readFileSync(join(installed,'Runner'))),executableHash);assert.deepEqual(nativeBundleSnapshot(installed),bundle,'installed iOS app must match the complete built bundle, including Dart and frameworks');
   writeFileSync(join(root,'artifact.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,kind:'ios-simulator-debug-app',app,source_build_path:builtApp,executable_sha256:executableHash,bundle_sha256:bundleHash,bundle_files:bundle.length,bundle_manifest:bundleManifest,installed_readback:true,defines,scope:'Owned Simulator debug artifact only; no device signing, release or hosted acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
   writeFileSync(ready,JSON.stringify({run_id:owned.runId,udid,flow,email,password,app_executable_sha256:executableHash,app_bundle_sha256:bundleHash,store_id:tenant.siteId,scope:'Synthetic credentials for the actual visible Accounts form only. Native PKCE, UI and data still require proof.'},null,2)+'\n',{mode:0o600,flag:'wx'});
   console.info('OWNED_LOCAL_IOS_READY '+ready);
   while(!existsSync(done)){checkUi();if(identity.exitCode!==null)throw new Error('Owned issuer stopped');await new Promise(r=>setTimeout(r,1000));}
   const proof=JSON.parse(readFileSync(done,'utf8'))as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
   if(iosThemesFlow){await verifyNativeThemes(proof,{platform:'ios',app_executable_sha256:executableHash,app_bundle_sha256:bundleHash});return;}
   for(const step of ['normal-native-browser-accounts-login','normal-native-dashboard','normal-native-kyc-navigation','kyc-outage-visible','kyc-explicit-retry','background-resume-session','native-secure-session-restart'])assert(proof.steps.includes(step),step);
   if(iosKycFlow)for(const step of ['document-picker-selection','background-resume-keeps-document','private-synthetic-kyc-upload'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=(iosKycFlow?10:7));for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   checkSource(source,'iOS native journey');
   assert(calls.some(call=>call.source==='actual-identity'&&call.path==='/v1/auth/custom/mobile/exchange'&&call.status===200),'a fresh normal iOS native PKCE exchange is required');
   assert(calls.filter(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc'&&call.status===503).length>=2,'the actual native KYC read outage and its automatic retry must be observed');
   assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc'&&call.status===200),'explicit native retry must read real KYC status');
   assert(restartCallIndex!==undefined,'actual XCTest app termination/relaunch must be marked');
   assert(calls.slice(restartCallIndex).some(call=>call.source==='actual-identity'&&call.path==='/v1/auth/custom/session'&&call.status===200),'relaunch must validate its actual restored native credential');
   assert(calls.slice(restartCallIndex).some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc'&&call.status===200));
   // Normal login issues the account session; store selection follows in the
   // native app. The optional site-bound completion is a different journey.
   // Check the exact account scope here and the actual selected-store header
   // on every KYC request above, rather than inventing a bound login site.
   const mobile=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('client',client_id,'callback',callback_id,'environment',environment,'redirect',redirect_uri,'consumed',consumed_at IS NOT NULL,'cancelled',cancelled_at IS NOT NULL,'account_scope',site_id IS NULL))FROM merchant_mobile_requests WHERE authorized_user_id='${owner}'`))as Array<{client:string;callback:string;environment:string;redirect:string;consumed:boolean;cancelled:boolean;account_scope:boolean}>;
   assert.equal(mobile.length,1);assert.deepEqual(mobile[0],{client:'merchant_ios',callback:'ios_session',environment:'development',redirect:merchantNativeCallback('merchant_ios','ios_session','development'),consumed:true,cancelled:false,account_scope:true});
   assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(p)ORDER BY id)::text FROM products p WHERE store_id='${tenant.siteId}'`),originalCameraProducts);
   const nativeWrites=calls.filter(call=>call.source==='actual-mobile-bff'&&['POST','PATCH','PUT','DELETE'].includes(call.method));
   const documents=JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'document_type',document_type,'status',status,'metadata',metadata)ORDER BY id),'[]'::jsonb)FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}'AND deleted_at IS NULL;`))as PrivateKycDocument[];
   if(iosKycFlow){
    assert.equal(nativeWrites.length,1);assert.equal(nativeWrites[0].path,'/v1/kyc/documents/upload');assert.equal(nativeWrites[0].method,'POST');assert.equal(nativeWrites[0].status,201);
    assert.equal(documents.length,1);assert.equal(documents[0].document_type,'business_pan');assert.equal(documents[0].status,'submitted');assert.equal(privateObjects.size,1);
    const bytes=privateObjects.get(documents[0].metadata.private_object_key);assert(bytes&&bytes.byteLength>0);assert.equal(digest(bytes),documents[0].metadata.sha256);assert.equal(Number(documents[0].metadata.byte_size),bytes.byteLength);
    writeFileSync(join(root,'ios-private-provider-object.bin'),bytes,{mode:0o600,flag:'wx'});
   }else{assert.equal(nativeWrites.length,0);assert.equal(documents.length,0);assert.equal(privateObjects.size,0);}
   writeFileSync(join(root,'ios-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,app_executable_sha256:executableHash,app_bundle_sha256:bundleHash,calls,mobile,documents,private_object_count:privateObjects.size,productsUnchanged:true,challenge_counts:challenge.counts,scope:'Actual owned iOS Simulator debug app, normal OS Accounts session and registered merchant_ios PKCE callback, authenticated Dashboard/KYC, unavailable/read retry, background/resume and secure native credential restoration after real app restart.'+(iosKycFlow?' Includes actual native Photo Picker and one byte-matched synthetic private KYC submission, pending review only.':' Read-only auth/status journey.')+' No injected session, public Mac9002 adoption, live AWS/Cashfree, hosted/provider approval, camera, physical-device, signed release or full-feature acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});return;
  }
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
  for(const port of [apiPort,bffPort,Number(new URL(challenge.profile.origin).port),...(cameraFlow?[54355]:[]),...(themeFlow?[merchantPort,54354]:[])]){adb('reverse','--no-rebind',`tcp:${port}`,`tcp:${port}`);reversed.push(port);}
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
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,adb_port:receipt.adb_port,email,password,flow,verify_smart:verifySmart,category_id:category,collection_id:collection,store_id:tenant.siteId,expected_ids:[ids[1],ids[0]],apk_sha256:apkHash},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.info('OWNED_LOCAL_ANDROID_READY '+ready);
  while(!existsSync(done)){checkUi();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null)throw new Error('Owned issuer stopped');await new Promise(r=>setTimeout(r,1000));}
  const proof=JSON.parse(readFileSync(done,'utf8'))as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  checkSource(source,'native journey');
  assert(calls.some(call=>call.source==='actual-identity'&&call.path==='/v1/auth/custom/mobile/exchange'&&call.status===200),'A fresh native PKCE exchange, not a retained token, must be observed');
  if(themeFlow){await verifyNativeThemes(proof,{platform:'android',apk_sha256:apkHash});return;}
  if(cameraFlow){
   for(const step of ['normal-native-browser-accounts-login','normal-native-product-draft','camera-permission-visible','camera-capture-confirmed','native-photo-upload-and-preview','native-draft-discard'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=6);for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   for(const path of ['/v1/upload','/v1/media'])assert.equal(calls.filter(call=>call.source==='actual-mobile-bff'&&call.path===path&&call.method==='POST'&&call.status===201).length,1,path);
   assert.equal(publicObjects.size,1);assert(publicAssetReads>=1,'the native preview must read the actual uploaded bytes');assert.equal(publicAssetCredentialAttempts,0,'public preview must not leak merchant credentials');
   const[key,object]=[...publicObjects.entries()][0];assert(object.bytes.length>3);assert.deepEqual([...object.bytes.slice(0,3)],[255,216,255],'the camera produces actual JPEG bytes');
   const metadata=object.options?.customMetadata;assert.equal(metadata?.store_id,tenant.siteId);assert.equal(metadata?.owner_id,owner);assert.equal(metadata?.upload_sha256,digest(object.bytes));
   const effects=JSON.parse(owned.psql(`SELECT jsonb_build_object('media',(SELECT jsonb_agg(to_jsonb(m)ORDER BY id)FROM media m WHERE store_id='${tenant.siteId}'),'assets',(SELECT jsonb_agg(to_jsonb(a)ORDER BY id)FROM media_assets a WHERE site_id='${tenant.siteId}'),'events',(SELECT count(*)FROM outbox_events WHERE site_id='${tenant.siteId}'AND event_type='media.processed'))`))as {media:Array<Record<string,unknown>>;assets:Array<Record<string,unknown>>;events:number};
   assert.equal(effects.media.length,1);assert.equal(effects.assets.length,1);assert.equal(effects.events,1);
   assert.equal(owned.psql(`SELECT jsonb_agg(to_jsonb(p)ORDER BY id)::text FROM products p WHERE store_id='${tenant.siteId}'`),originalCameraProducts,'discarding the draft changes no product');
   assert(!calls.some(call=>call.source==='actual-mobile-bff'&&['POST','PATCH','DELETE'].includes(call.method)&&/^\/v1\/products(?:\/|$)/.test(call.path)));
   writeFileSync(join(root,'camera-provider-object.jpg'),object.bytes,{mode:0o600,flag:'wx'});
   writeFileSync(join(root,'camera-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,calls,effects,object:{key,bytes:object.bytes.length,sha256:digest(object.bytes),metadata},publicAssetReads,publicAssetCredentialAttempts,productsUnchanged:true,scope:'Actual debug APK and Android camera permission/capture, real public upload and canonical Media/library SQL, actual uploaded JPEG preview without credential forwarding, explicit unsaved product draft discard. Owned storage/CDN fixtures only; no hosted/provider, iOS, signed release or full product-module acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});return;
  }
  if(kycFlow){
   for(const step of ['normal-native-browser-accounts-login','normal-native-kyc-navigation','kyc-outage-visible','kyc-explicit-retry','document-picker-selection','background-resume-keeps-document','private-synthetic-kyc-upload','native-secure-session-restart'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=6);for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   assert(!existsSync(join(root,'kyc-outage-active.json')),'explicit recovery must retire this run-owned outage');
   assert(calls.filter(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc'&&call.status===503).length>=2,'the visible unavailable state must outlast automatic retries');
   assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc'&&call.status===200));
   assert(restartCallIndex!==undefined,'the real process restart must be marked before relaunch');
   assert(calls.slice(restartCallIndex).some(call=>call.source==='actual-identity'&&call.path==='/v1/auth/custom/session'&&call.status===200),'relaunch must validate its restored native credential through the actual issuer');
   assert.equal(calls.filter(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/kyc/documents/upload'&&call.method==='POST'&&call.status===201).length,1);
   const documents=JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'document_type',document_type,'status',status,'metadata',metadata)ORDER BY id),'[]'::jsonb)FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}'AND deleted_at IS NULL;`))as PrivateKycDocument[];
   assert.equal(documents.length,1);assert.equal(documents[0].document_type,'business_pan');assert.notEqual(documents[0].status,'approved');assert.equal(privateObjects.size,1);
   const bytes=privateObjects.get(documents[0].metadata.private_object_key);assert(bytes);assert(bytes.byteLength>0);assert.equal(digest(bytes),documents[0].metadata.sha256,'the real multipart photo bytes must match the durable private document receipt');
   assert.equal(Number(documents[0].metadata.byte_size),bytes.byteLength);
   writeFileSync(join(root,'kyc-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,calls,documents,private_object_count:privateObjects.size,challenge_counts:challenge.counts,scope:'Actual owned Android debug APK, normal Accounts PKCE, KYC unavailable/retry, native photo picker, background/resume and secure-session restart with one synthetic private upload. Local test-only R2 bytes, not AWS Mumbai/Cashfree/provider approval, hosted, camera, iOS or signed release acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});return;
  }
  if(diagnosticReservation){
   for(const step of ['normal-native-browser-accounts-login','normal-native-reservations-read-diagnostic'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=2);for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   assert(calls.some(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/inventory/reservations'&&call.status===200));
   assert.equal(diagnosticInventoryState(),diagnosticBefore,'Diagnostic native reads cannot alter stock, reservations, transfers or original receipts');
   writeFileSync(join(root,'diagnostic-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,classification:'DIAGNOSTIC_ONLY_NO_FEATURE_ACCEPTANCE',stockWritesByUi:0,inventoryReadOnly:true,scope:'Normal native Accounts login and read of a prerequisite created through the actual owned Gateway. Screenshot and accessibility diagnostics only; no transfer mutation, complete feature, iOS, hosted/provider or release acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});return;
  }
  if(diagnosticDraft){
   for(const step of ['normal-native-browser-accounts-login','normal-native-transfer-draft','observed-numeric-field-focus-diagnostic'])assert(proof.steps.includes(step),step);
   assert(proof.evidence.length>=3);for(const path of proof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   assert.equal(owned.psql(`SELECT count(*)FROM inventory_transfers WHERE site_id='${tenant.siteId}'`),'0');assert.equal(owned.psql(`SELECT count(*)FROM warehouse_command_receipts WHERE site_id='${tenant.siteId}'`),'0');
   assert.equal(owned.psql(`SELECT available||'|'||reserved FROM inventory_levels WHERE product_id='${ids[0]}'`),'3|0');
   writeFileSync(join(root,'diagnostic-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,classification:'DIAGNOSTIC_ONLY_NO_FEATURE_ACCEPTANCE',seededStock:3,stockWrites:0,scope:'Normal native authenticated transfer draft and observed field-focus/hit-test evidence. No successful transfer, full inventory or release certification.'},null,2)+'\n',{mode:0o600,flag:'wx'});return;
  }
  for(const step of warehouseFlow?['normal-native-browser-accounts-login','normal-inventory-locations-navigation','native-location-create','committed-reply-loss-visible','app-restart-retains-original-request','original-request-retry-confirmed','native-supplier-create']:settingsFlow?['normal-native-browser-accounts-login','normal-dashboard-settings-navigation','native-store-rename','committed-reply-loss-visible','unconfirmed-status-remains-visible-while-scrolling','fresh-store-reload-without-replay']:categoryFlow?['normal-native-browser-accounts-login','normal-categories-navigation','native-category-rename','committed-reply-loss-visible','original-request-retry-confirmed']:verifyRetirement?['normal-native-browser-accounts-login','normal-collections-navigation','ordered-native-selection','committed-reply-loss-visible']:['normal-native-browser-accounts-login','normal-collections-navigation','ordered-native-selection','committed-reply-loss-visible','original-request-retry-confirmed'])assert(proof.steps.includes(step),step);
  if(receipt.verifyDashboardSettings===true)assert(proof.steps.includes('normal-dashboard-settings-navigation'),'dashboard settings must open its actual native destination');
  for(const path of proof.evidence){assert(path.startsWith(root+'/'));assert(existsSync(path));}assert(proof.evidence.length>=2);
  // Same synthetic site and database: normal web authentication reads the
  // native order, then an actual web save must become visible in native UI.
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{APP_ENV:'development',NEXT_PUBLIC_ENV:'development',LETBUYY_OWNED_BLOCKED_LOCAL_PORTS:'[9002]',INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  const webDeadline=Date.now()+360_000;let webLive=false;while(Date.now()<webDeadline){if(merchant.exitCode!==null)throw new Error('Owned Merchant stopped');try{if(!ownedNextListener(merchantPort,merchant)){await new Promise(r=>setTimeout(r,250));continue;}if((await fetch(merchantOrigin,{redirect:'manual',signal:AbortSignal.timeout(2000)})).status<500){webLive=true;break;}}catch(error){if(error instanceof Error&&error.message.includes('OWNED_LISTENER_SCOPE_MISMATCH'))throw error;}await new Promise(r=>setTimeout(r,250));}assert(webLive);
  browser=await chromium.launch({headless:true});const web=await browser.newContext();await challenge.attachBrowser(web,[identityOrigin,merchantOrigin]);
  await web.route(identityOrigin+'/**',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,identityOrigin);
   const response=await route.fetch({url:identityWireOrigin+url.pathname+url.search,maxRedirects:0,headers:{...route.request().headers(),host:new URL(identityOrigin).host}});
   await route.fulfill({response});
  });const page=await web.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(90_000);
  await page.goto(identityOrigin+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL(url=>url.origin===merchantOrigin);
  if(warehouseFlow){
   for(const kind of ['location','supplier'] as const){
    await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/${kind==='location'?'locations':'suppliers'}`);
    await expect(page.getByText(`Synthetic native recovery ${kind}`,{exact:true})).toBeVisible();
    await page.getByRole('button',{name:`Add ${kind}`,exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    await dialog.getByLabel(kind==='location'?'Location name':'Supplier name',{exact:true}).fill(`Synthetic web recovery ${kind}`);
    await dialog.getByLabel('Street / area',{exact:true}).fill('Synthetic web road');
    await dialog.getByLabel('City',{exact:true}).fill('Chennai');
    await dialog.getByLabel('State',{exact:true}).fill('Tamil Nadu');
    await dialog.getByLabel('Pincode',{exact:true}).fill('600001');
    if(kind==='supplier')await dialog.getByLabel('Email (optional)',{exact:true}).fill('synthetic-web-supplier@example.invalid');
    const endpoint=kind==='location'?'inventory-locations':'suppliers';
    const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/${endpoint}`&&r.request().method()==='POST'),dialog.getByRole('button',{name:`Add ${kind}`,exact:true}).click()]);
    assert.equal(saved.status(),201,await saved.text());
    await expect(page.getByText(`Synthetic web recovery ${kind}`,{exact:true})).toBeVisible();
    await page.screenshot({path:join(root,`web-${kind}-readback.png`),fullPage:true});
   }
   writeFileSync(join(root,'web-updated.json'),JSON.stringify({run_id:owned.runId,web_normal_sign_in:true,native_metadata_read:true,web_metadata_created:true,expected_locations:['Synthetic native recovery location','Synthetic web recovery location'],expected_suppliers:['Synthetic native recovery supplier','Synthetic web recovery supplier'],expected_profile_name:'Synthetic warehouse profile'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(settingsFlow){
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/settings/general');
   await expect(page.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic native renamed store');
   const settingsPath=`/api/stores/${tenant.subdomain}/settings`;
   const stale=await web.newPage();
   await stale.goto(merchantOrigin+'/'+tenant.subdomain+'/settings/general');
   await expect(stale.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic native renamed store');
   await stale.getByRole('textbox',{name:'Store name',exact:true}).fill('Synthetic stale draft must survive');
   await page.getByRole('textbox',{name:'Store name',exact:true}).fill('Synthetic web renamed store');
   await page.getByRole('textbox',{name:'SEO title',exact:true}).fill('Synthetic web SEO title');
   await page.getByRole('textbox',{name:'SEO description',exact:true}).fill('Synthetic web SEO description');
   const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/settings`&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);assert.equal(saved.status(),200,await saved.text());
   await expect(page.getByText('Settings saved',{exact:true})).toBeVisible();
   const [conflict]=await Promise.all([stale.waitForResponse(r=>new URL(r.url()).pathname===settingsPath&&r.request().method()==='PATCH'),stale.getByRole('button',{name:'Save',exact:true}).click()]);
   assert.equal(conflict.status(),409,await conflict.text());
   await expect(stale.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic stale draft must survive');
   await expect(stale.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
   await stale.screenshot({path:join(root,'web-stale-draft-retained.png'),fullPage:true});
   await stale.getByRole('button',{name:'Reload current settings',exact:true}).click();
   await expect(stale.getByRole('dialog')).toBeVisible();
   await stale.getByRole('button',{name:'Cancel',exact:true}).click();
   await expect(stale.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic stale draft must survive');
   await stale.getByRole('button',{name:'Reload current settings',exact:true}).click();
   await stale.getByRole('button',{name:'Reload settings',exact:true}).click();
   await expect(stale.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic web renamed store');
   await stale.close();
   const current=JSON.parse(owned.psql(`SELECT json_build_object('version',version)FROM sites WHERE id='${tenant.siteId}'`));
   const actorDenied=await web.request.patch(merchantOrigin+settingsPath,{headers:{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':randomUUID(),'X-Idempotency-Key':randomUUID()},data:{version:current.version,name:'Synthetic forbidden actor'}});
   assert.equal(actorDenied.status(),409,await actorDenied.text());
   const originDenied=await web.request.patch(merchantOrigin+settingsPath,{headers:{Origin:'https://synthetic-foreign.example.invalid','X-LetBuyy-Merchant-Context':owner,'X-Idempotency-Key':randomUUID()},data:{version:current.version,name:'Synthetic forbidden origin'}});
   assert.equal(originDenied.status(),403,await originDenied.text());
   assert.equal(Number(owned.psql(`SELECT version FROM sites WHERE id='${tenant.siteId}'`)),current.version,'denied BFF requests must not mutate the store');
   await page.getByRole('textbox',{name:'SEO title',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:join(root,'web-settings-saved.png'),fullPage:true});
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/settings/business');
   await expect(page.getByRole('textbox',{name:'Legal business name',exact:true})).toBeVisible();
   await page.getByRole('textbox',{name:'Legal business name',exact:true}).fill('Synthetic verified local business');
   const [businessSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===settingsPath&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save',exact:true}).click()]);assert.equal(businessSaved.status(),200,await businessSaved.text());
   await page.screenshot({path:join(root,'web-business-saved.png'),fullPage:true});
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/online-store/preferences');
   await expect(page.getByRole('textbox',{name:'Homepage title',exact:true})).toHaveValue('Synthetic web SEO title');
   await page.getByRole('textbox',{name:'Homepage title',exact:true}).fill('Synthetic preferences title');
   await page.getByRole('textbox',{name:'Meta description',exact:true}).fill('Synthetic preferences description');
   const [preferencesSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===settingsPath&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save changes',exact:true}).click()]);assert.equal(preferencesSaved.status(),200,await preferencesSaved.text());
   await expect(page.getByText('Preferences saved',{exact:true})).toBeVisible();
   await page.screenshot({path:join(root,'web-preferences-saved.png'),fullPage:true});
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/settings/billing/profile');
   await expect(page.getByRole('textbox',{name:'GSTIN',exact:true})).toBeVisible();
   await page.getByRole('textbox',{name:'GSTIN',exact:true}).fill('29ABCDE1234F1Z5');
   const [billingSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===settingsPath&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Add GSTIN',exact:true}).click()]);assert.equal(billingSaved.status(),200,await billingSaved.text());
   await expect(page.getByText('29ABCDE1234F1Z5',{exact:true})).toBeVisible();
   await page.screenshot({path:join(root,'web-billing-gstin-saved.png'),fullPage:true});
   writeFileSync(join(root,'web-updated.json'),JSON.stringify({run_id:owned.runId,expected_name:'Synthetic web renamed store',expected_title:'Synthetic preferences title',expected_description:'Synthetic preferences description',web_normal_sign_in:true,web_read_native_name:true,web_saved_metadata:true,web_stale_draft_conflict:true,web_denied_actor_origin:true,web_profile_writers:['general','business','preferences','billing-gstin']},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(categoryFlow){
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/categories');await expect(page.getByText('Synthetic native renamed cotton',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Edit category Synthetic native renamed cotton',exact:true}).click();await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Synthetic native renamed cotton');
   await page.getByLabel('Description',{exact:true}).fill('Synthetic web category readback');
   const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/categories/${category}`&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Update category',exact:true}).click()]);assert.equal(saved.status(),200,await saved.text());
   await expect(page.getByText('Category saved. 0 assigned products updated.',{exact:true})).toBeVisible();
   await page.screenshot({path:join(root,'web-category-saved.png'),fullPage:true});await web.close();await browser.close();browser=undefined;
   writeFileSync(join(root,'web-updated.json'),JSON.stringify({run_id:owned.runId,expected_name:'Synthetic native renamed cotton',expected_description:'Synthetic web category readback',web_normal_sign_in:true,web_read_native_category:true,web_saved_metadata:true},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(verifyRetirement){
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/collections');
   const row=page.getByRole('row').filter({has:page.getByText('Synthetic native collection',{exact:true})});
   const membershipPath='/api/stores/'+tenant.subdomain+'/collections/'+collection+'/products';
   const [read]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath&&r.request().method()==='GET'),row.getByRole('button',{name:'Manage products',exact:true}).click()]);
   assert.equal(read.status(),200);assert.deepEqual((await read.json()).data.product_ids,[ids[1],ids[0]]);
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/collections');
   await row.getByRole('button',{name:'Edit details',exact:true}).click();await page.getByRole('button',{name:'Delete collection',exact:true}).click();
   const [deleted]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/collections/${collection}`&&r.request().method()==='DELETE'),page.getByRole('dialog').getByRole('button',{name:'Delete collection',exact:true}).click()]);assert.equal(deleted.status(),200,await deleted.text());
   const originalReceiptHash=owned.psql(`SELECT encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')FROM collection_membership_receipts r WHERE collection_id='${collection}'`);assert.match(originalReceiptHash,/^[a-f0-9]{64}$/);
   writeFileSync(join(root,'retired-membership-original-receipt.json'),JSON.stringify({run_id:owned.runId,sha256:originalReceiptHash})+'\n',{mode:0o600,flag:'wx'});
   await page.screenshot({path:join(root,'web-retired-membership-collection.png'),fullPage:true});
   writeFileSync(join(root,'web-updated.json'),JSON.stringify({run_id:owned.runId,normal_web_read_committed_native_order:true,normal_web_deleted_collection:true})+'\n',{mode:0o600,flag:'wx'});
  }else{
  await page.goto(merchantOrigin+'/'+tenant.subdomain+'/products/collections');const row=page.getByRole('row').filter({has:page.getByText('Synthetic native collection',{exact:true})});await expect(row).toBeVisible();
  const membershipPath='/api/stores/'+tenant.subdomain+'/collections/'+collection+'/products';
  const [read]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath&&r.request().method()==='GET'),row.getByRole('button',{name:'Manage products',exact:true}).click()]);assert.equal(read.status(),200);assert.deepEqual((await read.json()).data.product_ids,[ids[1],ids[0]]);
  await expect(page.getByRole('checkbox',{name:'Synthetic cotton tote',exact:true})).toBeChecked();const blue=page.getByRole('checkbox',{name:'Synthetic blue shirt',exact:true});await expect(blue).toBeChecked();await blue.uncheck();await blue.check();
  const [saved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath&&r.request().method()==='PUT'),page.getByRole('button',{name:'Save products',exact:true}).click()]);assert.equal(saved.status(),200);assert.deepEqual((await saved.json()).data.product_ids,ids);
  const webScreenshot=join(root,'web-membership-saved.png');await page.screenshot({path:webScreenshot,fullPage:true});if(!verifySmart){await web.close();await browser.close();browser=undefined;}
  writeFileSync(join(root,'web-updated.json'),JSON.stringify({run_id:owned.runId,expected_names:['Synthetic cotton tote','Synthetic blue shirt'],expected_ids:ids,web_normal_sign_in:true,web_read_native_order:true,web_saved_order:true},null,2)+'\n',{mode:0o600,flag:'wx'});
  }
  const syncDone=join(root,'sync-done.json');while(!existsSync(syncDone)){checkUi();process.kill(receipt.emulator_pid,0);await new Promise(r=>setTimeout(r,1000));}
  const sync=JSON.parse(readFileSync(syncDone,'utf8'))as {run_id:string;step:string;evidence:string};assert.equal(sync.run_id,owned.runId);assert.equal(sync.step,warehouseFlow?'native-read-web-warehouse-and-profile-save':settingsFlow?'native-read-web-settings-and-clear-seo':categoryFlow?'native-read-web-category-description':verifyRetirement?'native-recovered-retired-membership':'native-refresh-read-web-order');assert(sync.evidence.startsWith(root+'/')&&existsSync(sync.evidence));checkSource(source,'web/native return read');
  if(warehouseFlow){
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/settings/general`);
   await expect(page.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic warehouse profile');
   await page.screenshot({path:join(root,'web-read-native-profile.png'),fullPage:true});
   const persisted=JSON.parse(owned.psql(`SELECT json_build_object('locations',(SELECT json_agg(json_build_object('id',id,'name',name,'address',address)ORDER BY name,id)FROM inventory_locations WHERE store_id='${tenant.siteId}'AND name LIKE 'Synthetic % recovery location'),'suppliers',(SELECT json_agg(json_build_object('id',id,'name',name,'address',address,'email',email)ORDER BY name,id)FROM suppliers WHERE site_id='${tenant.siteId}'AND name LIKE 'Synthetic % recovery supplier'),'receipts',(SELECT json_agg(json_build_object('operation',operation,'target_id',target_id,'key_digest',encode(sha256(convert_to(idempotency_key,'UTF8')),'hex'),'command',command,'outcome',response->'command_receipt'->>'outcome')ORDER BY operation,target_id)FROM warehouse_command_receipts WHERE site_id='${tenant.siteId}'),'site_version',(SELECT version FROM sites WHERE id='${tenant.siteId}'))`));
   assert.equal(persisted.locations.length,2);assert.equal(persisted.suppliers.length,2);assert.equal(persisted.receipts.length,4);assert(persisted.receipts.every((r:{outcome:string})=>r.outcome==='applied'));
   assert.deepEqual(persisted.locations.map((r:{name:string})=>r.name),['Synthetic native recovery location','Synthetic web recovery location']);
   assert.deepEqual(persisted.suppliers.map((r:{name:string})=>r.name),['Synthetic native recovery supplier','Synthetic web recovery supplier']);
   for(const row of persisted.locations){assert.equal(row.address.country,'IN');assert.equal(row.address.pincode,'600001');}
   const locationCalls=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='POST'&&c.path==='/v1/inventory/locations');assert(locationCalls.length>=3);assert(locationCalls.every(c=>c.status===201));assert(locationCalls.slice(0,-1).every(c=>c.wire_status===503));assert.equal(locationCalls.at(-1)?.wire_status,201);assert(locationCalls.every(c=>c.key_digest===locationCalls[0].key_digest&&c.body_digest===locationCalls[0].body_digest));
   assert.equal(persisted.receipts.filter((r:{key_digest:string})=>r.key_digest===locationCalls[0].key_digest).length,1,'restart retry uses one immutable location receipt');
   assert.equal(persisted.site_version,initial.site_version+1,'strict profile acknowledgement positive control has one effect');
   assert(challenge.counts.issued>=2&&challenge.counts.verified>=2);
   writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,persisted,calls,challenge_counts:challenge.counts,web_bidirectional:true,scope:'Normal local Android location/supplier create, location lost-reply and restart original-key recovery, normal web read/create and native readback; strict native store-profile positive save and web read. No metadata update/delete, stock receiving/transfer, staff UI, hosted/provider/iOS or whole-feature certification.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(settingsFlow){
   await page.goto(merchantOrigin+'/'+tenant.subdomain+'/settings/general');
   await expect(page.getByRole('textbox',{name:'Store name',exact:true})).toHaveValue('Synthetic web renamed store');
   await expect(page.getByRole('textbox',{name:'SEO title',exact:true})).toHaveValue('');
   await expect(page.getByRole('textbox',{name:'SEO description',exact:true})).toHaveValue('');
   await page.getByRole('textbox',{name:'SEO title',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:join(root,'web-read-native-seo-clear.png'),fullPage:true});
   const persisted=JSON.parse(owned.psql(`SELECT json_build_object('name',name,'meta_title',meta_title,'meta_description',meta_description,'version',version,'legal_name',legal_name,'gstin',gstin,'gst_state_code',gst_state_code,'business_profile',business_profile,'invoice_address',invoice_address)FROM sites WHERE id='${tenant.siteId}';`));
   assert.equal(persisted.business_profile.email,'synthetic-contact@example.invalid');assert.equal(persisted.business_profile.trade_name,'Retained synthetic trade');assert.equal(persisted.invoice_address.attention,'Retained synthetic attention');
   assert.equal(persisted.name,'Synthetic web renamed store');assert.equal(persisted.meta_title,'');assert.equal(persisted.meta_description,'');assert.equal(persisted.legal_name,'Synthetic verified local business');assert.equal(persisted.gstin,'29ABCDE1234F1Z5');assert.equal(persisted.gst_state_code,'29');assert.equal(persisted.version,initial.site_version+6,'one native name, four web profile writers and one native SEO clear; stale and denied requests have no effect');
   const writes=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='PATCH'&&c.path===`/v1/stores/${tenant.siteId}`);
   assert(writes.length>=3,'lost name response must exhaust automatic original-key transport retries before the independent SEO clear');
   assert(writes.every(c=>c.status===200));const lostName=writes.slice(0,-1);assert(lostName.every(c=>c.wire_status===503));assert.equal(writes.at(-1)?.wire_status,200);assert(lostName.every(c=>c.key_digest===lostName[0].key_digest&&c.body_digest===lostName[0].body_digest));
   const ownerWrites=calls.filter(c=>c.method==='PATCH'&&c.path===`/v1/stores/${tenant.siteId}`&&c.status===200);assert.equal(ownerWrites.length,writes.length+4,'four normal web profile saves plus exact native transport attempts; database version proves actual effects');
   assert.equal(calls.filter(c=>c.method==='PATCH'&&c.path===`/v1/stores/${tenant.siteId}`&&c.status===409).length,1,'stale browser revision is rejected at the actual Gateway');
   assert(challenge.counts.issued>=2&&challenge.counts.verified>=2);
   writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,persisted,calls,challenge_counts:challenge.counts,web_bidirectional:true,web_stale_revision_rejected:true,web_profile_writers:['general','business','preferences','billing-gstin'],scope:'Normal local Android Store Details and SEO -> actual Identity/BFF/Gateway/owned PostgreSQL -> four normal Merchant web profile writers and back, stale-tab conflict and BFF actor/origin denial. No durable business-receipt/restart, public renderer, hosted/provider/iOS or full-feature certification.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(categoryFlow){
   const persisted=JSON.parse(owned.psql(`SELECT json_build_object('category',public.product_category_snapshot_v1('${category}'),
    'receipts',(SELECT count(*)FROM product_category_command_receipts WHERE category_id='${category}'),
    'audits',(SELECT count(*)FROM audit_activity_events WHERE resource_type='product_category'AND resource_id='${category}'AND action='category.update'),
    'outbox',(SELECT count(*)FROM outbox_events WHERE aggregate_id='${category}'AND event_type='category.metadata.updated'),
    'products',(SELECT json_agg(json_build_object('id',id,'category',category))FROM products WHERE store_id='${tenant.siteId}'),
    'product_receipts',(SELECT count(*)FROM product_edit_receipts WHERE store_id='${tenant.siteId}'))`));
   assert.equal(persisted.category.name,'Synthetic native renamed cotton');assert.equal(persisted.category.description,'Synthetic web category readback');assert.equal(persisted.category.products_count,2);
   assert.equal(persisted.receipts,2);assert.equal(persisted.audits,2);assert.equal(persisted.outbox,2);assert.equal(persisted.product_receipts,2);assert.equal(persisted.products.length,2);assert(persisted.products.every((p:{category:string})=>p.category==='Synthetic native renamed cotton'));
   const receipts=JSON.parse(owned.psql(`SELECT json_agg(json_build_object('expected_version',expected_version,'result_version',(response->>'version')::integer,'payload',payload)ORDER BY expected_version)FROM product_category_command_receipts WHERE category_id='${category}'`));assert.equal(receipts.length,2);assert.equal(receipts[0].result_version,receipts[1].expected_version);assert.equal(receipts[1].result_version,persisted.category.version);
   const writes=calls.filter(c=>c.method==='PATCH'&&c.source==='actual-mobile-bff'&&c.path===`/v1/categories/${category}`);assert.equal(writes.length,2);assert(writes.every(c=>c.status===200));assert.deepEqual(writes.map(c=>c.wire_status),[503,200]);assert.equal(writes[0].key_digest,writes[1].key_digest);assert.equal(writes[0].body_digest,writes[1].body_digest);
   assert(challenge.counts.issued>=2&&challenge.counts.verified>=2);
   writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,persisted,receipts,calls,challenge_counts:challenge.counts,web_bidirectional:true,scope:'Normal local Android and Merchant web category metadata -> Identity/BFF/Gateway/owned PostgreSQL; other features, buyer renderer, hosted/provider/iOS remain separate.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else if(verifyRetirement){
   const title='Synthetic recovered selection';await page.reload();
   const row=page.getByRole('row').filter({has:page.getByText(title,{exact:true})});await expect(row).toBeVisible();
   const newCollection=owned.psql(`SELECT id FROM collections WHERE store_id='${tenant.siteId}'AND title='${title}'AND collection_type='manual'AND deleted_at IS NULL`);assert.match(newCollection,/^[a-f0-9-]{36}$/);
   writeFileSync(join(root,'retired-member-web-read.json'),JSON.stringify({run_id:owned.runId,normal_web_read_subsequent_native_create:true})+'\n',{mode:0o600,flag:'wx'});
   const waiting=join(root,'missing-selection-ready.json');while(!existsSync(waiting)){checkUi();await new Promise(r=>setTimeout(r,500));}
   const draft=JSON.parse(readFileSync(waiting,'utf8'))as{run_id:string;evidence:string};assert.equal(draft.run_id,owned.runId);assert(draft.evidence.startsWith(root+'/')&&existsSync(draft.evidence));
   await row.getByRole('button',{name:'Edit details',exact:true}).click();await page.getByRole('button',{name:'Delete collection',exact:true}).click();
   const [removed]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/collections/${newCollection}`&&r.request().method()==='DELETE'),page.getByRole('dialog').getByRole('button',{name:'Delete collection',exact:true}).click()]);assert.equal(removed.status(),200,await removed.text());
   writeFileSync(join(root,'missing-selection-web-deleted.json'),JSON.stringify({run_id:owned.runId})+'\n',{mode:0o600,flag:'wx'});
   const finished=join(root,'missing-selection-done.json');while(!existsSync(finished)){checkUi();await new Promise(r=>setTimeout(r,500));}
   const finalProof=JSON.parse(readFileSync(finished,'utf8'))as {run_id:string;evidence:string[]};assert.equal(finalProof.run_id,owned.runId);assert(finalProof.evidence.length>=3);for(const p of finalProof.evidence)assert(p.startsWith(root+'/')&&existsSync(p));
   const original=JSON.parse(readFileSync(join(root,'retired-membership-original-receipt.json'),'utf8'));
   const state=JSON.parse(owned.psql(`SELECT jsonb_build_object('original_deleted',(SELECT deleted_at IS NOT NULL FROM collections WHERE id='${collection}'),
    'original_receipts',(SELECT count(*)FROM collection_membership_receipts WHERE collection_id='${collection}'),
    'original_receipt_sha256',(SELECT encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')FROM collection_membership_receipts r WHERE collection_id='${collection}'),
    'original_audits',(SELECT count(*)FROM audit_activity_events WHERE resource_id='${collection}'AND action='collection.membership.updated'),
    'original_outbox',(SELECT count(*)FROM outbox_events WHERE aggregate_id='${collection}'AND event_type='collection.membership.updated'),
    'new_deleted',(SELECT deleted_at IS NOT NULL FROM collections WHERE id='${newCollection}'),
    'new_membership_receipts',(SELECT count(*)FROM collection_membership_receipts WHERE collection_id='${newCollection}'),
    'new_metadata_receipts',(SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${newCollection}'),
    'product_count',(SELECT count(*)FROM products WHERE store_id='${tenant.siteId}'))`));
   assert.equal(state.original_deleted,true);assert.equal(state.original_receipts,1);assert.equal(state.original_receipt_sha256,original.sha256);assert.equal(state.original_audits,1);assert.equal(state.original_outbox,1);
   assert.equal(state.new_deleted,true);assert.equal(state.new_membership_receipts,0);assert.equal(state.new_metadata_receipts,2);assert.equal(state.product_count,2);
   const writes=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='PUT'&&c.path===`/v1/products/collections/${collection}/products`);assert.equal(writes.length,2);assert.deepEqual(writes.map(c=>c.status),[200,200]);assert.deepEqual(writes.map(c=>c.wire_status),[503,200]);assert.equal(writes[0].key_digest,writes[1].key_digest);assert.equal(writes[0].body_digest,writes[1].body_digest);
   const rejected=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='PUT'&&c.path===`/v1/products/collections/${newCollection}/products`);assert.equal(rejected.length,2);assert(rejected.every(c=>c.status===404));assert.match(rejected[0].key_digest??'',/^[a-f0-9]{64}$/);assert.match(rejected[0].body_digest??'',/^[a-f0-9]{64}$/);assert.equal(rejected[0].key_digest,rejected[1].key_digest);assert.equal(rejected[0].body_digest,rejected[1].body_digest);
   const publicResult=await gateway.request(`/v1/storefront/${tenant.subdomain}/collections/${collection}`);assert.equal(publicResult.status,404);
   checkSource(source,'retired membership native/web recovery');
   writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,state,calls,scope:'Actual Android original committed selection recovered through normal Collections entry after web deletion/process restart; normal subsequent native metadata create/web read; a never-committed selection rejected after web deletion, restart/cancel retention and explicit original recheck/dismissal. Current-owner enforcement, no re-applied membership, no fake provider/hosted/release acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }else{
  const persisted=JSON.parse(owned.psql(`SELECT json_build_object('version',membership_version,'ids',(SELECT json_agg(product_id ORDER BY position,id)FROM collection_products WHERE collection_id='${collection}'),'receipts',(SELECT count(*)FROM collection_membership_receipts WHERE collection_id='${collection}'),'audits',(SELECT count(*)FROM audit_activity_events WHERE resource_id='${collection}'AND action='collection.membership.updated'),'outbox',(SELECT count(*)FROM outbox_events WHERE aggregate_id='${collection}'AND event_type='collection.membership.updated'))FROM collections WHERE id='${collection}';`));
  const receipts=JSON.parse(owned.psql(`SELECT json_agg(json_build_object('expected_version',expected_version,'result_version',(response->>'membership_version')::integer,'product_ids',product_ids)ORDER BY expected_version)FROM collection_membership_receipts WHERE collection_id='${collection}';`))as {expected_version:number;result_version:number;product_ids:string[]}[];
  writeFileSync(join(root,'final-database-state.json'),JSON.stringify({run_id:owned.runId,initial,persisted,receipts,notice:'Observed state; acceptance requires the independent assertions and runner pass.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  assert.deepEqual(initial.ids,ids);assert.deepEqual(persisted.ids,ids);assert.equal(persisted.receipts,2);assert.equal(persisted.audits,2);assert.equal(persisted.outbox,2);
  // A revision fences every parent/junction change; it is not an operation
  // count. Receipt continuity and exact effect counts prove two logical saves.
  assert.equal(receipts.length,2);assert.equal(receipts[0].expected_version,initial.version);assert(receipts[0].result_version>receipts[0].expected_version);assert.deepEqual(receipts[0].product_ids,[ids[1],ids[0]]);
  assert.equal(receipts[1].expected_version,receipts[0].result_version);assert(receipts[1].result_version>receipts[1].expected_version);assert.deepEqual(receipts[1].product_ids,ids);assert.equal(persisted.version,receipts[1].result_version);
  const writes=calls.filter(c=>c.method==='PUT'&&c.source==='actual-mobile-bff');assert.equal(writes.length,2);assert(writes.every(c=>c.status===200));assert.deepEqual(writes.map(c=>c.wire_status),[503,200]);assert.equal(writes[0].key_digest,writes[1].key_digest);assert.equal(writes[0].body_digest,writes[1].body_digest);assert(challenge.counts.issued>=2&&challenge.counts.verified>=2);
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,persisted,calls,challenge_counts:challenge.counts,web_bidirectional:true,scope:'Normal local Android and Merchant web -> Identity/BFF/Gateway/owned PostgreSQL; other features, hosted/provider/iOS remain separate.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }
  if(verifyStock){
   const paired=async(name:string)=>{
    const path=join(root,name);while(!existsSync(path)){checkUi();process.kill(receipt.emulator_pid,0);await new Promise(r=>setTimeout(r,500));}
    const value=JSON.parse(readFileSync(path,'utf8'))as {run_id:string;evidence:string[]};assert.equal(value.run_id,owned.runId);assert(value.evidence.length>0);for(const p of value.evidence)assert(p.startsWith(root+'/')&&existsSync(p));return value;
   };
   const signal=(name:string,extra:Record<string,unknown>={})=>writeFileSync(join(root,name),JSON.stringify({run_id:owned.runId,...extra})+'\n',{mode:0o600,flag:'wx'});
   const state=()=>JSON.parse(owned.psql(`SELECT jsonb_build_object(
    'po',(SELECT to_jsonb(p)FROM purchase_orders p WHERE site_id='${tenant.siteId}'),
    'po_lines',(SELECT jsonb_agg(to_jsonb(l)ORDER BY id)FROM purchase_order_lines l WHERE site_id='${tenant.siteId}'),
    'transfer',(SELECT to_jsonb(t)FROM inventory_transfers t WHERE site_id='${tenant.siteId}'),
    'transfer_lines',(SELECT jsonb_agg(to_jsonb(l)ORDER BY id)FROM inventory_transfer_lines l WHERE site_id='${tenant.siteId}'),
    'levels',(SELECT jsonb_agg(to_jsonb(i)ORDER BY location_id,id)FROM inventory_levels i WHERE store_id='${tenant.siteId}'AND product_id='${ids[0]}'AND deleted_at IS NULL),
    'product_stock',(SELECT stock FROM products WHERE id='${ids[0]}'),
    'reservations',(SELECT jsonb_agg(to_jsonb(r)ORDER BY id)FROM inventory_reservations r WHERE store_id='${tenant.siteId}'AND product_id='${ids[0]}'),
    'receipts',(SELECT jsonb_agg(jsonb_build_object('operation',operation,'target',target_id,'key_digest',encode(sha256(convert_to(idempotency_key,'UTF8')),'hex'),'row_digest',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'))ORDER BY operation,target_id,idempotency_key)FROM warehouse_command_receipts r WHERE site_id='${tenant.siteId}')
   )`));
   signal('stock-native-start.json');await paired('stock-native-held-view.json');
   const held=state();assert.equal(held.transfer.status,'reserved');assert.equal(held.transfer_lines.length,1);
   assert.equal(held.reservations.length,1);assert.equal(held.reservations[0].status,'active');assert.equal(held.reservations[0].expires_at,'infinity');
   assert.equal(held.reservations[0].id,held.transfer_lines[0].reservation_id);assert.equal(held.product_stock,1);
   assert.equal(held.levels.length,1);assert.equal(held.levels[0].available,3);assert.equal(held.levels[0].reserved,2);assert.equal(held.levels[0].free_quantity,1);
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/reservations`);
   const heldRow=page.getByRole('table').getByRole('row').filter({hasText:held.transfer.transfer_number});
   await expect(heldRow).toContainText('Held until shipment');await expect(heldRow).toContainText('Synthetic cotton tote');
   await page.screenshot({path:join(root,'web-native-transfer-held-read.png'),fullPage:true});
   signal('stock-web-held-verified.json',{transfer_number:held.transfer.transfer_number});
   await paired('stock-native-done.json');
   const native=state();assert.equal(native.reservations[0].status,'committed');assert.equal(native.product_stock,1);
   assert.equal(native.reservations[0].id,held.reservations[0].id);
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/reservations`);
   const committedRow=page.getByRole('table').getByRole('row').filter({hasText:held.transfer.transfer_number});
   await expect(committedRow).toContainText('Committed at shipment');await page.screenshot({path:join(root,'web-native-transfer-committed-read.png'),fullPage:true});
   assert.equal(native.po.status,'partially_received');assert.equal(native.po_lines.length,1);assert.equal(native.po_lines[0].quantity_ordered,4);assert.equal(native.po_lines[0].quantity_received,3);assert.equal(Number(native.po_lines[0].unit_cost),125.5);
   assert.equal(native.transfer.status,'partially_received');assert.equal(native.transfer_lines.length,1);assert.equal(native.transfer_lines[0].quantity_requested,2);assert.equal(native.transfer_lines[0].quantity_shipped,2);assert.equal(native.transfer_lines[0].quantity_received,1);
   const count=(rows:Array<{available:number;reserved:number;incoming:number}>,field:'available'|'reserved'|'incoming')=>rows.reduce((total,row)=>total+row[field],0);
   assert.equal(count(native.levels,'available'),2);assert.equal(count(native.levels,'reserved'),0);assert.equal(count(native.levels,'incoming'),1);assert.equal(native.transfer_lines[0].quantity_shipped-native.transfer_lines[0].quantity_received,1);assert.equal(count(native.levels,'available')+native.transfer_lines[0].quantity_shipped-native.transfer_lines[0].quantity_received,3,'Physical source/destination stock plus shipped transit equals the3units actually received from the PO');
   const partialCalls=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='POST'&&c.path===`/v1/inventory/purchase-orders/${native.po.id}/receive`);assert(partialCalls.length>=2);assert(partialCalls.every(c=>c.status===200));assert(partialCalls.slice(0,-1).every(c=>c.wire_status===503));assert.equal(partialCalls.at(-1)?.wire_status,200);assert(partialCalls.every(c=>c.key_digest===partialCalls[0].key_digest&&c.body_digest===partialCalls[0].body_digest));assert.match(partialCalls[0].key_digest??'',/^[a-f0-9]{64}$/);
   const partialReceipt=native.receipts.filter((r:{key_digest:string})=>r.key_digest===partialCalls[0].key_digest);assert.equal(partialReceipt.length,1);assert.equal(native.receipts.length,9);
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/purchase-orders`);
   const poRow=page.getByRole('table').getByRole('row').filter({hasText:native.po.po_number});await expect(poRow).toContainText('Partially received');await poRow.getByRole('button',{name:'Receive',exact:true}).click();
   const poDialog=page.getByRole('dialog');await expect(poRow).toContainText('Synthetic Default Warehouse');await expect(poDialog).toContainText('Synthetic cotton tote');await expect(poDialog.getByLabel('Receive quantity',{exact:true})).toHaveValue('1');
   const [poReceived]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/purchase-orders/${native.po.id}/receive`)&&r.request().method()==='POST'),poDialog.getByRole('button',{name:'Mark as received',exact:true}).click()]);assert.equal(poReceived.status(),200);await expect(poDialog).toHaveCount(0);await expect(poRow).toContainText('Received');
   await page.screenshot({path:join(root,'web-native-purchase-order-completed.png'),fullPage:true});
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/transfers`);
   const transferRow=page.getByRole('table').getByRole('row').filter({hasText:native.transfer.transfer_number});await expect(transferRow).toContainText('Partially received');await transferRow.getByRole('button',{name:'Receive',exact:true}).click();
   const transferDialog=page.getByRole('dialog');await expect(transferRow).toContainText('Synthetic Default Warehouse');await expect(transferRow).toContainText('Synthetic native recovery location');await expect(transferDialog).toContainText('Synthetic cotton tote');await expect(transferDialog.getByLabel('Receive quantity',{exact:true})).toHaveValue('1');
   const [transferReceived]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/transfers/${native.transfer.id}/receive`)&&r.request().method()==='POST'),transferDialog.getByRole('button',{name:'Confirm receipt',exact:true}).click()]);assert.equal(transferReceived.status(),200);await expect(transferDialog).toHaveCount(0);await expect(transferRow).toContainText('Received');
   await page.screenshot({path:join(root,'web-native-transfer-completed.png'),fullPage:true});
   signal('stock-web-completed.json',{po_number:native.po.po_number,transfer_number:native.transfer.transfer_number});await paired('stock-native-web-read.json');
   const final=state();assert.equal(final.product_stock,2);assert.equal(final.reservations[0].status,'committed');assert.equal(final.reservations[0].id,held.reservations[0].id);assert.equal(final.po.status,'received');assert.equal(final.po_lines[0].quantity_received,4);assert.equal(final.transfer.status,'received');assert.equal(final.transfer_lines[0].quantity_shipped,2);assert.equal(final.transfer_lines[0].quantity_received,2);
   assert.equal(count(final.levels,'available'),4);assert.equal(count(final.levels,'reserved'),0);assert.equal(count(final.levels,'incoming'),0);assert.equal(count(final.levels,'available')+count(final.levels,'reserved'),4);assert.equal(final.levels.length,2);assert(final.levels.every((l:{available:number})=>l.available===2));assert.equal(final.receipts.length,11);
   assert.deepEqual(final.receipts.filter((r:{key_digest:string})=>r.key_digest===partialCalls[0].key_digest),partialReceipt,'Original native partial receipt remains byteexact after later stock changes');
   checkSource(source,'normal native warehouse lifecycle and web completion');
   writeFileSync(join(root,'stock-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,held,native,final,calls,web_bidirectional:true,scope:'Normal Android PO4units/cost125.50, partialreceive3with lost-reply/restart/exact retry; transfer2reserve/ship/receive1; normal web reads and completes1unit each; native refresh reads final received states. Canonical available4across2locations/no reserved/incoming,11command receipts including4metadata. Shipment-bound reservation viewed held and committed on both surfaces; physical stock plus transit conserved, default cache1then2read back. Broader allocation permutations remain separately unaccepted. No staff/variants/allfinancial/provider/hosted/iOS/release acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
   if(verifyStockAdjustments){
    // A real canonical customer hold is a synthetic prerequisite. This does not
    // claim a buyer-authenticated checkout journey. Both subsequent writes use
    // only normal Merchant UI and the same persisted inventory authority.
    const holdKey=randomUUID();
    owned.psql(`BEGIN;SELECT set_config('app.site_id','${tenant.siteId}',true);SELECT reserve_inventory('${tenant.siteId}','${ids[0]}',NULL,'${tenant.locationId}',1,3600,'${holdKey}','${owner}');COMMIT;`);
    const prerequisite=state(),customerHold=prerequisite.reservations.find((r:{id:string})=>r.id!==held.reservations[0].id);
    assert(customerHold&&customerHold.status==='active'&&customerHold.quantity===1&&customerHold.expires_at!=='infinity');
    const sourceLevel=(world:ReturnType<typeof state>)=>world.levels.find((l:{location_id:string})=>l.location_id===tenant.locationId);
    assert.equal(sourceLevel(prerequisite).available,2);assert.equal(sourceLevel(prerequisite).reserved,1);assert.equal(sourceLevel(prerequisite).free_quantity,1);assert.equal(prerequisite.product_stock,1);
    const setterReceipts=()=>JSON.parse(owned.psql(`SELECT jsonb_build_object('adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY idempotency_key),'[]')FROM inventory_adjustment_receipts r WHERE product_id='${ids[0]}'),'edits',(SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY idempotency_key),'[]')FROM product_edit_receipts r WHERE product_id='${ids[0]}'));`));
    assert.deepEqual(setterReceipts(),{adjustments:[],edits:[]});
    signal('setter-native-start.json',{free:1,reserved:1,on_hand:2});await paired('setter-native-done.json');
    const nativeAdjusted=state(),adjustedReceipts=setterReceipts();
    assert.equal(sourceLevel(nativeAdjusted).available,4);assert.equal(sourceLevel(nativeAdjusted).reserved,1);assert.equal(sourceLevel(nativeAdjusted).free_quantity,3);assert.equal(nativeAdjusted.product_stock,3);
    assert.deepEqual(nativeAdjusted.reservations,prerequisite.reservations);assert.deepEqual(nativeAdjusted.receipts,final.receipts);assert.equal(adjustedReceipts.adjustments.length,1);assert.equal(adjustedReceipts.edits.length,0);
    const adjustments=calls.filter(c=>c.source==='actual-mobile-bff'&&c.method==='POST'&&c.path==='/v1/inventory/adjust');
    assert(adjustments.length>=2);assert(adjustments.every(c=>c.status===200));assert(adjustments.slice(0,-1).every(c=>c.wire_status===503));assert.equal(adjustments.at(-1)?.wire_status,200);assert(adjustments.every(c=>c.key_digest===adjustments[0].key_digest&&c.body_digest===adjustments[0].body_digest));assert.match(adjustments[0].key_digest??'',/^[a-f0-9]{64}$/);
    await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/${ids[0]}`);
    await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic cotton tote');await expect(page.getByLabel('Quantity',{exact:true})).toHaveValue('3');
    await page.screenshot({path:join(root,'web-native-adjusted-stock-read.png'),fullPage:true});
    await page.getByLabel('Quantity',{exact:true}).fill('4');
    const [stockSaved]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${tenant.subdomain}/products/${ids[0]}`&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save product',exact:true}).first().click()]);assert.equal(stockSaved.status(),200,await stockSaved.text());
    const webAdjusted=state(),webReceipts=setterReceipts();assert.equal(sourceLevel(webAdjusted).available,5);assert.equal(sourceLevel(webAdjusted).reserved,1);assert.equal(sourceLevel(webAdjusted).free_quantity,4);assert.equal(webAdjusted.product_stock,4);assert.deepEqual(webAdjusted.reservations,prerequisite.reservations);assert.deepEqual(webAdjusted.receipts,final.receipts);assert.deepEqual(webReceipts.adjustments,adjustedReceipts.adjustments);assert.equal(webReceipts.edits.length,1);
    signal('setter-web-updated.json',{free:4,reserved:1,on_hand:5});await paired('setter-native-web-read.json');assert.deepEqual(state(),webAdjusted);assert.deepEqual(setterReceipts(),webReceipts);
    assert(calls.some(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/inventory/levels'&&c.status===200));checkSource(source,'normal native delta and web absolute setter synchronization');
    writeFileSync(join(root,'setter-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,compiled_workers:compiledWorkers,prerequisite,nativeAdjusted,webAdjusted,receipts:webReceipts,calls,scope:'Owner normal Android delta+2with committed reply loss/process restart/original replay, normal web read3free and absolute save4free, native fresh read4free/1reserved/5physical. Existing customer hold and shipment receipts unchanged; one adjustment and one edit receipt. Synthetic hold prerequisite, no buyer-authenticated checkout, staff-native, variants, hosted/provider or release certification.'},null,2)+'\n',{mode:0o600,flag:'wx'});
   }
  }
  if(verifySmart){
   const nativeDone=join(root,'smart-native-done.json');while(!existsSync(nativeDone)){checkUi();await new Promise(r=>setTimeout(r,500));}
   const nativeProof=JSON.parse(readFileSync(nativeDone,'utf8'))as {run_id:string;steps:string[];evidence:string[]};assert.equal(nativeProof.run_id,owned.runId);
   for(const step of ['normal-smart-navigation','native-rule-publication','committed-reply-loss-visible','app-restart-retains-original-request','original-request-retry-confirmed','native-saved-preview-one-match'])assert(nativeProof.steps.includes(step),step);
   assert(nativeProof.evidence.length>=3);for(const path of nativeProof.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   const smartId=owned.psql(`SELECT id FROM collections WHERE store_id='${tenant.siteId}'AND title='Synthetic native smart collection'AND collection_type='smart'AND deleted_at IS NULL`);assert.match(smartId,/^[a-f0-9-]{36}$/);
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/smart-collections`);await page.getByRole('button',{name:'Edit Synthetic native smart collection',exact:true}).click();
   await expect(page.getByLabel('Rule 1 value',{exact:true})).toHaveValue('cotton');await expect(page.getByLabel('Published on storefront',{exact:true})).toBeChecked();
   await page.getByRole('button',{name:'Preview saved rules',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'1 matching products'})).toBeVisible();
   const publicBefore=await gateway.request(`/v1/storefront/${tenant.subdomain}/collections/${smartId}`);assert.equal(publicBefore.status,200,publicBefore.text);assert.deepEqual(publicBefore.json?.data.products.map((p:{id:string})=>p.id),[ids[0]]);
   await page.screenshot({path:join(root,'web-smart-native-readback.png'),fullPage:true});
   await page.getByLabel('Rule 1 value',{exact:true}).fill('Synthetic');await page.getByRole('button',{name:'Save collection',exact:true}).click();await expect(page.getByText('Collection saved.',{exact:true})).toBeVisible();
   const publicAfter=await gateway.request(`/v1/storefront/${tenant.subdomain}/collections/${smartId}`);assert.equal(publicAfter.status,200,publicAfter.text);assert.deepEqual(publicAfter.json?.data.products.map((p:{id:string})=>p.id).sort(),[...ids].sort());
   await page.screenshot({path:join(root,'web-smart-rule-saved.png'),fullPage:true});
   writeFileSync(join(root,'smart-web-updated.json'),JSON.stringify({run_id:owned.runId,expected_value:'Synthetic',expected_count:2,normal_web_read_native_rule_and_publication:true,public_before_ids:[ids[0]],public_after_ids:ids,scope:'Public API result; no buyer rendered page acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
   const returnPath=join(root,'smart-sync-done.json');while(!existsSync(returnPath)){checkUi();await new Promise(r=>setTimeout(r,500));}
   const returned=JSON.parse(readFileSync(returnPath,'utf8'))as {run_id:string;steps:string[];evidence:string[]};assert.equal(returned.run_id,owned.runId);assert(returned.steps.includes('native-fresh-rule-readback'));assert(returned.steps.includes('native-saved-preview-two-matches'));assert(returned.evidence.length>=2);for(const path of returned.evidence)assert(path.startsWith(root+'/')&&existsSync(path));
   const smartState=JSON.parse(owned.psql(`SELECT json_build_object('version',version,'conditions',conditions,'is_active',is_active,'receipts',(SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${smartId}'),'audits',(SELECT count(*)FROM audit_activity_events WHERE resource_type='collection_metadata'AND resource_id='${smartId}'AND action IN('collection.metadata.create','collection.metadata.update')),'outbox',(SELECT count(*)FROM outbox_events WHERE aggregate_id='${smartId}'AND event_type='collection.metadata.updated'))FROM collections WHERE id='${smartId}'`));
   assert.equal(smartState.version,2);assert.equal(smartState.is_active,true);assert.deepEqual(smartState.conditions,[{field:'title',op:'contains',value:'Synthetic'}]);assert.equal(smartState.receipts,2);assert.equal(smartState.audits,2);assert.equal(smartState.outbox,2);
   const smartWrites=calls.filter(call=>call.source==='actual-mobile-bff'&&call.path==='/v1/smart-collections'&&call.method==='POST');assert.equal(smartWrites.length,2);assert(smartWrites.every(call=>call.status===201));assert.deepEqual(smartWrites.map(call=>call.wire_status),[503,201]);assert.equal(smartWrites[0].key_digest,smartWrites[1].key_digest);assert.equal(smartWrites[0].body_digest,smartWrites[1].body_digest);checkSource(source,'smart collection native/web return');
   writeFileSync(join(root,'smart-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,persisted:smartState,calls,web_bidirectional:true,scope:'Actual debug APK and production-mode local Merchant/Accounts; one smart rule publication, lost-reply/restart original-key recovery, web rule update, fresh native count and exact public API matches. No all-rule-operator, native stale-conflict/delete, rendered buyer, hosted/provider/iOS or entire-feature acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }
  if(verifyLifecycle){
   const paired=async(name:string)=>{
    const path=join(root,name);while(!existsSync(path)){checkUi();process.kill(receipt.emulator_pid,0);await new Promise(r=>setTimeout(r,500));}
    const value=JSON.parse(readFileSync(path,'utf8'))as {run_id:string;evidence:string[]};assert.equal(value.run_id,owned.runId);assert(value.evidence.length>0);for(const p of value.evidence)assert(p.startsWith(root+'/')&&existsSync(p));return value;
   };
   const signal=(name:string)=>writeFileSync(join(root,name),JSON.stringify({run_id:owned.runId})+'\n',{mode:0o600,flag:'wx'});
   await paired('manual-native-created.json');
   const manualId=owned.psql(`SELECT id FROM collections WHERE store_id='${tenant.siteId}'AND title='Synthetic lifecycle manual'AND collection_type='manual'AND deleted_at IS NULL`);assert.match(manualId,/^[a-f0-9-]{36}$/);
   const manualPath=`/api/stores/${tenant.subdomain}/collections/${manualId}`;
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/collections`);
   const manualRow=()=>page.getByRole('row').filter({has:page.getByText('Synthetic lifecycle manual',{exact:true})});
   await manualRow().getByRole('button',{name:'Edit details',exact:true}).click();
   await expect(page.getByLabel('Collection slug',{exact:true})).toHaveValue('synthetic-lifecycle-manual');
   await expect(page.getByLabel('Description',{exact:true})).toHaveValue('Synthetic native manual details');
   await page.screenshot({path:join(root,'web-manual-native-details.png'),fullPage:true});
   signal('manual-web-read.json');await paired('manual-native-draft-ready.json');
   await page.getByLabel('Description',{exact:true}).fill('Synthetic newer web description');
   const [changed]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===manualPath&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Save collection',exact:true}).click()]);assert.equal(changed.status(),200,await changed.text());
   signal('manual-web-updated.json');await paired('manual-native-reviewed.json');
   await page.reload();await manualRow().getByRole('button',{name:'Edit details',exact:true}).click();
   await expect(page.getByLabel('Description',{exact:true})).toHaveValue('Synthetic kept mobile description');
   await page.screenshot({path:join(root,'web-manual-native-reviewed-details.png'),fullPage:true});
   signal('manual-review-web-read.json');await paired('manual-native-delete-draft-ready.json');
   await page.getByRole('button',{name:'Delete collection',exact:true}).click();
   const [removed]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===manualPath&&r.request().method()==='DELETE'),page.getByRole('dialog').getByRole('button',{name:'Delete collection',exact:true}).click()]);assert.equal(removed.status(),200,await removed.text());
   signal('manual-web-deleted.json');await paired('manual-native-missing-resolved.json');
   await page.reload();await expect(manualRow()).toHaveCount(0);
   await expect(page.getByRole('row').filter({has:page.getByText('Synthetic after missing recovery',{exact:true})})).toBeVisible();
   signal('manual-recovery-web-read.json');await paired('smart-native-deleted.json');
   const smartId=owned.psql(`SELECT id FROM collections WHERE store_id='${tenant.siteId}'AND title='Synthetic native smart collection'AND collection_type='smart'`);
   await page.goto(`${merchantOrigin}/${tenant.subdomain}/products/smart-collections`);await expect(page.getByRole('button',{name:'Edit Synthetic native smart collection',exact:true})).toHaveCount(0);
   const publicAfter=await gateway.request(`/v1/storefront/${tenant.subdomain}/collections/${smartId}`);assert.equal(publicAfter.status,404,publicAfter.text);
   const state=JSON.parse(owned.psql(`SELECT jsonb_build_object('manual',(SELECT jsonb_build_object('version',version,'deleted',deleted_at IS NOT NULL,'description',description)FROM collections WHERE id='${manualId}'),
    'smart',(SELECT jsonb_build_object('version',version,'deleted',deleted_at IS NOT NULL)FROM collections WHERE id='${smartId}'),
    'manual_receipts',(SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${manualId}'),
    'manual_audits',(SELECT count(*)FROM audit_activity_events WHERE resource_type='collection_metadata'AND resource_id='${manualId}'),
    'manual_outbox',(SELECT count(*)FROM outbox_events WHERE aggregate_id='${manualId}'AND event_type='collection.metadata.updated'),
    'smart_receipts',(SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${smartId}'),
    'products',(SELECT jsonb_agg(id ORDER BY id)FROM products WHERE store_id='${tenant.siteId}'))`));
   assert.deepEqual(state.manual,{version:4,deleted:true,description:'Synthetic kept mobile description'});assert.deepEqual(state.smart,{version:3,deleted:true});
   assert.equal(state.manual_receipts,4);assert.equal(state.manual_audits,4);assert.equal(state.manual_outbox,4);assert.equal(state.smart_receipts,3);assert.deepEqual(state.products,[...ids].sort());
   const nativeManual=calls.filter(call=>call.source==='actual-mobile-bff'&&call.path===`/v1/products/collections/${manualId}`&&call.method==='PATCH');
   assert.deepEqual(nativeManual.map(call=>call.status),[409,200,404,404]);
   assert.equal(nativeManual[2].key_digest,nativeManual[3].key_digest);assert.equal(nativeManual[2].body_digest,nativeManual[3].body_digest);
   assert.notEqual(nativeManual[0].key_digest,nativeManual[1].key_digest,'Explicit conflict review creates a new request at the observed newer version.');
   checkSource(source,'native collection lifecycle');
   writeFileSync(join(root,'collection-lifecycle-backend-verified.json'),JSON.stringify({run_id:owned.runId,source_sha256:sourceHash,apk_sha256:apkHash,state,calls,
    scope:'Normal Android manual metadata create/read, web update/native conflict with kept edits and explicit review, normal web delete/native definite rejection, cancel and restart retention, exact original recheck and explicit discard, subsequent native create/web read, native Smart delete/web/publicAPI absence. Products retained. No staff native, all rule operators, buyer HTML, iOS, hosted/provider or complete122 acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  }
 }finally{
  try{writeFileSync(join(root,'observed-calls.json'),JSON.stringify({run_id:owned.runId,calls,challenge_counts:challenge.counts,notice:'Transport observations only. Inspect the runner verdict and UI evidence for acceptance.'},null,2)+'\n',{mode:0o600,flag:'wx'});}catch{}
  if(existsSync(ready))writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,credentials_retired:true,scope:'Synthetic login inputs removed after this local run.'})+'\n',{mode:0o600});
  // Stop only our foreground package. Retain emulator and all account namespaces.
  try{if(iosFlow)sim('terminate',receipt.simulator_udid!,'com.letbuyy.store');else adb('shell','am','force-stop','com.letbuyy.store');}catch{}
  for(const port of reversed)try{adb('reverse','--remove',`tcp:${port}`);}catch{}
  await nativeBrowser?.close();
  if(nativeForward!==undefined)try{adb('forward','--remove',`tcp:${nativeForward}`);}catch{}
  await browser?.close();await stopOwnedClientRuntime(commerce);await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await nativeBff?.settle();await gateway?.settle();await closePooledSqlClients();await proxy.stop();await challenge.close();
  globalThis.fetch=originalFetch;
  for(const server of [api,bff,assetServer])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
