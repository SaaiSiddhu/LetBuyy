// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Controlled native device fixture, explicitly selected outside ordinary CI lanes.
// UI observations AND actual BFF/Gateway/database effects are required; a marker alone is insufficient.
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
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
test('actual Merchant Android canonical checkout, saved retry, verification and billing',{timeout:2_400_000},async(context)=>{
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
 const root=join(receipt.root,'catalog-checkout');mkdirSync(root,{recursive:true});const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');assert.equal(existsSync(done),false);
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,adminOrigin='http://127.0.0.1:54353',providerSecret='synthetic-owned-native-subscription-provider-secret';
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,
  RAZORPAY_KEY_ID:'synthetic-owned-native-provider-key',RAZORPAY_KEY_SECRET:providerSecret,RESEND_API_KEY:''}));
 const tenant=newSyntheticTenant('native-catalog-a'),other=newSyntheticTenant('native-catalog-b');for(const t of [tenant,other])seedSyntheticTenant(owned.psql,t);
 const owner=crypto.randomUUID(),rival=crypto.randomUUID(),password='Synthetic-catalog-native-pass-42',email=`syn-catalog-owner-${owner}@example.invalid`,rivalEmail=`syn-catalog-rival-${rival}@example.invalid`,hash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES('${owner}','${email}',true,'Synthetic Catalog Owner','${hash}'),('${rival}','${rivalEmail}',true,'Synthetic Catalog Rival','${hash}');
 UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${rival}' WHERE id='${other.siteId}';
 CREATE FUNCTION syn_native_catalog_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='merchant_subscription.activated' AND NEW.metadata->>'site_id'='${tenant.siteId}' THEN RAISE EXCEPTION 'synthetic-native-catalog-audit-fault';END IF;RETURN NEW;END $$;
 CREATE TRIGGER syn_native_catalog_audit_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION syn_native_catalog_audit_fault();`);
 const orders=new Map<string,{id:string;amount:number;currency:string;receipt:string;notes:Record<string,string>}>(),payments=new Map<string,Record<string,unknown>>(),orderPayments=new Map<string,string>();let creates=0,loseCreate=true;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
  if(url.origin!=='https://api.razorpay.com')return originalFetch(input,init);
  const json=(v:unknown)=>new Response(JSON.stringify(v),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.pathname==='/v1/orders'&&init?.method==='POST'){const row={...JSON.parse(String(init.body)),id:'order_syn_native_'+crypto.randomUUID()};orders.set(row.id,row);creates++;
   if(loseCreate){loseCreate=false;throw new Error('Synthetic native provider create reply lost');}return json(row);}
  if(url.pathname==='/v1/orders')return json({items:[...orders.values()].filter(o=>o.receipt===url.searchParams.get('receipt'))});
  if(url.pathname.startsWith('/v1/payments/'))return json(payments.get(url.pathname.split('/').pop()!)||{error:{description:'Synthetic native capture missing'}});
  throw new Error('Unexpected synthetic native provider path '+url.pathname);
 }) as typeof fetch;
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
 let api:Server|undefined,bff:Server|undefined,provider:Server|undefined,identity:OwnedClientProcess|undefined;
 try{
  api=bridge(request=>record(request,'actual-identity'));bff=bridge(async request=>mobileBff.fetch(request,bffEnv as never));
  provider=bridge(async request=>{
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   if(new URL(request.url).pathname==='/sdk-script')return new Response(`globalThis.Razorpay=class{constructor(o){this.o=o;}open(){
    document.body.innerHTML='<main style="padding:28px;font:18px sans-serif"><h2>Local provider fixture</h2><p>No real provider payment</p><button id="synthetic-confirm" style="font-size:18px;padding:20px">Confirm synthetic payment</button><button id="synthetic-cancel" style="font-size:18px;padding:20px">Cancel synthetic payment</button><p id="synthetic-status"></p></main>';
    document.getElementById('synthetic-confirm').onclick=async()=>{try{const r=await fetch('${adminOrigin}/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:this.o.order_id})});if(!r.ok)throw Error('Synthetic capture unavailable');this.o.handler(await r.json());}catch(e){document.getElementById('synthetic-status').textContent=String(e);}};
    document.getElementById('synthetic-cancel').onclick=()=>this.o.modal.ondismiss();}};`,{headers:{...cors,'Content-Type':'application/javascript'}});
   if(new URL(request.url).pathname==='/capture'&&request.method==='POST'){
    const input=await request.json() as {order_id?:string},order=orders.get(input.order_id||'');
    if(!order||order.notes.store_id!==tenant.siteId)return new Response('{}',{status:409,headers:cors});
    let payment=orderPayments.get(order.id);if(!payment){payment='pay_syn_native_'+crypto.randomUUID();orderPayments.set(order.id,payment);payments.set(payment,{id:payment,order_id:order.id,amount:order.amount,currency:order.currency,status:'captured'});}
    return new Response(JSON.stringify({razorpay_order_id:order.id,razorpay_payment_id:payment,razorpay_signature:createHmac('sha256',providerSecret).update(order.id+'|'+payment).digest('hex')}),{headers:{...cors,'Content-Type':'application/json'}});
   }
   return new Response('{}',{status:404,headers:cors});
  });
  for(const[s,port]of [[api,apiPort],[bff,bffPort],[provider,54353]] as const)await new Promise<void>((resolve,reject)=>{s!.once('error',reject);s!.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+180_000;let live=false;
  while(Date.now()<deadline){try{if((await fetch(identityOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(live);
  for(const port of [apiPort,bffPort,identityPort,54353])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,store_id:tenant.siteId,store_handle:tenant.subdomain,other_store_id:other.siteId,other_store_handle:other.subdomain,owner_email:email,rival_email:rivalEmail,password,apk_sha256:receipt.apk_sha256,
   provider_fixture_script:adminOrigin+'/sdk-script',proof_notice:'Native UI + actual BFF/Gateway/DB; explicit synthetic provider HTTP/SDK boundary, not provider/inbox/hosted proof.'},null,2)+'\n',{mode:0o600});
  console.info('OWNED_CATALOG_ANDROID_READY '+ready);let repaired=false,lastCount=-1;
  while(!existsSync(done)){
   context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped');
   if(!repaired&&existsSync(join(root,'repair-activation-fault.json'))){
    assert.ok(calls.some(c=>c.path==='/v1/payments/subscription/verify'&&c.status===503),'must reproduce activation failure before repair');
    assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${tenant.siteId}';`),'0');
    owned.psql('DROP TRIGGER syn_native_catalog_audit_fault ON audit_logs;DROP FUNCTION syn_native_catalog_audit_fault();');repaired=true;
   }
   if(calls.length!==lastCount){lastCount=calls.length;writeFileSync(join(root,'backend-progress.json'),JSON.stringify({run_id:owned.runId,calls,provider_creates:creates,provider_captures:payments.size,repaired},null,2)+'\n');}
   await new Promise(r=>setTimeout(r,1000));
  }
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['normal-native-login','canonical-plan-prices','lost-create-response','native-restart-recovery','same-provider-order','provider-fixture-confirm','activation-fault-denial','native-verification-retry','current-canonical-billing','paid-state-restart','different-account-billing-isolation'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=8);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  assert.equal(creates,1);assert.equal(payments.size,1);assert.ok(repaired);
  const subscription=owned.psql(`SELECT id FROM subscriptions WHERE store_id='${tenant.siteId}';`);assert.ok(subscription);
  assert.equal(owned.psql(`SELECT plan||'|'||status||'|'||billing_period||'|'||amount_paid::text FROM subscriptions WHERE id='${subscription}';`),'growth|active|monthly|69900');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}' AND payment_status='paid';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM billing_history WHERE site_id='${tenant.siteId}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='merchant_subscription.activated' AND resource_id='${subscription}';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM subscriptions WHERE store_id='${other.siteId}';`),'0');
  const createsCalls=calls.filter(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/payments/subscription/order');assert.ok(createsCalls.some(c=>c.status===503));assert.ok(createsCalls.some(c=>c.status===200));assert.equal(new Set(createsCalls.map(c=>c.keyDigest)).size,1);
  const verifies=calls.filter(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/payments/subscription/verify');assert.ok(verifies.some(c=>c.status===503));assert.ok(verifies.some(c=>c.status===201));assert.equal(new Set(verifies.map(c=>c.keyDigest)).size,1);
  assert.ok(calls.some(c=>c.source==='actual-mobile-bff'&&c.path==='/v1/payments/plans'&&c.store===other.siteId&&c.status===200));
  assert.ok(calls.filter(c=>c.path==='/v1/auth/custom/users/authenticate'&&c.status===200).length>=2);
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,apk_sha256:receipt.apk_sha256,calls,provider_creates:creates,provider_captures:payments.size,subscription_id:subscription,scope:'Owned emulator/native BFF/Gateway/DB; synthetic provider only'},null,2)+'\n');
 }finally{
  for(const port of [apiPort,bffPort,identityPort,54353])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();globalThis.fetch=originalFetch;
  for(const server of [api,bff,provider])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
