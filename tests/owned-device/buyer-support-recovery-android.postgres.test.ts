// Explicit device-only fixture. PREPARATION is not an execution/window grant.
// Uses one reviewed, already-built APK and one delegated, proven owned emulator.
// Each native phase is a fresh process of that same APK; no Flutter driver,
// token bootstrap, fake app HTTP, screenshot, raw logcat or private ready file.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync,readdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportJWK} from 'jose';
import {chromium,type Browser,type Page} from '@playwright/test';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned=requireOwnedDatabase();
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const THREAD='01a144b4-5327-7851-b8c6-c428a38b38eb',TRANCHE='N6.6-SUPPORT-ANDROID-01',PACKAGE='com.letbuyy.letbuyy';
const PHASES=['create-loss','create-recover-reply-loss','reply-recover-switch','revoked-recover','return-a-recover'] as const;
const EVENTS:Record<typeof PHASES[number],string[]>={
 'create-loss':['identity-needed','actor-ready','pending-preserved'],
 'create-recover-reply-loss':['pending-restored','create-recovered','pending-preserved'],
 'reply-recover-switch':['pending-restored','changed-intent-blocked','reply-recovered','public-history-verified','arm-late-reply','native-logout-observed','release-late-reply','identity-needed','actor-ready','buyer-b-denials-verified','late-ack-fenced','arm-revocation','revoked-pending-kept'],
 'revoked-recover':['identity-needed','revoked-pending-restored','revoked-action-recovered','arm-read-outage','clear-read-outage','unavailable-recovered'],
 'return-a-recover':['identity-needed','late-pending-restored','late-action-recovered'],
};
const PRIVATE=['Synthetic Android support request','Synthetic Android buyer B request','Synthetic Android original complaint','Synthetic Android original public reply','Synthetic Android delayed public reply','Synthetic Android buyer B complaint'];
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const digestFile=(path:string)=>hash(readFileSync(path));
const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
interface WindowGrant {reviewed_by:string;execution_authorized:boolean;target_thread:string;tranche:string;expires_at:string;run_alias:string;device_receipt_sha256:string;fixture_sha256:string;integration_source_sha256:string;apk_sha256:string;all_other_database_browser_terminal:boolean;admissions_frozen:boolean;resource_observations_dir:string;api_port:number;identity_port:number;control_port:number;cdp_port:number;allow_owned_emulator_stop:boolean;}
interface DeviceReceipt {owner_thread:string;target_thread:string;purpose:string;root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;apk:string;apk_sha256:string;source_manifest:string;source_manifest_sha256:string;}
interface Call {phase:string;path:string;method:string;status:number;client_status:number;actor?:'a'|'b';operation?:'create'|'reply';key_digest?:string;body_digest?:string;}

const CRITICAL_APK_INPUTS = [
 "apps/marketplace/mobile/integration_test/buyer_support_recovery_device_test.dart",
 "apps/marketplace/mobile/lib/main.dart",
 "apps/marketplace/mobile/lib/auth/buyer_sign_in_controller.dart",
 "apps/marketplace/mobile/lib/auth/buyer_sign_in_browser.dart",
 "apps/marketplace/mobile/lib/auth/buyer_session_store.dart",
 "apps/marketplace/mobile/lib/auth/buyer_sign_in_wiring.dart",
 "apps/marketplace/mobile/lib/data/buyer_support_commands.dart",
 "apps/marketplace/mobile/lib/data/canonical_api.dart",
 "apps/marketplace/mobile/lib/config/app_config.dart",
 "apps/marketplace/mobile/lib/screens/support/support_chat_screen.dart",
 "apps/marketplace/mobile/lib/screens/support/support_conversations_screen.dart",
 "packages/dart/api_client/lib/src/api_client.dart",
 "packages/dart/api_client/lib/src/buyer_sign_in.dart",
 "packages/dart/api_client/lib/src/buyer_support.dart",
 "packages/dart/marketplace_services/lib/src/ai_chat_service.dart",
 "apps/marketplace/mobile/android/app/src/main/AndroidManifest.xml",
 "apps/marketplace/mobile/android/app/src/debug/AndroidManifest.xml",
 "apps/marketplace/mobile/android/app/src/debug/res/xml/network_security_config.xml",
 "apps/marketplace/mobile/android/app/build.gradle",
 "apps/marketplace/mobile/android/build.gradle",
 "apps/marketplace/mobile/android/settings.gradle",
 "apps/marketplace/mobile/pubspec.yaml",
 "apps/marketplace/mobile/android/app/src/main/kotlin/com/letbuyy/letbuyy/MainActivity.kt",
 "apps/marketplace/mobile/android/app/src/main/kotlin/com/letbuyy/letbuyy/BuyerSignInBridge.kt",
 "apps/marketplace/mobile/android/app/src/main/kotlin/com/letbuyy/letbuyy/BuyerSignInCallbackActivity.kt",
 "pubspec.yaml",
 "pubspec.lock"
] as const;

