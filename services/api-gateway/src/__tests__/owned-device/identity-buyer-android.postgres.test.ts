// N1.3/N1.5 controlled real-device fixture. The agent drives only its owned emulator's actual UI.
// Completion is not accepted from the marker alone: real Gateway traffic and ownedDB state must agree.
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {exportJWK} from 'jose';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../owned-db/synthetic-tenant';

const owned=requireOwnedDatabase();
const apiPort=54340,identityPort=54341;
const TEST_SITE_KEY='1x00000000000000000000AA';
const TEST_SECRET_KEY='1x0000000000000000000000000000000AA';

test('actual Android canonical account and paginated buyer-order reads isolate two buyers and survive restart',{timeout:2_400_000},async(context)=>{
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
 const keys=await newIdentityKeys();const identityOrigin=`http://127.0.0.1:${identityPort}`;
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost'}));
 const calls:{path:string;method:string;status:number;orderIds:string[]}[]=[];
 let adapter:Server|undefined,identity:OwnedClientProcess|undefined;
 const tag=crypto.randomUUID().slice(0,8);
 const emails=[`syn-native-a-${tag}@example.invalid`,`syn-native-b-${tag}@example.invalid`];
 const ready=join(receipt.root,'journey-ready.json'),done=join(receipt.root,'journey-done.json');
 const sites=[newSyntheticTenant('native-orders-a'),newSyntheticTenant('native-orders-b')];
 for(const site of sites)seedSyntheticTenant(owned.psql,site);
 const seeded=new Map<string,string[]>();let nextSeedCheck=0;
 // Data fixtures are created only for accounts registered through the normal
 // observed UI. This does not inject sessions or claim checkout/linking proof.
 function seedRegisteredBuyerOrders(){
  if(Date.now()<nextSeedCheck||seeded.size===2)return;nextSeedCheck=Date.now()+2000;
  for(const [buyerIndex,email] of emails.entries()){
   if(seeded.has(email))continue;
   const buyerId=owned.psql(`SELECT id FROM buyer_accounts WHERE email='${email}';`);if(!buyerId)continue;
   const ids:string[]=[];
   for(let index=1;index<=(buyerIndex===0?21:1);index++){
    const site=sites[(index-1)%sites.length],{orderId}=seedSyntheticOrder(owned.psql,site);
    const number=`NATIVE-${buyerIndex===0?'A':'B'}-${String(index).padStart(2,'0')}`;
    owned.psql(`UPDATE orders SET order_number='${number}' WHERE id='${orderId}' AND site_id='${site.siteId}';
      INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis,linked_at)
      VALUES('${orderId}','${buyerId}','${site.siteId}','authenticated_checkout','2026-10-01T10:00:00Z'::timestamptz+interval '${index} minutes');`);
    ids.push(orderId);
   }
   seeded.set(email,ids);
  }
  writeFileSync(join(receipt.root,'journey-orders.json'),JSON.stringify({run_id:owned.runId,fixtures:Object.fromEntries([...seeded].map(([email,ids])=>[email,{order_ids:ids,count:ids.length}]))},null,2)+'\n');
 }
 assert.equal(existsSync(done),false,'stale completion cannot end this fresh run');
 try {
  adapter=createServer(async(request,response)=>{
   const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
   const headers=new Headers();for(const[name,value]of Object.entries(request.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
   try {const result=await gateway.request(request.url??'/',{method:request.method,headers,...(body?{body}:{})});
    const data=result.json?.data,records=Array.isArray(data?.orders)?data.orders:data?.order?[data.order]:[];
    calls.push({path:request.url??'/',method:request.method??'GET',status:result.status,orderIds:records.map((row:{id:string})=>row.id)});
    response.writeHead(result.status,Object.fromEntries(result.headers.entries()));response.end(result.text);
   }catch{response.writeHead(500);response.end('{}');}
  });
  await new Promise<void>((resolve,reject)=>{adapter!.once('error',reject);adapter!.listen(apiPort,'127.0.0.1',resolve);});
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,
   LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:TEST_SITE_KEY,TURNSTILE_SECRET_KEY:TEST_SECRET_KEY,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  const deadline=Date.now()+60_000;let live=false;
  while(Date.now()<deadline){try{const response=await fetch(identityOrigin+'/api/buyer/login',{method:'GET',signal:AbortSignal.timeout(2000)});if(response.status===405){live=true;break;}}catch{/* compiling */}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(live,'actual Identity must be ready before device reverse bindings');
  for(const value of [apiPort,identityPort])execFileSync(adb,['-s',receipt.serial,'reverse',`tcp:${value}`,`tcp:${value}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,runner_pid:process.env.LETBUYY_EXECUTABLE_RUNNER_PID,database:owned.database,serial:receipt.serial,api_origin:`http://127.0.0.1:${apiPort}/v1`,identity_origin:identityOrigin,emails,
   password:'Synthetic-native-pass-42',expected_names:['Synthetic Native A','Synthetic Native B'],apk_sha256:receipt.apk_sha256,
   order_fixture_notice:'After real registration: A has21 synthetic orders across2 stores; B has1. Numbers NATIVE-A-01..21 and NATIVE-B-01. No checkout/provider/link-creation acceptance inferred.',
   proof_notice:'Real UI evidence required. Test-mode CAPTCHA is not production anti-bot/inbox/hosted proof.'},null,2)+String.fromCharCode(10));
  console.info('OWNED_ANDROID_READY '+ready);
  while(!existsSync(done)){
   context.signal.throwIfAborted();
   process.kill(receipt.emulator_pid,0);
   if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('owned Identity stopped during device verification');
   seedRegisteredBuyerOrders();
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  context.signal.throwIfAborted();
  const proof=JSON.parse(readFileSync(done,'utf8')) as {run_id:string;steps:string[];evidence:string[]};assert.equal(proof.run_id,owned.runId);
  for(const step of ['normal-registration-a','pkce-callback-a','profile-a','address-a','orders-a','orders-a-pagination','order-detail-a','restart-a','orders-after-restart-a','logout-a','normal-registration-b','profile-b','no-stale-a','orders-b','order-detail-b'])assert.ok(proof.steps.includes(step),step);
  assert.ok(proof.evidence.length>=5);for(const artifact of proof.evidence){assert.ok(artifact.startsWith(receipt.root+'/'));assert.ok(existsSync(artifact));}
  const rows=JSON.parse(owned.psql(`SELECT coalesce(json_agg(json_build_object('id',id,'email',email,'name',full_name) ORDER BY email),'[]'::json)::text FROM buyer_accounts WHERE email IN ('${emails[0]}','${emails[1]}');`)) as {id:string;email:string;name:string}[];
  assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.name),['Synthetic Native A','Synthetic Native B']);assert.notEqual(rows[0].id,rows[1].id);
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id='${rows[0].id}' AND address_line1='123 Native A Street';`),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_addresses WHERE buyer_account_id='${rows[1].id}' AND address_line1='123 Native A Street';`),'0');
  assert.ok(calls.filter(call=>call.path==='/v1/storefront/buyer/register'&&call.status===201).length===2);
  assert.ok(calls.filter(call=>call.path==='/v1/storefront/buyer/authorization-codes/redeem'&&call.status===200).length>=2);
  assert.ok(calls.some(call=>call.path.includes('/buyer/profile')&&call.method==='PATCH'&&call.status===200));
  const aOrders=seeded.get(emails[0])!,bOrders=seeded.get(emails[1])!;assert.equal(aOrders.length,21);assert.equal(bOrders.length,1);
  const orderCalls=calls.filter(call=>call.path.startsWith('/v1/storefront/buyer/orders')&&call.status===200);
  assert.ok(orderCalls.some(call=>call.path.includes('cursor=')&&call.orderIds.includes(aOrders[0])),'actual second page reached the oldest A order');
  for(const id of [aOrders[20],aOrders[0],bOrders[0]])assert.ok(orderCalls.some(call=>call.path===`/v1/storefront/buyer/orders/${id}`&&call.orderIds.includes(id)),'actual native detail read '+id);
  assert.ok(orderCalls.some(call=>call.orderIds.length===1&&call.orderIds[0]===bOrders[0]),'actual B-only order list');
  writeFileSync(join(receipt.root,'journey-backend.json'),JSON.stringify({run_id:owned.runId,buyers:2,a_order_count:21,b_order_count:1,calls},null,2)+'\n');
  console.info('OWNED_ANDROID_BACKEND_VERIFIED '+JSON.stringify({buyers:2,source:owned.database,requests:calls.length}));
 }finally{
  for(const value of [apiPort,identityPort])try{execFileSync(adb,['-s',receipt.serial,'reverse','--remove',`tcp:${value}`]);}catch{/* device already stopped */}
  await stopOwnedClientRuntime(identity);await gateway.settle();if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter!.close(()=>resolve()));}
 }
});
