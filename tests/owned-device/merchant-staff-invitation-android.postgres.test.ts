// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Controlled native device fixture, explicitly selected outside ordinary CI lanes.
// UI observations AND actual BFF/Gateway/database effects are required; a marker alone is insufficient.
import assert from 'node:assert/strict';
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
test('actual Merchant Android invitation, verified consent, restart and live revocation',{timeout:2_400_000},async(context)=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;
 assert.ok(receiptPath,'an explicit owned emulator receipt is required');
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8')) as {root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;owner_thread:string;apk_sha256:string};
 assert.equal(receipt.owner_thread,'01a13a26-2c7f-7672-80e1-a0d0861e4a44');
 assert.ok(/^\/private\/tmp\/letbuyy-n1-android-[a-z0-9]+$/.test(receipt.root));assert.equal(realpathSync(receipt.root),receipt.root);
 assert.match(receipt.serial,/^emulator-\d+$/);assert.ok(Number.isInteger(receipt.emulator_pid));process.kill(receipt.emulator_pid,0);
 const processCommand=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});
 assert.ok(processCommand.includes('qemu-system-aarch64')&&processCommand.includes('-avd '+receipt.avd_name)&&processCommand.includes('-port '+receipt.serial.slice(9)));
 const hardware=readFileSync(join(receipt.root,'device.avd/hardware-qemu.ini'),'utf8');
 for(const partition of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path']) {
  const value=hardware.split(String.fromCharCode(10)).find(line=>line.startsWith(partition+' = '))?.split(' = ')[1];assert.ok(value?.startsWith(receipt.root+'/device.avd/'),partition);
 }
 const adb=join(receipt.sdk_root,'platform-tools/adb');
 assert.equal(execFileSync(adb,['-s',receipt.serial,'emu','avd','name'],{encoding:'utf8'}).trim().split(String.fromCharCode(10))[0].trim(),receipt.avd_name);
 const root=join(receipt.root,'staff-invitation-324');mkdirSync(root,{recursive:true});
 const ready=join(root,'journey-ready.json'),done=join(root,'journey-done.json');
 assert.equal(existsSync(done),false,'never reuse a completion marker for a fresh database run');
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,adminOrigin='http://127.0.0.1:54353';
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   NEXT_PUBLIC_ADMIN_URL:adminOrigin,STAFF_INVITATION_SIGNING_SECRET:crypto.randomUUID()+crypto.randomUUID(),RESEND_API_KEY:''}));
 const tenant=newSyntheticTenant('staff-android');seedSyntheticTenant(owned.psql,tenant);
 const owner=crypto.randomUUID(),staff=crypto.randomUUID(),password='Synthetic-staff-android-pass-42';
 const ownerEmail=`syn-native-owner-${owner}@example.invalid`,staffEmail=`syn-native-staff-${staff}@example.invalid`;
 const hash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash) VALUES
  ('${owner}','${ownerEmail}',true,'Synthetic Native Owner','${hash}'),('${staff}','${staffEmail}',true,'Synthetic Native Staff','${hash}');
  UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
 const calls:{path:string;method:string;status:number;source:string}[]=[];
 const record=async(request:Request,source:string)=>{
  const url=new URL(request.url);const body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
  const result=await gateway.request(url.pathname+url.search,{method:request.method,headers:request.headers,...(body?{body}:{})});
  calls.push({path:url.pathname,method:request.method,status:result.status,source});
  if(source==='actual-mobile-bff'&&url.pathname==='/v1/employees/invite'&&result.status===201) {
   writeFileSync(join(root,'invitation-private.json'),JSON.stringify({run_id:owned.runId,accept_url:result.json?.data.invitation.accept_url}),{mode:0o600});
  }
  return new Response(result.text,{status:result.status,headers:result.headers});
 };
 const bffEnv={INTERNAL_API_SECRET:INTERNAL_SECRET,ENVIRONMENT:'local',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
  API_GATEWAY_SERVICE:{fetch:(request:Request)=>record(request,'actual-mobile-bff')}};
 const bridge=(handler:(request:Request)=>Promise<Response>)=>createServer(async(req,res)=>{
  try {const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
   const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   const response=await handler(new Request('http://127.0.0.1'+(req.url??'/'),{method:req.method,headers,...(body?{body}:{})}));
   res.writeHead(response.status,Object.fromEntries(response.headers.entries()));res.end(await response.text());
  }catch{res.writeHead(500);res.end('{}');}
 });
 let api:Server|undefined,bff:Server|undefined,identity:OwnedClientProcess|undefined;
 try {
  api=bridge(request=>record(request,'actual-identity'));bff=bridge(async request=>mobileBff.fetch(request,bffEnv as never));
  for(const[s,port]of [[api,apiPort],[bff,bffPort]] as const)await new Promise<void>((resolve,reject)=>{s!.once('error',reject);s!.listen(port,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,
   INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
   NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:adminOrigin,ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
   LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  const deadline=Date.now()+180_000;let live=false;
  while(Date.now()<deadline){try{if((await fetch(identityOrigin+'/api/auth/session',{signal:AbortSignal.timeout(2000)})).status===200){live=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  assert.ok(live,'actual Identity ready before any device interaction');
  for(const port of [apiPort,bffPort,identityPort])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,runner_pid:process.env.LETBUYY_EXECUTABLE_RUNNER_PID,serial:receipt.serial,
   store_id:tenant.siteId,store_handle:tenant.subdomain,owner_email:ownerEmail,staff_email:staffEmail,password,
   proof_notice:'Verified synthetic fixture accounts; normal native password login required. Not inbox/anti-bot/hosted proof.'},null,2)+'\n');
  console.info('OWNED_STAFF_ANDROID_READY '+ready);
  while(!existsSync(done)){
   context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);
   if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped');
   writeFileSync(join(root,'backend-progress.json'),JSON.stringify({run_id:owned.runId,calls},null,2)+'\n');
   await new Promise(r=>setTimeout(r,1000));
  }
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['owner-normal-login','native-owner-invitation','wrong-account-denial','pending-proof-restart','staff-normal-login',
   'native-permission-review','native-explicit-consent','staff-live-access','native-owner-downgrade','denied-after-downgrade','native-owner-removal','denied-after-removal'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=6);for(const path of proof.evidence){assert.ok(path.startsWith(root+'/'));assert.ok(existsSync(path));}
  const member=owned.psql(`SELECT id FROM employees WHERE store_id='${tenant.siteId}' AND email='${staffEmail}';`);assert.ok(member);
  assert.equal(owned.psql(`SELECT status||'|'||user_id::text||'|'||role FROM employees WHERE id='${member}';`),'removed|'+staff+'|viewer');
  for(const action of ['employee.invited','employee.invite.accepted','employee.updated','employee.removed'])assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${member}' AND action='${action}';`),'1',action);
  for(const[path,method,status]of [['/v1/employees/invite','POST',201],['/v1/employees/auth/accept-invite','POST',200],
   ['/v1/employees/'+member,'PATCH',200],['/v1/employees/'+member,'DELETE',200]] as const)assert.ok(calls.some(c=>c.source==='actual-mobile-bff'&&c.path===path&&c.method===method&&c.status===status),path);
  assert.ok(calls.some(c=>c.path==='/v1/employees/invitations/preview'&&c.status===403));
  assert.ok(calls.filter(c=>c.path==='/v1/auth/custom/users/authenticate'&&c.status===200).length>=3);
  assert.ok(calls.some(c=>c.path==='/v1/products'&&c.status===200));
  assert.ok(calls.some(c=>c.path==='/v1/products'&&c.method==='POST'&&c.status===403));
  writeFileSync(join(root,'backend-verified.json'),JSON.stringify({run_id:owned.runId,store_id:tenant.siteId,calls},null,2)+'\n');
 }finally{
  for(const port of [apiPort,bffPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();
  for(const server of [api,bff])if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 }
});