function assertCriticalInputs(files:readonly {path:string}[]){
 const paths=files.map(f=>f.path);assert.equal(new Set(paths).size,paths.length,'duplicate APK input paths refused');
 for(const required of CRITICAL_APK_INPUTS)assert.ok(paths.includes(required),'complete reviewed APK critical input set required');
}

function live(pid:number){try{process.kill(pid,0);return true;}catch(error){return (error as NodeJS.ErrnoException).code==='EPERM';}}
async function until(check:()=>boolean|Promise<boolean>,timeout=45_000){const end=Date.now()+timeout;while(!await check()){if(Date.now()>end)throw Error('N6_DEVICE_DEADLINE');await delay(100);}}
function gate(){
 const wp=process.env.LETBUYY_N6_SUPPORT_WINDOW_GRANT,rp=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;
 assert.ok(wp&&rp,'reviewed execution window AND exact device receipt are required');
 const window=read(wp) as WindowGrant,receipt=read(rp) as DeviceReceipt;
 assert.equal(window.reviewed_by,'main-coordinator');assert.equal(window.execution_authorized,true);assert.equal(window.target_thread,THREAD);assert.equal(window.tranche,TRANCHE);
 assert.ok(Date.parse(window.expires_at)>Date.now());assert.equal(window.all_other_database_browser_terminal,true);assert.equal(window.admissions_frozen,true);
 assert.equal(window.device_receipt_sha256,digestFile(rp));assert.equal(window.fixture_sha256,digestFile(fileURLToPath(import.meta.url)));
 assert.equal(window.integration_source_sha256,digestFile(join(repo,'apps/marketplace/mobile/integration_test/buyer_support_recovery_device_test.dart')));
 assert.equal(receipt.target_thread,THREAD);assert.equal(receipt.purpose,TRANCHE);assert.ok([THREAD,'01a13a26-2c7f-7672-80e1-a0d0861e4a44'].includes(receipt.owner_thread));
 assert.ok(/^\/private\/tmp\/letbuyy-(?:n1|n6-support)-android-[a-z0-9-]+$/.test(receipt.root));assert.equal(realpathSync(receipt.root),receipt.root);
 assert.ok(/^emulator-\d{4,5}$/.test(receipt.serial));assert.ok(Number.isInteger(receipt.emulator_pid)&&receipt.emulator_pid>1);
 assert.ok(receipt.apk.startsWith(receipt.root+'/'));assert.ok(realpathSync(receipt.apk).startsWith(receipt.root+'/'));assert.ok(realpathSync(receipt.source_manifest).startsWith(receipt.root+'/'));assert.equal(digestFile(receipt.apk),receipt.apk_sha256);assert.equal(receipt.apk_sha256,window.apk_sha256);
 assert.equal(digestFile(receipt.source_manifest),receipt.source_manifest_sha256);
 const source=read(receipt.source_manifest) as {files:{path:string;sha256:string}[];dart_defines:Record<string,string>;application_id:string;mode:string};
 assert.equal(source.application_id,PACKAGE);assert.equal(source.mode,'debug');
 assert.deepEqual(source.dart_defines,{API_BASE_URL:`http://127.0.0.1:${window.api_port}/v1`,IDENTITY_BASE_URL:`http://127.0.0.1:${window.identity_port}`,N6_SUPPORT_CONTROL_ORIGIN:`http://127.0.0.1:${window.control_port}`,N6_SUPPORT_RUN_ALIAS:window.run_alias});
 for(const f of source.files){assert.ok(!f.path.startsWith('/')&&!f.path.split('/').includes('..'));assert.equal(digestFile(join(repo,f.path)),f.sha256);}
 assert.equal(digestFile(join(repo,'packages/dart/marketplace_services/lib/src/ai_chat_service.dart')),'b18d7dca9613dde6ac817389961cf6eed424a7961bddf573f835935a138db91b');
 assertCriticalInputs(source.files);
 for(const p of [window.api_port,window.identity_port,window.control_port,window.cdp_port])assert.ok(Number.isInteger(p)&&p>1024&&p<65536);assert.equal(new Set([window.api_port,window.identity_port,window.control_port,window.cdp_port]).size,4);
 for(const name of readdirSync(window.resource_observations_dir).filter(n=>n.endsWith('.json'))){const item=read(join(window.resource_observations_dir,name));if(['browser','owned_db'].includes(item.kind)&&['starting','running'].includes(item.state)&&live(item.runner_pid))throw Error('N6_EXCLUSIVE_DEVICE_WINDOW_NOT_DRAINED');}
 return {window,receipt};
}

