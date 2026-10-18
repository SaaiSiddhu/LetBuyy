// Workspace integration fixture: spans runtimes without a runtime dependency edge.
// Explicit selection: node scripts/governance/run-executable-suites.mjs --suite tests/owned-device/merchant-mfa-android.postgres.test.ts --kind gateway-db --jobs 1 --no-reap
// Normal native UI and authoritative effects are both required.
// Synthetic accounts/manual refund inputs do not establish provider, inbox or hosted proof.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync,mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import mobileBff from '../../services/mobile-bff/src/index';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {otp,STEP_SECRET,TOTP_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/merchant-stepup-fixture';

const owned=requireOwnedDatabase();
const apiPort=54352,bffPort=54350,identityPort=54351;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
async function privateIdentityJwk(key:CryptoKey){const {key_ops,ext,...jwk}=await crypto.subtle.exportKey('jwk',key);return jwk;}
test('normal merchant Android MFA activation recovery, approval, refund retry and actor isolation',{timeout:2_700_000},async context=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath,'explicit owned emulator receipt required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8')) as {root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;owner_thread:string;apk_sha256:string;apk:string};
 assert.equal(receipt.owner_thread,'01a144b4-0b69-7051-a806-e513232c04de');
 assert.ok(/^\/private\/tmp\/letbuyy-n1-android-[a-z0-9]+$/.test(receipt.root));assert.equal(realpathSync(receipt.root),receipt.root);
 process.kill(receipt.emulator_pid,0);
 const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert.ok(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port '+receipt.serial.slice(9)));
 const hardware=readFileSync(join(receipt.root,'device.avd/hardware-qemu.ini'),'utf8');
 for(const part of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert.ok(hardware.split('\n').find(l=>l.startsWith(part+' = '))?.split(' = ')[1]?.startsWith(receipt.root+'/device.avd/'),part);
 const adb=join(receipt.sdk_root,'platform-tools/adb');
 assert.equal(execFileSync(adb,['-s',receipt.serial,'emu','avd','name'],{encoding:'utf8'}).trim().split('\n')[0].trim(),receipt.avd_name);
 const installed=execFileSync(adb,['-s',receipt.serial,'shell','pm','path','com.letbuyy.store'],{encoding:'utf8'}).trim().replace(/^package:/,'');assert.ok(installed.startsWith('/data/app/'));
 assert.equal(execFileSync(adb,['-s',receipt.serial,'shell','sha256sum',installed],{encoding:'utf8'}).trim().split(/\s+/)[0],receipt.apk_sha256);
 const root=join(receipt.root,'merchant-mfa');mkdirSync(root,{recursive:true});
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');assert.equal(existsSync(done),false);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,adminOrigin='http://127.0.0.1:54353';
 const proxy=await startOwnedPooledSqlProxy(owned);
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,RESEND_API_KEY:'',TOTP_ENCRYPTION_KEY:TOTP_SECRET,STEP_UP_SIGNING_SECRET:STEP_SECRET,...proxy.env()}));
 const tenant=newSyntheticTenant('nmfa-a-'+crypto.randomUUID().slice(0,7)),other=newSyntheticTenant('nmfa-b-'+crypto.randomUUID().slice(0,7));
 for(const t of [tenant,other])seedSyntheticTenant(owned.psql,t);
 const owner=crypto.randomUUID(),rival=crypto.randomUUID(),password='Synthetic-native-mfa-pass-42';
 const email=`syn-nmfa-${owner}@example.invalid`,rivalEmail=`syn-nmfa-${rival}@example.invalid`,hash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic MFA Owner','${hash}'),('${rival}','${rivalEmail}',true,'Synthetic MFA Other','${hash}');UPDATE sites SET custom_user_id='${owner}'WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${rival}'WHERE id='${other.siteId}';`);
 const refunds=[0,1].map(index=>{
  const order=crypto.randomUUID(),ret=crypto.randomUUID(),id=crypto.randomUUID(),number='SYN-MFA-'+index;
  owned.psql(`INSERT INTO orders(id,store_id,site_id,order_number,customer_name,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${tenant.siteId}','${tenant.siteId}','${number}','Synthetic MFA Buyer','syn-native@example.invalid','{}','[]',100,100,'paid');INSERT INTO returns(id,site_id,order_id,status,reason,refund_method,idempotency_key)VALUES('${ret}','${tenant.siteId}','${order}','received','Synthetic MFA return ${index}','manual','syn-${ret}');INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${id}','${tenant.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${id}');`);
  return {order,ret,id,number:owned.psql(`SELECT order_number FROM orders WHERE id='${order}';`)};
 });
 type Call={path:string;method:string;status:number;source:string;clientStatus:number;keyDigest?:string;bodyDigest?:string};
 const calls:Call[]=[];let readOutage=true,activationLost=false,refundLost=false,delayNext=false,release:(()=>void)|undefined;
 let secret:string|undefined,factorId:string|undefined,codes:string[]=[],activationDigest:string|undefined,lastBToken:string|undefined;
 const state=()=>({run_id:owned.runId,calls,activationLost,refundLost,delayed:!!release,activation_receipt_digest:activationDigest,refunds:refunds.map(r=>({...r,status:owned.psql(`SELECT status FROM refunds WHERE id='${r.id}';`),ledger_count:Number(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${r.id}';`))}))});
 const publish=()=>writeFileSync(join(root,'backend-progress.json'),JSON.stringify(state(),null,2)+'\n');
 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url),path=url.pathname,method=request.method,body=['GET','HEAD'].includes(method)?undefined:await request.text();
  if(source==='actual-mobile-bff'&&path==='/v1/2fa'&&method==='GET'&&readOutage){calls.push({path,method,source,status:503,clientStatus:503});publish();return Response.json({error:{code:'SYNTHETIC_SECURITY_READ_OUTAGE',message:'Synthetic security outage. Retry loading.'}},{status:503});}
  const result=await gateway.request(path+url.search,{method,headers:request.headers,...(body?{body}:{})});
  const key=request.headers.get('X-Idempotency-Key');
  const call:Call={path,method,source,status:result.status,clientStatus:result.status,keyDigest:key?digest(key):undefined,bodyDigest:body&&!/2fa|step-up|auth/.test(path)?digest(body):undefined};calls.push(call);
  if(path==='/v1/2fa/totp/enroll'&&result.status===201){secret=String(result.json?.data.secret);factorId=String(result.json?.data.factor.id);}
  if(path==='/v1/2fa/totp/verify'&&result.status===200){
   const current=result.json?.data.recovery_codes as string[];assert.equal(current.length,8);
   const value=digest(JSON.stringify(current));if(activationDigest)assert.equal(value,activationDigest,'receipt recovery must preserve original codes');else activationDigest=value;
   codes=[...current];
   if(!activationLost){activationLost=true;call.clientStatus=503;publish();return Response.json({error:{code:'SYNTHETIC_ACTIVATION_REPLY_LOSS',message:'Activation outcome unknown. Restart and recover the original result.'}},{status:503});}
  }
  if(path==='/v1/security/step-up/challenges'&&result.status===201&&delayNext){delayNext=false;publish();await new Promise<void>(resolve=>{release=resolve;});release=undefined;}
  if(path.endsWith('/refund/complete')&&result.status===200&&!refundLost){refundLost=true;call.clientStatus=503;publish();return Response.json({error:{code:'SYNTHETIC_REFUND_REPLY_LOSS',message:'Refund outcome unknown. Retry the original request.'}},{status:503});}
  if(source==='actual-mobile-bff'&&path==='/v1/2fa'&&result.status===200&&request.headers.get('X-Store-ID')===other.siteId)lastBToken=request.headers.get('X-LetBuyy-Internal-Session-Token')??undefined;
  publish();return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,ENVIRONMENT:'local',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body?{body}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch{res.writeHead(500);res.end('{}');}
 });
 let api:Server|undefined,bff:Server|undefined,control:Server|undefined,identity:OwnedClientProcess|undefined;
 try{
  api=bridge(request=>record(request,'actual-identity'));bff=bridge(request=>mobileBff.fetch(request,bffEnv as never));
  for(const[s,port]of [[api,apiPort],[bff,bffPort]] as const)await new Promise<void>((resolve,reject)=>{s!.once('error',reject);s!.listen(port,'127.0.0.1',resolve);});
  // UNIX socket is host-only and absent from APK config/ADB reverses. Codes never touch disk.
  control=createServer((req,res)=>{res.setHeader('Content-Type','application/json');
   if(req.url==='/code'){assert.ok(secret);res.end(JSON.stringify({code:otp(secret)}));}
   else if(req.url==='/recovery'){assert.equal(codes.length,8);res.end(JSON.stringify({code:codes[0]}));}
   else if(req.url==='/read-ready'){readOutage=false;res.end('{}');}
   else if(req.url==='/delay-next'){delayNext=true;res.end('{}');}
   else if(req.url==='/release'){release?.();res.end('{}');}
   else if(req.url==='/state')res.end(JSON.stringify(state()));
   else {res.statusCode=404;res.end('{}');}
  });await new Promise<void>(resolve=>control!.listen(join(root,'control.sock'),resolve));chmodSync(join(root,'control.sock'),0o600);
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await privateIdentityJwk(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+180_000;let live=false;
  while(Date.now()<deadline){try{if((await fetch(identityOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(live,'owned Identity must start');
  for(const port of [apiPort,bffPort,identityPort])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,store_id:tenant.siteId,store_handle:tenant.subdomain,other_store_id:other.siteId,owner_email:email,rival_email:rivalEmail,password,refunds,apk_sha256:receipt.apk_sha256,proof_notice:'Normal Android UI -> real Identity/BFF/Gateway/owned PG. Synthetic manual refund inputs; no provider/inbox/physical device/hosted proof.'},null,2)+'\n',{mode:0o600});
  console.info('OWNED_MFA_ANDROID_READY '+ready);
  while(!existsSync(done)){context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped');await new Promise(r=>setTimeout(r,1000));}
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['normal-native-login','normal-settings-navigation','read-outage-retry','activation-reply-loss','restart-original-recovery-codes','eight-code-acknowledgement','delayed-approval-closed-no-dispatch','refund-reply-loss-replay','authenticated-disable','normal-password-totp-login','native-light','native-dark','account-b-isolation'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=8);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  assert.ok(activationLost&&refundLost);assert.ok(factorId&&lastBToken);
  const verification=calls.filter(c=>c.path==='/v1/2fa/totp/verify'&&c.status===200);assert.ok(verification.length>=2);assert.equal(verification[0].keyDigest,verification[1].keyDigest);
  const completions=calls.filter(c=>c.path.endsWith('/refund/complete'));assert.equal(completions.length,3);assert.ok(completions.every(c=>c.status===200));assert.equal(completions[0].keyDigest,completions[1].keyDigest);assert.equal(completions[0].bodyDigest,completions[1].bodyDigest);
  assert.ok(state().refunds.every(r=>r.ledger_count===1&&r.status==='succeeded'));
  const denial=await mobileBff.fetch(new Request(`http://127.0.0.1/v1/returns?store_id=${tenant.siteId}`,{headers:{Authorization:'Bearer '+lastBToken,'X-Store-ID':tenant.siteId}}),bffEnv as never);assert.ok([403,404].includes(denial.status));
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({...state(),cross_actor_store_denial:denial.status,apk_sha256:receipt.apk_sha256,scope:'Owned emulator/local only; separate N1 phase, provider, hosted and release verdicts remain open.'},null,2)+'\n');
 }finally{
  release?.();for(const port of [apiPort,bffPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();await proxy.stop();
  for(const server of [api,bff,control])if(server){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  secret=undefined;codes=[];
 }
});
