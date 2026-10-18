// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Real normal Identity/PKCE cookies, Commerce BFF, production Gateway and owned PG.
// Official Turnstile test transport is a separate provider fixture, not anti-bot acceptance.
// No screenshots, input/body/cookie dumps, bearer injection or UI HTTP interception.
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET,tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned=requireOwnedDatabase();
async function port(){const server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const p=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));return p;}
async function ready(origin:string,path:string,child:OwnedClientProcess){
 const until=Date.now()+240_000;
 while(Date.now()<until){if(child.exitCode!==null||child.signalCode!==null)throw Error('owned client exited before readiness');try{if((await fetch(origin+path,{signal:AbortSignal.timeout(2500)})).status<500)return;}catch{}await new Promise(r=>setTimeout(r,150));}
 throw Error('owned client readiness deadline');
}

test('normal web support boundaries preserve one action across committed loss, reload and actor changes',{timeout:900_000},async()=>{
 const store=newSyntheticTenant('n6-web-recovery');seedSyntheticTenant(owned.psql,store);
 const keys=await newIdentityKeys(),identityPort=await port(),commercePort=await port();
 const identityOrigin=`http://localhost:${identityPort}`,origin=`http://${store.subdomain}.localhost:${commercePort}`;
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost'}));
 let adapter:Server|undefined,identity:OwnedClientProcess|undefined,commerce:OwnedClientProcess|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 let stage='runtime';const calls:{path:string;status:number}[]=[];
 try{
  adapter=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const x of req)chunks.push(Buffer.from(x));const body=Buffer.concat(chunks).toString();const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);try{const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});calls.push({path:new URL(req.url??'/',origin).pathname,status:result.status});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);}catch{res.writeHead(500);res.end('{}');}});
  await new Promise<void>(r=>adapter!.listen(0,'127.0.0.1',r));const api=`http://127.0.0.1:${(adapter.address() as {port:number}).port}/v1`;
  identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{LETBUYY_API_URL:api,INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false'}});
  await ready(identityOrigin,'/api/buyer/login',identity);
  commerce=startOwnedClientRuntime(owned,'commerce-next',{port:commercePort,env:{LETBUYY_API_BASE_URL:api,NEXT_PUBLIC_API_URL:api,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,INTERNAL_API_SECRET:INTERNAL_SECRET}});
  await ready(`http://localhost:${commercePort}`,'/api/buyer-auth/session',commerce);
  browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP *.localhost 127.0.0.1']});
  let context=await browser.newContext();let page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(90_000);
  async function register(p:Page,switchAccount=false){
   await p.goto(origin+'/customers/login');await p.getByRole('link',{name:'Continue with LetBuyy',exact:true}).click();
   if(switchAccount){stage='identity-b-switch';await p.waitForLoadState('networkidle');const [logout]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/buyer/logout')&&r.request().method()==='POST'),p.getByRole('button',{name:'Use a different account',exact:true}).click()]);assert.equal(logout.status(),200);}
   stage=switchAccount?'identity-b-signin':'identity-a-signin';await expect(p.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await p.getByRole('link',{name:'Create an account',exact:true}).click();
   stage=switchAccount?'identity-b-register':'identity-a-register';await expect(p.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:90_000});
   const email=`syn-n6-web-${crypto.randomUUID()}@example.invalid`;
   await p.getByLabel('Email',{exact:true}).fill(email);await p.getByLabel('Password',{exact:true}).fill('Synthetic-browser-pass-42');
   const [registered]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/buyer/register')&&r.request().method()==='POST'),p.getByRole('button',{name:'Create account',exact:true}).click()]);assert.equal(registered.status(),201);
   stage=switchAccount?'identity-b-consent':'identity-a-consent';await p.getByRole('button',{name:`Continue to Synthetic ${store.tag}`,exact:true}).click();await p.waitForURL(u=>u.origin===origin&&/\/account(?:\/|$)/.test(u.pathname));
   const session=await context.request.get(origin+'/api/buyer-auth/session');assert.equal(session.status(),200);return (await session.json()).buyer.id as string;
  }
  stage='normal-identity-a';const buyerA=await register(page);
  const headers=(key:string,buyer=buyerA)=>({'Origin':origin,'Content-Type':'application/json','X-Idempotency-Key':key,'x-letbuyy-expected-buyer-id':buyer});
  const input={subject:'Synthetic web recovery',body:'Synthetic original complaint'};
  stage='committed-create-loss';const key=`web-${crypto.randomUUID()}`;let lost=false;
  const tap=tapRest(owned.restUrl,async(call,forward)=>{const res=await forward();if(call.resource==='rpc/execute_buyer_support_mutation'&&!lost){assert.equal(res.status,200);lost=true;await res.text();return restJson(503,{message:'synthetic committed response loss'});}return res;});
  try{assert.equal((await context.request.post(origin+'/api/buyer/support/tickets',{headers:headers(key),data:input})).status(),503);}finally{tap.restore();}
  assert.equal(lost,true);const create=await context.request.post(origin+'/api/buyer/support/tickets',{headers:headers(key),data:input});assert.equal(create.status(),201);
  const ticket=(await create.json()).ticket.id;
  const createCount=Number(owned.psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${buyerA}';`));
  stage='committed-reply-loss';const replyKey=`web-${crypto.randomUUID()}`,replyPath=origin+`/api/buyer/support/tickets/${ticket}/messages`;lost=false;
  const replyTap=tapRest(owned.restUrl,async(call,forward)=>{const res=await forward();if(call.resource==='rpc/execute_buyer_support_mutation'&&!lost){assert.equal(res.status,200);lost=true;await res.text();return restJson(503,{message:'synthetic committed reply response loss'});}return res;});
  try{assert.equal((await context.request.post(replyPath,{headers:headers(replyKey),data:{body:'Synthetic lost public reply'}})).status(),503);}finally{replyTap.restore();}
  assert.equal(lost,true);assert.equal((await context.request.post(replyPath,{headers:headers(replyKey),data:{body:'Synthetic lost public reply'}})).status(),201);
  const replyCount=Number(owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticket}' AND body='Synthetic lost public reply' AND visibility='public';`));
  console.log(JSON.stringify({proof:'web-bff-committed-loss',create_count:createCount,reply_count:replyCount}));
  stage='changed-intent';const beforeChanged=owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticket}';`);
  assert.equal((await context.request.post(replyPath,{headers:headers(replyKey),data:{body:'Synthetic changed intent'}})).status(),409);
  assert.equal(owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticket}';`),beforeChanged);
  stage='mounted-reply-loss-reload';await page.goto(origin+'/account/support');
  await page.getByRole('button',{name:/Synthetic web recovery/}).click();await page.getByLabel('Reply',{exact:true}).fill('Synthetic mounted lost reply');
  lost=false;const mountedTap=tapRest(owned.restUrl,async(call,forward)=>{const res=await forward();if(call.resource==='rpc/execute_buyer_support_mutation'&&!lost){assert.equal(res.status,200);lost=true;await res.text();return restJson(503,{message:'synthetic mounted committed loss'});}return res;});
  try{const [answer]=await Promise.all([page.waitForResponse(r=>r.url().endsWith(`/api/buyer/support/tickets/${ticket}/messages`)&&r.request().method()==='POST'),page.getByRole('button',{name:'Send reply',exact:true}).click()]);assert.equal(answer.status(),503);}finally{mountedTap.restore();}
  assert.equal(lost,true);await expect(page.getByRole('heading',{name:'Saved action awaiting confirmation',exact:true})).toBeVisible();
  const pendingRecord=await page.evaluate(()=>{const storage=(globalThis as unknown as {localStorage:{length:number;key(i:number):string|null;getItem(k:string):string|null}}).localStorage;const key=Array.from({length:storage.length},(_,i)=>storage.key(i)).find(k=>k?.startsWith('lb_support_pending_v1:'));return key?JSON.parse(storage.getItem(key)!):null;});
  assert.equal(pendingRecord.operation,'reply');assert.equal(pendingRecord.buyer,buyerA);assert.equal(pendingRecord.target,ticket);
  assert.deepEqual(Object.keys(pendingRecord).sort(),['buyer','hash','key','operation','store','target','version']);
  await page.getByLabel('Reply',{exact:true}).fill('Synthetic changed mounted intent');await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Recover your saved action'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Saved action awaiting confirmation',exact:true})).toBeVisible();
  const [recoveryRequest,recoveryAnswer]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith(`/api/buyer/support/tickets/${ticket}/messages`)),page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(`/api/buyer/support/tickets/${ticket}/messages`)),page.getByRole('button',{name:'Check saved action',exact:true}).click()]);
  assert.deepEqual(recoveryRequest.postDataJSON(),{action:'recover',key:pendingRecord.key});assert.equal(recoveryAnswer.status(),200);
  const recovered=(await recoveryAnswer.json()).mutationReceipt;assert.equal(recovered.key,pendingRecord.key);
  assert.equal(owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticket}' AND body='Synthetic mounted lost reply';`),'1');
  assert.equal(owned.psql(`SELECT id FROM ticket_messages WHERE ticket_id='${ticket}' AND body='Synthetic mounted lost reply';`),recovered.message_id);
  await expect(page.getByRole('heading',{name:'Saved action awaiting confirmation',exact:true})).toHaveCount(0);
  stage='mounted-create-loss-browser-restart';await page.getByLabel('Subject',{exact:true}).fill('Synthetic restarted request');await page.getByLabel('Message',{exact:true}).fill('Synthetic original restart complaint');
  lost=false;const restartTap=tapRest(owned.restUrl,async(call,forward)=>{const res=await forward();if(call.resource==='rpc/execute_buyer_support_mutation'&&!lost){assert.equal(res.status,200);lost=true;await res.text();return restJson(503,{message:'synthetic restarted committed loss'});}return res;});
  try{const [answer]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/buyer/support/tickets')&&r.request().method()==='POST'),page.getByRole('button',{name:'Send request',exact:true}).click()]);assert.equal(answer.status(),503);}finally{restartTap.restore();}
  assert.equal(lost,true);await expect(page.getByRole('heading',{name:'Saved action awaiting confirmation',exact:true})).toBeVisible();
  const restartKey=await page.evaluate(()=>{const storage=(globalThis as unknown as {localStorage:{length:number;key(i:number):string|null;getItem(k:string):string|null}}).localStorage;const name=Array.from({length:storage.length},(_,i)=>storage.key(i)).find(k=>k?.startsWith('lb_support_pending_v1:'))!;return JSON.parse(storage.getItem(name)!).key as string;});
  const state=await context.storageState();await context.close();await browser.close();
  browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP *.localhost 127.0.0.1']});context=await browser.newContext({storageState:state});page=await context.newPage();page.setDefaultTimeout(30_000);
  await page.goto(origin+'/account/support');await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('');await expect(page.getByLabel('Message',{exact:true})).toHaveValue('');
  await expect(page.getByText('Synthetic original restart complaint',{exact:true})).toHaveCount(0);
  const [restartAnswer]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/buyer/support/tickets')&&r.request().method()==='POST'),page.getByRole('button',{name:'Check saved action',exact:true}).click()]);assert.equal(restartAnswer.status(),200);
  const restartResult=await restartAnswer.json();assert.equal(restartResult.mutationReceipt.key,restartKey);await expect(page.getByRole('heading',{name:'Request received',exact:true})).toBeVisible();
  assert.equal(owned.psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${buyerA}' AND subject='Synthetic restarted request';`),'1');
  stage='delayed-reply-conversation-fence';await page.getByRole('button',{name:/Synthetic web recovery/}).click();await page.getByLabel('Reply',{exact:true}).fill('Synthetic delayed original target reply');
  let releaseReply!:()=>void,arrived=false;const held=new Promise<void>(r=>{releaseReply=r;});
  const heldTap=tapRest(owned.restUrl,async(call,forward)=>{const res=await forward();if(call.resource==='rpc/execute_buyer_support_mutation'&&!arrived){assert.equal(res.status,200);arrived=true;await held;}return res;});
  try{await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect.poll(()=>arrived).toBe(true);await page.getByRole('button',{name:/Synthetic restarted request/}).click();await expect(page.getByLabel('Reply',{exact:true})).toHaveValue('');releaseReply();await expect(page.getByRole('heading',{name:'Saved action awaiting confirmation',exact:true})).toHaveCount(0);await expect(page.getByText('Synthetic delayed original target reply',{exact:true})).toHaveCount(0);}
  finally{releaseReply();heldTap.restore();}
  assert.equal(owned.psql(`SELECT count(*) FROM ticket_messages WHERE ticket_id='${ticket}' AND body='Synthetic delayed original target reply';`),'1');
  stage='recovery-current-authority-and-roles';
  const recover=(operation:string,key:string,target:string|null=null)=>context.request.post(origin+`/api/buyer/support/tickets${target?`/${target}/messages`:''}`,{headers:headers(key),data:{action:'recover',key}});
  const signature='public.read_buyer_support_mutation_receipt(uuid,integer,uuid,text,uuid,text)';
  assert.equal(owned.psql(`SELECT has_function_privilege('anon','${signature}','EXECUTE'),has_function_privilege('authenticated','${signature}','EXECUTE'),has_function_privilege('app_tenant','${signature}','EXECUTE'),has_function_privilege('service_role','${signature}','EXECUTE');`),'f|f|f|t');
  for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT public.read_buyer_support_mutation_receipt('${buyerA}',1,'${store.siteId}','create',NULL,'${key}');ROLLBACK;`),/permission denied/);
  for(const update of ["visibility='internal'","deleted_at=now()","body='Synthetic redacted'"]){
   owned.psql(`UPDATE ticket_messages SET ${update} WHERE id='${recovered.message_id}';`);assert.equal((await recover('reply',pendingRecord.key,ticket)).status(),404);
   owned.psql(`UPDATE ticket_messages SET visibility='public',deleted_at=NULL,body='Synthetic mounted lost reply' WHERE id='${recovered.message_id}';`);
  }
  owned.psql(`UPDATE support_tickets SET deleted_at=now() WHERE id='${ticket}';`);assert.equal((await recover('reply',pendingRecord.key,ticket)).status(),404);owned.psql(`UPDATE support_tickets SET deleted_at=NULL WHERE id='${ticket}';`);
  let rechecked=false;const revokeTap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/read_buyer_support_mutation_receipt'&&!rechecked){rechecked=true;owned.psql(`UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id='${buyerA}';`);}return forward();});
  try{assert.equal((await recover('create',restartKey)).status(),401);}finally{revokeTap.restore();owned.psql(`UPDATE buyer_accounts SET session_epoch=1 WHERE id='${buyerA}';`);}assert.equal(rechecked,true);
  assert.equal((await recover('create',`uncommitted-${crypto.randomUUID()}`)).status(),404);
  stage='cursor-public-history';
  owned.psql(`INSERT INTO ticket_messages(ticket_id,author_type,visibility,body,created_at) SELECT '${ticket}','agent','public','Synthetic history '||n,now()+n*interval '1 second' FROM generate_series(1,105) n;INSERT INTO ticket_messages(ticket_id,author_type,visibility,body) VALUES('${ticket}','agent','internal','Synthetic private note');`);
  let cursor:string|null=null;const ids=new Set<string>();let pages=0;
  do{const history=await context.request.get(origin+`/api/buyer/support/tickets/${ticket}/messages?pagination=cursor&limit=50${cursor?'&cursor='+encodeURIComponent(cursor):''}`,{headers:{'x-letbuyy-expected-buyer-id':buyerA}});assert.equal(history.status(),200);const data=await history.json();for(const item of data.messages){assert.equal(item.body==='Synthetic private note',false);assert.equal(ids.has(item.id),false);ids.add(item.id);}cursor=data.nextCursor;pages++;assert.ok(pages<=4);}while(cursor);
  assert.equal(ids.size,109);assert.equal(pages,3);
  await page.getByRole('button',{name:/Synthetic web recovery/}).click();await expect(page.getByRole('button',{name:'Load later messages',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load later messages',exact:true}).click();await expect(page.getByRole('button',{name:'Load later messages',exact:true})).toHaveCount(0);await expect(page.getByText('Synthetic private note',{exact:true})).toHaveCount(0);
  owned.psql(`INSERT INTO support_tickets(ticket_ref,site_id,requester_type,requester_user_id,subject,channel,status,created_at) SELECT 'SYN-HISTORY-'||gen_random_uuid(),'${store.siteId}','customer','${buyerA}','Synthetic older request '||n,'chat','open',now()+n*interval '1 second' FROM generate_series(1,22) n;`);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('button',{name:'Load older requests',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load older requests',exact:true}).click();await expect(page.getByRole('button',{name:'Load older requests',exact:true})).toHaveCount(0);
  stage='readback-rollback-reapply';const countBeforeRollback=owned.psql(`SELECT count(*) FROM buyer_support_mutation_receipts WHERE buyer_account_id='${buyerA}';`);
  const forward=readFileSync(new URL('../../database/supabase/migrations/351_buyer_support_recovery_readback.sql',import.meta.url),'utf8');
  const rollback=readFileSync(new URL('../../database/supabase/rollback/351_buyer_support_recovery_readback.rollback.sql',import.meta.url),'utf8');
  try{owned.script(rollback);owned.psql("NOTIFY pgrst,'reload schema';");assert.equal((await recover('create',restartKey)).status(),503);assert.equal((await context.request.post(origin+'/api/buyer/support/tickets',{headers:headers(key),data:input})).status(),201);}finally{owned.script(forward);owned.psql("NOTIFY pgrst,'reload schema';");}
  await expect.poll(async()=>(await recover('create',restartKey)).status()).toBe(200);
  assert.equal(owned.psql(`SELECT count(*) FROM buyer_support_mutation_receipts WHERE buyer_account_id='${buyerA}';`),countBeforeRollback);
  stage='normal-identity-b';await page.goto(origin+'/account/settings');const [logout]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/buyer-auth/logout')&&r.request().method()==='POST'),page.getByRole('button',{name:'Sign out of LetBuyy at this store',exact:true}).click()]);assert.equal(logout.status(),200);
  await expect.poll(async()=>(await context.cookies(origin)).some(c=>c.name==='__Host-lb_store_buyer')).toBe(false);await page.close();page=await context.newPage();page.setDefaultTimeout(30_000);
  const buyerB=await register(page,true);assert.notEqual(buyerB,buyerA);
  stage='captured-a-intent-with-b-cookie';const actorResult=await context.request.post(origin+'/api/buyer/support/tickets',{headers:headers(`web-${crypto.randomUUID()}`),data:input});
  const crossed=Number(owned.psql(`SELECT count(*) FROM support_tickets WHERE requester_user_id='${buyerB}';`));
  console.log(JSON.stringify({proof:'web-bff-before-or-after',create_count:createCount,reply_count:replyCount,captured_actor_status:actorResult.status(),wrong_actor_effects:crossed,normal_registrations:calls.filter(c=>c.path==='/v1/storefront/buyer/register'&&c.status===201).length}));
  assert.deepEqual({createCount,replyCount,status:actorResult.status(),crossed},{createCount:1,replyCount:1,status:409,crossed:0});
  assert.equal((await context.request.get(origin+`/api/buyer/support/tickets/${ticket}/messages`)).status(),404);
  assert.equal((await context.request.post(origin+'/api/buyer/support/tickets',{headers:headers(key,buyerB),data:{action:'recover',key}})).status(),404);
  await context.close();
 }catch(error){console.log(JSON.stringify({diagnostic:'n6_web_stage',stage,calls:calls.slice(-12)}));throw new Error(`Browser stage ${stage} failed: ${String((error as Error).message).split('\n')[0].replace(/https?:\/\/\S+/g,'[local URL]')}`);}
 finally{await browser?.close();await stopOwnedClientRuntime(commerce);await stopOwnedClientRuntime(identity);await gateway.settle();if(adapter){adapter.closeAllConnections();await new Promise<void>(r=>adapter!.close(()=>r()));}}
});