// Inspect the final binary for the known manifest provider literal without
// putting that literal in argv, logs, ready files or evidence. Production source
// remains intact; its removal must be a separately reviewed debug overlay.
function assertNoKnownProviderLiteral(apk:string){
 const manifest=readFileSync(join(repo,'apps/marketplace/mobile/android/app/src/main/AndroidManifest.xml'),'utf8');
 const block=[...manifest.matchAll(/<meta-data\b[^>]*>/g)].map(m=>m[0]).find(s=>s.includes('com.google.android.geo.API_KEY'));assert.ok(block);
 const value=/android:value="([^"]+)"/.exec(block)?.[1];assert.ok(value);assert.equal(hash(value),'5cf297df12f34dc0ae6a9b61ee83bb222297a0161ae500c8c0defd55093924e7');
 const script="import sys,json,zipfile\nkeys=json.load(sys.stdin)\nneedles=[v.encode(e) for v in keys for e in ['utf-8','utf-16-le']]\nhits=0\nwith zipfile.ZipFile(sys.argv[1]) as z:\n for name in z.namelist():\n  if name.endswith('/') : continue\n  with z.open(name) as f:\n   tail=b''\n   while True:\n    chunk=f.read(1048576)\n    if not chunk: break\n    data=tail+chunk\n    if any(v in data for v in needles): hits+=1;break\n    tail=data[-400:]\nprint(json.dumps({'known_provider_literal_matches':hits}))";
 const output=execFileSync('python3',['-c',script,apk],{input:JSON.stringify([value]),encoding:'utf8',timeout:60_000,maxBuffer:4096});assert.equal(JSON.parse(output).known_provider_literal_matches,0);
}

