import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import test, { before } from 'node:test';
import { exportJWK } from 'jose';
import { chromium, expect, type Page } from '@playwright/test';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { dispatchPushNotificationToDevices } from '../../services/queue-workers/src/push-dispatcher';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant,seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase(),site=newSyntheticTenant('push-pref'),other=newSyntheticTenant('push-other'),rival=newSyntheticTenant('push-rival'),actor=randomUUID();
let gateway:Gateway,db:ReturnType<typeof createSupabaseServiceClient>;
before(async()=>{
  for(const s of [site,other,rival])seedSyntheticTenant(owned.psql,s);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','syn-${actor}@example.invalid',true); UPDATE sites SET custom_user_id='${actor}' WHERE id IN ('${site.siteId}','${other.siteId}');`);
  const env=gatewayEnv(owned,await newIdentityKeys());gateway=new Gateway(env);db=createSupabaseServiceClient(env);
  const r=await gateway.request('/v1/notifications/device-tokens',{method:'POST',headers:{...await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`),'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({token:'synthetic-push-test-'+randomUUID(),platform:'android'})});
  assert.equal(r.status,201,r.text);
});
async function setPreference(category:string,enabled:boolean,storeId=site.siteId){
  const r=await gateway.request('/v1/notifications/preferences',{method:'PUT',headers:{...await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`),'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({store_id:storeId,channel:'push',category,enabled})});
  assert.equal(r.status,200,r.text);
}
async function dispatch(){return dispatchPushNotificationToDevices(db,{PUSH_DISPATCH_MODE:'dry-run'},{userId:actor,siteId:site.siteId,category:'order_created',title:'Synthetic',message:'Synthetic only',data:{}});}
test('real persisted master push switch suppresses dispatch and re-enable restores its dry-run plan',async()=>{
  await setPreference('system',false);let r=await dispatch();assert.equal(r.sent,0);assert.equal(r.skipped,1);
  await setPreference('system',true);r=await dispatch();assert.equal(r.sent,1);assert.equal(r.dryRun,true);
});
test('event-specific push preference persists and gates sends; another store cannot suppress this store',async()=>{
  await setPreference('order_created',false);assert.equal((await dispatch()).skipped,1);
  await setPreference('order_created',true);await setPreference('system',false,other.siteId);
  const r=await dispatch();assert.equal(r.sent,1);assert.equal(r.skipped,0);
});
test('preference writes reject malformed input and rival ownership while valid state reads back',async()=>{
  const headers=async()=>({...await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`),'Content-Type':'application/json','Idempotency-Key':randomUUID()});
  for(const body of [
    {store_id:site.siteId,channel:'push',category:'order_created',enabled:'false'},
    {store_id:site.siteId,channel:'invalid',category:'order_created',enabled:false},
    {store_id:site.siteId,channel:'push',category:'   ',enabled:false},
    {store_id:site.siteId,channel:'push',category:'order_created',enabled:false,user_id:actor},
  ]){
    const r=await gateway.request('/v1/notifications/preferences',{method:'PUT',headers:await headers(),body:JSON.stringify(body)});
    assert.equal(r.status,400,r.text);
  }
  const denied=await gateway.request('/v1/notifications/preferences',{method:'PUT',headers:await headers(),body:JSON.stringify({store_id:rival.siteId,channel:'push',category:'order_created',enabled:false})});
  assert.equal(denied.status,403,denied.text);
  const read=await gateway.request(`/v1/notifications/preferences?store_id=${site.siteId}`,{headers:await headers()});
  assert.equal(read.status,200,read.text);
  const rows=JSON.parse(read.text).data as Array<{channel:string;category:string;enabled:boolean}>;
  assert.equal(rows.find(row=>row.channel==='push'&&row.category==='order_created')?.enabled,true);
});
test('delivery-log query rejects malformed filters and preserves site ownership',async()=>{
  const headers=async()=>await signedIdentityHeaders(actor,`syn-${actor}@example.invalid`);
  for(const query of ['page=NaN','page=0','limit=101','status=bounced','channel=unknown','site_id=not-a-uuid']){
    const r=await gateway.request(`/v1/notifications/delivery-logs?site_id=${site.siteId}&${query}`,{headers:await headers()});
    assert.equal(r.status,400,`${query}: ${r.text}`);
  }
  const denied=await gateway.request(`/v1/notifications/delivery-logs?site_id=${rival.siteId}`,{headers:await headers()});
  assert.equal(denied.status,403,denied.text);
  const allowed=await gateway.request(`/v1/notifications/delivery-logs?site_id=${site.siteId}&page=1&limit=25&status=queued`,{headers:await headers()});
  assert.equal(allowed.status,200,allowed.text);
  assert.ok(Array.isArray(JSON.parse(allowed.text).data));
});

async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
async function ready(url:string,child:OwnedClientProcess){const end=Date.now()+360000;while(Date.now()<end){if(child.exitCode!==null||child.signalCode!==null)throw new Error('Owned app stopped before readiness');try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{/* bounded owned startup */}await new Promise(resolve=>setTimeout(resolve,200));}throw new Error('Owned app readiness timed out');}
async function signIn(page:Page,identity:string,merchant:string,email:string,password:string,storeName:string){
  await page.goto(identity+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30000});
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).fill(password);
  const [response]=await Promise.all([page.waitForResponse(reply=>reply.url().endsWith('/api/auth/login')&&reply.request().method()==='POST'),page.getByRole('button',{name:'Log in',exact:true}).click()]);
  assert.equal(response.status(),200);
  await page.waitForURL(url=>url.origin===merchant||(url.origin===identity&&url.pathname==='/select'),{timeout:60000});
  if(new URL(page.url()).origin===identity){
    await expect(page.getByRole('heading',{name:'Choose a store',exact:true})).toBeVisible();
    await page.getByRole('button').filter({has:page.getByText(storeName,{exact:true})}).click();
  }
  await page.waitForURL(url=>url.origin===merchant,{timeout:60000});
}
test('normal Merchant browser confirms notification preference writes and recovers log reads',{timeout:840000},async()=>{
  let stage='fixture setup';
  const mark=(next:string)=>{stage=next;console.info('OWNED_NOTIFICATION_BROWSER_STAGE '+next);};
  const email=`syn-${actor}@example.invalid`,password='Synthetic-notification-browser-pass-42';
  const hash=await hashMerchantPassword(password);
  owned.psql(`UPDATE users_custom SET password_hash='${hash}',full_name='Synthetic Notification Owner' WHERE id='${actor}';`);
  const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
  const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
  const browserGateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,...proxy.env()}));
  let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
  const runtimeErrors:string[]=[];
  let loseReply=false,logReadOutage=false;
  try{
    bridge=createServer(async(req,res)=>{
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),headers=new Headers();
      for(const [name,value]of Object.entries(req.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
      try{
        const path=(req.url??'/').split('?')[0];
        if(path==='/v1/notifications/delivery-logs'&&req.method==='GET'&&logReadOutage){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_LOG_READ_OUTAGE',message:'Synthetic delivery log outage'}}));return;}
        const result=await browserGateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});
        if(path==='/v1/notifications/preferences'&&req.method==='PUT'&&result.status===200&&loseReply){loseReply=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_REPLY_LOSS',message:'Synthetic committed response loss'}}));return;}
        res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
      }catch{res.writeHead(500);res.end('{}');}
    });
    await new Promise<void>(resolve=>bridge!.listen(0,'127.0.0.1',resolve));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
    const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
    identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
      LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:randomUUID()+randomUUID(),COOKIE_DOMAIN:'',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
    merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
    for(const app of [identity,merchant])app.stderr.on('data',data=>runtimeErrors.push(data.toString().slice(0,1200)));
    await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);mark('apps ready');
    browser=await chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
    await signIn(page,identityOrigin,merchantOrigin,email,password,`Synthetic ${site.tag}`);mark('normal sign-in');
    page.on('response',reply=>{if(reply.url().includes('/notifications/'))console.info('OWNED_NOTIFICATION_BROWSER_RESPONSE '+JSON.stringify({url:new URL(reply.url()).pathname,status:reply.status()}));});
    const response=await page.goto(`${merchantOrigin}/${site.subdomain}/settings/notifications`);
    assert.equal(response?.status(),200);await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();mark('notifications page');
    const orderEmails=page.getByRole('switch',{name:'Toggle Order emails'});
    await expect(orderEmails).toHaveAttribute('aria-checked','true');
    await orderEmails.click({noWaitAfter:true,timeout:20000});mark('first click');await expect(orderEmails).toHaveAttribute('aria-checked','false',{timeout:20000});mark('first UI readback');
    assert.equal(owned.psql(`SELECT enabled::text FROM notification_preferences WHERE user_id='${actor}' AND store_id='${site.siteId}' AND channel='email' AND category='orders';`),'false');mark('first DB readback');
    loseReply=true;
    await orderEmails.click({noWaitAfter:true,timeout:20000});mark('lost click');await expect(orderEmails).toHaveAttribute('aria-checked','true',{timeout:20000});mark('lost UI readback');
    assert.equal(owned.psql(`SELECT enabled::text FROM notification_preferences WHERE user_id='${actor}' AND store_id='${site.siteId}' AND channel='email' AND category='orders';`),'true');mark('lost DB readback');
    const denied=await context.request.put(`${merchantOrigin}/api/stores/${rival.subdomain}/notifications/preferences`,{headers:{Origin:merchantOrigin},data:{channel:'email',category:'orders',enabled:false}});
    assert.ok([403,404].includes(denied.status()),await denied.text());mark('rival denied');
    logReadOutage=true;await page.getByRole('button',{name:'Refresh delivery logs'}).click();
    await expect(page.getByText('Synthetic delivery log outage')).toBeVisible();await expect(page.getByText('No delivery logs')).toHaveCount(0);mark('log outage');
    logReadOutage=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
    await expect(page.getByText('No delivery logs')).toBeVisible();mark('log recovery');
    await page.getByLabel('Status',{exact:true}).selectOption('queued');
    await page.getByRole('button',{name:'Apply',exact:true}).click({noWaitAfter:true,timeout:20000});
    await expect(page.getByText('No delivery logs')).toBeVisible();mark('filter response');
    await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
    console.info('OWNED_NOTIFICATION_BROWSER '+JSON.stringify({runId:owned.runId,normalSignIn:true,persistedPreferenceReadback:true,lostReplyRecovered:true,rivalDenied:true,logOutageRecovered:true,queuedFilter:true,phoneHeadingVisible:true,providerDelivery:false}));
    await context.close();
  }catch(error){console.info('OWNED_NOTIFICATION_BROWSER_FAILURE '+JSON.stringify({stage,identityExit:identity?.exitCode,merchantExit:merchant?.exitCode,errors:runtimeErrors.slice(-8),path:page?new URL(page.url()).pathname:null}));throw error;
  }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await browserGateway.settle();await proxy.stop();if(bridge){bridge.closeAllConnections();await new Promise<void>(resolve=>bridge!.close(()=>resolve()));}}
});
