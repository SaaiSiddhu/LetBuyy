// Normal merchant password sign-in -> maintained web -> real Gateway/pooled DB.
// Verified synthetic accounts are fixture inputs, not provider/inbox proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer,type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runLoyaltyEarnSweeper} from '../../services/queue-workers/src/loyalty-earn';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
const owned=requireOwnedDatabase();
async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
async function ready(url:string,child:OwnedClientProcess){const end=Date.now()+360000;while(Date.now()<end){if(child.exitCode!==null||child.signalCode!==null)throw new Error('Owned app stopped before readiness');try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{/* bounded owned startup */}await new Promise(resolve=>setTimeout(resolve,200));}throw new Error('Owned app readiness timed out');}
async function signIn(page:Page,identity:string,merchant:string,email:string,password:string){
 await page.goto(identity+'/login');await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30000});
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Continue with email',exact:true}).click();
 await page.getByLabel('Password',{exact:true}).fill(password);
 const [response]=await Promise.all([page.waitForResponse(reply=>reply.url().endsWith('/api/auth/login')&&reply.request().method()==='POST'),page.getByRole('button',{name:'Log in',exact:true}).click()]);
 assert.equal(response.status(),200);await page.waitForURL(url=>url.origin===merchant,{timeout:60000});
}
test('normal merchant configures rewards with owned retries, policy conflicts, stale tabs and account denials',{timeout:840000},async()=>{
 const site=newSyntheticTenant('loyalty-browser');seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),email=`syn-loy-browser-${owner}@example.invalid`,password='Synthetic-loyalty-browser-pass-42';
 const otherSite=newSyntheticTenant('loyalty-other');seedSyntheticTenant(owned.psql,otherSite);
 const other=crypto.randomUUID(),otherEmail=`syn-loy-other-${other}@example.invalid`;
 const hash=await hashMerchantPassword(password);owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${owner}','${email}',true,'Synthetic Loyalty Owner','${hash}'),('${other}','${otherEmail}',true,'Synthetic Other Owner','${hash}');UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';UPDATE sites SET custom_user_id='${other}' WHERE id='${otherSite.siteId}';`);
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`;
 const proxy=await startOwnedPooledSqlProxy(owned),keys=await newIdentityKeys();
 const gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,...proxy.env()}));
 let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
 const calls:{path:string;status:number;key:string|null}[]=[],errors:string[]=[];
 let readOutage=true,loseSaveReply=false;
 const evidence=`/private/tmp/letbuyy-loyalty-web-evidence-${owned.runId}`;mkdirSync(evidence,{recursive:true});
 try{
  bridge=createServer(async(req,res)=>{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString(),headers=new Headers();
   for(const [name,value]of Object.entries(req.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
   try{
    const path=(req.url??'/').split('?')[0];
    if(path==='/v1/loyalty/program'&&req.method==='GET'&&readOutage){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_LOYALTY_READ_OUTAGE',message:'Synthetic loyalty read outage. Retry loading.'}}));return;}
    const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});calls.push({path,status:result.status,key:headers.get('X-Idempotency-Key')});
    if(path==='/v1/loyalty/program'&&req.method==='PUT'&&result.status===200&&loseSaveReply){loseSaveReply=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SYNTHETIC_COMMITTED_REPLY_LOSS',message:'The save outcome is unknown. Retry the same save.'}}));return;}
    res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
   }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise<void>(resolve=>bridge!.listen(0,'127.0.0.1',resolve));const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
  const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
  identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
   LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
   NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
  merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
  for(const app of [identity,merchant])app.stderr.on('data',data=>errors.push(data.toString().slice(0,800)));
  await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
  browser=await chromium.launch({headless:true});const context=await browser.newContext();page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
  await signIn(page,identityOrigin,merchantOrigin,email,password);
  const response=await page.goto(`${merchantOrigin}/${site.subdomain}/settings/loyalty`);
  assert.equal(response?.status(),200,'loyalty settings must be an actual maintained page');
  await expect(page.getByRole('heading',{name:'Loyalty',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Loyalty',exact:true}).first()).toBeVisible();
  await expect(page.getByText('Loyalty settings need attention',{exact:true})).toBeVisible();
  await expect(page.getByText('Loyalty is not set up',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Earn rate (%)',{exact:true})).toHaveCount(0);
  await page.screenshot({path:evidence+'/read-outage.png',fullPage:true});
  readOutage=false;await page.getByRole('button',{name:'Retry loading loyalty',exact:true}).click();
  await expect(page.getByText('Loyalty is not set up',{exact:true})).toBeVisible();
  const endpoint=`${merchantOrigin}/api/stores/${site.subdomain}/loyalty`,contextHeader={'X-LetBuyy-Merchant-Context':owner};
  const audits=()=>owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_type='loyalty_program' AND resource_id='${site.siteId}';`);
  for(const origin of [undefined,'http://sibling.localhost']){
   const denied=await context.request.put(endpoint,{headers:{...contextHeader,...(origin?{Origin:origin}:{}),'X-Idempotency-Key':crypto.randomUUID()},data:{expected_updated_at:null,is_active:true}});
   assert.equal(denied.status(),403);
  }
  const injected=await context.request.put(endpoint,{headers:{...contextHeader,Origin:merchantOrigin,'X-Idempotency-Key':crypto.randomUUID()},data:{expected_updated_at:null,is_active:true,store_id:otherSite.siteId}});
  assert.equal(injected.status(),400);assert.equal(audits(),'0');
  await page.getByLabel('Allow customers to earn and use points',{exact:true}).check();await page.getByLabel('Earn rate (%)',{exact:true}).fill('10');
  loseSaveReply=true;
  const [lost]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);
  assert.equal(lost.status(),503);const retryKey=lost.request().headers()['x-idempotency-key'];assert.ok(retryKey);
  await expect(page.getByText('A previous save needs confirmation',{exact:true})).toBeVisible();assert.equal(audits(),'1');
  await page.reload();await expect(page.getByText('A previous save needs confirmation',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Earn rate (%)',{exact:true})).toBeDisabled();
  const [replayed]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Retry same save',exact:true}).click()]);
  assert.equal(replayed.status(),200,await replayed.text());assert.equal(replayed.request().headers()['x-idempotency-key'],retryKey);
  await expect(page.getByText('Loyalty settings saved.',{exact:true})).toBeVisible();assert.equal(audits(),'1');
  assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${site.siteId}' AND scope LIKE 'merchant-loyalty-program-v1:%';`),'1');
  await page.getByLabel('Earn rate (%)',{exact:true}).fill('12.34');
  const [rateSave]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);
  assert.equal(rateSave.status(),200,await rateSave.text());await expect(page.getByText('Loyalty settings saved.',{exact:true})).toBeVisible();
  assert.equal(owned.psql(`SELECT earn_rate_bps FROM loyalty_programs WHERE site_id='${site.siteId}';`),'1234');
  // These paid inputs are synthetic. The scheduled implementation is real;
  // this is not a normal checkout, payment-provider or buyer-device verdict.
  await page.getByLabel('Value per point (paise)',{exact:true}).fill('50');
  const buyer=crypto.randomUUID(),order=crypto.randomUUID();
  owned.psql(`INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${buyer}','syn-loy-buyer-${buyer}@example.invalid',true);
   INSERT INTO orders(id,site_id,store_id,order_number,customer_email,shipping_address,items,total,subtotal,payment_status)VALUES('${order}','${site.siteId}','${site.siteId}','SYN-${order}','syn-loy-buyer-${buyer}@example.invalid','{}','[]',1000,1000,'paid');
   INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${order}','${buyer}','${site.siteId}','authenticated_checkout');`);
  assert.equal((await runLoyaltyEarnSweeper(owned.restEnv(),{requestId:'syn-loy-browser-earn',limit:1})).awarded,1);
  const [refused]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);
  assert.equal(refused.status(),409);assert.equal((await refused.json()).error.code,'LOYALTY_VALUE_DECREASE_BLOCKED');assert.equal(audits(),'2');
  await page.getByRole('button',{name:'Reload current saved settings',exact:true}).click();
  await expect(page.getByText('Outstanding points:',{exact:false})).toContainText('123');
  await page.getByLabel('Value per point (paise)',{exact:true}).fill('50');await expect(page.getByRole('button',{name:'Save loyalty',exact:true})).toBeDisabled();
  await expect(page.getByText('Point value cannot decrease while customers hold points.',{exact:true})).toBeVisible();
  await page.getByLabel('Value per point (paise)',{exact:true}).fill('150');await expect(page.getByText('Change in outstanding reward value:',{exact:false})).toContainText('₹61.50');
  const [increased]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);
  assert.equal(increased.status(),200);await expect(page.getByText('Loyalty settings saved.',{exact:true})).toBeVisible();assert.equal(audits(),'3');
  assert.equal(owned.psql(`SELECT metadata->>'liability_delta_minor' FROM audit_logs WHERE resource_id='${site.siteId}' ORDER BY created_at DESC,id DESC LIMIT 1;`),'6150');
  await expect(page.getByText('Current reward value:',{exact:false})).toContainText('₹184.50');
  await page.screenshot({path:evidence+'/active-light.png',fullPage:true});
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.screenshot({path:evidence+'/system-dark-host-forced-light.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('Value per point (paise)',{exact:true})).toBeVisible();
  await page.screenshot({path:evidence+'/active-mobile-width.png',fullPage:true});await page.setViewportSize({width:1280,height:900});
  const staleTab=await context.newPage();await staleTab.goto(`${merchantOrigin}/${site.subdomain}/settings/loyalty`);await expect(staleTab.getByLabel('Earn rate (%)',{exact:true})).toHaveValue('12.34');
  await page.getByLabel('Maximum order value paid with points (%)',{exact:true}).fill('60');
  const [capSave]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);assert.equal(capSave.status(),200);
  await expect(page.getByText('Loyalty settings saved.',{exact:true})).toBeVisible();
  await staleTab.getByLabel('Earn rate (%)',{exact:true}).fill('16');
  const [stale]=await Promise.all([staleTab.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),staleTab.getByRole('button',{name:'Save loyalty',exact:true}).click()]);assert.equal(stale.status(),409);assert.equal((await stale.json()).error.code,'LOYALTY_VERSION_CONFLICT');
  await expect(staleTab.getByRole('button',{name:'Save loyalty',exact:true})).toBeDisabled();assert.equal(audits(),'4');
  await staleTab.getByRole('button',{name:'Reload current saved settings',exact:true}).click();await expect(staleTab.getByLabel('Maximum order value paid with points (%)',{exact:true})).toHaveValue('60');
  assert.equal(owned.psql(`SELECT earn_rate_bps FROM loyalty_programs WHERE site_id='${site.siteId}';`),'1234');
  const otherContext=await browser.newContext(),otherPage=await otherContext.newPage();await signIn(otherPage,identityOrigin,merchantOrigin,otherEmail,password);
  const deniedRead=await otherContext.request.get(endpoint,{headers:{'X-LetBuyy-Merchant-Context':other}});assert.ok([403,404].includes(deniedRead.status()));
  const staleActor=await otherContext.request.put(endpoint,{headers:{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':owner,'X-Idempotency-Key':crypto.randomUUID()},data:{expected_updated_at:null,is_active:false}});assert.equal(staleActor.status(),409);assert.equal((await staleActor.json()).error.code,'SESSION_CONTEXT_CHANGED');
  // A separately normal signed-in B credential replaces only the cookie jar.
  // This fault probe proves the mounted A form cannot act under that identity.
  await page.bringToFront();await page.getByLabel('Earn rate (%)',{exact:true}).fill('20');await context.addCookies(await otherContext.cookies(merchantOrigin));
  const [changedAccount]=await Promise.all([page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='PUT'),page.getByRole('button',{name:'Save loyalty',exact:true}).click()]);assert.equal(changedAccount.status(),409);
  await expect(page.getByText('Account or store access changed',{exact:true})).toBeVisible();await expect(page.getByLabel('Earn rate (%)',{exact:true})).toHaveCount(0);assert.equal(audits(),'4');
  writeFileSync(evidence+'/result.json',JSON.stringify({runId:owned.runId,normalSignIns:2,readOutageRecovered:true,lostReplyKeyRetainedAcrossReload:true,staleVersionDenied:true,ownerPolicyRaceDenied:true,
   syntheticPaidWorkerInput:true,earnedPoints:123,configurationAudits:4,normalBuyerCheckout:false,providerInboxProof:false,darkModeVerdict:'not verified: existing merchant root forces light even under OS dark preference',calls:calls.filter(call=>call.path==='/v1/loyalty/program')},null,2)+'\n');
  console.info('OWNED_LOYALTY_BROWSER '+JSON.stringify({runId:owned.runId,evidence,normalSignIns:2,configurationAudits:4,earnedPoints:123,syntheticPaidInput:true}));
  await otherContext.close();await context.close();
 }catch(error){console.info('OWNED_LOYALTY_BROWSER_FAILURE '+JSON.stringify({path:page?new URL(page.url()).pathname:null,visible:await page?.locator('body').innerText().catch(()=>''),calls:calls.slice(-25),errors:errors.slice(-8)}));await page?.screenshot({path:`/private/tmp/letbuyy-loyalty-browser-${owned.runId}.png`}).catch(()=>{});throw error;
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();await proxy.stop();if(bridge){bridge.closeAllConnections();await new Promise<void>(resolve=>bridge!.close(()=>resolve()));}}
});
