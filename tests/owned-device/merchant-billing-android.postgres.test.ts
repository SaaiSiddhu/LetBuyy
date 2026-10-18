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
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase();
const apiPort=54352,bffPort=54350,identityPort=54351;
test('actual Merchant Android canonical dashboard and invoice readback',{timeout:1_800_000},async(context)=>{
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
 const root=join(receipt.root,'billing-readback');mkdirSync(root,{recursive:true});const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');assert.equal(existsSync(done),false);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,adminOrigin='http://127.0.0.1:54353';
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,RESEND_API_KEY:''}));
 const tenant=newSyntheticTenant('native-billing-a'),other=newSyntheticTenant('native-billing-b');for(const t of [tenant,other])seedSyntheticTenant(owned.psql,t);
 const owner=crypto.randomUUID(),rival=crypto.randomUUID(),password='Synthetic-billing-native-pass-42',email=`syn-billing-owner-${owner}@example.invalid`,rivalEmail=`syn-billing-rival-${rival}@example.invalid`,hash=await hashMerchantPassword(password);
 const sourceKey='syn-native-billing:'+crypto.randomUUID(),order='order_syn_billing_'+crypto.randomUUID(),payment='pay_syn_billing_'+crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${owner}','${email}',true,'Synthetic Billing Owner','${hash}'),('${rival}','${rivalEmail}',true,'Synthetic Billing Rival','${hash}');
 UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${rival}' WHERE id='${other.siteId}';
 SELECT claim_merchant_subscription_checkout_v1('${owner}','${tenant.siteId}','${sourceKey}',
  '{"plan_slug":"growth","billing_period":"monthly"}'::jsonb,
  jsonb_build_object('plan',to_jsonb(p),'mode','razorpay_order','amount_minor',69900,'currency','INR')) FROM plans p WHERE slug='growth' AND site_type='store';
 SELECT bind_merchant_subscription_checkout_v1('${owner}','${tenant.siteId}',id,'${order}') FROM billing_history WHERE subscription_checkout_key='${sourceKey}';`);
 const seeded=await gateway.request('/v1/internal/billing/subscriptions/activate',{method:'POST',headers:{'X-Internal-API-Secret':INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({storeId:tenant.siteId,userId:owner,planSlug:'growth',billingPeriod:'monthly',provider:'razorpay',providerOrderId:order,providerPaymentId:payment,amountPaid:69900})});assert.equal(seeded.status,200,seeded.text);
 const invoice=JSON.parse(owned.psql(`SELECT jsonb_build_object('id',id,'invoice_number',invoice_number,'amount',amount,'tax_amount',tax_amount,'total_amount',total_amount,'payment_status',payment_status) FROM billing_history WHERE payment_id='${payment}';`));
 const calls:{path:string;method:string;status:number;source:string;keyDigest?:string;store?:string}[]=[];
 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url),body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
  const result=await gateway.request(url.pathname+url.search,{method:request.method,headers:request.headers,...(body?{body}:{})});
  const key=request.headers.get('X-Idempotency-Key');
  calls.push({path:url.pathname,method:request.method,status:result.status,source,keyDigest:key?createHash('sha256').update(key).digest('hex'):undefined,store:url.searchParams.get('store_id')||undefined});
  return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,ENVIRONMENT:'local',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body?{body}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch{res.writeHead(500);res.end('{}');}
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
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,store_id:tenant.siteId,store_handle:tenant.subdomain,other_store_id:other.siteId,other_store_handle:other.subdomain,owner_email:email,rival_email:rivalEmail,password,apk_sha256:receipt.apk_sha256,invoice,proof_notice:'Actual native normal login/read UI/BFF/Gateway/DB. Paid source was a trusted synthetic setup fixture; no native payment, provider, inbox or hosted proof.'},null,2)+'\n',{mode:0o600});
  console.info('OWNED_BILLING_ANDROID_READY '+ready);let lastCount=-1;
  while(!existsSync(done)){
   context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped');
   if(calls.length!==lastCount){lastCount=calls.length;writeFileSync(join(root,'backend-progress.json'),JSON.stringify({run_id:owned.runId,calls},null,2)+'\n');}
   await new Promise(r=>setTimeout(r,1000));
  }
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['normal-native-login','canonical-paid-dashboard','normal-billing-navigation','canonical-invoice-identity','exact-recorded-amounts','paid-state-restart','different-account-billing-isolation'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=6);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}' AND payment_status='paid';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${other.siteId}';`),'0');
  for(const path of ['/v1/payments/subscription','/v1/payments/subscription/history'])for(const store of [tenant.siteId,other.siteId])assert.ok(calls.some(c=>c.source==='actual-mobile-bff'&&c.path===path&&c.store===store&&c.status===200),path+' '+store);
  assert.ok(calls.filter(c=>c.path==='/v1/auth/custom/users/authenticate'&&c.status===200).length>=2);
  assert.equal(calls.some(c=>c.path==='/v1/payments/subscription/order'||c.path==='/v1/payments/subscription/verify'),false,'readback journey must not create another charge');
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,apk_sha256:receipt.apk_sha256,calls,invoice,scope:'Actual owned native readback; trusted synthetic paid fixture; no native payment, provider, inbox or hosted proof'},null,2)+'\n');
 }finally{
  for(const port of [apiPort,bffPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();
  for(const server of [api,bff])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
