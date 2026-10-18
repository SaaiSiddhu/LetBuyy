// Actual owned Android UI + Identity/Gateway/PostgREST/PostgreSQL and device
// SharedPreferences. Seeded approved products are explicit display data fixtures,
// not merchant-review, checkout, provider, physical-device or distribution proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createServer,type Server} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {exportJWK} from 'jose';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),apiPort=54340,identityPort=54341,appId='com.letbuyy.letbuyy';
const steps=['guest-populated','a-no-auto-merge','a-explicit-transfer','a-populated','a-restart','logout-guest-isolated','b-empty','b-populated','b-restart'];
test('actual Android populated local carts and wishlists isolate normal A/B/guest identities and survive restart',{timeout:2400000},async(context)=>{
 const receiptPath=process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;assert.ok(receiptPath);
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8')) as {root:string;avd_name:string;serial:string;emulator_pid:number;sdk_root:string;owner_thread:string;apk:string;apk_sha256:string};
 assert.equal(receipt.owner_thread,'01a13a26-2c7f-7672-80e1-a0d0861e4a44');assert.match(receipt.root,/^\/private\/tmp\/letbuyy-n1-android-[a-z0-9]+$/);assert.equal(realpathSync(receipt.root),receipt.root);assert.match(receipt.serial,/^emulator-\d+$/);process.kill(receipt.emulator_pid,0);
 const command=execFileSync('ps',['-p',String(receipt.emulator_pid),'-o','command='],{encoding:'utf8'});assert.ok(command.includes('qemu-system-aarch64')&&command.includes('-avd '+receipt.avd_name)&&command.includes('-port '+receipt.serial.slice(9)));
 const hardware=readFileSync(join(receipt.root,'device.avd/hardware-qemu.ini'),'utf8');
 for(const partition of ['disk.dataPartition.path','disk.cachePartition.path','disk.encryptionKeyPartition.path'])assert.ok(hardware.split('\n').find(line=>line.startsWith(partition+' = '))?.split(' = ')[1].startsWith(receipt.root+'/device.avd/'));
 assert.equal(createHash('sha256').update(readFileSync(receipt.apk)).digest('hex'),receipt.apk_sha256);
 const adb=join(receipt.sdk_root,'platform-tools/adb'),a=(args:string[])=>execFileSync(adb,['-s',receipt.serial,...args],{encoding:'utf8'}).trim();
 assert.equal(a(['emu','avd','name']).split('\n')[0].trim(),receipt.avd_name);
 const installed=a(['shell','pm','path',appId]).split('\n')[0].replace(/^package:/,'');assert.match(installed,/^\/data\/app\/.*\/base\.apk$/);assert.equal(a(['shell','sha256sum',installed]).split(/\s+/)[0],receipt.apk_sha256,'actual installed APK is the current source-bound artifact');
 const keys=await newIdentityKeys(),identityOrigin=`http://127.0.0.1:${identityPort}`,gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost'}));
 const site=newSyntheticTenant('native-local-state');seedSyntheticTenant(owned.psql,site);const category=crypto.randomUUID(),reviewer=crypto.randomUUID();
 owned.psql(`INSERT INTO marketplace_categories(id,slug,name,is_active)VALUES('${category}','native-local-state','Native local state',true);`);
 const products=['Guest','Buyer A','Buyer B'].map((label,index)=>{
  const id=crypto.randomUUID(),productId=crypto.randomUUID(),name='Synthetic '+label+' Saved Item';
  owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,description,price,images,stock,is_active,status,country_of_origin)VALUES('${productId}','${site.siteId}','${site.siteId}','${name}','syn-${productId.slice(0,12)}','Synthetic owned device display fixture',${199+index*100},ARRAY[]::text[],8,true,'active','India');
   INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)VALUES('${crypto.randomUUID()}','${site.siteId}','${productId}','${site.locationId}',8,0,0,8,0,8);
   INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility)VALUES('${id}','${site.siteId}','${productId}','marketplace','${category}','public');
   BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);SELECT * FROM transition_channel_listing('${site.siteId}','${id}','pending_review','merchant','${crypto.randomUUID()}',NULL,'native-submit-${id}');COMMIT;`);
  const version=Number(owned.psql(`SELECT version FROM channel_listings WHERE id='${id}';`));
  owned.psql(`SELECT * FROM claim_marketplace_listing_review('${site.siteId}','${id}','${reviewer}','Synthetic display fixture only.','native-claim-${id}',${version});BEGIN;SELECT set_config('app.site_id','',true);SELECT * FROM transition_channel_listing('${site.siteId}','${id}','approved','operator','${reviewer}',NULL,'native-approve-${id}');COMMIT;`);
  return {id,product_id:productId,name};
 });
 const tag=crypto.randomUUID().slice(0,8),emails=[`syn-local-a-${tag}@example.invalid`,`syn-local-b-${tag}@example.invalid`],calls:{path:string;method:string;status:number}[]=[],observations:unknown[]=[];
 const ready=join(receipt.root,'namespace-ready.json'),progress=join(receipt.root,'namespace-progress.json'),ack=join(receipt.root,'namespace-ack.json'),done=join(receipt.root,'namespace-done.json');
 for(const p of [ready,progress,ack,done])assert.equal(existsSync(p),false,'fresh run state required');
 let adapter:Server|undefined,identity:OwnedClientProcess|undefined;
 function localState(){
  const raw=a(['exec-out','run-as',appId,'cat','shared_prefs/FlutterSharedPreferences.xml']);assert.ok(raw.length<2000000);
  const records:Record<string,{cart?:string[];wishlist?:string[]}>=Object.create(null);
  for(const match of raw.matchAll(/<string name="(flutter\.local_(?:cart|wishlist)_v1(?::buyer:[0-9a-f-]+)?)">([^<]*)<\/string>/g)){
   const key=match[1],decoded=match[2].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
   const row=JSON.parse(decoded),buyer=key.includes(':buyer:')?key.split(':buyer:')[1]:'guest';records[buyer]??={};
   if(key.startsWith('flutter.local_cart_'))records[buyer].cart=row.items.map((item:{productId:string})=>item.productId).sort();else records[buyer].wishlist=row.productIds.sort();
  }
  return records;
 }
 function buyers(){return JSON.parse(owned.psql(`SELECT coalesce(json_agg(json_build_object('id',id,'email',email)ORDER BY email),'[]'::json)::text FROM buyer_accounts WHERE email IN('${emails[0]}','${emails[1]}');`)) as {id:string;email:string}[];}
 function verifyStage(stage:string){
  const state=localState(),actors=buyers(),aId=actors.find(row=>row.email===emails[0])?.id,bId=actors.find(row=>row.email===emails[1])?.id;
  const expectState=(owner:string,ids:string[])=>{assert.deepEqual(state[owner]?.cart??[],[...ids].sort(),stage+' cart '+owner);assert.deepEqual(state[owner]?.wishlist??[],[...ids].sort(),stage+' wishlist '+owner);};
  if(stage==='guest-populated')expectState('guest',[products[0].id]);
  else {
   assert.ok(aId);
   if(stage==='a-no-auto-merge'){expectState(aId,[]);expectState('guest',[products[0].id]);}
   else {expectState('guest',[]);expectState(aId,stage==='a-explicit-transfer'?[products[0].id]:[products[0].id,products[1].id]);}
   if(stage.startsWith('b-')){assert.ok(bId);expectState(bId,stage==='b-empty'?[]:[products[2].id]);}
  }
  observations.push({stage,actors,state});writeFileSync(join(receipt.root,'namespace-device-state.json'),JSON.stringify({run_id:owned.runId,observations},null,2)+'\n');writeFileSync(ack,JSON.stringify({run_id:owned.runId,stage})+'\n');
 }
 try{
  adapter=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try{const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});calls.push({path:(req.url??'/').split('?')[0],method:req.method??'GET',status:result.status});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(result.text);}catch{res.writeHead(500);res.end('{}');}});
  await new Promise<void>((resolve,reject)=>{adapter!.once('error',reject);adapter!.listen(apiPort,'127.0.0.1',resolve);});
  for(const p of products){const detail=await gateway.request('/v1/storefront/marketplace/listings/'+p.id);assert.equal(detail.status,200,detail.text);assert.equal(detail.json?.data.name,p.name);}
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  let live=false;const until=Date.now()+60000;while(Date.now()<until){if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped before readiness');try{if((await fetch(identityOrigin+'/api/buyer/login',{method:'GET',signal:AbortSignal.timeout(2000)})).status===405){live=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(live);
  for(const p of [apiPort,identityPort])a(['reverse',`tcp:${p}`,`tcp:${p}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,apk_sha256:receipt.apk_sha256,products,emails,password:'Synthetic-native-pass-42',steps,proof_notice:'Actual UI/data/disk required; approved synthetic display fixtures; official CAPTCHA test transport only; no provider email, review, payment or hosted proof.'},null,2)+'\n');console.info('OWNED_ANDROID_NAMESPACE_READY '+ready);
  let stageIndex=0;
  while(!existsSync(done)){context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);assert.equal(identity.exitCode,null);if(existsSync(progress)){const p=JSON.parse(readFileSync(progress,'utf8'));assert.equal(p.run_id,owned.runId);if(p.stage!==steps[stageIndex-1]){assert.equal(p.stage,steps[stageIndex]);verifyStage(p.stage);stageIndex++;}}await new Promise(resolve=>setTimeout(resolve,250));}
  assert.equal(stageIndex,steps.length);const proof=JSON.parse(readFileSync(done,'utf8'));assert.equal(proof.run_id,owned.runId);assert.deepEqual(proof.steps,steps);assert.ok(proof.evidence.length>=12);for(const path of proof.evidence)assert.ok(path.startsWith(receipt.root+'/')&&existsSync(path));
  assert.equal(buyers().length,2);assert.equal(calls.filter(c=>c.path==='/v1/storefront/buyer/register'&&c.status===201).length,2);assert.ok(calls.filter(c=>c.path==='/v1/storefront/buyer/authorization-codes/redeem'&&c.status===200).length>=2);for(const p of products)assert.ok(calls.some(c=>c.path==='/v1/storefront/marketplace/listings/'+p.id&&c.status===200));
  writeFileSync(join(receipt.root,'namespace-backend.json'),JSON.stringify({run_id:owned.runId,buyers:buyers(),calls,verified_stages:stageIndex,installed_apk:receipt.apk_sha256},null,2)+'\n');console.info('OWNED_ANDROID_NAMESPACE_VERIFIED '+JSON.stringify({buyers:2,stages:stageIndex,calls:calls.length}));
 }finally{for(const p of [apiPort,identityPort])try{a(['reverse','--remove',`tcp:${p}`]);}catch{}await stopOwnedClientRuntime(identity);await gateway.settle();if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter!.close(()=>resolve()));}}
});
