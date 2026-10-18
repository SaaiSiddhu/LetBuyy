// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Explicit owned-device lane: actual Android/system-browser UI and file bytes,
// independently checked against the canonical Gateway and owned database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import bcrypt from 'bcryptjs';
import {exportJWK} from 'jose';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,seedBuyerAccount} from '../owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),apiPort=54340,identityPort=54341;
test('actual Android account privacy entry and system-browser single-use export isolate buyers and survive restart',{timeout:1800000},async(context)=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit owned emulator receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8')) as {root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;owner_thread:string;apk_sha256:string;apk:string};
 assert.equal(receipt.owner_thread,'01a13a26-2c7f-7672-80e1-a0d0861e4a44');assert.ok(/^\/private\/tmp\/letbuyy-n1-android-[a-z0-9]+$/.test(receipt.root));assert.equal(realpathSync(receipt.root),receipt.root);
 process.kill(receipt.emulator_pid,0);const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert.ok(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port '+receipt.serial.slice(9)));
 const hardware=readFileSync(join(receipt.root,'device.avd/hardware-qemu.ini'),'utf8');
 for(const part of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert.ok(hardware.split('\n').find(l=>l.startsWith(part+' = '))?.split(' = ')[1]?.startsWith(receipt.root+'/device.avd/'),part);
 const adb=join(receipt.sdk_root,'platform-tools/adb');assert.equal(execFileSync(adb,['-s',receipt.serial,'emu','avd','name'],{encoding:'utf8'}).trim().split('\n')[0].trim(),receipt.avd_name);
 const installedPath=execFileSync(adb,['-s',receipt.serial,'shell','pm','path','com.letbuyy.letbuyy'],{encoding:'utf8'}).trim().replace(/^package:/,'');assert.ok(installedPath.startsWith('/data/app/'));
 assert.equal(execFileSync(adb,['-s',receipt.serial,'shell','sha256sum',installedPath],{encoding:'utf8'}).trim().split(/\s+/)[0],receipt.apk_sha256);

 const root=join(receipt.root,'privacy-readback');mkdirSync(root,{recursive:true});const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');assert.equal(existsSync(done),false);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`;
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_KMS_MODE:'sandbox',LETBUYY_KMS_SANDBOX_SECRET:'synthetic-device-export-'+crypto.randomUUID()}));
 const buyers=[seedBuyerAccount(owned.psql,'privacy-native-a'),seedBuyerAccount(owned.psql,'privacy-native-b')],password='Synthetic-native-export-password-42',hash=await bcrypt.hash(password,10);
 const site=newSyntheticTenant('privacy-native');seedSyntheticTenant(owned.psql,site);
 for(const [index,b] of buyers.entries()){
  owned.psql(`UPDATE buyer_accounts SET password_hash='${hash}',full_name='Synthetic Native Privacy ${index===0?'A':'B'}' WHERE id='${b.id}';
   INSERT INTO buyer_addresses(buyer_account_id,full_name,phone,address_line1,city,state,postal_code,country) VALUES('${b.id}','Synthetic recipient','9999999999','Private native address ${index===0?'A':'B'}','Synthetic city','Synthetic state','600001','IN');`);
  const order=seedSyntheticOrder(owned.psql,site);owned.psql(`INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis) VALUES('${order.orderId}','${b.id}','${site.siteId}','authenticated_checkout');`);
 }
 const calls:{path:string;method:string;status:number}[]=[];let adapter:Server|undefined,identity:OwnedClientProcess|undefined;
 try{
  adapter=createServer(async(req,res)=>{
   try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
    for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
    const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});calls.push({path:(req.url??'').split('?')[0],method:req.method??'GET',status:result.status});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
   }catch{res.writeHead(500);res.end('{}');}
  });await new Promise<void>((r,reject)=>{adapter!.once('error',reject);adapter!.listen(apiPort,'127.0.0.1',r);});
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{NODE_ENV:'production',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  const deadline=Date.now()+300000;let live=false;
  while(Date.now()<deadline){if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped before readiness');try{if((await fetch(identityOrigin+'/buyer/privacy',{signal:AbortSignal.timeout(2500)})).status===200){live=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(live);
  for(const port of [apiPort,identityPort])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,buyers:buyers.map((b,index)=>({id:b.id,email:b.email,name:'Synthetic Native Privacy '+(index===0?'A':'B')})),password,identity_origin:identityOrigin,apk_sha256:receipt.apk_sha256,scope:'Actual native normal sign-in/entry and browser file release. Official test CAPTCHA, synthetic local KMS, no provider/hosted proof.'},null,2)+'\n',{mode:0o600});console.info('OWNED_PRIVACY_ANDROID_READY '+ready);
  let count=-1;while(!existsSync(done)){
   context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped during device verification');
   if(count!==calls.length){count=calls.length;writeFileSync(join(root,'backend-progress.json'),JSON.stringify({run_id:owned.runId,calls},null,2)+'\n');}await new Promise(r=>setTimeout(r,500));
  }
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[];files:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['normal-native-login-a','native-privacy-entry-a','fresh-password-a','actual-file-a','restart-release-readback-a','normal-native-login-b','native-privacy-entry-b','stale-hint-refused','actual-file-b'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=6);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  assert.equal(proof.files.length,2);
  for(const [index,path]of proof.files.entries()){
   assert.ok(path.startsWith(root+'/'));const bytes=readFileSync(path),body=JSON.parse(bytes.toString()),buyer=buyers[index];assert.equal(body.buyerAccountId,buyer.id);assert.equal(body.complete,true);assert.equal(body.sections.profile[0].email,buyer.email);assert.equal(body.sections.addresses.length,1);assert.equal(body.sections.orders.length,1);assert.ok(!bytes.includes(Buffer.from(buyers[1-index].email)));assert.doesNotMatch(bytes.toString(),/password_hash|session_epoch|encrypted_payload/);
   const row=JSON.parse(owned.psql(`SELECT jsonb_build_object('digest',payload_digest,'status',status) FROM customer_dsr_exports WHERE buyer_account_id='${buyer.id}';`));assert.equal(row.status,'delivered');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.digest);
   assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${buyer.id}' AND action='buyer.privacy.export_released';`),'1');assert.equal(owned.psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${buyer.id}' AND topic='privacy' AND metadata->>'fulfillment_outcome'='fulfilled';`),'1');
  }
  assert.ok(calls.filter(c=>c.path==='/v1/storefront/buyer/authorization-codes/redeem'&&c.status===200).length>=2);
  assert.equal(calls.filter(c=>/\/export$/.test(c.path)&&c.method==='POST'&&c.status===201).length,2);assert.equal(calls.filter(c=>/\/download$/.test(c.path)&&c.method==='POST'&&c.status===200).length,2);
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,apk_sha256:receipt.apk_sha256,buyers:2,exactFileDigests:true,singleReleaseEach:true,normalNativePkce:true,actualNativePrivacyEntry:true,actualSystemBrowser:true,calls,scope:'Owned Android/local integration verified; official test challenge and synthetic KMS; live KMS/hosted unverified.'},null,2)+'\n');
 }finally{
  for(const port of [apiPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();if(adapter){adapter.closeAllConnections();await new Promise<void>(r=>adapter!.close(()=>r()));}
 }
});
