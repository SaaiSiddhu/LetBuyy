// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Controlled native device fixture, explicitly selected outside ordinary CI lanes.
// UI observations AND actual BFF/Gateway/database effects are required; a marker alone is insufficient.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {exportJWK} from 'jose';
import mobileBff from '../../services/mobile-bff/src/index';
import {runLoyaltyEarnSweeper} from '../../services/queue-workers/src/loyalty-earn';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase();
const apiPort=54352,bffPort=54350,identityPort=54351;
test('actual Merchant Android loyalty settings, durable retry, policy and account isolation',{timeout:1_800_000},async(context)=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit owned emulator receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8')) as {root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;owner_thread:string;apk_sha256:string;apk:string};
 assert.equal(receipt.owner_thread,'01a13a26-2c7f-7672-80e1-a0d0861e4a44');assert.ok(/^\/private\/tmp\/letbuyy-n1-android-[a-z0-9]+$/.test(receipt.root));assert.equal(realpathSync(receipt.root),receipt.root);
 process.kill(receipt.emulator_pid,0);const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert.ok(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port '+receipt.serial.slice(9)));
 const hardware=readFileSync(join(receipt.root,'device.avd/hardware-qemu.ini'),'utf8');
 for(const part of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert.ok(hardware.split('\n').find(l=>l.startsWith(part+' = '))?.split(' = ')[1]?.startsWith(receipt.root+'/device.avd/'),part);
 const adb=join(receipt.sdk_root,'platform-tools/adb');assert.equal(execFileSync(adb,['-s',receipt.serial,'emu','avd','name'],{encoding:'utf8'}).trim().split('\n')[0].trim(),receipt.avd_name);
 const installedPath=execFileSync(adb,['-s',receipt.serial,'shell','pm','path','com.letbuyy.store'],{encoding:'utf8'}).trim().replace(/^package:/,'');assert.ok(installedPath.startsWith('/data/app/'));
 assert.equal(execFileSync(adb,['-s',receipt.serial,'shell','sha256sum',installedPath],{encoding:'utf8'}).trim().split(/\s+/)[0],receipt.apk_sha256);

 const root=join(receipt.root,'loyalty-settings');mkdirSync(root,{recursive:true});
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json'),control=join(root,'journey-control.json');assert.equal(existsSync(done),false);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,adminOrigin='http://127.0.0.1:54353';
 const proxy=await startOwnedPooledSqlProxy(owned);
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,RESEND_API_KEY:'',...proxy.env()}));
 const tenant=newSyntheticTenant('native-loyalty-a'),other=newSyntheticTenant('native-loyalty-b');for(const t of [tenant,other])seedSyntheticTenant(owned.psql,t);
 const owner=crypto.randomUUID(),rival=crypto.randomUUID(),buyer=crypto.randomUUID(),order=crypto.randomUUID();
 const password='Synthetic-loyalty-native-pass-42',email=`syn-native-loy-${owner}@example.invalid`,rivalEmail=`syn-native-loy-${rival}@example.invalid`,hash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic Loyalty Owner','${hash}'),('${rival}','${rivalEmail}',true,'Synthetic Loyalty Other','${hash}');
 UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${rival}' WHERE id='${other.siteId}';`);
 type Call={path:string;method:string;status:number;source:string;keyDigest?:string;store?:string;bodyDigest?:string;clientStatus?:number};
 const calls:Call[]=[];let readOutage=true,lostReply=false,earned=false,lastBHeaders:Headers|undefined;
 const audits=()=>owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_type='loyalty_program' AND resource_id='${tenant.siteId}';`);
 const settings=()=>JSON.parse(owned.psql(`SELECT jsonb_build_object('active',is_active,'earn_rate_bps',earn_rate_bps,'redeem_cap_bps',redeem_cap_bps,'point_value_minor',point_value_minor::text,'updated_at',updated_at::text)FROM loyalty_programs WHERE site_id='${tenant.siteId}';`)||'null');
 const publish=()=>writeFileSync(join(root,'backend-progress.json'),JSON.stringify({run_id:owned.runId,calls,settings:settings(),audits:audits(),earned},null,2)+'\n');
 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url),body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
  const path=url.pathname,method=request.method;
  const command=existsSync(control)?JSON.parse(readFileSync(control,'utf8')) as {readOutage?:boolean;earn?:boolean}:{};
  if(command.readOutage===false)readOutage=false;
  if(command.earn&&!earned&&path==='/v1/loyalty/program'&&method==='GET'){
   assert.equal(settings().earn_rate_bps,1234,'earn only after the actual Android save');assert.equal(settings().active,true);
   owned.psql(`INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${buyer}','syn-native-loy-buyer-${buyer}@example.invalid',true);
    INSERT INTO orders(id,site_id,store_id,order_number,customer_email,shipping_address,items,total,subtotal,payment_status)VALUES('${order}','${tenant.siteId}','${tenant.siteId}','SYN-${order}','syn-native-loy-buyer-${buyer}@example.invalid','{}','[]',1000,1000,'paid');
    INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${order}','${buyer}','${tenant.siteId}','authenticated_checkout');`);
   assert.equal((await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-native-loyalty-earn',limit:1})).awarded,1);earned=true;
  }
  if(path==='/v1/loyalty/program'&&method==='GET'&&readOutage){
   calls.push({path,method,status:503,clientStatus:503,source});publish();
   return Response.json({error:{code:'SYNTHETIC_LOYALTY_READ_OUTAGE',message:'Synthetic loyalty read outage. Retry loading.'}},{status:503});
  }
  const result=await gateway.request(path+url.search,{method,headers:request.headers,...(body?{body}:{})});
  const parsed=body?JSON.parse(body):{},key=request.headers.get('X-Idempotency-Key');
  const store=url.searchParams.get('store_id')||parsed.store_id;
  const call:Call={path,method,status:result.status,clientStatus:result.status,source,store,keyDigest:key?createHash('sha256').update(key).digest('hex'):undefined,bodyDigest:body?createHash('sha256').update(body).digest('hex'):undefined};calls.push(call);
  if(path==='/v1/loyalty/program'&&source==='actual-mobile-bff'&&store===other.siteId&&result.status===200)lastBHeaders=new Headers(request.headers);
  if(path==='/v1/loyalty/program'&&method==='PUT'&&result.status===200&&!lostReply){
   lostReply=true;call.clientStatus=503;publish();
   return Response.json({error:{code:'SYNTHETIC_COMMITTED_REPLY_LOSS',message:'The save outcome is unknown. Retry the same save.'}},{status:503});
  }
  if(path==='/v1/loyalty/program')publish();
  return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,ENVIRONMENT:'local',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body?{body}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch(error){console.info('OWNED_LOYALTY_NATIVE_BRIDGE_ERROR '+(error instanceof Error?error.message:'unknown'));res.writeHead(500);res.end('{}');}
 });
 let api:Server|undefined,bff:Server|undefined,identity:OwnedClientProcess|undefined;
 try{
  api=bridge(request=>record(request,'actual-identity'));bff=bridge(async request=>mobileBff.fetch(request,bffEnv as never));
  for(const[s,port]of [[api,apiPort],[bff,bffPort]] as const)await new Promise<void>((resolve,reject)=>{s!.once('error',reject);s!.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+180_000;let live=false;
  while(Date.now()<deadline){try{if((await fetch(identityOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(live);
  for(const port of [apiPort,bffPort,identityPort])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,store_id:tenant.siteId,store_handle:tenant.subdomain,other_store_id:other.siteId,other_store_handle:other.subdomain,owner_email:email,rival_email:rivalEmail,password,apk_sha256:receipt.apk_sha256,
   proof_notice:'Normal native password sign-in/settings/retry/policy -> maintained BFF/Gateway/current pooled DB. Verified accounts and paid order inputs are synthetic. No normal buyer checkout, payment-provider, inbox, physical device or hosted proof.'},null,2)+'\n',{mode:0o600});
  console.info('OWNED_LOYALTY_ANDROID_READY '+ready);
  while(!existsSync(done)){
   context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped');
   await new Promise(r=>setTimeout(r,1000));
  }
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[];remaining_findings?:string[]};assert.equal(proof.run_id,owned.runId);assert.deepEqual(proof.remaining_findings??[],[],'unresolved native findings prevent acceptance');
  for(const step of ['normal-native-login','normal-settings-navigation','read-outage-recovery','not-enrolled','committed-reply-loss','same-save-after-restart','canonical-earning-readback','decrease-blocked','increase-liability','paused-after-restart','native-light','native-dark','different-account-isolation','immediate-account-switch-no-wizard'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=10);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  const mutations=calls.filter(call=>call.path==='/v1/loyalty/program'&&call.method==='PUT');assert.equal(mutations.length,4);
  assert.ok(mutations.every(call=>call.status===200));assert.equal(mutations[0].clientStatus,503);assert.equal(mutations[1].clientStatus,200);
  assert.equal(mutations[0].keyDigest,mutations[1].keyDigest);assert.equal(mutations[0].bodyDigest,mutations[1].bodyDigest);
  assert.equal(new Set(mutations.map(call=>call.keyDigest)).size,3);assert.equal(audits(),'3');
  assert.deepEqual({...settings(),updated_at:undefined},{active:false,earn_rate_bps:1234,redeem_cap_bps:5000,point_value_minor:'150',updated_at:undefined});
  assert.equal(owned.psql(`SELECT count(*) FROM loyalty_programs WHERE site_id='${other.siteId}';`),'0');
  assert.equal(owned.psql(`SELECT count(*) FROM loyalty_ledger_entries WHERE order_id='${order}' AND entry_type='earned' AND points=123;`),'1');
  assert.equal(owned.psql(`SELECT metadata->>'liability_delta_minor' FROM audit_logs WHERE resource_id='${tenant.siteId}' AND metadata->>'point_value_minor_after'='150' ORDER BY created_at LIMIT 1;`),'6150');
  assert.ok(calls.filter(c=>c.path==='/v1/auth/custom/users/authenticate'&&c.status===200).length>=2);
  for(const site of [tenant.siteId,other.siteId])assert.ok(calls.some(c=>c.path==='/v1/loyalty/program'&&c.method==='GET'&&c.store===site&&c.status===200&&c.source==='actual-mobile-bff'));
  assert.ok(lastBHeaders);
  // The prior transport envelope has already consumed its JTI; reusing it
  // proves replay refusal, not live store ownership. Re-enter the BFF with B's
  // actual native session so it creates a fresh canonical internal envelope.
  const replay=await gateway.request(`/v1/loyalty/program?store_id=${tenant.siteId}`,{headers:lastBHeaders});assert.equal(replay.status,401);
  const bToken=lastBHeaders.get('X-LetBuyy-Internal-Session-Token');assert.ok(bToken);
  const denial=await mobileBff.fetch(new Request(`http://127.0.0.1/v1/loyalty/program?store_id=${tenant.siteId}`,{headers:{Authorization:`Bearer ${bToken}`,'X-Store-ID':tenant.siteId}}),bffEnv as never);
  assert.ok([403,404].includes(denial.status),await denial.text());assert.equal(audits(),'3');
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,apk_sha256:receipt.apk_sha256,calls,settings:settings(),audits:audits(),earned_points:123,crossOwnerReadStatus:denial.status,replayedInternalEnvelopeStatus:replay.status,
   scope:'Actual normal Android config/restart/retry/theme/account readback and current canonical earning worker on synthetic paid input. No normal buyer checkout/provider/inbox/hosted/physical-device proof.'},null,2)+'\n');
 }finally{
  for(const port of [apiPort,bffPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();await proxy.stop();
  for(const server of [api,bff])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