test('final owned Android APK normal Identity PKCE, secure support recovery, actor fencing and public history',{timeout:1_800_000},async(context)=>{
 const {window:w,receipt:r}=gate();assertNoKnownProviderLiteral(r.apk);
 const adb=join(r.sdk_root,'platform-tools/adb');
 const ad=(args:string[],allowAbsent=false)=>{try{return execFileSync(adb,['-s',r.serial,...args],{encoding:'utf8',timeout:20_000,maxBuffer:2*1024*1024}).trim();}catch(error){if(allowAbsent&&(error as {status?:number}).status===1)return '';throw Error('N6_OWNED_ADB_COMMAND_FAILED');}};
 function assertDevice(){
  assert.ok(live(r.emulator_pid));const command=execFileSync('ps',['-p',String(r.emulator_pid),'-o','command='],{encoding:'utf8',timeout:5000});
  assert.ok(command.includes('qemu-system-')&&command.includes('-avd '+r.avd_name)&&command.includes('-port '+r.serial.slice(9)));
  const hardware=readFileSync(join(r.root,'device.avd/hardware-qemu.ini'),'utf8');for(const key of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert.ok(hardware.split('\n').find(l=>l.startsWith(key+' = '))?.split(' = ')[1]?.startsWith(r.root+'/device.avd/'));
  assert.equal(ad(['emu','avd','name']).split('\n')[0],r.avd_name);
 }
 assertDevice();const installed=ad(['shell','pm','path',PACKAGE]).replace(/^package:/,'');assert.ok(installed.startsWith('/data/app/'));assert.equal(ad(['shell','sha256sum',installed]).split(/\s+/)[0],r.apk_sha256);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${w.identity_port}`;
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}));
 const sites={a:newSyntheticTenant('n6-android-a'),b:newSyntheticTenant('n6-android-b')};for(const site of Object.values(sites))seedSyntheticTenant(owned.psql,site);
 const emails={a:`syn-n6-android-a-${crypto.randomUUID()}@example.invalid`,b:`syn-n6-android-b-${crypto.randomUUID()}@example.invalid`},password='Synthetic-owned-Android-pass-42';
 const actors:Partial<Record<'a'|'b',string>>={},orders:Partial<Record<'a'|'b',string>>={},seedTickets:Partial<Record<'a'|'b',string>>={};
 const observedTokens=new Set<string>();
 const tokenActors=new Map<string,'a'|'b'>(),calls:Call[]=[],phaseEvents=new Set<string>(),processes:{phase:string;pid:string;framework_passed:boolean}[]=[],storageProof:unknown[]=[];
 const actions=new Map<string,{key:string;body_digest:string;actor:'a'|'b';operation:'create'|'reply';ticket?:string}>();
 let phase:typeof PHASES[number]=PHASES[0],frameworkDone=false,phaseAssertions=false,failure:string|null=null,identityStage='idle',createdTicket:string|undefined,historyTicket:string|undefined;
 let createLoss=true,replyLoss=false,lateArmed=false,lateCommitted=false,lateReleased=false,revokeArmed=false,revoked=false,readOutage=false,revocationBefore:string|undefined,changedBefore=0;
 let closing=false;
 let lateRelease:(()=>void)|undefined;let lateGate:Promise<void>|undefined;
 let apiServer:Server|undefined,controlServer:Server|undefined,identity:OwnedClientProcess|undefined;const browsers=new Set<Browser>(),identityTasks:Promise<void>[]=[];
 const serialProof={serial:r.serial,avd_name:r.avd_name,emulator_pid:r.emulator_pid,apk_sha256:r.apk_sha256};
 const snapshot=()=>owned.psql(`SELECT (SELECT count(*) FROM buyer_support_mutation_receipts),(SELECT count(*) FROM audit_logs WHERE action LIKE 'buyer.support.%'),(SELECT count(*) FROM support_tickets),(SELECT count(*) FROM ticket_messages);`);
 const countWrites=()=>calls.filter(c=>c.method==='POST'&&c.operation).length;
 const state=()=>({run_alias:w.run_alias,owned_db_run_id:owned.runId,phase,buyer_a:actors.a,buyer_b:actors.b,order_a:orders.a,order_b:orders.b,created_ticket:createdTicket,history_ticket:historyTicket,buyer_b_ticket:seedTickets.b,late_committed:lateCommitted,late_released:lateReleased});
 const persist=()=>writeFileSync(join(r.root,'support-progress.json'),JSON.stringify({...state(),serialProof,calls,processes,storageProof,identity_stage:identityStage,failure},null,2)+'\n',{mode:0o600});
 const receiptFor=(actionName:string)=>{const action=actions.get(actionName);assert.ok(action);return JSON.parse(owned.psql(`SELECT response::text FROM buyer_support_mutation_receipts WHERE buyer_account_id='${actors[action.actor]}' AND idempotency_key='${action.key}';`)||'null');};
 function remember(name:string,key:string,body:string,actor:'a'|'b',operation:'create'|'reply',ticket?:string){
  assert.ok(/^[A-Za-z0-9_-]{8,200}$/.test(key));const previous=actions.get(name),value={key,body_digest:hash(body),actor,operation,ticket};if(previous)assert.deepEqual(previous,value);else actions.set(name,value);
 }
 function seed(actor:'a'|'b',id:string){
  assert.ok(/^[0-9a-f-]{36}$/.test(id));assert.equal(owned.psql(`SELECT id FROM buyer_accounts WHERE email='${emails[actor]}' AND status='active';`),id);actors[actor]=id;
  const order=seedSyntheticOrder(owned.psql,sites[actor]);orders[actor]=order.orderId;
  owned.psql(`INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${order.orderId}','${id}','${sites[actor].siteId}','authenticated_checkout');`);
  const ticket=crypto.randomUUID();seedTickets[actor]=ticket;
  owned.psql(`INSERT INTO support_tickets(id,ticket_ref,site_id,requester_type,requester_user_id,subject,channel,status,created_at)VALUES('${ticket}','SYN-${ticket}','${sites[actor].siteId}','customer','${id}','Synthetic Android seeded history','chat','open',now()-interval '2 days');`);
  if(actor==='a'){
   historyTicket=ticket;owned.psql(`INSERT INTO support_tickets(ticket_ref,site_id,requester_type,requester_user_id,subject,channel,status,created_at)SELECT 'SYN-'||gen_random_uuid(),'${sites.a.siteId}','customer','${id}','Synthetic Android older ticket '||n,'chat','open',now()-n*interval '1 minute' FROM generate_series(1,54)n;
    INSERT INTO ticket_messages(ticket_id,author_type,visibility,body,created_at)SELECT '${ticket}','agent','public','Synthetic Android public history '||n,now()-interval '1 day'+n*interval '1 second' FROM generate_series(1,205)n;
    INSERT INTO ticket_messages(ticket_id,author_type,visibility,body)VALUES('${ticket}','agent','internal','Synthetic Android internal note');`);
  }
 }
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(revokeArmed&&call.resource==='rpc/execute_buyer_support_mutation'){
   assert.equal((call.json as {p_buyer_account_id?:string}).p_buyer_account_id,actors.b);revocationBefore=snapshot();owned.psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${actors.b}';`);revokeArmed=false;revoked=true;
  }
  return forward();
 });
 async function authenticate(mode:string){
  const authUntil=(check:()=>boolean|Promise<boolean>,timeout:number)=>until(()=>{if(closing)throw Error('N6_IDENTITY_STOPPING');return check();},timeout);
  let browser:Browser|undefined;
  try{
   const actor=mode.startsWith('a-')?'a':'b',creating=mode.endsWith('-create');identityStage=mode+':custom-tab';persist();
   await authUntil(async()=>{try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${w.cdp_port}`,{timeout:1500});return true;}catch{return false;}},90_000);browsers.add(browser!);
   let page:Page|undefined;
   await authUntil(()=>{const found=browser!.contexts().flatMap(c=>c.pages()).find(p=>{try{const u=new URL(p.url());return u.origin===identityOrigin&&u.pathname==='/buyer/authorize'&&u.searchParams.get('client_id')==='letbuyy-marketplace-app';}catch{return false;}});if(found)page=found;return Boolean(found);},90_000);
   page!.setDefaultTimeout(90_000);await page!.waitForLoadState('networkidle');
   const different=page!.getByRole('button',{name:'Use a different account',exact:true});
   if(creating||mode==='a-login')if(await different.count()){identityStage=mode+':normal-account-switch';const [out]=await Promise.all([page!.waitForResponse(r=>r.url().endsWith('/api/buyer/logout')&&r.request().method()==='POST'),different.click()]);assert.equal(out.status(),200);}
   const consent=page!.getByRole('button',{name:'Continue to the LetBuyy app',exact:true});
   if(!await consent.count()){
    identityStage=mode+':credentials';if(creating)await page!.getByRole('link',{name:'Create an account',exact:true}).click();
    await page!.locator('input[name="cf-turnstile-response"]').waitFor({state:'attached'});
    await authUntil(async()=>Boolean(await page!.locator('input[name="cf-turnstile-response"]').inputValue()),90_000);
    await page!.getByLabel('Email',{exact:true}).fill(emails[actor]);await page!.getByLabel('Password',{exact:true}).fill(password);
    const endpoint=creating?'/api/buyer/register':'/api/buyer/login';const [result]=await Promise.all([page!.waitForResponse(r=>r.url().endsWith(endpoint)&&r.request().method()==='POST'),page!.getByRole('button',{name:creating?'Create account':'Sign in',exact:true}).click()]);assert.equal(result.status(),creating?201:200);
   }
   identityStage=mode+':explicit-consent';const before=calls.filter(c=>c.path==='/v1/storefront/buyer/authorization-codes/redeem'&&c.status===200).length;
   await consent.click();await authUntil(()=>calls.filter(c=>c.path==='/v1/storefront/buyer/authorization-codes/redeem'&&c.status===200).length>before,45_000);
   identityStage=mode+':native-exchange-observed';persist();
  }catch{failure='N6_NORMAL_ANDROID_IDENTITY_FAILED';persist();}
  finally{if(browser){await browser.close().catch(()=>undefined);browsers.delete(browser);}}
 }
 async function event(data:Record<string,unknown>){
  const name=data.event;assert.equal(typeof name,'string');assert.ok([...EVENTS[phase],'phase-assertions-finished','framework-finished'].includes(String(name)),'event must belong to current phase');assert.ok(Object.keys(data).every(k=>['event','actor','buyer_id','operation','key_digest','phase','framework_passed','messages','pages'].includes(k)));phaseEvents.add(String(name));
  if(name==='identity-needed'){assert.ok(['a-create','b-create','b-login','a-login'].includes(String(data.actor)));const task=authenticate(String(data.actor));identityTasks.push(task);}
  else if(name==='actor-ready'){const actor=data.actor as 'a'|'b';assert.ok(actor==='a'||actor==='b');assert.equal(actors[actor],undefined);seed(actor,String(data.buyer_id));}
  else if(name==='pending-preserved'||name==='pending-restored'){
   const action=actions.get(data.operation==='create'?'a-create':'a-reply');assert.ok(action);assert.equal(data.key_digest,hash(action.key));assert.ok(receiptFor(data.operation==='create'?'a-create':'a-reply'));if(name==='pending-restored')changedBefore=countWrites();
  }else if(name==='create-recovered'){const result=receiptFor('a-create');assert.ok(result);createdTicket=result.id;createLoss=false;replyLoss=true;}
  else if(name==='changed-intent-blocked')assert.equal(countWrites(),changedBefore);
  else if(name==='reply-recovered'){assert.ok(receiptFor('a-reply'));replyLoss=false;}
  else if(name==='public-history-verified'){assert.equal(data.messages,205);assert.equal(data.pages,3);}
  else if(name==='arm-late-reply'){lateArmed=true;lateGate=new Promise<void>(resolve=>{lateRelease=resolve;});}
  else if(name==='native-logout-observed')assert.equal(phase,'reply-recover-switch');
  else if(name==='release-late-reply'){assert.ok(phaseEvents.has('native-logout-observed'));assert.ok(lateCommitted);lateRelease!();}
  else if(name==='late-ack-fenced'||name==='late-pending-restored'){const action=actions.get('a-late');assert.ok(action);assert.equal(data.key_digest,hash(action.key));assert.ok(receiptFor('a-late'));}
  else if(name==='arm-revocation')revokeArmed=true;
  else if(name==='revoked-pending-kept'){assert.ok(revoked);const a=actions.get('b-create');assert.ok(a);assert.equal(data.key_digest,hash(a.key));assert.equal(snapshot(),revocationBefore);}
  else if(name==='revoked-pending-restored'){const a=actions.get('b-create');assert.ok(a);assert.equal(data.key_digest,hash(a.key));}
  else if(name==='revoked-action-recovered')assert.ok(receiptFor('b-create'));
  else if(name==='arm-read-outage')readOutage=true;
  else if(name==='clear-read-outage'){assert.ok(calls.some(c=>c.phase===phase&&c.path.endsWith('/buyer/support/tickets')&&c.client_status===503));readOutage=false;}
  else if(name==='phase-assertions-finished'){assert.equal(data.phase,phase);phaseAssertions=true;}
  else if(name==='framework-finished'){assert.equal(data.phase,phase);assert.equal(data.framework_passed,true);assert.ok(phaseAssertions);for(const required of EVENTS[phase])assert.ok(phaseEvents.has(required),'all phase milestones required');frameworkDone=true;}
  else assert.ok(['buyer-b-denials-verified','unavailable-recovered','late-action-recovered'].includes(String(name)),'unknown native event');
  persist();return state();
 }
 function inspectPrefs(){
  const files=ad(['shell','run-as',PACKAGE,'ls','shared_prefs']).split(/\s+/).filter(Boolean);assert.ok(files.length>0&&files.length<40);
  const evidence=[];for(const name of files){assert.ok(/^[A-Za-z0-9_.-]+\.xml$/.test(name));const value=ad(['shell','run-as',PACKAGE,'cat','shared_prefs/'+name]);assert.equal([...PRIVATE,...observedTokens,...[...actions.values()].map(a=>a.key)].some(marker=>value.includes(marker)),false);evidence.push({file:name,sha256:hash(value),bytes:Buffer.byteLength(value),private_text_matches:0});}
  storageProof.push({phase,files:evidence});
 }
 try{
  apiServer=createServer(async(req,res)=>{try{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),url=new URL(req.url??'/',identityOrigin),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const token=headers.get('X-LetBuyy-Buyer-Session');if(token)observedTokens.add(token);const actor=token?tokenActors.get(hash(token)):undefined;
   const operation=req.method==='POST'&&url.pathname==='/v1/storefront/buyer/support/tickets'?'create':req.method==='POST'&&/^\/v1\/storefront\/buyer\/support\/tickets\/[^/]+\/messages$/.test(url.pathname)?'reply':undefined;
   if(readOutage&&req.method==='GET'&&url.pathname.startsWith('/v1/storefront/buyer/support/')){calls.push({phase,path:url.pathname,method:req.method,status:503,client_status:503,actor});res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":{"code":"SYNTHETIC_READ_UNAVAILABLE","message":"Support is temporarily unavailable."}}');persist();return;}
   const result=await gateway.request(url.pathname+url.search,{method:req.method,headers,...(body?{body}:{})});
   if(token&&url.pathname==='/v1/storefront/buyer/account'&&result.status===200){const id=result.json?.data?.buyer?.id;for(const a of ['a','b'] as const)if(owned.psql(`SELECT id FROM buyer_accounts WHERE email='${emails[a]}';`)===id)tokenActors.set(hash(token),a);}
   const entry:Call={phase,path:url.pathname,method:req.method??'GET',status:result.status,client_status:result.status,actor:token?tokenActors.get(hash(token)):actor,operation};
   if(operation){assert.ok(entry.actor);assert.equal(headers.get('X-Client'),'flutter-customer');const key=headers.get('X-Idempotency-Key');assert.ok(key);entry.key_digest=hash(key);entry.body_digest=hash(body);
    const name=entry.actor==='b'?'b-create':operation==='create'?'a-create':lateArmed?'a-late':'a-reply';remember(name,key,body,entry.actor,operation,operation==='reply'?url.pathname.split('/').at(-2):undefined);
    if(entry.actor==='a'&&result.status===201&&((operation==='create'&&createLoss)||(operation==='reply'&&replyLoss))){entry.client_status=503;calls.push(entry);persist();res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":{"code":"SYNTHETIC_COMMITTED_REPLY_LOSS","message":"The result is unknown. Retry the saved request."}}');return;}
    if(name==='a-late'&&result.status===201&&!lateCommitted){lateCommitted=true;calls.push(entry);persist();await lateGate;assert.equal(res.destroyed,false,'late response must still reach the signed-out app before its timeout');lateReleased=true;}
    else calls.push(entry);
   }else calls.push(entry);
   res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);persist();
  }catch{failure='N6_NATIVE_GATEWAY_ADAPTER_FAILED';persist();if(!res.headersSent)res.writeHead(500);res.end('{}');}});
  controlServer=createServer(async(req,res)=>{try{
   assert.equal(req.headers['x-n6-run-alias'],w.run_alias);const path=new URL(req.url??'/','http://127.0.0.1').pathname;
   let output;if(req.method==='GET'&&path==='/state')output=state();else{assert.equal(req.method,'POST');assert.equal(path,'/events');let body='';for await(const chunk of req){body+=chunk;assert.ok(body.length<4096);}output=await event(JSON.parse(body));}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(output));
  }catch{failure='N6_NATIVE_CONTROL_PROTOCOL_FAILED';persist();res.writeHead(409);res.end('{}');}});
  for(const [server,port]of [[apiServer,w.api_port],[controlServer,w.control_port]] as const)await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next',{port:w.identity_port,env:{LETBUYY_API_URL:`http://127.0.0.1:${w.api_port}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  await until(async()=>{assert.equal(identity!.exitCode,null);try{return(await fetch(identityOrigin+'/api/buyer/login',{signal:AbortSignal.timeout(2000)})).status<500;}catch{return false;}},180_000);
  for(const port of [w.api_port,w.identity_port,w.control_port])ad(['reverse',`tcp:${port}`,`tcp:${port}`]);ad(['forward',`tcp:${w.cdp_port}`,'localabstract:chrome_devtools_remote']);
  for(const next of PHASES){
   phase=next;phaseEvents.clear();phaseAssertions=false;frameworkDone=false;failure=null;if(phase!=='create-loss')createLoss=false;if(phase!=='create-recover-reply-loss')replyLoss=false;
   assertDevice();ad(['shell','am','force-stop',PACKAGE]);await until(()=>ad(['shell','pidof',PACKAGE],true)==='');persist();
   ad(['shell','am','start','-n',`${PACKAGE}/.MainActivity`]);await until(()=>Boolean(ad(['shell','pidof',PACKAGE],true)));const pid=ad(['shell','pidof',PACKAGE]);assert.ok(!processes.some(p=>p.pid===pid));
   await until(()=>{context.signal.throwIfAborted();assertDevice();if(failure)throw Error(failure);assert.equal(identity!.exitCode,null);return frameworkDone;},360_000);
   await Promise.all(identityTasks);if(failure)throw Error(failure);inspectPrefs();processes.push({phase,pid,framework_passed:true});persist();
  }
  for(const name of ['a-create','a-reply','a-late','b-create']){const a=actions.get(name);assert.ok(a);const result=receiptFor(name);assert.ok(result);assert.equal(result.mutation_receipt.key,a.key);assert.equal(owned.psql(`SELECT count(*) FROM buyer_support_mutation_receipts WHERE buyer_account_id='${actors[a.actor]}' AND idempotency_key='${a.key}';`),'1');
   assert.equal(owned.psql(`SELECT count(*) FROM ticket_messages WHERE id='${result.mutation_receipt.message_id}' AND ticket_id='${result.mutation_receipt.ticket_id}' AND author_id='${actors[a.actor]}' AND author_type='requester' AND visibility='public';`),'1');
   const attempts=calls.filter(c=>c.key_digest===hash(a.key));assert.ok(attempts.length>=2);assert.equal(new Set(attempts.map(c=>c.body_digest)).size,1);
  }
  assert.equal(actions.size,4);assert.equal(owned.psql('SELECT count(*) FROM buyer_support_mutation_receipts;'),'4');assert.equal(owned.psql("SELECT count(*) FROM audit_logs WHERE action LIKE 'buyer.support.%';"),'4');
  assert.equal(owned.psql("SELECT count(*) FROM outbox_events WHERE event_type='audit.recorded' AND payload->>'action' LIKE 'buyer.support.%';"),'0','general platform tickets have no fabricated site');
  assert.equal(processes.length,5);assert.ok(revoked&&lateReleased);assert.ok(calls.filter(c=>c.operation==='create'&&c.actor==='b').some(c=>c.status===401));
  assert.ok(calls.some(c=>c.actor==='b'&&c.path.includes(createdTicket!)&&[403,404].includes(c.status)));assert.ok(calls.some(c=>c.actor==='b'&&c.path.endsWith(orders.a!)&&[403,404].includes(c.status)));
  const signature='public.execute_buyer_support_mutation(uuid,integer,text,uuid,text,jsonb,text,timestamptz,timestamptz)';
  assert.equal(owned.psql(`SELECT has_function_privilege('anon','${signature}','EXECUTE'),has_function_privilege('authenticated','${signature}','EXECUTE'),has_function_privilege('app_tenant','${signature}','EXECUTE'),has_function_privilege('service_role','${signature}','EXECUTE');`),'f|f|f|t');
  for(const role of ['anon','authenticated','app_tenant'])assert.ok(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM public.buyer_support_mutation_receipts;ROLLBACK;`).includes('permission denied'));
  writeFileSync(join(r.root,'support-backend-verified.json'),JSON.stringify({tranche:TRANCHE,run_id:owned.runId,run_alias:w.run_alias,serialProof,processes,calls,storageProof,receipt_count:4,audit_count:4,late_ack_after_logout:true,scope:'Normal owned Android app/PKCE/secure support recovery. Orders/history are synthetic fixture prerequisites; no normal checkout, provider/physical/hosted acceptance.'},null,2)+'\n',{mode:0o600});
 }finally{
  closing=true;
  const cleanupSteps:{step:string;ok:boolean}[]=[];
  const attempt=async(step:string,run:()=>unknown|Promise<unknown>)=>{
   try{await run();cleanupSteps.push({step,ok:true});}catch{cleanupSteps.push({step,ok:false});}
  };
  await attempt('late-release',()=>lateRelease?.());
  let browserIndex=0;for(const browser of browsers)await attempt('browser-close-'+browserIndex++,()=>browser.close());
  await attempt('identity-tasks',async()=>{const settled=await Promise.allSettled(identityTasks);assert.ok(settled.every(result=>result.status==='fulfilled'));});
  await attempt('rest-tap-restore',()=>tap.restore());
  // Every device action rechecks the delegated serial/PID/private AVD before
  // touching it. Failed ownership never widens cleanup to another device.
  await attempt('app-stop',async()=>{assertDevice();ad(['shell','am','force-stop',PACKAGE]);await until(()=>ad(['shell','pidof',PACKAGE],true)==='');});
  for(const port of [w.api_port,w.identity_port,w.control_port])await attempt('reverse-remove-'+port,()=>{assertDevice();ad(['reverse','--remove',`tcp:${port}`]);});
  await attempt('forward-remove',()=>{assertDevice();ad(['forward','--remove',`tcp:${w.cdp_port}`]);});
  await attempt('identity-stop',()=>stopOwnedClientRuntime(identity));
  await attempt('gateway-settle',()=>gateway.settle());
  for(const [name,server]of [['api-server-close',apiServer],['control-server-close',controlServer]] as const)await attempt(name,async()=>{
   if(server){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  });
  await attempt('emulator-stop',async()=>{assert.equal(w.allow_owned_emulator_stop,true);assertDevice();ad(['emu','kill']);await until(()=>!live(r.emulator_pid),20_000);});
  const succeeded=(step:string)=>cleanupSteps.some(result=>result.step===step&&result.ok);
  const cleanupFailures=cleanupSteps.filter(result=>!result.ok).map(result=>result.step);
  const report={run_id:owned.runId,serial:r.serial,app_stopped:succeeded('app-stop'),owned_forwards_removed:succeeded('forward-remove')&&[w.api_port,w.identity_port,w.control_port].every(port=>succeeded('reverse-remove-'+port)),owned_emulator_pid_gone:!live(r.emulator_pid),identity_stopped:succeeded('identity-stop'),servers_closed:succeeded('api-server-close')&&succeeded('control-server-close'),steps:cleanupSteps,cleanup_failures:cleanupFailures,prior_failure:failure,controller_fallback_required:cleanupFailures.length>0};
  // Always attempt every owned cleanup before reporting failure. The exact
  // owning coordinator controller remains responsible for guarded fallback.
  try{writeFileSync(join(r.root,'support-device-cleanup.json'),JSON.stringify(report,null,2)+'\n');}
  catch{console.info('N6_DEVICE_CLEANUP_RECEIPT '+JSON.stringify({...report,receipt_write_failed:true}));throw Error('N6_DEVICE_CLEANUP_RECEIPT_WRITE_FAILED');}
  if(cleanupFailures.length)throw Error('N6_DEVICE_SCOPED_CLEANUP_FAILED');
  assert.equal(failure,null);
 }
});
