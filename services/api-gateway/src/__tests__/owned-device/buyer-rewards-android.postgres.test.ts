// Actual owned Android UI + Identity/Gateway/PostgREST/PostgreSQL and device
// seller rewards. Seeded approved products are explicit display data fixtures,
// not merchant-review, checkout, provider, physical-device or distribution proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createServer,type Server} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {decodeJwt,exportJWK} from 'jose';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,restJson} from '../owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),apiPort=54340,identityPort=54341,appId='com.letbuyy.letbuyy';
const steps=['a-signed-in','a-rewards','a-restart','outage-on','a-outage','a-recovered','signed-out','b-signed-in','b-rewards','b-restart'];
test('actual Android normal buyers read their own seller rewards through restart, outage recovery and account switch',{timeout:2400000},async(context)=>{
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
 const site=newSyntheticTenant('native-rewards');seedSyntheticTenant(owned.psql,site);const category=crypto.randomUUID(),reviewer=crypto.randomUUID();
 owned.psql(`INSERT INTO marketplace_categories(id,slug,name,is_active)VALUES('${category}','native-rewards','Native seller rewards',true);`);
 const products=['Seller Rewards'].map((label,index)=>{
  const id=crypto.randomUUID(),productId=crypto.randomUUID(),name='Synthetic Seller Rewards Item';
  owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,description,price,images,stock,is_active,status,country_of_origin)VALUES('${productId}','${site.siteId}','${site.siteId}','${name}','syn-${productId.slice(0,12)}','Synthetic owned device display fixture',${199+index*100},ARRAY[]::text[],8,true,'active','India');
   INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)VALUES('${crypto.randomUUID()}','${site.siteId}','${productId}','${site.locationId}',8,0,0,8,0,8);
   INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id,visibility)VALUES('${id}','${site.siteId}','${productId}','marketplace','${category}','public');
   BEGIN;SELECT set_config('app.site_id','${site.siteId}',true);SELECT * FROM transition_channel_listing('${site.siteId}','${id}','pending_review','merchant','${crypto.randomUUID()}',NULL,'native-submit-${id}');COMMIT;`);
  const version=Number(owned.psql(`SELECT version FROM channel_listings WHERE id='${id}';`));
  owned.psql(`SELECT * FROM claim_marketplace_listing_review('${site.siteId}','${id}','${reviewer}','Synthetic display fixture only.','native-claim-${id}',${version});BEGIN;SELECT set_config('app.site_id','',true);SELECT * FROM transition_channel_listing('${site.siteId}','${id}','approved','operator','${reviewer}',NULL,'native-approve-${id}');COMMIT;`);
  return {id,product_id:productId,name};
 });
 const tag=crypto.randomUUID().slice(0,8),emails=[`syn-rewards-a-${tag}@example.invalid`,`syn-rewards-b-${tag}@example.invalid`];
 type ReadCall={path:string;method:string;status:number;actor_id?:string;balance?:unknown;points?:unknown[]};
 const calls:ReadCall[]=[],observations:unknown[]=[];
 const ready=join(receipt.root,'rewards-ready.json'),progress=join(receipt.root,'rewards-progress.json'),ack=join(receipt.root,'rewards-ack.json'),done=join(receipt.root,'rewards-done.json');
 for(const path of [ready,progress,ack,done])assert.equal(existsSync(path),false,'fresh rewards state required');
 owned.psql(`INSERT INTO loyalty_programs(site_id,is_active,earn_rate_bps,redeem_cap_bps,point_value_minor)VALUES('${site.siteId}',true,2500,5000,100);`);
 const buyerRows=()=>JSON.parse(owned.psql(`SELECT coalesce(json_agg(json_build_object('id',id,'email',email)ORDER BY email),'[]'::json)::text FROM buyer_accounts WHERE email IN('${emails[0]}','${emails[1]}');`)) as {id:string;email:string}[];
 function seedDisplayPoints(index:number,points:number){
  const buyer=buyerRows().find(row=>row.email===emails[index]);assert.ok(buyer,'buyer must register through the normal UI before display fixture provisioning');
  const account=crypto.randomUUID();
  owned.psql(`INSERT INTO loyalty_accounts(id,site_id,buyer_account_id,status)VALUES('${account}','${site.siteId}','${buyer.id}','active');
   INSERT INTO loyalty_ledger_entries(site_id,loyalty_account_id,entry_type,points,balance_after,idempotency_key)VALUES('${site.siteId}','${account}','earned',${points},${points},'syn-native-rewards-${account}');`);
 }
 const rewardPath=`/v1/storefront/buyer/loyalty/${site.siteId}`;
 let failReads=false,faults=0,adapter:Server|undefined,identity:OwnedClientProcess|undefined;
 const tap=tapRest(owned.restUrl,async(call,forward)=>{
  if(failReads&&call.resource==='loyalty_ledger_entries'&&call.method==='GET'){faults++;return restJson(503,{message:'synthetic-owned-rewards-history-outage'});}
  return forward();
 });
 function verifyStage(stage:string){
  if(stage==='a-signed-in')seedDisplayPoints(0,17);
  if(stage==='b-signed-in')seedDisplayPoints(1,29);
  const buyers=buyerRows();
  if(['a-rewards','a-restart','a-recovered','b-rewards','b-restart'].includes(stage)){
   const index=stage.startsWith('b-')?1:0,expected=index===0?17:29,buyer=buyers.find(row=>row.email===emails[index]);assert.ok(buyer);
   const after=stage==='a-recovered'?calls.map(call=>call.path===rewardPath+'/history'&&call.status===500).lastIndexOf(true)+1:0;
   const own=calls.slice(after).filter(call=>call.actor_id===buyer.id&&call.status===200&&call.path.startsWith(rewardPath));
   assert.ok(own.some(call=>call.path===rewardPath&&call.balance===expected),'real current buyer balance read required');
   assert.ok(own.some(call=>call.path===rewardPath+'/history'&&JSON.stringify(call.points)===JSON.stringify([expected])),'real current buyer history read required');
   if(stage.endsWith('restart'))assert.ok(own.filter(call=>call.path===rewardPath).length>=2,'process restart must make another authenticated read');
  }
  if(stage==='outage-on')failReads=true;
  if(stage==='a-outage'){assert.ok(faults>0);assert.ok(calls.some(call=>call.path===rewardPath+'/history'&&call.status===500));failReads=false;}
  observations.push({stage,buyers,read_calls:calls.filter(call=>call.path.startsWith(rewardPath)),faults});
  writeFileSync(join(receipt.root,'rewards-observations.json'),JSON.stringify({run_id:owned.runId,observations},null,2)+'\n');
  writeFileSync(ack,JSON.stringify({run_id:owned.runId,stage})+'\n');
 }
 try{
  adapter=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
   try{
    const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});
    const path=(req.url??'/').split('?')[0],call:ReadCall={path,method:req.method??'GET',status:result.status};
    if(path.startsWith(rewardPath)){
     // Attribution only after the real Gateway verifies the app's normal session.
     // The token is never persisted or printed, and never minted by this fixture.
     const token=headers.get('X-LetBuyy-Buyer-Session');if(token)call.actor_id=decodeJwt(token).sub;
     if(result.status===200){if(path===rewardPath)call.balance=result.json?.data.balance;else call.points=result.json?.data.map((row:{points:unknown})=>row.points);}
    }
    calls.push(call);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(result.text);
   }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>((resolve,reject)=>{adapter!.once('error',reject);adapter!.listen(apiPort,'127.0.0.1',resolve);});
  for(const product of products){const detail=await gateway.request('/v1/storefront/marketplace/listings/'+product.id);assert.equal(detail.status,200,detail.text);}
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{NODE_ENV:'development',LETBUYY_API_URL:`http://127.0.0.1:${apiPort}/v1`,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  let live=false;const until=Date.now()+90000;while(Date.now()<until){if(identity.exitCode!==null||identity.signalCode!==null)throw new Error('Owned Identity stopped before readiness');try{if((await fetch(identityOrigin+'/api/buyer/login',{method:'GET',signal:AbortSignal.timeout(2000)})).status===405){live=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(live);
  for(const port of [apiPort,identityPort])a(['reverse',`tcp:${port}`,`tcp:${port}`]);
  writeFileSync(ready,JSON.stringify({run_id:owned.runId,serial:receipt.serial,apk_sha256:receipt.apk_sha256,products,emails,password:'Synthetic-native-pass-42',steps,proof_notice:'Actual normal UI and backend reads required. Synthetic display-only catalogue/loyalty rows; official CAPTCHA test transport; no earning, provider, merchant configuration or hosted acceptance.'},null,2)+'\n');console.info('OWNED_ANDROID_REWARDS_READY '+ready);
  let stageIndex=0;
  while(!existsSync(done)){context.signal.throwIfAborted();process.kill(receipt.emulator_pid,0);assert.equal(identity.exitCode,null);if(existsSync(progress)){const p=JSON.parse(readFileSync(progress,'utf8'));assert.equal(p.run_id,owned.runId);if(p.stage!==steps[stageIndex-1]){assert.equal(p.stage,steps[stageIndex]);verifyStage(p.stage);stageIndex++;}}await new Promise(resolve=>setTimeout(resolve,250));}
  assert.equal(stageIndex,steps.length);const proof=JSON.parse(readFileSync(done,'utf8'));assert.equal(proof.run_id,owned.runId);assert.deepEqual(proof.steps,steps);assert.ok(proof.evidence.length>=12);for(const path of proof.evidence)assert.ok(path.startsWith(receipt.root+'/')&&existsSync(path));
  assert.equal(buyerRows().length,2);assert.equal(calls.filter(call=>call.path==='/v1/storefront/buyer/register'&&call.status===201).length,2);assert.ok(calls.filter(call=>call.path==='/v1/storefront/buyer/authorization-codes/redeem'&&call.status===200).length>=2);assert.ok(faults>0);
  writeFileSync(join(receipt.root,'rewards-backend.json'),JSON.stringify({run_id:owned.runId,buyers:buyerRows(),calls,verified_stages:stageIndex,faults,installed_apk:receipt.apk_sha256},null,2)+'\n');console.info('OWNED_ANDROID_REWARDS_VERIFIED '+JSON.stringify({buyers:2,stages:stageIndex,calls:calls.length}));
 }finally{
  for(const port of [apiPort,identityPort])try{a(['reverse','--remove',`tcp:${port}`]);}catch{}
  await stopOwnedClientRuntime(identity);await gateway.settle();tap.restore();
  if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter!.close(()=>resolve()));}
 }
});
